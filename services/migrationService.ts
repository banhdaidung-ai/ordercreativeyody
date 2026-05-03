import * as sheetService from './sheetService';
import * as firebaseService from './firebaseService';
import { WorkOrder, BudgetItem, PlanItem, MasterDataItem } from '../types';

export interface MigrationProgress {
  step: string;
  current: number;
  total: number;
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
}

export const migrateSheetsToFirebase = async (onProgress: (p: MigrationProgress) => void) => {
  try {
    // 1. Migrate Master Data
    onProgress({ step: 'Master Data', current: 0, total: 1, status: 'running', message: 'Đang tải Master Data từ Sheets...' });
    const masterData = await sheetService.fetchMasterData();
    onProgress({ step: 'Master Data', current: 0, total: masterData.length, status: 'running', message: `Đang lưu ${masterData.length} mục Master Data vào Firebase...` });
    
    for (let i = 0; i < masterData.length; i++) {
      await firebaseService.saveMasterDataItem(masterData[i]);
      onProgress({ step: 'Master Data', current: i + 1, total: masterData.length, status: 'running' });
    }

    // 2. Migrate Production Work Orders
    const prodGid = sheetService.getProductionGid();
    onProgress({ step: 'Production Orders', current: 0, total: 1, status: 'running', message: 'Đang tải Production Orders từ Sheets...' });
    const prodResult = await sheetService.fetchSheetData(prodGid, null, 5000); // Load more for migration
    const prodOrders = prodResult.data;
    onProgress({ step: 'Production Orders', current: 0, total: prodOrders.length, status: 'running', message: `Đang lưu ${prodOrders.length} Production Orders vào Firebase...` });
    
    for (let i = 0; i < prodOrders.length; i++) {
      await firebaseService.saveWorkOrder(prodOrders[i], prodGid);
      onProgress({ step: 'Production Orders', current: i + 1, total: prodOrders.length, status: 'running' });
    }

    // 3. Migrate Design Work Orders
    const designGid = sheetService.getDesignGid();
    onProgress({ step: 'Design Orders', current: 0, total: 1, status: 'running', message: 'Đang tải Design Orders từ Sheets...' });
    const designResult = await sheetService.fetchSheetData(designGid, null, 5000);
    const designOrders = designResult.data;
    onProgress({ step: 'Design Orders', current: 0, total: designOrders.length, status: 'running', message: `Đang lưu ${designOrders.length} Design Orders vào Firebase...` });
    
    for (let i = 0; i < designOrders.length; i++) {
      await firebaseService.saveWorkOrder(designOrders[i], designGid);
      onProgress({ step: 'Design Orders', current: i + 1, total: designOrders.length, status: 'running' });
    }

    // 4. Migrate Budget Items
    onProgress({ step: 'Budget', current: 0, total: 1, status: 'running', message: 'Đang tải Budget từ Sheets...' });
    const budgetItems = await sheetService.fetchBudgetData();
    onProgress({ step: 'Budget', current: 0, total: budgetItems.length, status: 'running', message: `Đang lưu ${budgetItems.length} mục Budget vào Firebase...` });
    
    // We need columns for budget save, but firebaseService.saveBudgetItem doesn't strictly use them for the payload structure we defined
    for (let i = 0; i < budgetItems.length; i++) {
      await firebaseService.saveBudgetItem(budgetItems[i], []);
      onProgress({ step: 'Budget', current: i + 1, total: budgetItems.length, status: 'running' });
    }

    // 5. Migrate Plan Items
    onProgress({ step: 'Planning', current: 0, total: 1, status: 'running', message: 'Đang tải Planning từ Sheets...' });
    const planItems = await sheetService.fetchPlanData();
    onProgress({ step: 'Planning', current: 0, total: planItems.length, status: 'running', message: `Đang lưu ${planItems.length} mục Planning vào Firebase...` });
    
    for (let i = 0; i < planItems.length; i++) {
      await firebaseService.savePlanItem(planItems[i]);
      onProgress({ step: 'Planning', current: i + 1, total: planItems.length, status: 'running' });
    }

    onProgress({ step: 'Hoàn tất', current: 1, total: 1, status: 'success', message: 'Đã chuyển toàn bộ dữ liệu sang Firebase thành công!' });
  } catch (error: any) {
    console.error("Migration failed:", error);
    onProgress({ step: 'Lỗi', current: 0, total: 0, status: 'error', message: `Lỗi: ${error.message}` });
  }
};
