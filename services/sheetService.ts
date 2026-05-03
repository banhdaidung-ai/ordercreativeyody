
import { WorkOrder, MasterDataItem, DEFAULT_MASTER_DATA, UserAccount, BudgetItem, BudgetColumnConfig, SystemLogEntry, PlanItem } from '../types';

// --- CONFIGURATION ---
const RAW_API_URL = 'https://script.google.com/macros/s/AKfycbz_psTzcJeYYGmxRa6nasF8gFTFFq32lgkDG8mFG8V9_6pPA5iJkcG_c1xyn4IbIFO6/exec';

export const getApiUrl = () => {
  const custom = localStorage.getItem('CUSTOM_API_URL');
  if (custom) {
      let url = custom.trim();
      // Đảm bảo URL có protocol và không kết thúc bằng / nếu script service yêu cầu
      if (!url.startsWith('http')) url = 'https://' + url;
      return url;
  }
  return RAW_API_URL;
};

export const getMasterDataGid = () => localStorage.getItem('MASTER_DATA_GID') || '306588521';

export const getProductionGid = () => {
  const gid = localStorage.getItem('PRODUCTION_GID');
  if (gid === '1521307773') return '0';
  return gid || '0';
};

export const getDesignGid = () => localStorage.getItem('DESIGN_GID') || '644651369';
export const getBudgetGid = () => localStorage.getItem('BUDGET_GID') || '922180851'; 
export const getSystemLogsGid = () => localStorage.getItem('SYSTEM_LOGS_GID') || '119551332'; 
export const getPlanGid = () => '1863509454'; 

export const getSheetTabs = () => [
  { id: getProductionGid(), name: 'Production' },
  { id: getDesignGid(), name: 'Design' },
];

const formatDateForInput = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) { return ''; }
};

