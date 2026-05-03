
import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Link as LinkIcon, Palette, Check, Trash2, Plus, X, Maximize2, Copy, List, ListOrdered, Underline, Italic, Eraser, DollarSign, FileText, Info, ExternalLink, Clock } from 'lucide-react';
import { MasterDataItem } from '../types';

const PRESET_STYLES: Record<string, { bg: string, text: string, border: string }> = {
    // Trạng thái
    'hoàn tất': { bg: 'rgba(220, 252, 231, 0.6)', text: '#15803d', border: 'rgba(21, 128, 61, 0.2)' }, // Emerald 100
    'hủy': { bg: 'rgba(254, 226, 226, 0.6)', text: '#b91c1c', border: 'rgba(185, 28, 28, 0.2)' },      // Red 100
    'đang thực hiện': { bg: 'rgba(254, 243, 199, 0.6)', text: '#b45309', border: 'rgba(180, 83, 9, 0.2)' }, // Amber 100
    'đang quay': { bg: 'rgba(254, 243, 199, 0.6)', text: '#b45309', border: 'rgba(180, 83, 9, 0.2)' },
    'đang hậu kì': { bg: 'rgba(237, 233, 254, 0.6)', text: '#6d28d9', border: 'rgba(109, 40, 217, 0.2)' }, // Violet 100
    'xác nhận': { bg: 'rgba(219, 234, 254, 0.6)', text: '#1d4ed8', border: 'rgba(29, 78, 216, 0.2)' },   // Blue 100
    'chờ duyệt': { bg: 'rgba(241, 245, 249, 0.6)', text: '#475569', border: 'rgba(71, 85, 105, 0.2)' },  // Slate 100
    
    // Loại order
    'hình ảnh': { bg: 'rgba(224, 231, 255, 0.6)', text: '#3730a3', border: 'rgba(55, 48, 163, 0.2)' },   // Indigo 100
    'video': { bg: 'rgba(243, 232, 255, 0.6)', text: '#6b21a8', border: 'rgba(107, 33, 168, 0.2)' },      // Purple 100
    'design': { bg: 'rgba(236, 254, 255, 0.6)', text: '#0891b2', border: 'rgba(8, 145, 178, 0.2)' },     // Cyan 100
    'animation': { bg: 'rgba(253, 242, 248, 0.6)', text: '#be185d', border: 'rgba(190, 24, 93, 0.2)' },  // Pink 100
    'giả live': { bg: 'rgba(255, 241, 242, 0.6)', text: '#e11d48', border: 'rgba(225, 29, 72, 0.2)' },   // Rose 100
};

const getCustomStyleForValue = (value: string, config?: MasterDataItem[]): React.CSSProperties => {
    if (!value) return {};
    
    const lowerVal = value.trim().toLowerCase();

    // 1. Check in Manual Presets first for semantic meaning
    if (PRESET_STYLES[lowerVal]) {
        return {
            backgroundColor: PRESET_STYLES[lowerVal].bg,
            color: PRESET_STYLES[lowerVal].text,
            fontWeight: 700,
            borderRadius: '8px',
            border: `1px solid ${PRESET_STYLES[lowerVal].border}`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '9px',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        };
    }

    // 2. Check in Cloud Config (Master Data)
    if (config && config.length > 0) {
       const matchedItem = config.find(item => item.value.trim().toLowerCase() === lowerVal);
       if (matchedItem && matchedItem.color) {
          return {
             backgroundColor: matchedItem.color.startsWith('rgba') ? matchedItem.color : `${matchedItem.color}99`, // Add transparency if not already there
             color: matchedItem.textColor || '#1f2937',
             fontWeight: 600,
             borderRadius: '8px',
             border: '1px solid rgba(0,0,0,0.08)',
             backdropFilter: 'blur(4px)',
             fontSize: '10px'
          };
       }
    }

    // 3. Dynamic Hashing for Personnel/Others
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate a pleasant pastel color based on hash
    const hue = Math.abs(hash % 360);
    return {
        backgroundColor: `hsla(${hue}, 70%, 95%, 0.6)`,
        color: `hsl(${hue}, 60%, 25%)`,
        fontWeight: 600,
        borderRadius: '8px',
        border: `1px solid hsla(${hue}, 60%, 85%, 0.5)`,
        backdropFilter: 'blur(4px)',
        fontSize: '10px'
    };
};

