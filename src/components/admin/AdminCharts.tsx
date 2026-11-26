import React, { useState } from 'react';

export interface GrowthPoint {
  month: string;
  suppliers: number;
  organizations: number;
}

export interface RevenuePoint {
  month: string;
  paid: number;
  outstanding: number;
  total: number;
}

export const AdminGrowthChart: React.FC<{ data?: GrowthPoint[] }> = ({ data = [] }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-[13px] text-[#6B7A87]">
        No adoption trend data available yet.
      </div>
    );
  }

  const maxSuppliers = Math.max(10, ...data.map((d) => d.suppliers));
  const maxOrgs = Math.max(5, ...data.map((d) => d.organizations));
  const yTicks = [0, Math.round(maxSuppliers * 0.25), Math.round(maxSuppliers * 0.5), Math.round(maxSuppliers * 0.75), maxSuppliers];

  const getY = (val: number) => 190 - (val / maxSuppliers) * 160;
  const getOrgY = (val: number) => 190 - (val / maxOrgs) * 160;
  const getX = (idx: number) =>
    data.length === 1 ? 260 : 45 + (idx / (data.length - 1)) * 430;

  const supplierPoints = data.map((d, i) => `${getX(i)},${getY(d.suppliers)}`).join(' ');
  const orgPoints = data.map((d, i) => `${getX(i)},${getOrgY(d.organizations)}`).join(' ');

  const latest = data[data.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[14px] flex-wrap gap-2">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          6-month cumulative registrations
        </span>
        <div className="flex items-center gap-4 text-[13px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#1F5F99]" />
            <span className="text-[#10212E] dark:text-white">Suppliers ({latest.suppliers})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#2F8F5B]" />
            <span className="text-[#10212E] dark:text-white">Organizations ({latest.organizations})</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[220px]">
        <svg viewBox="0 0 500 220" className="w-full h-full overflow-visible">
          {yTicks.map((val, idx) => (
            <g key={idx}>
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

          {data.length > 1 && (
            <>
              <polyline fill="none" stroke="#1F5F99" strokeWidth="2.5" points={supplierPoints} />
              <polyline fill="none" stroke="#2F8F5B" strokeWidth="2" strokeDasharray="4,2" points={orgPoints} />
            </>
          )}

          {data.map((d, i) => (
            <g
              key={d.month + i}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <circle
                cx={getX(i)}
                cy={getY(d.suppliers)}
                r={hoveredIndex === i ? 5 : 3.5}
                fill="#1F5F99"
                className="transition-all"
              />
              <circle
                cx={getX(i)}
                cy={getOrgY(d.organizations)}
                r={hoveredIndex === i ? 4.5 : 3}
                fill="#2F8F5B"
                className="transition-all"
              />
              <text
                x={getX(i)}
                y="210"
                textAnchor="middle"
                className="fill-[#6B7A87] text-[11px] font-sans"
              >
                {d.month}
              </text>
            </g>
          ))}
        </svg>

        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute top-2 bg-[#10212E] text-white p-2 rounded-[6px] text-[13px] shadow-sm pointer-events-none z-10"
            style={{
              left: `${Math.min(72, Math.max(6, (hoveredIndex / Math.max(1, data.length - 1)) * 75 + 8))}%`,
            }}
          >
            <div className="font-semibold">{data[hoveredIndex].month}</div>
            <div className="text-[#6FAEE0]">Suppliers: {data[hoveredIndex].suppliers}</div>
            <div className="text-[#A7F3D0]">Organizations: {data[hoveredIndex].organizations}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminRevenueChart: React.FC<{ data?: RevenuePoint[] }> = ({ data = [] }) => {
  if (!data.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-[13px] text-[#6B7A87]">
        No billing invoice records yet.
      </div>
    );
  }

  const maxTotal = Math.max(1000, ...data.map((d) => d.total));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[14px] flex-wrap gap-2">
        <span className="font-medium text-[#43525F] dark:text-[#B2C3D2]">
          Past 6 months invoiced revenue (BWP)
        </span>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#2F8F5B]" /> Paid
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#E8A33D]" /> Outstanding
          </span>
        </div>
      </div>

      <div className="h-[220px] flex items-end justify-between gap-4 pt-4 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2">
        {data.map((d, i) => {
          const barHeight = d.total > 0 ? Math.max(8, (d.total / maxTotal) * 160) : 4;
          const paidPct = d.total > 0 ? (d.paid / d.total) * 100 : 0;
          const outPct = d.total > 0 ? (d.outstanding / d.total) * 100 : 0;
          return (
            <div key={d.month + i} className="flex-1 flex flex-col items-center gap-2 group">
              <span className="text-[11px] text-[#6B7A87] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                BWP {d.total.toLocaleString()}
              </span>
              <div
                className="w-full max-w-[42px] bg-[#EAF2FA] dark:bg-[#162C3E] rounded-t-[4px] overflow-hidden flex flex-col-reverse transition-all"
                style={{ height: `${barHeight}px` }}
              >
                {paidPct > 0 && (
                  <div
                    style={{ height: `${paidPct}%` }}
                    className="bg-[#2F8F5B] w-full"
                    title={`Paid: BWP ${d.paid.toLocaleString()}`}
                  />
                )}
                {outPct > 0 && (
                  <div
                    style={{ height: `${outPct}%` }}
                    className="bg-[#E8A33D] w-full"
                    title={`Outstanding: BWP ${d.outstanding.toLocaleString()}`}
                  />
                )}
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
