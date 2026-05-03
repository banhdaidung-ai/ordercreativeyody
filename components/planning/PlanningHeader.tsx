import React from 'react';
import { Sigma } from 'lucide-react';
import { COL_INDEX_WIDTH, COL_CAMPAIGN_WIDTH } from './constants';

interface PlanningHeaderProps {
    days: number[];
    year: number;
    month: number;
    showSummary?: boolean;
    totals?: any;
}

export const PlanningHeader = React.memo(({ days, year, month, showSummary, totals }: PlanningHeaderProps) => {
    const getDayInfo = (d: number) => {
        const date = new Date(year, month, d);
        const dayOfWeek = date.getDay();
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return { label: dayNames[dayOfWeek], isWeekend: dayOfWeek === 0 || dayOfWeek === 6 };
    };

    return (
        <thead className="text-gray-600 font-bold uppercase tracking-wider text-[10px]">
            <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 pl-6 border-r border-gray-200 sticky top-0 left-0 bg-gray-50 z-[60] text-center" style={{ width: COL_INDEX_WIDTH }}>#</th>
                <th className="p-4 border-r border-gray-200 sticky top-0 left-[50px] bg-gray-50 z-[60] text-left" style={{ width: COL_CAMPAIGN_WIDTH }}>Chiến dịch</th>
                <th className="p-4 border-r border-gray-200 text-left min-w-[120px] sticky top-0 bg-gray-50 z-[50]">Định dạng</th>
                <th className="p-4 border-r border-gray-200 text-center min-w-[70px] sticky top-0 bg-gray-50 z-[50]">Tổng</th>
                <th className="p-4 border-r border-gray-200 text-left min-w-[250px] sticky top-0 bg-gray-50 z-[50]">Outcome</th>
                <th className="p-4 border-r border-gray-200 text-left min-w-[200px] sticky top-0 bg-gray-50 z-[50]">Comment</th>
                <th className="p-4 border-r border-gray-200 text-right bg-amber-50/50 text-amber-800 min-w-[120px] sticky top-0 z-[50]">Ngân sách</th>
                {days.map(d => {
                    const { label, isWeekend } = getDayInfo(d);
                    return (
                        <th key={d} className={`p-2 border-r border-gray-200 text-center min-w-[40px] sticky top-0 z-[50] ${isWeekend ? 'bg-red-50/50 text-red-600' : 'bg-gray-50'}`}>
                            <div className="flex flex-col items-center">
                                <span className="opacity-60">{label}</span>
                                <span className="text-sm">{d}</span>
                            </div>
                        </th>
                    );
                })}
                <th className="p-4 sticky top-0 bg-gray-50 z-[50]"></th>
            </tr>
            {showSummary && totals && (
                <tr className="bg-indigo-50/50 border-b border-indigo-100">
                    <th className="sticky top-[52px] left-0 p-3 text-right z-[60] border-r border-indigo-100 bg-indigo-50/50" style={{ width: COL_INDEX_WIDTH }}><Sigma size={14}/></th>
                    <th className="sticky top-[52px] left-[50px] p-3 text-right uppercase z-[60] border-r border-indigo-100 bg-indigo-50/50" style={{ width: COL_CAMPAIGN_WIDTH }}>Tổng:</th>
                    <th className="sticky top-[52px] p-3 border-r border-indigo-100 bg-indigo-50/50 z-[40]"></th>
                    <th className="sticky top-[52px] p-3 text-center font-black text-indigo-800 border-r border-indigo-100 bg-indigo-50/50 z-[40]">{totals.plan}</th>
                    <th className="sticky top-[52px] border-r border-indigo-100 bg-indigo-50/50 z-[40]"></th>
                    <th className="sticky top-[52px] border-r border-indigo-100 bg-indigo-50/50 z-[40]"></th>
                    <th className="sticky top-[52px] p-3 text-right font-black text-amber-800 border-r border-indigo-100 bg-indigo-50/50 z-[40]">{totals.cost.toLocaleString('vi-VN')}</th>
                    {days.map(d => (
                        <th key={d} className={`sticky top-[52px] p-2 text-center border-r border-indigo-100 bg-indigo-50/50 z-[40] ${totals.daysPlan[d] > 0 ? 'text-indigo-800 font-black' : 'text-gray-400 font-normal'}`}>
                            {totals.daysPlan[d] > 0 ? totals.daysPlan[d] : ''}
                        </th>
                    ))}
                    <th className="sticky top-[52px] bg-indigo-50/50 z-[40]"></th>
                </tr>
            )}
        </thead>
    );
});
