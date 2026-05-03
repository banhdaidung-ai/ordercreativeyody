
import React, { useMemo, useState } from 'react';
import { WorkOrder, Department, Status, CostDetails } from '../types';
import { Users, Video, Camera, Scissors, CheckCircle2, Clock, Activity, TrendingUp, BarChart3, PieChart, DollarSign, CalendarRange, Filter, ArrowUpRight, ArrowDownRight, AlertCircle, Layers, CalendarDays, Info, Palette, LineChart, Play, Flag } from 'lucide-react';

interface SummaryReportProps {
  data: WorkOrder[];
  isDesignView?: boolean;
  timeRange: 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'next_week' | 'this_month' | 'last_month' | 'this_year' | 'custom_range' | 'by_month';
  setTimeRange: (val: 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'next_week' | 'this_month' | 'last_month' | 'this_year' | 'custom_range' | 'by_month') => void;
  reportMonth: number;
  setReportMonth: (val: number) => void;
  reportYear: number;
  setReportYear: (val: number) => void;
  customStartDate: string;
  setCustomStartDate: (val: string) => void;
  customEndDate: string;
  setCustomEndDate: (val: string) => void;
}

// --- Helper Components for Charts (Pure CSS/React) ---

const SimpleBarChart: React.FC<{ 
  data: { label: string; value: number; color?: string }[]; 
  maxVal?: number;
  height?: number;
  formatValue?: (val: number) => string;
  barWidth?: string;
}> = ({ data, maxVal, height = 200, formatValue, barWidth = 'max-w-[40px]' }) => {
  const calculatedMax = maxVal || Math.max(...data.map(d => d.value)) || 1;

  return (
    <div className="w-full flex items-end gap-1 sm:gap-4 font-sans text-xs" style={{ height: `${height}px` }}>
      {data.map((item, idx) => {
        const percent = (item.value / calculatedMax) * 100;
        return (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end group h-full relative min-w-[20px] sm:min-w-[30px]">
            <div className="mb-1 font-black text-slate-900 opacity-0 group-hover:opacity-100 transition-all duration-300 absolute -top-10 bg-white/80 backdrop-blur-md shadow-xl px-3 py-1.5 rounded-xl border border-white/40 z-10 whitespace-nowrap scale-90 group-hover:scale-100 origin-bottom tracking-tighter">
               {formatValue ? formatValue(item.value) : item.value}
            </div>
            <div 
              className={`w-full ${barWidth} rounded-t-2xl transition-all duration-700 relative hover:brightness-110 shadow-sm group-hover:shadow-lg ${item.color || 'bg-indigo-500'}`}
              style={{ height: `${percent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-t-2xl"></div>
            </div>
            <div className="mt-4 text-slate-500 font-black truncate w-full text-center text-[8px] sm:text-[10px] uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity" title={item.label}>
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SimpleDonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  size?: number;
}> = ({ data, size = 160 }) => {
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  let currentAngle = 0;

  if (total === 0) return (
     <div className="flex items-center justify-center text-slate-400 text-xs italic font-medium" style={{ width: size, height: size }}>
        Chưa có dữ liệu
     </div>
  );

  return (
    <div className="relative flex items-center justify-center group" style={{ width: size, height: size }}>
       <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full overflow-visible drop-shadow-sm group-hover:drop-shadow-xl transition-all duration-500">
          {data.map((item, idx) => {
             const percentage = item.value / total;
             const circumference = 2 * Math.PI * 40;
             const strokeDasharray = `${percentage * circumference} ${circumference}`;
             const strokeDashoffset = -currentAngle * circumference;
             
             currentAngle += percentage;

             return (
                <circle
                  key={idx}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="12"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 hover:stroke-[14] cursor-pointer opacity-90 hover:opacity-100"
                >
                  <title>{item.label}: {item.value} ({Math.round(percentage * 100)}%)</title>
                </circle>
             );
          })}
       </svg>
       <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl font-black text-slate-900 tracking-tighter">{total}</span>
          <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.25em] mt-1 opacity-60">Tổng cộng</span>
       </div>
    </div>
  );
};

// --- WORKLOAD MATRIX COMPONENT ---
const WorkloadMatrix: React.FC<{ 
  data: WorkOrder[]; 
  month: number; // 0-11
  year: number; 
  isDesignView?: boolean;
}> = ({ data, month, year, isDesignView = false }) => {
  const today = new Date();
  
  // 1. Tạo danh sách ngày trong tháng
  const daysInMonth = useMemo(() => {
    const days = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [month, year]);

  // 2. Tính toán dữ liệu (Group by Role -> Person -> Date)
  const matrixData = useMemo(() => {
    // Map stores: string -> { day: { impl: number, dead: number } }
    const roles: Record<string, { 
        map: Map<string, Record<number, { impl: number, dead: number }>>, 
        icon: React.ReactNode, 
        color: string 
    }> = {};

    if (isDesignView) {
      roles['Designer'] = { map: new Map(), icon: <Palette size={14}/>, color: 'text-cyan-700 bg-cyan-50' };
    } else {
      roles['Video Editor'] = { map: new Map(), icon: <Video size={14}/>, color: 'text-purple-700 bg-purple-50' };
      roles['Photo Editor'] = { map: new Map(), icon: <Camera size={14}/>, color: 'text-teal-700 bg-teal-50' };
      roles['Stylist'] = { map: new Map(), icon: <Scissors size={14}/>, color: 'text-pink-700 bg-pink-50' };
    }

    const process = (personNames: any, roleKey: string, dateObj: Date, type: 'impl' | 'dead') => {
        if (typeof personNames !== 'string' || !personNames || personNames.toLowerCase() === 'không') return;
        const day = dateObj.getDate();
        
        if (!roles[roleKey]) return;

        // Split by comma, semicolon, or newline in case of multiple people assigned
        const names = personNames.split(/[,;\n]+/).map(n => n.trim()).filter(n => n && n.toLowerCase() !== 'không');

        names.forEach(personName => {
            const roleMap = roles[roleKey].map;
            if (!roleMap.has(personName)) {
                roleMap.set(personName, {});
            }
            const record = roleMap.get(personName)!;
            if (!record[day]) record[day] = { impl: 0, dead: 0 };
            
            if (type === 'impl') record[day].impl += 1;
            else record[day].dead += 1;
        });
    };

    data.forEach(order => {
        const isDesign = (order.category || '').toLowerCase() === 'design' || (order.category || '').toLowerCase() === 'animation';

        // Xử lý Ngày triển khai
        if (order.implementationDate) {
            const date = new Date(order.implementationDate);
            if (!isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year) {
                if (isDesign) {
                   process(order.designer || '', 'Designer', date, 'impl');
                } else {
                   process(order.videoPerson, 'Video Editor', date, 'impl');
                   process(order.photoPerson, 'Photo Editor', date, 'impl');
                   process(order.stylist, 'Stylist', date, 'impl');
                }
            }
        }

        // Xử lý Deadline
        if (order.dueDate) {
            const date = new Date(order.dueDate);
            if (!isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year) {
                if (isDesign) {
                   process(order.designer || '', 'Designer', date, 'dead');
                } else {
                   process(order.videoPerson, 'Video Editor', date, 'dead');
                   process(order.photoPerson, 'Photo Editor', date, 'dead');
                   process(order.stylist, 'Stylist', date, 'dead');
                }
            }
        }
    });

    return { roles, daysInMonth };
  }, [data, month, year, daysInMonth, isDesignView]);

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-2xl overflow-hidden flex flex-col">
       <div className="px-8 py-6 border-b border-white/40 bg-white/20 flex justify-between items-center">
           <div>
               <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 tracking-tight">
                   <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                      <CalendarDays size={18}/>
                   </div>
                   Lịch làm việc tháng {month + 1}/{year}
               </h3>
               <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 mt-1.5 opacity-60 uppercase tracking-wider">
                   <Info size={12}/> Dữ liệu hiển thị theo Ngày triển khai và Deadline
               </p>
           </div>
           <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
               <span className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-100"><span className="text-green-600">▶</span> Triển khai</span>
               <span className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg border border-red-100"><span className="text-red-500">⚑</span> Deadline</span>
           </div>
       </div>
       
       <div className="overflow-x-auto custom-scrollbar">
           <table className="w-full border-collapse text-xs">
               <thead>
                   <tr>
                       <th className="sticky left-0 z-20 bg-slate-50/90 backdrop-blur-md p-4 border-b border-r border-slate-200/60 min-w-[200px] text-left font-black text-slate-500 uppercase tracking-[0.15em] shadow-sm">
                           Nhân sự
                       </th>
                       {matrixData.daysInMonth.map(d => {
                           const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                           // CHECK IF TODAY
                           const isToday = d.getDate() === today.getDate() && 
                                           d.getMonth() === today.getMonth() && 
                                           d.getFullYear() === today.getFullYear();

                           return (
                               <th key={d.getDate()} className={`p-2 border-b border-r border-slate-200/60 min-w-[50px] text-center relative transition-colors ${isToday ? 'bg-indigo-600 text-white z-10 shadow-lg shadow-indigo-100' : isWeekend ? 'bg-slate-100/50 text-slate-400' : 'bg-white/40 text-slate-600'}`}>
                                   {isToday && <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white text-indigo-600 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm border border-indigo-100 whitespace-nowrap">Hôm nay</div>}
                                   <div className={`text-sm font-black tracking-tighter ${isToday ? 'mt-1' : ''}`}>{d.getDate()}</div>
                                   <div className={`text-[9px] font-black uppercase tracking-widest opacity-60 ${isToday ? 'text-indigo-100' : ''}`}>
                                       {d.getDay() === 0 ? 'CN' : `T${d.getDay() + 1}`}
                                   </div>
                               </th>
                           );
                       })}
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-200/60">
                   {(Object.keys(matrixData.roles)).map(roleKey => {
                       const roleData = matrixData.roles[roleKey];
                       const people = (Array.from(roleData.map.keys()) as string[]).sort();
                       
                       if (people.length === 0) return null;

                       return (
                           <React.Fragment key={roleKey}>
                               {/* Group Header */}
                               <tr className="bg-slate-50/40 backdrop-blur-sm">
                                   <td className="sticky left-0 z-10 bg-slate-50/80 backdrop-blur-md p-3 font-black border-r border-slate-200/60 text-left border-b border-slate-200/60 shadow-sm" colSpan={matrixData.daysInMonth.length + 1}>
                                       <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${roleData.color}`}>
                                           {roleData.icon} {roleKey}
                                       </span>
                                   </td>
                               </tr>
                               {/* People Rows */}
                               {people.map(person => (
                                   <tr key={person} className="hover:bg-white/60 transition-all h-[50px] group/row">
                                       <td className="sticky left-0 z-10 bg-white/80 backdrop-blur-md p-4 border-r border-slate-200/60 font-black text-slate-700 truncate shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] border-b border-slate-200/60 group-hover/row:text-indigo-600 transition-colors">
                                           {person}
                                       </td>
                                       {matrixData.daysInMonth.map(d => {
                                           const dayData = roleData.map.get(person)?.[d.getDate()] || { impl: 0, dead: 0 };
                                           const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                           const isToday = d.getDate() === today.getDate() && 
                                                           d.getMonth() === today.getMonth() && 
                                                           d.getFullYear() === today.getFullYear();

                                           return (
                                               <td key={d.getDate()} className={`border-r border-slate-100 border-b text-center p-1 relative align-top transition-colors ${isToday ? 'bg-indigo-50/30' : isWeekend ? 'bg-slate-50/20' : ''}`}>
                                                   {(dayData.impl > 0 || dayData.dead > 0) && (
                                                       <div className="flex flex-col gap-1 h-full min-h-[40px] justify-center group/cell relative cursor-help">
                                                           {dayData.impl > 0 && (
                                                               <div className="text-[10px] font-black text-green-700 bg-green-100/80 backdrop-blur-sm px-1.5 py-1 rounded-lg mx-auto w-full max-w-[38px] flex items-center justify-center gap-1 shadow-sm border border-green-200/50 hover:scale-110 transition-transform">
                                                                   <Play size={10} fill="currentColor"/> {dayData.impl}
                                                               </div>
                                                           )}
                                                           {dayData.dead > 0 && (
                                                               <div className="text-[10px] font-black text-red-700 bg-red-100/80 backdrop-blur-sm px-1.5 py-1 rounded-lg mx-auto w-full max-w-[38px] flex items-center justify-center gap-1 shadow-sm border border-red-200/50 hover:scale-110 transition-transform">
                                                                   <Flag size={10} fill="currentColor"/> {dayData.dead}
                                                               </div>
                                                           )}

                                                           {/* Tooltip Detail */}
                                                           <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 bg-slate-900/95 backdrop-blur-md text-white text-[11px] p-4 rounded-[1.5rem] shadow-2xl opacity-0 group-hover/cell:opacity-100 transition-all duration-300 pointer-events-none z-[100] scale-90 group-hover/cell:scale-100 origin-bottom border border-white/10">
                                                               <div className="font-black border-b border-white/10 pb-2 mb-3 text-center text-slate-200 uppercase tracking-widest">
                                                                   {d.getDate()}/{d.getMonth()+1} • {person}
                                                               </div>
                                                               <div className="space-y-2">
                                                                   {dayData.impl > 0 && (
                                                                       <div className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5">
                                                                           <span className="text-green-400 font-black flex items-center gap-2 uppercase tracking-tighter"><Play size={12} fill="currentColor"/> Triển khai</span> 
                                                                           <span className="text-lg font-black text-white tracking-tighter">{dayData.impl}</span>
                                                                       </div>
                                                                   )}
                                                                   {dayData.dead > 0 && (
                                                                       <div className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5">
                                                                           <span className="text-red-400 font-black flex items-center gap-2 uppercase tracking-tighter"><Flag size={12} fill="currentColor"/> Deadline</span> 
                                                                           <span className="text-lg font-black text-white tracking-tighter">{dayData.dead}</span>
                                                                       </div>
                                                                   )}
                                                               </div>
                                                               <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 rotate-45 border-r border-b border-white/10"></div>
                                                           </div>
                                                       </div>
                                                   )}
                                               </td>
                                           );
                                       })}
                                   </tr>
                               ))}
                           </React.Fragment>
                       );
                   })}
                   {(Object.keys(matrixData.roles).every(r => matrixData.roles[r].map.size === 0)) && (
                       <tr>
                           <td colSpan={matrixData.daysInMonth.length + 1} className="p-12 text-center text-slate-400 font-black uppercase tracking-[0.2em] opacity-40 italic">
                               Không có dữ liệu trong tháng này
                           </td>
                       </tr>
                   )}
               </tbody>
           </table>
       </div>
    </div>
  );
};


// --- Main Report Component ---

const getWeekNumber = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const SummaryReport: React.FC<SummaryReportProps> = ({ 
  data, 
  isDesignView = false,
  timeRange,
  setTimeRange,
  reportMonth,
  setReportMonth,
  reportYear,
  setReportYear,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate
}) => {
  // State for Filters
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [viewTab, setViewTab] = useState<'overview' | 'department' | 'personnel' | 'workload' | 'cost' | 'timeline'>('overview');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 1. FILTER LOGIC ---
  const filteredData = useMemo(() => {
    const now = new Date();
    // Normalize today to 00:00:00 for strict comparison
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return data.filter(item => {
      // 0. Exclude Cancelled Orders
      const s = (item.status || '').toLowerCase();
      if (s.includes('hủy')) return false;

      // 1. Filter by Department
      if (selectedDept !== 'all' && item.department !== selectedDept) return false;

      // 2. Filter by Time (Check both implementationDate and dueDate)
      const implDate = item.implementationDate ? new Date(item.implementationDate) : null;
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      
      if (!implDate && !dueDate) return false;

      const checkDate = (d: Date | null) => {
        if (!d || isNaN(d.getTime())) return false;
        const dNorm = new Date(d); dNorm.setHours(0,0,0,0);
        
        switch (timeRange) {
          case 'today':
             return dNorm.getTime() === todayStart.getTime();
          
          case 'yesterday': {
             const yesterday = new Date(todayStart);
             yesterday.setDate(todayStart.getDate() - 1);
             return dNorm.getTime() === yesterday.getTime();
          }

          case 'this_week': {
             const day = now.getDay(); 
             const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
             const monday = new Date(now); monday.setDate(diff); monday.setHours(0,0,0,0);
             const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
             return d >= monday && d <= sunday;
          }

          case 'last_week': {
             const day = now.getDay();
             const diff = now.getDate() - day + (day === 0 ? -6 : 1);
             const thisMonday = new Date(now); thisMonday.setDate(diff);
             
             const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7); lastMonday.setHours(0,0,0,0);
             const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1); lastSunday.setHours(23,59,59,999);
             return d >= lastMonday && d <= lastSunday;
          }

          case 'next_week': {
             const day = now.getDay();
             const diff = now.getDate() - day + (day === 0 ? -6 : 1) + 7;
             const nextMonday = new Date(now); nextMonday.setDate(diff); nextMonday.setHours(0,0,0,0);
             const nextSunday = new Date(nextMonday); nextSunday.setDate(nextMonday.getDate() + 6); nextSunday.setHours(23,59,59,999);
             return d >= nextMonday && d <= nextSunday;
          }

          case 'this_month':
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          
          case 'last_month': {
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const yearOfLastMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
            return d.getMonth() === lastMonth && d.getFullYear() === yearOfLastMonth;
          }
          
          case 'this_year':
            return d.getFullYear() === currentYear;

          case 'by_month':
            return d.getMonth() === reportMonth && d.getFullYear() === reportYear;

          case 'custom_range': {
            if (!customStartDate || !customEndDate) return true;
            const start = new Date(customStartDate); start.setHours(0,0,0,0);
            const end = new Date(customEndDate); end.setHours(23,59,59,999);
            return d >= start && d <= end;
          }

          default:
            return true;
        }
      };

      return checkDate(implDate) || checkDate(dueDate);
    });
  }, [data, timeRange, selectedDept, customStartDate, customEndDate, reportMonth, reportYear]);

  // Calculate current viewing month/year for Matrix
  const matrixDateInfo = useMemo(() => {
      if (timeRange === 'by_month') {
          return { month: reportMonth, year: reportYear };
      }
      const now = new Date();
      if (timeRange === 'next_week') {
          const nextWeekDate = new Date();
          nextWeekDate.setDate(nextWeekDate.getDate() + 7);
          return { month: nextWeekDate.getMonth(), year: nextWeekDate.getFullYear() };
      }
      if (timeRange === 'custom_range' && customStartDate) {
          const d = new Date(customStartDate);
          if (!isNaN(d.getTime())) {
              return { month: d.getMonth(), year: d.getFullYear() };
          }
      }
      return { month: now.getMonth(), year: now.getFullYear() };
  }, [timeRange, customStartDate, reportMonth, reportYear]);


  // --- 2. STATISTICS CALCULATION ---
  const stats = useMemo(() => {
    let total = filteredData.length;
    let completed = 0;
    let overdue = 0;
    let totalCost = 0;
    
    // Maps for charts
    const statusCount: Record<string, number> = {};
    const deptCount: Record<string, number> = {};
    const categoryCount: Record<string, number> = {};

    // Cost Maps
    const costByDept: Record<string, number> = {};
    const costStructure = {
      model: 0,
      makeup: 0,
      location: 0,
      transport: 0,
      outsource: 0,
      others: 0
    };
    
    // Timeline Maps
    const dailyCount: Record<string, number> = {};
    const weeklyCount: Record<string, number> = {};

    // Personnel Stats
    const personnel: Record<string, { name: string; role: string; total: number; completed: number; overdue: number }> = {};

    const processPerson = (name: string, role: string, isDone: boolean, isLate: boolean) => {
        if (!name || name === 'Không') return;
        if (!personnel[name]) personnel[name] = { name, role, total: 0, completed: 0, overdue: 0 };
        personnel[name].total++;
        if (isDone) personnel[name].completed++;
        if (isLate) personnel[name].overdue++;
    };

    // Normalize today to start of day for accurate overdue check
    const today = new Date();
    today.setHours(0,0,0,0);

    filteredData.forEach(item => {
      // Status
      const st = item.status || 'Chưa xác định';
      statusCount[st] = (statusCount[st] || 0) + 1;
      
      const isDone = st.toLowerCase().includes('hoàn tất');
      if (isDone) completed++;

      // Overdue Check
      let isLate = false;
      if (item.dueDate && !isDone && !st.toLowerCase().includes('hủy')) {
         const due = new Date(item.dueDate);
         // Correctly compare dates: Set deadline to end of day to avoid false positive for today
         due.setHours(23, 59, 59, 999); 
         if (due < today) {
             overdue++;
             isLate = true;
         }
      }

      // Cost & Structure
      if (item.estimatedCost) {
          // Fix: Parse string "1.500.000" correctly by removing non-digits
          const cost = parseInt(item.estimatedCost.replace(/[^0-9]/g,"") || "0", 10);
          if (!isNaN(cost)) {
              totalCost += cost;
              // Add to Dept cost
              const d = item.department || 'Khác';
              costByDept[d] = (costByDept[d] || 0) + cost;
          }
      }

      if (item.costDetails) {
         costStructure.model += (item.costDetails.model || 0);
         costStructure.makeup += (item.costDetails.makeup || 0);
         costStructure.location += (item.costDetails.location || 0);
         costStructure.transport += (item.costDetails.transport || 0);
         costStructure.others += (item.costDetails.others || 0);
         costStructure.outsource += (
            (item.costDetails.outsource?.video || 0) +
            (item.costDetails.outsource?.photo || 0) +
            (item.costDetails.outsource?.stylist || 0) +
            (item.costDetails.outsource?.assistant || 0)
         );
      }

      // Department
      const dept = item.department || 'Khác';
      deptCount[dept] = (deptCount[dept] || 0) + 1;

      // Category
      const cat = item.category || 'Khác';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;

      // Timeline Stats (using Implementation Date, fallback to dueDate)
      const targetDate = item.implementationDate || item.dueDate;
      if (targetDate) {
          const d = new Date(targetDate);
          if (!isNaN(d.getTime())) {
              // Daily (DD/MM)
              const dayKey = `${d.getDate()}/${d.getMonth() + 1}`;
              dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;

              // Weekly (Tuần X)
              const w = getWeekNumber(d);
              const weekKey = `Tuần ${w}`; 
              weeklyCount[weekKey] = (weeklyCount[weekKey] || 0) + 1;
          }
      }

      // Personnel Processing
      if (isDesignView) {
        processPerson(item.designer || '', 'Designer', isDone, isLate);
      } else {
        processPerson(item.stylist, 'Stylist', isDone, isLate);
        processPerson(item.videoPerson, 'Video', isDone, isLate);
        processPerson(item.photoPerson, 'Photo', isDone, isLate);
      }
    });

    const sortedDaily = Object.entries(dailyCount).sort((a, b) => {
        const [d1, m1] = a[0].split('/').map(Number);
        const [d2, m2] = b[0].split('/').map(Number);
        if (m1 !== m2) return m1 - m2;
        return d1 - d2;
    }).map(([k,v]) => ({ label: k, value: v }));

    const sortedWeekly = Object.entries(weeklyCount).sort((a, b) => {
        const w1 = parseInt(a[0].replace('Tuần ', ''));
        const w2 = parseInt(b[0].replace('Tuần ', ''));
        return w1 - w2;
    }).map(([k,v]) => ({ label: k, value: v }));


    return {
      total,
      completed,
      overdue,
      totalCost,
      statusData: Object.entries(statusCount).map(([k,v]) => ({ label: k, value: v })),
      deptData: Object.entries(deptCount).map(([k,v]) => ({ label: k, value: v })),
      categoryData: Object.entries(categoryCount).map(([k,v]) => ({ label: k, value: v })),
      personnelList: Object.values(personnel).sort((a,b) => b.total - a.total),
      costByDeptData: Object.entries(costByDept).map(([k,v]) => ({ label: k, value: v })).sort((a,b) => b.value - a.value),
      costStructureData: [
         { label: 'Model', value: costStructure.model, color: '#f472b6' },
         { label: 'Make up', value: costStructure.makeup, color: '#fbbf24' },
         { label: 'Địa điểm', value: costStructure.location, color: '#4ade80' },
         { label: 'Di chuyển', value: costStructure.transport, color: '#60a5fa' },
         { label: 'Outsource', value: costStructure.outsource, color: '#818cf8' },
         { label: 'Khác', value: costStructure.others, color: '#9ca3af' },
      ].filter(i => i.value > 0),
      dailyData: sortedDaily,
      weeklyData: sortedWeekly
    };
  }, [filteredData, isDesignView]);

  const getStatusColor = (status: string) => {
     const s = status.toLowerCase();
     if (s.includes('hoàn tất')) return '#22c55e'; // Green
     if (s.includes('hủy')) return '#ef4444'; // Red
     if (s.includes('đang')) return '#eab308'; // Yellow
     if (s.includes('chờ')) return '#9ca3af'; // Gray
     if (s.includes('xác nhận')) return '#3b82f6'; // Blue
     return '#6366f1'; // Indigo default
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-700 pb-24 max-w-7xl mx-auto bg-slate-50/30">
      
      {/* --- HEADER & CONTROLS --- */}
      <div className="glass-header flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 p-4 sm:p-6 rounded-3xl border border-slate-200/60 shadow-sm sticky top-4 z-50">
         <div className="flex items-center justify-between sm:block">
            <div>
               <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
                 <div className={`p-2 rounded-xl ${isDesignView ? "bg-cyan-100 text-cyan-600" : "bg-indigo-100 text-indigo-600"}`}>
                    <Activity size={20} />
                 </div>
                 Báo cáo hiệu suất
               </h2>
               <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-[0.15em] mt-1 opacity-70">
                  {isDesignView ? 'Design' : 'Creative'} • Phân tích dữ liệu đa chiều
               </p>
            </div>
            
            {/* Mobile Stats Summary */}
            <div className="sm:hidden flex flex-col items-end">
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest opacity-60">Hoàn thành</span>
               <span className="text-2xl font-black text-slate-900 tracking-tighter">{completionRate}%</span>
            </div>
         </div>
         
         <div className="flex flex-wrap items-center gap-3">
            {/* Dept Filter */}
            <div className="relative group flex-1 sm:flex-none">
               <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Layers size={14} />
               </div>
               <select 
                 className="w-full pl-10 pr-8 py-3 sm:py-2.5 bg-white/80 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm appearance-none cursor-pointer hover:bg-white transition-all mobile-touch-target"
                 value={selectedDept}
                 onChange={(e) => setSelectedDept(e.target.value)}
               >
                 <option value="all">Tất cả phòng ban</option>
                 {Object.values(Department).map(d => (
                    <option key={d} value={d}>{d}</option>
                 ))}
               </select>
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ArrowDownRight size={12} className="rotate-45" />
               </div>
            </div>

            {/* Time Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 sm:flex-none">
                <div className="relative group flex-1 sm:flex-none">
                   <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <CalendarRange size={14} />
                   </div>
                   <select 
                     className="w-full pl-10 pr-8 py-3 sm:py-2.5 bg-white/80 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm appearance-none cursor-pointer hover:bg-white transition-all mobile-touch-target"
                     value={timeRange}
                     onChange={(e) => setTimeRange(e.target.value as any)}
                   >
                     <option value="by_month">Theo tháng (Deadline)</option>
                     <option value="today">Hôm nay</option>
                     <option value="yesterday">Hôm qua</option>
                     <option value="this_week">Tuần này</option>
                     <option value="last_week">Tuần trước</option>
                     <option value="next_week">Tuần tới</option>
                     <option value="this_month">Tháng này</option>
                     <option value="last_month">Tháng trước</option>
                     <option value="this_year">Năm nay {new Date().getFullYear()}</option>
                     <option value="custom_range">Khoảng thời gian cụ thể...</option>
                     <option value="all">Toàn bộ thời gian</option>
                   </select>
                   <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                      <ArrowDownRight size={12} className="rotate-45" />
                   </div>
                </div>
                
                {/* Month/Year Picker for by_month */}
                {timeRange === 'by_month' && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-500">
                        <select 
                            value={reportMonth}
                            onChange={(e) => setReportMonth(parseInt(e.target.value))}
                            className="flex-1 sm:flex-none py-2.5 px-4 bg-white/80 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm transition-all cursor-pointer mobile-touch-target"
                        >
                            {Array.from({ length: 12 }).map((_, i) => (
                                <option key={i} value={i}>Tháng {i + 1}</option>
                            ))}
                        </select>
                        <select 
                            value={reportYear}
                            onChange={(e) => setReportYear(parseInt(e.target.value))}
                            className="flex-1 sm:flex-none py-2.5 px-4 bg-white/80 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm transition-all cursor-pointer mobile-touch-target"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Custom Date Range Input */}
                {timeRange === 'custom_range' && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-500">
                        <input 
                           type="date"
                           value={customStartDate}
                           onChange={(e) => setCustomStartDate(e.target.value)}
                           className="py-2.5 px-4 bg-white/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm transition-all"
                        />
                        <span className="text-slate-400 text-xs font-black uppercase opacity-40">to</span>
                        <input 
                           type="date"
                           value={customEndDate}
                           onChange={(e) => setCustomEndDate(e.target.value)}
                           className="py-2.5 px-4 bg-white/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm transition-all"
                        />
                    </div>
                )}
            </div>
         </div>
      </div>

      {/* --- KPI CARDS (Bento Style) --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bento-card p-5 sm:p-6 flex flex-col justify-between group">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-indigo-200">
                   <Users size={20}/>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Tổng Job</span>
                   <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 mt-1">
                      <TrendingUp size={10}/> 
                      <span>+12%</span>
                   </div>
                </div>
             </div>
             <div>
                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">{stats.total}</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider opacity-70">
                   {timeRange === 'by_month' ? `Tháng ${reportMonth + 1}/${reportYear}` : 'Kỳ báo cáo hiện tại'}
                </p>
             </div>
          </div>

          <div className="bento-card p-5 sm:p-6 flex flex-col justify-between group">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-emerald-200">
                   <CheckCircle2 size={20}/>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Hoàn thành</span>
                   <span className="text-[10px] font-bold text-emerald-600 mt-1">{completionRate}% Rate</span>
                </div>
             </div>
             <div>
                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">{stats.completed}</h3>
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${completionRate}%` }}></div>
                </div>
             </div>
          </div>

          <div className="bento-card p-5 sm:p-6 flex flex-col justify-between group">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:bg-rose-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-rose-200">
                   <AlertCircle size={20}/>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Quá hạn</span>
                   <span className="text-[10px] font-bold text-rose-600 mt-1">Cần xử lý</span>
                </div>
             </div>
             <div>
                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter">{stats.overdue}</h3>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-wider">
                   <ArrowUpRight size={12} className="animate-bounce-subtle"/> 
                   <span>Ưu tiên giải quyết</span>
                </div>
             </div>
          </div>

          <div className="bento-card p-5 sm:p-6 flex flex-col justify-between group">
             <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-amber-200">
                   <DollarSign size={20}/>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Chi phí</span>
                   <span className="text-[10px] font-bold text-amber-600 mt-1">Ước tính</span>
                </div>
             </div>
             <div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter truncate">
                   {stats.totalCost.toLocaleString('vi-VN')}
                   <span className="text-xs font-bold text-slate-400 ml-1 uppercase">đ</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider opacity-70">Tổng ngân sách dự kiến</p>
             </div>
          </div>
      </div>

      {/* --- NAVIGATION TABS --- */}
      <div className="flex justify-start sm:justify-center overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
         <div className="bg-slate-200/50 backdrop-blur-sm p-1.5 rounded-2xl flex sm:inline-flex shadow-inner gap-1.5 shrink-0 border border-slate-200/50">
            {[
               { id: 'overview', icon: PieChart, label: 'Tổng quan', color: 'text-indigo-600' },
               { id: 'timeline', icon: LineChart, label: 'Thời gian', color: 'text-rose-600' },
               { id: 'department', icon: BarChart3, label: 'Phòng ban', color: 'text-blue-600' },
               { id: 'personnel', icon: Users, label: 'Nhân sự', color: 'text-purple-600' },
               { id: 'workload', icon: CalendarDays, label: 'Lịch làm việc', color: 'text-orange-600' },
               { id: 'cost', icon: DollarSign, label: 'Chi phí', color: 'text-emerald-600' },
            ].map((tab) => (
               <button 
                 key={tab.id}
                 onClick={() => setViewTab(tab.id as any)}
                 className={`px-4 sm:px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all duration-300 whitespace-nowrap ${viewTab === tab.id ? 'bg-white text-slate-900 shadow-lg shadow-slate-200/50 scale-105' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
               >
                  <tab.icon size={14} className={viewTab === tab.id ? tab.color : ''}/> 
                  {tab.label}
               </button>
            ))}
         </div>
      </div>

      {/* --- MAIN CONTENT AREA (Bento Layout) --- */}
      <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-bottom-8 duration-700">
        
        {/* VIEW 1: OVERVIEW & STATUS */}
        {viewTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* Status Donut - Bento Card */}
             <div className="bento-card p-8 lg:col-span-4 flex flex-col items-center justify-center">
                <div className="w-full mb-8">
                   <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Phân bố trạng thái</h3>
                   <div className="h-1 w-12 bg-indigo-500 mt-2 rounded-full"></div>
                </div>
                <SimpleDonutChart 
                   data={stats.statusData.map(s => ({ ...s, color: getStatusColor(s.label) }))} 
                   size={240}
                />
                <div className="grid grid-cols-2 gap-4 mt-10 w-full">
                   {stats.statusData.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                         <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: getStatusColor(s.label) }}></span>
                         <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black text-slate-800 truncate uppercase tracking-wider">{s.label}</span>
                            <span className="text-[10px] font-bold text-slate-400">{s.value} Jobs</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
             
             {/* Category Bar - Bento Card */}
             <div className="bento-card p-8 lg:col-span-8 flex flex-col">
                <div className="flex justify-between items-start mb-10">
                   <div>
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Phân loại công việc</h3>
                      <div className="h-1 w-12 bg-indigo-500 mt-2 rounded-full"></div>
                   </div>
                   <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                         <span className="text-[10px] font-bold text-slate-500 uppercase">Video</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                         <span className="text-[10px] font-bold text-slate-500 uppercase">Hình ảnh</span>
                      </div>
                   </div>
                </div>
                <div className="flex-1 flex items-end">
                   <SimpleBarChart 
                      data={stats.categoryData.map(c => ({
                         label: c.label,
                         value: c.value,
                         color: c.label === 'Video' ? 'bg-purple-500' : c.label === 'Hình ảnh' ? 'bg-indigo-500' : c.label === 'Giả live' ? 'bg-rose-400' : 'bg-slate-400'
                      }))}
                      height={300}
                   />
                </div>
             </div>
          </div>
        )}

        {/* VIEW 6: TIMELINE (DAILY & WEEKLY) - NEW */}
        {viewTab === 'timeline' && (
           <div className="space-y-6">
              {/* Daily Chart */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
                 <h3 className="text-lg font-bold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <CalendarDays size={18} className="text-rose-600"/> Thống kê theo Ngày
                 </h3>
                 <p className="text-sm text-gray-400 mb-6">Số lượng order phát sinh từng ngày</p>
                 
                 <div className="overflow-x-auto pb-4 custom-scrollbar">
                    <div style={{ minWidth: Math.max(100, stats.dailyData.length * 40) + 'px' }}>
                        <SimpleBarChart 
                           data={stats.dailyData.map(d => ({
                              label: d.label,
                              value: d.value,
                              color: 'bg-rose-400'
                           }))}
                           height={280}
                           barWidth="w-full max-w-[20px]"
                        />
                    </div>
                 </div>
              </div>

              {/* Weekly Chart */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
                 <h3 className="text-lg font-bold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={18} className="text-indigo-600"/> Thống kê theo Tuần
                 </h3>
                 <p className="text-sm text-gray-400 mb-6">Tổng hợp khối lượng công việc theo tuần</p>
                 <div className="flex-1 flex items-end">
                    <SimpleBarChart 
                       data={stats.weeklyData.map(w => ({
                          label: w.label,
                          value: w.value,
                          color: 'bg-indigo-500'
                       }))}
                       height={280}
                    />
                 </div>
              </div>
           </div>
        )}

        {/* VIEW 2: DEPARTMENT ANALYTICS */}
        {viewTab === 'department' && (
           <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
              <div className="flex justify-between items-end mb-8">
                 <div>
                    <h3 className="text-lg font-bold text-gray-800">Thống kê theo Phòng ban</h3>
                    <p className="text-sm text-gray-500">Số lượng yêu cầu từ các bộ phận khác nhau</p>
                 </div>
                 <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                    Top Order: {stats.deptData.sort((a,b) => b.value - a.value)[0]?.label || 'N/A'}
                 </div>
              </div>
              
              <div className="space-y-4">
                 {stats.deptData.sort((a,b) => b.value - a.value).map((dept, idx) => {
                    const percent = (dept.value / stats.total) * 100;
                    return (
                       <div key={idx} className="group">
                          <div className="flex justify-between text-sm mb-1">
                             <span className="font-bold text-gray-700 flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-mono">#{idx+1}</span>
                                {dept.label}
                             </span>
                             <span className="font-bold text-indigo-600">{dept.value} <span className="text-gray-400 text-xs font-normal">orders</span></span>
                          </div>
                          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all duration-1000 group-hover:scale-x-105 origin-left"
                               style={{ width: `${percent}%` }}
                             ></div>
                          </div>
                       </div>
                    );
                 })}
              </div>
           </div>
        )}

        {/* VIEW 3: PERSONNEL PERFORMANCE */}
        {viewTab === 'personnel' && (
           <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <TrendingUp className="text-indigo-600"/> Bảng xếp hạng hiệu suất
                 </h3>
                 <div className="flex gap-2 text-[10px] font-bold uppercase text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Hoàn thành</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200"></span> Tồn đọng</span>
                 </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-gray-400 text-[11px] uppercase tracking-wider font-bold border-b border-gray-100 bg-white">
                      <th className="px-6 py-4">Hạng</th>
                      <th className="px-6 py-4">Nhân sự</th>
                      <th className="px-6 py-4">Vai trò</th>
                      <th className="px-6 py-4 text-center">Tổng Order</th>
                      <th className="px-6 py-4 text-center">Hoàn tất</th>
                      <th className="px-6 py-4 text-center">Còn lại</th>
                      <th className="px-6 py-4 text-center">Hiệu suất</th>
                      <th className="px-6 py-4 text-right">Quá hạn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm">
                    {stats.personnelList.map((person, idx) => {
                       const percent = person.total > 0 ? Math.round((person.completed / person.total) * 100) : 0;
                       let rankColor = "bg-gray-100 text-gray-500";
                       if (idx === 0) rankColor = "bg-yellow-100 text-yellow-700 shadow-yellow-100";
                       if (idx === 1) rankColor = "bg-gray-200 text-gray-700";
                       if (idx === 2) rankColor = "bg-orange-100 text-orange-700";

                       return (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                           <td className="px-6 py-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm ${rankColor}`}>
                                 {idx + 1}
                              </div>
                           </td>
                           <td className="px-6 py-4 font-bold text-gray-700">
                              {person.name}
                           </td>
                           <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                person.role === 'Video' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                person.role === 'Photo' ? 'bg-teal-50 text-teal-700 border-teal-100' :
                                person.role === 'Designer' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' :
                                'bg-pink-50 text-pink-700 border-pink-100'
                              }`}>
                                {person.role === 'Video' ? <Video size={10} /> : 
                                 person.role === 'Photo' ? <Camera size={10} /> : 
                                 person.role === 'Designer' ? <Palette size={10} /> : 
                                 <Scissors size={10} />}
                                {person.role}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-center font-bold text-gray-800">
                              {person.total}
                           </td>
                           <td className="px-6 py-4 text-center font-bold text-green-600">
                              {person.completed}
                           </td>
                           <td className="px-6 py-4 text-center font-bold text-orange-600">
                              {person.total - person.completed}
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                      style={{ width: `${percent}%` }}
                                    ></div>
                                 </div>
                                 <span className="text-xs font-bold w-8 text-right">{percent}%</span>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                              {person.overdue > 0 ? (
                                 <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded-md text-xs">{person.overdue}</span>
                              ) : (
                                 <span className="text-gray-300">-</span>
                              )}
                           </td>
                        </tr>
                       );
                    })}
                  </tbody>
                </table>
              </div>
           </div>
        )}

        {/* VIEW 4: WORKLOAD MATRIX */}
        {viewTab === 'workload' && (
           <WorkloadMatrix 
              data={filteredData} 
              month={matrixDateInfo.month} 
              year={matrixDateInfo.year}
              isDesignView={isDesignView}
           />
        )}
        
        {/* VIEW 5: COST ANALYSIS */}
        {viewTab === 'cost' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cost Structure Pie */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl flex flex-col items-center">
                 <h3 className="text-lg font-bold text-gray-800 mb-6 uppercase tracking-wider w-full text-center">Cơ cấu chi phí</h3>
                 <SimpleDonutChart 
                    data={stats.costStructureData} 
                    size={240}
                 />
                 <div className="grid grid-cols-2 gap-3 mt-8 w-full">
                    {stats.costStructureData.map((s, idx) => (
                       <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded-lg">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }}></span>
                          <span className="text-gray-600 font-medium truncate flex-1">{s.label}</span>
                          <span className="font-bold text-gray-800">{s.value.toLocaleString('vi-VN')} đ</span>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Cost by Dept Bar */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl flex flex-col">
                 <h3 className="text-lg font-bold text-gray-800 mb-2 uppercase tracking-wider">Chi phí theo phòng ban</h3>
                 <p className="text-sm text-gray-400 mb-6">Ngân sách sử dụng (đơn vị: VNĐ)</p>
                 <div className="flex-1 flex items-end">
                    <SimpleBarChart 
                       data={stats.costByDeptData.map(c => ({
                          label: c.label,
                          value: c.value,
                          color: 'bg-emerald-500'
                       }))}
                       height={300}
                       formatValue={(val) => val.toLocaleString('vi-VN')}
                    />
                 </div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};