export const autoLinkify = (html: string) => {
  if (!html) return html;
  const urlPattern = /(?<!href="|src="|">)(https?:\/\/[^\s<]+|www\.[^\s<]+)(?![^<]*<\/a>)/g;
  return html.replace(urlPattern, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    // Kiểm tra nếu là URL hình ảnh
    if (/\.(jpeg|jpg|png|gif|webp)(\?.*)?/i.test(href)) {
      return `<img src="${href}" alt="Image" class="max-w-full h-auto rounded-lg my-2" />`;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline cursor-pointer font-medium">${url}</a>`;
  });
};

interface SelectCellProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  options: string[];
  masterDataConfig?: MasterDataItem[]; 
  type?: string;
  readOnly?: boolean;
}

export const SelectCell: React.FC<SelectCellProps> = ({ value, onChange, onFocus, onBlur, options, type = 'default', masterDataConfig, readOnly = false }) => {
  const customStyle = useMemo(() => getCustomStyleForValue(value, masterDataConfig), [value, masterDataConfig]);
  const [isFocused, setIsFocused] = useState(false);
  const selectId = useMemo(() => `sel-${Math.random().toString(36).substring(2, 9)}`, []);

  const selectStyle: React.CSSProperties = {
      ...(Object.keys(customStyle).length > 0 ? customStyle : {}),
      opacity: readOnly ? 0.6 : 1,
      cursor: readOnly ? 'not-allowed' : 'pointer',
      pointerEvents: readOnly ? 'none' : 'auto',
  };

  return (
    <div className="w-full h-full flex items-center px-1.5"
         onMouseEnter={() => !readOnly && setIsFocused(true)}
         onMouseLeave={() => { if (document.activeElement !== document.getElementById(selectId)) setIsFocused(false); }}
    >
      <select
        id={selectId}
        value={value}
        onChange={onChange}
        onFocus={(e) => { setIsFocused(true); onFocus?.(); }}
        onBlur={(e) => { setIsFocused(false); onBlur?.(); }}
        onClick={(e) => e.stopPropagation()}
        disabled={readOnly}
        style={selectStyle}
        className={`w-full h-full text-[10px] py-1 px-2 rounded-lg border-transparent outline-none transition-colors cursor-pointer truncate shadow-sm hover:brightness-95 appearance-none text-center font-bold ${Object.keys(customStyle).length === 0 ? 'bg-white/40  text-gray-700 border-gray-200/50 hover:bg-white/60' : ''}`}
      >
        {!isFocused && value ? (
          <option value={value} className="bg-white text-gray-800 font-medium">{value}</option>
        ) : (
          <>
            <option value="" className="bg-white text-gray-400 font-normal italic">-- Trống --</option>
            {options.map((opt) => (
              <option key={opt} value={opt} className="bg-white text-gray-800 font-medium">{opt}</option>
            ))}
          </>
        )}
      </select>
    </div>
  );
};

