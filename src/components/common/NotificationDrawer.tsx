import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { NotificationItem } from '../../types';
import { Bell, X, AlertTriangle, CheckCircle2, Info, ArrowRight } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (link: string, item: NotificationItem) => void;
}

function formatCatTimestamp(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (!Number.isNaN(d.getTime())) {
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
  return ts;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, onNavigate }) => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
    setActiveNav,
    setSelectedCallId,
    role,
  } = useApp();

  useEffect(() => {
    if (isOpen) {
      void refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  if (!isOpen) return null;

  const relevantNotifications = notifications.filter(
    (n) =>
      (role === 'supplier' && n.recipientRole === 'Supplier') ||
      (role === 'buyer' && n.recipientRole === 'Buyer') ||
      role === 'public'
  );

  const unreadCount = relevantNotifications.filter((n) => !n.read).length;

  const handleOpenNotification = (item: NotificationItem) => {
    if (!item.read) {
      void markNotificationRead(item.id);
    }

    const link = (item.actionLink || '').trim();
    if (!link) return;

    if (onNavigate) {
      onNavigate(link, item);
      onClose();
      return;
    }

    if (link.startsWith('call:')) {
      const callId = link.slice('call:'.length).trim();
      if (callId) {
        setSelectedCallId(callId);
        setActiveNav('opportunities');
      }
    } else if (link.startsWith('call-')) {
      setSelectedCallId(link);
      setActiveNav('opportunities');
    } else if (link === 'vault') {
      setActiveNav('vault');
    } else if (link === 'profile') {
      setActiveNav('profile');
    } else if (link === 'dashboard' || link === 'overview') {
      setActiveNav(role === 'buyer' ? 'buyer-dashboard' : 'dashboard');
    } else if (link === 'applications' || link === 'my-applications') {
      setActiveNav('my-applications');
    } else if (link === 'consent' || link === 'sharing') {
      setActiveNav('consent');
    } else if (link === 'rfp-management' || link === 'calls') {
      setActiveNav('rfp-management');
    } else if (link === 'review-queue') {
      setActiveNav('review-queue');
    } else if (link === 'bids-opening') {
      setActiveNav('bids-opening');
    } else if (link === 'clarifications') {
      setActiveNav('clarifications');
    } else if (link === 'awards') {
      setActiveNav('awards');
    } else if (link === 'audit' || link === 'audit-log') {
      setActiveNav('audit-log');
    } else if (link === 'directory' || link === 'opportunities') {
      const linkedCallId = item.data?.callId ? String(item.data.callId) : null;
      if (linkedCallId) {
        setSelectedCallId(linkedCallId);
      }
      setActiveNav('opportunities');
    }

    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className="w-5 h-5 text-[#C2412D] shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-[#E8A33D] shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-[#1F5F99] dark:text-[#6FAEE0] shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Notifications">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#10212E]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-[#152533] shadow-xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-colors">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#EAF2FA]/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-[#1F5F99] dark:text-[#6FAEE0]" />
              <h2 className="font-heading font-semibold text-[#10212E] dark:text-white text-base">
                Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="text-xs bg-[#1F5F99] text-white px-2 py-0.5 rounded-[4px] font-medium tabular-nums">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllNotificationsRead()}
                  className="text-xs font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline px-2 py-1 rounded hover:bg-[#1F5F99]/10 cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
            {relevantNotifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                No notifications right now.
              </div>
            ) : (
              relevantNotifications.map((notif) => (
                <div
                  key={notif.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenNotification(notif)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenNotification(notif);
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    notif.read
                      ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      : 'bg-white dark:bg-[#192C3D] border-[#1F5F99]/35 dark:border-[#6FAEE0]/40 shadow-xs hover:border-[#1F5F99]/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getIcon(notif.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm text-[#10212E] dark:text-white leading-snug ${notif.read ? 'font-medium' : 'font-semibold'}`}>
                          {notif.title}
                        </h4>
                        {!notif.read && (
                          <span
                            className="w-2 h-2 rounded-full bg-[#1F5F99] dark:bg-[#6FAEE0] shrink-0 mt-1.5"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatCatTimestamp(notif.timestamp)}
                        </span>
                        {notif.actionLink && (
                          <span className="text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] inline-flex items-center gap-1">
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              In-app procurement alerts for your active workspace
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
