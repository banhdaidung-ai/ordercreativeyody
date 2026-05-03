import React from 'react';
import { PlanItem } from '../../types';
import { AutoHeightTextarea, AutoNumberInput } from './PlanningUI';
import { Trash2 } from 'lucide-react';
import { COL_INDEX_WIDTH, COL_CAMPAIGN_WIDTH, STICKY_POS, FORMATS } from './constants';

interface PlanningRowProps {
    item: PlanItem;
    idx: number;
    isLocked: boolean;
    updateItem: (id: string, field: string, val: any) => void;
    handleDeleteItem: (id: string) => void;
    days: number[];
}

export const PlanningRow = React.memo(({ 
    item, 
    idx, 
    isLocked, 
    updateItem, 
    handleDeleteItem, 
    days 
}: PlanningRowProps) => {
    return (
        <tr className="hover:bg-gray-50 transition-colors group border-b border-gray-100">
            <td className="p-3 border-r border-gray-200 text-center text-gray-400 sticky bg-white group-hover:bg-gray-50 z-10" style={{ left: STICKY_POS.index, width: COL_INDEX_WIDTH }}>{idx + 1}</td>
            <td className="p-0 border-r border-gray-200 sticky bg-white group-hover:bg-gray-50 z-10 align-top" style={{ left: STICKY_POS.campaign, width: COL_CAMPAIGN_WIDTH }}>
                <AutoHeightTextarea 
                    value={item.campaign} 
                    readOnly={isLocked} 
                    onChange={val => updateItem(item.id, 'campaign', val)} 
                    className="font-medium text-gray-800" 
                    placeholder="Tên chiến dịch..."
                />
            </td>
            <td className="p-0 border-r border-gray-200 align-top">
                <select 
                    value={item.format} 
                    disabled={isLocked} 
                    onChange={e => updateItem(item.id, 'format', e.target.value)} 
                    className="w-full h-[48px] p-2 bg-transparent outline-none text-xs cursor-pointer text-gray-700"
                >
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
            </td>
            <td className="p-3 border-r border-gray-200 text-center font-bold text-indigo-700 bg-indigo-50/30 group-hover:bg-indigo-50 align-top">{item.totalTarget}</td>
            <td className="p-0 border-r border-gray-200 align-top">
                <AutoHeightTextarea 
                    value={item.outcome} 
                    readOnly={isLocked} 
                    onChange={val => updateItem(item.id, 'outcome', val)} 
                    className="text-xs text-gray-600" 
                    placeholder="Outcome..."
                />
            </td>
            <td className="p-0 border-r border-gray-200 align-top">
                <AutoHeightTextarea 
                    value={item.comment} 
                    readOnly={isLocked} 
                    onChange={val => updateItem(item.id, 'comment', val)} 
                    className="text-xs text-gray-600" 
                    placeholder="Ghi chú..."
                />
            </td>
            <td className="p-0 border-r border-gray-200 bg-amber-50/30 align-top">
                <AutoNumberInput 
                    value={item.estimatedCost} 
                    readOnly={isLocked} 
                    onChange={v => updateItem(item.id, 'estimatedCost', v)} 
                    className="w-full h-[48px] p-2 text-right font-mono font-bold text-amber-800 bg-transparent"
                />
            </td>
            {days.map(d => (
                <td key={d} className="p-0 border-r border-gray-200 align-top">
                    <input
                        type="number"
                        value={item[`d${d}`] || ''}
                        readOnly={isLocked}
                        onChange={e => updateItem(item.id, `d${d}`, parseInt(e.target.value, 10) || 0)}
                        className={`w-full h-[48px] p-1 text-center outline-none bg-transparent text-xs font-medium ${Number(item[`d${d}`]) > 0 ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-gray-400'}`}
                        placeholder="-"
                    />
                </td>
            ))}
            <td className="p-2 text-center align-top pt-3">
                {!isLocked && (
                    <button 
                        onClick={() => handleDeleteItem(item.id)} 
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Xóa dòng"
                    >
                        <Trash2 size={16}/>
                    </button>
                )}
            </td>
        </tr>
    );
});
