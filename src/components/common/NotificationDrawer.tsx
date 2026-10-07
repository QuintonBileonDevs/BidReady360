import React from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, X, AlertTriangle, CheckCircle2, Info, ArrowRight } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead, setActiveNav, setSelectedCallId, role } = useApp();

  if (!isOpen) return null;

  const relevantNotifications = notifications.filter(
    (n) => (role === 'supplier' && n.recipientRole === 'Supplier') || (role === 'buyer' && n.recipientRole === 'Buyer') || role === 'public'
  );

  const unreadCount = relevantNotifications.filter((n) => !n.read).length;

  const handleAction = (item: typeof notifications[0]) => {
    markNotificationRead(item.id);
    if (item.actionLink === 'vault') {
      setActiveNav('vault');
    } else if (item.actionLink === 'applications') {
      setActiveNav('my-applications');
    } else if (item.actionLink === 'rfp-management') {
      setActiveNav('rfp-management');
    } else if (item.actionLink?.startsWith('call-')) {
      setSelectedCallId(item.actionLink);
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
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
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
                <span className="text-xs bg-[#1F5F99] text-white px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {relevantNotifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No notifications right now.
              </div>
            ) : (
              relevantNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all ${
                    notif.read
                      ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      : 'bg-white dark:bg-[#192C3D] border-[#1F5F99]/30 dark:border-[#6FAEE0]/40 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getIcon(notif.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm text-[#10212E] dark:text-white truncate">
                          {notif.title}
                        </h4>
                        <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                          {notif.timestamp.split(' ')[0]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                      {notif.actionLink && (
                        <button
                          onClick={() => handleAction(notif)}
                          className="mt-2 text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline inline-flex items-center gap-1 group"
                        >
                          <span>Take action</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Procurement alerts for Botswana public & private tenders
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
