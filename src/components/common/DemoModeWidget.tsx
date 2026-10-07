import React, { useState } from 'react';
import { useApp, UserRole, BuyerSubRole } from '../../context/AppContext';
import { ChevronUp, ChevronDown, Sparkles, Building2, Briefcase, Globe, Shield, UserCheck } from 'lucide-react';

export const DemoModeWidget: React.FC = () => {
  const { role, setRole, buyerSubRole, setBuyerSubRole, activeNav, setActiveNav } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  const getRoleLabel = () => {
    switch (role) {
      case 'supplier':
        return 'Supplier';
      case 'buyer':
        return `Buyer (${buyerSubRole})`;
      case 'admin':
        return 'Admin';
      default:
        return 'Public';
    }
  };

  const buyerSubRoles: BuyerSubRole[] = [
    'Org admin',
    'Procurement officer',
    'Evaluator',
    'Approver',
    'Auditor',
  ];

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Collapsible Panel */}
      {isOpen && (
        <div className="mb-2 w-72 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-4 text-[#10212E] dark:text-white animate-fade-in text-[13px] shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <span className="font-semibold text-[13px]">Switch demo persona</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#6B7A87] hover:text-[#10212E] text-[13px] px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setRole('public');
                setActiveNav('about');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-[6px] transition-colors flex items-center justify-between cursor-pointer ${
                role === 'public'
                  ? 'bg-[#EAF2FA] text-[#1F5F99] font-semibold'
                  : 'hover:bg-[#F7FAFD] text-[#43525F] dark:text-[#B2C3D2]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#1F5F99]" />
                <span>Public website</span>
              </div>
              {role === 'public' && <span className="text-[11px] font-bold">Active</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('supplier');
                setActiveNav('dashboard');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-[6px] transition-colors flex items-center justify-between cursor-pointer ${
                role === 'supplier'
                  ? 'bg-[#EAF2FA] text-[#1F5F99] font-semibold'
                  : 'hover:bg-[#F7FAFD] text-[#43525F] dark:text-[#B2C3D2]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1F5F99]" />
                <span>Supplier portal</span>
              </div>
              {role === 'supplier' && <span className="text-[11px] font-bold">Active</span>}
            </button>

            {/* Quick Link for RFP Bid Submission Demo */}
            {role === 'supplier' && (
              <div className="pl-6 pt-1 pb-1 space-y-1 border-l-2 border-[#1F5F99]/30 ml-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('bids');
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded-[4px] text-[12px] flex items-center justify-between cursor-pointer ${
                    activeNav === 'bids'
                      ? 'bg-[#1F5F99] text-white font-medium'
                      : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD]'
                  }`}
                >
                  <span>RFP sealed bid submission</span>
                  {activeNav === 'bids' && <span>✓</span>}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setRole('buyer');
                setActiveNav('dashboard');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-[6px] transition-colors flex items-center justify-between cursor-pointer ${
                role === 'buyer'
                  ? 'bg-[#EAF2FA] text-[#1F5F99] font-semibold'
                  : 'hover:bg-[#F7FAFD] text-[#43525F] dark:text-[#B2C3D2]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#1F5F99]" />
                <span>Buyer console</span>
              </div>
              {role === 'buyer' && <span className="text-[11px] font-bold">Active</span>}
            </button>

            {/* Buyer Sub-role Picker when Buyer is active or expanded */}
            {role === 'buyer' && (
              <div className="pl-6 pt-1 pb-1 space-y-1 border-l-2 border-[#1F5F99]/30 ml-3">
                <span className="text-[11px] text-[#6B7A87] font-semibold uppercase tracking-wider block pb-1">
                  Buyer role perspective:
                </span>
                {buyerSubRoles.map((sRole) => (
                  <button
                    key={sRole}
                    type="button"
                    onClick={() => {
                      setBuyerSubRole(sRole);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1 rounded-[4px] text-[12px] flex items-center justify-between cursor-pointer ${
                      buyerSubRole === sRole
                        ? 'bg-[#1F5F99] text-white font-medium'
                        : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD]'
                    }`}
                  >
                    <span>{sRole}</span>
                    {buyerSubRole === sRole && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setRole('admin');
                setActiveNav('admin-dashboard');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-[6px] transition-colors flex items-center justify-between cursor-pointer ${
                role === 'admin'
                  ? 'bg-[#EAF2FA] text-[#1F5F99] font-semibold'
                  : 'hover:bg-[#F7FAFD] text-[#43525F] dark:text-[#B2C3D2]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#1F5F99]" />
                <span>Platform admin</span>
              </div>
              {role === 'admin' && <span className="text-[11px] font-bold">Active</span>}
            </button>
          </div>
        </div>
      )}

      {/* Floating Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] text-[13px] font-medium hover:bg-[#F7FAFD] transition-all cursor-pointer shadow-sm"
        aria-label="Toggle demo persona switcher"
      >
        <span className="w-2 h-2 rounded-full bg-[#E8A33D]" />
        <span>Demo: {getRoleLabel()}</span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#6B7A87]" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-[#6B7A87]" />
        )}
      </button>
    </div>
  );
};
