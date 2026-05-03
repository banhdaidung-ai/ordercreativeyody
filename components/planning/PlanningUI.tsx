import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, X, AlertTriangle } from 'lucide-react';

export const Toast: React.FC<{ type: 'success' | 'error'; message: string; onClose: () => void }> = ({ type, message, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    const renderMessage = () => {
        const urlMatch = message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        if (urlMatch) {
            const parts = message.split(urlMatch[0]);
            return (
                <span className="text-sm font-medium">
                    {parts[0]}
                    <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer" className="underline text-blue-200 hover:text-white transition-colors decoration-2 underline-offset-4">tại đây</a>
                    {parts[1]}
                </span>
            );
        }
        return <span className="text-sm font-medium">{message}</span>;
    };

    return (
        <div className={`fixed bottom-8 right-8 flex items-center gap-5 px-8 py-5 rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.25)] z-[9999] animate-in slide-in-from-bottom-12 fade-in duration-700 border border-white/20 backdrop-blur-xl ${type === 'success' ? 'bg-slate-900/90 text-white' : 'bg-rose-600/90 text-white'}`}>
            <div className={`p-3 rounded-2xl ${type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/20 text-white'}`}>
                {type === 'error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
            </div>
            <div className="flex-1 pr-6">
                {renderMessage()}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all opacity-40 hover:opacity-100 active:scale-90">
                <X size={20}/>
            </button>
        </div>
    );
};

export const AutoNumberInput: React.FC<{ 
    value: number; 
    onChange: (v: number) => void; 
    className?: string; 
    readOnly?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
}> = ({ value, onChange, className, readOnly, onFocus, onBlur }) => {
    const [str, setStr] = useState(value?.toLocaleString('vi-VN') || '0');
    useEffect(() => setStr(value?.toLocaleString('vi-VN') || '0'), [value]);
    return (
        <input 
            type="text" 
            value={str} 
            readOnly={readOnly}
            onFocus={onFocus}
            onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setStr(Number(raw).toLocaleString('vi-VN'));
            }}
            onBlur={() => {
                const num = parseInt(str.replace(/\./g, ''), 10) || 0;
                onChange(num);
                setStr(num.toLocaleString('vi-VN'));
                if (onBlur) onBlur();
            }}
            className={`outline-none bg-transparent transition-all duration-300 focus:bg-white/50 ${className}`}
        />
    );
};

export const AutoHeightTextarea: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    className?: string;
    onFocus?: () => void;
    onBlur?: () => void;
}> = ({ value, onChange, placeholder, readOnly, className, onFocus, onBlur }) => {
    return (
        <div className="relative w-full h-full min-h-[52px] flex group/textarea">
            <div className={`w-full p-4 invisible whitespace-pre-wrap break-words pointer-events-none leading-relaxed ${className}`} aria-hidden="true">
                {(value || placeholder || ' ') + '\n'}
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`absolute inset-0 w-full h-full p-4 bg-transparent outline-none resize-none overflow-hidden leading-relaxed transition-all duration-300 focus:bg-white/50 ${className} ${readOnly ? 'cursor-default' : 'hover:bg-slate-50/50'}`}
                rows={1}
            />
        </div>
    );
};

export const MetricCell: React.FC<{
    actual: number;
    plan: number;
    colorBase: string; // e.g., 'indigo', 'purple'
    label?: string;
}> = ({ actual, plan, colorBase }) => {
    const percent = plan > 0 ? (actual / plan) * 100 : (actual > 0 ? 100 : 0);
    const displayPercent = percent.toFixed(0);
    const isReached = plan > 0 && actual >= plan;
    const isOver = plan > 0 && actual > plan; 
    
    const colors: any = {
        indigo: { text: 'text-indigo-900', bg: 'bg-white', bar: 'bg-indigo-600', barBg: 'bg-indigo-50', border: 'border-slate-200', label: 'text-indigo-600/50' },
        purple: { text: 'text-purple-900', bg: 'bg-white', bar: 'bg-purple-600', barBg: 'bg-purple-50', border: 'border-slate-200', label: 'text-purple-600/50' },
        cyan: { text: 'text-cyan-900', bg: 'bg-white', bar: 'bg-cyan-600', barBg: 'bg-cyan-50', border: 'border-slate-200', label: 'text-cyan-600/50' },
        gray: { text: 'text-slate-900', bg: 'bg-white', bar: 'bg-slate-600', barBg: 'bg-slate-50', border: 'border-slate-200', label: 'text-slate-600/50' },
        red: { text: 'text-red-900', bg: 'bg-red-50/30', bar: 'bg-red-600', barBg: 'bg-red-100', border: 'border-red-100', label: 'text-red-600/50' },
    };
    
    const c = isOver ? colors.red : (colors[colorBase] || colors.gray);

    return (
        <div className={`flex flex-col p-3 rounded-2xl border ${c.border} ${c.bg} h-full justify-between gap-3 relative overflow-visible group transition-all duration-300 hover:border-slate-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]`}>
            
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-900 text-white text-[11px] font-bold py-2 px-4 rounded-xl shadow-2xl flex flex-col items-center whitespace-nowrap relative">
                    <span className="tracking-tight">Tiến độ: {displayPercent}%</span>
                    {isOver && <span className="text-red-400 text-[10px] mt-0.5 font-medium">Vượt: +{actual - plan}</span>}
                    <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                </div>
            </div>

            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <span className={`text-2xl font-bold tracking-tighter leading-none ${c.text}`}>
                        {actual.toLocaleString('vi-VN')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.1em] mt-1.5 ${c.label}`}>
                        Kế hoạch: {plan.toLocaleString('vi-VN')}
                    </span>
                </div>
                
                {isReached && (
                    <div className={`p-1.5 rounded-full ${isOver ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {isOver ? <AlertTriangle size={14}/> : <CheckCircle2 size={14}/>}
                    </div>
                )}
            </div>
            
            <div className="relative h-2 w-full rounded-full overflow-hidden bg-slate-100">
                <div 
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${isOver ? 'bg-red-500' : (isReached ? 'bg-emerald-500' : c.bar)}`} 
                    style={{ width: `${Math.min(percent, 100)}%` }}
                >
                    {percent > 10 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                    )}
                </div>
            </div>
        </div>
    );
};
