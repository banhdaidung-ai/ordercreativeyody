
import React, { useState, useEffect, useRef } from 'react';
import { WorkOrderTable } from './components/WorkOrderTable';
import { SettingsModal } from './components/SettingsModal';
import { LandingPage } from './components/LandingPage';
import { BudgetTable } from './components/BudgetTable';
import { PlanningTable } from './components/PlanningTable';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { useSync } from './src/components/SyncManager';
import { getProductionGid, getDesignGid, fetchSystemUsers } from './services/dataService';
import { Sparkles, Bell, Info, Mail, LogIn, ShieldCheck, ArrowRight, Settings, CheckCircle2, AlertCircle, Lock, LogOut, Home, Eye, EyeOff, User, Key } from 'lucide-react';

// --- THEME DEFINITIONS ---
export const COLOR_PALETTES: Record<string, any> = {
  indigo: {
    50: '238 242 255', 100: '224 231 255', 200: '199 210 254', 300: '165 180 252',
    400: '129 140 248', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202',
    800: '55 48 163', 900: '49 46 129', 950: '30 27 75'
  },
  blue: {
    50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253',
    400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216',
    800: '30 64 175', 900: '30 58 138', 950: '23 37 84'
  },
  rose: {
    50: '255 241 242', 100: '255 228 230', 200: '254 205 211', 300: '165 180 252',
    400: '129 140 248', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202',
    800: '55 48 163', 900: '136 19 55', 950: '76 5 25'
  },
  emerald: {
    50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183',
    400: '52 211 153', 500: '16 185 129', 600: '5 150 105', 700: '4 120 87',
    800: '6 95 70', 900: '6 78 59', 950: '2 44 34'
  },
  slate: {
    50: '248 250 252', 100: '241 245 249', 200: '226 232 240', 300: '203 213 225',
    400: '148 163 184', 500: '100 116 139', 600: '71 85 105', 700: '51 65 85',
    800: '30 41 59', 900: '15 23 42', 950: '2 6 23'
  }
};

const applyTheme = () => {
  try {
    const savedTheme = localStorage.getItem('APP_THEME_COLOR') || 'indigo';
    const savedFont = localStorage.getItem('APP_THEME_FONT') || 'Inter';
    const savedZoom = localStorage.getItem('APP_THEME_ZOOM') || '100';

    const root = document.documentElement;
    const palette = COLOR_PALETTES[savedTheme] || COLOR_PALETTES['indigo'];

    // Apply Colors
    Object.keys(palette).forEach(key => {
      root.style.setProperty(`--c-${key}`, palette[key]);
    });

    // Apply Font
    root.style.setProperty('--font-main', savedFont);

    // Apply Zoom (FontSize)
    const zoomVal = parseInt(savedZoom, 10);
    root.style.fontSize = `${(zoomVal / 100) * 16}px`;

  } catch (e) {
    console.error("Theme Error", e);
  }
};

