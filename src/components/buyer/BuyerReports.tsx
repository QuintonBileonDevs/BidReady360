import React from 'react';
import { Download, TrendingUp, DollarSign, Clock, Users, FileCheck2 } from 'lucide-react';
import { BuyerSpendByCategoryChart, BuyerCallsByStageChart } from './BuyerCharts';

export const BuyerReports: React.FC = () => {
  const handleExport = () => {
    const csvContent = 'Category,Spend_BWP,Tenders_Awarded,Avg_Turnaround_Days\nWorks & Infrastructure,6800000,3,14\nFacility Supplies,3200000,4,8\nElectrical & Power,2400000,2,11\nICT Services,1200000,1,6\nConsulting,800000,2,5\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GRC-Procurement-Report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Procurement analytics & reports
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Comprehensive reporting on cycle turnaround times, citizen economic empowerment compliance, and fiscal expenditure.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[14px] font-medium transition-colors inline-flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export statutory CSV</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-1">
          <span className="text-[13px] text-[#6B7A87]">Avg turnaround time</span>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            6.2 days
          </div>
          <span className="text-[12px] text-[#2F8F5B]">3.8 days faster than statutory threshold</span>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-1">
          <span className="text-[13px] text-[#6B7A87]">Citizen-owned participation</span>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            94.6%
          </div>
          <span className="text-[12px] text-[#2F8F5B]">Exceeds statutory 80% guideline</span>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-1">
          <span className="text-[13px] text-[#6B7A87]">Total fiscal awards</span>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            BWP 14.4M
          </div>
          <span className="text-[12px] text-[#6B7A87]">Across 8 completed contracts</span>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-1">
          <span className="text-[13px] text-[#6B7A87]">Supplier reuse rate</span>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            78%
          </div>
          <span className="text-[12px] text-[#2F8F5B]">Pre-qualified vault reusability</span>
        </div>
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Procurement workflow distribution
          </h3>
          <BuyerCallsByStageChart />
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Category expenditure distribution
          </h3>
          <BuyerSpendByCategoryChart />
        </div>
      </div>
    </div>
  );
};
