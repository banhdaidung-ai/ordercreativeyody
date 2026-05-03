
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, DollarSign, Calculator, User, Camera, Scissors, MapPin, Truck, Palette, Briefcase, MoreHorizontal } from 'lucide-react';
import { CostDetails, WorkOrder } from '../types';

interface CostBreakdownModalProps {
  order: WorkOrder;
  onSave: (totalCost: string, details: CostDetails) => void;
  onClose: () => void;
}

const DEFAULT_COST_DETAILS: CostDetails = {
  model: 0,
  makeup: 0,
  location: 0,
  transport: 0,
  outsource: {
    video: 0,
    photo: 0,
    stylist: 0,
    assistant: 0,
  },
  others: 0,
  note: ''
};

// FIX: Moved CostInput OUTSIDE the main component to prevent re-mounting and focus loss on every keystroke
const CostInput = ({ 
  label, 
  value, 
  onChange, 
  icon 
}: { 
  label: string; 
  value: number; 
  onChange: (val: number) => void; 
  icon: React.ReactNode 
}) => (
  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all">
    <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-2 mb-1">
      {icon} {label}
    </label>
    <input
      type="text"
      className="w-full bg-transparent text-gray-800 font-mono font-bold text-sm outline-none text-right"
      value={value > 0 ? value.toLocaleString('vi-VN') : ''}
      placeholder="0"
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        onChange(raw ? parseInt(raw, 10) : 0);
      }}
      onFocus={(e) => e.target.select()} // Auto-select text on focus for quick editing
    />
  </div>
);

