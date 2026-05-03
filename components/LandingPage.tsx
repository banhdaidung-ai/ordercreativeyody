
import React from 'react';
import { Video, Palette, CalendarDays, PlusCircle, ArrowRight, Layout, Sparkles, Wallet, CalendarRange } from 'lucide-react';

interface LandingPageProps {
  onProductionOrder: () => void;
  onDesignOrder: () => void;
  onProductionPlan: () => void;
  onDesignPlan: () => void;
  onBudget?: () => void;
  onPlanning?: () => void; // New prop
  currentUser: string;
  userRole: 'admin' | 'member' | 'collaborator';
}

const Button3D: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  colorClass: string;
  shadowClass: string;
}> = ({ onClick, icon, title, subtitle, colorClass, shadowClass }) => (
  <button
    onClick={onClick}
    className={`group relative w-full p-3 md:p-6 rounded-2xl md:rounded-3xl transition-all duration-100 transform active:translate-y-2 active:shadow-none hover:-translate-y-1 ${colorClass} ${shadowClass} border-2 border-white/20`}
    style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.2), 0 8px 10px rgba(0,0,0,0.2)' }}
  >
    <div className="absolute top-0 left-0 w-full h-full rounded-2xl md:rounded-3xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    <div className="relative z-10 flex flex-row md:flex-col items-center justify-start md:justify-center text-left md:text-center text-white gap-4 md:gap-0">
      <div className="mb-0 md:mb-4 p-2 md:p-4 bg-white/20 rounded-xl md:rounded-2xl backdrop-blur-sm shadow-inner group-hover:scale-110 transition-transform duration-300 shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-sm md:text-xl font-black uppercase tracking-wider mb-0.5 md:mb-2 drop-shadow-md leading-tight">{title}</h3>
        <p className="text-[10px] md:text-sm font-medium opacity-90 leading-tight">{subtitle}</p>
      </div>
      <div className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-all transform md:translate-y-2 group-hover:translate-y-0 md:mt-4 pl-2 md:pl-0">
        <ArrowRight className="inline-block w-4 h-4 md:w-6 md:h-6" />
      </div>
    </div>
  </button>
);

export const LandingPage: React.FC<LandingPageProps> = ({
  onProductionOrder,
  onDesignOrder,
  onProductionPlan,
  onDesignPlan,
  onBudget,
  onPlanning,
  currentUser,
  userRole
}) => {
  const isAdmin = userRole === 'admin';

  return (
    <div className="w-full h-full relative overflow-y-auto overflow-x-hidden flex flex-col items-center p-4 md:p-6 text-slate-100 custom-scrollbar">
      {/* Galaxy Background - Optimized (Static) */}
      <div className="fixed inset-0 bg-[#0f0c29] z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]"></div>
        {/* Stars Effect - Static */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30" 
             style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
        {/* Nebulas - Static */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl flex flex-col items-center min-h-full justify-center py-8 md:py-0">
        {/* Header */}
        <div className="text-center mb-6 md:mb-16 space-y-2 md:space-y-4 animate-in slide-in-from-top-10 duration-700 shrink-0">
           <div className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-indigo-200 text-xs md:text-sm font-bold shadow-lg mb-1 md:mb-4">
              <Sparkles size={12} className="text-yellow-400 animate-pulse md:w-3.5 md:h-3.5"/> Xin chào, {currentUser}
           </div>
           <h1 className="text-2xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-purple-200 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] leading-tight text-center">
             Hệ thống Order Creative
           </h1>
           <p className="text-xs md:text-lg text-gray-300 font-medium max-w-2xl mx-auto px-4">
             {isAdmin ? 'Chào mừng quản trị viên. Mời bạn chọn chức năng quản lý hoặc tạo order.' : 'Mời bạn chọn loại yêu cầu muốn khởi tạo.'}
           </p>
           
           {/* Open in new tab button for mobile */}
           <div className="mt-4">
             <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="text-[10px] md:text-xs text-indigo-300 hover:text-white underline decoration-indigo-300/50 underline-offset-4 transition-colors"
             >
                Mở ứng dụng trong tab mới (Khuyên dùng cho Mobile)
             </button>
           </div>
        </div>

        {/* Buttons Grid */}
        <div className={`grid grid-cols-1 gap-3 md:gap-6 w-full ${isAdmin ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2 max-w-2xl'} p-1`}>
          
          <div className="animate-in zoom-in-50 duration-500 delay-100">
            <Button3D 
              onClick={onProductionOrder}
              icon={<Video className="w-5 h-5 md:w-8 md:h-8" />}
              title="Order Production"
              subtitle="Tạo yêu cầu Hình ảnh / Video"
              colorClass="bg-gradient-to-br from-indigo-500 to-purple-600"
              shadowClass="shadow-indigo-900/50"
            />
          </div>

          <div className="animate-in zoom-in-50 duration-500 delay-200">
            <Button3D 
              onClick={onDesignOrder}
              icon={<Palette className="w-5 h-5 md:w-8 md:h-8" />}
              title="Order Design"
              subtitle="Tạo yêu cầu Thiết kế mới"
              colorClass="bg-gradient-to-br from-pink-500 to-rose-600"
              shadowClass="shadow-rose-900/50"
            />
          </div>

          {isAdmin && (
            <>
              {/* Combine Plan buttons into grid if needed or keep scrolling */}
              <div className="animate-in zoom-in-50 duration-500 delay-300">
                 <Button3D 
                  onClick={onProductionPlan}
                  icon={<Layout className="w-5 h-5 md:w-8 md:h-8" />}
                  title="Kế hoạch Pro"
                  subtitle="Xem tiến độ Hình ảnh / Video"
                  colorClass="bg-gradient-to-br from-blue-500 to-cyan-600"
                  shadowClass="shadow-cyan-900/50"
                />
              </div>

              <div className="animate-in zoom-in-50 duration-500 delay-400">
                 <Button3D 
                  onClick={onDesignPlan}
                  icon={<CalendarDays className="w-5 h-5 md:w-8 md:h-8" />}
                  title="Kế hoạch Des"
                  subtitle="Xem tiến độ Thiết kế"
                  colorClass="bg-gradient-to-br from-teal-500 to-emerald-600"
                  shadowClass="shadow-emerald-900/50"
                />
              </div>

              <div className="animate-in zoom-in-50 duration-500 delay-500">
                 <Button3D 
                  onClick={onBudget!}
                  icon={<Wallet className="w-5 h-5 md:w-8 md:h-8" />}
                  title="Ngân sách"
                  subtitle="Theo dõi chi phí & Dòng tiền"
                  colorClass="bg-gradient-to-br from-orange-500 to-amber-600"
                  shadowClass="shadow-amber-900/50"
                />
              </div>
            </>
          )}
        </div>
        
        {/* NEW BUTTON ROW */}
        {(isAdmin || userRole === 'member') && (
            <div className="mt-4 md:mt-6 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700">
                <button 
                    onClick={onPlanning}
                    className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-3 flex items-center justify-center gap-3 text-white font-bold transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95 group"
                >
                    <CalendarRange className="text-yellow-400 group-hover:scale-110 transition-transform" />
                    <span>Lập kế hoạch Order (Planning)</span>
                    <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
                </button>
            </div>
        )}
        
        <div className="mt-8 md:mt-12 text-white/30 text-[10px] md:text-xs font-medium uppercase tracking-widest animate-pulse text-center shrink-0">
           {isAdmin ? 'Hệ thống quản lý tập trung' : 'Chọn chức năng để tiếp tục'}
        </div>
      </div>
    </div>
  );
};
