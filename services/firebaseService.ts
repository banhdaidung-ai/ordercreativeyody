import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  setDoc,
  getDoc,
  limit,
  Timestamp,
  runTransaction,
  startAfter,
  QueryDocumentSnapshot,
  limit as firestoreLimit,
  QueryConstraint
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { 
  WorkOrder, 
  BudgetItem, 
  PlanItem, 
  MasterDataItem, 
  UserAccount, 
  SystemLogEntry, 
  DEFAULT_MASTER_DATA,
  BudgetColumnConfig
} from "../types";

// Helper to handle Firestore index errors
const handleIndexError = (error: any, context: string) => {
  if (error.message && error.message.includes('requires an index')) {
    const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
    if (indexUrl) {
      console.error(`MISSING INDEX ERROR in ${context}. Create it here: ${indexUrl}`);
      // Attach the URL to the error object so the UI can use it
      (error as any).indexUrl = indexUrl;
    }
  }
  throw error;
};

// Helper to convert Firestore data to our types
const fromFirestore = (doc: any) => {
  const data = doc.data();
  return { ...data, id: doc.id };
};

// Helper to remove undefined values before saving to Firestore
const sanitizeData = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = sanitizeData(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }
  });
  
  return sanitized;
};

// Helper to safely access localStorage
const safeLocalStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage access denied for key: ${key}`);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`localStorage access denied for key: ${key}`);
    }
  }
};

const getCollectionName = (gid: string): string => {
  const productionGid = localStorage.getItem('PRODUCTION_GID') || '0';
  // Normalize: if productionGid is '1521307773', it's treated as '0' in some parts of the app
  const isProd = gid === '0' || gid === productionGid || (productionGid === '1521307773' && gid === '0');
  return isProd ? 'workOrders_production' : 'workOrders_design';
};

// --- WORK ORDERS ---
export interface FetchSheetDataResult {
  data: WorkOrder[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export const fetchSheetData = async (
  gid: string, 
  lastDoc: QueryDocumentSnapshot | null = null, 
  pageSize: number = 100,
  filters: any = {}
): Promise<FetchSheetDataResult> => {
  const collectionName = getCollectionName(gid);
    try {
    const constraints: QueryConstraint[] = [];

    // 1. Handle Status Exclusion (Default view: all except Completed)
    let hasInequalityFilter = false;
    if (filters.excludeStatus) {
      constraints.push(where('status', '!=', filters.excludeStatus));
      constraints.push(orderBy('status'));
      hasInequalityFilter = true;
    }

    // 2. Handle Completed Orders or Report View with Date Range
    if (filters.reportMonth !== undefined && filters.reportYear !== undefined) {
      // For report view, we fetch all data for a specific month
      const startOfMonth = new Date(Date.UTC(filters.reportYear, filters.reportMonth, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(filters.reportYear, filters.reportMonth + 1, 0, 23, 59, 59, 999)).toISOString();
      
      constraints.push(where('dueDate', '>=', startOfMonth));
      constraints.push(where('dueDate', '<=', endOfMonth));
      constraints.push(orderBy('dueDate', 'desc'));
      hasInequalityFilter = true;
    } else if (filters.status === 'Hoàn tất' && (filters.startDate || filters.endDate)) {
      constraints.push(where('status', '==', 'Hoàn tất'));
      if (filters.startDate) {
        constraints.push(where('dueDate', '>=', filters.startDate));
        hasInequalityFilter = true;
      }
      if (filters.endDate) {
        constraints.push(where('dueDate', '<=', filters.endDate));
        hasInequalityFilter = true;
      }
      constraints.push(orderBy('dueDate', 'desc'));
    } else if (!filters.excludeStatus) {
      // Default sort if no exclusion or specific completed view
      constraints.push(orderBy('orderCode', 'desc'));
    } else {
      // If excludeStatus is active, we already added orderBy('status')
      constraints.push(orderBy('orderCode', 'desc'));
    }

    constraints.push(firestoreLimit(pageSize));

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    // Server-side filtering (existing logic)
    // Only apply orderCode range filter if no other inequality filter is present
    if (filters.orderCode && filters.orderCode.trim() !== '' && !hasInequalityFilter) {
      const searchStr = filters.orderCode.trim();
      constraints.push(where('orderCode', '>=', searchStr));
      constraints.push(where('orderCode', '<=', searchStr + '\uf8ff'));
    }

    // Note: If we already have an inequality filter (excludeStatus), 
    // we can't add more inequality filters on other fields easily without composite indexes.
    // But 'in' filters are okay.

    if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
      const values = filters.status.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('status', 'in', values.slice(0, 10)));
    }
    if (filters.stylist && filters.stylist.length > 0) {
      const values = filters.stylist.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('stylist', 'in', values.slice(0, 10)));
    }
    if (filters.photoPerson && filters.photoPerson.length > 0) {
      const values = filters.photoPerson.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('photoPerson', 'in', values.slice(0, 10)));
    }
    if (filters.videoPerson && filters.videoPerson.length > 0) {
      const values = filters.videoPerson.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('videoPerson', 'in', values.slice(0, 10)));
    }
    if (filters.designer && filters.designer.length > 0) {
      const values = filters.designer.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('designer', 'in', values.slice(0, 10)));
    }
    if (filters.category && filters.category.length > 0) {
      const values = filters.category.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('category', 'in', values.slice(0, 10)));
    }
    if (filters.department && filters.department.length > 0) {
      const values = filters.department.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('department', 'in', values.slice(0, 10)));
    }
    if (filters.orderer && filters.orderer.length > 0) {
      const values = filters.orderer.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('orderer', 'in', values.slice(0, 10)));
    }
    if (filters.productType && filters.productType.length > 0) {
      const values = filters.productType.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('productType', 'in', values.slice(0, 10)));
    }
    if (filters.classType && filters.classType.length > 0) {
      const values = filters.classType.map((v: any) => v === '(Trống)' ? '' : v);
      constraints.push(where('classType', 'in', values.slice(0, 10)));
    }

    const q = query(collection(db, collectionName), ...constraints);
    try {
      const querySnapshot = await getDocs(q);
      

      
      const data = querySnapshot.docs.map(doc => fromFirestore(doc) as WorkOrder);
      const nextLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
      
      return {
        data,
        lastDoc: nextLastDoc,
        hasMore: data.length === pageSize
      };
    } catch (error: any) {
      return handleIndexError(error, `fetchSheetData from ${collectionName}`);
    }
  } catch (error) {
    console.error(`Error fetching sheet data from ${collectionName}:`, error);
    throw error;
  }
};

export const saveWorkOrder = async (order: WorkOrder, targetGid: string): Promise<void> => {
  const collectionName = getCollectionName(targetGid);
  const orderRef = doc(db, collectionName, order.id);
  
  // Remove isDraft flag when saving
  const { isDraft, ...dataToSave } = order;
  const sanitizedOrder = sanitizeData(dataToSave);
  
  // Use setDoc with merge: true to create or update efficiently
  await setDoc(orderRef, sanitizedOrder, { merge: true });
};

export const deleteWorkOrder = async (id: string, gid: string): Promise<void> => {
  const collectionName = getCollectionName(gid);
  await deleteDoc(doc(db, collectionName, id));
};

// --- BUDGET ---
export const fetchBudgetData = async (): Promise<BudgetItem[]> => {
  try {
    const q = query(collection(db, "budgetItems"), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => fromFirestore(doc) as BudgetItem);
  } catch (error) {
    return handleIndexError(error, "fetchBudgetData");
  }
};

export const saveBudgetItem = async (item: BudgetItem, columns: BudgetColumnConfig[]): Promise<void> => {
  const itemRef = doc(db, "budgetItems", item.id);
  const docSnap = await getDoc(itemRef);
  const sanitizedItem = sanitizeData(item);
  
  if (docSnap.exists()) {
    await updateDoc(itemRef, sanitizedItem);
  } else {
    await setDoc(itemRef, sanitizedItem);
  }
};

export const deleteBudgetItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "budgetItems", id));
};

// --- PLANNING ---
export const fetchPlanData = async (monthYear?: string): Promise<PlanItem[]> => {
  try {
    let q = query(collection(db, "planItems"));
    if (monthYear) {
      q = query(collection(db, "planItems"), where("monthYear", "==", monthYear));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => fromFirestore(doc) as PlanItem);
  } catch (error) {
    return handleIndexError(error, "fetchPlanData");
  }
};

export const savePlanItem = async (item: PlanItem): Promise<string> => {
  const itemRef = doc(db, "planItems", item.id);
  const now = new Date().toISOString();
  
  try {
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(itemRef);
      
      if (docSnap.exists()) {
        const serverData = docSnap.data() as PlanItem;
        
        // Conflict detection: If server has a newer updatedAt than what we have locally
        if (item.updatedAt && serverData.updatedAt && serverData.updatedAt > item.updatedAt) {
          throw new Error("CONFLICT: Dữ liệu trên máy chủ mới hơn. Vui lòng tải lại trang.");
        }
        
        const sanitizedItem = sanitizeData({ ...item, updatedAt: now });
        transaction.update(itemRef, sanitizedItem);
      } else {
        const sanitizedItem = sanitizeData({ ...item, updatedAt: now });
        transaction.set(itemRef, sanitizedItem);
      }
    });
    return now;
  } catch (error: any) {
    if (error.message && error.message.includes("CONFLICT")) {
      throw error;
    }
    console.error("Error saving plan item:", error);
    throw error;
  }
};

export const deletePlanItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "planItems", id));
};

// --- MASTER DATA & USERS ---
export const fetchMasterData = async (): Promise<MasterDataItem[]> => {
  try {
    const q = query(collection(db, "masterData"), orderBy("order", "asc"));
    const querySnapshot = await getDocs(q);
    const firebaseData = querySnapshot.docs.map(doc => fromFirestore(doc) as MasterDataItem);
    return [...DEFAULT_MASTER_DATA, ...firebaseData];
  } catch (error) {
    return handleIndexError(error, "fetchMasterData");
  }
};

export const fetchSystemUsers = async (): Promise<UserAccount[]> => {
  try {
    const q = query(collection(db, "masterData"), where("listKey", "==", "SYSTEM_USERS"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const item = doc.data();
      const roleRaw = String(item.textColor || 'member').toLowerCase();
      let role: 'admin' | 'member' | 'collaborator' = 'member';
      if (roleRaw === 'admin') role = 'admin';
      else if (roleRaw === 'collaborator' || roleRaw === 'ctv') role = 'collaborator';
      
      return {
        id: doc.id,
        email: String(item.value || '').toLowerCase().trim(),
        password: String(item.color || ''),
        role,
        name: String(item.description || '')
      };
    });
  } catch (error) {
    console.error("Error fetching system users:", error);
    return handleIndexError(error, "fetchSystemUsers");
  }
};

export const saveMasterDataItem = async (item: MasterDataItem): Promise<void> => {
  const itemRef = doc(db, "masterData", item.id);
  const docSnap = await getDoc(itemRef);
  const sanitizedItem = sanitizeData(item);
  
  if (docSnap.exists()) {
    await updateDoc(itemRef, sanitizedItem);
  } else {
    await setDoc(itemRef, sanitizedItem);
  }
};

export const deleteMasterDataItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, "masterData", id));
};

// --- LOGS ---
export const logActivity = async (action: string, target: string, details: string, module: string = 'GENERAL') => {
  const user = localStorage.getItem('currentUser') || localStorage.getItem('currentUserName') || 'Unknown';
  const timestamp = new Date().toLocaleString('vi-VN');
  await addDoc(collection(db, "systemLogs"), {
    timestamp,
    user,
    action,
    target,
    details,
    module,
    createdAt: Timestamp.now()
  });
};

export const fetchSystemLogs = async (): Promise<SystemLogEntry[]> => {
  const q = query(collection(db, "systemLogs"), orderBy("createdAt", "desc"), limit(100));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => fromFirestore(doc) as SystemLogEntry);
};

// --- CONFIG & UTILS ---
export const migrateOrderCodes = async (gid: string, prefix: string): Promise<void> => {
    const collectionName = getCollectionName(gid);
    const snapshot = await getDocs(collection(db, collectionName));
    
    const updatePromises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const oldCode = data.orderCode;
        if (oldCode && typeof oldCode === 'string' && oldCode.startsWith(prefix)) {
            const numPart = oldCode.replace(prefix, '');
            const newCode = `${prefix}${numPart.padStart(4, '0')}`;
            if (oldCode !== newCode) {
                await updateDoc(docSnap.ref, { orderCode: newCode });
            }
        }
    });
    
    await Promise.all(updatePromises);
};

export const syncSystemConfig = async () => {
    // In Firebase, we might not need this as much, but we can keep it for compatibility
    return false;
};

export const getProductionGid = () => localStorage.getItem('PRODUCTION_GID') || '0';
export const getDesignGid = () => localStorage.getItem('DESIGN_GID') || '644651369';

export const fetchNextOrderCode = async (prefix: string, gid: string): Promise<string> => {
    const collectionName = getCollectionName(gid);
    const counterDocRef = doc(db, 'counters', collectionName);
    
    try {
        const newCode = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterDocRef);
            
            let currentCount = 0;
            if (counterDoc.exists()) {
                currentCount = counterDoc.data().count || 0;
            }
            
            const nextCount = currentCount + 1;
            transaction.set(counterDocRef, { count: nextCount }, { merge: true });
            
            return `${prefix}${String(nextCount).padStart(4, '0')}`;
        });
        
        return newCode;
    } catch (error) {
        console.error("Transaction failed: ", error);
        throw error;
    }
};

export const reserveNextOrderCode = async (prefix: string, gid: string, initialData: Partial<WorkOrder>): Promise<WorkOrder> => {
    const collectionName = getCollectionName(gid);
    const counterDocRef = doc(db, 'counters', collectionName);
    const orderRef = doc(collection(db, collectionName));

    try {
        // 1. Tìm mã cao nhất hiện có trong collection (Bên ngoài transaction)
        const ordersQuery = query(collection(db, collectionName), orderBy("orderCode", "desc"), limit(1));
        const ordersSnapshot = await getDocs(ordersQuery);
        let maxNum = 0;
        if (!ordersSnapshot.empty) {
            const maxOrderCode = ordersSnapshot.docs[0].data().orderCode;
            // Giả sử mã có dạng prefix + số (ví dụ: pro123)
            const numPart = maxOrderCode.replace(prefix, '');
            maxNum = parseInt(numPart, 10) || 0;
        }

        const newOrder = await runTransaction(db, async (transaction) => {
            // 2. Lấy counter từ Firestore
            const counterDoc = await transaction.get(counterDocRef);
            let counterNum = 0;
            if (counterDoc.exists()) {
                counterNum = counterDoc.data().lastNum || 0;
            }

            // 3. Lấy số lớn nhất giữa counter và mã thực tế
            const nextCount = Math.max(maxNum, counterNum) + 1;
            const code = `${prefix}${String(nextCount).padStart(4, '0')}`;
            
            transaction.set(counterDocRef, { lastNum: nextCount }, { merge: true });
            
            const newOrderData: WorkOrder = {
                ...initialData as WorkOrder,
                id: orderRef.id,
                orderCode: code,
                isDraft: true,
                createdAt: new Date().toISOString()
            } as any;
            
            transaction.set(orderRef, sanitizeData(newOrderData));
            
            return newOrderData;
        });
        
        return newOrder;
    } catch (error) {
        console.error("Transaction failed: ", error);
        throw error;
    }
};

