
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PlanItem, Department, MasterDataItem, WorkOrder } from '../types';
import { fetchPlanData, savePlanItem, deletePlanItem, fetchSheetData, getProductionGid, getDesignGid, fetchMasterData, logActivity, fetchSystemLogs } from '../services/dataService';
import { ArrowLeft, Plus, RefreshCw, Loader2, Save, Trash2, CalendarRange, CheckCircle2, AlertCircle, X, DollarSign, Target, Sigma, BarChart3, Edit3, PieChart, ChevronRight, Lock, Unlock, Clock, Layers, Filter, Trophy, AlertTriangle, Briefcase, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Toast, AutoHeightTextarea, AutoNumberInput, MetricCell } from './planning/PlanningUI';
import { PlanningRow } from './planning/PlanningRow';
import { PlanningHeader } from './planning/PlanningHeader';
import { COL_INDEX_WIDTH, COL_CAMPAIGN_WIDTH, STICKY_POS, FORMATS } from './planning/constants';

const DEPARTMENTS = Object.values(Department); 
const OMNI_MEMBERS = [Department.OMNI_SHOPEE, Department.OMNI_TIKTOK, Department.OMNI_SALE, Department.MKT_ONLINE_YODY, Department.MKT_ONLINE_NEVO];
const MKT_MEMBERS = [Department.MKT_VUNG, Department.BRAND, Department.TRADE, Department.MKT_CRM];

