import React, { useState } from 'react';
import { Layers, Plus, CheckCircle2, ChevronRight, Sliders } from 'lucide-react';

export const BuyerWorkflowsScoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates'>('workflows');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Workflows & scoring templates
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Standardize evaluation stages, multi-evaluator scoring matrices, and statutory approval gates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Template 1: QCBS 80/20 */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#1F5F99] bg-[#EAF2FA] px-2 py-0.5 rounded-[4px]">
              Standard Works Template
            </span>
            <span className="text-[12px] text-[#6B7A87]">Active template</span>
          </div>

          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Quality & Cost-Based Selection (80% Tech / 20% Fin)
          </h3>

          <div className="space-y-2 text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
            <div className="flex justify-between py-1 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span>Technical Capacity & Experience</span>
              <strong className="text-[#10212E] dark:text-white">35%</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span>Key Personnel & Team Qualifications</span>
              <strong className="text-[#10212E] dark:text-white">25%</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span>Methodology & Work Plan</span>
              <strong className="text-[#10212E] dark:text-white">20%</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span>Price Proposal (Unsealed Post-Tech)</span>
              <strong className="text-[#10212E] dark:text-white">20%</strong>
            </div>
          </div>
        </div>

        {/* Template 2: Least Cost */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#2F8F5B] bg-[#ECFDF5] px-2 py-0.5 rounded-[4px]">
              Commodities & Supplies
            </span>
            <span className="text-[12px] text-[#6B7A87]">Active template</span>
          </div>

          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Compliant Least-Cost Selection (Pass/Fail + Price)
          </h3>

          <div className="space-y-2 text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
            <div className="flex justify-between py-1 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span>Statutory Document Verification</span>
              <strong className="text-[#10212E] dark:text-white">Mandatory (Pass/Fail)</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span>Technical Specification Compliance</span>
              <strong className="text-[#10212E] dark:text-white">Mandatory (Pass/Fail)</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span>Evaluated Financial Proposal</span>
              <strong className="text-[#10212E] dark:text-white">100% Ranking</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