export const TextCell: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCommit?: (oldValue: string, newValue: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  isLink?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}> = ({ value, onChange, onCommit, onFocus, onBlur, className = '', isLink = false, placeholder = '', readOnly = false }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setLocalValue(value);
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleFocus = () => {
    setIsEditing(true);
    if (onFocus) onFocus();
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(false);
    if (onBlur) onBlur();
    if (localValue !== value) {
      onChange({ target: { value: localValue } } as React.ChangeEvent<HTMLInputElement>);
      if (onCommit) {
        onCommit(value, localValue);
      }
    }
  };

  const isUrl = localValue && (localValue.startsWith('http') || localValue.startsWith('www'));

  return (
    <div className="relative w-full h-full flex items-center group px-1">
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full h-full px-2 text-[11px] bg-transparent border border-transparent outline-none transition-colors rounded-lg
          ${readOnly ? 'cursor-not-allowed' : 'focus:border-indigo-500/50 focus:bg-white/80 focus: focus:shadow-inner hover:bg-black/5'}
          ${className ? className : (readOnly ? 'text-gray-400 italic' : 'text-gray-700')}
          ${isLink ? 'text-blue-600 font-bold hover:underline pr-7' : ''}`}
      />
      {isLink && isUrl && (
        <a 
          href={localValue.startsWith('http') ? localValue : `https://${localValue}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="absolute right-2 p-1.5 text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-50 rounded-full"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
};

export const TextAreaCell: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onCommit?: (oldValue: string, newValue: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  manualSave?: boolean;
}> = ({ value, onChange, onCommit, onFocus, onBlur, className = '', placeholder = '', readOnly = false, manualSave = false }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setLocalValue(value);
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  };

  const handleFocus = () => {
    setIsEditing(true);
    if (onFocus) onFocus();
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsEditing(false);
    if (manualSave) return; 
    
    if (onBlur) onBlur();
    if (localValue !== value) {
      onChange({ target: { value: localValue } } as React.ChangeEvent<HTMLTextAreaElement>);
      if (onCommit) {
        onCommit(value, localValue);
      }
    }
  };

  const handleSave = () => {
    if (localValue !== value) {
        onChange({ target: { value: localValue } } as React.ChangeEvent<HTMLTextAreaElement>);
        if (onCommit) onCommit(value, localValue);
    }
    if (onBlur) onBlur();
  };

  const handleCancel = () => {
      setLocalValue(value);
      if (onBlur) onBlur();
  };

  return (
    <div className={`relative w-full h-full px-1 ${isEditing && manualSave ? 'z-50' : ''}`}>
      <textarea
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full h-full px-2 py-1.5 text-[11px] bg-transparent border border-transparent outline-none transition-colors rounded-lg focus:border-indigo-500/50 focus:bg-white/90 focus: resize-none ${className ? className : (readOnly ? 'text-gray-400 italic' : 'text-gray-700')} ${readOnly ? 'cursor-not-allowed' : 'hover:bg-black/5'} ${isEditing && manualSave && !readOnly ? 'border-indigo-500 bg-white shadow-xl' : ''}`}
        rows={1}
        style={{ minHeight: '100%' }}
      />
      {isEditing && manualSave && !readOnly && (
        <div className="absolute top-full right-1 mt-1 flex gap-1 bg-white/90  p-1 rounded-xl border border-gray-200 shadow-2xl z-50 animate-in zoom-in-95">
            <button onClick={handleSave} className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"><Check size={14}/></button>
            <button onClick={handleCancel} className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"><X size={14}/></button>
        </div>
      )}
    </div>
  );
};

export const DateCell: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  readOnly?: boolean;
}> = ({ value, onChange, onFocus, onBlur, readOnly = false }) => {
  const hasValue = !!value;
  
  const hasTime = value.includes('T');
  const dateValue = hasTime ? value.split('T')[0] : value;
  const timeValue = hasTime ? value.split('T')[1] : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (hasTime && timeValue) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: `${newDate}T${timeValue}`
        }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      onChange(e);
    }
  };

  return (
    <div className={`w-full h-full relative group px-1 ${readOnly ? 'pointer-events-none' : ''}`} title={hasTime ? `Giờ: ${timeValue}` : undefined}>
      <input
        type="date"
        value={dateValue}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        readOnly={readOnly}
        className={`
           w-full h-full px-2 text-[11px] bg-transparent border border-transparent outline-none rounded-lg
           focus:border-indigo-500/50 focus:bg-white/90 focus: focus:text-gray-900 focus:opacity-100
           font-mono uppercase transition-all hover:bg-black/5
           ${readOnly ? 'text-gray-300' : ''}
           ${hasValue ? 'text-gray-900 font-black opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'} 
        `}
      />
      {hasTime && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
          <Clock size={10} className="text-indigo-600" />
        </div>
      )}
      {!hasValue && (
        <div className="absolute inset-0 flex items-center px-3 pointer-events-none group-hover:opacity-0 transition-opacity">
            <span className="text-gray-300 opacity-50 font-bold select-none tracking-tighter">--/--</span>
        </div>
      )}
    </div>
  );
};

export const CheckboxCell: React.FC<{
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
}> = ({ checked, onChange, readOnly = false }) => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <label className={`relative flex items-center justify-center cursor-pointer group ${readOnly ? 'pointer-events-none opacity-50' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          onClick={(e) => e.stopPropagation()}
          disabled={readOnly}
          className="peer sr-only"
        />
        <div className={`
          w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center
          ${checked 
            ? 'bg-indigo-600 border-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.4)]' 
            : 'bg-white/40  border-gray-300 group-hover:border-indigo-400 group-hover:bg-white/60'}
        `}>
          <Check 
            size={12} 
            className={`text-white transition-all duration-200 transform ${checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} 
            strokeWidth={4}
          />
        </div>
      </label>
    </div>
  );
};

export const NumberCell: React.FC<{
  value: string;
  onChange: (newValue: string) => void;
  onCommit?: (oldValue: string, newValue: string) => void;
  readOnly?: boolean;
}> = ({ value, onChange, onCommit, readOnly = false }) => {
    const [localValue, setLocalValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    
    useEffect(() => {
        if (!isEditing) setLocalValue(value);
    }, [value, isEditing]);

    const formatNumber = (numStr: string) => {
        const num = parseFloat(numStr.replace(/[^0-9.-]+/g, ""));
        if (isNaN(num)) return numStr;
        return num.toLocaleString('vi-VN');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (localValue !== value) {
             onChange(localValue);
             if (onCommit) onCommit(value, localValue);
        }
    };

    return (
        <div className="w-full h-full px-1">
            <input
                type="text"
                value={isEditing ? localValue : formatNumber(value)}
                onChange={handleChange}
                readOnly={readOnly}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => {
                    if (readOnly) return;
                    setIsEditing(true);
                    setLocalValue(value.replace(/\./g, ''));
                }}
                onBlur={handleBlur}
                className={`w-full h-full px-2 text-[11px] text-right bg-transparent border border-transparent outline-none rounded-lg focus:border-indigo-500/50 focus:bg-white/90 focus: font-mono font-black text-gray-700 hover:bg-black/5 transition-colors ${readOnly ? 'text-gray-400 cursor-not-allowed' : ''}`}
                placeholder="0"
            />
        </div>
    );
};

export const CostCell: React.FC<{
  value: string;
  onClick: () => void;
  readOnly?: boolean;
}> = ({ value, onClick, readOnly = false }) => {
  const hasValue = value && value !== '0' && value !== '';
  return (
    <div className="w-full h-full px-1.5 py-1">
        <div 
        onClick={(e) => {
            if (readOnly) return;
            e.stopPropagation();
            onClick();
        }}
        className={`w-full h-full px-2 flex items-center justify-end text-[11px] font-mono transition-colors relative group rounded-lg border border-transparent ${hasValue ? 'text-emerald-700 font-black bg-emerald-50/50 border-emerald-100/50 shadow-sm' : 'text-gray-400 bg-gray-50/30'} ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-emerald-100/80 hover:border-emerald-200 hover:shadow-md active:scale-[0.98]'}`}
        >
        {hasValue ? value : '0'}
        {!readOnly && (
            <div className="absolute left-2 opacity-0 group-hover:opacity-100 transition-all text-emerald-500 scale-75 group-hover:scale-100">
            <DollarSign size={12} />
            </div>
        )}
        </div>
    </div>
  );
};

export const DynamicListCell: React.FC<{
  value: string;
  onChange: (newValue: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  options?: string[]; 
  masterDataConfig?: MasterDataItem[];
  colorize?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}> = ({ value, onChange, onFocus, onBlur, options = [], colorize = false, placeholder, masterDataConfig, readOnly = false }) => {
  
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const listId = useMemo(() => `datalist-${Math.random().toString(36).substr(2, 9)}`, []);

  useEffect(() => {
    if (!isEditing) setLocalValue(value);
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleFocus = () => {
    setIsEditing(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onBlur) onBlur();
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const customStyle = colorize ? getCustomStyleForValue(localValue, masterDataConfig) : {};
  let finalStyle: React.CSSProperties = { 
      ...customStyle,
      paddingTop: '2px',
      paddingBottom: '2px',
      textAlign: colorize ? 'center' : 'left'
  };
  
  if (readOnly) {
      finalStyle = { ...finalStyle, opacity: 0.6, cursor: 'not-allowed' };
  }

  const hasCustomStyle = localValue && colorize && Object.keys(customStyle).length > 0;

  return (
      <div className={`w-full h-full relative group p-1.5 ${readOnly ? 'pointer-events-none' : ''}`}>
          <input
             type="text"
             list={listId}
             value={localValue}
             onChange={handleChange}
             onFocus={handleFocus}
             onBlur={handleBlur}
             onClick={(e) => {
               e.stopPropagation();
               e.currentTarget.select();
             }}
             readOnly={readOnly}
             placeholder={placeholder}
             className={`w-full h-full px-2 text-[10px] outline-none focus:border-indigo-500/50 focus:bg-white/90 focus: truncate transition-colors rounded-lg font-bold shadow-sm ${
                !hasCustomStyle ? 'bg-white/40 border border-transparent hover:border-gray-200/50 hover:bg-white/60' : 'border-transparent'
             } ${readOnly ? 'text-gray-400 italic' : ''}`}
             style={hasCustomStyle || readOnly ? finalStyle : {}}
          />
          {!readOnly && isEditing && (
            <datalist id={listId}>
                {options.map((opt, i) => (
                    <option key={i} value={opt} />
                ))}
            </datalist>
          )}
      </div>
  );
};

export const TooltipCell: React.FC<{
  displayValue: string;
  tooltipContent: string;
}> = ({ displayValue, tooltipContent }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number, left: number, align: 'bottom' | 'top' }>({ top: 0, left: 0, align: 'bottom' });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const showTimerRef = useRef<any>(null);
  const hideTimerRef = useRef<any>(null);

  const handleMouseEnter = () => {
    if (!tooltipContent || tooltipContent.trim() === '') return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    showTimerRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const tooltipWidth = 450;
        const estimatedHeight = 350;

        let top = rect.bottom + 8;
        let left = rect.left;
        let align: 'bottom' | 'top' = 'bottom';

        if (top + estimatedHeight > viewportHeight) {
           top = rect.top - 8;
           align = 'top';
        }

        if (left + tooltipWidth > viewportWidth) {
           left = viewportWidth - tooltipWidth - 20;
        }

        setCoords({ top, left, align });
        setIsVisible(true);
      }
    }, 450);
  };

  const handleMouseLeave = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };

  const handleTooltipMouseEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  const handleTooltipMouseLeave = () => {
    handleMouseLeave();
  };

  useEffect(() => {
    return () => {
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full relative group cursor-help px-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w-full h-full px-2 py-1.5 text-[11px] text-gray-700 hover:text-indigo-600 transition-all truncate font-bold select-none flex items-center gap-1.5 rounded-lg hover:bg-indigo-50/50">
          <span className="truncate flex-1">{displayValue || <span className="text-gray-300 italic font-normal tracking-tighter">-- Trống --</span>}</span>
          {tooltipContent && <Info size={10} className="text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors"/>}
        </div>
        {tooltipContent && <div className="absolute bottom-1.5 left-3 right-3 h-[1.5px] bg-indigo-200/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full"></div>}
      </div>

      {isVisible && createPortal(
        <div 
            className="fixed z-[9999] bg-white/95  border border-gray-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-2xl w-[450px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border-t-4 border-t-indigo-500"
            style={{ 
                top: coords.top, 
                left: coords.left,
                transform: coords.align === 'top' ? 'translateY(-100%)' : 'none'
            }}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
        >
            <div className="px-5 py-3.5 bg-gray-50/80  border-b border-gray-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.15em] flex items-center gap-2">
                    <FileText size={14} className="text-indigo-500"/> Chi tiết nội dung Brief
                </span>
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">Scroll to read</span>
            </div>
            
            <div className="p-6 max-h-[350px] overflow-y-auto custom-scrollbar bg-white/40 select-text">
                <div 
                  dangerouslySetInnerHTML={{ __html: autoLinkify(tooltipContent) }} 
                  className="prose prose-sm prose-indigo max-w-none text-[13px] text-gray-600 leading-relaxed
                             [&_strong]:text-gray-900 [&_strong]:font-black
                             [&_b]:text-gray-900 [&_b]:font-black
                             [&_a]:text-indigo-600 [&_a]:underline [&_a]:font-bold [&_a]:cursor-pointer hover:[&_a]:text-indigo-800
                             [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                             [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                             [&_p]:mb-4 [&_p:last-child]:mb-0"
                />
            </div>
            
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500 opacity-80"></div>
        </div>,
        document.body
      )}
    </>
  );
};

const ToolbarButton: React.FC<{ 
    onClick: (e: React.MouseEvent) => void, 
    icon: React.ReactNode, 
    tooltip: string, 
    className?: string,
    active?: boolean 
}> = ({ onClick, icon, tooltip, className, active }) => (
    <button 
      onMouseDown={(e) => { e.preventDefault(); onClick(e); }} 
      className={`p-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-indigo-600 text-white shadow-md scale-105' : 'hover:bg-gray-100 text-gray-500 hover:text-indigo-600'} active:scale-95 ${className}`} 
      title={tooltip}
    >
      {icon}
    </button>
);

const RichTextEditorModal: React.FC<{
  initialValue: string;
  onSave: (val: string) => void;
  onClose: () => void;
  title?: string;
  readOnly?: boolean;
}> = ({ initialValue, onSave, onClose, title = "Chỉnh sửa nội dung", readOnly = false }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null); 
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useLayoutEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = autoLinkify(initialValue || '');
      if (!readOnly) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
        editorRef.current.focus();
      }
    }
  }, [readOnly, initialValue]); 

  const handleLinkClickInEditor = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const saveSelection = () => {
    if (readOnly) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      selectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (readOnly) return;
    const sel = window.getSelection();
    if (sel && selectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(selectionRef.current);
    } else if (editorRef.current) {
        editorRef.current.focus();
    }
  };

  const handleEditorInteraction = () => {
    saveSelection();
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (readOnly) return;
    restoreSelection();
    if (command === 'foreColor' || command === 'hiliteColor') {
        document.execCommand('styleWithCSS', false, 'true');
    } else {
        document.execCommand('styleWithCSS', false, 'false');
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
        editorRef.current.focus();
        saveSelection();
    }
  };

  const handleColorClick = (color: string) => {
    execCmd("foreColor", color);
    setShowColorPicker(false);
  };

  const handleLinkClick = () => {
      saveSelection(); 
      setLinkUrl('');
      setShowLinkInput(!showLinkInput);
      setShowColorPicker(false);
  };

  const applyLink = () => {
      if (linkUrl) {
          execCmd("createLink", linkUrl);
      }
      setShowLinkInput(false);
  };

  const handleSave = () => {
    if (readOnly) {
        onClose();
        return;
    }
    if (editorRef.current) {
      const walk = (node: Node) => {
        if (node.nodeType === 3) {
          const text = node.nodeValue || '';
          const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
          if (urlPattern.test(text)) {
            const span = document.createElement('span');
            span.innerHTML = text.replace(urlPattern, (url) => {
              const href = url.startsWith('http') ? url : `https://${url}`;
              return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline cursor-pointer font-medium">${url}</a>`;
            });
            node.parentNode?.replaceChild(span, node);
          }
        } else if (node.nodeType === 1 && node.nodeName !== 'A') {
          Array.from(node.childNodes).forEach(walk);
        }
      };
      walk(editorRef.current);

      const links = editorRef.current.getElementsByTagName('a');
      for (let i = 0; i < links.length; i++) {
        links[i].setAttribute('target', '_blank');
        links[i].setAttribute('rel', 'noopener noreferrer');
        links[i].classList.add('text-blue-600', 'underline', 'cursor-pointer', 'font-medium');
      }
      onSave(editorRef.current.innerHTML);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40  animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-white/95  w-full max-w-4xl h-[85vh] rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/40 relative"
        onClick={(e) => { 
            e.stopPropagation(); 
        }}
      >
        <div className="px-8 py-6 border-b border-gray-100/50 flex justify-between items-center bg-white/40 ">
          <div className="flex flex-col">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <Maximize2 size={20}/>
              </div>
              {title} {readOnly && <span className="text-sm font-bold text-gray-400 ml-2">(Chỉ xem)</span>}
            </h3>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1 ml-12">Trình soạn thảo văn bản phong phú</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-rose-50 hover:text-rose-500 rounded-2xl text-gray-400 transition-all active:scale-90">
            <X size={24} />
          </button>
        </div>

        {!readOnly && (
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 bg-white/60  flex-wrap z-10 relative">
              <div className="flex bg-gray-100/50 p-1 rounded-xl gap-1">
                <ToolbarButton onClick={() => execCmd('bold')} icon={<Bold size={16}/>} tooltip="In đậm (Ctrl+B)" />
                <ToolbarButton onClick={() => execCmd('italic')} icon={<Italic size={16}/>} tooltip="In nghiêng (Ctrl+I)" />
                <ToolbarButton onClick={() => execCmd('underline')} icon={<Underline size={16}/>} tooltip="Gạch chân (Ctrl+U)" />
              </div>
              
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              
              <div className="relative">
                  <button 
                      onMouseDown={(e) => { 
                          e.preventDefault(); 
                          e.stopPropagation(); 
                          saveSelection();
                          setShowColorPicker(!showColorPicker); 
                          setShowLinkInput(false);
                      }} 
                      className={`p-2.5 rounded-xl transition-all ${showColorPicker ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Màu chữ"
                  >
                      <Palette size={18}/>
                  </button>
                  {showColorPicker && (
                      <div 
                          className="absolute top-full left-0 mt-3 p-4 bg-white/95  border border-gray-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl flex gap-2.5 z-50 animate-in slide-in-from-top-4 w-56 flex-wrap" 
                          onMouseDown={(e) => e.preventDefault()}
                      >
                          {['#000000', '#6b7280', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'].map(c => (
                          <button 
                              key={c} 
                              onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  handleColorClick(c); 
                              }} 
                              className="w-7 h-7 rounded-lg border border-gray-100 shadow-sm hover:scale-110 hover:shadow-md transition-all active:scale-95" 
                              style={{backgroundColor: c}} 
                              title={c}
                          />
                          ))}
                          <button 
                              onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  handleColorClick("black"); 
                              }} 
                              className="w-full text-[10px] font-black text-gray-400 mt-3 hover:text-indigo-600 border-t border-gray-100 pt-2 uppercase tracking-widest transition-colors"
                          >
                              Mặc định
                          </button>
                      </div>
                  )}
              </div>

              <div className="w-px h-6 bg-gray-200 mx-1"></div>

              <div className="flex bg-gray-100/50 p-1 rounded-xl gap-1">
                <ToolbarButton onClick={() => execCmd('insertUnorderedList')} icon={<List size={16}/>} tooltip="Danh sách" />
                <ToolbarButton onClick={() => execCmd('insertOrderedList')} icon={<ListOrdered size={16}/>} tooltip="Danh sách số" />
              </div>
              
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              
              <div className="relative">
                  <ToolbarButton 
                      onClick={handleLinkClick} 
                      icon={<LinkIcon size={16}/>} 
                      tooltip="Chèn Link" 
                      active={showLinkInput}
                      className={showLinkInput ? 'bg-indigo-600 text-white shadow-lg' : ''}
                  />
                  {showLinkInput && (
                      <div 
                          className="absolute top-full left-0 mt-3 p-3 bg-white/95  border border-gray-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl flex items-center gap-3 z-50 animate-in slide-in-from-top-4 w-72"
                          onMouseDown={(e) => e.stopPropagation()} 
                      >
                          <input 
                              type="text"
                              value={linkUrl}
                              onChange={(e) => setLinkUrl(e.target.value)}
                              placeholder="Nhập link (https://...)"
                              className="flex-1 text-xs border-none bg-gray-100 rounded-xl px-4 py-2.5 focus:ring-2 ring-indigo-500/20 outline-none font-medium"
                              onKeyDown={(e) => e.key === 'Enter' && applyLink()}
                              autoFocus
                          />
                          <button 
                              onClick={applyLink}
                              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95"
                          >
                              <Check size={16}/>
                          </button>
                      </div>
                  )}
              </div>

              <ToolbarButton onClick={() => execCmd('removeFormat')} icon={<Eraser size={16}/>} tooltip="Xóa định dạng" className="text-gray-400 hover:text-rose-500 hover:bg-rose-50" />
            </div>
        )}

        <div 
          className={`flex-1 overflow-y-auto bg-white/40 cursor-text ${readOnly ? 'bg-gray-50/50' : ''}`} 
          onClick={(e) => {
            handleLinkClickInEditor(e);
            if (!readOnly) editorRef.current?.focus();
          }}
        >
          <div
            ref={editorRef}
            contentEditable={!readOnly}
            onMouseUp={handleEditorInteraction}
            onKeyUp={handleEditorInteraction}
            onBlur={handleEditorInteraction}
            onClick={handleLinkClickInEditor}
            className={`w-full min-h-full p-10 outline-none prose prose-indigo sm:prose-base max-w-none text-gray-800 
              [&>ul]:list-disc [&>ul]:ml-6 [&>ol]:list-decimal [&>ol]:ml-6 
              [&>blockquote]:border-l-4 [&>blockquote]:border-indigo-200 [&>blockquote]:pl-6 [&>blockquote]:italic [&>blockquote]:bg-indigo-50/30 [&>blockquote]:py-2 [&>blockquote]:rounded-r-lg
              [&_a]:text-indigo-600 [&_a]:underline [&_a]:font-black [&_a]:cursor-pointer hover:[&_a]:text-indigo-800
              [&_strong]:font-black [&_b]:font-black
              ${readOnly ? 'cursor-default' : ''}`}
            style={{ tabSize: 4 }}
          />
        </div>

        <div className="px-8 py-6 border-t border-gray-100/50 bg-white/60  flex justify-end items-center gap-4">
           <button 
             onClick={onClose} 
             className="px-6 py-3 text-gray-500 font-black uppercase tracking-widest hover:bg-gray-100 rounded-2xl transition-all text-[11px] active:scale-95"
           >
             Hủy bỏ
           </button>
           {!readOnly && (
               <button 
                 onClick={handleSave} 
                 className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black uppercase tracking-widest rounded-2xl hover:shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 transition-all active:scale-95 text-[11px] flex items-center gap-3 shadow-lg"
               >
                <Check size={18} strokeWidth={3}/> Lưu nội dung
              </button>
           )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const RichTextCell: React.FC<{
  value: string;
  onChange: (newValue: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  enableTooltip?: boolean;
  title?: string;
  readOnly?: boolean;
  manualSave?: boolean;
}> = ({ value, onChange, onFocus, onBlur, enableTooltip = false, title, readOnly = false, manualSave = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = value;
    const textToCopy = tempDiv.innerText || tempDiv.textContent || "";
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!readOnly) {
        e.stopPropagation();
        if (onFocus) onFocus();
        setShowModal(true);
    }
  };

  const handleSave = (newVal: string) => {
    if (newVal !== value) {
      onChange(newVal);
    }
    setShowModal(false);
    if (onBlur) onBlur();
  };

  const handleClose = () => {
    setShowModal(false);
    if (onBlur) onBlur();
  };

  const linkifiedValue = useMemo(() => autoLinkify(value), [value]);

  return (
    <>
      <div
        className="relative w-full h-full group cursor-pointer overflow-hidden rounded-lg transition-all"
        onClick={handleClick}
      >
        <div 
           className={`w-full h-full px-3 py-2 text-[11px] text-gray-700 whitespace-pre-wrap break-words overflow-hidden relative z-0 transition-all
           [&_a]:text-indigo-600 [&_a]:underline [&_a]:font-black [&_a]:cursor-pointer 
           [&_b]:font-black [&_strong]:font-black
           [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 ${readOnly ? 'text-gray-400 italic' : ''}`}
           style={{ maxHeight: '100px' }} 
        >
            <div dangerouslySetInnerHTML={{ __html: linkifiedValue || '<span class="text-gray-300 italic font-normal tracking-tighter">-- Trống --</span>' }} />
        </div>

        <div className={`absolute inset-0 bg-indigo-600/5 -[2px] opacity-0 group-hover:opacity-100 transition-all z-10 flex items-center justify-center gap-3 border border-indigo-200/50 rounded-lg`}>
           <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 flex items-center gap-2 bg-white/90  px-3 py-1.5 rounded-xl shadow-lg border border-indigo-100">
               <Maximize2 size={12} strokeWidth={3} /> {readOnly ? 'Xem chi tiết' : 'Chỉnh sửa'}
             </span>
           </div>
           
           <button 
             onClick={handleCopy}
             className="absolute top-2 right-2 p-2 bg-white/90  text-gray-500 hover:text-indigo-600 hover:bg-white rounded-xl shadow-md border border-gray-100 transition-all active:scale-90"
             title="Sao chép nội dung"
           >
              {showToast ? <Check size={14} className="text-emerald-500" strokeWidth={3}/> : <Copy size={14} strokeWidth={2.5}/>}
           </button>
        </div>
      </div>

      {showModal && (
        <RichTextEditorModal 
          initialValue={value} 
          onSave={handleSave} 
          onClose={handleClose}
          title={title}
          readOnly={readOnly}
        />
      )}
    </>
  );
};