export const PlanningTable: React.FC<{ onBack: () => void; userRole: string; isOwner: boolean; isAdmin: boolean; userEmail: string }> = ({ onBack, userRole, isOwner, isAdmin, userEmail }) => {
    const [data, setData] = useState<PlanItem[]>([]);
    const [masterData, setMasterData] = useState<MasterDataItem[]>([]);
    const [actualOrders, setActualOrders] = useState<WorkOrder[]>([]);
    const [actualData, setActualData] = useState<Record<string, Record<number, number>>>({}); 
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<'edit' | 'report'>('edit'); 
    const [reportTab, setReportTab] = useState<'format' | 'campaign'>('format'); // NEW: Report Tab State
    const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());

    const [tick, setTick] = useState(0);
    
    // State cho cửa sổ xác nhận xóa
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [systemLogs, setSystemLogs] = useState<any[]>([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);
    
    // NEW: State for expanded groups
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'MKT': true,
        'OMNI': true,
        'BVH': true,
        'NSHP': true,
        'Other': true
    });

    const toggleGroup = (dept: string) => {
        setExpandedGroups(prev => ({ ...prev, [dept]: !prev[dept] }));
    };

    // --- LOCK LOGIC ---
    const getVNTimeInfo = useCallback(() => {
        const now = new Date();
        const vnMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (7 * 3600000);
        const vnDate = new Date(vnMs);
        const vnYear = vnDate.getUTCFullYear();
        const vnMonth = vnDate.getUTCMonth();
        const vnDayOfMonth = vnDate.getUTCDate();
        const vnEndOfDayMs = Date.UTC(vnYear, vnMonth, vnDayOfMonth, 16, 59, 59, 999); 
        return { vnNowMs: vnMs, vnDay: vnDate.getUTCDay(), vnEndOfDayMs };
    }, []);

    const formatCountdown = (ms: number) => {
        if (ms <= 0) return "00:00:00";
        const totalSecs = Math.floor(ms / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}p`;
        return `${String(mins).padStart(2, '0')}p`;
    };

    const systemLocked = useMemo(() => {
        if (userRole === 'collaborator') return true;
        const { vnNowMs, vnDay } = getVNTimeInfo();
        const isThursdayVN = vnDay === 4;
        const statusItem = masterData.find(i => i.listKey === 'SYSTEM_CONFIG' && i.value === 'PLANNING_STATUS');
        const rawValue = String(statusItem?.color || 'AUTO').trim().toUpperCase();
        const [statusType, val1, val2] = rawValue.split('|');
        if (statusType === 'OPEN') {
            if (!val1) return false; 
            const expiry = parseInt(val1, 10);
            return isNaN(expiry) ? false : vnNowMs >= expiry; 
        }
        if (statusType === 'SCHEDULED') {
            if (!val1 || !val2) return true;
            const start = parseInt(val1, 10);
            const end = parseInt(val2, 10);
            if (isNaN(start) || isNaN(end)) return true;
            return !(vnNowMs >= start && vnNowMs <= end);
        }
        if (statusType === 'LOCKED') return true;
        return !isThursdayVN;
    }, [masterData, getVNTimeInfo, userRole, tick]);

    const isLocked = isAdmin ? false : systemLocked;

    const lockStatusMessage = useMemo(() => {
        if (userRole === 'collaborator') return "Bạn đang ở chế độ xem cá nhân";
        const { vnNowMs, vnDay, vnEndOfDayMs } = getVNTimeInfo();
        const isThursdayVN = vnDay === 4;
        const statusItem = masterData.find(i => i.listKey === 'SYSTEM_CONFIG' && i.value === 'PLANNING_STATUS');
        const rawValue = String(statusItem?.color || 'AUTO').trim().toUpperCase();
        const [statusType, val1, val2] = rawValue.split('|');

        if (statusType === 'SCHEDULED' && val1 && val2) {
            const start = parseInt(val1, 10);
            const end = parseInt(val2, 10);
            if (!isNaN(start) && !isNaN(end)) {
                if (vnNowMs < start) return `Sẽ mở vào: ${new Date(start).toLocaleString('vi-VN')}`;
                if (vnNowMs <= end) return `Đang mở (Đến: ${new Date(end).toLocaleString('vi-VN')})`;
                return "Đã hết hạn mở theo lịch";
            }
        }

        if (statusType === 'LOCKED') return "Bảng đang bị KHÓA bởi Admin.";
        if (statusType === 'OPEN') {
            if (!val1) return "Bảng đang MỞ (Vô thời hạn).";
            const expiry = parseInt(val1, 10);
            const diffMs = expiry - vnNowMs;
            return diffMs <= 0 ? "Bảng đã HẾT HẠN mở." : `Bảng đang MỞ (Còn ${formatCountdown(diffMs)}).`;
        }
        if (statusType === 'AUTO') {
            if (isThursdayVN) return `Bảng đang MỞ (Thứ 5 AUTO - Còn ${formatCountdown(vnEndOfDayMs - vnNowMs)}).`;
            return "Bảng đang KHÓA (Tự động mở vào Thứ 5).";
        }
        return "Đang kiểm tra trạng thái...";
    }, [masterData, getVNTimeInfo, userRole, tick]);

    // --- DATA FETCHING FUNCTIONS ---
    
    const loadData = async (m?: number, y?: number) => {
        setIsLoading(true);
        const targetMonth = m !== undefined ? m : month;
        const targetYear = y !== undefined ? y : year;
        const monthYearKey = `${String(targetMonth + 1).padStart(2, '0')}/${targetYear}`;
        
        try {
            const [res, master] = await Promise.all([fetchPlanData(monthYearKey), fetchMasterData()]);
            setData(res);
            setMasterData(master);
        } catch (e: any) {
            setToast({ type: 'error', message: e.message || 'Lỗi tải dữ liệu kế hoạch' });
        } finally { setIsLoading(false); }
    };

    const loadActualData = async () => {
        setIsLoading(true);
        try {
            const filters = { reportMonth: month, reportYear: year };
            const [prodResult, designResult] = await Promise.all([
                fetchSheetData(getProductionGid(), null, 1000, filters), 
                fetchSheetData(getDesignGid(), null, 1000, filters)
            ]);
            
            const prodData = Array.isArray(prodResult) ? prodResult : prodResult.data;
            const designData = Array.isArray(designResult) ? designResult : designResult.data;
            
            const allOrders = [...prodData, ...designData];
            const result: Record<string, Record<number, number>> = {};
            const filteredOrders: WorkOrder[] = [];

            allOrders.forEach(order => {
                if (!order.dueDate) return; // SỬ DỤNG DEADLINE
                const d = new Date(order.dueDate);
                // The server-side filter should already limit this, but double check
                if (d.getUTCMonth() === month && d.getUTCFullYear() === year) {
                    filteredOrders.push(order);
                    let deptRaw = (order.department || '').trim();
                    if (deptRaw.toLowerCase() === 'mkt online') deptRaw = Department.MKT_ONLINE_YODY;
                    let deptKey = DEPARTMENTS.find(d => d.toLowerCase() === deptRaw.toLowerCase()) || 'Other';
                    if (!result[deptKey]) result[deptKey] = {};
                    const day = d.getUTCDate();
                    result[deptKey][day] = (result[deptKey][day] || 0) + 1;
                }
            });
            setActualOrders(filteredOrders);
            setActualData(result);
        } catch (e: any) {
            if (e.indexUrl) {
                setToast({ type: 'error', message: `Thiếu index Firestore. Vui lòng click vào đây để tạo: ${e.indexUrl}` });
            } else {
                setToast({ type: 'error', message: e.message || 'Lỗi tải dữ liệu thực tế' });
            }
        } finally { setIsLoading(false); }
    };

    // --- MEMOS ---

    const filteredData = useMemo(() => {
        const key = `${String(month + 1).padStart(2, '0')}/${year}`;
        return data.filter(i => i.monthYear === key);
    }, [data, month, year]);

    // Phân tích đa chiều: Tỷ lệ định dạng theo phòng ban
    // UPDATE: Now includes Plan vs Actual data
    const multidimensionalAnalysis = useMemo(() => {
        const stats: Record<string, Record<string, { plan: number, actual: number }>> = {};

        const initRow = (key: string) => {
            if (!stats[key]) {
                stats[key] = {
                    'Video': { plan: 0, actual: 0 },
                    'Hình ảnh': { plan: 0, actual: 0 },
                    'Design': { plan: 0, actual: 0 },
                    'Khác': { plan: 0, actual: 0 },
                    'Total': { plan: 0, actual: 0 }
                };
            }
        };

        // 1. Process Actuals
        actualOrders.forEach(order => {
            let deptRaw = (order.department || '').trim();
            if (deptRaw.toLowerCase() === 'mkt online') deptRaw = Department.MKT_ONLINE_YODY;
            const deptKey = DEPARTMENTS.find(d => d.toLowerCase() === deptRaw.toLowerCase()) || 'Other';
            const cat = (order.category || 'Khác').trim();
            
            // Map category to Planning formats
            let formatKey = 'Khác';
            const catLower = cat.toLowerCase();
            if (catLower.includes('video')) formatKey = 'Video';
            else if (catLower.includes('hình ảnh') || catLower.includes('photo')) formatKey = 'Hình ảnh';
            else if (catLower.includes('design') || catLower.includes('thiết kế')) formatKey = 'Design';
            
            initRow(deptKey);
            stats[deptKey][formatKey].actual += 1;
            stats[deptKey]['Total'].actual += 1;
        });

        // 2. Process Plans
        filteredData.forEach(item => {
            let deptRaw = (item.department || '').trim();
            if (deptRaw.toLowerCase() === 'mkt online') deptRaw = Department.MKT_ONLINE_YODY;
            const deptKey = DEPARTMENTS.find(d => d.toLowerCase() === deptRaw.toLowerCase()) || 'Other';
            const fmt = (item.format || 'Khác').trim();

            let formatKey = 'Khác';
            const fmtLower = fmt.toLowerCase();
            if (fmtLower.includes('video')) formatKey = 'Video';
            else if (fmtLower.includes('hình ảnh') || fmtLower.includes('photo')) formatKey = 'Hình ảnh';
            else if (fmtLower.includes('design') || fmtLower.includes('thiết kế')) formatKey = 'Design';

            initRow(deptKey);
            const target = item.totalTarget || 0;
            stats[deptKey][formatKey].plan += target;
            stats[deptKey]['Total'].plan += target;
        });

        return stats;
    }, [actualOrders, filteredData]);

    // --- NEW: CAMPAIGN ANALYSIS LOGIC (UPDATED) ---
    const campaignAnalysis = useMemo(() => {
        const stats: Record<string, {
            totalTarget: number;
            totalActual: number;
            totalCost: number;
            campaigns: Record<string, {
                target: number;
                actual: number;
                cost: number;
                formats: Record<string, { plan: number, actual: number }>;
            }>
        }> = {};

        // 1. Process Plans (Targets)
        filteredData.forEach(item => {
            let deptRaw = (item.department || '').trim();
            if (deptRaw.toLowerCase() === 'mkt online') deptRaw = Department.MKT_ONLINE_YODY;
            const deptKey = DEPARTMENTS.find(d => d.toLowerCase() === deptRaw.toLowerCase()) || 'Other';
            const camp = (item.campaign || 'Không tên').trim() || 'Không tên';
            const fmt = (item.format || 'Khác').trim();
            const target = item.totalTarget || 0;
            const cost = item.estimatedCost || 0;

            if (!stats[deptKey]) stats[deptKey] = { totalTarget: 0, totalActual: 0, totalCost: 0, campaigns: {} };
            
            stats[deptKey].totalTarget += target;
            stats[deptKey].totalCost += cost;

            if (!stats[deptKey].campaigns[camp]) {
                stats[deptKey].campaigns[camp] = { target: 0, actual: 0, cost: 0, formats: {} };
            }
            
            const cStats = stats[deptKey].campaigns[camp];
            cStats.target += target;
            cStats.cost += cost;
            
            let formatKey = 'Khác';
            if (fmt.toLowerCase().includes('video')) formatKey = 'Video';
            else if (fmt.toLowerCase().includes('hình ảnh')) formatKey = 'Hình ảnh';
            else if (fmt.toLowerCase().includes('design')) formatKey = 'Design';
            
            if (!cStats.formats[formatKey]) cStats.formats[formatKey] = { plan: 0, actual: 0 };
            cStats.formats[formatKey].plan += target;
        });

        // 2. Process Actuals (Orders)
        actualOrders.forEach(order => {
            let deptRaw = (order.department || '').trim();
            if (deptRaw.toLowerCase() === 'mkt online') deptRaw = Department.MKT_ONLINE_YODY;
            const deptKey = DEPARTMENTS.find(d => d.toLowerCase() === deptRaw.toLowerCase()) || 'Other';
            
            // Ensure Department exists in stats even if no Plan
            if (!stats[deptKey]) {
                stats[deptKey] = { totalTarget: 0, totalActual: 0, totalCost: 0, campaigns: {} };
            }

            // Map Actual to Campaign
            // Use classType as the link to Campaign Name, fallback to "Chưa phân loại"
            const rawClass = (order.classType || '').trim();
            const campKeyDisplay = rawClass || 'Chưa phân loại';
            
            let targetCampKey = campKeyDisplay;
            
            // Fuzzy match: If Plan has "New Arrival" and Actual is "New Arrival", match them.
            // If Plan has "Campaign X", and Actual classType is "Campaign X", match them.
            const searchKey = campKeyDisplay.trim().toLowerCase();
            const existingKeys = Object.keys(stats[deptKey].campaigns);
            const foundKey = existingKeys.find(k => k.trim().toLowerCase() === searchKey);
            if (foundKey) targetCampKey = foundKey;

            // Ensure Campaign exists in stats (for Unplanned actuals)
            if (!stats[deptKey].campaigns[targetCampKey]) {
                stats[deptKey].campaigns[targetCampKey] = { target: 0, actual: 0, cost: 0, formats: {} };
            }

            const cStats = stats[deptKey].campaigns[targetCampKey];
            cStats.actual += 1;
            stats[deptKey].totalActual += 1;

            const cat = (order.category || 'Khác').trim();
            let formatKey = 'Khác';
            if (cat.toLowerCase().includes('video')) formatKey = 'Video';
            else if (cat.toLowerCase().includes('hình ảnh')) formatKey = 'Hình ảnh';
            else if (cat.toLowerCase().includes('design')) formatKey = 'Design';

            if (!cStats.formats[formatKey]) cStats.formats[formatKey] = { plan: 0, actual: 0 };
            cStats.formats[formatKey].actual += 1;
        });
        
        return stats;
    }, [filteredData, actualOrders]);

    const updateItem = useCallback((id: string, field: string, val: any) => {
        if (isLocked) return;
        setData(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: val };
            if (field.startsWith('d')) {
                let sum = 0;
                for (let i = 1; i <= 31; i++) { sum += Number(updated[`d${i}`] || 0); }
                updated.totalTarget = sum;
            }
            return updated;
        }));
        setPendingUpdates(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, [isLocked]);

    const handleAddItem = async (dept: string) => {
        if (isLocked) return;
        
        const newItem: PlanItem = {
            id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            monthYear: `${String(month + 1).padStart(2, '0')}/${year}`,
            department: dept === 'Other' ? '' : dept,
            campaign: '', format: 'Video', totalTarget: 0, outcome: '', comment: '', estimatedCost: 0
        };

        // Optimistic update
        setData(prev => [...prev, newItem]);
        setIsSaving(true);

        try {
            const newUpdatedAt = await savePlanItem(newItem);
            setData(prev => prev.map(item => item.id === newItem.id ? { ...item, updatedAt: newUpdatedAt } : item));
            await logActivity('ADD_PLAN_ITEM', `Dept: ${dept}`, `User ${userEmail} added new plan item for ${dept} in ${newItem.monthYear}`, 'PLANNING');
            setToast({ type: 'success', message: 'Đã thêm dòng mới' });
        } catch (e) {
            console.error("Error adding item:", e);
            setToast({ type: 'error', message: 'Lỗi khi lưu dòng mới. Sẽ tự động thử lại.' });
            // Add to pending updates so auto-save can retry
            setPendingUpdates(prev => {
                const next = new Set(prev);
                next.add(newItem.id);
                return next;
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteItem = useCallback((id: string) => {
        if (isLocked) return;
        setDeleteRowId(id);
    }, [isLocked]);

    const confirmDelete = async () => {
        if (!deleteRowId || isLocked) return;
        const id = deleteRowId;
        const itemToDelete = data.find(i => i.id === id);
        setDeleteRowId(null);
        setData(prev => prev.filter(i => i.id !== id));
        try { 
            await deletePlanItem(id); 
            if (itemToDelete) {
                await logActivity('DELETE_PLAN_ITEM', `Campaign: ${itemToDelete.campaign}`, `User ${userEmail} deleted plan item: ${itemToDelete.campaign} (${itemToDelete.department})`, 'PLANNING');
            }
            setToast({ type: 'success', message: 'Đã xóa dòng kế hoạch' });
        } catch (e) { 
            loadData(month, year); 
            setToast({ type: 'error', message: 'Lỗi khi xóa dữ liệu' });
        }
    };

    // --- MANUAL SAVE HANDLER ---
    const handleManualSave = async () => {
        if (pendingUpdates.size === 0) {
            setToast({ type: 'success', message: 'Dữ liệu đã được đồng bộ hoàn toàn.' });
            return;
        }

        setIsSaving(true);
        try {
            const updates = data.filter(item => pendingUpdates.has(item.id));
            const results = await Promise.all(updates.map(item => savePlanItem(item)));
            
            // Update local data with new updatedAt to prevent conflict on next save
            setData(prev => prev.map(item => {
                const idx = updates.findIndex(u => u.id === item.id);
                if (idx !== -1) {
                    return { ...item, updatedAt: results[idx] };
                }
                return item;
            }));

            const campaignNames = updates.map(u => u.campaign || 'Không tên').join(', ');
            
            await logActivity('MANUAL_SAVE', `Saved ${updates.length} items`, `User ${userEmail} manually saved ${updates.length} items: ${campaignNames}`, 'PLANNING');

            setPendingUpdates(new Set());
            setLastSavedAt(new Date());
            setToast({ type: 'success', message: `Đã lưu thành công ${updates.length} thay đổi.` });
        } catch (error) {
            console.error("Manual save error:", error);
            setToast({ type: 'error', message: 'Lỗi khi lưu dữ liệu thủ công.' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- EXCEL EXPORT HANDLER ---
    const exportToExcel = () => {
        try {
            const exportData = data.map((item, idx) => {
                const row: any = {
                    'STT': idx + 1,
                    'Phòng ban': item.department,
                    'Chiến dịch': item.campaign,
                    'Định dạng': item.format,
                    'Tổng Target': item.totalTarget,
                    'Outcome': item.outcome,
                    'Comment': item.comment,
                    'Ngân sách dự kiến': item.estimatedCost,
                };
                // Add daily columns
                for (let d = 1; d <= 31; d++) {
                    row[`Ngày ${d}`] = item[`d${d}`] || 0;
                }
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Planning");
            
            // Auto-size columns
            const colWidths = [
                { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 30 }, { wch: 15 }
            ];
            ws['!cols'] = colWidths;

            XLSX.writeFile(wb, `Planning_Yody_${month + 1}_${year}.xlsx`);
            
            logActivity('EXPORT_EXCEL', `Month: ${month + 1}/${year}`, `User ${userEmail} exported planning to Excel`, 'PLANNING');
        } catch (error) {
            console.error("Export error:", error);
            setToast({ type: 'error', message: 'Lỗi khi xuất file Excel.' });
        }
    };

    const loadLogs = async () => {
        setIsLogsLoading(true);
        try {
            const allLogs = await fetchSystemLogs();
            // Filter logs for PLANNING module
            const planningLogs = allLogs.filter(log => log.module === 'PLANNING');
            setSystemLogs(planningLogs);
        } catch (error) {
            console.error("Error loading logs:", error);
        } finally {
            setIsLogsLoading(false);
        }
    };

    useEffect(() => {
        if (showLogs) loadLogs();
    }, [showLogs]);

    // --- HOOKS ---

    useEffect(() => { 
        loadData(month, year); 
    }, [month, year]);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (viewMode === 'report') {
            loadActualData();
        }
    }, [viewMode, month, year]);

    useEffect(() => {
        if (pendingUpdates.size === 0) return;
        const timeout = setTimeout(async () => {
            setIsSaving(true);
            const ids = Array.from(pendingUpdates);
            setPendingUpdates(new Set());
            const itemsToSave = data.filter(i => ids.includes(i.id));
            if (itemsToSave.length === 0) {
                setIsSaving(false);
                return;
            }
            try { 
                const results = await Promise.all(itemsToSave.map(savePlanItem)); 
                
                // Update local data with new updatedAt to prevent conflict on next save
                setData(prev => prev.map(item => {
                    const idx = itemsToSave.findIndex(i => i.id === item.id);
                    if (idx !== -1) {
                        return { ...item, updatedAt: results[idx] };
                    }
                    return item;
                }));

                const campaignNames = itemsToSave.map(i => i.campaign || 'Unnamed').join(', ');
                await logActivity('AUTO_SAVE_PLAN', `Items: ${itemsToSave.length}`, `User ${userEmail} auto-saved plan items: ${campaignNames}`);
            } 
            catch (e: any) { 
                console.error("Auto-save error detailed:", e);
                setToast({ type: 'error', message: `Lỗi lưu tự động: ${e.message || 'Lỗi không xác định'}` }); 
            } 
            finally { setIsSaving(false); }
        }, 1500);
        return () => clearTimeout(timeout);
    }, [pendingUpdates, data]);

    const displayOrder = useMemo(() => {
        const rest = DEPARTMENTS.filter(d => !MKT_MEMBERS.includes(d) && !OMNI_MEMBERS.includes(d));
        return ['MKT', 'OMNI', ...rest, 'Other'];
    }, []);

    const groupedData = useMemo(() => {
        const groups: Record<string, { items: PlanItem[]; totalCost: number; totalTarget: number; totalActual: number; isOMNI?: boolean; isMKT?: boolean }> = {};
        
        displayOrder.forEach(key => {
            groups[key] = { items: [], totalCost: 0, totalTarget: 0, totalActual: 0, isOMNI: key === 'OMNI', isMKT: key === 'MKT' };
        });

        OMNI_MEMBERS.forEach(member => {
            groups[member] = { items: [], totalCost: 0, totalTarget: 0, totalActual: 0 };
        });

        MKT_MEMBERS.forEach(member => {
            groups[member] = { items: [], totalCost: 0, totalTarget: 0, totalActual: 0 };
        });

        filteredData.forEach(item => {
            let deptKey = item.department;
            if (OMNI_MEMBERS.includes(deptKey as Department)) {
                if (groups[deptKey]) {
                    groups[deptKey].items.push(item);
                    groups[deptKey].totalCost += (item.estimatedCost || 0);
                    groups[deptKey].totalTarget += (item.totalTarget || 0);
                }
                if (groups['OMNI']) {
                    groups['OMNI'].totalCost += (item.estimatedCost || 0);
                    groups['OMNI'].totalTarget += (item.totalTarget || 0);
                }
            } else if (MKT_MEMBERS.includes(deptKey as Department)) {
                if (groups[deptKey]) {
                    groups[deptKey].items.push(item);
                    groups[deptKey].totalCost += (item.estimatedCost || 0);
                    groups[deptKey].totalTarget += (item.totalTarget || 0);
                }
                if (groups['MKT']) {
                    groups['MKT'].totalCost += (item.estimatedCost || 0);
                    groups['MKT'].totalTarget += (item.totalTarget || 0);
                }
            } else {
                const targetKey = displayOrder.includes(deptKey) ? deptKey : 'Other';
                if (!groups[targetKey]) groups[targetKey] = { items: [], totalCost: 0, totalTarget: 0, totalActual: 0 };
                groups[targetKey].items.push(item);
                groups[targetKey].totalCost += (item.estimatedCost || 0);
                groups[targetKey].totalTarget += (item.totalTarget || 0);
            }
        });

        if (viewMode === 'report') {
            Object.keys(groups).forEach(dept => {
                if (dept === 'OMNI') {
                    OMNI_MEMBERS.forEach(member => {
                        const dailyActuals = actualData[member] || {};
                        groups['OMNI'].totalActual += (Object.values(dailyActuals) as number[]).reduce((a, b) => a + b, 0);
                    });
                } else {
                    const dailyActuals = actualData[dept] || {};
                    groups[dept].totalActual = (Object.values(dailyActuals) as number[]).reduce((a, b) => a + b, 0);
                }
            });
        }

        const finalOrderedGroups: Array<[string, any]> = [];
        displayOrder.forEach(key => {
            finalOrderedGroups.push([key, groups[key]]);
            if (key === 'OMNI') {
                OMNI_MEMBERS.forEach(member => {
                    if (groups[member]) finalOrderedGroups.push([member, groups[member]]);
                });
            }
            if (key === 'MKT') {
                MKT_MEMBERS.forEach(member => {
                    if (groups[member]) finalOrderedGroups.push([member, groups[member]]);
                });
            }
        });

        return finalOrderedGroups;
    }, [filteredData, actualData, viewMode, displayOrder]);

    const grandTotals = useMemo(() => {
        const totals = {
            target: 0, actual: 0, cost: 0,
            daysPlan: Array(32).fill(0) as number[],
            daysActual: Array(32).fill(0) as number[]
        };
        filteredData.forEach(item => {
            totals.target += (item.totalTarget || 0);
            totals.cost += (item.estimatedCost || 0);
            for (let i = 1; i <= 31; i++) { totals.daysPlan[i] += (item[`d${i}`] || 0); }
        });
        if (viewMode === 'report') {
            Object.values(actualData).forEach(deptDays => {
                Object.entries(deptDays).forEach(([day, count]) => {
                    const d = parseInt(day);
                    if (!isNaN(d) && d >= 1 && d <= 31) {
                        totals.daysActual[d] += count;
                        totals.actual += count;
                    }
                });
            });
        }
        return totals;
    }, [filteredData, actualData, viewMode]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const getDayInfo = (d: number) => {
        const date = new Date(year, month, d);
        const dayOfWeek = date.getDay();
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return { label: dayNames[dayOfWeek], isWeekend: dayOfWeek === 0 || dayOfWeek === 6 };
    };

    const getDeptNumbering = (dept: string) => {
        if (OMNI_MEMBERS.includes(dept as Department)) {
            const omniIndex = displayOrder.indexOf('OMNI') + 1;
            const childIndex = OMNI_MEMBERS.indexOf(dept as Department) + 1;
            return `${omniIndex}.${childIndex}.`;
        }
        if (MKT_MEMBERS.includes(dept as Department)) {
            const mktIndex = displayOrder.indexOf('MKT') + 1;
            const childIndex = MKT_MEMBERS.indexOf(dept as Department) + 1;
            return `${mktIndex}.${childIndex}.`;
        }
        const idx = displayOrder.indexOf(dept);
        if (idx === -1) return '';
        return `${idx + 1}.`;
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 relative">
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            
            {/* Banner Khóa/Mở Bảng */}
            {isLocked ? (
                <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-between z-[50] shadow-sm animate-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 text-orange-700 text-xs font-bold">
                        <Lock size={14} className="shrink-0"/> 
                        <span>{lockStatusMessage}</span>
                    </div>
                </div>
            ) : isAdmin && systemLocked ? (
                <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-between z-[50] shadow-sm animate-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 text-orange-700 text-xs font-bold">
                        <Lock size={14} className="shrink-0"/> 
                        <span>{lockStatusMessage}</span>
                    </div>
                    <div className="text-[10px] bg-green-100 border border-green-200 px-2 py-0.5 rounded text-green-800 font-black uppercase flex items-center gap-1">
                        <Unlock size={10}/> Quyền Admin: Bạn vẫn có thể chỉnh sửa
                    </div>
                </div>
            ) : (
                <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-1.5 flex items-center justify-between z-[50] shadow-sm animate-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 text-emerald-700 text-[11px] font-bold">
                        <Unlock size={14} className="shrink-0"/> 
                        <span>{lockStatusMessage}</span>
                    </div>
                    {!isOwner && <div className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black uppercase">Chế độ {userRole === 'collaborator' ? 'Xem Cá Nhân' : 'Hoạt động bình thường'}</div>}
                </div>
            )}

            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ArrowLeft size={20}/></button>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <CalendarRange className="text-indigo-600" size={24}/> LẬP KẾ HOẠCH ORDER
                    </h1>
                </div>

                <div className="flex items-center gap-3 bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                    <button onClick={() => { if(month>0) setMonth(m=>m-1); else { setMonth(11); setYear(y=>y-1); } }} className="p-1 hover:bg-white rounded-lg transition-colors text-gray-500 font-bold px-3">{'<'}</button>
                    <span className="text-sm font-bold text-slate-700 min-w-[100px] text-center uppercase">Tháng {month + 1} / {year}</span>
                    <button onClick={() => { if(month<11) setMonth(m=>m+1); else { setMonth(0); setYear(y=>y+1); } }} className="p-1 hover:bg-white rounded-lg transition-colors text-gray-500 font-bold px-3">{'>'}</button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <button onClick={() => setViewMode('edit')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'edit' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Edit3 size={14}/> Nhập liệu</button>
                        <button onClick={() => setViewMode('report')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'report' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><BarChart3 size={14}/> Báo cáo</button>
                    </div>

                    <div className="h-8 w-px bg-gray-200 mx-1"></div>

                    <div className="flex items-center gap-2">
                        {lastSavedAt && (
                            <span className="text-[10px] text-gray-400 font-medium hidden md:block">
                                Lưu lúc: {lastSavedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <button 
                            onClick={handleManualSave}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${pendingUpdates.size > 0 ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-200 hover:bg-indigo-700' : 'bg-white text-gray-400 border-gray-200 cursor-default'}`}
                            title={pendingUpdates.size > 0 ? `Có ${pendingUpdates.size} thay đổi chưa lưu` : 'Đã đồng bộ'}
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                            <span className="hidden sm:inline">Lưu ngay</span>
                            {pendingUpdates.size > 0 && <span className="bg-white text-indigo-600 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ml-1">{pendingUpdates.size}</span>}
                        </button>

                        <button 
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-gray-600 text-xs font-bold transition-all shadow-sm"
                            title="Xuất file Excel"
                        >
                            <FileSpreadsheet size={14}/>
                            <span className="hidden sm:inline">Xuất Excel</span>
                        </button>

                        <button 
                            onClick={() => setShowLogs(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-gray-600 text-xs font-bold transition-all shadow-sm"
                            title="Nhật ký hoạt động"
                        >
                            <Clock size={14}/>
                            <span className="hidden lg:inline">Nhật ký</span>
                        </button>

                        <button onClick={() => viewMode === 'report' ? loadActualData() : loadData()} className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 shadow-sm transition-all"><RefreshCw size={18} className={isLoading ? "animate-spin" : ""}/></button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-6 overflow-hidden">
                <div className="w-full h-full overflow-auto custom-scrollbar">
                {viewMode === 'report' && (
                    <div className="space-y-6">
                        {/* Phân tích đa chiều - REDESIGNED */}
                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-white border border-gray-200 rounded-3xl shadow-lg shadow-gray-100/50 overflow-hidden flex flex-col">
                                <div className="px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                                            <Layers size={18} className="text-indigo-600"/> Phân tích tổng hợp
                                        </h3>
                                        {/* TAB SWITCHER */}
                                        <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                            <button 
                                                onClick={() => setReportTab('format')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${reportTab === 'format' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Theo Định dạng
                                            </button>
                                            <button 
                                                onClick={() => setReportTab('campaign')}
                                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${reportTab === 'campaign' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Theo Chiến dịch
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">THÁNG {month+1}/{year}</span>
                                </div>
                                <div className="overflow-auto custom-scrollbar flex-1 max-h-[500px]">
                                    {reportTab === 'format' ? (
                                        <table className="w-full text-left text-xs border-separate border-spacing-0">
                                            <thead className="sticky top-0 z-20 shadow-sm">
                                                <tr className="bg-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <th className="p-4 pl-6 border-b border-gray-200 font-extrabold text-gray-600">Phòng ban</th>
                                                    <th className="p-4 w-40 text-center border-b border-gray-200 text-gray-600">Tổng quan</th>
                                                    <th className="p-4 w-32 text-center border-b border-gray-200 text-indigo-600">Hình ảnh</th>
                                                    <th className="p-4 w-32 text-center border-b border-gray-200 text-purple-600">Video</th>
                                                    <th className="p-4 w-32 text-center border-b border-gray-200 text-cyan-600">Design</th>
                                                    <th className="p-4 w-32 text-center border-b border-gray-200 text-gray-600">Khác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {Object.entries(multidimensionalAnalysis).map(([dept, s]: [string, any]) => {
                                                    // Calculate totals
                                                    const totalPlan = s['Total'].plan;
                                                    const totalActual = s['Total'].actual;
                                                    const totalPercent = totalPlan > 0 ? (totalActual/totalPlan)*100 : (totalActual > 0 ? 100 : 0);
                                                    const isTotalOver = totalPlan > 0 && totalActual > totalPlan;

                                                    return (
                                                        <tr key={dept} className="hover:bg-gray-50/50 transition-colors group">
                                                            <td className="p-4 pl-8">
                                                                <span className="font-bold text-gray-700 text-sm">{dept}</span>
                                                            </td>
                                                            
                                                            {/* Total Column - Highlighted */}
                                                            <td className="p-4 bg-gray-50/30 border-x border-gray-50 relative group/total">
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/total:block z-50 animate-in fade-in zoom-in-95 duration-200">
                                                                    <div className="bg-slate-800 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl flex flex-col items-center whitespace-nowrap relative">
                                                                        <span>Đạt: {totalPercent.toFixed(0)}%</span>
                                                                        {isTotalOver && <span className="text-red-300 text-[9px]">(+{totalActual - totalPlan})</span>}
                                                                        <div className="w-2 h-2 bg-slate-800 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                                                                    </div>
                                                                </div>
                                                                {isTotalOver && <div className="absolute top-1 right-1" title="Vượt tổng kế hoạch"><AlertTriangle size={10} className="text-red-500 animate-pulse"/></div>}
                                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className={`text-2xl font-black ${isTotalOver ? 'text-red-600' : 'text-gray-800'}`}>{totalActual}</span>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">/ {totalPlan} Target</span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full ${isTotalOver ? 'bg-red-500' : (totalPercent >= 100 ? 'bg-green-500' : 'bg-gray-500')}`} style={{width: `${Math.min(totalPercent, 100)}%`}}></div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="p-2"><MetricCell actual={s['Hình ảnh'].actual} plan={s['Hình ảnh'].plan} colorBase="indigo" /></td>
                                                            <td className="p-2"><MetricCell actual={s['Video'].actual} plan={s['Video'].plan} colorBase="purple" /></td>
                                                            <td className="p-2"><MetricCell actual={s['Design'].actual} plan={s['Design'].plan} colorBase="cyan" /></td>
                                                            <td className="p-2"><MetricCell actual={s['Khác'].actual} plan={s['Khác'].plan} colorBase="gray" /></td>
                                                        </tr>
                                                    );
                                                })}
                                                {Object.keys(multidimensionalAnalysis).length === 0 && (
                                                    <tr><td colSpan={6} className="p-12 text-center text-gray-300 italic"><div className="flex flex-col items-center gap-2"><Target size={32} className="opacity-20"/> Chưa có dữ liệu deadline trong kỳ báo cáo</div></td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="sticky top-0 z-10 shadow-sm">
                                                <tr className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                                                    <th className="p-3 w-10 text-center">#</th>
                                                    <th className="p-3">Chiến dịch (Plan)</th>
                                                    <th className="p-3 text-center text-indigo-600 w-32">Tổng</th>
                                                    <th className="p-3 w-28 text-center text-purple-500">Video</th>
                                                    <th className="p-3 w-28 text-center text-indigo-500">Hình ảnh</th>
                                                    <th className="p-3 w-28 text-center text-cyan-500">Design</th>
                                                    <th className="p-3 w-28 text-center text-gray-500">Khác</th>
                                                    <th className="p-3 text-right text-amber-600">Ngân sách</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {/* Sort by display order */}
                                                {displayOrder.map(deptName => {
                                                    const data = campaignAnalysis[deptName];
                                                    if (!data) return null;
                                                    
                                                    return (
                                                        <React.Fragment key={deptName}>
                                                            <tr className="bg-gray-50/50 font-bold border-y border-gray-200 text-gray-700">
                                                                <td colSpan={2} className="p-3 pl-4 flex items-center gap-2 uppercase text-xs">
                                                                    <Layers size={14} className="text-indigo-500"/> {deptName}
                                                                </td>
                                                                <td className="p-2">
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <div className="flex items-baseline gap-1">
                                                                            <span className="text-sm font-black text-indigo-700">{data.totalActual}</span>
                                                                            <span className="text-[9px] font-bold text-gray-400">/ {data.totalTarget}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td colSpan={4}></td>
                                                                <td className="p-3 text-right text-amber-700">{data.totalCost.toLocaleString('vi-VN')}</td>
                                                            </tr>
                                                            {Object.entries(data.campaigns).map(([campName, campData]: [string, any], idx: number) => {
                                                                const fmts = campData.formats || {};
                                                                return (
                                                                    <tr key={`${deptName}-${campName}`} className="hover:bg-gray-50 transition-colors group">
                                                                        <td className="p-3 text-center text-gray-300">{idx + 1}</td>
                                                                        <td className="p-3 font-medium text-gray-700">
                                                                            <div className="flex items-center gap-2">
                                                                                <Briefcase size={12} className="text-gray-400"/>
                                                                                {campName}
                                                                            </div>
                                                                        </td>
                                                                        
                                                                        <td className="p-2">
                                                                            <MetricCell actual={campData.actual} plan={campData.target} colorBase="indigo" />
                                                                        </td>

                                                                        <td className="p-2">
                                                                            <MetricCell actual={fmts['Video']?.actual || 0} plan={fmts['Video']?.plan || 0} colorBase="purple" />
                                                                        </td>
                                                                        <td className="p-2">
                                                                            <MetricCell actual={fmts['Hình ảnh']?.actual || 0} plan={fmts['Hình ảnh']?.plan || 0} colorBase="indigo" />
                                                                        </td>
                                                                        <td className="p-2">
                                                                            <MetricCell actual={fmts['Design']?.actual || 0} plan={fmts['Design']?.plan || 0} colorBase="cyan" />
                                                                        </td>
                                                                        <td className="p-2">
                                                                            <MetricCell actual={fmts['Khác']?.actual || 0} plan={fmts['Khác']?.plan || 0} colorBase="gray" />
                                                                        </td>

                                                                        <td className="p-3 text-right font-mono text-amber-600">{campData.cost > 0 ? campData.cost.toLocaleString('vi-VN') : '-'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {Object.keys(campaignAnalysis).length === 0 && (
                                                    <tr><td colSpan={8} className="p-12 text-center text-gray-300 italic">Chưa có dữ liệu chiến dịch</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bảng so sánh Grid */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm inline-block min-w-full">
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                <BarChart3 size={16} className="text-gray-500"/>
                                <h4 className="text-xs font-bold text-gray-600 uppercase">Đối chiếu Kế hoạch & Thực tế (Theo Deadline)</h4>
                            </div>
                            <table className="text-xs border-collapse w-full">
                                <thead className="text-slate-600 font-bold uppercase tracking-wider">
                                    <tr className="bg-slate-100 z-[45]">
                                        <th className="p-3 border-r border-slate-200 sticky top-0 left-0 bg-slate-100 z-[60] text-center" style={{ width: COL_INDEX_WIDTH }}>#</th>
                                        <th className="p-3 border-r border-slate-200 sticky top-0 left-[50px] bg-slate-100 z-[60] text-left" style={{ width: COL_CAMPAIGN_WIDTH }}>Chiến dịch</th>
                                        <th className="p-3 border-r border-slate-200 text-left min-w-[120px] sticky top-0 bg-slate-100 z-[50]">Định dạng</th>
                                        <th className="p-3 border-r border-slate-200 text-center min-w-[70px] sticky top-0 bg-slate-100 z-[50]">Tổng</th>
                                        <th className="p-3 border-r border-slate-200 text-left min-w-[250px] sticky top-0 bg-slate-100 z-[50]">Outcome</th>
                                        <th className="p-3 border-r border-slate-200 text-left min-w-[200px] sticky top-0 bg-slate-100 z-[50]">Comment</th>
                                        <th className="p-3 border-r border-slate-200 text-right bg-amber-50 text-amber-700 min-w-[120px] sticky top-0 z-[50]">Ngân sách</th>
                                        {days.map(d => {
                                            const { label, isWeekend } = getDayInfo(d);
                                            return (
                                                <th key={d} className={`p-1 border-r border-slate-200 w-10 text-center min-w-[36px] sticky top-0 z-[50] ${isWeekend ? 'bg-orange-100/50 text-orange-800' : 'bg-slate-100'}`}>
                                                    <div>{d}</div><div className="text-[9px] opacity-70 font-normal">{label}</div>
                                                </th>
                                            );
                                        })}
                                        <th className="w-10 sticky top-0 bg-slate-100 z-[50]"></th>
                                    </tr>
                                    <tr className="bg-yellow-50 font-black text-slate-800 shadow-sm border-b-2 border-yellow-200 z-[40]">
                                        <th className="sticky top-[45px] left-0 p-2 text-right z-[60] border-r border-yellow-200 bg-yellow-50" style={{ width: COL_INDEX_WIDTH }}><Sigma size={14}/></th>
                                        <th className="sticky top-[45px] left-[50px] p-2 text-right uppercase z-[60] border-r border-yellow-200 bg-yellow-50" style={{ width: COL_CAMPAIGN_WIDTH }}>Tổng hợp:</th>
                                        <th className="bg-yellow-50 border-r border-yellow-200 sticky top-[45px] z-[40]"></th>
                                        <th className="bg-yellow-50 p-2 text-center border-r border-yellow-200 text-indigo-700 text-sm sticky top-[45px] z-[40]">
                                            <span className="flex flex-col leading-none gap-1">
                                                <span className="text-purple-600">{grandTotals.actual.toLocaleString('vi-VN')}</span>
                                                <span className="text-[10px] text-gray-400 border-t border-yellow-200 pt-0.5">{grandTotals.target.toLocaleString('vi-VN')}</span>
                                            </span>
                                        </th>
                                        <th className="bg-yellow-50 border-r border-yellow-200 sticky top-[45px] z-[40]"></th>
                                        <th className="bg-yellow-50 border-r border-yellow-200 sticky top-[45px] z-[40]"></th>
                                        <th className="bg-yellow-50 p-2 text-right border-r border-yellow-200 text-amber-700 text-sm sticky top-[45px] z-[40]">{grandTotals.cost.toLocaleString('vi-VN')}</th>
                                        {days.map(d => {
                                            const { isWeekend } = getDayInfo(d);
                                            const planVal = grandTotals.daysPlan[d];
                                            const actVal = grandTotals.daysActual[d];
                                            return (
                                                <th key={d} className={`p-1 border-r border-yellow-200 text-center text-[10px] sticky top-[45px] z-[40] ${isWeekend ? 'bg-orange-100/80' : 'bg-yellow-50'}`}>
                                                    <div className="flex flex-col items-center">
                                                        <span className={`${actVal > 0 ? 'text-purple-700 font-bold' : 'text-gray-300'}`}>{actVal}</span>
                                                        <span className="w-full h-px bg-yellow-200 my-0.5"></span>
                                                        <span className={`${planVal > 0 ? 'text-indigo-700' : 'text-gray-300'}`}>{planVal}</span>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="bg-yellow-50 sticky top-[45px] z-[40]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {groupedData.map(([dept, group]) => {
                                        const isOMNIParent = dept === 'OMNI';
                                        const isOMNIChild = OMNI_MEMBERS.includes(dept as Department);

                                        return (
                                            <React.Fragment key={dept}>
                                                <tr className={`border-y sticky z-30 ${isOMNIParent ? 'bg-slate-800 text-white border-slate-700' : isOMNIChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}>
                                                    <td className={`sticky top-[89px] p-2 border-r font-black text-left z-50 uppercase shadow-sm ${isOMNIParent ? 'bg-slate-800 border-slate-700' : isOMNIChild ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-100 border-slate-300 text-slate-800'}`} style={{ left: 0 }} colSpan={2}>
                                                        <div className={`flex items-center justify-between ${isOMNIChild ? 'pl-8' : 'pl-2'}`}>
                                                            <span className="flex items-center gap-2">
                                                                {isOMNIChild && <ChevronRight size={14} className="text-indigo-400" />}
                                                                {getDeptNumbering(dept)} {dept}
                                                            </span>
                                                            <div className="flex gap-4 text-[10px] font-normal normal-case">
                                                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold border ${isOMNIParent ? 'bg-slate-700 text-white border-slate-600' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>Thực tế: {group.totalActual}</span>
                                                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold border ${isOMNIParent ? 'bg-indigo-900 text-indigo-100 border-indigo-800' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>Target: {group.totalTarget}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={`sticky top-[89px] border-r z-30 ${isOMNIParent ? 'bg-slate-800 border-slate-700' : isOMNIChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}></td>
                                                    <td className={`sticky top-[89px] p-2 text-center font-bold border-r z-30 ${isOMNIParent ? 'bg-indigo-900/50 border-slate-700 text-indigo-200' : 'text-indigo-700 bg-indigo-100/50 border-indigo-200'}`}>{group.totalTarget}</td>
                                                    <td className={`sticky top-[89px] border-r z-30 ${isOMNIParent ? 'bg-slate-800 border-slate-700' : isOMNIChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}></td>
                                                    <td className={`sticky top-[89px] border-r z-30 ${isOMNIParent ? 'bg-slate-800 border-slate-700' : isOMNIChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}></td>
                                                    <td className={`sticky top-[89px] p-2 text-right font-black border-r z-30 ${isOMNIParent ? 'bg-amber-900/40 border-slate-700 text-amber-200' : 'text-amber-700 bg-amber-50 border-indigo-200'}`}>{group.totalCost.toLocaleString('vi-VN')}</td>
                                                    <td colSpan={32} className={`sticky top-[89px] z-30 ${isOMNIParent ? 'bg-slate-800' : isOMNIChild ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                                                    </td>
                                                </tr>
                                                {!isOMNIParent && group.items.map((item: PlanItem, idx: number) => (
                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="p-2 border-r border-slate-100 text-center text-slate-400 sticky bg-white group-hover:bg-slate-50 z-10" style={{ left: STICKY_POS.index }}>{idx + 1}</td>
                                                        <td className="p-0 border-r border-slate-100 sticky bg-white group-hover:bg-slate-50 z-10 align-top" style={{ left: STICKY_POS.campaign }}>
                                                            <AutoHeightTextarea value={item.campaign} readOnly={true} onChange={val => updateItem(item.id, 'campaign', val)} className="font-medium text-slate-700" placeholder="Tên chiến dịch..."/>
                                                        </td>
                                                        <td className="p-0 border-r border-slate-100 align-top">
                                                            <select value={item.format} disabled={true} onChange={e => updateItem(item.id, 'format', e.target.value)} className="w-full h-[44px] p-2 bg-transparent outline-none text-[11px] cursor-pointer">
                                                                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-2 border-r border-slate-100 text-center font-bold text-indigo-600 bg-indigo-50/30 group-hover:bg-indigo-50 align-top pt-3">{item.totalTarget}</td>
                                                        <td className="p-0 border-r border-slate-100 align-top">
                                                            <AutoHeightTextarea value={item.outcome} readOnly={true} onChange={val => updateItem(item.id, 'outcome', val)} className="text-[11px]" placeholder="Outcome mong muốn..."/>
                                                        </td>
                                                        <td className="p-0 border-r border-slate-100 align-top">
                                                            <AutoHeightTextarea value={item.comment} readOnly={true} onChange={val => updateItem(item.id, 'comment', val)} className="text-[11px]" placeholder="Ghi chú..."/>
                                                        </td>
                                                        <td className="p-0 border-r border-slate-100 bg-amber-50/30 align-top">
                                                            <AutoNumberInput value={item.estimatedCost} readOnly={true} onChange={v => updateItem(item.id, 'estimatedCost', v)} className="w-full h-[44px] p-2 text-right font-mono font-medium text-amber-700 bg-transparent"/>
                                                        </td>
                                                        {days.map(d => {
                                                            const planVal = item[`d${d}`] || 0;
                                                            return (
                                                                <td key={d} className={`p-0 border-r border-slate-100 text-center align-top ${planVal > 0 ? 'bg-indigo-50 font-bold text-indigo-700' : ''}`}>
                                                                    <div className="w-full h-[44px] flex items-center justify-center text-[10px]">{planVal > 0 ? planVal : ''}</div>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="p-1 text-center align-top pt-3"></td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- ADDED: EDIT MODE TABLE VIEW --- */}
                {viewMode === 'edit' && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm inline-block min-w-full">
                        <table className="text-xs border-separate border-spacing-0 w-full">
                            <PlanningHeader 
                                days={days} 
                                year={year} 
                                month={month} 
                                showSummary={true} 
                                totals={grandTotals} 
                            />
                            <tbody className="divide-y divide-gray-200">
                                {groupedData.map(([dept, group]) => {
                                    const isParent = dept === 'OMNI' || dept === 'MKT';
                                    const isChild = OMNI_MEMBERS.includes(dept as Department) || MKT_MEMBERS.includes(dept as Department);
                                    const isExpanded = expandedGroups[dept] !== false;

                                    // Determine parent for child
                                    const parentDept = OMNI_MEMBERS.includes(dept as Department) ? 'OMNI' : MKT_MEMBERS.includes(dept as Department) ? 'MKT' : null;
                                    if (parentDept && expandedGroups[parentDept] === false) return null;

                                    return (
                                        <React.Fragment key={dept}>
                                            <tr className={`border-y sticky z-30 ${isParent ? 'bg-slate-800 text-white border-slate-700' : isChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}>
                                                <td className={`sticky top-[89px] p-2 border-r font-black text-left z-50 uppercase shadow-sm ${isParent ? 'bg-slate-800 border-slate-700' : isChild ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-100 border-slate-300 text-slate-800'}`} style={{ left: 0 }} colSpan={2}>
                                                    <div className={`flex items-center justify-between ${isChild ? 'pl-8' : 'pl-2'}`}>
                                                        <span className="flex items-center gap-2 cursor-pointer" onClick={() => isParent && toggleGroup(dept)}>
                                                            {isParent && (expandedGroups[dept] ? <ChevronRight size={14} className="rotate-90 transition-transform" /> : <ChevronRight size={14} className="transition-transform" />)}
                                                            {isChild && <ChevronRight size={14} className="text-indigo-400" />}
                                                            {getDeptNumbering(dept)} {dept}
                                                        </span>
                                                        <div className="flex gap-4 text-[10px] font-normal normal-case">
                                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold border ${isParent ? 'bg-indigo-900 text-indigo-100 border-indigo-800' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>Target: {group.totalTarget}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Spacer cells for sticky header alignment */}
                                                <td className={`sticky top-[89px] border-r z-30 ${isParent ? 'bg-slate-800 border-slate-700' : isChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}></td>
                                                <td className={`sticky top-[89px] p-2 text-center font-bold border-r z-30 ${isParent ? 'bg-indigo-900/50 border-slate-700 text-indigo-200' : 'text-indigo-700 bg-indigo-100/50 border-indigo-200'}`}>{group.totalTarget}</td>
                                                <td className={`sticky top-[89px] border-r z-30 ${isParent ? 'bg-slate-800 border-slate-700' : isChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}></td>
                                                <td className={`sticky top-[89px] border-r z-30 ${isParent ? 'bg-slate-800 border-slate-700' : isChild ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-100 border-slate-200'}`}></td>
                                                <td className={`sticky top-[89px] p-2 text-right font-black border-r z-30 ${isParent ? 'bg-amber-900/40 border-slate-700 text-amber-200' : 'text-amber-700 bg-amber-50 border-indigo-200'}`}>{group.totalCost.toLocaleString('vi-VN')}</td>
                                                <td colSpan={32} className={`sticky top-[89px] z-30 ${isParent ? 'bg-slate-800' : isChild ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                                                    {!isParent && !isLocked && <button onClick={() => handleAddItem(dept)} className="ml-2 hover:bg-indigo-200 p-1 rounded transition-colors text-indigo-600"><Plus size={14}/></button>}
                                                </td>
                                            </tr>
                                            {isExpanded && !isParent && group.items.map((item: PlanItem, idx: number) => (
                                                <PlanningRow 
                                                    key={item.id} 
                                                    item={item} 
                                                    idx={idx} 
                                                    isLocked={isLocked} 
                                                    updateItem={updateItem} 
                                                    handleDeleteItem={handleDeleteItem} 
                                                    days={days} 
                                                />
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>

            {/* Modal Nhật ký hoạt động */}
            {showLogs && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                                <Clock className="text-blue-600" size={20}/> Nhật ký hoạt động Planning
                            </h3>
                            <button onClick={() => setShowLogs(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
                            {isLogsLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <Loader2 className="animate-spin mb-2" size={32}/>
                                    <p className="text-sm font-bold">Đang tải nhật ký...</p>
                                </div>
                            ) : systemLogs.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Clock size={48} className="mx-auto mb-4 opacity-20"/>
                                    <p className="text-sm font-bold">Chưa có hoạt động nào được ghi lại.</p>
                                </div>
                            ) : (
                                systemLogs.map((log, i) => (
                                    <div key={i} className="flex gap-4 p-4 rounded-2xl border border-gray-100 hover:bg-slate-50 transition-colors">
                                        <div className="shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                            {log.user.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-black text-slate-800">{log.user}</span>
                                                <span className="text-[10px] text-gray-400 font-medium">{log.timestamp}</span>
                                            </div>
                                            <div className="text-[11px] font-bold text-blue-700 mb-1 uppercase tracking-wider">{log.action}</div>
                                            <p className="text-xs text-slate-600 leading-relaxed">{log.details}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setShowLogs(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all shadow-lg shadow-slate-200">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cửa sổ xác nhận xóa */}
            {deleteRowId && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 shadow-inner">
                            <Trash2 size={28}/>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận xóa?</h3>
                        <p className="text-sm text-gray-500 mb-6">Bạn có chắc chắn muốn xóa dòng kế hoạch này không? Hành động không thể hoàn tác.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteRowId(null)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm">Hủy bỏ</button>
                            <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all text-sm">Xóa ngay</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