function App() {
  const { startSync, stopSync } = useSync();
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<'admin' | 'member' | 'collaborator'>('member');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [oobCode, setOobCode] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  
  // User Dropdown State
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // VIEW STATES
  const [currentView, setCurrentView] = useState<'landing' | 'app' | 'budget' | 'planning'>('landing');
  const [initialTab, setInitialTab] = useState<string>('');
  const [autoCreateOrder, setAutoCreateOrder] = useState<boolean>(false);
  const [initialViewMode, setInitialViewMode] = useState<'table' | 'tracking' | 'report'>('table');

  useEffect(() => {
    applyTheme();
    
    // Check for existing session
    const savedUser = localStorage.getItem('currentUser');
    const savedRole = localStorage.getItem('userRole');
    const savedName = localStorage.getItem('currentUserName');

    
    if (savedUser && savedRole) {
        setIsAuthenticated(true);
        setCurrentUser(savedUser);
        setCurrentUserName(savedName || '');
        setUserRole(savedRole as 'admin' | 'member' | 'collaborator');
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
        const { signInWithGoogle } = await import("./services/authService");
        const user = await signInWithGoogle();
        if (user) {
            // Check if this Google user exists in our system users
            const users = await fetchSystemUsers();
            const foundUser = users.find(u => u.email.trim().toLowerCase() === user.email?.toLowerCase().trim());
            
            setIsAuthenticated(true);
            setCurrentUser(user.email || '');
            setCurrentUserName(user.displayName || foundUser?.name || '');
            setUserRole(foundUser?.role || 'member');
            
            localStorage.setItem('currentUser', user.email || '');
            localStorage.setItem('currentUserName', user.displayName || foundUser?.name || '');
            localStorage.setItem('userRole', foundUser?.role || 'member');
            
            setCurrentView('app');
        }
    } catch (err: any) {
        console.error("Google Login error:", err);
        setLoginError('Lỗi khi đăng nhập bằng Google. Vui lòng thử lại.');
    } finally {
        setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!inputEmail || !inputPassword) {
        setLoginError('Vui lòng nhập Email và Mật khẩu.');
        return;
    }
    setIsLoggingIn(true);
    setLoginError('');
    try {
        const users = await fetchSystemUsers();

        const foundUser = users.find(u => u.email.trim().toLowerCase() === inputEmail.trim().toLowerCase() && u.password === inputPassword);
        
        if (foundUser) {

            
            setIsAuthenticated(true);
            setCurrentUser(foundUser.email);
            setCurrentUserName(foundUser.name || '');
            setUserRole(foundUser.role);
            localStorage.setItem('currentUser', foundUser.email);
            localStorage.setItem('currentUserName', foundUser.name || '');
            localStorage.setItem('userRole', foundUser.role);
            setCurrentView('app');
        } else {

            setLoginError('Email hoặc mật khẩu không chính xác.');
        }
    } catch (err: any) {
        console.error("Login error:", err);
        setLoginError('Lỗi khi đăng nhập. Vui lòng thử lại.');
    } finally {
        setIsLoggingIn(false);
    }
  };


  const handleForgotPassword = async () => {
    setResetMessage('Tính năng này hiện không khả dụng.');
  };

  const performLogout = async () => {
    setIsAuthenticated(false);
    setCurrentUser('');
    setCurrentUserName('');
    setUserRole('member');
    setCurrentView('landing');
    setShowLogoutModal(false);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentUserName');
    localStorage.removeItem('userRole');
  };

  const isAdmin = userRole === 'admin';
  const isOwner = userRole === 'admin' || userRole === 'member';

  // Helper for role display
  const getRoleLabel = () => {
    if (userRole === 'admin') return 'Administrator';
    if (userRole === 'member') return 'Thành viên';
    if (userRole === 'collaborator') return 'Cộng tác viên';
    return 'User';
  };

  const handleProductionOrder = () => {
    setInitialTab(getProductionGid());
    setAutoCreateOrder(false); 
    setInitialViewMode('table');
    setCurrentView('app');
  };

  const handleDesignOrder = () => {
    setInitialTab(getDesignGid());
    setAutoCreateOrder(false); 
    setInitialViewMode('table');
    setCurrentView('app');
  };

  const handleProductionPlan = () => {
    setInitialTab(getProductionGid());
    setAutoCreateOrder(false);
    setInitialViewMode('tracking');
    setCurrentView('app');
  };

  const handleDesignPlan = () => {
    setInitialTab(getDesignGid());
    setAutoCreateOrder(false);
    setInitialViewMode('tracking');
    setCurrentView('app');
  };
  
  const handleBudgetView = () => {
      setCurrentView('budget');
  };

  const handlePlanningView = () => {
      setCurrentView('planning');
  };

  const handleGoHome = () => {
    setCurrentView('landing');
  };

  const handleSettingsClose = () => {
      setShowSettings(false);
      applyTheme();
  };

  if (!isAuthenticated) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center relative overflow-hidden">
         {/* Using mesh-bg from index.html as the primary background */}
         
         
         <div className="z-10 w-full max-w-md p-6"><div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 transform transition-all animate-in zoom-in-95 duration-500">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30 mx-auto mb-4 transform rotate-3">
                        <span className="text-3xl">W</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 tracking-tight">Hệ thống quản trị order Creative</h1>
                    <p className="text-sm text-gray-500 mt-2 font-medium">Đăng nhập để quản lý công việc</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleEmailLogin(); }} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input 
                            type="email" 
                            value={inputEmail} 
                            onChange={(e) => setInputEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            placeholder="email@yody.vn"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={inputPassword} 
                                onChange={(e) => setInputPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                placeholder="••••••••"
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setShowForgotPassword(true)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 mt-2 font-medium"
                        >
                            Quên mật khẩu?
                        </button>
                    </div>
                    {loginError && <p className="text-red-500 text-sm font-medium">{loginError}</p>}
                    <button 
                        type="submit" 
                        disabled={isLoggingIn}
                        className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:bg-indigo-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group mt-2"
                    >
                        {isLoggingIn ? <>Đang đăng nhập...</> : <>Đăng nhập <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/></>}
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-100"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-gray-400 font-medium">Hoặc</span>
                        </div>
                    </div>

                    <button 
                        type="button" 
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn}
                        className="w-full bg-white text-gray-700 border border-gray-200 font-bold py-3.5 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 hover:scale-[1.01] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Đăng nhập với Google
                    </button>
                    {showForgotPassword && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
                            <h4 className="text-sm font-bold text-gray-800 mb-2">Đặt lại mật khẩu</h4>
                            <input 
                                type="email" 
                                value={resetEmail} 
                                onChange={(e) => setResetEmail(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all mb-2"
                                placeholder="Nhập email của bạn"
                            />
                            <div className="flex gap-2">
                                <button type="button" onClick={handleForgotPassword} className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-xl text-sm hover:bg-indigo-700">Gửi email</button>
                                <button type="button" onClick={() => setShowForgotPassword(false)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-sm hover:bg-gray-300">Hủy</button>
                            </div>
                            {resetMessage && <p className="text-sm text-gray-600 mt-2 font-medium">{resetMessage}</p>}
                        </div>
                    )}
                </form>
                <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400 text-[10px] font-medium uppercase tracking-wide">
                    <Lock size={12} /> Hệ thống bảo mật nội bộ
                </div>
            </div>
         </div>
         <div className="absolute bottom-6 text-gray-400 text-xs font-medium">
             © 2026 ứng dụng được phát triển bới Bành Đại Dũng
         </div>
      </div>
    );
  }

  if (currentView === 'landing') {
    return (
      <div className="w-screen h-screen relative">
         <LandingPage 
            onProductionOrder={handleProductionOrder}
            onDesignOrder={handleDesignOrder}
            onProductionPlan={handleProductionPlan}
            onDesignPlan={handleDesignPlan}
            onBudget={handleBudgetView}
            onPlanning={handlePlanningView}
            currentUser={currentUserName || currentUser}
            userRole={userRole}
         />
         <div className="absolute top-6 right-6 z-20 flex gap-2">
             {isAdmin && (
                 <div 
                    onClick={() => setShowSettings(true)}
                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-full backdrop-blur-sm border border-white/20 cursor-pointer flex items-center gap-2 text-xs font-bold transition-all hover:scale-105"
                 >
                    <Settings size={14}/> Cài đặt
                 </div>
             )}
             <div 
                onClick={() => setShowChangePasswordModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-full backdrop-blur-sm border border-white/20 cursor-pointer flex items-center gap-2 text-sm font-bold transition-all hover:scale-105"
                title="Đổi mật khẩu"
             >
                <Key size={16}/>
             </div>
             <div 
                onClick={() => setShowLogoutModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 cursor-pointer flex items-center gap-2 text-sm font-bold transition-all hover:scale-105"
             >
                <LogOut size={16}/> Đăng xuất
             </div>
         </div>
         {showLogoutModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 text-center">
                 <h3 className="text-xl font-bold text-gray-800 mb-2">Đăng xuất tài khoản?</h3>
                 <p className="text-sm text-gray-500 mb-6">Bạn có chắc muốn đăng xuất khỏi hệ thống không?</p>
                 <div className="flex gap-3">
                    <button onClick={() => setShowLogoutModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                    <button onClick={performLogout} className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Đăng xuất</button>
                 </div>
              </div>
            </div>
         )}
         {showSettings && isAdmin && <SettingsModal onClose={handleSettingsClose} />}
  
      </div>
    );
  }

  // --- BUDGET VIEW ---
  if (currentView === 'budget') {
      return <BudgetTable onBack={handleGoHome} userRole={userRole} />;
  }

  // --- PLANNING VIEW ---
  if (currentView === 'planning') {
      return <PlanningTable onBack={handleGoHome} userRole={userRole} isOwner={isOwner} isAdmin={isAdmin} userEmail={currentUser} />;
  }

  // --- MAIN APP VIEW ---
  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative">
      <div className="px-6 pt-4 pb-2 z-50">
        <nav className="glass-panel rounded-2xl h-16 flex items-center px-6 shadow-sm justify-between transition-all duration-300 hover:shadow-md">
          <div className="flex items-center gap-3">
              <div onClick={handleGoHome} className={`w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30 transform transition-transform hover:scale-110 hover:rotate-3 cursor-pointer`} title="Về trang chủ">
                <span className="text-lg">W</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-gray-800 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600">
                  Hệ thống quản trị order Creative
                </h1>
                <span className="text-xs text-gray-500 font-medium tracking-wide flex items-center gap-1">
                  <Sparkles size={10} className="text-yellow-500" /> Bảng theo dõi tiến độ
                </span>
              </div>
          </div>
          <div className="flex items-center gap-6">
               <button onClick={handleGoHome} className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all hidden sm:flex items-center gap-2" title="Về Trang chủ"><Home size={20} /></button>
               <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border shadow-sm hidden sm:flex transition-colors ${isOnline ? 'text-gray-600 bg-white/50 border-white/60' : 'text-red-600 bg-red-50 border-red-100'}`}>
                  <span className="relative flex h-2.5 w-2.5">{isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}<span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span></span>
                  {isOnline ? 'System Online' : 'Offline Mode'}
               </div>
               {isAdmin && (
                 <button onClick={() => setShowSettings(true)} className="p-2.5 bg-slate-800 text-white rounded-full shadow-lg shadow-slate-500/20 hover:bg-slate-700 hover:scale-110 transition-all flex items-center justify-center group" title="Cài đặt hệ thống"><Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" /></button>
               )}
               <button className="relative p-2 text-gray-500 hover:text-indigo-600 transition-colors" title="Thông báo (Sắp ra mắt)"><Bell size={20} /></button>
               <div className="relative" ref={userMenuRef}>
                   <div onClick={() => setShowUserMenu(!showUserMenu)} className={`h-10 pl-2 pr-4 rounded-full bg-gradient-to-tr flex items-center justify-center font-bold border border-white shadow-md cursor-pointer hover:shadow-lg transition-all gap-2 select-none ${isOwner ? 'from-slate-800 to-slate-600 text-white' : 'from-gray-50 to-white text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'}`} title="Tài khoản cá nhân">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm transition-colors ${isOwner ? 'bg-yellow-500 text-slate-900' : 'bg-indigo-100 text-indigo-600'}`}>{isOwner ? <ShieldCheck size={14}/> : <Mail size={14} />}</div>
                      <span className="text-xs max-w-[150px] truncate font-semibold">{currentUserName || currentUser}</span>
                   </div>
                   {showUserMenu && (
                       <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 animate-in fade-in zoom-in-95 duration-200 z-[100] overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                             <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tài khoản</div>
                             <div className="text-sm font-bold text-gray-800 truncate" title={currentUserName || currentUser}>{currentUserName || currentUser}</div>
                             <div className="text-[10px] text-gray-500 mt-0.5">{getRoleLabel()}</div>
                          </div>
                          <div className="p-1">
                              <button onClick={() => { setShowChangePasswordModal(true); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 transition-colors"><Key size={14} /> Đổi mật khẩu</button>
                              <button onClick={() => { setShowLogoutModal(true); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"><LogOut size={14} /> Đăng xuất</button>
                          </div>
                       </div>
                   )}
               </div>
          </div>
        </nav>
      </div>
      <main className="flex-1 px-6 pb-6 pt-2 overflow-hidden">
        <div className="w-full h-full glass-panel rounded-2xl shadow-xl overflow-hidden flex flex-col relative border border-white">
           <WorkOrderTable 
              currentUser={currentUser} 
              currentUserName={currentUserName}
              userRole={userRole}
              isOwner={isOwner} 
              isAdmin={isAdmin}
              initialTabId={initialTab}
              autoCreate={autoCreateOrder}
              initialViewMode={initialViewMode}
           />
        </div>
      </main>
      {showSettings && isAdmin && <SettingsModal onClose={handleSettingsClose} />}
      {showChangePasswordModal && <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 animate-in zoom-in-95 duration-200 relative overflow-hidden">
             <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 shadow-inner"><LogOut size={28} /></div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Đăng xuất tài khoản?</h3>
                <p className="text-sm text-gray-500 mb-6 px-4">Bạn sẽ quay trở lại màn hình đăng nhập.<br/><span className="font-medium text-indigo-600">{currentUserName || currentUser}</span></p>
                <div className="flex gap-3 w-full">
                   <button onClick={() => setShowLogoutModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-sm">Hủy</button>
                   <button onClick={performLogout} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all text-sm flex items-center justify-center gap-2">Đăng xuất <LogOut size={14} /></button>
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
