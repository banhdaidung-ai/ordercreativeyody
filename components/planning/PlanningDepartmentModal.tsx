import React, { useState } from 'react';
import { PlanningDepartmentConfig, PlanItem } from '../../types';
import { X, Plus, Trash2, Edit3, FolderTree, Folder, Briefcase, ChevronUp, ChevronDown, Check, AlertCircle, ArrowRight } from 'lucide-react';

interface PlanningDepartmentModalProps {
    departments: PlanningDepartmentConfig[];
    planItems: PlanItem[];
    onSave: (
        newConfigs: PlanningDepartmentConfig[], 
        renameMap: Record<string, string>
    ) => Promise<void>;
    onClose: () => void;
}

export const PlanningDepartmentModal: React.FC<PlanningDepartmentModalProps> = ({
    departments,
    planItems,
    onSave,
    onClose
}) => {
    const [localDepts, setLocalDepts] = useState<PlanningDepartmentConfig[]>(
        [...departments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );
    const [renameMap, setRenameMap] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Form state for Add/Edit
    const [editingDept, setEditingDept] = useState<PlanningDepartmentConfig | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState<{
        name: string;
        isGroup: boolean;
        parent: string;
        displayName: string;
    }>({
        name: '',
        isGroup: false,
        parent: '',
        displayName: ''
    });

    // Confirmation for Delete
    const [deptToDelete, setDeptToDelete] = useState<PlanningDepartmentConfig | null>(null);

    // Available groups for dropdown
    const availableGroups = localDepts.filter(d => d.isGroup);

    // Count plan items attached to a department name
    const countPlanItems = (deptName: string) => {
        return planItems.filter(item => (item.department || '').trim().toLowerCase() === deptName.trim().toLowerCase()).length;
    };

    const handleOpenAdd = (isGroup: boolean, defaultParent?: string) => {
        setEditingDept(null);
        setFormData({
            name: '',
            isGroup,
            parent: defaultParent || '',
            displayName: ''
        });
        setErrorMsg(null);
        setIsAdding(true);
    };

    const handleOpenEdit = (dept: PlanningDepartmentConfig) => {
        setIsAdding(false);
        setEditingDept(dept);
        setFormData({
            name: dept.name,
            isGroup: dept.isGroup,
            parent: dept.parent || '',
            displayName: dept.displayName || ''
        });
        setErrorMsg(null);
    };

    const handleSaveForm = () => {
        const trimmedName = formData.name.trim();
        if (!trimmedName) {
            setErrorMsg('Vui lòng nhập tên phòng ban/nhóm');
            return;
        }

        // Check duplicate name
        const isDuplicate = localDepts.some(d => 
            d.name.toLowerCase() === trimmedName.toLowerCase() && 
            (!editingDept || d.id !== editingDept.id)
        );
        if (isDuplicate) {
            setErrorMsg(`Tên "${trimmedName}" đã tồn tại trong danh sách`);
            return;
        }

        if (editingDept) {
            // Updating existing
            const oldName = editingDept.name;
            if (oldName !== trimmedName) {
                setRenameMap(prev => ({
                    ...prev,
                    [oldName]: trimmedName
                }));

                // If editing a group, update children's parent reference
                if (editingDept.isGroup) {
                    setLocalDepts(prev => prev.map(d => 
                        d.parent === oldName ? { ...d, parent: trimmedName } : d
                    ));
                }
            }

            setLocalDepts(prev => prev.map(d => {
                if (d.id !== editingDept.id) return d;
                return {
                    ...d,
                    name: trimmedName,
                    isGroup: formData.isGroup,
                    parent: formData.isGroup ? undefined : (formData.parent || undefined),
                    displayName: formData.displayName.trim() || undefined
                };
            }));
            setEditingDept(null);
        } else {
            // Adding new
            const newId = `pdept-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            const maxOrder = localDepts.reduce((max, d) => Math.max(max, d.order || 0), 0);
            
            const newConfig: PlanningDepartmentConfig = {
                id: newId,
                name: trimmedName,
                isGroup: formData.isGroup,
                parent: formData.isGroup ? undefined : (formData.parent || undefined),
                displayName: formData.displayName.trim() || undefined,
                order: maxOrder + 1
            };

            setLocalDepts(prev => [...prev, newConfig]);
            setIsAdding(false);
        }

        setErrorMsg(null);
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= localDepts.length) return;

        const updated = [...localDepts];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);

        // Reassign orders
        const reordered = updated.map((d, idx) => ({ ...d, order: idx }));
        setLocalDepts(reordered);
    };

    const handleDelete = (dept: PlanningDepartmentConfig) => {
        // If it's a group, check if it has children
        const children = localDepts.filter(d => d.parent === dept.name);
        if (dept.isGroup && children.length > 0) {
            setErrorMsg(`Nhóm "${dept.name}" đang chứa ${children.length} phòng ban con. Hãy xóa hoặc chuyển các phòng ban con trước.`);
            return;
        }

        setDeptToDelete(dept);
    };

    const confirmDelete = () => {
        if (!deptToDelete) return;
        setLocalDepts(prev => prev.filter(d => d.id !== deptToDelete.id));
        setDeptToDelete(null);
        setErrorMsg(null);
    };

    const handleFinalSave = async () => {
        setIsSaving(true);
        setErrorMsg(null);
        try {
            await onSave(localDepts, renameMap);
            onClose();
        } catch (err: any) {
            console.error("Error saving planning departments:", err);
            setErrorMsg(err.message || 'Lỗi khi lưu cấu hình phòng ban');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-indigo-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                            <FolderTree size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Quản lý Hạng mục Phòng ban</h3>
                            <p className="text-xs text-gray-500 font-medium">Thêm, sửa, xóa và sắp xếp cơ cấu phòng ban trong Planning</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-red-700 animate-in slide-in-from-top-1">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Body Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {/* Add / Edit Form Box */}
                    {(isAdding || editingDept) ? (
                        <div className="p-5 rounded-2xl border bg-indigo-50/50 border-indigo-200 space-y-4 animate-in fade-in">
                            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                <h4 className="font-black text-xs uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                                    {editingDept ? <Edit3 size={14} className="text-indigo-600"/> : <Plus size={14} className="text-green-600"/>}
                                    {editingDept ? `Chỉnh sửa: ${editingDept.name}` : formData.isGroup ? 'Thêm Nhóm cha mới' : 'Thêm Phòng ban mới'}
                                </h4>
                                <button 
                                    onClick={() => { setIsAdding(false); setEditingDept(null); setErrorMsg(null); }}
                                    className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                                >
                                    Đóng
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-700 uppercase">
                                        Tên {formData.isGroup ? 'Nhóm cha' : 'Phòng ban'} <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={formData.name} 
                                        onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                        className="w-full text-xs font-bold p-2.5 border border-indigo-200 rounded-xl bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                                        placeholder={formData.isGroup ? 'Ví dụ: MKT, OMNI...' : 'Ví dụ: Trade, Brand...'}
                                    />
                                </div>

                                {!formData.isGroup && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-gray-700 uppercase">Nhóm cha trực thuộc</label>
                                        <select 
                                            value={formData.parent} 
                                            onChange={e => setFormData({ ...formData, parent: e.target.value })} 
                                            className="w-full text-xs font-bold p-2.5 border border-indigo-200 rounded-xl bg-white outline-none focus:border-indigo-500 cursor-pointer"
                                        >
                                            <option value="">-- Độc lập (Không thuộc nhóm nào) --</option>
                                            {availableGroups.map(g => (
                                                <option key={g.id} value={g.name}>Nhóm: {g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[11px] font-bold text-gray-700 uppercase">Tên hiển thị phụ (Tùy chọn)</label>
                                    <input 
                                        type="text" 
                                        value={formData.displayName} 
                                        onChange={e => setFormData({ ...formData, displayName: e.target.value })} 
                                        className="w-full text-xs font-medium p-2.5 border border-indigo-200 rounded-xl bg-white outline-none focus:border-indigo-500"
                                        placeholder="Để trống nếu trùng tên phòng ban (ví dụ: 'MKT ONLINE WEB')"
                                    />
                                </div>
                            </div>

                            {editingDept && editingDept.name !== formData.name.trim() && formData.name.trim() && (
                                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium flex items-center gap-2">
                                    <AlertCircle size={14} className="shrink-0 text-amber-600" />
                                    <span>
                                        Đổi tên từ <strong>{editingDept.name}</strong> sang <strong>{formData.name.trim()}</strong> sẽ tự động cập nhật các dòng kế hoạch đang có!
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button 
                                    onClick={() => { setIsAdding(false); setEditingDept(null); setErrorMsg(null); }}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={handleSaveForm}
                                    className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5"
                                >
                                    <Check size={14}/> {editingDept ? 'Cập nhật' : 'Thêm vào danh sách'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleOpenAdd(true)}
                                className="px-3.5 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                                <Folder size={14} className="text-yellow-400"/> + Thêm Nhóm cha
                            </button>
                            <button 
                                onClick={() => handleOpenAdd(false)}
                                className="px-3.5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-100"
                            >
                                <Briefcase size={14}/> + Thêm Phòng ban
                            </button>
                        </div>
                    )}

                    {/* Department Tree / List */}
                    <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 bg-white">
                        {localDepts.map((dept, index) => {
                            const isGroup = dept.isGroup;
                            const isChild = !isGroup && Boolean(dept.parent);
                            const itemsCount = countPlanItems(dept.name);

                            return (
                                <div 
                                    key={dept.id} 
                                    className={`flex items-center justify-between p-3 transition-colors ${isGroup ? 'bg-slate-50 font-black' : isChild ? 'pl-8 hover:bg-indigo-50/40' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {/* Sort buttons */}
                                        <div className="flex flex-col gap-0.5">
                                            <button 
                                                onClick={() => handleMove(index, 'up')}
                                                disabled={index === 0}
                                                className={`p-0.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20`}
                                                title="Di chuyển lên"
                                            >
                                                <ChevronUp size={12}/>
                                            </button>
                                            <button 
                                                onClick={() => handleMove(index, 'down')}
                                                disabled={index === localDepts.length - 1}
                                                className={`p-0.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-20`}
                                                title="Di chuyển xuống"
                                            >
                                                <ChevronDown size={12}/>
                                            </button>
                                        </div>

                                        {/* Icon */}
                                        {isGroup ? (
                                            <span className="p-1.5 bg-slate-800 text-yellow-400 rounded-lg shadow-sm">
                                                <Folder size={14} />
                                            </span>
                                        ) : isChild ? (
                                            <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                                                <Briefcase size={14} />
                                            </span>
                                        ) : (
                                            <span className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                                                <Briefcase size={14} />
                                            </span>
                                        )}

                                        {/* Name & Parent badge */}
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs ${isGroup ? 'font-black text-slate-800 uppercase' : 'font-bold text-gray-700'}`}>
                                                    {dept.name}
                                                </span>
                                                {dept.displayName && dept.displayName !== dept.name && (
                                                    <span className="text-[10px] text-gray-400 font-normal">
                                                        ({dept.displayName})
                                                    </span>
                                                )}
                                                {isGroup && (
                                                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-black uppercase">
                                                        Nhóm cha
                                                    </span>
                                                )}
                                                {isChild && (
                                                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                                        Thuộc: {dept.parent}
                                                    </span>
                                                )}
                                            </div>
                                            {!isGroup && itemsCount > 0 && (
                                                <span className="text-[10px] text-gray-400">
                                                    Đang có {itemsCount} dòng kế hoạch
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1">
                                        {isGroup && (
                                            <button 
                                                onClick={() => handleOpenAdd(false, dept.name)}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-[11px] font-bold flex items-center gap-1"
                                                title={`Thêm phòng ban con vào nhóm ${dept.name}`}
                                            >
                                                <Plus size={14}/> <span className="hidden sm:inline">Thêm con</span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleOpenEdit(dept)}
                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Chỉnh sửa"
                                        >
                                            <Edit3 size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(dept)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Xóa"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">
                        Tổng số: <strong>{localDepts.length}</strong> hạng mục
                    </span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Đóng
                        </button>
                        <button 
                            onClick={handleFinalSave}
                            disabled={isSaving}
                            className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deptToDelete && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 shadow-inner">
                            <Trash2 size={26}/>
                        </div>
                        <h3 className="text-base font-black text-slate-800 mb-2">Xác nhận xóa hạng mục?</h3>
                        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                            Bạn có chắc chắn muốn xóa hạng mục <strong>"{deptToDelete.name}"</strong> không?
                        </p>
                        {countPlanItems(deptToDelete.name) > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium mb-4 text-left">
                                ⚠️ Cảnh báo: Hiện đang có <strong>{countPlanItems(deptToDelete.name)}</strong> dòng kế hoạch thuộc phòng ban này.
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setDeptToDelete(null)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs"
                            >
                                Hủy bỏ
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all text-xs"
                            >
                                Xóa ngay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