const callScript = async (params: any, bodyData: any = null, retries = 2) => {
    const apiUrl = getApiUrl();
    let url: URL;
    try {
        url = new URL(apiUrl);
    } catch (e) {
        throw new Error("URL API không hợp lệ. Vui lòng kiểm tra Cài đặt.");
    }
    
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    url.searchParams.append('t', Date.now().toString());

    const options: RequestInit = {
        method: bodyData ? 'POST' : 'GET',
        redirect: 'follow',
        credentials: 'omit'
    };

    if (bodyData) {
        options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        options.body = JSON.stringify(bodyData);
    }

    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url.toString(), options);
            if (response.status === 404) {
                throw new Error("Không tìm thấy dịch vụ (404). Hãy kiểm tra lại URL App Script.");
            }
            if (!response.ok) throw new Error(`Lỗi kết nối: ${response.status}`);
            
            const json = await response.json();
            if (json && json.status === 'error') throw new Error(json.message);
            return json;
        } catch (err: any) {
            if (i === retries) {
                console.error("API Call failed after retries:", err);
                throw err;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
};

export const syncSystemConfig = async () => {
    try {
        const masterData = await fetchMasterData();
        const configs = masterData.filter(item => item.listKey === 'SYSTEM_CONFIG');
        let hasUpdates = false;
        configs.forEach(cfg => {
            const keyName = cfg.value;
            const gidValue = cfg.color;
            if (keyName && gidValue) {
                const currentVal = localStorage.getItem(keyName);
                if (currentVal !== gidValue) {
                    localStorage.setItem(keyName, gidValue);
                    hasUpdates = true;
                }
            }
        });
        return hasUpdates;
    } catch (e) { return false; }
};

export const logActivity = async (action: string, target: string, details: string) => {
    const gid = getSystemLogsGid();
    const user = localStorage.getItem('work_manager_user') || 'Unknown';
    const timestamp = new Date().toLocaleString('vi-VN');
    const payload = {
        action: "save", gid, id: `log-${Date.now()}`,
        "TimeStamp": timestamp, "User": user, "Action": action, "Target": target, "Details": details
    };
    callScript({ action: 'save', gid }, payload).catch(err => console.warn("Log failed silently (likely background sync)"));
};

export const fetchSystemLogs = async (): Promise<SystemLogEntry[]> => {
    const gid = getSystemLogsGid();
    try {
        const data = await callScript({ action: 'read', gid });
        if (!Array.isArray(data)) return [];
        return data.map((item: any) => ({
            id: item['ID'] || `log-${Math.random()}`,
            timestamp: item['TimeStamp'] || '',
            user: item['User'] || '',
            action: item['Action'] || '',
            target: item['Target'] || '',
            details: item['Details'] || ''
        })).reverse();
    } catch (e) { return []; }
};

export const fetchSheetData = async (
  gid: string, 
  lastDoc: any = null, 
  pageSize: number = 100,
  filters: any = {}
): Promise<{ data: WorkOrder[], lastDoc: any, hasMore: boolean }> => {
  try {
    const data = await callScript({ action: 'read', gid });
    if (!Array.isArray(data)) return { data: [], lastDoc: null, hasMore: false };
    
    // Use map index to ensure uniqueness if ID and OrderCode fail
    const orders = data.map((item: any, index: number) => {
      let historyLogs = [];
      try { if (item['Lịch sử']) historyLogs = JSON.parse(item['Lịch sử']); } catch (e) {}
      let costDetails = undefined;
      const costJson = item['Chi tiết chi phí'] || item['Chi tiết'];
      if (costJson && typeof costJson === 'string' && costJson.trim().startsWith('{')) {
          try { costDetails = JSON.parse(costJson); } catch (e) {}
      }
      
      // CRITICAL FIX: Fallback ID logic improved to prevent React key collisions.
      // If ID is missing, combine OrderCode + Index to guarantee uniqueness in the list.
      let id = item['ID'];
      const orderCode = String(item['Mã Order'] || '');
      
      if (!id || String(id).trim() === '') {
          if (orderCode.trim() !== '') {
              // Append index to handle duplicate OrderCodes in legacy data
              id = `fallback-${orderCode}-${index}`;
          } else {
              // Last resort: Random ID + index
              id = `gen-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`;
          }
      }

      return {
        id: String(id),
        department: String(item['Phòng ban'] || ''),
        orderCode: orderCode,
        orderer: String(item['Người order'] || ''),
        category: String(item['Loại hình'] || item['Thể loại'] || ''),
        content: String(item['Nội dung'] || item['Brief'] || ''),
        status: String(item['Trạng thái'] || 'Chờ duyệt'),
        isConfirmed: String(item['Check xác nhận']).toUpperCase() === 'TRUE',
        productLink: String(item['Link sản phẩm'] || ''),
        startDate: formatDateForInput(item['Ngày Order'] || item['Ngày bắt đầu']), 
        implementationDate: formatDateForInput(item['Ngày triển khai'] || ''), 
        dueDate: formatDateForInput(item['Ngày đến hạn'] || item['Deadline']),
        stylist: String(item['Stylist'] || ''),
        videoPerson: String(item['Video'] || ''),
        photoPerson: String(item['Photo'] || ''),
        ctvStylist: String(item['CTV Stylist'] || ''),
        ctvVideo: String(item['CTV Video'] || ''),
        ctvPhoto: String(item['CTV Photo'] || ''),
        designer: String(item['Người phụ trách'] || ''),
        platform: String(item['Nền tảng'] || ''),
        estimatedCost: String(item['Chi phí dự kiến'] || ''),
        costDetails: costDetails,
        classType: String(item['Phân loại'] || ''),
        productType: String(item['Cate hàng'] || ''),
        title: String(item['Tiêu đề nội dung'] || item['Tiêu đề'] || ''), 
        trackingNote: String(item['Ghi chú'] || ''),
        historyLogs: historyLogs
      };
    });
    return { data: orders, lastDoc: null, hasMore: false };
  } catch (error: any) {
    if (error.message.includes('404')) throw new Error("Không thể truy cập dữ liệu (404). GID có thể bị sai.");
    throw error;
  }
};

export const saveWorkOrder = async (order: WorkOrder, targetGid: string): Promise<void> => {
  const fmtDate = (d: string) => d ? `'${d}` : "";
  const payload = {
    action: "save", gid: targetGid, id: order.id,
    // Ensure 'ID' is sent in body to update the Sheet column
    "ID": order.id,
    "Phòng ban": order.department, "Mã Order": order.orderCode, "Người order": order.orderer,
    "Thể loại": order.category, "Nền tảng": order.platform, "Nội dung": order.content,
    "Tiêu đề nội dung": order.title, "Trạng thái": order.status, "Check xác nhận": order.isConfirmed ? "TRUE" : "FALSE",
    "Link sản phẩm": order.productLink, "Ngày Order": fmtDate(order.startDate), "Ngày đến hạn": fmtDate(order.dueDate),
    "Ngày triển khai": fmtDate(order.implementationDate), "Ghi chú": order.trackingNote, "Stylist": order.stylist,
    "Video": order.videoPerson, "Photo": order.photoPerson, "Người phụ trách": order.designer,
    "CTV Stylist": order.ctvStylist || "", "CTV Video": order.ctvVideo || "", "CTV Photo": order.ctvPhoto || "",
    "Chi phí dự kiến": order.estimatedCost, "Chi tiết chi phí": order.costDetails ? JSON.stringify(order.costDetails) : "", 
    "Phân loại": order.classType, "Cate hàng": order.productType, "Lịch sử": JSON.stringify(order.historyLogs || [])
  };
  await callScript({ action: 'save', gid: targetGid }, payload);
};

export const deleteWorkOrder = async (id: string, gid: string): Promise<void> => {
  await callScript({ action: 'delete', gid }, { id });
};

export const reserveNextOrderCode = async (prefix: string, gid: string, initialData: Partial<WorkOrder>): Promise<WorkOrder> => {
    const nextCode = await fetchNextOrderCode(prefix, gid);
    const newOrder: WorkOrder = {
        ...initialData as WorkOrder,
        id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        orderCode: nextCode,
        isDraft: true
    };
    await saveWorkOrder(newOrder, gid);
    return newOrder;
};


export const fetchNextOrderCode = async (prefix: string, gid: string): Promise<string> => {
    try {
        const response = await callScript({ action: 'getNextCode', prefix, gid });
        return response.nextCode;
    } catch (e) {
        console.error("Failed to fetch next code from server, falling back to local generation");
        throw e;
    }
};

export const fetchBudgetData = async (): Promise<BudgetItem[]> => {
    const gid = getBudgetGid();
    try {
        const data = await callScript({ action: 'read', gid });
        if (!Array.isArray(data)) return [];
        return data.map((item: any) => {
            const budgetItem: BudgetItem = {
                id: item['ID'] || `budget-${Date.now()}`,
                date: formatDateForInput(item['Ngày'] || ''),
                content: String(item['Nội dung chi'] || ''),
                tag: String(item['Mã dòng tiền'] || item['Loại chi'] || ''),
                pic: String(item['Người chi'] || ''),
            };
            Object.keys(item).forEach(key => {
                if (!['ID', 'Ngày', 'Nội dung chi', 'Mã dòng tiền', 'Loại chi', 'Người chi'].includes(key)) {
                    const valStr = String(item[key]);
                    const cleanVal = valStr.replace(/[^0-9.-]+/g,"");
                    if (cleanVal && !isNaN(parseFloat(cleanVal))) budgetItem[key] = parseFloat(cleanVal);
                }
            });
            return budgetItem;
        });
    } catch (e) { return []; }
};

export const saveBudgetItem = async (item: BudgetItem, columns: BudgetColumnConfig[]): Promise<void> => {
    const gid = getBudgetGid();
    const fmtDate = (d: string) => d ? `'${d}` : "";
    const payload: any = {
        action: "save", gid, id: item.id,
        "ID": item.id,
        "Ngày": fmtDate(item.date), "Nội dung chi": item.content, "Loại chi": item.tag, "Người chi": item.pic
    };
    columns.forEach(col => { payload[col.name] = item[col.name] || 0; });
    await callScript({ action: 'save', gid }, payload);
};

export const deleteBudgetItem = async (id: string): Promise<void> => {
    const gid = getBudgetGid();
    await callScript({ action: 'delete', gid }, { id });
};

export const fetchPlanData = async (): Promise<PlanItem[]> => {
    const gid = getPlanGid();
    try {
        const data = await callScript({ action: 'read', gid });
        if (!Array.isArray(data)) return [];
        return data.map((item: any) => {
            const planItem: PlanItem = {
                id: item['ID'] || `plan-${Date.now()}`,
                monthYear: String(item['Tháng/Năm'] || ''),
                department: String(item['Bộ phận'] || ''),
                campaign: String(item['Loại nguyên liệu/Chiến dịch'] || ''),
                format: String(item['Định dạng'] || ''),
                totalTarget: parseInt(item['Tổng Target'] || '0', 10),
                outcome: String(item['Outcome'] || ''),
                comment: String(item['Creative Comment'] || ''),
                estimatedCost: parseInt(String(item['Chi phí dự kiến'] || '0').replace(/[^0-9]/g, ''), 10) || 0
            };
            for (let i = 1; i <= 31; i++) { planItem[`d${i}`] = parseInt(item[`${i}`] || '0', 10); }
            return planItem;
        });
    } catch (e) { return []; }
};

export const savePlanItem = async (item: PlanItem): Promise<string> => {
    const gid = getPlanGid();
    const now = new Date().toISOString();
    const payload: any = {
        action: "save", gid, id: item.id,
        // FIX: Ensure ID is sent to Sheet column
        "ID": item.id,
        "Tháng/Năm": item.monthYear, "Bộ phận": item.department, "Loại nguyên liệu/Chiến dịch": item.campaign,
        "Định dạng": item.format, "Tổng Target": item.totalTarget, "Outcome": item.outcome,
        "Creative Comment": item.comment, "Chi phí dự kiến": item.estimatedCost
    };
    for (let i = 1; i <= 31; i++) { payload[`${i}`] = item[`d${i}`] || 0; }
    await callScript({ action: 'save', gid }, payload);
    return now;
};

export const deletePlanItem = async (id: string): Promise<void> => {
    const gid = getPlanGid();
    await callScript({ action: 'delete', gid }, { id });
};

export const fetchMasterData = async (): Promise<MasterDataItem[]> => {
    const gid = getMasterDataGid();
    try {
        const data = await callScript({ action: 'read', gid });
        if (!Array.isArray(data)) return DEFAULT_MASTER_DATA;
        const sheetMasterData = data.map((item: any, idx: number) => ({
            id: item['ID'] || `master-stable-${idx}`,
            listKey: item['ListKey'],
            value: item['Value'],
            color: item['Color'],
            textColor: item['TextColor'],
            order: parseInt(item['Order'], 10) || 0,
            description: item['Description']
        }));
        return [...DEFAULT_MASTER_DATA, ...sheetMasterData];
    } catch (e) { return DEFAULT_MASTER_DATA; }
};

export const fetchSystemUsers = async (): Promise<UserAccount[]> => {
    const gid = getMasterDataGid();
    try {
        const data = await callScript({ action: 'read', gid });
        if (!Array.isArray(data)) return [];
        const userRows = data.filter((item: any) => item['ListKey'] === 'SYSTEM_USERS');
        return userRows.map((item: any) => {
            const roleRaw = String(item['TextColor'] || 'member').toLowerCase();
            let role: 'admin' | 'member' | 'collaborator' = 'member';
            if (roleRaw === 'admin') role = 'admin';
            else if (roleRaw === 'collaborator' || roleRaw === 'ctv') role = 'collaborator';
            return {
                id: item['ID'], email: String(item['Value'] || '').toLowerCase().trim(),
                password: String(item['Color'] || ''), role, name: String(item['Description'] || '')
            };
        });
    } catch (e) { return []; }
};

export const saveMasterDataItem = async (item: MasterDataItem): Promise<void> => {
  const gid = getMasterDataGid();
  const payload = {
    action: "save", gid, id: item.id,
    "ID": item.id,
    "ListKey": item.listKey, "Value": item.value, "Color": item.color,
    "TextColor": item.textColor, "Order": item.order, "Description": item.description || ""
  };
  await callScript({ action: 'save', gid }, payload);
};

export const deleteMasterDataItem = async (id: string): Promise<void> => {
  const gid = getMasterDataGid();
  await callScript({ action: 'delete', gid }, { id });
};
