import React, { useState } from 'react';

export const BuyerCallsByStageChart: React.FC = () => {
  const stages = [
    { label: 'Draft calls', count: 2, color: '#94A3B8' },
    { label: 'Open & accepting bids', count: 4, color: '#1F5F99' },
    { label: 'Closing soon (within 3 days)', count: 1, color: '#E8A33D' },
    { label: 'Closed & awaiting opening', count: 1, color: '#C2412D' },
    { label: 'In technical evaluation', count: 3, color: '#6FAEE0' },
    { label: 'Awarded & published', count: 8, color: '#2F8F5B' },
  ];

  const maxCount = 10;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          Procurement pipeline breakdown
        </span>
        <span className="text-[13px] text-[#6B7A87]">19 total calls this fiscal year</span>
      </div>

      <div className="space-y-2.5 pt-1">
        {stages.map((st, idx) => {
          const widthPercent = (st.count / maxCount) * 100;
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

export const BuyerSpendByCategoryChart: React.FC = () => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const categories = [
    { label: 'Works & Infrastructure', spendM: 6.8, color: '#1F5F99' },
    { label: 'Facility Supplies', spendM: 3.2, color: '#6FAEE0' },
    { label: 'Electrical & Power', spendM: 2.4, color: '#2F8F5B' },
    { label: 'ICT & Telecomms', spendM: 1.2, color: '#E8A33D' },
    { label: 'Consulting & Legal', spendM: 0.8, color: '#43525F' },
  ];

  const maxSpend = 8.0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          Cumulative spend by category (BWP Millions)
        </span>
        <span className="text-[13px] text-[#2F8F5B] font-semibold tabular-nums">Total: BWP 14.4M</span>
      </div>

      <div className="h-[210px] flex items-end justify-between gap-4 pt-6 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2">
        {categories.map((cat, idx) => {
          const barHeight = (cat.spendM / maxSpend) * 150;
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
    </div>
  );
};
