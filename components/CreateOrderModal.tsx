
import React, { useState, useEffect, useRef } from 'react';
import { WorkOrder, DEFAULT_ORDERERS, DEFAULT_PRODUCT_TYPES } from '../types';
import { X, Save, Sparkles, Bold, Italic, List, ListOrdered, Underline, Eraser, Palette, Link as LinkIcon, Check, Info } from 'lucide-react';
import { SelectCell, DynamicListCell } from './TableCells';

interface CreateOrderModalProps {
  initialData: WorkOrder;
  onClose: () => void;
  onSave: (data: WorkOrder) => void;
  existingOrders: WorkOrder[];
  departmentOptions: string[];
  categoryOptions: string[];
  ordererOptions: string[];
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ 
  initialData, 
  onClose, 
  onSave, 
  departmentOptions, 
  categoryOptions,
  ordererOptions
}) => {
  const [formData, setFormData] = useState<WorkOrder>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Editor State
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Sync initialData
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  // Sync Content to Editor Div on Mount
  useEffect(() => {
    if (editorRef.current) {
        editorRef.current.innerHTML = formData.content || '';
    }
  }, []); // Run once on mount

  const handleChange = (field: keyof WorkOrder, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // --- Rich Text Editor Logic ---
  
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        selectionRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && selectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(selectionRef.current);
    }
    if (editorRef.current) {
        editorRef.current.focus();
    }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    restoreSelection();
    if (command === 'foreColor' || command === 'hiliteColor') {
        document.execCommand('styleWithCSS', false, 'true');
    } else {
        document.execCommand('styleWithCSS', false, 'false');
    }
    document.execCommand(command, false, value);
    saveSelection();
    updateContentFromEditor();
  };

  const handleColorClick = (color: string) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand("foreColor", false, color);
    document.execCommand('styleWithCSS', false, 'false');
    setShowColorPicker(false);
    updateContentFromEditor();
    saveSelection();
  };

  const handleLinkClick = () => {
      restoreSelection();
      setLinkUrl('');
      setShowLinkInput(!showLinkInput);
      setShowColorPicker(false);
  };

  const applyLink = () => {
      restoreSelection();
      if (linkUrl) {
          document.execCommand("createLink", false, linkUrl);
      }
      setShowLinkInput(false);
      updateContentFromEditor();
  };

  const updateContentFromEditor = () => {
    if (editorRef.current) {
        handleChange('content', editorRef.current.innerHTML);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title?.trim()) newErrors.title = "Vui lòng nhập tiêu đề";
    if (!formData.department) newErrors.department = "Chọn phòng ban";
    if (!formData.orderer) newErrors.orderer = "Chọn người order";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (editorRef.current) {
        const links = editorRef.current.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
            links[i].setAttribute('target', '_blank');
            links[i].setAttribute('rel', 'noopener noreferrer');
            links[i].classList.add('text-blue-600', 'underline', 'cursor-pointer', 'font-medium');
        }
        formData.content = editorRef.current.innerHTML;
    }

    if (validate()) {
        let finalData = { ...formData };
        if (!finalData.startDate) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            finalData.startDate = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        }
        onSave(finalData);
    }
  };

  const ToolbarBtn = ({ icon, onClick, title, active = false }: { icon: React.ReactNode, onClick: (e: React.MouseEvent) => void, title: string, active?: boolean }) => (
     <button 
        onMouseDown={(e) => { e.preventDefault(); onClick(e); }} 
        className={`p-1.5 rounded transition-colors ${active ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-200 text-gray-600 hover:text-indigo-600'}`} 
        title={title}
     >
        {icon}
     </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-slate-50/95 w-full max-w-4xl sm:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] flex flex-col h-[95vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 sm:zoom-in-95 duration-500 overflow-hidden border border-white/40 bottom-sheet" onClick={() => { setShowColorPicker(false); setShowLinkInput(false); }}>
        
        {/* Mobile Handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-6 sm:px-10 py-6 sm:py-8 border-b border-slate-200/50 flex justify-between items-center glass-header">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 transform -rotate-2">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Thêm Order Mới</h3>
              <div className="text-[10px] sm:text-xs text-indigo-600 font-bold flex items-center gap-2 mt-1">
                 <span className="opacity-60 uppercase tracking-widest">Mã Order:</span>
                 <span className="bg-white/80 px-2.5 py-1 rounded-lg border border-indigo-100 shadow-sm font-black text-indigo-700 flex items-center gap-1.5">
                   {formData.orderCode}
                   <Check size={12} className="text-emerald-500" />
                 </span>
                 <div className="group relative ml-1 hidden sm:block">
                    <Info size={14} className="text-indigo-400 cursor-help"/>
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 w-56 bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 border border-slate-800">
                        Mã này đã được hệ thống xác thực duy nhất trên Server.
                    </div>
                 </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all border border-slate-200 hover:border-red-100 group">
            <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar bg-slate-50/30">
          <div className="flex flex-col gap-8">
            
            {/* Row 1: Department & Orderer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex justify-between">
                      Phòng ban <span className="text-red-500">*</span>
                  </label>
                  <div className="h-12 bento-card p-0 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                    <SelectCell 
                        options={departmentOptions} 
                        value={formData.department} 
                        onChange={(e) => handleChange('department', e.target.value)}
                        type="department"
                    />
                  </div>
                  {errors.department && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.department}</p>}
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                      Người Order <span className="text-red-500">*</span>
                  </label>
                  <div className="h-12 bento-card p-0 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                    <DynamicListCell 
                        value={formData.orderer} 
                        onChange={(val) => handleChange('orderer', val)}
                        options={ordererOptions}
                        placeholder="Nhập hoặc chọn người order..."
                        colorize={true}
                    />
                  </div>
                  {errors.orderer && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.orderer}</p>}
               </div>
            </div>

            {/* Row 2: Category, Product Type, Deadline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Thể loại</label>
                    <div className="h-12 bento-card p-0 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <SelectCell 
                            options={categoryOptions} 
                            value={formData.category} 
                            onChange={(e) => handleChange('category', e.target.value)}
                            type="category"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Cate Hàng</label>
                    <div className="h-12 bento-card p-0 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                        <DynamicListCell 
                            value={formData.productType} 
                            onChange={(val) => handleChange('productType', val)}
                            options={DEFAULT_PRODUCT_TYPES}
                            colorize={true}
                            placeholder="Chọn Cate..."
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Deadline</label>
                    <input 
                        type="date"
                        className="w-full h-12 bento-card px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all uppercase text-slate-700 font-bold"
                        value={formData.dueDate}
                        onChange={(e) => handleChange('dueDate', e.target.value)}
                    />
                </div>
            </div>

            {/* Row 3: Title */}
            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                    Tiêu đề nội dung <span className="text-red-500">*</span>
                </label>
                <input 
                    type="text" 
                    className="w-full h-14 text-lg font-black bento-card px-6 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Nhập tiêu đề công việc..."
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                />
                {errors.title && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.title}</p>}
            </div>

            {/* Row 4: Content (Rich Text) */}
            <div className="space-y-2 flex flex-col flex-1 min-h-[350px]">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex justify-between items-end">
                    Nội dung chi tiết (Brief)
                    <span className="text-[10px] font-bold text-indigo-400 normal-case italic bg-indigo-50 px-2 py-0.5 rounded-lg">Hỗ trợ định dạng văn bản</span>
                </label>
                
                <div className="flex-1 bento-card p-0 overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                    <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200/50 px-4 py-3 flex items-center gap-1 flex-wrap relative z-10">
                        <ToolbarBtn onClick={() => execCmd('bold')} icon={<Bold size={18}/>} title="In đậm"/>
                        <ToolbarBtn onClick={() => execCmd('italic')} icon={<Italic size={18}/>} title="In nghiêng"/>
                        <ToolbarBtn onClick={() => execCmd('underline')} icon={<Underline size={18}/>} title="Gạch chân"/>
                        <div className="w-px h-5 bg-slate-200 mx-2"></div>
                        <div className="relative">
                            <button 
                                onMouseDown={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    saveSelection(); 
                                    setShowColorPicker(!showColorPicker); 
                                    setShowLinkInput(false); 
                                }} 
                                onClick={(e) => e.stopPropagation()}
                                className={`p-2 rounded-xl transition-all ${showColorPicker ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-200 text-slate-600'}`}
                                title="Màu chữ"
                            >
                                <Palette size={18}/>
                            </button>
                            {showColorPicker && (
                                <div className="absolute top-full left-0 mt-3 p-4 bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col gap-3 z-50 animate-in slide-in-from-top-2 w-60" onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-2 flex-wrap justify-center">
                                        {['#000000', '#64748b', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'].map(c => (
                                            <button key={c} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleColorClick(c); }} className="w-7 h-7 rounded-lg border border-slate-100 shadow-sm hover:scale-110 transition-transform" style={{backgroundColor: c}} title={c}/>
                                        ))}
                                    </div>
                                    <div className="border-t border-slate-100 pt-3 mt-1">
                                        <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors group/custom w-full">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-400 via-purple-400 to-red-400 border border-slate-100 shadow-sm group-hover/custom:scale-110 transition-transform relative overflow-hidden shrink-0">
                                                <input type="color" className="absolute -top-4 -left-4 w-16 h-16 opacity-0 cursor-pointer p-0 border-0" onChange={(e) => handleColorClick(e.target.value)} onClick={(e) => e.stopPropagation()}/>
                                            </div>
                                            <span className="text-xs font-black text-slate-600 group-hover/custom:text-indigo-600 flex-1">Tùy chỉnh...</span>
                                        </label>
                                    </div>
                                    <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleColorClick("black"); }} className="w-full text-[10px] font-black text-slate-400 hover:text-slate-900 hover:bg-slate-50 py-2 rounded-lg text-center transition-colors border-t border-slate-50">Mặc định</button>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <ToolbarBtn onClick={handleLinkClick} icon={<LinkIcon size={18}/>} title="Chèn Link" active={showLinkInput}/>
                            {showLinkInput && (
                                <div className="absolute top-full left-0 mt-3 p-3 bg-white border border-slate-200 shadow-2xl rounded-2xl flex items-center gap-3 z-50 animate-in slide-in-from-top-2 w-72" onMouseDown={(e) => e.stopPropagation()}>
                                    <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:border-indigo-500 outline-none font-medium" onKeyDown={(e) => e.key === 'Enter' && applyLink()} autoFocus/>
                                    <button onClick={applyLink} className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"><Check size={16}/></button>
                                </div>
                            )}
                        </div>
                        <div className="w-px h-5 bg-slate-200 mx-2"></div>
                        <ToolbarBtn onClick={() => execCmd('insertUnorderedList')} icon={<List size={18}/>} title="Danh sách"/>
                        <ToolbarBtn onClick={() => execCmd('insertOrderedList')} icon={<ListOrdered size={18}/>} title="Danh sách số"/>
                        <div className="w-px h-5 bg-slate-200 mx-2"></div>
                        <ToolbarBtn onClick={() => execCmd('removeFormat')} icon={<Eraser size={18}/>} title="Xóa định dạng"/>
                    </div>
                    <div className="flex-1 bg-white cursor-text p-6 overflow-y-auto" onClick={() => editorRef.current?.focus()}>
                        <div
                            ref={editorRef}
                            contentEditable={true}
                            suppressContentEditableWarning={true}
                            onInput={updateContentFromEditor}
                            onBlur={() => { saveSelection(); updateContentFromEditor(); }}
                            onMouseUp={saveSelection}
                            onKeyUp={saveSelection}
                            onSelect={saveSelection} 
                            className="outline-none min-h-[250px] prose prose-slate max-w-none text-slate-700 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_a]:text-indigo-600 [&_a]:font-bold [&_a]:underline [&_a]:underline-offset-4"
                        />
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-10 py-6 bg-white/80 backdrop-blur-md border-t border-slate-200/50 flex justify-end gap-4 sticky bottom-0 z-20">
           <button onClick={onClose} className="flex-1 sm:flex-none px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all text-sm">Hủy bỏ</button>
           <button onClick={handleSubmit} className="flex-1 sm:flex-none px-10 py-3 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 hover:shadow-xl hover:shadow-indigo-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 text-sm shadow-lg">
             <Save size={20} /> Tạo Order
           </button>
        </div>
      </div>
    </div>

  );
};
