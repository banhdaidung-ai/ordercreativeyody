
import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { WorkOrder, Department, Status, Stylist, VideoEditor, PhotoEditor, Designer, ChangeLogEntry, DEFAULT_ORDERERS, DEFAULT_PRODUCT_TYPES, CostDetails, MasterDataItem, HARDCODED_LISTS } from '../types';
import { SelectCell, TextCell, TextAreaCell, DateCell, CheckboxCell, NumberCell, RichTextCell, DynamicListCell, TooltipCell, CostCell } from './TableCells';
import { RefreshCw, Loader2, Table as TableIcon, LayoutDashboard, Calendar, WifiOff, Filter, Search, Trash2, ClipboardList, Cloud, Check, AlertTriangle, Settings, ShieldAlert, ExternalLink, GripVertical, Clock, ChevronDown, X, CheckSquare, Square, ArrowUp, ArrowDown, ArrowUpDown, Plus, ZoomIn, ZoomOut, Maximize, Settings as SettingsIcon, Columns, AlertOctagon, Palette, FileSpreadsheet, Sparkles, Zap, CheckCircle2, AlertCircle, Info, Lock, Unlock, Layers, ChevronRight, Database, History } from 'lucide-react';
import { debounce } from 'lodash';
import { fetchSheetData, saveWorkOrder, deleteWorkOrder, getSheetTabs, fetchMasterData, getMasterDataGid, saveMasterDataItem, logActivity, fetchNextOrderCode, reserveNextOrderCode } from '../services/dataService';
import { useSync } from '../src/components/SyncManager';
import { SummaryReport } from './SummaryReport';
import { WorkOrderDetailModal } from './WorkOrderDetailModal';
import { CreateOrderModal } from './CreateOrderModal';
import { ColumnManager } from './ColumnManager';
import { CostBreakdownModal } from './CostBreakdownModal';
import { createPortal } from 'react-dom';
import * as ReactWindow from 'react-window';
import * as XLSX from 'xlsx';

const List = (ReactWindow as any).FixedSizeList;
const areEqual = (ReactWindow as any).areEqual;

// --- AUTO SIZER COMPONENT (LOCAL) ---
const AutoSizer = ({ children }: { children?: (props: { height: number, width: number }) => React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ height: 0, width: 0 });

    useLayoutEffect(() => {
        if (!ref.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setSize({
                    height: entry.contentRect.height,
                    width: entry.contentRect.width
                });
            }
        });
        resizeObserver.observe(ref.current);
        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div ref={ref} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            {size.height > 0 && size.width > 0 && children?.(size)}
        </div>
    );
};

// --- TYPES FOR GROUPING ---
const DEFAULT_FILTERS = {
  orderCode: '', department: [], orderer: [], category: [], title: '', content: '', productType: [], 
  classType: [], status: [], isConfirmed: [], productLink: '', startDate: '', implementationDate: '', 
  dueDate: '', stylist: [], videoPerson: [], photoPerson: [], designer: [], platform: [], estimatedCost: '', trackingNote: '', global: ''
};

type GroupHeaderItem = {
    type: 'header';
    date: string;
    displayDate: string;
    count: number;
    isWeekend: boolean;
    id: string; // Unique ID for key
};

type RowItem = {
    type: 'row';
    data: WorkOrder;
    id: string;
    rowBg: string;
    leftBorderColor: string;
};

type TableItem = GroupHeaderItem | RowItem;

const Toast: React.FC<{ type: 'info' | 'success' | 'error'; message: string; onClose: () => void }> = ({ type, message, onClose }) => {
    const bgClass = type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100';
    const icon = type === 'error' ? <AlertCircle size={18}/> : type === 'success' ? <CheckCircle2 size={18}/> : <Loader2 size={18} className="animate-spin"/>;
    
    useEffect(() => {
        // Info messages (loading) persist until replaced. Others auto-close.
        if (type === 'info') return;
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose, type]);

    const renderMessage = () => {
        const urlMatch = message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        if (urlMatch) {
            const parts = message.split(urlMatch[0]);
            return (
                <span className="text-sm font-bold">
                    {parts[0]}
                    <a 
                        href={urlMatch[0]} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="underline text-red-800 hover:text-red-900 ml-1 inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Click để tạo index <ExternalLink size={12} />
                    </a>
                    {parts[1]}
                </span>
            );
        }
        return <span className="text-sm font-bold">{message}</span>;
    };

    return (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg shadow-gray-200/50 animate-in slide-in-from-right-10 duration-300 ${bgClass} bg-white`}>
            {icon}
            {renderMessage()}
            <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full"><X size={14}/></button>
        </div>
    );
};

const MultiSelectFilter: React.FC<{
  options: string[];
  selected: string[];
  onChange: (newSelected: string[]) => void;
  placeholder?: string;
}> = ({ options, selected = [], onChange, placeholder = "Tất cả" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{top: number, left: number, width: number} | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const portal = document.getElementById(`multiselect-dropdown-${placeholder}`);
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [placeholder]);

  useEffect(() => {
      if (isOpen && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 220) });
      }
  }, [isOpen]);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) { onChange(selected.filter(item => item !== opt)); } 
    else { onChange([...selected, opt]); }
  };

  const toggleAll = () => {
    if (selected.length === options.length) { onChange([]); } 
    else { onChange([...options]); }
  };

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
  const displayText = selected.length === 0 ? placeholder : selected.length === options.length ? "Tất cả" : `${selected.length} mục`;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-[10px] flex items-center justify-between border rounded-lg px-2.5 py-1.5 outline-none transition-all shadow-sm active:scale-[0.98] ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-white' : 'border-gray-200 hover:border-gray-300 bg-white/60 '} ${selected.length > 0 ? 'text-indigo-700 font-black bg-indigo-50/80' : 'text-gray-500'}`}
      >
        <span className="truncate tracking-tight">{displayText}</span>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
             <div onClick={(e) => { e.stopPropagation(); onChange([]); }} className="p-0.5 hover:bg-indigo-200 text-indigo-600 rounded-md transition-colors"><X size={10} strokeWidth={3} /></div>
          )}
          <ChevronDown size={10} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} strokeWidth={3} />
        </div>
      </button>
      {isOpen && dropdownPos && createPortal(
        <div 
          id={`multiselect-dropdown-${placeholder}`} 
          className="fixed bg-white/95  border border-gray-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[9999] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200" 
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: '350px' }}
        >
          <div className="p-3 border-b border-gray-100 bg-gray-50/50 ">
             <div className="relative">
               <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
               <input 
                 type="text" 
                 placeholder="Tìm nhanh..." 
                 className="w-full text-[11px] pl-8 pr-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 transition-all font-medium" 
                 value={searchTerm} 
                 onChange={(e) => setSearchTerm(e.target.value)} 
                 autoFocus 
               />
             </div>
          </div>
          <div className="overflow-y-auto p-2 custom-scrollbar flex-1 space-y-0.5">
             {searchTerm === "" && (
               <div 
                 onClick={toggleAll} 
                 className="flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50/50 cursor-pointer rounded-xl text-[11px] font-black text-gray-700 border-b border-gray-50 mb-1 select-none transition-colors group"
               >
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selected.length === options.length && options.length > 0 ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                    {selected.length === options.length && options.length > 0 && <Check size={10} className="text-white" strokeWidth={4} />}
                  </div>
                  <span className="uppercase tracking-wider">Chọn tất cả ({options.length})</span>
               </div>
             )}
             {filteredOptions.length > 0 ? (
                filteredOptions.map(opt => {
                  const isSelected = selected.includes(opt);
                  return (
                    <div 
                      key={opt} 
                      onClick={() => toggleOption(opt)} 
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-xl text-[11px] select-none transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}
                    >
                       <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-gray-300 group-hover:border-indigo-400'}`}>
                         {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                       </div>
                       <span className="truncate">{opt}</span>
                    </div>
                  );
                })
             ) : ( 
               <div className="p-8 text-center flex flex-col items-center gap-2">
                 <div className="p-3 bg-gray-50 rounded-full text-gray-300"><Search size={20} /></div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Không tìm thấy</span>
               </div>
             )}
          </div>
          <div className="bg-gray-50/80  border-t border-gray-100 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 flex justify-between items-center">
            <span>Đã chọn: {selected.length}</span>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="text-indigo-600 hover:text-indigo-800 transition-colors">Xóa hết</button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const isEmptyRow = (row: WorkOrder) => {
  const safeStr = (v: any) => String(v || '').trim();
  if (safeStr(row.orderCode) !== '' || safeStr(row.title) !== '') return false;
  return safeStr(row.content) === '' && safeStr(row.orderer) === '' && safeStr(row.category) === '' && safeStr(row.productLink) === '' && safeStr(row.estimatedCost) === '';
};

const getRowStyles = (row: WorkOrder) => {
    const s = (row.status || '').toLowerCase();
    let leftBorderColor = 'border-l-indigo-300';
    let rowBg = 'bg-white';
    let diffDays = 1000;

    if (row.dueDate) {
        const today = new Date(); today.setHours(0,0,0,0);
        const due = new Date(row.dueDate);
        if (!isNaN(due.getTime())) {
            due.setHours(0,0,0,0);
            diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
        }
    }
    
    if (isEmptyRow(row)) {
        rowBg = 'bg-gray-50';
        leftBorderColor = 'border-l-gray-200';
    } else if (s.includes('hủy')) {
        rowBg = 'bg-slate-200 text-slate-600'; 
        leftBorderColor = 'border-l-slate-500';
    } else if (s.includes('hoàn tất')) {
        rowBg = 'bg-emerald-100'; 
        leftBorderColor = 'border-l-emerald-600';
    } else if (s.includes('đang quay') || s.includes('thực hiện')) {
        rowBg = 'bg-amber-100'; 
        leftBorderColor = 'border-l-amber-500';
    } else if (s.includes('xác nhận')) {
        rowBg = 'bg-sky-100'; 
        leftBorderColor = 'border-l-sky-600';
    } else if (s.includes('hậu kì')) {
        rowBg = 'bg-violet-100'; 
        leftBorderColor = 'border-l-violet-600';
    } else if (s.includes('chờ duyệt')) {
        rowBg = 'bg-cyan-100'; 
        leftBorderColor = 'border-l-cyan-600';
    } else {
        rowBg = 'bg-indigo-50';
        leftBorderColor = 'border-l-indigo-400';
    }

    if (!isEmptyRow(row) && row.dueDate && !s.includes('hoàn tất') && !s.includes('hủy')) {
        if (diffDays < 0) {
            leftBorderColor = 'border-l-red-600';
            rowBg = 'bg-red-200'; 
        } else if (diffDays >= 0 && diffDays <= 3) {
            leftBorderColor = 'border-l-orange-600';
            rowBg = 'bg-orange-100';
        }
    }
    return { rowBg, leftBorderColor };
};

