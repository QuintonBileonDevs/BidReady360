import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { AdminSupportModal } from './AdminSupportModal';

interface AdminSupportProps {
  onStartSupportSession: (entityName: string, reason: string) => void;
}

export const AdminSupport: React.FC<AdminSupportProps> = ({ onStartSupportSession }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetEntity, setTargetEntity] = useState('Gaborone Regional Council');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Support & privacy governance
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Enforce statutory data isolation, tenant privacy boundaries, and logged administrative support sessions.
          </p>
        </div>
      </div>

      {/* Privacy Rules Card */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
        <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
          Data isolation and support privacy rules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[14px]">
          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-2">
            <span className="font-semibold text-[#10212E] dark:text-white block">
              1. Account metadata only
            </span>
            <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              Standard admin views display account status, verification pins, and billing logs only. Confidential bidder documents remain encrypted.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-2">
            <span className="font-semibold text-[#10212E] dark:text-white block">
              2. Mandatory audit reasoning
            </span>
            <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              Viewing as an organization or inspecting document anomalies requires a formal ticket ID and written reason before temporary read-only access.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-2">
            <span className="font-semibold text-[#10212E] dark:text-white block">
              3. Permanent banner & log
            </span>
            <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              Every authorized session is marked with a prominent top banner and committed directly to the statutory civic audit log.
            </p>
          </div>
        </div>
      </div>

      {/* Direct Launch Diagnostic Card */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
        <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
          Start logged support session
        </h2>

        <div className="flex flex-col sm:flex-row items-end gap-3 max-w-xl">
          <div className="flex-1 space-y-1 w-full text-[14px]">
            <label className="font-medium text-[#10212E] dark:text-white block">
              Target organization or supplier
            </label>
            <select
              value={targetEntity}
              onChange={(e) => setTargetEntity(e.target.value)}
              className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
            >
              <option value="Gaborone Regional Council">Gaborone Regional Council (Buyer)</option>
              <option value="Botswana Power Corporation">Botswana Power Corporation (Buyer)</option>
              <option value="Debswana Diamond Company">Debswana Diamond Company (Buyer)</option>
              <option value="Kopano Building Supplies (Pty) Ltd">Kopano Building Supplies (Supplier)</option>
              <option value="Tsodilo Civil Engineering (Pty) Ltd">Tsodilo Civil Engineering (Supplier)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] flex items-center justify-center gap-2 shrink-0"
          >
            <Lock className="w-4 h-4" />
            <span>Request session access</span>
          </button>
        </div>
      </div>

      <AdminSupportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetEntityName={targetEntity}
        targetType={targetEntity.includes('Supplies') || targetEntity.includes('Engineering') ? 'Supplier' : 'Organization'}
        onGrantAccess={(reason) => onStartSupportSession(targetEntity, reason)}
      />
    </div>
  );
};
