
import React, { useState, useEffect } from 'react';
import { WorkOrder } from '../types';
import { X, Calendar, User, Link as LinkIcon, DollarSign, FileText, Briefcase, CheckCircle2, Video, Camera, Scissors, Tag, History, ExternalLink, Pencil, Save, RotateCcw } from 'lucide-react';
import { autoLinkify } from './TableCells';

interface WorkOrderDetailModalProps {
  order: WorkOrder;
  onClose: () => void;
  onSave?: (order: WorkOrder) => void;
  isOwner?: boolean;
  userRole?: 'admin' | 'member' | 'collaborator';
}

export const WorkOrderDetailModal: React.FC<WorkOrderDetailModalProps> = ({ order, onClose, onSave, isOwner = false, userRole = 'member' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<WorkOrder>(order);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const wrappedOnClose = () => {
    console.trace('onClose called');
    onClose();
  };

  useEffect(() => {
    if (!isEditing) {
        setFormData(order);
    }
  }, [order]);

  // Đóng modal khi click ra ngoài (backdrop)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (isEditing) {
          setShowConfirmClose(true);
      } else {
          onClose();
      }
    }
  };

  const handleSave = () => {
      console.log('handleSave called');
      if (onSave) {
          onSave(formData);
      }
      setIsEditing(false);
  };

  const handleCancel = () => {
      setFormData(order); // Revert
      setIsEditing(false);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Helper render badge trạng thái
  const renderStatusBadge = (status: string) => {
    let colorClass = "bg-gray-100 text-gray-600 border-gray-200";
    if (status?.toLowerCase().includes('hoàn tất')) colorClass = "bg-blue-100 text-blue-700 border-blue-200 shadow-blue-100";
    else if (status?.toLowerCase().includes('hủy')) colorClass = "bg-red-100 text-red-700 border-red-200 shadow-red-100";
    else if (status?.toLowerCase().includes('đang')) colorClass = "bg-yellow-50 text-yellow-700 border-yellow-200 shadow-yellow-100";
    
    return (
      <span className={`px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wide border shadow-sm ${colorClass}`}>
        {status || 'N/A'}
      </span>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-50/95 w-full max-w-5xl sm:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col h-[95vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 sm:zoom-in-95 duration-500 border border-white/40 relative bottom-sheet">
        
        {/* Mobile Handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-6 sm:px-10 py-6 sm:py-8 flex justify-between items-center sticky top-0 z-20 glass-header border-b border-slate-200/50">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-xl shadow-indigo-500/20 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
              {order.orderCode?.substring(0, 2) || 'WO'}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">{order.orderCode}</h2>
                <div className="hidden sm:block">
                  {renderStatusBadge(order.status)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs text-indigo-600 font-bold uppercase tracking-widest bg-indigo-50/80 border border-indigo-100/50 px-2.5 py-1 rounded-lg">
                  {order.department}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-widest">
                  • {order.category}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isEditing ? (
              <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-2xl border border-slate-200/50">
                <button 
                  onClick={handleSave} 
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                  <Save size={18}/> <span>Lưu</span>
                </button>
                <button 
                  onClick={handleCancel} 
                  className="flex items-center gap-2 bg-white text-slate-600 px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 border border-slate-200 transition-all"
                >
                  <RotateCcw size={18}/> <span>Hủy</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {onSave && (
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="w-11 h-11 flex items-center justify-center bg-white hover:bg-indigo-50 text-indigo-600 rounded-2xl transition-all shadow-sm border border-slate-200 hover:border-indigo-200 group"
                    title="Chỉnh sửa"
                  >
                    <Pencil size={20} className="group-hover:scale-110 transition-transform"/>
                  </button>
                )}
                <button 
                  onClick={wrappedOnClose}
                  className="w-11 h-11 flex items-center justify-center bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all border border-slate-200 hover:border-red-100 group"
                >
                  <X size={24} className="group-hover:rotate-90 transition-transform duration-300"/>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 sm:p-10 custom-scrollbar flex-1 bg-slate-50/30">
          <div className="sm:hidden mb-6">
             {renderStatusBadge(order.status)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Main Content */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Title Section */}
              <div className={`bento-card p-8 ${isEditing ? 'ring-2 ring-indigo-500/20 border-indigo-200' : ''}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <FileText size={18}/>
                  </div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tiêu đề công việc</label>
                </div>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.title} 
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="text-2xl sm:text-3xl font-black text-slate-900 w-full outline-none bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 transition-colors py-2"
                    placeholder="Nhập tiêu đề..."
                  />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                    {formData.title || <span className="text-slate-300 italic">Chưa có tiêu đề</span>}
                  </h1>
                )}
              </div>

              {/* Brief Section */}
              <div className={`bento-card p-8 ${isEditing ? 'ring-2 ring-indigo-500/20 border-indigo-200' : ''}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
                    <Briefcase size={18}/>
                  </div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nội dung chi tiết (Brief)</label>
                </div>
                {isEditing ? (
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    className="w-full min-h-[300px] text-base text-slate-700 leading-relaxed outline-none bg-slate-50/50 rounded-2xl p-6 border border-slate-200 focus:border-indigo-500 transition-all"
                    placeholder="Nhập nội dung chi tiết..."
                  />
                ) : (
                  <div 
                    className="text-base text-slate-700 leading-relaxed prose prose-slate max-w-none 
                      [&_a]:text-indigo-600 [&_a]:font-bold [&_a]:underline [&_a]:underline-offset-4 
                      [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4"
                    dangerouslySetInnerHTML={{ __html: autoLinkify(formData.content) || '<p class="text-slate-300 italic">Chưa có nội dung chi tiết</p>' }}
                    onClick={handleLinkClick}
                  />
                )}
              </div>

              {/* Product Info & Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bento-card p-6 group hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                      <Tag size={18}/>
                    </div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cate Hàng</label>
                  </div>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.productType} 
                      onChange={(e) => setFormData({...formData, productType: e.target.value})}
                      className="text-lg font-bold text-slate-800 w-full bg-transparent border-b border-slate-100 focus:border-blue-500 outline-none"
                    />
                  ) : (
                    <div className="text-lg font-bold text-slate-800">{formData.productType || '--'}</div>
                  )}
                </div>

                <div className="bento-card p-6 group hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      <LinkIcon size={18}/>
                    </div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Link sản phẩm</label>
                  </div>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={formData.productLink} 
                      onChange={(e) => setFormData({...formData, productLink: e.target.value})}
                      className="text-sm text-indigo-600 font-bold w-full outline-none border-b border-slate-100 focus:border-indigo-500"
                      placeholder="https://..."
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <a 
                        href={formData.productLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 font-bold truncate hover:underline underline-offset-2"
                      >
                        {formData.productLink || '--'}
                      </a>
                      {formData.productLink && <ExternalLink size={14} className="text-slate-300 shrink-0"/>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Sidebar Info */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Status & Timeline */}
              <div className="bento-card p-8 space-y-6">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-2">Thông tin chung</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <Calendar size={16}/>
                      </div>
                      <span className="text-sm font-medium text-slate-500">Ngày tạo</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {formData.startDate ? (() => {
                        const [date, time] = formData.startDate.split('T');
                        if (!time) return date;
                        const [yyyy, mm, dd] = date.split('-');
                        return `${dd}/${mm}/${yyyy}`;
                      })() : '--'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-slate-100 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                        <Calendar size={16}/>
                      </div>
                      <span className="text-sm font-medium text-slate-500">Hạn chót</span>
                    </div>
                    <span className="text-sm font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                      {formData.dueDate || '--'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={16}/>
                      </div>
                      <span className="text-sm font-medium text-slate-500">Xác nhận</span>
                    </div>
                    {formData.isConfirmed ? (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                        Đã duyệt
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                        Chưa duyệt
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Personnel */}
              <div className="bento-card p-8 space-y-6">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-2">Nhân sự thực hiện</h3>
                
                <div className="space-y-5">
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
                      {formData.orderer?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Người Order</span>
                      <span className="text-sm font-bold text-slate-900">{formData.orderer || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'Stylist', value: formData.stylist, icon: Scissors, color: 'violet' },
                      { label: 'Video', value: formData.videoPerson, icon: Video, color: 'blue' },
                      { label: 'Photo', value: formData.photoPerson, icon: Camera, color: 'emerald' }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100/50 group hover:bg-white hover:border-slate-200 transition-all">
                        <div className="flex items-center gap-3">
                          <item.icon size={14} className={`text-${item.color}-500`}/>
                          <span className="text-xs font-medium text-slate-500">{item.label}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-900">{item.value || '--'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cost Card */}
              {userRole !== 'collaborator' && (
                <div className="bento-card p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-700"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400">
                        <DollarSign size={18}/>
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Chi phí dự kiến</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black tracking-tighter">
                        {formData.estimatedCost ? parseInt(formData.estimatedCost.replace(/[^0-9]/g, "") || "0", 10).toLocaleString('vi-VN') : '0'}
                      </span>
                      <span className="text-lg font-bold text-slate-500">VNĐ</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* History Section */}
          <div className="mt-12 pt-10 border-t border-slate-200/50">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                  <History size={20}/>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Lịch sử thay đổi</h3>
                  <p className="text-xs text-slate-400 font-medium">Theo dõi các cập nhật của công việc này</p>
                </div>
              </div>
            </div>

            <div className="bento-card p-8 bg-white/50 backdrop-blur-sm max-h-[400px] overflow-y-auto custom-scrollbar">
              {order.historyLogs && order.historyLogs.length > 0 ? (
                <div className="space-y-8 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {order.historyLogs.map((log, index) => (
                    <div key={index} className="relative pl-10 group">
                      <div className="absolute left-0 top-1.5 w-8 h-8 rounded-xl bg-white border-2 border-slate-100 shadow-sm z-10 flex items-center justify-center group-hover:border-indigo-200 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors"></div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                         <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                           {log.timestamp}
                         </span>
                         <span className="text-sm text-slate-600">
                            <b className="text-slate-900">{log.user || 'Hệ thống'}</b> đã cập nhật <b className="text-indigo-600">{log.field}</b>
                         </span>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-md transition-all">
                         <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Từ</div>
                            <div className="text-sm text-slate-400 line-through truncate">{log.oldValue || '(Trống)'}</div>
                         </div>
                         <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                            <ExternalLink size={14} className="rotate-90"/>
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Sang</div>
                            <div className="text-sm font-bold text-slate-900 truncate">{log.newValue}</div>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mx-auto mb-4">
                    <History size={32}/>
                  </div>
                  <p className="text-sm text-slate-400 font-medium italic">Chưa có lịch sử ghi nhận cho công việc này.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white/80 backdrop-blur-md border-t border-slate-200/50 px-8 py-6 flex justify-end gap-4 sticky bottom-0 z-20">
           {isEditing && (
              <button 
                onClick={handleSave}
                className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Save size={18}/> Lưu thay đổi
              </button>
           )}
           <button 
             onClick={wrappedOnClose}
             className={`${isEditing ? 'flex-1 sm:flex-none' : 'w-full sm:w-auto'} px-8 py-3 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-2xl hover:bg-slate-50 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center`}
           >
             Đóng
           </button>
        </div>

        {/* Custom Confirmation Modal */}
        {showConfirmClose && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300 border border-slate-100">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-6">
                        <RotateCcw size={28}/>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Thay đổi chưa lưu</h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">Bạn đang có các thay đổi chưa được lưu lại. Nếu đóng bây giờ, mọi dữ liệu vừa nhập sẽ bị mất.</p>
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={wrappedOnClose} 
                            className="w-full py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                        >
                            Xác nhận đóng
                        </button>
                        <button 
                            onClick={() => setShowConfirmClose(false)} 
                            className="w-full py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            Tiếp tục chỉnh sửa
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>

  );
};