const generateUniqueOrderCode = (currentList: WorkOrder[], prefix: string = 'Pro'): string => {
  let maxNum = 0;
  const regex = new RegExp(`^${prefix}[\\s\\-_]*(\\d+)`, 'i');
  currentList.forEach(row => {
    if (!row.orderCode) return;
    const match = row.orderCode.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  let nextNum = maxNum + 1;
  let nextCode = `${prefix}${String(nextNum).padStart(3, '0')}`;
  const existingCodes = new Set(currentList.map(r => r.orderCode?.trim().toUpperCase()));
  while (existingCodes.has(nextCode.toUpperCase())) {
     nextNum++;
     nextCode = `${prefix}${String(nextNum).padStart(3, '0')}`;
  }
  return nextCode;
};

const createEmptyRow = (orderCode: string = ''): WorkOrder => ({
  id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  department: '', orderCode, orderer: '', category: '', title: '', content: '', productType: '', classType: '', status: '', 
  isConfirmed: false, productLink: '', startDate: '', implementationDate: '', dueDate: '', stylist: '', videoPerson: '', photoPerson: '', 
  designer: '', platform: '', estimatedCost: '', trackingNote: '', historyLogs: [],
});

const DateRangeFilter: React.FC<{ value: string; onChange: (val: string) => void; }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [start, end] = value ? value.split('|') : ['', ''];
  const [dropdownPos, setDropdownPos] = useState<{top: number, left: number} | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (document.getElementById('date-filter-portal')?.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [isOpen]);

  const handleChange = (newStart: string, newEnd: string) => {
    if (!newStart && !newEnd) onChange(''); else onChange(`${newStart}|${newEnd}`);
  };

  const handleClear = (e: React.MouseEvent) => { e.stopPropagation(); onChange(''); setIsOpen(false); };
  const formatDisplay = (dateStr: string) => {
      if (!dateStr) return ''; const d = new Date(dateStr); if (isNaN(d.getTime())) return dateStr; return `${d.getDate()}/${d.getMonth()+1}`;
  };
  const displayText = (!start && !end) ? "Tất cả" : `${start ? formatDisplay(start) : '...'} - ${end ? formatDisplay(end) : '...'}`;
  const isActive = !!start || !!end;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full text-[10px] flex items-center justify-between border rounded-lg px-2.5 py-1.5 outline-none transition-all shadow-sm h-[28px] active:scale-[0.98] ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-white' : 'border-gray-200 hover:border-gray-300 bg-white/60 '} ${isActive ? 'bg-indigo-50/80 text-indigo-700 font-black' : 'text-gray-500'}`} 
        title={value ? `Lọc: ${value.replace('|', ' đến ')}` : 'Lọc theo ngày'}
      >
        <span className="truncate flex-1 text-left tracking-tight">{displayText}</span>
        <div className="flex items-center gap-1">
          {isActive ? (
            <div onClick={handleClear} className="p-0.5 hover:bg-indigo-200 text-indigo-600 rounded-md cursor-pointer transition-colors"><X size={10} strokeWidth={3} /></div>
          ) : (
            <Calendar size={10} className="text-gray-400" strokeWidth={3} />
          )}
        </div>
      </button>
      {isOpen && dropdownPos && createPortal(
         <div 
           id="date-filter-portal" 
           className="fixed z-[9999] bg-white/95  border border-gray-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl p-4 flex flex-col gap-4 w-60 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200" 
           style={{ top: dropdownPos.top, left: dropdownPos.left }}
         >
            <div className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> 
                  Từ ngày
                </label>
                <input 
                  type="date" 
                  value={start} 
                  onChange={(e) => handleChange(e.target.value, end)} 
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 outline-none bg-gray-50/50 focus:bg-white transition-all font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div> 
                  Đến ngày
                </label>
                <input 
                  type="date" 
                  value={end} 
                  onChange={(e) => handleChange(start, e.target.value)} 
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 outline-none bg-gray-50/50 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>
            {isActive && (
              <button 
                onClick={handleClear} 
                className="mt-1 w-full text-[10px] text-rose-500 font-black uppercase tracking-widest hover:bg-rose-50 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Trash2 size={12} strokeWidth={2.5}/> Xóa bộ lọc
              </button>
            )}
         </div>, document.body
      )}
    </div>
  );
};

// --- ADDED HELPER ---
const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('hoàn tất')) return '#22c55e'; // Green
    if (s.includes('hủy')) return '#ef4444'; // Red
    if (s.includes('đang') || s.includes('thực hiện')) return '#eab308'; // Yellow
    if (s.includes('chờ')) return '#9ca3af'; // Gray
    if (s.includes('xác nhận')) return '#3b82f6'; // Blue
    return '#6366f1'; // Indigo default
};

interface WorkOrderTableProps {
  currentUser: string;
  currentUserName?: string;
  userRole: 'admin' | 'member' | 'collaborator';
  isOwner?: boolean;
  isAdmin?: boolean;
  initialTabId?: string;
  autoCreate?: boolean;
  initialViewMode?: 'table' | 'tracking' | 'report';
}

