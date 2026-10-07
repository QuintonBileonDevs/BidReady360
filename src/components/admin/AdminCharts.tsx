import React, { useState } from 'react';

export const AdminGrowthChart: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const supplierData = [820, 890, 940, 1020, 1110, 1180, 1240, 1310, 1360, 1410, 1450, 1482];
  const orgData = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 16];

  // SVG Coordinates calculation (width: 500, height: 220)
  const maxSuppliers = 1600;
  const getY = (val: number) => 190 - (val / maxSuppliers) * 160;
  const getX = (idx: number) => 45 + (idx / (months.length - 1)) * 430;

  const supplierPoints = supplierData.map((val, i) => `${getX(i)},${getY(val)}`).join(' ');
  const orgPoints = orgData.map((val, i) => `${getX(i)},${190 - (val / 20) * 160}`).join(' ');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          12-month platform adoption trend
        </span>
        <div className="flex items-center gap-4 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#1F5F99]" />
            <span className="text-[#10212E] dark:text-white">Suppliers ({supplierData[supplierData.length - 1]})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#2F8F5B]" />
            <span className="text-[#10212E] dark:text-white">Organizations ({orgData[orgData.length - 1]})</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[220px]">
        <svg viewBox="0 0 500 220" className="w-full h-full overflow-visible">
          {/* Horizontal Grid lines */}
          {[0, 400, 800, 1200, 1600].map((val) => (
            <g key={val}>
              <line
                x1="40"
                y1={getY(val)}
                x2="480"
                y2={getY(val)}
                stroke="#D5E0EA"
                strokeDasharray="3,3"
                className="dark:stroke-[#1E364A]"
              />
              <text
                x="32"
                y={getY(val) + 4}
                textAnchor="end"
                className="fill-[#6B7A87] text-[11px] font-sans"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Supplier Line */}
          <polyline
            fill="none"
            stroke="#1F5F99"
            strokeWidth="2.5"
            points={supplierPoints}
          />

          {/* Org Line (Scale 0 - 20 mapped to height) */}
          <polyline
            fill="none"
            stroke="#2F8F5B"
            strokeWidth="2"
            strokeDasharray="4,2"
            points={orgPoints}
          />

          {/* Interactive Data points */}
          {supplierData.map((val, i) => (
            <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              <circle
                cx={getX(i)}
                cy={getY(val)}
                r={hoveredIndex === i ? 5 : 3}
                fill="#1F5F99"
                className="transition-all"
              />
              <text
                x={getX(i)}
                y="210"
                textAnchor="middle"
                className="fill-[#6B7A87] text-[11px] font-sans"
              >
                {months[i]}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute top-2 bg-[#10212E] text-white p-2 rounded-[6px] text-[13px] shadow-sm pointer-events-none z-10"
            style={{ left: `${(hoveredIndex / (months.length - 1)) * 80 + 10}%` }}
          >
            <div className="font-semibold">{months[hoveredIndex]} 2026</div>
            <div className="text-[#6FAEE0]">Suppliers: {supplierData[hoveredIndex]}</div>
            <div className="text-[#A7F3D0]">Organizations: {orgData[hoveredIndex]}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminRevenueChart: React.FC = () => {
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const revenueData = [
    { month: 'May', subs: 18000, calls: 6500, onboard: 3000, verify: 2500, prem: 2000, total: 32000 },
    { month: 'Jun', subs: 19500, calls: 7000, onboard: 3000, verify: 2800, prem: 2200, total: 34500 },
    { month: 'Jul', subs: 20500, calls: 7200, onboard: 2500, verify: 3100, prem: 2500, total: 35800 },
    { month: 'Aug', subs: 21000, calls: 7800, onboard: 3500, verify: 3200, prem: 2600, total: 38100 },
    { month: 'Sep', subs: 21500, calls: 8000, onboard: 2000, verify: 3500, prem: 2800, total: 37800 },
    { month: 'Oct', subs: 22000, calls: 8200, onboard: 2000, verify: 3300, prem: 3000, total: 38500 },
  ];

  const maxTotal = 45000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          Past 6 months revenue breakdown (BWP)
        </span>
        <div className="flex items-center gap-3 text-[12px] flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px] bg-[#1F5F99]" /> Subs</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px] bg-[#6FAEE0]" /> Per-call</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px] bg-[#2F8F5B]" /> Onboard</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px] bg-[#E8A33D]" /> Verify</span>
        </div>
      </div>

      <div className="h-[220px] flex items-end justify-between gap-4 pt-4 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2">
        {revenueData.map((d, i) => {
          const barHeight = (d.total / maxTotal) * 160;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <span className="text-[11px] text-[#6B7A87] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                {(d.total / 1000).toFixed(1)}k
              </span>
              <div
                className="w-full max-w-[42px] bg-[#EAF2FA] dark:bg-[#162C3E] rounded-t-[4px] overflow-hidden flex flex-col-reverse transition-all"
                style={{ height: `${barHeight}px` }}
              >
                <div style={{ height: `${(d.subs / d.total) * 100}%` }} className="bg-[#1F5F99] w-full" title={`Subscriptions: BWP ${d.subs}`} />
                <div style={{ height: `${(d.calls / d.total) * 100}%` }} className="bg-[#6FAEE0] w-full" title={`Pay-per-call: BWP ${d.calls}`} />
                <div style={{ height: `${(d.onboard / d.total) * 100}%` }} className="bg-[#2F8F5B] w-full" title={`Onboarding: BWP ${d.onboard}`} />
                <div style={{ height: `${(d.verify / d.total) * 100}%` }} className="bg-[#E8A33D] w-full" title={`Verification: BWP ${d.verify}`} />
                <div style={{ height: `${(d.prem / d.total) * 100}%` }} className="bg-[#43525F] w-full" title={`Supplier premium: BWP ${d.prem}`} />
              </div>
              <span className="text-[13px] font-medium text-[#10212E] dark:text-white">
                {d.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
