import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminNotificationRecord, AdminInAppNotificationRecord } from '../../services/api';
import { RefreshCw, AlertCircle, CheckCircle2, Loader2, Bell, Mail } from 'lucide-react';

function formatCatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const formatted = d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Gaborone',
  });
  return `${formatted} CAT`;
}

export const AdminNotifications: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'in_app' | 'deliveries'>('in_app');
  const [inAppLogs, setInAppLogs] = useState<AdminInAppNotificationRecord[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<AdminNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [inAppData, deliveryData] = await Promise.all([
        adminApi.listInAppNotifications(),
        adminApi.listNotifications(),
      ]);
      setInAppLogs(Array.isArray(inAppData) ? inAppData : []);
      setDeliveryLogs(Array.isArray(deliveryData) ? deliveryData : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setError(null);
    try {
      const updated = await adminApi.retryNotification(id);
      setDeliveryLogs((prev) => prev.map((log) => (log.id === id ? { ...log, ...updated } : log)));
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
            Notifications monitor
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Inspect live in-app procurement alerts and external delivery records persisted in PostgreSQL.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadNotifications()}
          disabled={isLoading}
          className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] hover:bg-[#F7FAFD] rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <button
          type="button"
          onClick={() => setActiveTab('in_app')}
          className={`px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'in_app'
              ? 'border-[#1F5F99] text-[#1F5F99] dark:text-[#6FAEE0]'
              : 'border-transparent text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>In-app notifications ({inAppLogs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('deliveries')}
          className={`px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'deliveries'
              ? 'border-[#1F5F99] text-[#1F5F99] dark:text-[#6FAEE0]'
              : 'border-transparent text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>External delivery log ({deliveryLogs.length})</span>
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
            <span>Loading notifications...</span>
          </div>
        ) : activeTab === 'in_app' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Workspace</th>
                  <th className="p-4">Notification</th>
                  <th className="p-4">Created (CAT)</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {inAppLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[#6B7A87]">
                      No in-app notifications recorded yet.
                    </td>
                  </tr>
                ) : (
                  inAppLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                      <td className="p-4">
                        <div className="font-medium text-[#10212E] dark:text-white">{item.recipientName}</div>
                        {item.recipientEmail && (
                          <div className="text-[12px] text-[#6B7A87]">{item.recipientEmail}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-[#10212E] dark:text-white">{item.workspaceName}</div>
                        <div className="text-[12px] text-[#6B7A87]">{item.workspaceType}</div>
                      </td>
                      <td className="p-4 max-w-md">
                        <div className="font-medium text-[#10212E] dark:text-white">{item.title}</div>
                        {item.body && (
                          <div className="text-[12px] text-[#43525F] dark:text-[#B2C3D2] line-clamp-2 mt-0.5">
                            {item.body}
                          </div>
                        )}
                        <div className="text-[11px] text-[#6B7A87] mt-1 font-mono">{item.eventType}</div>
                      </td>
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] text-[13px] whitespace-nowrap">
                        {formatCatDateTime(item.createdAt)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                            item.isRead
                              ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                              : 'bg-[#EAF2FA] text-[#1F5F99]'
                          }`}
                        >
                          {item.isRead ? 'Read' : 'Unread'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Channel</th>
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Template / Error</th>
                  <th className="p-4">Dispatched (CAT)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {deliveryLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6B7A87]">
                      No external delivery logs recorded yet. External email sending is currently disabled.
                    </td>
                  </tr>
                ) : (
                  deliveryLogs.map((log) => (
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
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] text-[13px] whitespace-nowrap">
                        {formatCatDateTime(log.sentAt)}
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
                            onClick={() => void handleRetry(log.id)}
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