const VirtualRow = React.memo(({ index, style, data }: any) => {
    // react-window passes data as the 'data' prop
    // We need to ensure we don't try to access properties of a boolean if data is passed incorrectly
    if (typeof data !== 'object' || data === null) {
        return null;
    }

    const { 
        items, columns, colWidths, isRowPending, updateRow, 
        logChange, handleDeleteClick, setCostModalData, 
        setSelectedOrder, getOptionsFromMaster, getConfigFromMaster, viewMode, isLocked,
        fillSource, fillCurrentIndex, handleFillStart, handleFillEnter, isViewingCompleted,
        setEditingCell, handleCellBlur
    } = data;
    
    const item = items[index] as TableItem;
    if (!item) return null;

    // --- RENDER GROUP HEADER ---
    if (item.type === 'header') {
        const { displayDate, count, isWeekend } = item;
        return (
            <div style={style} className={`flex items-center px-4 font-bold border-b border-gray-200 select-none ${isWeekend ? 'bg-green-100/80 text-green-900' : 'bg-indigo-100/80 text-indigo-900'} z-10`}>
                <div className="flex items-center gap-2 w-full">
                    <span className="uppercase tracking-wide text-xs">{displayDate}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${isWeekend ? 'bg-green-200 text-green-800' : 'bg-indigo-200 text-indigo-800'}`}>
                        {count} orders
                    </span>
                </div>
            </div>
        );
    }

    // --- RENDER DATA ROW ---
    const row = item.data;
    const isPending = isRowPending(row.id);
    
    const rowClassName = `
        flex items-stretch 
        border-b border-slate-100/80
        transition-colors duration-150
        relative group
        ${item.rowBg}
        ${isViewingCompleted ? 'opacity-60 grayscale-[0.4]' : ''}
        border-l-[4px] ${item.leftBorderColor}
        ${!isLocked ? 'hover:z-20 hover:shadow-sm hover:bg-white' : ''}
    `;

    return (
        <div style={style} className={rowClassName} onClick={(e) => { 
            const target = e.target as HTMLElement;
            
            // 1. Nếu click vào các phần tử tương tác trực tiếp, dừng lại ngay
            if (target.closest('input, select, textarea, .rich-text-editor, button')) {
                return;
            }

            // 2. Kiểm tra xem có click vào ô có thể chỉnh sửa không
            const cell = target.closest('[data-readonly]');
            if (cell && cell.getAttribute('data-readonly') !== 'true') {
                return;
            }

            // 3. Nếu không phải ô chỉnh sửa, hoặc bảng đang bị khóa, mới mở modal
            setSelectedOrder(row); 
        }} onMouseEnter={() => handleFillEnter(index)}>
            <div className="w-[40px] flex-shrink-0 border-r border-slate-100/50 flex items-center justify-center text-[10px] text-slate-400 font-mono font-medium relative select-none bg-inherit group-hover:text-indigo-600 transition-colors sticky left-0 z-10">
                <span className="opacity-30">#</span>
                {isPending && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(251,146,60,0.5)]"></div>}
            </div>

            {columns.map((col: any) => {
                const width = colWidths[col.id] || col.defaultWidth;
                let content;
                const isSticky = col.id === 'orderCode';
                const stickyClass = isSticky ? 'sticky left-[40px] z-10 bg-inherit shadow-[2px_0_10px_-2px_rgba(0,0,0,0.05)] font-mono font-bold text-slate-700' : '';

                const isFillingThisField = fillSource && fillSource.field === col.id;
                const isWithinFillRange = isFillingThisField && fillCurrentIndex !== null && (
                    (index >= fillSource.index && index <= fillCurrentIndex) ||
                    (index <= fillSource.index && index >= fillCurrentIndex)
                );

                if (col.id === 'title') {
                    content = (
                      <div className="group/title relative h-full w-full">
                        <TextAreaCell 
                          value={String(row.title || '')} 
                          onChange={(e) => updateRow(row.id, 'title', e.target.value)} 
                          onCommit={(oldV, newV) => logChange(row.id, 'title', oldV, newV)} 
                          onFocus={() => setEditingCell({ id: row.id, field: 'title' })}
                          onBlur={handleCellBlur}
                          className="font-semibold text-gray-800" 
                          placeholder="Tiêu đề..." 
                          readOnly={isLocked} 
                        />
                        {row.content && ( <div className="absolute top-0 right-0 p-1 opacity-0 group-hover/title:opacity-100 transition-opacity"><TooltipCell displayValue="" tooltipContent={row.content} /></div> )}
                      </div>
                    );
                } else if (col.id === 'estimatedCost') {
                    content = <CostCell value={String(row.estimatedCost || '')} onClick={() => setCostModalData(row)} readOnly={isLocked} />;
                } else if (['category', 'status', 'platform', 'designer', 'department'].includes(col.id)) {
                    content = <SelectCell type={col.id} value={String(row[col.id] || '')} options={col.options || []} masterDataConfig={getConfigFromMaster(col.id)} onChange={(e) => updateRow(row.id, col.id, e.target.value, true)} onFocus={() => setEditingCell({ id: row.id, field: col.id })} onBlur={handleCellBlur} readOnly={isLocked} />;
                } else if (['orderer', 'productType', 'classType', 'stylist', 'videoPerson', 'photoPerson', 'ctvStylist', 'ctvVideo', 'ctvPhoto'].includes(col.id)) {
                    content = <DynamicListCell value={String(row[col.id] || '')} onChange={(val) => updateRow(row.id, col.id, val, true)} onFocus={() => setEditingCell({ id: row.id, field: col.id })} onBlur={handleCellBlur} options={getOptionsFromMaster(col.id)} masterDataConfig={getConfigFromMaster(col.id)} colorize={true} readOnly={isLocked} />;
                } else if (col.id === 'isConfirmed') {
                    content = <div className="flex items-center justify-center h-full"><CheckboxCell checked={!!row.isConfirmed} onChange={(e) => updateRow(row.id, 'isConfirmed', e.target.checked, true)} readOnly={isLocked} /></div>;
                } else if (col.isRichText) {
                    content = <RichTextCell value={String(row[col.id] || '')} onChange={(val) => updateRow(row.id, col.id, val, true)} onFocus={() => setEditingCell({ id: row.id, field: col.id })} onBlur={handleCellBlur} enableTooltip={col.id === 'trackingNote'} title={col.label} readOnly={isLocked} manualSave={true} />;
                } else if (['startDate', 'implementationDate', 'dueDate'].includes(col.id)) {
                    const isDeadline = col.id === 'dueDate';
                    const s = (row.status || '').toLowerCase();
                    let diffDays = 1000;
                    if (row.dueDate) {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const due = new Date(row.dueDate);
                        if (!isNaN(due.getTime())) {
                            due.setHours(0,0,0,0);
                            diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        }
                    }
                    let alertIcon = null;
                    if (isDeadline && row.dueDate && !s.includes('hoàn tất') && !s.includes('hủy') && !isEmptyRow(row)) {
                        if (diffDays < 0) alertIcon = <div className="absolute right-7 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center" title="Quá hạn"><AlertCircle size={14} className="text-red-600 animate-pulse bg-white/50 rounded-full" /></div>;
                        else if (diffDays >= 0 && diffDays <= 3) alertIcon = <div className="absolute right-7 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center" title="Sắp đến hạn (<= 3 ngày)"><AlertTriangle size={14} className="text-orange-600 bg-white/50 rounded-full" /></div>;
                    }

                    content = (
                        <div className="relative w-full h-full">
                            <DateCell value={String(row[col.id] || '')} onChange={(e) => updateRow(row.id, col.id, e.target.value, true)} onFocus={() => setEditingCell({ id: row.id, field: col.id })} onBlur={handleCellBlur} readOnly={isLocked} />
                            {alertIcon}
                        </div>
                    );
                } else if (col.isMultiline) {
                    content = <TextAreaCell value={String(row.title || '')} onChange={(e) => updateRow(row.id, 'title', e.target.value)} onCommit={(oldV, newV) => logChange(row.id, 'title', oldV, newV)} onFocus={() => setEditingCell({ id: row.id, field: 'title' })} onBlur={handleCellBlur} className="font-semibold text-gray-800" readOnly={isLocked} manualSave={true} />;
                } else {
                    let cellClassName = '';
                    if (col.id === 'title') cellClassName = 'font-semibold text-gray-800';
                    if (col.id === 'orderCode') cellClassName = 'font-mono font-bold text-slate-800 not-italic';
                    
                    content = <TextCell value={String(row[col.id] || '')} onChange={(e) => updateRow(row.id, col.id as keyof WorkOrder, e.target.value)} onCommit={(oldV, newV) => logChange(row.id, col.id as keyof WorkOrder, oldV, newV)} onFocus={() => setEditingCell({ id: row.id, field: col.id })} onBlur={handleCellBlur} isLink={col.id === 'productLink'} readOnly={isLocked || col.readOnly} className={cellClassName} />;
                }
                return (
                    <div 
                        key={col.id} 
                        style={{ width }} 
                        data-readonly={col.readOnly || isLocked} 
                        className={`flex-shrink-0 h-full border-r border-slate-100/50 p-1 relative group/cell ${(col.readOnly || isLocked) && !isSticky ? 'text-slate-400 font-medium' : ''} ${stickyClass} ${isWithinFillRange ? 'bg-indigo-50/50 ring-1 ring-indigo-300 ring-inset z-10' : 'bg-inherit'}`}
                        onMouseDown={(e) => {
                            // Ngăn chặn sự kiện mousedown lan lên row để tránh mất focus hoặc trigger nhầm
                            if (col.readOnly || isLocked) return;
                            e.stopPropagation();
                        }}
                    >
                        {content}
                        {!isLocked && !col.readOnly && !isEmptyRow(row) && (
                            <div 
                                className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-indigo-600 cursor-ns-resize opacity-0 group-hover/cell:opacity-100 z-30 shadow-sm border border-white"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleFillStart(row.id, col.id, row[col.id], index);
                                }}
                            />
                        )}
                    </div>
                );
            })}

            {viewMode === 'table' && !isLocked && (
                <div className="w-[40px] flex-shrink-0 flex items-center justify-center bg-inherit opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all hover:shadow-sm" title="Xóa hàng"><Trash2 size={14} /></button>
                </div>
            )}
        </div>
    );
}, areEqual);

export const WorkOrderTable: React.FC<WorkOrderTableProps> = ({ currentUser, currentUserName, userRole, isOwner = false, isAdmin = false, initialTabId, autoCreate, initialViewMode }) => {
  const { startSync, stopSync } = useSync();
  const [tabs, setTabs] = useState(getSheetTabs());
  const [data, setData] = useState<WorkOrder[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [masterData, setMasterData] = useState<MasterDataItem[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<Record<string, any[]>>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCode, setIsFetchingCode] = useState(false);
  const [isError, setIsError] = useState(false);
  
  // --- FILL HANDLE STATE ---
  const [fillSource, setFillSource] = useState<{ rowId: string, field: keyof WorkOrder, value: any, index: number } | null>(null);
  const [fillCurrentIndex, setFillCurrentIndex] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState(initialTabId || tabs[0].id);
  const [viewMode, setViewMode] = useState<'table' | 'tracking' | 'report'>(initialViewMode || 'table');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [createOrderInitial, setCreateOrderInitial] = useState<WorkOrder | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<WorkOrder | null>(null);
  const [costModalData, setCostModalData] = useState<WorkOrder | null>(null);
  const [toast, setToast] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isViewingCompleted, setIsViewingCompleted] = useState(false);
  const [completedDateRange, setCompletedDateRange] = useState('');
  
  // Report Filter States
  const now = new Date();
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'next_week' | 'this_month' | 'last_month' | 'this_year' | 'custom_range' | 'by_month'>('by_month');
  const [reportMonth, setReportMonth] = useState<number>(now.getMonth());
  const [reportYear, setReportYear] = useState<number>(now.getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(''); 
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const pendingUpdatesRef = useRef(pendingUpdates);
  useEffect(() => { pendingUpdatesRef.current = pendingUpdates; }, [pendingUpdates]);
  
  const [editingCell, setEditingCellState] = useState<{ id: string, field: string } | null>(null);
  const setEditingCell = useCallback((newCell: { id: string, field: string } | null) => {
    setEditingCellState(prev => {
      if (!prev && !newCell) return null;
      if (prev && newCell && prev.id === newCell.id && prev.field === newCell.field) return prev;
      return newCell;
    });
  }, []);
  const editingCellContextValue = useMemo(() => ({ editingCellData: editingCell, setEditingCell }), [editingCell, setEditingCell]);
  const editingCellRef = useRef<{ id: string, field: string } | null>(null);
  useEffect(() => { 

    editingCellRef.current = editingCell; 
  }, [editingCell]);

  const handleCellBlur = useCallback(() => {
    // console.log('handleCellBlur called');
    // Tăng timeout lên 150ms để đảm bảo onFocus của ô tiếp theo có thời gian chạy
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || 
          (active.tagName !== 'INPUT' && 
           active.tagName !== 'TEXTAREA' && 
           active.tagName !== 'SELECT' &&
           !active.closest('.rich-text-editor'))) {
        // console.log('handleCellBlur setting editingCell to null');
        setEditingCell(null);
      }
    }, 150);
  }, [setEditingCell]);

  const isAnyModalOpen = !!(selectedOrder || createOrderInitial || deleteModalData || costModalData || editingCell);
  const isInitialLoad = useRef(true);
  const prevActiveTab = useRef(activeTab);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }[]>(() => {
    const savedSort = localStorage.getItem(`WORK_ORDER_SORT_${activeTab}`);
    if (savedSort) {
      try {
        const parsed = JSON.parse(savedSort);
        // Handle migration from old single object format to array format
        if (parsed && !Array.isArray(parsed) && parsed.key) {
           return [parsed];
        }
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [isPreparingAutoCreate, setIsPreparingAutoCreate] = useState(autoCreate && !hasAutoOpened);

  const [userColumnSettings, setUserColumnSettings] = useState<any[] | null>(null);
  const dataRef = useRef<WorkOrder[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  const listOuterRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0); 

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

  const lastProcessedInitialTabId = useRef(initialTabId);
  const currentTabInfo = useMemo(() => tabs.find(t => String(t.id) === String(activeTab)) || tabs[0], [activeTab, tabs]);
  const isDesignTab = useMemo(() => currentTabInfo.name.includes('Design'), [currentTabInfo]);
  const currentPrefix = useMemo(() => isDesignTab ? 'Des' : 'Pro', [isDesignTab]);

  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    let interval: any;
    if (isLoading || isSyncing) {
      const start = Date.now();
      interval = setInterval(() => { setLoadingTime((Date.now() - start) / 1000); }, 100);
    } else { setLoadingTime(0); }
    return () => clearInterval(interval);
  }, [isLoading, isSyncing]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const key = `COL_SETTINGS_${isDesignTab ? 'DESIGN' : 'PROD'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try { setUserColumnSettings(JSON.parse(saved)); } catch (e) { setUserColumnSettings(null); }
    } else { setUserColumnSettings(null); }
  }, [isDesignTab]);

  const handleSaveColumns = (newSettings: any[]) => {
    const key = `COL_SETTINGS_${isDesignTab ? 'DESIGN' : 'PROD'}`;
    localStorage.setItem(key, JSON.stringify(newSettings));
    setUserColumnSettings(newSettings);
  };

  const handleResetColumns = () => {
    const key = `COL_SETTINGS_${isDesignTab ? 'DESIGN' : 'PROD'}`;
    localStorage.removeItem(key);
    setUserColumnSettings(null);
  };

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

  const isSystemLocked = useMemo(() => {
    if (userRole === 'collaborator') return true;
    const { vnNowMs, vnDay } = getVNTimeInfo();
    const isThursdayVN = vnDay === 4;
    const settingKey = isDesignTab ? 'DESIGN_STATUS' : 'PRODUCTION_STATUS';
    const statusItem = masterData.find(i => i.listKey === 'SYSTEM_CONFIG' && String(i.value || '').trim().toUpperCase() === settingKey);
    const rawValue = String(statusItem?.color || 'AUTO').trim().toUpperCase();
    const [statusType, val1, val2] = rawValue.split('|');
    
    // Chỉ log khi thực sự cần thiết để tránh làm chậm hệ thống
    // console.log('isSystemLocked debug:', { statusType, val1, val2 });
    
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
    
    // Member role is locked in AUTO mode
    if (statusType === 'AUTO') {
        if (userRole === 'member') return true;
        return !isThursdayVN;
    }
    
    return false;
  }, [masterData, isDesignTab, getVNTimeInfo, userRole]);

  const isLocked = isAdmin ? false : isSystemLocked;

  const lockStatusMessage = useMemo(() => {
    if (userRole === 'collaborator') return "Bạn đang ở chế độ xem cá nhân (Không có quyền chỉnh sửa)";
    const { vnNowMs, vnDay, vnEndOfDayMs } = getVNTimeInfo();
    const isThursdayVN = vnDay === 4;
    const settingKey = isDesignTab ? 'DESIGN_STATUS' : 'PRODUCTION_STATUS';
    const statusItem = masterData.find(i => i.listKey === 'SYSTEM_CONFIG' && String(i.value || '').trim().toUpperCase() === settingKey);
    if (!masterData.length && isLoading) return "Đang kiểm tra trạng thái hệ thống...";
    const rawValue = String(statusItem?.color || 'AUTO').trim().toUpperCase();
    const [statusType, val1, val2] = rawValue.split('|');
    const tableName = isDesignTab ? 'Design' : 'Production';

    if (statusType === 'SCHEDULED' && val1 && val2) {
        const start = parseInt(val1, 10);
        const end = parseInt(val2, 10);
        if (!isNaN(start) && !isNaN(end)) {
            if (vnNowMs < start) return `Bảng ${tableName} sẽ mở vào: ${new Date(start).toLocaleString('vi-VN')}`;
            if (vnNowMs <= end) return `Bảng ${tableName} đang mở (Đến: ${new Date(end).toLocaleString('vi-VN')})`;
            return `Bảng ${tableName} đã hết hạn mở theo lịch`;
        }
    }

    if (statusType === 'LOCKED') return `Bảng ${tableName} đang bị KHÓA bởi Admin.`;
    if (statusType === 'OPEN') {
        if (!val1) return `Bảng ${tableName} đang MỞ (Vô thời hạn).`;
        const expiry = parseInt(val1, 10);
        const diffMs = expiry - vnNowMs;
        return diffMs <= 0 ? `Bảng ${tableName} đã HẾT HẠN mở.` : `Bảng ${tableName} đang MỞ (Còn ${formatCountdown(diffMs)}).`;
    }
    if (statusType === 'AUTO') {
        if (isThursdayVN) return `Bảng ${tableName} đang MỞ (Thứ 5 AUTO - Còn ${formatCountdown(vnEndOfDayMs - vnNowMs)}).`;
        return `Bảng ${tableName} đang KHÓA (Tự động mở vào Thứ 5).`;
    }
    return `Bảng ${tableName} đang ở trạng thái mặc định (AUTO).`;
  }, [masterData, isDesignTab, getVNTimeInfo, tick, isLoading, userRole]);

  useEffect(() => {
     if (initialTabId && initialTabId !== lastProcessedInitialTabId.current) {
         setActiveTab(initialTabId);
         lastProcessedInitialTabId.current = initialTabId;
         if (autoCreate) { setHasAutoOpened(false); setIsPreparingAutoCreate(true); }
     }
  }, [initialTabId, autoCreate]);

  useLayoutEffect(() => {
      const syncHeader = () => { if (headerRef.current && listOuterRef.current) { headerRef.current.scrollLeft = listOuterRef.current.scrollLeft; } };
      syncHeader();
      requestAnimationFrame(syncHeader);
      const listEl = listOuterRef.current;
      if (listEl) { listEl.addEventListener('scroll', syncHeader); }
      return () => { if (listEl) listEl.removeEventListener('scroll', syncHeader); };
  }, [viewMode, activeTab, data.length, zoomLevel]);

  const [filters, setFilters] = useState<Record<string, any>>(DEFAULT_FILTERS);
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const lastLoadedFiltersRef = useRef(filters);
  const lastLoadedTabRef = useRef(activeTab);
  const lastLoadedViewSettingsRef = useRef({
    isViewingCompleted,
    completedDateRange,
    viewMode,
    reportMonth,
    reportYear,
    timeRange
  });

  const hasActiveFilters = useMemo(() => {
    const hasFilters = Object.entries(filters).some(([key, value]) => {
      if (key === 'global') return !!value;
      if (Array.isArray(value)) return value.length > 0;
      return !!value;
    });
    return hasFilters || sortConfig.length > 0;
  }, [filters, sortConfig]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSortConfig([]);
    localStorage.removeItem(`WORK_ORDER_FILTERS_${activeTab}`);
    localStorage.removeItem(`WORK_ORDER_SORT_${activeTab}`);
    setToast({ type: 'success', message: 'Đã xóa toàn bộ bộ lọc và sắp xếp' });
  }, [activeTab]);

  const loadData = async (gid: string, isSilent: boolean = false, isLoadMore: boolean = false, pageSize: number = 10000, filtersToUse = filtersRef.current) => {
    // Nếu đang chỉnh sửa, tuyệt đối không loadData để tránh ghi đè và nháy
    if (editingCellRef.current && !isLoadMore) {
      return;
    }
    

    const CACHE_KEY = `WORK_ORDER_CACHE_${gid}`;
    
    // Chỉ lấy cache khi không phải là load thêm và không có thay đổi chưa lưu
    if (!isLoadMore && pendingUpdates.size === 0) {
        const cached = safeLocalStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setData(parsed);
                    if (!isSilent) startSync();
                } else { if (!isSilent) setIsLoading(true); }
            } catch (e) { if (!isSilent) setIsLoading(true); }
        } else { if (!isSilent) setIsLoading(true); }
    }
    
    try {
      // Fetch data independently to avoid one failure blocking the other
      let masterDataList: MasterDataItem[] = [];
      if (!isLoadMore) {
          try {
            masterDataList = await fetchMasterData();
          } catch (masterErr) {
            console.error("Error fetching master data:", masterErr);
            if (!isSilent) setToast({ type: 'error', message: 'Không thể tải danh mục dữ liệu' });
          }
      }

      let sheetData: WorkOrder[] = [];
      let nextLastDoc = null;
      let hasMore = false;
      try {
        if (!isSilent) setIsLoading(true);
        
        // Prepare filters for server-side
        const finalFilters = { ...filtersToUse };
        if (viewMode === 'report') {
          if (timeRange === 'by_month') {
            finalFilters.reportMonth = reportMonth;
            finalFilters.reportYear = reportYear;
          }
          // In report mode, we don't want to exclude anything
        } else if (isViewingCompleted) {
          finalFilters.status = 'Hoàn tất';
          if (completedDateRange) {
            const [start, end] = completedDateRange.split('|');
            finalFilters.startDate = start;
            finalFilters.endDate = end;
          }
        } else {
          finalFilters.excludeStatus = 'Hoàn tất';
        }

        const result = await fetchSheetData(gid, isLoadMore ? lastDoc : null, pageSize, finalFilters);
        sheetData = result.data;
        nextLastDoc = result.lastDoc;
        hasMore = result.hasMore;
        
        if (!isSilent) {
            if (sheetData.length === 0) {
                setToast({ type: 'info', message: 'Đã tải hết dữ liệu' });
            } else {
                setToast({ type: 'success', message: `Đã tải ${isLoadMore ? 'thêm ' : ''}${sheetData.length} đơn hàng` });
            }
        }
      } catch (sheetErr: any) {
        console.error("Error fetching sheet data:", sheetErr);
        if (!isSilent) {
          if (sheetErr.indexUrl) {
            setToast({ 
              type: 'error', 
              message: `Thiếu index Firestore. Vui lòng click vào đây để tạo: ${sheetErr.indexUrl}` 
            });
          } else {
            setToast({ 
              type: 'error', 
              message: `Lỗi tải dữ liệu bảng: ${sheetErr instanceof Error ? sheetErr.message : 'Không xác định'}` 
            });
          }
        }
        throw sheetErr; // Re-throw to handle in catch block
      } finally {
        if (!isSilent) setIsLoading(false);
      }


      // Chỉ cập nhật masterData nếu có thay đổi thực sự
      if (masterDataList.length > 0) {
        setMasterData(prev => {
          if (JSON.stringify(prev) === JSON.stringify(masterDataList)) return prev;
          return masterDataList;
        });
      }
      
      const processedData = sheetData.map((row) => ({ ...row, orderCode: row.orderCode || '' }));
      
      setData(prev => {
          const prevDataMap = new Map<string, WorkOrder>(prev.map(item => [item.id, item]));
          
          if (!isLoadMore) {
              // Replace scenario: Keep references if content hasn't changed or if local has content while server is empty
              const nextData = processedData.map(item => {
                  const prevItem = prevDataMap.get(item.id);
                  const isPending = pendingUpdatesRef.current.has(item.id);
                  
                  // Focus-based prevention: If this row is being edited, keep local version
                  const isBeingEdited = editingCellRef.current && editingCellRef.current.id === item.id;
                  
                  // Critical Fix: If local has title/content but server is empty, keep local (likely Firestore indexing lag)
                  const hasLocalContent = prevItem && (String(prevItem.title || '').trim() || String(prevItem.content || '').trim());
                  const isServerEmpty = !String(item.title || '').trim() && !String(item.content || '').trim();
                  
                  if (prevItem && (isPending || isBeingEdited || (hasLocalContent && isServerEmpty) || JSON.stringify(prevItem) === JSON.stringify(item))) {
                      return prevItem;
                  }
                  return item;
              });
              
              if (JSON.stringify(prev) === JSON.stringify(nextData)) return prev;
              return nextData;
          } else {
              // Load more scenario: Append new items only
              const appendedData = processedData.filter(item => !prevDataMap.has(item.id));
              
              if (appendedData.length === 0) return prev;
              
              return [...prev, ...appendedData];
          }
      });
      setLastDoc(nextLastDoc);
      setHasMore(hasMore);
      
      // Update last loaded state to prevent redundant reloads
      lastLoadedFiltersRef.current = filtersToUse;
      lastLoadedTabRef.current = gid;
      lastLoadedViewSettingsRef.current = {
        isViewingCompleted,
        completedDateRange,
        viewMode,
        reportMonth,
        reportYear,
        timeRange
      };
      
      if (!isLoadMore && processedData.length === 0 && !isSilent && data.length === 0) {
         const prefix = isDesignTab ? 'Des' : 'Pro';
         setData([createEmptyRow(`${prefix}001`)]);
      }
      if (!isSilent) { setToast({ type: 'success', message: 'Dữ liệu đã được đồng bộ mới nhất' }); }
    } catch (err: any) {
      console.error("Error in loadData:", err);
      if (!isSilent) {
        setToast({ type: 'error', message: `Lỗi tải dữ liệu: ${err.message}` });
        if (data.length === 0) {
            setIsError(true);
            const prefix = isDesignTab ? 'Des' : 'Pro';
            setData([createEmptyRow(`${prefix}001`)]);
        }
      }
    } finally { 
      setIsLoading(false); 
      stopSync(); 
    }
  };

  // Handle scroll for infinite loading
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: { scrollOffset: number, scrollDirection: string }) => {
      if (scrollDirection === 'forward' && hasMore && !isLoading && listOuterRef.current) {
          const { scrollHeight, clientHeight } = listOuterRef.current;
          // Thêm ngưỡng an toàn và kiểm tra isLoading để tránh gọi trùng lặp
          if (scrollHeight - scrollOffset - clientHeight < 200) {
              if (!isAnyModalOpen) {
                  setIsLoading(true); // Đặt loading ngay lập tức
                  loadData(activeTab, true, true);
              }
          }
      }
  }, [hasMore, isLoading, activeTab, isAnyModalOpen, loadData]);

  useEffect(() => {
    // 1. Load saved filters for this tab
    const savedFilters = localStorage.getItem(`WORK_ORDER_FILTERS_${activeTab}`);
    let newFilters = DEFAULT_FILTERS;
    if (savedFilters) {
      try {
        newFilters = { ...DEFAULT_FILTERS, ...JSON.parse(savedFilters) };
      } catch (e) {
        newFilters = DEFAULT_FILTERS;
      }
    }
    setFilters(newFilters);

    // 2. Load data using the new filters
    if (!isAnyModalOpen) loadData(activeTab, false, false, 10000, newFilters);
    
    if (listOuterRef.current) listOuterRef.current.scrollTo({ top: 0, left: 0 });
  }, [activeTab, isViewingCompleted, completedDateRange]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (prevActiveTab.current !== activeTab) {
        isInitialLoad.current = true;
        prevActiveTab.current = activeTab;
    }
    const timeout = setTimeout(() => {
      localStorage.setItem(`WORK_ORDER_FILTERS_${activeTab}`, JSON.stringify(filters));
      // Tải lại dữ liệu từ trang 1 khi bộ lọc thay đổi, nhưng tránh gọi trùng lặp với useEffect khởi tạo
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }
      // Chỉ loadData nếu không đang mở modal và không đang chỉnh sửa
      if (!isAnyModalOpen) {
        const filtersChanged = JSON.stringify(lastLoadedFiltersRef.current) !== JSON.stringify(filters);
        const tabChanged = lastLoadedTabRef.current !== activeTab;
        
        if (filtersChanged || tabChanged) {

          loadData(activeTab, false, false);
        }
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [filters, activeTab, isAnyModalOpen]); 

  // Save sort config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`WORK_ORDER_SORT_${activeTab}`, JSON.stringify(sortConfig));
  }, [sortConfig, activeTab]);

  useEffect(() => {
    if (!isInitialLoad.current && !isAnyModalOpen) {
      const settingsChanged = 
        lastLoadedViewSettingsRef.current.isViewingCompleted !== isViewingCompleted ||
        lastLoadedViewSettingsRef.current.completedDateRange !== completedDateRange ||
        lastLoadedViewSettingsRef.current.viewMode !== viewMode ||
        lastLoadedViewSettingsRef.current.reportMonth !== reportMonth ||
        lastLoadedViewSettingsRef.current.reportYear !== reportYear ||
        lastLoadedViewSettingsRef.current.timeRange !== timeRange;

      if (settingsChanged) {

        loadData(activeTab, false, false);
      }
    }
  }, [isViewingCompleted, completedDateRange, viewMode, reportMonth, reportYear, timeRange, isAnyModalOpen]);

  // Load sort config when activeTab changes
  useEffect(() => {
    const savedSort = localStorage.getItem(`WORK_ORDER_SORT_${activeTab}`);
    if (savedSort) {
      try {
        const parsed = JSON.parse(savedSort);
        if (parsed && !Array.isArray(parsed) && parsed.key) {
           setSortConfig([parsed]);
        } else {
           setSortConfig(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        setSortConfig([]);
      }
    } else {
      setSortConfig([]);
    }
  }, [activeTab]);

  useEffect(() => {
      const interval = setInterval(() => {
          if (!isSaving && !isSyncing && pendingUpdates.size === 0 && !isAnyModalOpen && document.visibilityState === 'visible') {
              if (!isAnyModalOpen) loadData(activeTab, true, false, 10000);
          }
      }, 300000); 
      return () => clearInterval(interval);
  }, [activeTab, isSaving, isSyncing, pendingUpdates.size, isAnyModalOpen]);

  const getOptionsFromMaster = useCallback((key: string): string[] => {
      const dynamicOptions = masterData.filter(i => i.listKey === key).map(i => i.value);
      const hardcodedOptions = HARDCODED_LISTS[key] || [];
      
      // Lấy thêm các giá trị thực tế đang có trong bảng (bao gồm cả giá trị nhập tay không có trong danh mục)
      const rawValues = data.map(row => String(row[key as keyof WorkOrder] || '').trim());
      const hasEmpty = rawValues.some(v => v === '');
      const actualValues = rawValues.filter(val => val !== '');
      
      let allOptions = Array.from(new Set([...hardcodedOptions, ...dynamicOptions, ...actualValues]));
      
      if (key === 'category') {
          if (isDesignTab) allOptions = allOptions.filter(opt => opt.trim().toLowerCase() === 'design' || opt.trim().toLowerCase() === 'animation');
          else allOptions = allOptions.filter(opt => opt.trim().toLowerCase() !== 'design' && opt.trim().toLowerCase() !== 'animation');
      }
      
      // Luôn giữ "(Trống)" nếu nó đang được chọn trong bộ lọc, hoặc nếu dữ liệu hiện tại có giá trị trống
      const isSelected = Array.isArray(filters[key]) && (filters[key] as string[]).includes("(Trống)");
      const finalOptions = (hasEmpty || isSelected) ? ["(Trống)", ...allOptions] : allOptions;
      return Array.from(new Set(finalOptions));
  }, [masterData, isDesignTab, data, filters]);

  const getConfigFromMaster = useCallback((key: string): MasterDataItem[] => {
      const dynamicConfigs = masterData.filter(i => i.listKey === key);
      const hardcodedValues = HARDCODED_LISTS[key] || [];
      const hardcodedConfigs: MasterDataItem[] = hardcodedValues.map((val, idx) => ({ id: `sys-${key}-${idx}`, listKey: key, value: val, isSystem: true }));
      return [...hardcodedConfigs, ...dynamicConfigs];
  }, [masterData]);

  const isSavingRef = useRef(false);

  const debouncedSaveAll = useMemo(() => debounce(async (tab: string) => {
    if (isSavingRef.current) return;
    
    const currentPending = pendingUpdatesRef.current;
    if (currentPending.size === 0) return;
    
    isSavingRef.current = true;
    setIsSaving(true);
    startSync();
    
    try {
      const idsToSave = Array.from(currentPending);
      
      // Filter out rows that are currently being edited
      const rowsToSave = dataRef.current.filter(r => {
        if (!idsToSave.includes(r.id)) return false;
        if (editingCellRef.current && editingCellRef.current.id === r.id) return false;
        return true;
      });
      
      if (rowsToSave.length === 0) {
        isSavingRef.current = false;
        setIsSaving(false);
        stopSync();
        return;
      }
      
      // Save rows sequentially to ensure consistency
      for (const row of rowsToSave) {
        await saveWorkOrder(row, tab);
        setPendingUpdates(prev => {
          const next = new Set(prev);
          next.delete(row.id);
          pendingUpdatesRef.current = next; // Sync ref immediately
          return next;
        });
      }
      
      localStorage.setItem(`WORK_ORDER_CACHE_${tab}`, JSON.stringify(dataRef.current));
      // Removed auto-save success toast to avoid annoying user
    } catch (err) { 
        console.error("Lỗi khi lưu:", err); 
        setToast({ type: 'error', message: 'Lỗi khi tự động lưu dữ liệu' });
    } finally {
        isSavingRef.current = false;
        setIsSaving(false);
        stopSync();
        
        // If more updates came in while we were saving, trigger another save
        if (pendingUpdatesRef.current.size > 0) {
          debouncedSaveAll(tab);
        }
    }
  }, 3000), [startSync, stopSync]);


  const updateRow = useCallback((id: string, field: keyof WorkOrder, value: any, shouldLog: boolean = false) => {

    if (isLocked) return;
    const currentRow = dataRef.current.find(r => r.id === id);
    if (!currentRow) {

        return;
    }
    
    // Skip if value is the same
    if (String(currentRow[field] || '') === String(value || '')) {

        return;
    }

    const fieldNames: Record<string, string> = { title: 'Tiêu đề', content: 'Nội dung Brief', department: 'Phòng ban', startDate: 'Ngày Order', dueDate: 'Deadline', implementationDate: 'Ngày triển khai', status: 'Trạng thái', estimatedCost: 'Chi phí', category: 'Loại Order', productType: 'Cate Hàng', classType: 'Phân loại', productLink: 'Link SP', trackingNote: 'Ghi chú', orderer: 'Người order' };
    const label = fieldNames[field as string] || field;
    let displayValue = value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) {
        const [datePart, timePart] = value.split('T');
        const parts = datePart.split('-'); 
        if (parts.length === 3) {
            displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
            if (timePart) displayValue = `${timePart} - ${displayValue}`;
        }
    }
    logActivity('UPDATE', currentRow.orderCode, `Cập nhật ${label}: ${displayValue}`);
    
    // Mark as pending immediately and sync ref
    setPendingUpdates(prev => {
      const next = new Set(prev).add(id);
      pendingUpdatesRef.current = next;
      return next;
    });

    setData((prev) => {
      const next = prev.map((row) => {
        if (row.id !== id) return row;
        const updatedRow = { ...row, [field]: value };
        if (field === 'content' && value && String(value).trim() !== '' && !updatedRow.startDate) {
          const today = new Date(); updatedRow.startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }
        if (shouldLog && String(row[field]) !== String(value) && !isEmptyRow(row)) {
          updatedRow.historyLogs = [{ timestamp: new Date().toLocaleString('vi-VN'), field: String(field), oldValue: String(row[field]), newValue: String(value), user: currentUser || 'User' }, ...(row.historyLogs || [])];
        }
        
        return updatedRow;
      });
      dataRef.current = next; // Sync ref immediately
      return next;
    });

    // Trigger debounced save for all pending (outside setData)
    if (field !== 'orderCode') {
      debouncedSaveAll(activeTab);
    }
  }, [currentUser, isLocked, debouncedSaveAll, activeTab]);

  const logChange = useCallback((id: string, field: keyof WorkOrder, oldValue: string, newValue: string) => { 
    if (isLocked) return; 
    if (String(oldValue) === String(newValue)) return; 
    setData((prev) => {
      const next = prev.map((row) => { 
        if (row.id !== id || isEmptyRow(row)) return row; 
        return { ...row, historyLogs: [{ timestamp: new Date().toLocaleString('vi-VN'), field: String(field), oldValue: String(oldValue), newValue: String(newValue), user: currentUser || 'User' }, ...(row.historyLogs || [])] }; 
      });
      dataRef.current = next; // Sync ref immediately
      return next;
    }); 
    setPendingUpdates(prev => {
      const next = new Set(prev).add(id);
      pendingUpdatesRef.current = next; // Sync ref immediately
      return next;
    });
    debouncedSaveAll(activeTab);
  }, [currentUser, isLocked, activeTab, debouncedSaveAll]);
  
  const handleDeleteClick = useCallback((row: WorkOrder) => { if (isLocked) return; isEmptyRow(row) ? executeDelete(row.id) : setDeleteModalData(row); }, [isLocked]);
  const handleConfirmDelete = () => { if (isLocked) return; if (deleteModalData) { executeDelete(deleteModalData.id); setDeleteModalData(null); } };
  const executeDelete = async (id: string) => { 
      if (isLocked) return; const rowToDelete = data.find(r => r.id === id); const previousData = [...data]; setData(prev => prev.filter(row => row.id !== id)); setPendingUpdates(prev => { const next = new Set(prev); next.delete(id); return next; }); 
      try { 
          await deleteWorkOrder(id, activeTab); 
          if (rowToDelete) { 
              logActivity('DELETE', rowToDelete.orderCode, `Xóa Order. Tiêu đề: ${rowToDelete.title}`); 
          }
          setToast({ type: 'success', message: 'Đã xóa Order thành công' });
      } catch (err) { 
          setData(previousData); 
          setToast({ type: 'error', message: 'Lỗi khi xóa Order' });
      } 
  };

  // --- ADDED HANDLERS TO FIX REFERENCE ERRORS ---
  const handleUpdateOrder = useCallback((updatedOrder: WorkOrder) => {
    if (isLocked) return;
    setData(prev => {
      const next = prev.map(row => row.id === updatedOrder.id ? updatedOrder : row);
      dataRef.current = next; // Sync ref immediately
      return next;
    });
    setPendingUpdates(prev => {
      const next = new Set(prev).add(updatedOrder.id);
      pendingUpdatesRef.current = next; // Sync ref immediately
      return next;
    });
    
    // Trigger save immediately for modal updates
    debouncedSaveAll(activeTab);
    
    setToast({ type: 'success', message: 'Đã cập nhật Order' });
    setSelectedOrder(null);
  }, [isLocked, activeTab, debouncedSaveAll]);

  const handleSaveNewOrder = useCallback(async (newOrder: WorkOrder) => {
    if (isLocked) return;
    
    // Final check for duplicates before adding to local state
    const isDuplicate = data.some(r => r.orderCode && r.orderCode.trim().toUpperCase() === newOrder.orderCode.trim().toUpperCase() && r.id !== newOrder.id);
    if (isDuplicate) {
        setToast({ type: 'error', message: 'Mã Order đã tồn tại! Vui lòng thử lại.' });
        return;
    }

    // Mark as pending BEFORE saving to Firestore to prevent loadData from overwriting with empty data
    setPendingUpdates(prev => new Set(prev).add(newOrder.id));

    // Save to Firebase
    try {
        await saveWorkOrder(newOrder, String(activeTab));
    } catch (error) {
        console.error("Failed to save new order:", error);
        setToast({ type: 'error', message: 'Lỗi khi lưu Order mới vào hệ thống.' });
        // Remove from pending if failed
        setPendingUpdates(prev => {
            const next = new Set(prev);
            next.delete(newOrder.id);
            return next;
        });
        return;
    }

    // Update local state: replace the draft with the finalized order
    setData(prev => {
        const index = prev.findIndex(r => r.id === newOrder.id);
        let next;
        if (index >= 0) {
            next = [...prev];
            next[index] = { ...newOrder, isDraft: false };
        } else {
            next = [{ ...newOrder, isDraft: false }, ...prev];
        }
        dataRef.current = next;
        return next;
    });

    logActivity('CREATE', newOrder.orderCode, `Tạo Order mới: ${newOrder.title}`);
    setToast({ type: 'success', message: 'Đã tạo Order mới' });
    setCreateOrderInitial(null);

    // Clear from pending updates after a short delay to ensure Firestore index is ready
    setTimeout(() => {
        setPendingUpdates(prev => {
            const next = new Set(prev);
            next.delete(newOrder.id);
            return next;
        });
    }, 5000);
  }, [data, isLocked, activeTab]);

  const handleCostChange = useCallback((totalCost: string, details: CostDetails) => {
    if (isLocked || !costModalData) return;
    const updatedOrder = { ...costModalData, estimatedCost: totalCost, costDetails: details };
    const oldCost = costModalData.estimatedCost || '0';
    if (oldCost !== totalCost) {
        updatedOrder.historyLogs = [{
            timestamp: new Date().toLocaleString('vi-VN'),
            field: 'Chi phí',
            oldValue: oldCost,
            newValue: totalCost,
            user: currentUser || 'User'
        }, ...(updatedOrder.historyLogs || [])];
        logActivity('UPDATE', updatedOrder.orderCode, `Cập nhật chi phí: ${totalCost}`);
    }
    
    setData(prev => {
      const next = prev.map(row => row.id === updatedOrder.id ? updatedOrder : row);
      dataRef.current = next;
      return next;
    });
    
    setPendingUpdates(prev => {
      const next = new Set(prev).add(updatedOrder.id);
      pendingUpdatesRef.current = next;
      return next;
    });

    debouncedSaveAll(activeTab);
    setToast({ type: 'success', message: 'Đã cập nhật chi phí thành công' });
    setCostModalData(null);
  }, [costModalData, currentUser, isLocked, activeTab, debouncedSaveAll]);

  const handleSort = (key: string, e: React.MouseEvent) => {
    setSortConfig(prev => {
      const isShiftPressed = e.shiftKey;
      const existingIndex = prev.findIndex(c => c.key === key);
      
      if (isShiftPressed) {
        // Multi-sort mode
        if (existingIndex >= 0) {
          // Toggle direction or remove if already desc
          const currentDir = prev[existingIndex].direction;
          if (currentDir === 'asc') {
            const newConfig = [...prev];
            newConfig[existingIndex] = { key, direction: 'desc' };
            return newConfig;
          } else {
            return prev.filter((_, i) => i !== existingIndex);
          }
        } else {
          // Add new sort criteria
          return [...prev, { key, direction: 'asc' }];
        }
      } else {
        // Single sort mode (replace existing)
        if (existingIndex === 0 && prev.length === 1) {
           // Toggle direction if it's the only one
           return [{ key, direction: prev[0].direction === 'asc' ? 'desc' : 'asc' }];
        }
        return [{ key, direction: 'asc' }];
      }
    });
  };

  const filteredData = useMemo(() => {
    let sorted = [...data];

    // --- COLLABORATOR PERMISSION FILTER ---
    if (userRole === 'collaborator') {
       const userEmail = (currentUser || '').toLowerCase().trim();
       const userName = (currentUserName || '').toLowerCase().trim();

       
       sorted = sorted.filter(row => {
           if (isEmptyRow(row)) return false; 

           const check = (val: string | undefined, fieldName: string) => {
               if (!val) return false;
               const v = String(val).toLowerCase().trim();
               const uN = (userName || '').toLowerCase().trim();
               const uE = (userEmail || '').toLowerCase().trim();
               
               if (!v) return false;

               // Match if user name/email are in the field OR if user name/email contains the field value (prefix match)
               const isMatch = (uN && v.includes(uN)) || (uE && v.includes(uE));
               const isRev = (uN && uN.includes(v) && v.length > 3) || (uE && uE.includes(v) && v.length > 3);

               return isMatch || isRev;
           };

           return check(row.orderer, 'orderer') || 
                  check(row.stylist, 'stylist') || 
                  check(row.videoPerson, 'videoPerson') || 
                  check(row.photoPerson, 'photoPerson') || 
                  check(row.designer, 'designer') || 
                  check(row.ctvStylist, 'ctvStylist') || 
                  check(row.ctvVideo, 'ctvVideo') || 
                  check(row.ctvPhoto, 'ctvPhoto');
       });
    }
    // --------------------------------------

    const filtered = sorted.filter(row => {
        if (filters.global) { const term = filters.global.toLowerCase(); const rowStr = Object.values(row).join(' ').toLowerCase(); if (!rowStr.includes(term)) return false; }
        for (const key of Object.keys(filters)) {
            if (key === 'global') continue;
            const filterValue = filters[key]; const rowValue = String(row[key as keyof WorkOrder] || '');
            if (Array.isArray(filterValue)) { 
                if (filterValue.length > 0) {
                    const isMatch = filterValue.includes(rowValue) || (rowValue === '' && filterValue.includes('(Trống)'));
                    if (!isMatch) return false;
                }
            } 
            else if (typeof filterValue === 'string' && filterValue.includes('|')) {
                const [start, end] = filterValue.split('|'); if (!rowValue) return false;
                const d = new Date(rowValue); if (start && new Date(start) > d) return false; if (end && new Date(end) < d) return false;
            } else if (filterValue && !rowValue.toLowerCase().includes(String(filterValue).toLowerCase())) { return false; }
        }
        return true;
    });
    if (sortConfig.length > 0) {
        filtered.sort((a, b) => {
           for (const config of sortConfig) {
               const key = config.key as keyof WorkOrder;
               const valA = String(a[key] || '').toLowerCase().trim();
               const valB = String(b[key] || '').toLowerCase().trim();
               
               if (valA === valB) continue; // Move to next criteria if equal
               
               if (key === 'estimatedCost') { 
                   const numA = parseFloat(valA.replace(/[^0-9.-]+/g,"")) || 0; 
                   const numB = parseFloat(valB.replace(/[^0-9.-]+/g,"")) || 0; 
                   return config.direction === 'asc' ? numA - numB : numB - numA; 
               }
               
               if (valA < valB) return config.direction === 'asc' ? -1 : 1; 
               if (valA > valB) return config.direction === 'asc' ? 1 : -1;
           }
           return 0; // All criteria equal
        });
    } else { filtered.sort((a, b) => (b.orderCode || '').localeCompare((a.orderCode || ''), undefined, { numeric: true, sensitivity: 'base' })); }
    return filtered;
  }, [data, sortConfig, filters, userRole, currentUser, currentUserName]);

  const groupedData = useMemo<TableItem[]>(() => {
      const dateSortKeys = ['startDate', 'implementationDate', 'dueDate'];
      // Grouping only applies if the PRIMARY sort is a date
      const isDateSorted = sortConfig.length > 0 && dateSortKeys.includes(sortConfig[0].key);
      if (!isDateSorted) return filteredData.map(d => {
          const { rowBg, leftBorderColor } = getRowStyles(d);
          return { type: 'row', data: d, id: d.id, rowBg, leftBorderColor };
      });
      const sortKey = sortConfig[0].key as keyof WorkOrder;
      const grouped: TableItem[] = [];
      let lastDate = '###'; 
      let currentGroup: RowItem[] = [];
      const flushGroup = () => {
          if (currentGroup.length > 0) {
              const firstDate = String(currentGroup[0].data[sortKey] || '');
              let displayDate = 'Chưa xác định ngày'; let isWeekend = false;
              if (firstDate) {
                  const d = new Date(firstDate);
                  if (!isNaN(d.getTime())) {
                      const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                      displayDate = `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}`;
                      isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  }
              }
              grouped.push({ type: 'header', date: firstDate, displayDate, count: currentGroup.length, isWeekend, id: `header-${firstDate}-${currentGroup.length}` });
              grouped.push(...currentGroup); currentGroup = [];
          }
      };
      filteredData.forEach(row => {
          if (isEmptyRow(row)) return;
          const dateVal = String(row[sortKey] || '');
          if (dateVal !== lastDate) { flushGroup(); lastDate = dateVal; }
          const { rowBg, leftBorderColor } = getRowStyles(row);
          currentGroup.push({ type: 'row', data: row, id: row.id, rowBg, leftBorderColor });
      });
      flushGroup(); 
      filteredData.filter(r => isEmptyRow(r)).forEach(r => {
          const { rowBg, leftBorderColor } = getRowStyles(r);
          grouped.push({ type: 'row', data: r, id: r.id, rowBg, leftBorderColor });
      });
      return grouped;
  }, [filteredData, sortConfig]);

  // --- FILL HANDLE HANDLERS ---
  const handleFillStart = useCallback((rowId: string, field: keyof WorkOrder, value: any, index: number) => {
    if (isLocked) return;
    setFillSource({ rowId, field, value, index });
    setFillCurrentIndex(index);
  }, [isLocked]);

  const handleFillEnter = useCallback((index: number) => {
    if (fillSource) {
      setFillCurrentIndex(index);
    }
  }, [fillSource]);

  const handleFillEnd = useCallback(() => {
    if (fillSource && fillCurrentIndex !== null) {
      const startIdx = Math.min(fillSource.index, fillCurrentIndex);
      const endIdx = Math.max(fillSource.index, fillCurrentIndex);
      
      const rowsToUpdate: string[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const item = groupedData[i];
        if (item && item.type === 'row' && !isEmptyRow(item.data)) {
          rowsToUpdate.push(item.data.id);
        }
      }

      if (rowsToUpdate.length > 0) {
        setData(prev => {
          const next = prev.map(row => {
            if (rowsToUpdate.includes(row.id)) {
              const oldValue = row[fillSource.field];
              const newValue = fillSource.value;
              
              if (String(oldValue) !== String(newValue)) {
                const updatedRow = { ...row, [fillSource.field]: newValue };
                updatedRow.historyLogs = [{ 
                  timestamp: new Date().toLocaleString('vi-VN'), 
                  field: String(fillSource.field), 
                  oldValue: String(oldValue), 
                  newValue: String(newValue), 
                  user: currentUser || 'User' 
                }, ...(row.historyLogs || [])];
                return updatedRow;
              }
            }
            return row;
          });
          dataRef.current = next;
          return next;
        });
        
        setPendingUpdates(prev => {
          const next = new Set(prev);
          rowsToUpdate.forEach(id => next.add(id));
          pendingUpdatesRef.current = next;
          return next;
        });
        
        debouncedSaveAll(activeTab);
        setToast({ type: 'success', message: `Đã sao chép dữ liệu cho ${rowsToUpdate.length} dòng` });
      }
    }
    setFillSource(null);
    setFillCurrentIndex(null);
  }, [fillSource, fillCurrentIndex, groupedData, currentUser, setData]);

  useEffect(() => {
    if (fillSource) {
      window.addEventListener('mouseup', handleFillEnd);
      return () => window.removeEventListener('mouseup', handleFillEnd);
    }
  }, [fillSource, handleFillEnd]);

  const statsSummary = useMemo(() => {
    const nonCancelledData = filteredData.filter(row => {
      if (isEmptyRow(row)) return false;
      const s = (row.status || '').toLowerCase();
      return !s.includes('hủy');
    });
    const total = nonCancelledData.length;
    const statusMap = nonCancelledData.reduce((acc, row) => { 
      const s = row.status || 'Chờ duyệt'; 
      acc[s] = (acc[s] || 0) + 1; 
      return acc; 
    }, {} as Record<string, number>);
    return { total, statusMap };
  }, [filteredData]);

  const basicCreativeColumns = useMemo(() => [
    { id: 'orderCode', label: 'Mã Order', defaultWidth: 100, filterType: 'text', readOnly: true },
    { id: 'department', label: 'Phòng ban', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('department') },
    { id: 'orderer', label: 'Người order', defaultWidth: 130, filterType: 'select', options: getOptionsFromMaster('orderer') }, 
    { id: 'category', label: 'Loại Order', defaultWidth: 100, filterType: 'select', options: getOptionsFromMaster('category') },
    { id: 'title', label: 'Tiêu đề nội dung', defaultWidth: 200, filterType: 'text', isMultiline: true },
    { id: 'content', label: 'Brief (nội dung)', defaultWidth: 300, filterType: 'text', isRichText: true },
    { id: 'productType', label: 'CATE HÀNG', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('productType') },
    { id: 'classType', label: 'Phân loại', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('classType') },
    { id: 'startDate', label: 'Ngày Order', defaultWidth: 120, filterType: 'date' },
    { id: 'implementationDate', label: 'Ngày triển khai', defaultWidth: 130, filterType: 'date' },
    { id: 'dueDate', label: 'Deadline', defaultWidth: 120, filterType: 'date' },
    { id: 'productLink', label: 'Link trả SP', defaultWidth: 150, filterType: 'text' },
    { id: 'status', label: 'Trạng thái', defaultWidth: 100, filterType: 'select', options: getOptionsFromMaster('status') },
    { id: 'stylist', label: 'Stylist', defaultWidth: 130, filterType: 'select', options: getOptionsFromMaster('stylist') },
    { id: 'videoPerson', label: 'Video', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('videoPerson') },
    { id: 'photoPerson', label: 'Photo', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('photoPerson') },
    // NEW COLUMNS
    { id: 'ctvStylist', label: 'CTV Stylist', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('ctvStylist') },
    { id: 'ctvPhoto', label: 'CTV Photo', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('ctvPhoto') },
    { id: 'ctvVideo', label: 'CTV Video', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('ctvVideo') },
    
    { id: 'estimatedCost', label: 'Chi phí dự kiến', defaultWidth: 130, filterType: 'text', highlight: true },
    { id: 'trackingNote', label: 'Ghi chú', defaultWidth: 200, filterType: 'text', isRichText: true },
  ], [getOptionsFromMaster]);

  const basicDesignColumns = useMemo(() => [
    { id: 'orderCode', label: 'Mã Order', defaultWidth: 100, filterType: 'text', readOnly: true },
    { id: 'department', label: 'Phòng ban', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('department') },
    { id: 'orderer', label: 'Người order', defaultWidth: 130, filterType: 'select', options: getOptionsFromMaster('orderer') },
    { id: 'category', label: 'Loại Order', defaultWidth: 100, filterType: 'select', options: getOptionsFromMaster('category') },
    { id: 'title', label: 'Tiêu đề nội dung', defaultWidth: 200, filterType: 'text', isMultiline: true },
    { id: 'trackingNote', label: 'Ghi chú', defaultWidth: 200, filterType: 'text', isRichText: true },
    { id: 'content', label: 'Brief (nội dung)', defaultWidth: 300, filterType: 'text', isRichText: true },
    { id: 'platform', label: 'Nền tảng', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('platform') },
    { id: 'productType', label: 'CATE HÀNG', defaultWidth: 120, filterType: 'select', options: getOptionsFromMaster('productType') },
    { id: 'status', label: 'Trạng thái', defaultWidth: 100, filterType: 'select', options: getOptionsFromMaster('status') },
    { id: 'designer', label: 'Người phụ trách', defaultWidth: 130, filterType: 'select', options: getOptionsFromMaster('designer') },
    { id: 'startDate', label: 'Ngày Order', defaultWidth: 120, filterType: 'date' },
    { id: 'implementationDate', label: 'Ngày triển khai', defaultWidth: 130, filterType: 'date' },
    { id: 'dueDate', label: 'Deadline', defaultWidth: 120, filterType: 'date' },
    { id: 'productLink', label: 'Link trả SP', defaultWidth: 150, filterType: 'text' },
    { id: 'estimatedCost', label: 'Chi phí dự kiến', defaultWidth: 130, filterType: 'text', highlight: true },
  ], [getOptionsFromMaster]);

  const currentColumns = useMemo(() => { const base = isDesignTab ? basicDesignColumns : basicCreativeColumns; return base.map(c => ({ ...c, visible: true })); }, [isDesignTab, basicCreativeColumns, basicDesignColumns]);
  const columnsForManager = useMemo(() => { let cols = [...currentColumns]; if (userColumnSettings && userColumnSettings.length > 0) { const colMap = new Map(cols.map(c => [c.id, c])); const ordered = []; userColumnSettings.forEach(setting => { const col = colMap.get(setting.id); if (col) { ordered.push({ ...col, visible: setting.visible }); colMap.delete(setting.id); } }); colMap.forEach(col => ordered.push({ ...col, visible: true })); cols = ordered; } return cols; }, [currentColumns, userColumnSettings]);
  const renderedColumns = useMemo(() => { 
      let cols = columnsForManager.filter((c: any) => { 
          if (c.visible === false) return false; 
          if (isDesignTab && c.id === 'trackingNote') return false; 
          if (userRole === 'collaborator' && c.id === 'estimatedCost') return false; 
          
          // Logic: Ẩn cột ngày order trong bảng kế hoạch production
          if (viewMode === 'tracking' && !isDesignTab) {
               if (['productType', 'classType', 'startDate'].includes(c.id)) return false;
          } else if (viewMode === 'tracking' && !isDesignTab && ['productType', 'classType'].includes(c.id)) {
               return false;
          }

          if (viewMode === 'table' && isDesignTab && c.id === 'implementationDate') return false; 
          return true; 
      }); 

      // Logic: Chuyển cột ghi chú đứng sau cột nội dung brief trong bảng kế hoạch production
      if (viewMode === 'tracking' && !isDesignTab) {
          const noteIdx = cols.findIndex(c => c.id === 'trackingNote');
          if (noteIdx !== -1) {
              const [noteCol] = cols.splice(noteIdx, 1);
              const contentIdx = cols.findIndex(c => c.id === 'content');
              if (contentIdx !== -1) {
                  cols.splice(contentIdx + 1, 0, noteCol);
              } else {
                  cols.push(noteCol);
              }
          }
      }

      return cols;
  }, [columnsForManager, userRole, viewMode, isDesignTab]);

  const handleExportExcel = useCallback(() => {
    if (filteredData.length === 0) {
      setToast({ type: 'error', message: 'Không có dữ liệu để xuất' });
      return;
    }

    const stripHtml = (html: string) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    };

    try {
      const exportData = filteredData.map((order, index) => {
        const row: Record<string, any> = { 'STT': index + 1 };
        renderedColumns.forEach(col => {
          if (col.id === 'actions') return;
          let val = order[col.id as keyof WorkOrder];
          
          // Strip HTML for rich text fields
          if ((col.id === 'content' || col.id === 'trackingNote') && typeof val === 'string') {
            val = stripHtml(val);
          }
          
          if (col.id === 'isConfirmed') val = val ? 'Đã xác nhận' : 'Chưa xác nhận';
          row[col.label] = val || '';
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, currentTabInfo.name);
      
      const fileName = `Bao_cao_${currentTabInfo.name}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      setToast({ type: 'success', message: 'Đã xuất file Excel thành công' });
    } catch (error) {
      console.error('Export error:', error);
      setToast({ type: 'error', message: 'Lỗi khi xuất file Excel' });
    }
  }, [filteredData, renderedColumns, currentTabInfo.name]);

  // Sync selectedOrder with data changes to prevent modal from closing or showing stale data
  useEffect(() => {
    if (selectedOrder) {
      const latest = data.find(r => r.id === selectedOrder.id);
      if (latest && JSON.stringify(latest) !== JSON.stringify(selectedOrder)) {
        setSelectedOrder(latest);
      }
    }
  }, [data, selectedOrder]);

  const itemData = useMemo(() => ({ 
    items: groupedData, 
    columns: renderedColumns, 
    colWidths, 
    isRowPending: (id: string) => pendingUpdatesRef.current.has(id), 
    updateRow, 
    logChange, 
    handleDeleteClick, 
    setCostModalData, 
    setSelectedOrder, 
    getOptionsFromMaster, 
    getConfigFromMaster, 
    viewMode, 
    isLocked,
    fillSource,
    fillCurrentIndex,
    handleFillStart,
    handleFillEnter,
    isViewingCompleted,
    setEditingCell,
    handleCellBlur
  }), [groupedData, renderedColumns, colWidths, updateRow, logChange, handleDeleteClick, setCostModalData, setSelectedOrder, getOptionsFromMaster, getConfigFromMaster, viewMode, isLocked, fillSource, fillCurrentIndex, handleFillStart, handleFillEnter, isViewingCompleted, setEditingCell, handleCellBlur]);
  const totalTableWidth = useMemo(() => { return renderedColumns.reduce((acc: number, col: any) => acc + (colWidths[col.id] || col.defaultWidth), 40 + (viewMode === 'table' && !isLocked ? 40 : 0)); }, [renderedColumns, colWidths, viewMode, isLocked]);
  const InnerElement = useMemo(() => React.forwardRef(({ style, children, ...rest }: any, ref) => ( 
      <div ref={ref} style={{ ...style, width: totalTableWidth, minWidth: '100%' }} {...rest}>
          {children}
      </div> 
  )), [totalTableWidth]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50 shadow-none overflow-hidden relative font-sans">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {isSyncing && <div className="absolute top-0 left-0 right-0 h-0.5 z-[60] bg-indigo-100 overflow-hidden"><div className="h-full bg-indigo-600 animate-[progress_1.5s_infinite_ease-in-out]" style={{ width: '40%', transformOrigin: '0% 50%' }}></div></div>}
      <div className={`${isLocked && !isOwner ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50/80 border-emerald-100 text-emerald-700'} border-b px-4 py-1.5 flex items-center justify-between z-[40]  animate-in slide-in-from-top-1`}><div className="flex items-center gap-2 text-[10px] font-bold tracking-tight uppercase">{isLocked && !isOwner ? <Lock size={12}/> : <Unlock size={12}/>} <span>{lockStatusMessage}</span></div>{!isOwner && <div className="text-[9px] bg-white/60 px-2 py-0.5 rounded-full font-bold border border-current/10">Chế độ {userRole === 'collaborator' ? 'Xem Cá Nhân' : 'Bình thường'}</div>}</div>
      <div className="bg-white/80  border-b border-slate-200 z-30 flex-shrink-0">
        <div className="px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            {userRole !== 'collaborator' && (
              <div className="bg-white/40  p-1 rounded-2xl flex shadow-sm border border-white/40">
                {tabs.map(tab => (
                  <button 
                    key={String(tab.id)} 
                    onClick={() => {
                        if (String(activeTab) !== String(tab.id)) {
                            setActiveTab(tab.id);
                        }
                    }} 
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 tracking-tight ${String(activeTab) === String(tab.id) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600'}`}
                  >
                    <Calendar size={14}/> {tab.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex bg-white/40  p-1 rounded-2xl gap-1 shadow-sm border border-white/40">
              <button onClick={() => setViewMode('table')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 tracking-tight ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/40'}`}><TableIcon size={14} /> Bảng order</button>
              {isAdmin && (
                <>
                  <button onClick={() => setViewMode('tracking')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 tracking-tight ${viewMode === 'tracking' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/40'}`}><ClipboardList size={14} /> Kế hoạch</button>
                  <button onClick={() => setViewMode('report')} className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 tracking-tight ${viewMode === 'report' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:bg-white/40'}`}><LayoutDashboard size={14} /> Báo cáo</button>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/80  border border-indigo-100 rounded-xl animate-pulse">
                <Loader2 size={12} className="text-indigo-600 animate-spin"/>
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Đang đồng bộ...</span>
              </div>
            )}
            {viewMode !== 'report' && (
              <div className="flex items-center bg-white/40  rounded-xl p-0.5 border border-white/40 mr-2 hidden sm:flex shadow-sm">
                <button onClick={() => setZoomLevel(prev => Math.max(prev-0.1, 0.5))} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-500 transition-all active:scale-90"><ZoomOut size={14}/></button>
                <span className="text-[10px] font-black text-slate-600 w-10 text-center tracking-tighter">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(prev => Math.min(prev+0.1, 1.5))} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-500 transition-all active:scale-90"><ZoomIn size={14}/></button>
              </div>
            )}
            {viewMode !== 'report' && isOwner && (
              <button onClick={() => setShowColumnManager(true)} className="p-2.5 bg-white/60  border border-white/40 text-slate-600 rounded-xl shadow-sm hover:bg-white hover:text-indigo-600 transition-all active:scale-95"><Columns size={14} /></button>
            )}
            {viewMode !== 'report' && (
              <div className="flex items-center gap-2">
                <div className="relative group w-full max-w-xs hidden sm:block">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-500"><Search size={14} className="text-slate-400" /></div>
                  <input type="text" placeholder="Tìm nhanh..." value={filters.global} onChange={(e) => setFilters(prev => ({ ...prev, global: e.target.value }))} className="block w-full pl-10 pr-4 py-2 border border-white/40 rounded-2xl text-sm font-medium bg-white/40  focus:bg-white focus:border-indigo-500/50 outline-none transition-all shadow-sm placeholder:text-slate-400" />
                </div>
                {hasActiveFilters && (
                  <button 
                    onClick={handleClearFilters}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-red-600 bg-red-50/80  border border-red-100 rounded-xl hover:bg-red-100 transition-all animate-in fade-in slide-in-from-right-2 shrink-0 shadow-sm active:scale-95"
                    title="Xóa tất cả bộ lọc"
                  >
                    <X size={14} /> Xóa lọc
                  </button>
                )}
              </div>
            )}
            {viewMode === 'table' && !isLocked && userRole !== 'collaborator' && (
              <button 
                onClick={async () => { 
                  setIsFetchingCode(true);
                  try {
                    const emptyRow = createEmptyRow('');
                    const reservedOrder = await reserveNextOrderCode(currentPrefix, String(activeTab), emptyRow);
                    
                    // Add to local state immediately
                    setData(prev => [reservedOrder, ...prev]);
                    setCreateOrderInitial(reservedOrder);
                  } catch (e) {
                    console.error("Reservation failed:", e);
                    setToast({ type: 'error', message: 'Không thể đặt chỗ mã Order. Vui lòng thử lại.' });
                  } finally {
                    setIsFetchingCode(false);
                  }
                }} 
                disabled={isFetchingCode}
                className="flex items-center gap-2 px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 tracking-tight"
              >
                {isFetchingCode ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Thêm mới
              </button>
            )}
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-700 bg-white/60  border border-white/40 rounded-2xl hover:bg-white transition-all shadow-sm active:scale-95 tracking-tight"
              title="Xuất dữ liệu ra Excel"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" /> <span className="hidden lg:inline">Xuất Excel</span>
            </button>
            <div className="flex items-center gap-1 bg-white/40  p-1 rounded-2xl border border-white/40 shadow-sm">
              <button 
                onClick={() => {
                  setIsViewingCompleted(!isViewingCompleted);
                  if (listOuterRef.current) listOuterRef.current.scrollTo({ top: 0, left: 0 });
                }}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all tracking-tight ${isViewingCompleted ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-600 hover:bg-white/60'}`}
                title={isViewingCompleted ? "Quay lại đơn đang xử lý" : "Xem đơn đã hoàn tất"}
              >
                {isViewingCompleted ? <CheckCircle2 size={14} /> : <History size={14} />}
                <span className="hidden lg:inline">{isViewingCompleted ? "Đang xem Hoàn tất" : "Đơn hoàn tất"}</span>
              </button>
              {isViewingCompleted && (
                <div className="w-32">
                  <DateRangeFilter 
                    value={completedDateRange} 
                    onChange={(val) => {
                      setCompletedDateRange(val);
                      if (listOuterRef.current) listOuterRef.current.scrollTo({ top: 0, left: 0 });
                    }}
                  />
                </div>
              )}
            </div>
            <button onClick={() => { if (!isAnyModalOpen) loadData(activeTab); }} disabled={isLoading || isSyncing || isAnyModalOpen} className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl transition-all shadow-lg shadow-indigo-100 active:scale-95 tracking-tight">
              {(isLoading || isSyncing) ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} Đồng bộ
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative bg-white flex flex-col">
        {selectedOrder && <WorkOrderDetailModal order={selectedOrder} onClose={() => { setSelectedOrder(null); }} onSave={!isLocked ? handleUpdateOrder : undefined} isOwner={isOwner} userRole={userRole} />}
        {createOrderInitial && (
          <CreateOrderModal 
            initialData={createOrderInitial} 
            onClose={async () => {
              if (createOrderInitial.isDraft) {
                try {
                  await deleteWorkOrder(createOrderInitial.id, String(activeTab));
                  setData(prev => prev.filter(r => r.id !== createOrderInitial.id));
                } catch (e) {
                  console.error("Failed to cleanup draft:", e);
                }
              }
              setCreateOrderInitial(null);
            }} 
            onSave={handleSaveNewOrder} 
            existingOrders={data} 
            departmentOptions={getOptionsFromMaster('department')} 
            categoryOptions={getOptionsFromMaster('category')} 
            ordererOptions={getOptionsFromMaster('orderer')}
          />
        )}
        {costModalData && <CostBreakdownModal order={costModalData} onClose={() => setCostModalData(null)} onSave={handleCostChange} />}
        {showColumnManager && <ColumnManager columns={columnsForManager} onSave={handleSaveColumns} onClose={() => setShowColumnManager(false)} onReset={handleResetColumns} />}
        {deleteModalData && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60  animate-in fade-in duration-200"><div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center"><h3 className="text-lg font-bold text-gray-800 mb-2">Xác nhận xóa?</h3><p className="text-sm text-gray-500 mb-6">Xóa Order <b>{deleteModalData.orderCode}</b>? Hành động không thể hoàn tác.</p><div className="flex gap-3"><button onClick={() => setDeleteModalData(null)} className="flex-1 px-4 py-2 bg-gray-100 rounded-xl font-bold">Hủy</button><button onClick={handleConfirmDelete} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl font-black">Xác nhận xóa</button></div></div></div>}
        {viewMode === 'report' ? ( 
          <div className="flex-1 overflow-y-auto">
            <SummaryReport 
              data={filteredData} 
              isDesignView={isDesignTab} 
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              reportMonth={reportMonth}
              setReportMonth={setReportMonth}
              reportYear={reportYear}
              setReportYear={setReportYear}
              customStartDate={customStartDate}
              setCustomStartDate={setCustomStartDate}
              customEndDate={customEndDate}
              setCustomEndDate={setCustomEndDate}
            />
          </div> 
        ) : (
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <div className="flex-1 origin-top-left transition-transform duration-200 ease-out overflow-hidden" style={{ transform: `scale(${zoomLevel})`, width: `${100 / zoomLevel}%`, height: `${100 / zoomLevel}%` }}>
              <div className="h-full flex flex-col">
                <div ref={headerRef} className="overflow-hidden bg-gray-50 border-b border-gray-200 shrink-0 z-10" style={{ paddingRight: '12px' }}><div style={{ width: totalTableWidth }} className="flex flex-col"><div className={`flex text-[11px] font-bold uppercase tracking-wider ${isDesignTab ? 'bg-gradient-to-r from-slate-900/80 via-cyan-950/80 to-slate-900/80 text-cyan-50' : 'bg-gradient-to-r from-slate-900/80 via-indigo-950/80 to-slate-900/80 text-indigo-50'} shadow-sm`}><div className="w-[40px] p-3 text-center border-r border-white/10 font-light flex-shrink-0 sticky left-0 z-20 bg-slate-900">#</div>{renderedColumns.map((col: any) => {
    const sortIndex = sortConfig.findIndex(c => c.key === col.id);
    const sortItem = sortIndex >= 0 ? sortConfig[sortIndex] : null;
    
    return (
        <div key={col.id} className={`p-3 text-left border-r border-white/10 relative group cursor-pointer hover:bg-white/5 transition-colors select-none flex-shrink-0 whitespace-nowrap ${col.id === 'orderCode' ? 'sticky left-[40px] z-20 bg-slate-900 shadow-[1px_0_0_rgba(255,255,255,0.1)]' : ''}`} style={{ width: colWidths[col.id] || col.defaultWidth }} onClick={(e) => handleSort(col.id, e)}>
            <div className="flex items-center gap-1">
                {col.label}
                {sortItem ? (
                    <div className="flex items-center">
                        {sortItem.direction === 'asc' ? <ArrowUp size={12} className="opacity-80" /> : <ArrowDown size={12} className="opacity-80" />}
                        {sortConfig.length > 1 && <span className="text-[9px] ml-0.5 opacity-70 font-mono">{sortIndex + 1}</span>}
                    </div>
                ) : (
                    <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
            </div>
        </div>
    );
})}{viewMode === 'table' && !isLocked && <div className="w-[40px] p-3 text-center border-l border-white/10 bg-rose-500/20  flex-shrink-0">Xóa</div>}</div><div className="flex bg-gray-50 border-b border-gray-200"><div className="w-[40px] p-1 bg-gray-100/50 text-center border-r border-gray-200 flex items-center justify-center flex-shrink-0 sticky left-0 z-20 bg-gray-100"><Filter size={12} className="text-gray-400"/></div>{renderedColumns.map((col: any) => (<div key={`filter-${col.id}`} className={`p-1 border-r border-gray-200 flex-shrink-0 ${col.id === 'orderCode' ? 'sticky left-[40px] z-20 bg-gray-50 shadow-[1px_0_0_rgba(0,0,0,0.05)]' : ''}`} style={{ width: colWidths[col.id] || col.defaultWidth }}>{col.filterType === 'select' ? ( <MultiSelectFilter options={col.options || []} selected={filters[col.id] || []} onChange={(newSelected) => setFilters(prev => ({ ...prev, [col.id]: newSelected }))} placeholder={`Chọn ${col.label}...`}/> ) : col.filterType === 'date' ? ( <DateRangeFilter value={filters[col.id] || ''} onChange={(val) => setFilters(prev => ({ ...prev, [col.id]: val }))}/> ) : ( <input type="text" className="w-full text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-indigo-500 shadow-sm" placeholder="..." value={filters[col.id] || ''} onChange={(e) => setFilters(prev => ({ ...prev, [col.id]: e.target.value }))} /> )}</div>))}{viewMode === 'table' && !isLocked && <div className="w-[40px] p-1 bg-gray-100/50 flex-shrink-0"></div>}</div></div></div>
                <div className="flex-1 overflow-auto bg-white relative" ref={containerRef}>
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        onScroll={({ scrollOffset, scrollDirection }) => handleScroll({ scrollOffset, scrollDirection })}
                        outerRef={listOuterRef}
                        className="custom-scrollbar"
                        height={height}
                        width={width}
                        itemCount={groupedData.length}
                        itemSize={50}
                        itemData={itemData}
                        itemKey={(index, data) => data.items[index].id || index}
                        innerElementType={InnerElement}
                        overscanCount={5}
                      >
                        {VirtualRow}
                      </List>
                    )}
                  </AutoSizer>
                  {isLoading && hasMore && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                          <div className="flex items-center gap-2 text-indigo-600 bg-white/90  px-4 py-2 rounded-full shadow-lg border border-indigo-100">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm font-medium">Đang tải thêm...</span>
                          </div>
                      </div>
                  )}
                  {!isLoading && !hasMore && data.length > 0 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                          <div className="flex items-center gap-2 text-gray-500 bg-white/90  px-4 py-2 rounded-full shadow-sm border border-gray-100">
                              <span className="text-xs font-medium italic">Đã tải hết dữ liệu</span>
                          </div>
                      </div>
                  )}
                  {groupedData.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-400 italic">
                      <Search size={48} className="text-gray-200 mb-2"/>
                      Không tìm thấy dữ liệu
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-white border-t border-gray-200 px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold text-gray-600 shrink-0 z-[45] shadow-[0_-4px_10px_rgba(0,0,0,0.03)]"><div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 shadow-sm"><Layers size={14}/> Tổng cộng: <span className="text-base leading-none">{statsSummary.total}</span></div><div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div><div className="flex flex-wrap items-center gap-2">{Object.entries(statsSummary.statusMap).map(([status, count]) => (<div key={status} className="flex items-center gap-2 bg-gray-50/50 px-2 py-1 rounded-lg border border-gray-200/50"><span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: getStatusColor(status) }}></span><span className="text-gray-500 font-medium truncate max-w-[120px]">{status}:</span><span className="text-gray-900 font-black">{count}</span></div>))}</div></div>
          </div>
        )}
      </div>
    </div>
  );
};
