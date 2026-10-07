import React, { useState } from 'react';
import { ADMIN_NOTIFICATIONS, NotificationDelivery } from '../../mockAdminData';
import { RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const AdminNotifications: React.FC = () => {
  const [logs, setLogs] = useState<NotificationDelivery[]>(ADMIN_NOTIFICATIONS);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = (id: string) => {
    setRetryingId(id);
    setTimeout(() => {
      setLogs((prev) =>
        prev.map((log) =>
          log.id === id ? { ...log, status: 'Delivered' as const, retryCount: log.retryCount + 1 } : log
        )
      );
      setRetryingId(null);
    }, 700);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Notification delivery log
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Monitor multi-channel communication dispatch across SMS, WhatsApp Business, and transactional email.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
              <tr>
                <th className="p-4">Channel</th>
                <th className="p-4">Recipient</th>
                <th className="p-4">Subject / Message preview</th>
                <th className="p-4">Sent at</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                  <td className="p-4">
                    <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                      {log.channel}
                    </span>
                  </td>
                  <td className="p-4 font-sans text-[#43525F] dark:text-[#B2C3D2]">{log.recipient}</td>
                  <td className="p-4 text-[#10212E] dark:text-white max-w-sm truncate">{log.subjectOrPreview}</td>
                  <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] text-[13px]">{log.sentAt}</td>
                  <td className="p-4">
                    <span
                      className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                        log.status === 'Delivered'
                          ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                          : log.status === 'Failed'
                          ? 'bg-[#FEF2F2] text-[#C2412D]'
                          : 'bg-[#FFFBEB] text-[#92400E]'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {log.status === 'Failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetry(log.id)}
                        disabled={retryingId === log.id}
                        className="px-3 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px] inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                        <span>Retry</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
