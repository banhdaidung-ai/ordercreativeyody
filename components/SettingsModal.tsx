
import React, { useState, useEffect } from 'react';
import { X, Save, Globe, Loader2, RotateCcw, Share2, Copy, Check, ShieldCheck, Users, Plus, Trash2, Key, Mail, UserCircle, Pencil, Palette, Type, ZoomIn, Monitor, Lock, Unlock, Zap, Info, Clock, FileText, Search, CalendarRange, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getApiUrl, getMasterDataGid, getProductionGid, getDesignGid, getBudgetGid, saveMasterDataItem, fetchSystemUsers, deleteMasterDataItem, fetchMasterData, getSystemLogsGid, fetchSystemLogs, setServiceType, isFirebase } from '../services/dataService';
import { migrateSheetsToFirebase, MigrationProgress } from '../services/migrationService';
import { UserAccount, MasterDataItem, SystemLogEntry } from '../types';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'users' | 'ui' | 'system' | 'logs' | 'migration' | 'masterData'>('system');
  
  // Migration State
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress>({
    step: '', current: 0, total: 0, status: 'idle'
  });
  
  // Connection Config
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [masterDataGid, setMasterDataGid] = useState('');
  const [productionGid, setProductionGid] = useState('');
  const [designGid, setDesignGid] = useState('');
  const [budgetGid, setBudgetGid] = useState('');
  const [systemLogsGid, setSystemLogsGid] = useState('');
  
  // User Management
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'member' as 'admin' | 'member' | 'collaborator' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  const filteredUsers = users.filter(u => 
      u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  const toggleUserSelection = (id: string) => {
      const newSelection = new Set(selectedUsers);
      if (newSelection.has(id)) newSelection.delete(id);
      else newSelection.add(id);
      setSelectedUsers(newSelection);
  };

  const toggleAllUsers = () => {
      if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
      else setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  };

  const handleDeleteSelectedUsers = async () => {
      if (selectedUsers.size === 0) return;
      setConfirmModal({
          show: true,
          title: "Xác nhận xóa các người dùng đã chọn",
          message: `Bạn có chắc chắn muốn xóa ${selectedUsers.size} người dùng đã chọn không? Hành động này không thể hoàn tác.`,
          type: 'danger',
          onConfirm: async () => {
              setIsSaving(true);
              try {
                  await Promise.all(Array.from(selectedUsers).map(id => deleteMasterDataItem(id)));
                  setSelectedUsers(new Set());
                  loadUsers();
                  setConfirmModal(prev => ({ ...prev, show: false }));
              } catch (e) {
                  alert("Lỗi khi xóa");
              } finally {
                  setIsSaving(false);
              }
          }
      });
  };
  
  // System Management - Separate Statuses
  const [prodStatus, setProdStatus] = useState<string>('AUTO');
  const [designStatus, setDesignStatus] = useState<string>('AUTO');
  const [planningStatus, setPlanningStatus] = useState<string>('AUTO');
  const [isSyncingSystem, setIsSyncingSystem] = useState(false);
  
  // Logs
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  
  // Master Data Management
  const [masterData, setMasterData] = useState<MasterDataItem[]>([]);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(false);
  const [selectedListKey, setSelectedListKey] = useState<string>('department');
  const [showAddMasterItem, setShowAddMasterItem] = useState(false);
  const [editingMasterItem, setEditingMasterItem] = useState<MasterDataItem | null>(null);
  const [newMasterItem, setNewMasterItem] = useState({ value: '', description: '' });

  // Duration Select State
  const [durationSelector, setDurationSelector] = useState<{ key: 'PRODUCTION_STATUS' | 'DESIGN_STATUS' | 'PLANNING_STATUS', show: boolean }>({ key: 'PRODUCTION_STATUS', show: false });
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [scheduledStart, setScheduledStart] = useState<string>('');
  const [scheduledEnd, setScheduledEnd] = useState<string>('');

  // UI Customization
  const [uiTheme, setUiTheme] = useState('indigo');
  const [uiFont, setUiFont] = useState('Inter');
  const [uiZoom, setUiZoom] = useState('100');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showConfirmMigration, setShowConfirmMigration] = useState(false);
  
  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });
  
  useEffect(() => {
    setCustomApiUrl(getApiUrl());
    setMasterDataGid(getMasterDataGid());
    setProductionGid(getProductionGid());
    setDesignGid(getDesignGid());
    setBudgetGid(getBudgetGid());
    setSystemLogsGid(getSystemLogsGid());
    
    setUiTheme(localStorage.getItem('APP_THEME_COLOR') || 'indigo');
    setUiFont(localStorage.getItem('APP_THEME_FONT') || 'Inter');
    setUiZoom(localStorage.getItem('APP_THEME_ZOOM') || '100');

    if (activeTab === 'users') loadUsers();
    if (activeTab === 'system') loadSystemConfig();
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'masterData') loadMasterData();
  }, [activeTab]);

  const loadUsers = async () => {
      setIsLoadingUsers(true);
      const data = await fetchSystemUsers();
      setUsers(data);
      setIsLoadingUsers(false);
  };

  const loadMasterData = async () => {
      setIsLoadingMasterData(true);
      const data = await fetchMasterData();
      setMasterData(data);
      setIsLoadingMasterData(false);
  };

  const loadLogs = async () => {
      setIsLoadingLogs(true);
      const data = await fetchSystemLogs();
      setLogs(data);
      setIsLoadingLogs(false);
  };

  const loadSystemConfig = async () => {
      setIsSyncingSystem(true);
      try {
          const masterDataList = await fetchMasterData(); 
          const prodItem = masterDataList.find(i => i.listKey === 'SYSTEM_CONFIG' && i.value === 'PRODUCTION_STATUS');
          const desItem = masterDataList.find(i => i.listKey === 'SYSTEM_CONFIG' && i.value === 'DESIGN_STATUS');
          const planItem = masterDataList.find(i => i.listKey === 'SYSTEM_CONFIG' && i.value === 'PLANNING_STATUS');
          
          setProdStatus(prodItem?.color || 'AUTO');
          setDesignStatus(desItem?.color || 'AUTO');
          setPlanningStatus(planItem?.color || 'AUTO');
      } catch(e) {
          console.error("Load System Config Error", e);
      }
      setIsSyncingSystem(false);
  };

  const handleUpdateSystemStatus = async (key: 'PRODUCTION_STATUS' | 'DESIGN_STATUS' | 'PLANNING_STATUS', newValue: string) => {
      setIsSyncingSystem(true);
      try {
          await saveMasterDataItem({
              id: `cfg-${key.toLowerCase().replace('_', '-')}`,
              listKey: 'SYSTEM_CONFIG',
              value: key,
              color: newValue,
              order: key === 'PRODUCTION_STATUS' ? 10 : key === 'DESIGN_STATUS' ? 11 : 12
          });
          if (key === 'PRODUCTION_STATUS') setProdStatus(newValue);
          else if (key === 'DESIGN_STATUS') setDesignStatus(newValue);
          else setPlanningStatus(newValue);
          
          setDurationSelector({ ...durationSelector, show: false });
      } catch (e) {
          alert("Lỗi khi đồng bộ trạng thái hệ thống.");
      } finally {
          setIsSyncingSystem(false);
      }
  };

  const handleOpenTimed = (key: 'PRODUCTION_STATUS' | 'DESIGN_STATUS' | 'PLANNING_STATUS', mins?: number) => {
      if (!mins) {
          // Vô thời hạn
          handleUpdateSystemStatus(key, 'OPEN');
      } else {
          // Có thời hạn
          const vnTimeString = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
          const vnNow = new Date(vnTimeString).getTime();
          const expiry = vnNow + (mins * 60 * 1000);
          handleUpdateSystemStatus(key, `OPEN|${expiry}`);
      }
  };

  const handleOpenScheduled = (key: 'PRODUCTION_STATUS' | 'DESIGN_STATUS' | 'PLANNING_STATUS') => {
      if (!scheduledStart || !scheduledEnd) {
          alert("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.");
          return;
      }
      const startMs = new Date(scheduledStart).getTime();
      const endMs = new Date(scheduledEnd).getTime();
      if (endMs <= startMs) {
          alert("Thời gian kết thúc phải sau thời gian bắt đầu.");
          return;
      }
      handleUpdateSystemStatus(key, `SCHEDULED|${startMs}|${endMs}`);
  };

  const handleSaveConnection = async () => {
      localStorage.setItem('CUSTOM_API_URL', customApiUrl.trim());
      localStorage.setItem('MASTER_DATA_GID', masterDataGid.trim());
      localStorage.setItem('PRODUCTION_GID', productionGid.trim());
      localStorage.setItem('DESIGN_GID', designGid.trim());
      localStorage.setItem('BUDGET_GID', budgetGid.trim());
      localStorage.setItem('SYSTEM_LOGS_GID', systemLogsGid.trim());
      
      if (customApiUrl && masterDataGid) {
          setIsSaving(true);
          try {
              const saveTasks = [];
              saveTasks.push(saveMasterDataItem({ id: `sys-prod-gid`, listKey: 'SYSTEM_CONFIG', value: 'PRODUCTION_GID', color: productionGid.trim(), order: 1 }));
              saveTasks.push(saveMasterDataItem({ id: `sys-des-gid`, listKey: 'SYSTEM_CONFIG', value: 'DESIGN_GID', color: designGid.trim(), order: 2 }));
              saveTasks.push(saveMasterDataItem({ id: `sys-bdg-gid`, listKey: 'SYSTEM_CONFIG', value: 'BUDGET_GID', color: budgetGid.trim(), order: 3 }));
              saveTasks.push(saveMasterDataItem({ id: `sys-log-gid`, listKey: 'SYSTEM_CONFIG', value: 'SYSTEM_LOGS_GID', color: systemLogsGid.trim(), order: 4 }));
              await Promise.all(saveTasks);
          } catch (e) {
              console.error("Failed to save cloud config", e);
          } finally {
              setIsSaving(false);
          }
      }
      alert("Đã lưu cấu hình và đồng bộ lên hệ thống. Trang sẽ tải lại.");
      window.location.reload();
  };

  const handleSaveUI = () => {
      localStorage.setItem('APP_THEME_COLOR', uiTheme);
      localStorage.setItem('APP_THEME_FONT', uiFont);
      localStorage.setItem('APP_THEME_ZOOM', uiZoom);
      
      setConfirmModal({
          show: true,
          title: "Lưu cài đặt giao diện",
          message: "Đã lưu cài đặt giao diện. Bạn có muốn tải lại trang để áp dụng ngay lập tức không?",
          type: 'warning',
          onConfirm: () => {
              window.location.reload();
          }
      });
  };

  const handleEditClick = (user: UserAccount) => {
      setEditingUser(user);
      setNewUser({
          email: user.email,
          password: user.password || '',
          name: user.name || '',
          role: user.role
      });
      setShowAddUser(true);
  };

  const handleSaveUser = async () => {
      if (!newUser.email || !newUser.password) {
          alert("Vui lòng nhập Email và Mật khẩu");
          return;
      }
      setIsSaving(true);
      try {
          const id = editingUser ? editingUser.id : `user-${Date.now()}`;
          await saveMasterDataItem({
              id,
              listKey: 'SYSTEM_USERS',
              value: newUser.email,
              color: newUser.password,
              textColor: newUser.role,
              description: newUser.name,
              order: 0
          });
          setNewUser({ email: '', password: '', name: '', role: 'member' });
          setEditingUser(null);
          setShowAddUser(false);
          loadUsers();
      } catch (e: any) {
          console.error("Lỗi khi lưu user:", e);
          alert("Lỗi khi lưu user: " + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleCancelUserForm = () => {
      setShowAddUser(false);
      setEditingUser(null);
      setNewUser({ email: '', password: '', name: '', role: 'member' });
  };

  const handleDeleteUser = async (id: string) => {
      setConfirmModal({
          show: true,
          title: "Xác nhận xóa người dùng",
          message: "Bạn có chắc chắn muốn xóa tài khoản này không? Hành động này không thể hoàn tác.",
          type: 'danger',
          onConfirm: async () => {
              setIsSaving(true);
              try {
                  await deleteMasterDataItem(id);
                  loadUsers();
                  setConfirmModal(prev => ({ ...prev, show: false }));
              } catch (e) {
                  alert("Lỗi khi xóa");
              } finally {
                  setIsSaving(false);
              }
          }
      });
  };

  const handleResetDefaults = () => {
      setConfirmModal({
          show: true,
          title: "Khôi phục cài đặt gốc",
          message: "Bạn có chắc chắn muốn khôi phục cài đặt gốc không? Mọi cấu hình kết nối tùy chỉnh sẽ bị xóa.",
          type: 'danger',
          onConfirm: () => {
              localStorage.removeItem('CUSTOM_API_URL');
              localStorage.removeItem('MASTER_DATA_GID');
              localStorage.removeItem('PRODUCTION_GID');
              localStorage.removeItem('DESIGN_GID');
              localStorage.removeItem('BUDGET_GID');
              localStorage.removeItem('SYSTEM_LOGS_GID');
              localStorage.removeItem('APP_THEME_COLOR');
              localStorage.removeItem('APP_THEME_FONT');
              localStorage.removeItem('APP_THEME_ZOOM');
              window.location.reload();
          }
      });
  };

  const handleShareConfig = () => {
      const config = {
          apiUrl: customApiUrl.trim(),
          masterGid: masterDataGid.trim(),
          prodGid: productionGid.trim(),
          designGid: designGid.trim()
      };
      const b64 = btoa(JSON.stringify(config));
      const url = `${window.location.origin}${window.location.pathname}?config=${b64}`;
      navigator.clipboard.writeText(url).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); });
  };

  const isCurrentStatusOpen = (status: string) => status.startsWith('OPEN');
  const isCurrentStatusScheduled = (status: string) => status.startsWith('SCHEDULED');

  const getRoleLabel = (role: string) => {
      if (role === 'admin') return 'Quản trị';
      if (role === 'collaborator') return 'Cộng tác viên';
      return 'Thành viên';
  };

  // Log filter logic
  const filteredLogs = logs.filter(log => 
      log.user.toLowerCase().includes(logFilter.toLowerCase()) || 
      log.action.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.target.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.details.toLowerCase().includes(logFilter.toLowerCase())
  );

  const getLogActionColor = (action: string) => {
      if (action.includes('CREATE')) return 'text-green-600 bg-green-50 border-green-100';
      if (action.includes('UPDATE')) return 'text-blue-600 bg-blue-50 border-blue-100';
      if (action.includes('DELETE')) return 'text-red-600 bg-red-50 border-red-100';
      return 'text-gray-600 bg-gray-50 border-gray-100';
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white/80 backdrop-blur-2xl w-full max-w-5xl rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] flex flex-col animate-in zoom-in-95 duration-500 ease-out overflow-hidden border border-white/40 h-[85vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100/50 flex justify-between items-center bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl shadow-slate-900/20 ring-4 ring-slate-900/10">
              <ShieldCheck size={22} strokeWidth={2.5} />
            </div>
            <div>
               <h3 className="text-xl font-black text-slate-900 tracking-tight">Quản trị hệ thống</h3>
               <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5">Cấu hình cấp cao & Bảo mật</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 hover:bg-white/80 rounded-2xl text-slate-400 hover:text-red-500 transition-all duration-300 hover:rotate-90 border border-transparent hover:border-red-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-gray-100/50 px-8 shrink-0 overflow-x-auto no-scrollbar bg-white/30">
            {[
              { id: 'system', label: 'Khóa/Mở Bảng', icon: <Lock size={16}/> },
              { id: 'users', label: 'Người dùng', icon: <Users size={16}/> },
              { id: 'ui', label: 'Giao diện', icon: <Monitor size={16}/> },
              { id: 'logs', label: 'Nhật ký', icon: <FileText size={16}/> },
              { id: 'masterData', label: 'Danh mục', icon: <Type size={16}/> },
              { id: 'migration', label: 'Chuyển đổi', icon: <RefreshCw size={16}/> },
              { id: 'connection', label: 'Kết nối API', icon: <Globe size={16}/> },
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`px-5 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all duration-300 flex items-center gap-2 whitespace-nowrap relative group ${
                  activeTab === tab.id 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-white/50'
                }`}
              >
                <span className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {tab.icon}
                </span>
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-in fade-in slide-in-from-bottom-1 duration-300"></div>
                )}
              </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="p-8 bg-transparent overflow-y-auto flex-1 custom-scrollbar">
            
            {/* TAB: MASTER DATA */}
            {activeTab === 'masterData' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <select value={selectedListKey} onChange={(e) => { setSelectedListKey(e.target.value); setEditingMasterItem(null); setShowAddMasterItem(false); }} className="p-2 border rounded-lg text-xs font-bold">
                            {['department', 'orderer', 'status', 'category', 'productType', 'classType', 'platform', 'stylist', 'videoPerson', 'photoPerson', 'designer'].map(key => <option key={key} value={key}>{key}</option>)}
                        </select>
                        {!showAddMasterItem && !editingMasterItem && <button onClick={() => { setNewMasterItem({ value: '', description: '' }); setShowAddMasterItem(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1"><Plus size={14}/> Thêm mục</button>}
                    </div>

                    {(showAddMasterItem || editingMasterItem) && (
                        <div className="p-4 rounded-xl border mb-4 bg-indigo-50 border-indigo-200">
                             <h4 className="font-bold text-indigo-900 text-xs mb-3">{editingMasterItem ? 'Sửa mục' : 'Thêm mục mới'}</h4>
                             <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Giá trị</label><input type="text" value={newMasterItem.value} onChange={e => setNewMasterItem({...newMasterItem, value: e.target.value})} className="w-full text-xs p-2 border rounded bg-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Mô tả</label><input type="text" value={newMasterItem.description} onChange={e => setNewMasterItem({...newMasterItem, description: e.target.value})} className="w-full text-xs p-2 border rounded bg-white" /></div>
                             </div>
                             <div className="flex justify-end gap-2">
                                <button onClick={() => { setShowAddMasterItem(false); setEditingMasterItem(null); }} className="text-xs font-bold text-gray-500 px-3 py-1.5 hover:bg-gray-200 rounded">Hủy</button>
                                <button onClick={async () => {
                                    setIsSaving(true);
                                    const id = editingMasterItem ? editingMasterItem.id : `${selectedListKey}-${Date.now()}`;
                                    await saveMasterDataItem({ id, listKey: selectedListKey, value: newMasterItem.value, description: newMasterItem.description, order: 0 });
                                    setIsSaving(false);
                                    setShowAddMasterItem(false);
                                    setEditingMasterItem(null);
                                    loadMasterData();
                                }} className="text-xs font-bold text-white px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700">{editingMasterItem ? 'Cập nhật' : 'Lưu'}</button>
                             </div>
                        </div>
                    )}

                    {isLoadingMasterData ? <div className="text-center py-8 text-gray-400"><Loader2 className="animate-spin mx-auto mb-2"/> Đang tải...</div> : (
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 border-b border-gray-100 font-bold text-gray-500 uppercase">
                                    <tr><th className="p-3">Giá trị</th><th className="p-3">Mô tả</th><th className="p-3 text-right">Hành động</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {Array.from(new Map<string, MasterDataItem>(masterData.filter(item => item.listKey === selectedListKey).map(item => [item.id, item])).values()).map((item, index) => (
                                        <tr key={`${selectedListKey}-${item.id}-${index}`} className="hover:bg-indigo-50/50">
                                            <td className="p-3 font-medium text-indigo-900">{item.value}</td>
                                            <td className="p-3 text-gray-600">{item.description || '--'}</td>
                                            <td className="p-3 text-right flex items-center justify-end gap-2">
                                                <button onClick={() => { setEditingMasterItem(item); setNewMasterItem({ value: item.value, description: item.description || '' }); setShowAddMasterItem(false); }} className="p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"><Pencil size={14}/></button>
                                                <button onClick={() => {
                                                    setConfirmModal({
                                                        show: true,
                                                        title: "Xác nhận xóa mục",
                                                        message: `Bạn có chắc chắn muốn xóa mục "${item.value}" khỏi danh mục ${selectedListKey} không?`,
                                                        type: 'danger',
                                                        onConfirm: async () => {
                                                            await deleteMasterDataItem(item.id);
                                                            loadMasterData();
                                                            setConfirmModal(prev => ({ ...prev, show: false }));
                                                        }
                                                    });
                                                }} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={14}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            
            {/* TAB: SYSTEM LOGS */}
            {activeTab === 'logs' && (
                <div className="space-y-4 h-full flex flex-col">
                    <div className="flex justify-between items-center gap-4 shrink-0">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder="Tìm kiếm theo User, Hành động, Mã Order..." 
                                value={logFilter}
                                onChange={(e) => setLogFilter(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                            />
                        </div>
                        <button onClick={loadLogs} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
                            {isLoadingLogs ? <Loader2 size={16} className="animate-spin"/> : <RotateCcw size={16}/>}
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden border border-gray-100 rounded-xl bg-white relative">
                        {isLoadingLogs && logs.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                <Loader2 size={24} className="animate-spin mb-2"/>
                                <span className="text-xs">Đang tải nhật ký...</span>
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs italic">
                                Không có dữ liệu
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-3 w-32">Thời gian</th>
                                            <th className="p-3 w-40">User</th>
                                            <th className="p-3 w-32">Hành động</th>
                                            <th className="p-3 w-32">Đối tượng</th>
                                            <th className="p-3">Chi tiết</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredLogs.slice(0, 100).map((log) => (
                                            <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="p-3 font-mono text-gray-500 whitespace-nowrap">{log.timestamp}</td>
                                                <td className="p-3 font-bold text-gray-700">{log.user}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded border text-[10px] font-black uppercase ${getLogActionColor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono font-medium text-indigo-700">{log.target}</td>
                                                <td className="p-3 text-gray-600 break-words max-w-xs">{log.details}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredLogs.length > 100 && (
                                    <div className="p-3 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100">
                                        Hiển thị 100 logs gần nhất (Tổng: {filteredLogs.length})
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* TAB: SYSTEM MANAGEMENT */}
            {activeTab === 'system' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                     <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-3">
                        <Info className="text-indigo-600" size={20}/>
                        <p className="text-xs text-indigo-800 font-medium">
                            <b>Mở có thời hạn:</b> Admin có thể chọn mở bảng trong khoảng thời gian nhất định để nhân viên cập nhật dữ liệu.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                         {durationSelector.show && (
                            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
                                <div className="bg-white border border-indigo-200 shadow-2xl rounded-3xl p-6 w-full max-w-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-black text-gray-800 text-sm flex items-center gap-2 uppercase">
                                            <Clock size={16} className="text-indigo-600"/> Chọn thời gian mở
                                        </h4>
                                        <button onClick={() => setDurationSelector({ ...durationSelector, show: false })} className="p-1 hover:bg-gray-100 rounded-full"><X size={16}/></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[
                                            { label: '15 phút', mins: 15 },
                                            { label: '30 phút', mins: 30 },
                                            { label: '1 giờ', mins: 60 },
                                            { label: 'Vô thời hạn', mins: 0 }
                                        ].map(opt => (
                                            <button 
                                                key={opt.label}
                                                onClick={() => handleOpenTimed(durationSelector.key, opt.mins || undefined)}
                                                className="py-2.5 px-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all"
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="pt-4 border-t border-gray-100">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Hoặc nhập thủ công (phút):</label>
                                        <div className="flex gap-2 mb-4">
                                            <input 
                                                type="number" 
                                                placeholder="VD: 120"
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
                                                value={customMinutes}
                                                onChange={(e) => setCustomMinutes(e.target.value)}
                                            />
                                            <button 
                                                onClick={() => {
                                                    const mins = parseInt(customMinutes, 10);
                                                    if (mins > 0) handleOpenTimed(durationSelector.key, mins);
                                                }}
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all"
                                            >
                                                Mở
                                            </button>
                                        </div>

                                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Hoặc đặt lịch mở (Khoảng ngày):</label>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase ml-1">Bắt đầu</span>
                                                    <input 
                                                        type="datetime-local" 
                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] outline-none focus:border-indigo-500"
                                                        value={scheduledStart}
                                                        onChange={(e) => setScheduledStart(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase ml-1">Kết thúc</span>
                                                    <input 
                                                        type="datetime-local" 
                                                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] outline-none focus:border-indigo-500"
                                                        value={scheduledEnd}
                                                        onChange={(e) => setScheduledEnd(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleOpenScheduled(durationSelector.key)}
                                                className="w-full bg-indigo-100 text-indigo-700 py-2 rounded-xl text-xs font-bold hover:bg-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                            >
                                                <CalendarRange size={14}/> Đặt lịch mở
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PRODUCTION LOCK CONTROL */}
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="text-orange-500" size={18}/>
                                <h4 className="font-black text-gray-800 uppercase tracking-tight text-sm">Bảng Production</h4>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleUpdateSystemStatus('PRODUCTION_STATUS', 'AUTO')} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${prodStatus === 'AUTO' ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${prodStatus === 'AUTO' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}><RotateCcw size={14}/></div><span className={`text-xs font-bold ${prodStatus === 'AUTO' ? 'text-gray-800' : 'text-gray-500'}`}>Tự động (Thứ 5)</span></div>{prodStatus === 'AUTO' && <Check size={16} className="text-indigo-600"/>}</button>
                                <button onClick={() => setDurationSelector({ key: 'PRODUCTION_STATUS', show: true })} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isCurrentStatusOpen(prodStatus) || isCurrentStatusScheduled(prodStatus) ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${isCurrentStatusOpen(prodStatus) || isCurrentStatusScheduled(prodStatus) ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}><Unlock size={14}/></div><span className={`text-xs font-bold ${isCurrentStatusOpen(prodStatus) || isCurrentStatusScheduled(prodStatus) ? 'text-gray-800' : 'text-gray-500'}`}>{isCurrentStatusScheduled(prodStatus) ? 'Theo lịch' : 'Luôn Mở'}</span></div>{(isCurrentStatusOpen(prodStatus) || isCurrentStatusScheduled(prodStatus)) && <Check size={16} className="text-emerald-600"/>}</button>
                                <button onClick={() => handleUpdateSystemStatus('PRODUCTION_STATUS', 'LOCKED')} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${prodStatus === 'LOCKED' ? 'bg-white border-red-500 shadow-md ring-1 ring-red-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${prodStatus === 'LOCKED' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}><Lock size={14}/></div><span className={`text-xs font-bold ${prodStatus === 'LOCKED' ? 'text-gray-800' : 'text-gray-500'}`}>Luôn Khóa</span></div>{prodStatus === 'LOCKED' && <Check size={16} className="text-red-600"/>}</button>
                            </div>
                        </div>

                        {/* DESIGN LOCK CONTROL */}
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Palette className="text-pink-500" size={18}/>
                                <h4 className="font-black text-gray-800 uppercase tracking-tight text-sm">Bảng Design</h4>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleUpdateSystemStatus('DESIGN_STATUS', 'AUTO')} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${designStatus === 'AUTO' ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${designStatus === 'AUTO' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}><RotateCcw size={14}/></div><span className={`text-xs font-bold ${designStatus === 'AUTO' ? 'text-gray-800' : 'text-gray-500'}`}>Tự động (Thứ 5)</span></div>{designStatus === 'AUTO' && <Check size={16} className="text-indigo-600"/>}</button>
                                <button onClick={() => setDurationSelector({ key: 'DESIGN_STATUS', show: true })} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isCurrentStatusOpen(designStatus) || isCurrentStatusScheduled(designStatus) ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${isCurrentStatusOpen(designStatus) || isCurrentStatusScheduled(designStatus) ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}><Unlock size={14}/></div><span className={`text-xs font-bold ${isCurrentStatusOpen(designStatus) || isCurrentStatusScheduled(designStatus) ? 'text-gray-800' : 'text-gray-500'}`}>{isCurrentStatusScheduled(designStatus) ? 'Theo lịch' : 'Luôn Mở'}</span></div>{(isCurrentStatusOpen(designStatus) || isCurrentStatusScheduled(designStatus)) && <Check size={16} className="text-emerald-600"/>}</button>
                                <button onClick={() => handleUpdateSystemStatus('DESIGN_STATUS', 'LOCKED')} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${designStatus === 'LOCKED' ? 'bg-white border-red-500 shadow-md ring-1 ring-red-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${designStatus === 'LOCKED' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}><Lock size={14}/></div><span className={`text-xs font-bold ${designStatus === 'LOCKED' ? 'text-gray-800' : 'text-gray-500'}`}>Luôn Khóa</span></div>{designStatus === 'LOCKED' && <Check size={16} className="text-red-600"/>}</button>
                            </div>
                        </div>

                        {/* PLANNING LOCK CONTROL - NEW */}
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CalendarRange className="text-indigo-500" size={18}/>
                                <h4 className="font-black text-gray-800 uppercase tracking-tight text-sm">Bảng Planning</h4>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleUpdateSystemStatus('PLANNING_STATUS', 'AUTO')} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${planningStatus === 'AUTO' ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${planningStatus === 'AUTO' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}><RotateCcw size={14}/></div><span className={`text-xs font-bold ${planningStatus === 'AUTO' ? 'text-gray-800' : 'text-gray-500'}`}>Tự động (Thứ 5)</span></div>{planningStatus === 'AUTO' && <Check size={16} className="text-indigo-600"/>}</button>
                                <button onClick={() => setDurationSelector({ key: 'PLANNING_STATUS', show: true })} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isCurrentStatusOpen(planningStatus) || isCurrentStatusScheduled(planningStatus) ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${isCurrentStatusOpen(planningStatus) || isCurrentStatusScheduled(planningStatus) ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}><Unlock size={14}/></div><span className={`text-xs font-bold ${isCurrentStatusOpen(planningStatus) || isCurrentStatusScheduled(planningStatus) ? 'text-gray-800' : 'text-gray-500'}`}>{isCurrentStatusScheduled(planningStatus) ? 'Theo lịch' : 'Luôn Mở'}</span></div>{(isCurrentStatusOpen(planningStatus) || isCurrentStatusScheduled(planningStatus)) && <Check size={16} className="text-emerald-600"/>}</button>
                                <button onClick={() => handleUpdateSystemStatus('PLANNING_STATUS', 'LOCKED')} disabled={isSyncingSystem} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${planningStatus === 'LOCKED' ? 'bg-white border-red-500 shadow-md ring-1 ring-red-200' : 'bg-transparent border-gray-200 hover:bg-white hover:border-gray-300'}`}><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${planningStatus === 'LOCKED' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}><Lock size={14}/></div><span className={`text-xs font-bold ${planningStatus === 'LOCKED' ? 'text-gray-800' : 'text-gray-500'}`}>Luôn Khóa</span></div>{planningStatus === 'LOCKED' && <Check size={16} className="text-red-600"/>}</button>
                            </div>
                        </div>
                    </div>

                    {isSyncingSystem && (
                        <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-xs animate-pulse">
                            <Loader2 size={16} className="animate-spin"/>
                            Đang đồng bộ trạng thái hệ thống...
                        </div>
                    )}
                </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4 gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder="Tìm kiếm theo Email hoặc Họ tên..." 
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                            />
                        </div>
                        <div className="flex gap-2">
                            {selectedUsers.size > 0 && (
                                <button onClick={handleDeleteSelectedUsers} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 flex items-center gap-1 shadow-sm">
                                    <Trash2 size={14}/> Xóa ({selectedUsers.size})
                                </button>
                            )}
                            {!showAddUser && <button onClick={() => { setEditingUser(null); setNewUser({ email: '', password: '', name: '', role: 'member' }); setShowAddUser(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm"><Plus size={14}/> Thêm User</button>}
                        </div>
                    </div>

                    {showAddUser && (
                        <div className={`p-4 rounded-xl border mb-4 animate-in slide-in-from-top-2 ${editingUser ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                             <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Email</label><input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full text-xs p-2 border rounded bg-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Mật khẩu</label><input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full text-xs p-2 border rounded bg-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Họ tên (để lọc job CTV)</label><input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full text-xs p-2 border rounded bg-white" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Vai trò</label><select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full text-xs p-2 border rounded bg-white"><option value="member">Thành viên</option><option value="collaborator">Cộng tác viên</option><option value="admin">Quản trị</option></select></div>
                             </div>
                             <div className="flex justify-end gap-2"><button onClick={handleCancelUserForm} className="text-xs font-bold text-gray-500 px-3 py-1.5 hover:bg-gray-200 rounded">Hủy</button><button onClick={handleSaveUser} disabled={isSaving} className={`text-xs font-bold text-white px-3 py-1.5 rounded flex items-center gap-1 ${editingUser ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'}`}>{isSaving && <Loader2 size={12} className="animate-spin"/>} {editingUser ? 'Cập nhật' : 'Lưu User'}</button></div>
                        </div>
                    )}

                    {isLoadingUsers ? <div className="text-center py-8 text-gray-400"><Loader2 className="animate-spin mx-auto mb-2"/> Đang tải...</div> : (
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 border-b border-gray-100 font-bold text-gray-500 uppercase">
                                    <tr>
                                        <th className="p-3 w-10">
                                            <input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleAllUsers} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        </th>
                                        <th className="p-3">Tài khoản</th>
                                        <th className="p-3">Họ tên</th>
                                        <th className="p-3">Vai trò</th>
                                        <th className="p-3 text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-indigo-50/50">
                                            <td className="p-3">
                                                <input type="checkbox" checked={selectedUsers.has(user.id)} onChange={() => toggleUserSelection(user.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            </td>
                                            <td className="p-3 font-medium text-indigo-900">{user.email}</td>
                                            <td className="p-3 text-gray-600">{user.name || '--'}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : user.role === 'collaborator' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                                                    {getRoleLabel(user.role)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => handleEditClick(user)} disabled={isSaving} className="p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"><Pencil size={14}/></button>
                                                    <button onClick={() => handleDeleteUser(user.id)} disabled={isSaving} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={14}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: UI */}
            {activeTab === 'ui' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="space-y-3"><label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Palette size={16} className="text-indigo-600"/> Theme Màu Chủ Đạo</label><div className="grid grid-cols-5 gap-3">{[{ id: 'indigo', name: 'Indigo', color: '#6366f1' }, { id: 'blue', name: 'Blue', color: '#3b82f6' }, { id: 'rose', name: 'Rose', color: '#f43f5e' }, { id: 'emerald', name: 'Emerald', color: '#10b981' }, { id: 'slate', name: 'Slate', color: '#64748b' }].map(theme => (<button key={theme.id} onClick={() => setUiTheme(theme.id)} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${uiTheme === theme.id ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-500' : 'border-gray-200 hover:bg-gray-50'}`}><div className="w-8 h-8 rounded-full shadow-sm" style={{ backgroundColor: theme.color }}></div><span className="text-[10px] font-bold text-gray-600">{theme.name}</span></button>))}</div></div>
                    <div className="space-y-3"><label className="text-sm font-bold text-gray-700 flex items-center gap-2"><ZoomIn size={16} className="text-indigo-600"/> Kích thước hiển thị</label><div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200"><input type="range" min="85" max="110" step="5" value={uiZoom} onChange={(e) => setUiZoom(e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" /><span className="text-sm font-bold text-indigo-700 min-w-[3rem] text-right">{uiZoom}%</span></div></div>
                    <div className="pt-4 border-t border-gray-100 flex justify-end"><button onClick={handleSaveUI} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95"><Check size={18}/> Áp dụng giao diện</button></div>
                </div>
            )}

            {/* TAB: MIGRATION */}
            {activeTab === 'migration' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><AlertCircle size={24}/></div>
                            <h4 className="font-black text-orange-900 uppercase tracking-tight">Chuyển dữ liệu sang Firebase</h4>
                        </div>
                        <p className="text-sm text-orange-800 leading-relaxed">
                            Công cụ này sẽ sao chép toàn bộ dữ liệu từ các bảng Google Sheets hiện tại (Production, Design, Budget, Planning, Master Data) sang cơ sở dữ liệu Firebase Firestore của bạn.
                        </p>
                        <ul className="mt-3 space-y-2 text-xs text-orange-700 font-medium list-disc ml-5">
                            <li>Dữ liệu trên Google Sheets sẽ KHÔNG bị xóa.</li>
                            <li>Nếu dữ liệu đã tồn tại trên Firebase, nó sẽ được cập nhật (ghi đè nếu trùng ID).</li>
                            <li>Quá trình này có thể mất vài phút tùy thuộc vào lượng dữ liệu.</li>
                        </ul>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <h4 className="font-bold text-gray-800">Chuẩn hóa mã đơn hàng</h4>
                            <p className="text-xs text-gray-500">Cập nhật định dạng mã đơn hàng cũ (ví dụ: Pro01) sang định dạng 7 ký tự (ví dụ: Pro0001) để đảm bảo tính duy nhất và sắp xếp đúng.</p>
                            <button 
                                onClick={() => setShowConfirmMigration(true)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <RefreshCw size={14}/> Chuẩn hóa mã đơn hàng (Pro & Des)
                            </button>
                            {showConfirmMigration && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                                    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                                        <h3 className="font-bold text-gray-800 mb-4">Xác nhận chuẩn hóa?</h3>
                                        <p className="text-sm text-gray-600 mb-6">Bạn có chắc chắn muốn chuẩn hóa toàn bộ mã đơn hàng (Pro và Des) sang định dạng 7 ký tự không?</p>
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => setShowConfirmMigration(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Hủy</button>
                                            <button 
                                                onClick={async () => {
                                                    setShowConfirmMigration(false);
                                                    try {
                                                        const { migrateOrderCodes } = await import('../services/firebaseService');
                                                        // Chạy cho Production (gid '0')
                                                        await migrateOrderCodes('0', 'Pro');
                                                        // Chạy cho Design (gid '644651369' - mặc định từ getDesignGid)
                                                        await migrateOrderCodes('644651369', 'Des');
                                                        alert("Đã chuẩn hóa dữ liệu cho cả Pro và Des thành công!");
                                                    } catch (error) {
                                                        console.error("Lỗi di chuyển dữ liệu:", error);
                                                        alert("Có lỗi xảy ra khi chuẩn hóa dữ liệu.");
                                                    }
                                                }} 
                                                className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors"
                                            >
                                                Xác nhận
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                            {migrationProgress.status === 'idle' ? (
                                <div className="text-center space-y-4">
                                    <p className="text-sm text-gray-500">Nhấn nút bên dưới để bắt đầu quá trình chuyển đổi dữ liệu Sheets sang Firebase.</p>
                                    <button 
                                        onClick={() => migrateSheetsToFirebase(setMigrationProgress)}
                                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                                    >
                                        <RefreshCw size={18}/> Bắt đầu chuyển đổi Sheets
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{migrationProgress.step}</span>
                                            <h5 className="font-bold text-gray-800">{migrationProgress.message || 'Đang xử lý...'}</h5>
                                        </div>
                                        <span className="text-xs font-bold text-gray-500">{migrationProgress.current} / {migrationProgress.total}</span>
                                    </div>

                                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                        <div 
                                            className={`h-full transition-all duration-300 ${migrationProgress.status === 'success' ? 'bg-green-500' : migrationProgress.status === 'error' ? 'bg-red-500' : 'bg-indigo-600'}`}
                                            style={{ width: `${migrationProgress.total > 0 ? (migrationProgress.current / migrationProgress.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>

                                    {migrationProgress.status === 'running' && (
                                        <div className="flex items-center justify-center gap-2 text-indigo-600 text-xs font-bold animate-pulse">
                                            <Loader2 size={16} className="animate-spin"/> Vui lòng không đóng cửa sổ này...
                                        </div>
                                    )}

                                    {migrationProgress.status === 'success' && (
                                        <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center gap-3 text-green-700">
                                            <CheckCircle2 size={24}/>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm">Thành công!</p>
                                                <p className="text-xs">Dữ liệu đã được chuyển sang Firebase.</p>
                                            </div>
                                            <button 
                                                onClick={() => setMigrationProgress({ step: '', current: 0, total: 0, status: 'idle' })}
                                                className="text-xs font-bold underline"
                                            >
                                                Làm lại
                                            </button>
                                        </div>
                                    )}

                                    {migrationProgress.status === 'error' && (
                                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-700">
                                            <AlertCircle size={24}/>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm">Đã xảy ra lỗi</p>
                                                <p className="text-xs">{migrationProgress.message}</p>
                                            </div>
                                            <button 
                                                onClick={() => setMigrationProgress({ step: '', current: 0, total: 0, status: 'idle' })}
                                                className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold"
                                            >
                                                Thử lại
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: CONNECTION */}
            {activeTab === 'connection' && (
                <div className="space-y-6">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 shrink-0"><Share2 size={20}/></div>
                        <div className="flex-1">
                            <h4 className="font-bold text-indigo-900 text-sm">Chia sẻ cấu hình</h4>
                            <p className="text-xs text-indigo-700 mt-1 mb-3 leading-relaxed">Gửi link này cho nhân viên để đồng bộ cài đặt tự động.</p>
                            <button onClick={handleShareConfig} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm active:scale-95">
                                {copiedLink ? <Check size={14}/> : <Copy size={14}/>} {copiedLink ? 'Đã sao chép link!' : 'Sao chép Link cấu hình'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                        <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                            <Zap size={16} className="text-yellow-500" /> Nguồn dữ liệu (Data Source)
                        </h4>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setServiceType('sheets')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${!isFirebase ? 'bg-white border-green-500 text-green-700 shadow-sm' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'}`}
                            >
                                Google Sheets
                            </button>
                            <button 
                                onClick={() => setServiceType('firebase')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${isFirebase ? 'bg-white border-orange-500 text-orange-700 shadow-sm' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'}`}
                            >
                                Firebase (Firestore)
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 italic">
                            * Lưu ý: Chuyển đổi nguồn dữ liệu sẽ tải lại ứng dụng. Đảm bảo bạn đã cấu hình đúng thông tin kết nối.
                        </p>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">1. Google Script API URL</label>
                            <input type="text" className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-600 focus:ring-2 focus:ring-indigo-200 outline-none" value={customApiUrl} onChange={(e) => setCustomApiUrl(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-gray-700 block mb-1">2. Production GID</label>
                                <input type="text" className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-600" value={productionGid} onChange={(e) => setProductionGid(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-700 block mb-1">3. Design GID</label>
                                <input type="text" className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-600" value={designGid} onChange={(e) => setDesignGid(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-gray-700 block mb-1">4. MasterData GID</label>
                                <input type="text" className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-600" value={masterDataGid} onChange={(e) => setMasterDataGid(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-700 block mb-1">5. Budget GID (Admin)</label>
                                <input type="text" className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-600" value={budgetGid} onChange={(e) => setBudgetGid(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-1">6. System Logs GID (Admin)</label>
                            <input type="text" className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono text-gray-600" value={systemLogsGid} onChange={(e) => setSystemLogsGid(e.target.value)} />
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                            <button onClick={handleResetDefaults} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 hover:text-red-600 transition-colors flex items-center justify-center gap-2"><RotateCcw size={18}/></button>
                            <button onClick={handleSaveConnection} disabled={isSaving} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Lưu & Đồng bộ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Custom Confirmation Modal */}
        {confirmModal.show && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${confirmModal.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                            <AlertCircle size={24}/>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">{confirmModal.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">{confirmModal.message}</p>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))} 
                            className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={confirmModal.onConfirm} 
                            className={`px-5 py-2 text-sm font-bold text-white rounded-xl transition-all shadow-sm active:scale-95 ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                        >
                            Xác nhận
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