export const CostBreakdownModal: React.FC<CostBreakdownModalProps> = ({ order, onSave, onClose }) => {
  const [details, setDetails] = useState<CostDetails>(DEFAULT_COST_DETAILS);

  useEffect(() => {
    if (order.costDetails) {
      // Ensure structure matches even if loaded data is partial
      setDetails({
        ...DEFAULT_COST_DETAILS,
        ...order.costDetails,
        outsource: {
            ...DEFAULT_COST_DETAILS.outsource,
            ...(order.costDetails.outsource || {})
        }
      });
    }
  }, [order]);

  const handleCostChange = (field: keyof CostDetails, value: number) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleOutsourceChange = (subField: keyof CostDetails['outsource'], value: number) => {
    setDetails(prev => ({
      ...prev,
      outsource: {
        ...prev.outsource,
        [subField]: value
      }
    }));
  };

  const totalCost = useMemo(() => {
    const outsourceTotal = 
      (details.outsource.video || 0) + 
      (details.outsource.photo || 0) + 
      (details.outsource.stylist || 0) + 
      (details.outsource.assistant || 0);
    
    return (
      (details.model || 0) +
      (details.makeup || 0) +
      (details.location || 0) +
      (details.transport || 0) +
      outsourceTotal +
      (details.others || 0)
    );
  }, [details]);

  const handleSave = () => {
    const formattedTotal = totalCost.toLocaleString('vi-VN');
    onSave(formattedTotal, details);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white/80 backdrop-blur-2xl w-full max-w-2xl sm:rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] flex flex-col h-[92vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 sm:zoom-in-95 duration-500 ease-out overflow-hidden border border-white/40 bottom-sheet">
        
        {/* Mobile Handle */}
        <div className="sm:hidden flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-gray-300/50 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-100/50 flex justify-between items-center bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-4">
             <div className="bg-emerald-500 p-3 rounded-2xl text-white shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10">
                <Calculator size={22} strokeWidth={2.5} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Chi tiết chi phí</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wider border border-emerald-200/50">Order: {order.orderCode}</span>
                </div>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 hover:bg-white/80 rounded-2xl text-slate-400 hover:text-red-500 transition-all duration-300 hover:rotate-90 mobile-touch-target border border-transparent hover:border-red-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar space-y-8">
           
           {/* Section 1: Main Costs */}
           <div className="space-y-4">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                <DollarSign size={12} strokeWidth={3} /> Chi phí cơ bản
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <CostInput 
                  label="Model / Mẫu" 
                  value={details.model} 
                  onChange={(v) => handleCostChange('model', v)} 
                  icon={<User size={14}/>}
                />
                <CostInput 
                  label="Make up" 
                  value={details.makeup} 
                  onChange={(v) => handleCostChange('makeup', v)} 
                  icon={<Palette size={14}/>}
                />
                <CostInput 
                  label="Địa điểm / Studio" 
                  value={details.location} 
                  onChange={(v) => handleCostChange('location', v)} 
                  icon={<MapPin size={14}/>}
                />
                <CostInput 
                  label="Di chuyển / Đi lại" 
                  value={details.transport} 
                  onChange={(v) => handleCostChange('transport', v)} 
                  icon={<Truck size={14}/>}
                />
              </div>
           </div>

           {/* Section 2: Outsource (Thuê ngoài) */}
           <div className="bg-indigo-500/5 p-6 rounded-[1.5rem] border border-indigo-500/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl transition-all group-hover:bg-indigo-500/10"></div>
              
              <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-5 flex items-center gap-2 relative z-10">
                 <Briefcase size={14} strokeWidth={2.5}/> Thuê cộng tác viên (Outsource)
              </h4>
              <div className="grid grid-cols-2 gap-4 relative z-10">
                 <CostInput 
                    label="Thuê Video" 
                    value={details.outsource.video} 
                    onChange={(v) => handleOutsourceChange('video', v)} 
                    icon={<DollarSign size={14}/>}
                 />
                 <CostInput 
                    label="Thuê Photo" 
                    value={details.outsource.photo} 
                    onChange={(v) => handleOutsourceChange('photo', v)} 
                    icon={<Camera size={14}/>}
                 />
                 <CostInput 
                    label="Thuê Stylist" 
                    value={details.outsource.stylist} 
                    onChange={(v) => handleOutsourceChange('stylist', v)} 
                    icon={<Scissors size={14}/>}
                 />
                 <CostInput 
                    label="Thuê Trợ lý" 
                    value={details.outsource.assistant} 
                    onChange={(v) => handleOutsourceChange('assistant', v)} 
                    icon={<User size={14}/>}
                 />
              </div>
           </div>

           {/* Section 3: Others & Notes */}
           <div className="space-y-4">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                <MoreHorizontal size={12} strokeWidth={3} /> Khác & Ghi chú
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CostInput 
                    label="Chi phí khác" 
                    value={details.others} 
                    onChange={(v) => handleCostChange('others', v)} 
                    icon={<MoreHorizontal size={14}/>}
                  />
                  
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/40 transition-all duration-300">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Ghi chú chi phí</label>
                    <input
                      type="text"
                      className="w-full bg-transparent text-slate-900 text-sm font-medium outline-none placeholder:text-slate-300"
                      placeholder="VD: Tiền ăn trưa, vé vào cổng..."
                      value={details.note}
                      onChange={(e) => setDetails(prev => ({ ...prev, note: e.target.value }))}
                    />
                  </div>
              </div>
           </div>

        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-6 border-t border-gray-100/50 bg-white/50 backdrop-blur-xl flex flex-col sm:flex-row justify-between items-center gap-6 sticky bottom-0">
           <div className="flex flex-col items-center sm:items-start w-full sm:w-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng chi phí dự kiến</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 tracking-tight">
                  {totalCost.toLocaleString('vi-VN')}
                </span>
                <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">vnđ</span>
              </div>
           </div>

           <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={onClose} 
                className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all duration-300 text-xs uppercase tracking-widest mobile-touch-target"
              >
                Hủy
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 sm:flex-none px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-[0_20px_40px_-12px_rgba(16,185,129,0.3)] hover:shadow-[0_20px_40px_-12px_rgba(16,185,129,0.4)] transition-all duration-300 text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 active:scale-[0.98] mobile-touch-target"
              >
                <Save size={18} strokeWidth={2.5} /> Xác nhận
              </button>
           </div>
        </div>

      </div>
    </div>
  );
};
