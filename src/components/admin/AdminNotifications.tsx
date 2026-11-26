import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminNotificationRecord } from '../../services/api';
import { RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-BW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminNotifications: React.FC = () => {
  const [logs, setLogs] = useState<AdminNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.listNotifications();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load notification delivery logs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setError(null);
    try {
      const updated = await adminApi.retryNotification(id);
      setLogs((prev) => prev.map((log) => (log.id === id ? { ...log, ...updated } : log)));
      setFeedback(`Re-queued delivery to ${updated.recipient} (attempt #${updated.retryCount}).`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to retry notification delivery.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Notification delivery log
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Monitor persisted multi-channel communication dispatches across email, SMS, and WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDeliveries}
          disabled={isLoading}
          className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] hover:bg-[#F7FAFD] rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3.5 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-[#6B7A87] text-[14px]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99]" />
            <span>Loading notification deliveries...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Channel</th>
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Template / Error</th>
                  <th className="p-4">Dispatched at</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6B7A87]">
                      No notification delivery logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                      <td className="p-4">
                        <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium uppercase">
                          {log.channel}
                        </span>
                      </td>
                      <td className="p-4 font-sans text-[#43525F] dark:text-[#B2C3D2]">{log.recipient}</td>
                      <td className="p-4 max-w-sm">
                        <div className="text-[#10212E] dark:text-white truncate">{log.templateCode}</div>
                        {log.errorMessage && (
                          <div className="text-[12px] text-[#C2412D] truncate">{log.errorMessage}</div>
                        )}
                      </td>
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] text-[13px]">
                        {formatDateTime(log.sentAt)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium capitalize ${
                            log.status === 'delivered' || log.status === 'sent'
                              ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                              : log.status === 'failed'
                              ? 'bg-[#FEF2F2] text-[#C2412D]'
                              : 'bg-[#FFFBEB] text-[#92400E]'
                          }`}
                        >
                          {log.status}
                          {log.retryCount > 0 ? ` (${log.retryCount}x)` : ''}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {log.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetry(log.id)}
                            disabled={retryingId === log.id}
                            className="px-3 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                            <span>Retry</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
