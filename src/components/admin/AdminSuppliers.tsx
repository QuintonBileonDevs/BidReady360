import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Filter, ShieldCheck, AlertCircle, Building2, Lock, Eye } from 'lucide-react';
import { AdminSupportModal } from './AdminSupportModal';

interface AdminSuppliersProps {
  onStartSupportSession: (entityName: string, reason: string) => void;
}

export const AdminSuppliers: React.FC<AdminSuppliersProps> = ({
  onStartSupportSession,
}) => {
  const { allSuppliers } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<typeof allSuppliers[0] | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportTargetSupplier, setSupportTargetSupplier] = useState('');

  const filteredSuppliers = allSuppliers.filter(
    (s) =>
      s.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cipaNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenSupport = (supplierName: string) => {
    setSupportTargetSupplier(supplierName);
    setIsSupportModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Registered suppliers
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Monitor statutory compliance standing, document health, and company profiles across Botswana.
          </p>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
          Showing <strong>{filteredSuppliers.length}</strong> registered supplier profiles
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by legal name, CIPA, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white text-[14px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
              <tr>
                <th className="p-4">Company legal name</th>
                <th className="p-4">CIPA number</th>
                <th className="p-4">Category</th>
                <th className="p-4">Verification</th>
                <th className="p-4">Document health</th>
                <th className="p-4">Citizen owned</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
              {filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                  <td className="p-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedSupplier(sup)}
                      className="hover:text-[#1F5F99] text-left cursor-pointer"
                    >
                      {sup.legalName}
                    </button>
                  </td>
                  <td className="p-4 font-sans text-[#43525F] dark:text-[#B2C3D2]">{sup.cipaNumber}</td>
                  <td className="p-4 text-[#43525F] dark:text-[#B2C3D2]">{sup.category}</td>
                  <td className="p-4">
                    <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                      Verified
                    </span>
                  </td>
                  <td className="p-4">
                    {sup.id === 'supp-1' ? (
                      <span className="bg-[#FEF2F2] text-[#C2412D] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                        1 Expired
                      </span>
                    ) : (
                      <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                        All active
                      </span>
                    )}
                  </td>
                  <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2]">
                    {sup.citizenOwnedPercentage}%
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedSupplier(sup)}
                      className="px-3 py-1 border border-[#D5E0EA] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white text-[13px] font-medium rounded-[4px]"
                    >
                      View metadata
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Metadata Drawer (Privacy Safe: No raw confidential bid files) */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#10212E]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-[#132635] h-full shadow-lg p-6 overflow-y-auto space-y-6 text-[14px]">
            <div className="flex items-center justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div className="space-y-1">
                <span className="text-[12px] text-[#6B7A87]">Supplier metadata</span>
                <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  {selectedSupplier.legalName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="text-[#6B7A87] hover:text-[#10212E] text-[18px] p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">CIPA UIN:</span>
                  <span className="font-medium text-[#10212E] dark:text-white">{selectedSupplier.cipaNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">BURS TIN:</span>
                  <span className="font-medium text-[#10212E] dark:text-white">{selectedSupplier.tinNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Location:</span>
                  <span className="font-medium text-[#10212E] dark:text-white">{selectedSupplier.city}, {selectedSupplier.district}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Citizen ownership:</span>
                  <span className="font-medium text-[#10212E] dark:text-white">{selectedSupplier.citizenOwnedPercentage}%</span>
                </div>
              </div>

              {/* Privacy Notice: Documents are private */}
              <div className="p-4 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">Document vault & bid privacy</span>
                <p className="text-[13px] text-[#6B7A87] leading-relaxed">
                  Supplier proprietary vaults and sealed bid envelopes are encrypted. Direct file inspection requires logged administrative justification.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenSupport(selectedSupplier.legalName)}
                  className="w-full py-2 border border-[#1F5F99] text-[#1F5F99] hover:bg-[#EAF2FA] rounded-[6px] font-medium text-[13px] flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Request diagnostic access (Requires audit reason)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdminSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        targetEntityName={supportTargetSupplier}
        targetType="Supplier"
        onGrantAccess={(reason) => onStartSupportSession(supportTargetSupplier, reason)}
      />
    </div>
  );
};
