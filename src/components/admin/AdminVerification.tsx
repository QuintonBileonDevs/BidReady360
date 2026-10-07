import React, { useState } from 'react';
import { ADMIN_VERIFICATION_QUEUE, VerificationQueueItem } from '../../mockAdminData';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const AdminVerification: React.FC = () => {
  const [items, setItems] = useState<VerificationQueueItem[]>(ADMIN_VERIFICATION_QUEUE);
  const [selectedItem, setSelectedItem] = useState<VerificationQueueItem | null>(items[0]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const filteredItems = items.filter(
    (item) => filterType === 'ALL' || item.checkType === filterType
  );

  const handleVerify = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'Verified' as const } : i))
    );
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, status: 'Verified' } : null));
    }
  };

  const handleRejectSubmit = () => {
    if (!selectedItem) return;
    setItems((prev) =>
      prev.map((i) => (i.id === selectedItem.id ? { ...i, status: 'Rejected' as const } : i))
    );
    setSelectedItem((prev) => (prev ? { ...prev, status: 'Rejected' } : null));
    setIsRejectModalOpen(false);
    setRejectReason('');
  };

  const handleCannotVerify = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'Cannot verify' as const } : i))
    );
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, status: 'Cannot verify' } : null));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Verification queue
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Process statutory document checks, tax clearance pins, and identity verification OCR queues.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'Tax clearance', 'CIPA certificate', 'Workers comp', 'Bank confirmation', 'Identity check (Omang)'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors ${
              filterType === type
                ? 'bg-[#1F5F99] text-white'
                : 'bg-white dark:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD]'
            }`}
          >
            {type === 'ALL' ? 'All checks' : type}
          </button>
        ))}
      </div>

      {/* Side-by-Side Queue & Inspection Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Queue List (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] divide-y divide-[#D5E0EA] dark:divide-[#1E364A] overflow-hidden">
          <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] font-semibold text-[14px] text-[#10212E] dark:text-white">
            Queue items ({filteredItems.length})
          </div>

          {filteredItems.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-4 transition-colors cursor-pointer space-y-1 ${
                  isSelected
                    ? 'bg-[#EAF2FA] dark:bg-[#162C3E] border-l-4 border-l-[#1F5F99]'
                    : 'hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                    {item.checkType}
                  </span>
                  <span
                    className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                      item.status === 'Verified'
                        ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                        : item.status === 'Rejected'
                        ? 'bg-[#FEF2F2] text-[#C2412D]'
                        : 'bg-[#FFFBEB] text-[#92400E]'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                  {item.supplierName}
                </div>
                <div className="text-[12px] text-[#6B7A87]">
                  Submitted {item.submittedDate} · {item.waitingTime}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Inspection Panel (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
          {selectedItem ? (
            <>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <div className="space-y-1">
                  <span className="text-[12px] text-[#6B7A87]">Verification check inspection</span>
                  <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    {selectedItem.checkType}: {selectedItem.supplierName}
                  </h3>
                </div>
                <span className="text-[13px] text-[#2F8F5B] font-medium bg-[#ECFDF5] px-2.5 py-1 rounded-[6px]">
                  OCR confidence: {selectedItem.confidenceScore}%
                </span>
              </div>

              {/* Extracted Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] text-[14px]">
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Document reference / PIN</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{selectedItem.docNumber}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Recorded expiry date</span>
                  <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">{selectedItem.expiryDate}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Supplier CIPA</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{selectedItem.supplierCipa}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Queue submission</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{selectedItem.submittedDate}</span>
                </div>
              </div>

              {/* Simulated Document Preview Window */}
              <div className="p-8 border border-dashed border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] text-center space-y-2">
                <FileCheck2 className="w-8 h-8 text-[#1F5F99] mx-auto" />
                <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                  {selectedItem.checkType} — Official Electronic Filing Preview
                </span>
                <p className="text-[13px] text-[#6B7A87] max-w-sm mx-auto">
                  Cross-referenced with statutory authority gateway. Extracted metadata matches registered company filing.
                </p>
              </div>

              {/* Verification Decision Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                <button
                  type="button"
                  onClick={() => handleVerify(selectedItem.id)}
                  className="flex-1 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & mark verified</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(true)}
                  className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-medium rounded-[6px] text-[14px]"
                >
                  Reject...
                </button>

                <button
                  type="button"
                  onClick={() => handleCannotVerify(selectedItem.id)}
                  className="py-2.5 px-4 border border-[#D5E0EA] hover:bg-[#F7FAFD] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px]"
                >
                  Cannot verify
                </button>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-[#6B7A87]">
              Select an item from the queue to inspect and verify.
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
            <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Reject verification: {selectedItem.checkType}
            </h3>
            <p className="text-[13px] text-[#6B7A87]">
              Provide a clear reason for the supplier explaining why this document could not be accepted.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Document image is blurry, or Tax Clearance PIN does not match BURS records."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 text-[14px] text-[#43525F]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                className="px-4 py-2 bg-[#C2412D] text-white rounded-[6px] text-[14px] font-medium"
              >
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
