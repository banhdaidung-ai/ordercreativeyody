
import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Check, Eye, EyeOff, RotateCcw } from 'lucide-react';

interface ColumnState {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnManagerProps {
  columns: ColumnState[]; // Full ordered list of columns with visibility
  onSave: (newColumns: ColumnState[]) => void;
  onClose: () => void;
  onReset: () => void;
}

export const ColumnManager: React.FC<ColumnManagerProps> = ({ columns, onSave, onClose, onReset }) => {
  const [items, setItems] = useState<ColumnState[]>([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    // Initialize items from props
    setItems([...columns]);
  }, [columns]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    e.currentTarget.classList.add('opacity-50', 'bg-indigo-50');
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
    e.preventDefault();
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-50', 'bg-indigo-50');
    
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const copyListItems = [...items];
      const dragItemContent = copyListItems[dragItem.current];
      copyListItems.splice(dragItem.current, 1);
      copyListItems.splice(dragOverItem.current, 0, dragItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setItems(copyListItems);
    }
  };

  const toggleVisibility = (index: number) => {
    const newItems = [...items];
    newItems[index].visible = !newItems[index].visible;
    setItems(newItems);
  };

  const handleSave = () => {
    onSave(items);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
             <h3 className="text-sm font-bold text-gray-800">Tùy chỉnh cột</h3>
             <p className="text-xs text-gray-500">Kéo thả để sắp xếp • Bật/Tắt hiển thị</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30 space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-3 p-3 bg-white border rounded-xl shadow-sm cursor-move transition-all ${item.visible ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-70'}`}
            >
              <div className="text-gray-400 cursor-grab active:cursor-grabbing">
                <GripVertical size={16} />
              </div>
              
              <div 
                className="flex-1 text-sm font-medium select-none cursor-pointer flex items-center gap-2"
                onClick={() => toggleVisibility(index)}
              >
                 <span className={item.visible ? 'text-gray-700' : 'text-gray-400 line-through'}>
                   {item.label}
                 </span>
              </div>

              <button 
                onClick={() => toggleVisibility(index)}
                className={`p-1.5 rounded-lg transition-colors ${item.visible ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-400 hover:bg-gray-200'}`}
              >
                {item.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center relative">
           <button 
             onClick={() => setShowConfirmReset(true)}
             className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2 py-1"
           >
             <RotateCcw size={12} /> Mặc định
           </button>

           {showConfirmReset && (
               <div className="absolute inset-0 z-10 bg-white flex items-center justify-between px-4 animate-in slide-in-from-bottom-1 duration-200">
                   <span className="text-[10px] font-bold text-gray-500 uppercase">Khôi phục mặc định?</span>
                   <div className="flex gap-2">
                       <button onClick={() => setShowConfirmReset(false)} className="text-[10px] font-bold text-gray-400 hover:text-gray-600 px-2 py-1">Hủy</button>
                       <button onClick={() => { onReset(); onClose(); }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 px-2 py-1">Xác nhận</button>
                   </div>
               </div>
           )}

           <div className="flex gap-2">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-colors"
              >
                <Check size={16} /> Áp dụng
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
