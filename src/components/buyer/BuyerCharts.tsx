import React, { useState, useMemo } from 'react';
import { Call } from '../../types';

interface BuyerChartsProps {
  calls?: Call[];
  awards?: any[];
}

export const BuyerCallsByStageChart: React.FC<BuyerChartsProps> = ({ calls = [] }) => {
  const stages = useMemo(() => {
    const draftCount = calls.filter((c) => String(c.status).toLowerCase() === 'draft').length;
    const openCount = calls.filter((c) => String(c.status).toLowerCase() === 'open').length;
    const closingSoonCount = calls.filter(
      (c) => String(c.status).toLowerCase() === 'open' && typeof c.daysRemaining === 'number' && c.daysRemaining >= 0 && c.daysRemaining <= 3
    ).length;
    const closedCount = calls.filter((c) => String(c.status).toLowerCase() === 'closed').length;
    const evalCount = calls.filter((c) => String(c.status).toLowerCase() === 'under evaluation').length;
    const awardedCount = calls.filter((c) => String(c.status).toLowerCase() === 'awarded').length;

    return [
      { label: 'Draft calls', count: draftCount, color: '#94A3B8' },
      { label: 'Open & accepting bids', count: openCount, color: '#1F5F99' },
      { label: 'Closing soon (within 3 days)', count: closingSoonCount, color: '#E8A33D' },
      { label: 'Closed & awaiting opening', count: closedCount, color: '#C2412D' },
      { label: 'In technical evaluation', count: evalCount, color: '#6FAEE0' },
      { label: 'Awarded & published', count: awardedCount, color: '#2F8F5B' },
    ];
  }, [calls]);

  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          Procurement pipeline breakdown
        </span>
        <span className="text-[13px] text-[#6B7A87]">{calls.length} total calls</span>
      </div>

      <div className="space-y-2.5 pt-1">
        {stages.map((st, idx) => {
          const widthPercent = st.count === 0 ? 0 : Math.max(6, (st.count / maxCount) * 100);
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#10212E] dark:text-white font-medium">{st.label}</span>
                <span className="font-semibold tabular-nums text-[#10212E] dark:text-white">{st.count}</span>
              </div>
              <div className="h-2 w-full bg-[#EAF2FA] dark:bg-[#162C3E] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${widthPercent}%`, backgroundColor: st.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BuyerSpendByCategoryChart: React.FC<BuyerChartsProps> = ({ calls = [], awards = [] }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { categories, totalMillions } = useMemo(() => {
    const palette = ['#1F5F99', '#6FAEE0', '#2F8F5B', '#E8A33D', '#43525F'];
    const byCat = new Map<string, number>();

    if (awards.length > 0) {
      awards.forEach((a) => {
        const amt = Number(a.awardedAmount || a.awardValue || 0);
        if (amt > 0) {
          const cat = a.category || 'Awarded Contracts';
          byCat.set(cat, (byCat.get(cat) || 0) + amt / 1_000_000);
        }
      });
    } else {
      calls.forEach((c) => {
        const amt = Number(c.estimatedBudgetBWP || 0);
        if (amt > 0) {
          const cat = c.category || 'General Procurement';
          byCat.set(cat, (byCat.get(cat) || 0) + amt / 1_000_000);
        }
      });
    }

    const entries = Array.from(byCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, spendM], idx) => ({
        label,
        spendM: Number(spendM.toFixed(2)),
        color: palette[idx % palette.length],
      }));

    const total = entries.reduce((acc, item) => acc + item.spendM, 0);
    return { categories: entries, totalMillions: Number(total.toFixed(2)) };
  }, [calls, awards]);

  const maxSpend = Math.max(0.1, ...categories.map((c) => c.spendM));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          {awards.length > 0 ? 'Awarded value by category (BWP Millions)' : 'Estimated pipeline budget by category (BWP Millions)'}
        </span>
        <span className="text-[13px] text-[#2F8F5B] font-semibold tabular-nums">
          Total: BWP {totalMillions.toFixed(2)}M
        </span>
      </div>

      {categories.length === 0 ? (
        <div className="h-[210px] flex items-center justify-center text-[13px] text-[#6B7A87] border border-dashed border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
          No budgeted calls or awards recorded yet for this organization.
        </div>
      ) : (
        <div className="h-[210px] flex items-end justify-between gap-4 pt-6 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2">
          {categories.map((cat, idx) => {
            const barHeight = Math.max(12, (cat.spendM / maxSpend) * 150);
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-2 group cursor-pointer relative"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <span className="text-[12px] font-semibold text-[#10212E] dark:text-white tabular-nums">
                  {cat.spendM}M
                </span>
                <div
                  className="w-full max-w-[48px] rounded-t-[4px] transition-all hover:opacity-90"
                  style={{ height: `${barHeight}px`, backgroundColor: cat.color }}
                />
                <span className="text-[12px] text-[#6B7A87] text-center line-clamp-1 max-w-[80px]" title={cat.label}>
                  {cat.label.split(' ')[0]}
                </span>

                {hoveredIdx === idx && (
                  <div className="absolute -top-10 bg-[#10212E] text-white text-[12px] px-2.5 py-1 rounded-[6px] shadow-sm whitespace-nowrap z-20 pointer-events-none">
                    {cat.label}: <strong>BWP {cat.spendM}M</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
