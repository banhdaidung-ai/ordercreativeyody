
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { BudgetItem, MasterDataItem, BudgetColumnConfig } from '../types';
import { fetchBudgetData, saveBudgetItem, deleteBudgetItem, fetchMasterData, saveMasterDataItem, deleteMasterDataItem } from '../services/dataService';
import { Loader2, Plus, RefreshCw, Save, Trash2, Calendar, DollarSign, Wallet, ArrowLeft, Settings, X, Edit2, GripVertical, TrendingDown, TrendingUp, AlertCircle, CheckCircle2, PieChart as LucidePieChart, Copy, LayoutDashboard, ChevronDown, ChevronUp, Info, Lock } from 'lucide-react';
import { useSync } from '../src/components/SyncManager';
import { motion, AnimatePresence } from 'motion/react';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    AreaChart, Area
} from 'recharts';

const formatCurrency = (val: number) => val ? val.toLocaleString('vi-VN') : '0';

// Helper to generate Plan ID based on Month/Year
const getPlanRowId = (month: number, year: number) => `PLAN_${year}_${month}`;

// --- Toast Component (Local) ---
const Toast: React.FC<{ type: 'success' | 'error'; message: string; onClose: () => void }> = ({ type, message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000); // Increased time for reading links
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgClass = type === 'error' ? 'bg-red-50/80 text-red-700 border-red-100' : 'bg-emerald-50/80 text-emerald-700 border-emerald-100';
    const icon = type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>;
    
    // Check if message contains a URL
    const urlMatch = message.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;
    const cleanMessage = url ? message.replace(url, '').trim() : message;

    return (
        <div className={`fixed bottom-6 right-6 z-[120] flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-2xl animate-in slide-in-from-right-10 duration-300 ${bgClass} backdrop-blur-xl max-w-md border-white/40`}>
            <div className={`p-2 rounded-xl ${type === 'error' ? 'bg-red-100' : 'bg-emerald-100'}`}>
                {icon}
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-black tracking-tight">{cleanMessage}</span>
                {url && (
                    <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] uppercase tracking-widest underline flex items-center gap-1 hover:opacity-80 font-black text-indigo-600"
                    >
                        Click vào đây để tạo Index <Settings size={12} />
                    </a>
                )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full shrink-0 transition-colors"><X size={16}/></button>
        </div>
    );
};

// --- Helper Components ---

const AutoNumberInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    placeholder?: string;
    className?: string;
    readOnly?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
}> = ({ value, onChange, placeholder, className, readOnly, onFocus, onBlur }) => {
    const [localStr, setLocalStr] = useState(value !== undefined && value !== null ? value.toLocaleString('vi-VN') : '');

    useEffect(() => {
        setLocalStr(value !== undefined && value !== null ? value.toLocaleString('vi-VN') : '');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        if (!raw) {
            setLocalStr('');
            onChange(0);
            return;
        }
        const num = parseInt(raw, 10);
        setLocalStr(num.toLocaleString('vi-VN'));
        onChange(num); 
    };

    const handleBlur = () => {
        const raw = localStr.replace(/[^0-9]/g, '');
        let num = parseInt(raw, 10) || 0;
        // Logic: Nếu số nhỏ hơn 1000 và > 0, tự động nhân 1000 (đơn vị nghìn đồng)
        if (num > 0 && num < 1000) {
            num = num * 1000;
            setLocalStr(num.toLocaleString('vi-VN'));
            onChange(num);
        }
        if (onBlur) onBlur();
    };

    return (
        <input 
            type="text"
            value={localStr}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={handleBlur}
            readOnly={readOnly}
            placeholder={placeholder}
            className={`outline-none font-mono ${className} ${readOnly ? 'cursor-not-allowed' : ''}`}
        />
    );
};

// Modal: Manage Columns (Add/Delete Only - Metadata moved to inline)
const ColumnConfigModal: React.FC<{
    columns: BudgetColumnConfig[];
    onSave: (cols: BudgetColumnConfig[]) => void;
    onClose: () => void;
}> = ({ columns, onSave, onClose }) => {
    const [localCols, setLocalCols] = useState<BudgetColumnConfig[]>(columns);
    const [newColName, setNewColName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleAdd = () => {
        if (!newColName.trim()) return;
        const newCol: BudgetColumnConfig = {
            id: `col-${Date.now()}`,
            name: newColName.trim(),
            code: '', // Edited inline
            plan: 0,  // Edited inline
            order: localCols.length
        };
        setLocalCols([...localCols, newCol]);
        setNewColName('');
    };

    const handleDeleteClick = (id: string) => {
        setConfirmDeleteId(id);
    };

    const confirmDelete = () => {
        if (confirmDeleteId) {
            setLocalCols(localCols.filter(c => c.id !== confirmDeleteId));
            setConfirmDeleteId(null);
        }
    };

    const handleUpdateName = (id: string, name: string) => {
        setLocalCols(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white/80 backdrop-blur-2xl w-full max-w-lg sm:rounded-[2.5rem] shadow-2xl flex flex-col h-[85vh] sm:h-auto sm:max-h-[90vh] overflow-hidden relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-5 sm:zoom-in-95 duration-300 bottom-sheet border border-white/40">
                
                {/* Mobile Handle */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>

                {/* Delete Confirmation Overlay */}
                {confirmDeleteId && (
                    <div className="absolute inset-0 z-[160] flex items-center justify-center bg-white/60 backdrop-blur-xl animate-in fade-in duration-200">
                        <div className="bg-white/90 backdrop-blur-md border border-white/40 shadow-2xl p-8 rounded-[2rem] w-full max-w-xs text-center animate-in zoom-in-95">
                             <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
                                <Trash2 size={32}/>
                             </div>
                             <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Xác nhận xóa?</h3>
                             <p className="text-xs text-slate-500 mb-8 font-bold leading-relaxed">Bạn có chắc muốn xóa nhóm chi phí này? Dữ liệu quá khứ của cột này sẽ bị ẩn.</p>
                             <div className="flex gap-4">
                                 <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-slate-600 transition-all text-xs mobile-touch-target active:scale-95">Hủy</button>
                                 <button onClick={confirmDelete} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-xl shadow-red-200 transition-all text-xs mobile-touch-target active:scale-95">Xóa cột</button>
                             </div>
                        </div>
                    </div>
                )}

                <div className="px-8 py-6 border-b border-white/40 flex justify-between items-center bg-white/20">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Quản lý Cột (Nhóm chi phí)</h3>
                    <button onClick={onClose} className="p-3 sm:p-2 mobile-touch-target bg-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={20} className="sm:w-5 sm:h-5"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {/* Add New */}
                    <div className="bg-indigo-50/50 backdrop-blur-sm p-6 rounded-[2rem] border border-indigo-100 flex flex-col sm:flex-row gap-4 items-stretch sm:items-end shadow-sm">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] ml-1">Tên nhóm chi phí mới</label>
                            <input 
                                type="text"
                                value={newColName}
                                onChange={(e) => setNewColName(e.target.value)}
                                placeholder="VD: Chi phí Marketing..."
                                className="w-full px-5 py-4 sm:py-3 bg-white/80 backdrop-blur-sm border border-indigo-100 rounded-2xl text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                            />
                        </div>
                        <button 
                            onClick={handleAdd}
                            className="px-8 py-4 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm mobile-touch-target active:scale-95"
                        >
                            <Plus size={20}/> Thêm
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em] px-2">Danh sách cột hiện có</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {localCols.map((col, idx) => (
                                <div key={col.id} className="flex items-center gap-4 p-4 bg-white/40 backdrop-blur-sm border border-white/40 rounded-2xl hover:border-indigo-500/30 hover:bg-white/60 hover:shadow-xl transition-all group">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                        <GripVertical size={16}/>
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            type="text"
                                            value={col.name}
                                            onChange={(e) => handleUpdateName(col.id, e.target.value)}
                                            className="w-full bg-transparent font-black text-slate-700 outline-none text-sm tracking-tight"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteClick(col.id)}
                                        className="p-3 sm:p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all mobile-touch-target active:scale-90"
                                    >
                                        <Trash2 size={20} className="sm:w-4 sm:h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-8 border-t border-white/40 bg-white/20 flex gap-4 sticky bottom-0">
                    <button onClick={onClose} className="flex-1 py-4 sm:py-3 bg-white/60 backdrop-blur-md border border-slate-200 text-slate-600 font-black rounded-2xl text-sm mobile-touch-target active:scale-95 transition-all">Hủy bỏ</button>
                    <button onClick={() => onSave(localCols)} className="flex-1 py-4 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-sm shadow-xl shadow-indigo-200 transition-all mobile-touch-target active:scale-95">Lưu thay đổi</button>
                </div>
            </div>
        </div>
    );
};

// Modal: Manage Dropdowns (Simple List)
const ListManagerModal: React.FC<{
    title: string;
    items: string[];
    onSave: (items: string[]) => void;
    onClose: () => void;
}> = ({ title, items, onSave, onClose }) => {
    const [localItems, setLocalItems] = useState(items);
    const [newItem, setNewItem] = useState('');

    const add = () => {
        if (newItem.trim() && !localItems.includes(newItem.trim())) {
            setLocalItems([...localItems, newItem.trim()]);
            setNewItem('');
        }
    };

    const remove = (val: string) => {
        setLocalItems(localItems.filter(i => i !== val));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-red-500"/></button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="flex gap-2">
                        <input type="text" className="flex-1 text-sm border rounded px-3 py-2 outline-none focus:border-indigo-500" placeholder="Thêm mới..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}/>
                        <button onClick={add} className="bg-green-600 text-white px-3 rounded font-bold hover:bg-green-700"><Plus size={16}/></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto border rounded divide-y custom-scrollbar">
                        {localItems.map(item => (
                            <div key={item} className="flex justify-between items-center p-2 text-sm hover:bg-gray-50">
                                <span>{item}</span>
                                <button onClick={() => remove(item)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={() => onSave(localItems)} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">Lưu danh sách</button>
                </div>
            </div>
        </div>
    );
};

export const BudgetTable: React.FC<{ onBack: () => void; userRole?: string }> = ({ onBack, userRole }) => {
    const { startSync, stopSync } = useSync();
    const [data, setData] = useState<BudgetItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    
    if (userRole === 'member') {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500 shadow-inner">
                    <Lock size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Truy cập bị từ chối</h2>
                <p className="text-slate-500 mb-8 max-w-md font-medium">Bạn không có quyền truy cập vào bảng ngân sách. Vui lòng liên hệ quản trị viên để biết thêm chi tiết.</p>
                <button onClick={onBack} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2">
                    <ArrowLeft size={18} /> Quay lại trang chủ
                </button>
            </div>
        );
    }
    
    // Configurations from Master Data
    const [columns, setColumns] = useState<BudgetColumnConfig[]>([]);
    const [expenseTypes, setExpenseTypes] = useState<string[]>([]);
    const [picList, setPicList] = useState<string[]>([]);
    const [masterData, setMasterData] = useState<MasterDataItem[]>([]); 

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [showDashboard, setShowDashboard] = useState(false);

    // Caching/Saving logic
    const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
    const pendingUpdatesRef = useRef(pendingUpdates);
    useEffect(() => { pendingUpdatesRef.current = pendingUpdates; }, [pendingUpdates]);

    const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
    const editingCellRef = useRef(editingCell);
    useEffect(() => { editingCellRef.current = editingCell; }, [editingCell]);

    const handleCellBlur = () => {
        // Use a small timeout to allow the next cell's onFocus to fire first
        setTimeout(() => {
            if (!document.activeElement || 
                (document.activeElement.tagName !== 'INPUT' && 
                 document.activeElement.tagName !== 'TEXTAREA' && 
                 document.activeElement.tagName !== 'SELECT')) {
                setEditingCell(null);
            }
        }, 50);
    };
    const [pendingColUpdates, setPendingColUpdates] = useState<boolean>(false);

    // Modals
    const [showColConfig, setShowColConfig] = useState(false);
    const [showTagConfig, setShowTagConfig] = useState(false);
    const [showPicConfig, setShowPicConfig] = useState(false);
    
    // Delete confirmation state
    const [rowToDelete, setRowToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Filter by Date (Transactions only)
    const filteredData = useMemo(() => {
        const filtered = data.filter(item => {
            if (item.id.startsWith('PLAN_')) return false; // Exclude special plan rows
            if (!item.date) return false;
            const d = new Date(item.date);
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        });
        return filtered;
    }, [data, selectedMonth, selectedYear]);

    // Calculate Yearly Total Spent
    const yearlyTotal = useMemo(() => {
        return data.filter(item => {
            if (item.id.startsWith('PLAN_')) return false;
            if (!item.date) return false;
            const d = new Date(item.date);
            return d.getFullYear() === selectedYear;
        }).reduce((total, row) => {
            const rowSum = columns.reduce((acc, col) => acc + (Number(row[col.name]) || 0), 0);
            return total + rowSum;
        }, 0);
    }, [data, selectedYear, columns]);

    // Sync Plan Data from Rows to Columns State
    useEffect(() => {
        const planId = getPlanRowId(selectedMonth, selectedYear);
        const planRow = data.find(r => r.id === planId);

        setColumns(prevCols => {
            let hasChanges = false;
            const newCols = prevCols.map(col => {
                const currentPlan = col.plan;
                // Get plan from row data, default to 0
                const newPlan = planRow ? (Number(planRow[col.name]) || 0) : 0;
                
                if (currentPlan !== newPlan) {
                    hasChanges = true;
                    return { ...col, plan: newPlan };
                }
                return col;
            });
            return hasChanges ? newCols : prevCols;
        });
    }, [data, selectedMonth, selectedYear]);

    // Calculate Totals
    const summary = useMemo(() => {
        // Total plan comes from synced columns state (which comes from the monthly row)
        const totalPlan = columns.reduce((acc, c) => acc + (c.plan || 0), 0);
        
        // Sum spent for each column from transactions
        const spentByCol: Record<string, number> = {};
        let totalSpent = 0;

        columns.forEach(col => {
            const colSum = filteredData.reduce((sum, row) => sum + (Number(row[col.name]) || 0), 0);
            spentByCol[col.name] = colSum;
            totalSpent += colSum;
        });

        const totalRemaining = totalPlan - totalSpent;

        return {
            totalPlan,
            totalSpent,
            totalRemaining,
            spentByCol
        };
    }, [filteredData, columns]);

    // Auto-save Rows
    useEffect(() => {
        if (pendingUpdates.size === 0) return;
        const timeout = setTimeout(async () => {
            setIsSaving(true);
            const idsToSave = Array.from(pendingUpdatesRef.current);
            
            // Filter out items that are currently being edited
            const rowsToSave = data.filter(r => {
                if (!idsToSave.includes(r.id)) return false;
                if (editingCellRef.current && editingCellRef.current.id === r.id) return false;
                return true;
            });

            if (rowsToSave.length === 0) {
                setIsSaving(false);
                return;
            }

            try {
                await Promise.all(rowsToSave.map(r => saveBudgetItem(r, columns)));
                
                // Remove saved IDs from pending
                rowsToSave.forEach(r => pendingUpdatesRef.current.delete(r.id));
                setPendingUpdates(new Set(pendingUpdatesRef.current));
            } catch (e) {
                console.error("Save error", e);
                setToast({ type: 'error', message: 'Lỗi khi lưu dữ liệu tự động' });
            } finally {
                setIsSaving(false);
            }
        }, 3000);
        return () => clearTimeout(timeout);
    }, [pendingUpdates, data, columns]);

    // Auto-save Columns (Metadata: Code)
    useEffect(() => {
        if (!pendingColUpdates) return;
        const timeout = setTimeout(async () => {
            setIsSaving(true);
            setPendingColUpdates(false);
            try {
                // Identify columns to delete (those in masterData but not in current columns)
                const currentIds = new Set(columns.map(c => c.id));
                const toDelete = masterData.filter(m => m.listKey === 'BUDGET_COLUMN' && !currentIds.has(m.id));
                
                if (toDelete.length > 0) {
                    await Promise.all(toDelete.map(o => deleteMasterDataItem(o.id)));
                }
                
                // Save/Update all current columns
                await Promise.all(columns.map((c, idx) => saveMasterDataItem({
                    id: c.id,
                    listKey: 'BUDGET_COLUMN',
                    value: c.name,
                    color: c.code,
                    description: String(c.plan), 
                    order: idx,
                    textColor: ''
                })));

                // Reload master data to sync
                const master = await fetchMasterData();
                setMasterData(master);
            } catch (e) {
                console.error("Column save error", e);
            } finally {
                setIsSaving(false);
            }
        }, 2000); // Debounce column save longer
        return () => clearTimeout(timeout);
    }, [pendingColUpdates, columns, masterData]);

    const loadData = async () => {
        setIsLoading(true);
        startSync();
        try {
            const [budgetData, master] = await Promise.all([
                fetchBudgetData(),
                fetchMasterData()
            ]);
            setData(budgetData);
            setMasterData(master);
            parseMasterData(master);
        } catch (e: any) {
            console.error("Load budget error:", e);
            if (e.indexUrl) {
                setToast({ 
                    type: 'error', 
                    message: `Truy vấn yêu cầu Index Firestore. Vui lòng tạo tại: ${e.indexUrl}` 
                });
            } else {
                setToast({ type: 'error', message: 'Lỗi tải dữ liệu ngân sách' });
            }
        } finally {
            setIsLoading(false);
            stopSync();
        }
    };

    const parseMasterData = (master: MasterDataItem[]) => {
        const colConfigs = master.filter(m => m.listKey === 'BUDGET_COLUMN').sort((a,b) => (a.order || 0) - (b.order || 0));
        
        // Deduplicate by name (value) AND ID to prevent UI duplication and React key warnings
        const uniqueCols: MasterDataItem[] = [];
        const seenNames = new Set<string>();
        const seenIds = new Set<string>();
        
        colConfigs.forEach(c => {
            const name = (c.value || '').trim().toLowerCase();
            const id = c.id;
            
            if (name && !seenNames.has(name) && !seenIds.has(id)) {
                seenNames.add(name);
                seenIds.add(id);
                uniqueCols.push(c);
            }
        });

        if (uniqueCols.length > 0) {
            setColumns(uniqueCols.map(c => ({
                id: c.id,
                name: c.value,
                code: c.color || '',
                plan: 0, // Init to 0, data will sync from special row
                order: c.order || 0
            })));
        } else {
            setColumns([]);
        }

        const tags = Array.from(new Set(master.filter(m => m.listKey === 'BUDGET_TAG').map(m => m.value))).filter(Boolean);
        setExpenseTypes(tags.length ? tags : ['Quyết toán Tuần', 'Resize', 'Campaign', 'Khác']);

        const pics = Array.from(new Set(master.filter(m => m.listKey === 'BUDGET_PIC').map(m => m.value))).filter(Boolean);
        setPicList(pics.length ? pics : ['Cường', 'Loan', 'Thu', 'Thảo', 'Thắm']);
    };

    const handleSave = async () => {
        if (pendingUpdates.size === 0 && !pendingColUpdates) {
            setToast({ type: 'success', message: 'Dữ liệu đã được lưu' });
            return;
        }
        
        setIsSaving(true);
        try {
            // Save Rows
            if (pendingUpdates.size > 0) {
                const idsToSave = Array.from(pendingUpdates);
                setPendingUpdates(new Set());
                const rowsToSave = data.filter(r => idsToSave.includes(r.id));
                await Promise.all(rowsToSave.map(r => saveBudgetItem(r, columns)));
            }

            // Save Columns
            if (pendingColUpdates) {
                setPendingColUpdates(false);
                await Promise.all(columns.map((c, idx) => saveMasterDataItem({
                    id: c.id,
                    listKey: 'BUDGET_COLUMN',
                    value: c.name,
                    color: c.code,
                    description: String(c.plan), 
                    order: idx,
                    textColor: ''
                })));
            }
            
            setToast({ type: 'success', message: 'Đã lưu dữ liệu thành công!' });
        } catch (e) {
            setToast({ type: 'error', message: 'Lỗi khi lưu dữ liệu' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleColumnStructureSave = async (newCols: BudgetColumnConfig[]) => {
        setIsSaving(true);
        try {
            const latestMaster = await fetchMasterData();
            const currentIds = new Set(newCols.map(c => c.id));
            const toDelete = latestMaster.filter(m => m.listKey === 'BUDGET_COLUMN' && !currentIds.has(m.id));
            
            if (toDelete.length > 0) {
                await Promise.all(toDelete.map(o => deleteMasterDataItem(o.id)));
            }
            
            await Promise.all(newCols.map((c, idx) => saveMasterDataItem({
                id: c.id,
                listKey: 'BUDGET_COLUMN',
                value: c.name,
                color: c.code || '',
                description: String(c.plan || 0), 
                order: idx,
                textColor: ''
            })));
            
            setColumns(newCols);
            setShowColConfig(false);
            
            const master = await fetchMasterData();
            setMasterData(master);
            setToast({ type: 'success', message: 'Đã lưu cấu hình cột thành công!' });
        } catch (e) {
            setToast({ type: 'error', message: 'Lỗi lưu cấu hình cột' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveList = async (key: 'BUDGET_TAG' | 'BUDGET_PIC', rawItems: string[]) => {
        const items = Array.from(new Set(rawItems.map(i => i.trim()))).filter(Boolean);
        setIsSaving(true);
        try {
            if (key === 'BUDGET_TAG') setExpenseTypes(items);
            else setPicList(items);

            const latestMaster = await fetchMasterData();
            const oldItems = latestMaster.filter(m => m.listKey === key);
            
            // Identify items to delete
            const toDelete = oldItems.filter(o => !items.includes(o.value));
            await Promise.all(toDelete.map(o => deleteMasterDataItem(o.id)));

            // Save/Update items
            await Promise.all(items.map((val, idx) => {
                const existing = oldItems.find(o => o.value === val);
                return saveMasterDataItem({
                    id: existing ? existing.id : `${key}-${Date.now()}-${idx}`,
                    listKey: key,
                    value: val,
                    order: idx
                });
            }));
            
            if (key === 'BUDGET_TAG') setShowTagConfig(false);
            else setShowPicConfig(false);

            const master = await fetchMasterData();
            setMasterData(master);
            setToast({ type: 'success', message: 'Đã cập nhật danh sách thành công!' });
        } catch(e) {
            setToast({ type: 'error', message: 'Lỗi lưu danh sách' });
        } finally {
            setIsSaving(false);
        }
    };

    const updateRow = (id: string, field: string, val: any) => {
        setData(prev => prev.map(row => row.id === id ? { ...row, [field]: val } : row));
        setPendingUpdates(prev => new Set(prev).add(id));
    };

    // Update Code or Plan directly in header
    const updateColumnMeta = (id: string, field: 'code' | 'plan', val: any) => {
        if (field === 'code') {
            // Code updates go to Master Data
            setColumns(prev => prev.map(c => c.id === id ? { ...c, code: val } : c));
            setPendingColUpdates(true);
        } else if (field === 'plan') {
            // Plan updates go to Budget Data (Monthly Plan Row)
            const planId = getPlanRowId(selectedMonth, selectedYear);
            const colName = columns.find(c => c.id === id)?.name;
            if (!colName) return;

            setData(prev => {
                const existingRowIndex = prev.findIndex(r => r.id === planId);
                if (existingRowIndex >= 0) {
                    // Update existing
                    const newRow = { ...prev[existingRowIndex], [colName]: val };
                    const newData = [...prev];
                    newData[existingRowIndex] = newRow;
                    return newData;
                } else {
                    // Create new
                    const safeDay = 1;
                    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
                    const newRow: BudgetItem = {
                        id: planId,
                        date: dateStr,
                        content: 'PLAN_ROW_HIDDEN',
                        tag: 'SYSTEM',
                        pic: 'SYSTEM',
                        [colName]: val
                    };
                    return [...prev, newRow];
                }
            });
            // Mark for save to budget sheet
            setPendingUpdates(prev => new Set(prev).add(planId));
        }
    };

    const handleAddRow = () => {
        const safeDay = Math.min(new Date().getDate(), 28);
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

        const newRow: BudgetItem = {
            id: `budget-${Date.now()}`,
            date: dateStr,
            content: '',
            tag: '', // Default empty
            pic: '', // Default empty
        };
        columns.forEach(c => newRow[c.name] = 0);
        
        setData(prev => [...prev, newRow]);
        setPendingUpdates(prev => new Set(prev).add(newRow.id));
    };

    const confirmDeleteRow = async () => {
        if (!rowToDelete) return;
        const id = rowToDelete;
        const prevData = [...data];
        
        setData(prev => prev.filter(r => r.id !== id));
        setRowToDelete(null); // Close modal

        try {
            await deleteBudgetItem(id);
            setToast({ type: 'success', message: 'Đã xóa dòng' });
        } catch (e) {
            setData(prevData); // Revert on failure
            setToast({ type: 'error', message: 'Lỗi khi xóa dòng' });
        }
    };

    const getTagColor = (tag: string) => {
        const t = (tag || '').toLowerCase();
        if (t.includes('quyết toán')) return 'bg-red-50 text-red-700 border-red-100';
        if (t.includes('resize')) return 'bg-orange-50 text-orange-700 border-orange-100';
        if (t.includes('campaign')) return 'bg-green-50 text-green-700 border-green-100';
        return 'bg-gray-50 text-gray-700 border-gray-100';
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden">
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

            {/* Top Bar with Summary */}
            <div className="bg-white/80 backdrop-blur-md border-b border-white/40 px-4 sm:px-8 py-4 flex items-center justify-between shrink-0 shadow-sm z-20 gap-6">
                
                {/* Left: Title & Back */}
                <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-3 sm:p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-all mobile-touch-target active:scale-90">
                            <ArrowLeft size={24} className="sm:w-5 sm:h-5" />
                        </button>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                            <div className="p-2 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-100">
                                <Wallet size={20}/>
                            </div>
                            <span className="hidden sm:inline">NGÂN SÁCH</span>
                        </h1>
                    </div>
                </div>

                {/* Center: Filters & Dashboard Toggle */}
                <div className="flex-1 flex items-center justify-center gap-4">
                    
                    {/* Dashboard Toggle Button */}
                    <button 
                        onClick={() => setShowDashboard(!showDashboard)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-sm border ${
                            showDashboard 
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-200' 
                            : 'bg-white/60 backdrop-blur-md text-slate-600 border-white/40 hover:bg-white'
                        }`}
                    >
                        <LayoutDashboard size={16} />
                        <span className="hidden lg:inline">DASHBOARD</span>
                        {showDashboard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

                    {/* Month Picker */}
                    <div className="flex items-center gap-1 bg-white/40 backdrop-blur-md p-1 rounded-2xl border border-white/40 flex-1 sm:flex-none justify-center shadow-sm">
                        <div className="px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-2 flex-1 sm:flex-none justify-center">
                            <Calendar size={16} className="text-indigo-500"/>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="bg-transparent text-xs font-black text-slate-900 outline-none cursor-pointer tracking-tight"
                            >
                                {Array.from({length: 12}).map((_, i) => (
                                    <option key={i} value={i}>Tháng {i + 1}</option>
                                ))}
                            </select>
                        </div>
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-transparent text-xs font-black text-slate-600 outline-none cursor-pointer px-3 tracking-tight"
                        >
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                            <option value={2027}>2027</option>
                        </select>
                    </div>

                    <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block"></div>

                    {/* Stats */}
                    <div className="flex items-center gap-8 hidden md:flex">
                        <div className="flex flex-col items-start">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tổng Ngân sách</span>
                            <span className="text-base font-black text-indigo-600 tracking-tight">{formatCurrency(summary.totalPlan)}</span>
                        </div>
                        
                        <div className="flex flex-col items-start">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Đã chi tiêu</span>
                            <span className="text-sm font-black text-orange-600">{formatCurrency(summary.totalSpent)}</span>
                        </div>

                        <div className="h-8 w-px bg-slate-200"></div>

                        <div className="flex flex-col items-start">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tổng Còn lại</span>
                            <div className={`text-lg font-black leading-none ${summary.totalRemaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formatCurrency(summary.totalRemaining)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-2 shrink-0 justify-end">
                    {isSaving && <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold px-3"><Loader2 className="animate-spin" size={14}/></div>}
                    
                    <button onClick={() => setShowColConfig(true)} className="p-2.5 sm:p-2 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 text-indigo-600 flex items-center gap-2 text-xs font-bold transition-all mobile-touch-target" title="Cấu hình Cột">
                        <Settings size={20} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Cột</span>
                    </button>

                    <button onClick={handleAddRow} className="bg-indigo-600 text-white px-4 sm:px-3 py-2.5 sm:py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-md active:scale-95 transition-all mobile-touch-target">
                        <Plus size={20} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Thêm dòng</span>
                    </button>
                    <button onClick={loadData} className="p-2.5 sm:p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 mobile-touch-target">
                        <RefreshCw size={20} className={`sm:w-4.5 sm:h-4.5 ${isLoading ? "animate-spin" : ""}`}/>
                    </button>
                </div>
            </div>

            {/* Dashboard Panel */}
            <AnimatePresence>
                {showDashboard && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden bg-slate-50/50 border-b border-slate-200/60"
                    >
                        <div className="p-6 sm:p-8 space-y-8">
                            {/* Bento Grid Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Card 1: Yearly Total */}
                                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 group hover:scale-[1.02] transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200">
                                            <LucidePieChart size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yearly {selectedYear}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(yearlyTotal)}</h3>
                                        <p className="text-xs text-slate-500 font-bold">Tổng chi tiêu tích lũy</p>
                                    </div>
                                </div>

                                {/* Card 2: Monthly Budget */}
                                <div className="bg-indigo-600 p-6 rounded-[2rem] border border-indigo-500 shadow-xl shadow-indigo-200 group hover:scale-[1.02] transition-all text-white">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20">
                                            <DollarSign size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Budget T{selectedMonth + 1}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black tracking-tighter">{formatCurrency(summary.totalPlan)}</h3>
                                        <p className="text-xs text-indigo-100 font-bold">Ngân sách dự kiến tháng</p>
                                    </div>
                                </div>

                                {/* Card 3: Spent */}
                                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-xl shadow-slate-200/50 group hover:scale-[1.02] transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-100">
                                            <TrendingUp size={20} />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spent T{selectedMonth + 1}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-orange-600 tracking-tighter">{formatCurrency(summary.totalSpent)}</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-orange-500 rounded-full transition-all duration-1000" 
                                                    style={{ width: `${Math.min((summary.totalSpent / (summary.totalPlan || 1)) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400">
                                                {Math.round((summary.totalSpent / (summary.totalPlan || 1)) * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: Remaining */}
                                <div className={`p-6 rounded-[2rem] border shadow-xl group hover:scale-[1.02] transition-all backdrop-blur-xl ${
                                    summary.totalRemaining < 0 
                                    ? 'bg-red-50/80 border-red-100 shadow-red-100' 
                                    : 'bg-emerald-50/80 border-emerald-100 shadow-emerald-100'
                                }`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-2xl shadow-lg ${
                                            summary.totalRemaining < 0 ? 'bg-red-500 text-white shadow-red-100' : 'bg-emerald-500 text-white shadow-emerald-100'
                                        }`}>
                                            {summary.totalRemaining < 0 ? <TrendingDown size={20} /> : <CheckCircle2 size={20} />}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                                            summary.totalRemaining < 0 ? 'text-red-400' : 'text-emerald-400'
                                        }`}>Remaining</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className={`text-2xl font-black tracking-tighter ${
                                            summary.totalRemaining < 0 ? 'text-red-600' : 'text-emerald-600'
                                        }`}>{formatCurrency(summary.totalRemaining)}</h3>
                                        <p className="text-xs text-slate-500 font-bold">Ngân sách còn lại</p>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Chart 1: Spending by Category (Pie) */}
                                <div className="lg:col-span-1 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40">
                                    <div className="flex items-center justify-between mb-8">
                                        <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">Phân bổ chi phí</h4>
                                        <Info size={14} className="text-slate-300" />
                                    </div>
                                    <div className="h-[280px] w-full flex items-center justify-center">
                                        {Object.values(summary.spentByCol).some(v => v > 0) ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={columns.map(col => ({
                                                            name: col.name,
                                                            value: summary.spentByCol[col.name] || 0
                                                        })).filter(d => d.value > 0)}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={8}
                                                        dataKey="value"
                                                    >
                                                        {columns.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={[
                                                                '#4F46E5', '#F97316', '#10B981', '#EC4899', '#8B5CF6', '#06B6D4'
                                                            ][index % 6]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{ 
                                                            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                                            borderRadius: '16px', 
                                                            border: 'none', 
                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                            fontSize: '12px',
                                                            fontWeight: '900'
                                                        }}
                                                        formatter={(value: number) => formatCurrency(value)}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-300">
                                                <LucidePieChart size={48} strokeWidth={1} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Chưa có dữ liệu chi tiêu</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        {columns.filter(col => (summary.spentByCol[col.name] || 0) > 0).map((col, idx) => (
                                            <div key={col.id} className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#4F46E5', '#F97316', '#10B981', '#EC4899', '#8B5CF6', '#06B6D4'][columns.indexOf(col) % 6] }} />
                                                <span className="text-[10px] font-bold text-slate-500 truncate">{col.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Chart 2: Plan vs Spent (Bar) */}
                                <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/40">
                                    <div className="flex items-center justify-between mb-8">
                                        <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">Kế hoạch vs Thực tế</h4>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-indigo-100 rounded-sm" />
                                                <span className="text-[10px] font-black text-slate-400">PLAN</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-indigo-600 rounded-sm" />
                                                <span className="text-[10px] font-black text-slate-400">ACTUAL</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-[320px] w-full flex items-center justify-center">
                                        {columns.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={columns.map(col => ({
                                                    name: col.name,
                                                    plan: col.plan,
                                                    spent: summary.spentByCol[col.name] || 0
                                                }))}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis 
                                                        dataKey="name" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                                                        dy={10}
                                                    />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                                                        tickFormatter={(val) => val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
                                                    />
                                                    <Tooltip 
                                                        cursor={{ fill: '#f8fafc' }}
                                                        contentStyle={{ 
                                                            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                                            borderRadius: '16px', 
                                                            border: 'none', 
                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                            fontSize: '12px',
                                                            fontWeight: '900'
                                                        }}
                                                        formatter={(value: number) => formatCurrency(value)}
                                                    />
                                                    <Bar dataKey="plan" fill="#E0E7FF" radius={[4, 4, 0, 0]} barSize={32} />
                                                    <Bar dataKey="spent" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={32} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-300">
                                                <RefreshCw size={48} strokeWidth={1} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Chưa có cấu hình cột</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Matrix Table Area */}
            <div className="flex-1 min-h-0 p-0 sm:p-6 overflow-hidden">
                <div className="w-full h-full overflow-auto custom-scrollbar bg-white sm:rounded-xl shadow-sm border-t sm:border border-gray-200">
                    <table className="text-xs border-collapse min-w-full">
                        <thead className="sticky top-0 z-10 shadow-sm">
                            {/* Row 1: Header Names */}
                            <tr className="bg-orange-200 text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                                <th className="p-2 border-r border-orange-300 w-10 sticky left-0 bg-orange-200 z-20">#</th>
                                <th className="p-2 text-left border-r border-orange-300 w-24 sticky left-[40px] bg-orange-200 z-20">Ngày</th>
                                <th className="p-2 text-left border-r border-orange-300 min-w-[450px] bg-orange-200">Nội dung chi</th>
                                
                                {/* Dropdown Headers with Edit Icon */}
                                <th className="p-2 text-left border-r border-orange-300 w-32 relative group cursor-pointer hover:bg-orange-300 transition-colors" onClick={() => setShowTagConfig(true)}>
                                    <div className="flex items-center justify-between">
                                        Loại chi <Settings size={10} className="opacity-50"/>
                                    </div>
                                </th>
                                <th className="p-2 text-left border-r border-orange-300 w-24 relative group cursor-pointer hover:bg-orange-300 transition-colors" onClick={() => setShowPicConfig(true)}>
                                    <div className="flex items-center justify-between">
                                        Người chi <Settings size={10} className="opacity-50"/>
                                    </div>
                                </th>
                                
                                {/* Dynamic Columns Header */}
                                {columns.map(col => (
                                    <th key={col.id} className="p-2 text-center border-r border-orange-300 min-w-[100px] bg-orange-200">
                                        {col.name}
                                    </th>
                                ))}
                                <th className="w-10 bg-white border-none"></th>
                            </tr>

                            {/* Row 2: Codes (Editable) */}
                            <tr className="bg-white border-b border-slate-200">
                                <th colSpan={2} className="p-2 text-right text-gray-400 font-bold italic sticky left-0 bg-white z-20 border-r border-slate-200 text-[10px]">Mã dòng tiền</th>
                                <th colSpan={3} className="bg-white border-r border-slate-200"></th>
                                {columns.map(col => (
                                    <th key={col.id} className="p-0 border-r border-slate-200">
                                            <input 
                                                type="text" 
                                                className="w-full h-full p-2 text-center font-mono text-indigo-600 font-bold outline-none text-[10px] bg-transparent focus:bg-indigo-50"
                                                value={col.code}
                                                onFocus={() => setEditingCell({ id: col.id, field: 'code' })}
                                                onBlur={handleCellBlur}
                                                onChange={(e) => updateColumnMeta(col.id, 'code', e.target.value)}
                                                placeholder="Nhập mã..."
                                            />
                                    </th>
                                ))}
                                <th></th>
                            </tr>

                            {/* Row 3: Plan Amounts (Editable) */}
                            <tr className="bg-orange-600 text-white border-b border-orange-700">
                                <th colSpan={2} className="p-2 text-right font-black uppercase sticky left-0 bg-orange-600 z-20 border-r border-orange-500">
                                    Plan T{selectedMonth + 1}
                                </th>
                                <th colSpan={3} className="bg-orange-600 border-r border-orange-500"></th>
                                {columns.map(col => (
                                    <th key={col.id} className="p-0 border-r border-orange-500 bg-orange-600 hover:bg-orange-500 transition-colors">
                                        <AutoNumberInput 
                                            value={col.plan} 
                                            onFocus={() => setEditingCell({ id: col.id, field: 'plan' })}
                                            onBlur={handleCellBlur}
                                            onChange={(val) => updateColumnMeta(col.id, 'plan', val)}
                                            className="w-full h-full p-2 text-right font-black bg-transparent text-white outline-none placeholder-orange-300 focus:bg-orange-500"
                                            placeholder="0"
                                        />
                                    </th>
                                ))}
                                <th></th>
                            </tr>

                            {/* Row 4: Remaining (Calculated) */}
                            <tr className="bg-yellow-100 text-slate-900 border-b border-yellow-200">
                                <th colSpan={2} className="p-2 text-right font-black uppercase sticky left-0 bg-yellow-100 z-20 border-r border-yellow-200">
                                    Còn lại
                                </th>
                                <th colSpan={3} className="bg-yellow-100 border-r border-yellow-200"></th>
                                {columns.map(col => {
                                    const used = summary.spentByCol[col.name] || 0;
                                    const remain = col.plan - used;
                                    return (
                                        <th key={col.id} className={`p-2 text-right font-black border-r border-yellow-200 ${remain < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                            {formatCurrency(remain)}
                                        </th>
                                    );
                                })}
                                <th></th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map((row, idx) => (
                                <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="p-2 text-center text-slate-400 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-indigo-50/30 font-medium align-top">{idx + 1}</td>
                                    
                                    <td className="p-1 border-r border-slate-100 sticky left-[40px] bg-white group-hover:bg-indigo-50/30 align-top">
                                        <input 
                                            type="date" 
                                            value={row.date} 
                                            onFocus={() => setEditingCell({ id: row.id, field: 'date' })}
                                            onBlur={handleCellBlur}
                                            onChange={(e) => updateRow(row.id, 'date', e.target.value)} 
                                            className="w-full bg-transparent outline-none text-slate-700 font-medium"
                                        />
                                    </td>
                                    
                                    <td className="p-1 border-r border-slate-100 bg-white group-hover:bg-indigo-50/30 align-top relative group/content">
                                        <textarea 
                                            value={row.content} 
                                            onFocus={() => setEditingCell({ id: row.id, field: 'content' })}
                                            onBlur={handleCellBlur}
                                            onChange={(e) => updateRow(row.id, 'content', e.target.value)} 
                                            className="w-full h-full bg-transparent outline-none font-medium text-slate-800 text-xs p-1 pr-6 min-h-[32px] resize-y" 
                                            placeholder="Nội dung..."
                                            title={row.content}
                                        />
                                        {row.content && (
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(row.content);
                                                    setToast({ type: 'success', message: 'Đã sao chép nội dung!' });
                                                }}
                                                className="absolute top-1 right-1 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/content:opacity-100 transition-opacity"
                                                title="Sao chép nội dung chi"
                                            >
                                                <Copy size={12}/>
                                            </button>
                                        )}
                                    </td>
                                    
                                    <td className="p-1 border-r border-slate-100 align-top">
                                        <select
                                            value={row.tag}
                                            onFocus={() => setEditingCell({ id: row.id, field: 'tag' })}
                                            onBlur={handleCellBlur}
                                            onChange={(e) => updateRow(row.id, 'tag', e.target.value)}
                                            className={`w-full px-1 py-1.5 rounded border border-transparent text-[10px] font-bold uppercase outline-none cursor-pointer ${getTagColor(row.tag)} focus:border-indigo-300`}
                                        >
                                            <option value="">-- Chọn --</option>
                                            {expenseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    
                                    <td className="p-1 border-r border-slate-100 align-top">
                                        <select
                                            value={row.pic}
                                            onFocus={() => setEditingCell({ id: row.id, field: 'pic' })}
                                            onBlur={handleCellBlur}
                                            onChange={(e) => updateRow(row.id, 'pic', e.target.value)}
                                            className="w-full px-1 py-1.5 rounded border border-transparent text-[10px] font-bold text-center outline-none bg-gray-50 text-gray-700 cursor-pointer focus:border-indigo-300"
                                        >
                                            <option value="">-- Chọn --</option>
                                            {picList.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </td>

                                    {/* Dynamic Cost Cells */}
                                    {columns.map(col => (
                                        <td key={col.id} className="p-1 border-r border-slate-100 text-right align-top">
                                            <AutoNumberInput 
                                                value={row[col.name]} 
                                                onFocus={() => setEditingCell({ id: row.id, field: col.name })}
                                                onBlur={handleCellBlur}
                                                onChange={(v) => updateRow(row.id, col.name, v)} 
                                                className="w-full text-right bg-transparent text-gray-700"
                                            />
                                        </td>
                                    ))}

                                    <td className="p-1 text-center align-top pt-2 flex items-center justify-center gap-2">
                                        <button onClick={() => setRowToDelete(row.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Xóa dòng">
                                            <Trash2 size={14}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={5 + columns.length} className="p-12 text-center text-slate-400 italic">
                                        Chưa có dữ liệu chi phí cho tháng {selectedMonth + 1}/{selectedYear}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {rowToDelete && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 shadow-inner">
                            <Trash2 size={28}/>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận xóa?</h3>
                        <p className="text-sm text-gray-500 mb-6">Bạn có chắc chắn muốn xóa dòng chi phí này không? Dữ liệu sẽ bị xóa vĩnh viễn trên cả Google Sheet.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setRowToDelete(null)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm">Hủy bỏ</button>
                            <button onClick={confirmDeleteRow} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all text-sm">Xóa ngay</button>
                        </div>
                    </div>
                </div>
            )}

            {showColConfig && (
                <ColumnConfigModal 
                    columns={columns} 
                    onSave={handleColumnStructureSave} 
                    onClose={() => setShowColConfig(false)} 
                />
            )}
            {showTagConfig && (
                <ListManagerModal 
                    title="Quản lý Danh sách Loại chi" 
                    items={expenseTypes} 
                    onSave={(items) => handleSaveList('BUDGET_TAG', items)} 
                    onClose={() => setShowTagConfig(false)} 
                />
            )}
            {showPicConfig && (
                <ListManagerModal 
                    title="Quản lý Danh sách Người chi" 
                    items={picList} 
                    onSave={(items) => handleSaveList('BUDGET_PIC', items)} 
                    onClose={() => setShowPicConfig(false)} 
                />
            )}
        </div>
    );
};
