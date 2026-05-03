import * as sheetService from './sheetService';
import * as firebaseService from './firebaseService';

// Determine which service to use
// You can change this to 'firebase' when you are ready to switch
const SERVICE_TYPE: 'sheets' | 'firebase' = (localStorage.getItem('DATA_SERVICE_TYPE') as 'sheets' | 'firebase') || 'firebase';

export const isFirebase = SERVICE_TYPE === 'firebase';

export const {
  fetchSheetData,
  saveWorkOrder,
  deleteWorkOrder,
  fetchBudgetData,
  saveBudgetItem,
  deleteBudgetItem,
  fetchPlanData,
  savePlanItem,
  deletePlanItem,
  fetchMasterData,
  fetchSystemUsers,
  saveMasterDataItem,
  deleteMasterDataItem,
  logActivity,
  fetchSystemLogs,
  syncSystemConfig,
  getProductionGid,
  getDesignGid,
  fetchNextOrderCode,
  reserveNextOrderCode
} = isFirebase ? firebaseService : sheetService;

// Sheets-specific getters that might be needed for UI or legacy
export const getApiUrl = sheetService.getApiUrl;
export const getMasterDataGid = sheetService.getMasterDataGid;
export const getBudgetGid = sheetService.getBudgetGid;
export const getSystemLogsGid = sheetService.getSystemLogsGid;
export const getSheetTabs = sheetService.getSheetTabs;

export const setServiceType = (type: 'sheets' | 'firebase') => {
  localStorage.setItem('DATA_SERVICE_TYPE', type);
  window.location.reload();
};
