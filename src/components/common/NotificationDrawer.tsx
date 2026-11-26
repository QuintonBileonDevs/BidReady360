import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { NotificationBulkAction, NotificationItem } from '../../types';
import {
  Bell,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  ArrowLeft,
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  Mail,
  MailOpen,
  Search,
  RefreshCw,
  CheckSquare,
  Square,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (link: string, item: NotificationItem) => void;
}

type MailboxFolder = 'inbox' | 'unread' | 'starred' | 'archived';

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

function formatEventLabel(eventType?: string): string {
  if (!eventType) return 'Procurement alert';
  const map: Record<string, string> = {
    organization_approved: 'Organization approved',
    organization_rejected: 'Organization review',
    document_verified: 'Document verified',
    document_rejected: 'Document rejected',
    document_expiring_soon: 'Document expiring soon',
    director_verified: 'Director verified',
    director_rejected: 'Director verification',
    supplier_verified: 'Supplier verified',
    supplier_rejected: 'Supplier review',
    clarification_asked: 'Clarification question',
    clarification_answered: 'Clarification answered',
    addendum_published: 'Tender addendum',
    application_submitted: 'Application submitted',
    application_approved: 'Application approved',
    application_rejected: 'Application update',
    application_info_requested: 'Information requested',
    application_info_responded: 'Information received',
    application_withdrawn: 'Application withdrawn',
    bid_submitted: 'Bid submitted',
    bid_opened: 'Bid opened',
    bid_withdrawn: 'Bid withdrawn',
    award_pending_approval: 'Award approval needed',
    award_decision: 'Award decision',
    award_published: 'Award published',
  };
  if (map[eventType]) return map[eventType];
  const cleaned = eventType.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return 'Procurement alert';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function getDestinationLabel(link?: string): string {
  const normalized = (link || '').trim().toLowerCase();
  if (!normalized) return 'Open related page';
  if (normalized === 'vault') return 'Go to document vault';
  if (normalized === 'profile') return 'Open company profile';
  if (normalized === 'applications' || normalized === 'my-applications') return 'Open applications';
  if (normalized === 'consent' || normalized === 'sharing') return 'Open document sharing';
  if (normalized.startsWith('call:') || normalized.startsWith('call-') || normalized === 'opportunities' || normalized === 'directory') {
    return 'View tender call';
  }
  if (normalized === 'rfp-management' || normalized === 'calls') return 'Open tender calls';
  if (normalized === 'review-queue') return 'Open applications queue';
  if (normalized === 'clarifications') return 'Open clarifications';
  if (normalized === 'bids-opening') return 'Open bids and opening';
  if (normalized === 'awards') return 'Open awards';
  if (normalized === 'audit' || normalized === 'audit-log') return 'Open audit log';
  if (normalized === 'settings' || normalized === 'buyer-settings') return 'Open settings';
  if (normalized === 'dashboard' || normalized === 'overview') return 'Open dashboard';
  return 'Open related page';
}

function extractMetadataRows(data?: Record<string, any> | null): { label: string; value: string }[] {
  if (!data || typeof data !== 'object') return [];
  const rows: { label: string; value: string }[] = [];
  const labelMap: Record<string, string> = {
    documentTitle: 'Document',
    expiryDate: 'Expiry date',
    daysRemaining: 'Days remaining',
    callNumber: 'Tender reference',
    callTitle: 'Tender title',
    organizationName: 'Procuring entity',
    supplierName: 'Supplier',
    status: 'Status',
    reason: 'Notes',
    rejectionReason: 'Reason',
    addendumNumber: 'Addendum number',
    awardedAmountBWP: 'Awarded amount (BWP)',
  };

  for (const [key, label] of Object.entries(labelMap)) {
    const val = data[key];
    if (val === undefined || val === null || val === '') continue;
    if (typeof val === 'object') continue;
    rows.push({
      label,
      value: key === 'awardedAmountBWP' && !Number.isNaN(Number(val))
        ? `P ${Number(val).toLocaleString()}`
        : String(val),
    });
  }
  return rows;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, onNavigate }) => {
  const {
    notifications,
    markNotificationRead,
    markNotificationUnread,
    toggleNotificationStar,
    toggleNotificationArchive,
    deleteNotification,
    bulkUpdateNotifications,
    markAllNotificationsRead,
    refreshNotifications,
    setActiveNav,
    setSelectedCallId,
    role,
  } = useApp();

  const [folder, setFolder] = useState<MailboxFolder>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void refreshNotifications();
    } else {
      setActiveNotificationId(null);
      setSelectedIds([]);
      setSearchQuery('');
      setStatusFeedback(null);
    }
  }, [isOpen, refreshNotifications]);

  useEffect(() => {
    if (!statusFeedback) return;
    const timer = window.setTimeout(() => setStatusFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [statusFeedback]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (activeNotificationId) {
          setActiveNotificationId(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeNotificationId, onClose]);

  const relevantNotifications = useMemo(
    () =>
      notifications.filter(
        (n) =>
          (role === 'supplier' && n.recipientRole === 'Supplier') ||
          (role === 'buyer' && n.recipientRole === 'Buyer') ||
          role === 'public'
      ),
    [notifications, role]
  );

  const counts = useMemo(() => {
    const inbox = relevantNotifications.filter((n) => !n.archived);
    const unread = inbox.filter((n) => !n.read);
    const starred = relevantNotifications.filter((n) => Boolean(n.starred));
    const archived = relevantNotifications.filter((n) => Boolean(n.archived));
    return {
      inbox: inbox.length,
      unread: unread.length,
      starred: starred.length,
      archived: archived.length,
    };
  }, [relevantNotifications]);

  const filteredNotifications = useMemo(() => {
    let base: NotificationItem[];
    switch (folder) {
      case 'unread':
        base = relevantNotifications.filter((n) => !n.archived && !n.read);
        break;
      case 'starred':
        base = relevantNotifications.filter((n) => Boolean(n.starred));
        break;
      case 'archived':
        base = relevantNotifications.filter((n) => Boolean(n.archived));
        break;
      case 'inbox':
      default:
        base = relevantNotifications.filter((n) => !n.archived);
        break;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((n) => {
      const haystack = [
        n.title,
        n.message,
        formatEventLabel(n.eventType),
        n.data?.callNumber,
        n.data?.documentTitle,
        n.data?.organizationName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [relevantNotifications, folder, searchQuery]);

  // Keep selectedIds synced with currently visible items
  const visibleIdSet = useMemo(() => new Set(filteredNotifications.map((n) => n.id)), [filteredNotifications]);
  const activeSelectedIds = useMemo(
    () => selectedIds.filter((id) => visibleIdSet.has(id)),
    [selectedIds, visibleIdSet]
  );

  const activeNotification = useMemo(
    () => relevantNotifications.find((n) => n.id === activeNotificationId) || null,
    [relevantNotifications, activeNotificationId]
  );

  const activeIndex = useMemo(
    () => (activeNotification ? filteredNotifications.findIndex((n) => n.id === activeNotification.id) : -1),
    [activeNotification, filteredNotifications]
  );

  if (!isOpen) return null;

  const allVisibleSelected =
    filteredNotifications.length > 0 && activeSelectedIds.length === filteredNotifications.length;
  const selectedItems = filteredNotifications.filter((n) => activeSelectedIds.includes(n.id));
  const allSelectedStarred = selectedItems.length > 0 && selectedItems.every((n) => Boolean(n.starred));
  const allSelectedRead = selectedItems.length > 0 && selectedItems.every((n) => n.read);

  const navigateToDestination = (item: NotificationItem) => {
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

  const handleOpenReader = (item: NotificationItem) => {
    setActiveNotificationId(item.id);
    if (!item.read) {
      void markNotificationRead(item.id);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
      setStatusFeedback('Inbox refreshed.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  };

  const handleBulkAction = async (action: NotificationBulkAction) => {
    if (!activeSelectedIds.length) return;
    const count = activeSelectedIds.length;
    await bulkUpdateNotifications(activeSelectedIds, action);
    setSelectedIds([]);
    const labels: Record<NotificationBulkAction, string> = {
      read: `Marked ${count} ${count === 1 ? 'notification' : 'notifications'} as read.`,
      unread: `Marked ${count} ${count === 1 ? 'notification' : 'notifications'} as unread.`,
      star: `Starred ${count} ${count === 1 ? 'notification' : 'notifications'}.`,
      unstar: `Removed star from ${count} ${count === 1 ? 'notification' : 'notifications'}.`,
      archive: `Archived ${count} ${count === 1 ? 'notification' : 'notifications'}.`,
      unarchive: `Moved ${count} ${count === 1 ? 'notification' : 'notifications'} to inbox.`,
      delete: `Deleted ${count} ${count === 1 ? 'notification' : 'notifications'}.`,
    };
    setStatusFeedback(labels[action]);
  };

  const handleDeleteFromReader = async (item: NotificationItem) => {
    const nextItem =
      activeIndex >= 0 && activeIndex + 1 < filteredNotifications.length
        ? filteredNotifications[activeIndex + 1]
        : activeIndex > 0
        ? filteredNotifications[activeIndex - 1]
        : null;
    await deleteNotification(item.id);
    setActiveNotificationId(nextItem ? nextItem.id : null);
    setStatusFeedback('Notification deleted.');
  };

  const handleArchiveFromReader = async (item: NotificationItem) => {
    const nextArchived = !item.archived;
    await toggleNotificationArchive(item.id, nextArchived);
    if (nextArchived && folder !== 'archived' && folder !== 'starred') {
      setActiveNotificationId(null);
    }
    setStatusFeedback(nextArchived ? 'Notification archived.' : 'Moved back to inbox.');
  };

  const getIcon = (type: string, sizeClass = 'w-4 h-4') => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className={`${sizeClass} text-[#C2412D] shrink-0`} />;
      case 'warning':
        return <AlertTriangle className={`${sizeClass} text-[#E8A33D] shrink-0`} />;
      case 'success':
        return <CheckCircle2 className={`${sizeClass} text-[#2F8F5B] shrink-0`} />;
      default:
        return <Info className={`${sizeClass} text-[#1F5F99] dark:text-[#6FAEE0] shrink-0`} />;
    }
  };

  const folderTabs: { id: MailboxFolder; label: string; count: number }[] = [
    { id: 'inbox', label: 'Inbox', count: counts.inbox },
    { id: 'unread', label: 'Unread', count: counts.unread },
    { id: 'starred', label: 'Starred', count: counts.starred },
    { id: 'archived', label: 'Archived', count: counts.archived },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Notifications">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#10212E]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-xl bg-white dark:bg-[#10212E] shadow-2xl flex flex-col border-l border-[#D5E0EA] dark:border-[#244157] transition-colors">
          {/* Top Header */}
          <div className="px-5 py-4 border-b border-[#D5E0EA] dark:border-[#244157] flex items-center justify-between gap-3 bg-[#EAF2FA]/60 dark:bg-[#162C3D]">
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell className="w-5 h-5 text-[#1F5F99] dark:text-[#6FAEE0] shrink-0" />
              <h2 className="font-heading font-semibold text-[#10212E] dark:text-white text-base truncate">
                Notifications
              </h2>
              {counts.unread > 0 && (
                <span className="text-xs bg-[#1F5F99] dark:bg-[#6FAEE0] text-white dark:text-[#10212E] px-2 py-0.5 rounded-[4px] font-medium tabular-nums shrink-0">
                  {counts.unread} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleManualRefresh()}
                className="p-1.5 text-[#6B7A87] dark:text-[#9CB4C9] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] rounded-lg hover:bg-white/80 dark:hover:bg-[#1C364B] transition-colors cursor-pointer"
                title="Refresh notifications"
                aria-label="Refresh notifications"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              {counts.unread > 0 && !activeNotification && (
                <button
                  type="button"
                  onClick={async () => {
                    await markAllNotificationsRead();
                    setStatusFeedback('All inbox notifications marked as read.');
                  }}
                  className="text-xs font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline px-2 py-1 rounded hover:bg-[#1F5F99]/10 dark:hover:bg-[#6FAEE0]/15 cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-[#6B7A87] dark:text-[#9CB4C9] hover:text-[#10212E] dark:hover:text-white rounded-lg hover:bg-white/80 dark:hover:bg-[#1C364B] transition-colors cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {statusFeedback && (
            <div className="px-5 py-2 bg-[#EAF2FA] dark:bg-[#1C364B] border-b border-[#C9D9E8] dark:border-[#244157] text-xs font-medium text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-between">
              <span>{statusFeedback}</span>
              <button
                type="button"
                onClick={() => setStatusFeedback(null)}
                className="text-[#6B7A87] dark:text-[#9CB4C9] hover:text-[#10212E] dark:hover:text-white cursor-pointer"
                aria-label="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* View 1: Notification Detail Reader */}
          {activeNotification ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Reader Action Toolbar */}
              <div className="px-4 py-2.5 border-b border-[#D5E0EA] dark:border-[#244157] bg-[#EAF2FA]/35 dark:bg-[#162C3D]/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveNotificationId(null)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#10212E] dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to list</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (activeNotification.read) {
                        await markNotificationUnread(activeNotification.id);
                        setStatusFeedback('Marked as unread.');
                      } else {
                        await markNotificationRead(activeNotification.id);
                        setStatusFeedback('Marked as read.');
                      }
                    }}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={activeNotification.read ? 'Mark as unread' : 'Mark as read'}
                    aria-label={activeNotification.read ? 'Mark as unread' : 'Mark as read'}
                  >
                    {activeNotification.read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const nextStarred = !activeNotification.starred;
                      await toggleNotificationStar(activeNotification.id, nextStarred);
                      setStatusFeedback(nextStarred ? 'Added star.' : 'Removed star.');
                    }}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={activeNotification.starred ? 'Remove star' : 'Star notification'}
                    aria-label={activeNotification.starred ? 'Remove star' : 'Star notification'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        activeNotification.starred
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleArchiveFromReader(activeNotification)}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={activeNotification.archived ? 'Move to inbox' : 'Archive notification'}
                    aria-label={activeNotification.archived ? 'Move to inbox' : 'Archive notification'}
                  >
                    {activeNotification.archived ? (
                      <ArchiveRestore className="w-4 h-4" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDeleteFromReader(activeNotification)}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-[#C2412D] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Delete notification"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {filteredNotifications.length > 1 && activeIndex >= 0 && (
                    <div className="flex items-center gap-0.5 pl-1.5 ml-1 border-l border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={activeIndex <= 0}
                        onClick={() => {
                          const prev = filteredNotifications[activeIndex - 1];
                          if (prev) handleOpenReader(prev);
                        }}
                        className="p-1 rounded text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer dark:text-[#9CB4C9]"
                        title="Newer notification"
                        aria-label="Newer notification"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={activeIndex >= filteredNotifications.length - 1}
                        onClick={() => {
                          const next = filteredNotifications[activeIndex + 1];
                          if (next) handleOpenReader(next);
                        }}
                        className="p-1 rounded text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer dark:text-[#9CB4C9]"
                        title="Older notification"
                        aria-label="Older notification"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Reader Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      {getIcon(activeNotification.type, 'w-3.5 h-3.5')}
                      <span>{formatEventLabel(activeNotification.eventType)}</span>
                    </span>
                    {!activeNotification.read && (
                      <span className="px-2 py-0.5 rounded-[4px] font-medium bg-[#EAF2FA] dark:bg-[#1F5F99]/30 text-[#1F5F99] dark:text-[#6FAEE0]">
                        Unread
                      </span>
                    )}
                    {activeNotification.archived && (
                      <span className="px-2 py-0.5 rounded-[4px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Archived
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-heading font-semibold text-[#10212E] dark:text-white leading-snug">
                    {activeNotification.title}
                  </h3>

                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Received {formatCatTimestamp(activeNotification.timestamp)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#EAF2FA]/45 dark:bg-[#162C3D] border border-[#D5E0EA] dark:border-[#244157] text-sm text-[#10212E] dark:text-[#D3E3F2] leading-relaxed whitespace-pre-line">
                  {activeNotification.message}
                </div>

                {extractMetadataRows(activeNotification.data).length > 0 && (
                  <div className="rounded-xl border border-[#D5E0EA] dark:border-[#244157] overflow-hidden bg-white dark:bg-[#1C364B]">
                    <div className="px-4 py-2 bg-[#EAF2FA]/50 dark:bg-[#162C3D] border-b border-[#D5E0EA] dark:border-[#244157] text-xs font-semibold text-[#43525F] dark:text-[#D3E3F2]">
                      Details
                    </div>
                    <dl className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-xs">
                      {extractMetadataRows(activeNotification.data).map((row) => (
                        <div key={row.label} className="px-4 py-2.5 flex items-start justify-between gap-4">
                          <dt className="text-[#6B7A87] dark:text-[#9CB4C9] shrink-0">{row.label}</dt>
                          <dd className="text-[#10212E] dark:text-white font-medium text-right break-words">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {activeNotification.actionLink && (
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigateToDestination(activeNotification)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F5F99] hover:bg-[#184c7a] text-white dark:bg-[#6FAEE0] dark:hover:bg-[#82BCE8] dark:text-[#10212E] text-sm font-medium transition-colors cursor-pointer"
                    >
                      <span>{getDestinationLabel(activeNotification.actionLink)}</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* View 2: Mailbox List View */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Folder Tabs */}
              <div className="px-4 pt-2.5 border-b border-[#D5E0EA] dark:border-[#244157] flex items-center gap-1 overflow-x-auto bg-white dark:bg-[#10212E]">
                {folderTabs.map((tab) => {
                  const isActive = folder === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setFolder(tab.id);
                        setSelectedIds([]);
                      }}
                      className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'border-[#1F5F99] dark:border-[#6FAEE0] text-[#1F5F99] dark:text-[#6FAEE0] font-semibold'
                          : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-[#10212E] dark:hover:text-white'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-[4px] text-[11px] tabular-nums ${
                          isActive
                            ? 'bg-[#EAF2FA] dark:bg-[#1F5F99]/30 text-[#1F5F99] dark:text-[#6FAEE0]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Selection Toolbar */}
              <div className="px-4 py-2.5 border-b border-[#D5E0EA] dark:border-[#244157] bg-[#EAF2FA]/35 dark:bg-[#162C3D]/70 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    disabled={filteredNotifications.length === 0}
                    className="p-1.5 rounded-md text-[#6B7A87] dark:text-[#9CB4C9] hover:text-[#10212E] dark:hover:text-white hover:bg-[#EAF2FA] dark:hover:bg-[#1C364B] disabled:opacity-40 cursor-pointer shrink-0"
                    title={allVisibleSelected ? 'Deselect all' : 'Select all in this view'}
                    aria-label={allVisibleSelected ? 'Deselect all' : 'Select all in this view'}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-[#6B7A87] dark:text-[#9CB4C9] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search notifications..."
                      aria-label="Search notifications"
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-[#D5E0EA] dark:border-[#244157] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white placeholder:text-[#6B7A87] dark:placeholder:text-[#9CB4C9] focus:outline-none focus:ring-2 focus:ring-[#1F5F99]/30 dark:focus:ring-[#6FAEE0]/30 focus:border-[#1F5F99] dark:focus:border-[#6FAEE0]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7A87] dark:text-[#9CB4C9] hover:text-[#10212E] dark:hover:text-white cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk Actions Row (appears when 1 or more items are selected) */}
                {activeSelectedIds.length > 0 && (
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-[#D5E0EA] dark:border-[#244157]">
                    <span className="text-xs font-medium text-[#10212E] dark:text-[#D3E3F2] tabular-nums">
                      {activeSelectedIds.length} selected
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handleBulkAction(allSelectedRead ? 'unread' : 'read')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#10212E] dark:text-[#D3E3F2] bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] hover:bg-[#EAF2FA] dark:hover:bg-[#244157] cursor-pointer"
                      >
                        {allSelectedRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                        <span>{allSelectedRead ? 'Mark unread' : 'Mark read'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleBulkAction(allSelectedStarred ? 'unstar' : 'star')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#10212E] dark:text-[#D3E3F2] bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] hover:bg-[#EAF2FA] dark:hover:bg-[#244157] cursor-pointer"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${allSelectedStarred ? 'fill-amber-400 text-amber-500' : ''}`}
                        />
                        <span>{allSelectedStarred ? 'Unstar' : 'Star'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleBulkAction(folder === 'archived' ? 'unarchive' : 'archive')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#10212E] dark:text-[#D3E3F2] bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] hover:bg-[#EAF2FA] dark:hover:bg-[#244157] cursor-pointer"
                      >
                        {folder === 'archived' ? (
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                        <span>{folder === 'archived' ? 'Move to inbox' : 'Archive'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleBulkAction('delete')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#C2412D] dark:text-[#FCA5A5] bg-white dark:bg-[#1C364B] border border-[#FECACA] dark:border-[#C2412D]/50 hover:bg-[#FEF2F2] dark:hover:bg-[#C2412D]/20 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#D5E0EA]/60 dark:divide-[#244157]/70">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-14 px-6 space-y-2">
                    <Inbox className="w-8 h-8 text-[#9CB4C9] dark:text-[#4D6A82] mx-auto" />
                    <p className="text-sm font-medium text-[#43525F] dark:text-[#D3E3F2]">
                      {searchQuery
                        ? 'No notifications match your search.'
                        : folder === 'unread'
                        ? 'You are all caught up.'
                        : folder === 'starred'
                        ? 'No starred notifications yet.'
                        : folder === 'archived'
                        ? 'No archived notifications.'
                        : 'No notifications in your inbox right now.'}
                    </p>
                    <p className="text-xs text-[#6B7A87] dark:text-[#9CB4C9]">
                      {searchQuery
                        ? 'Try a different keyword or clear the search box.'
                        : 'Procurement updates for your active workspace will appear here.'}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => {
                    const isSelected = activeSelectedIds.includes(notif.id);
                    return (
                      <div
                        key={notif.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenReader(notif)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenReader(notif);
                          }
                        }}
                        className={`group px-4 py-3.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#EAF2FA]/85 dark:bg-[#6FAEE0]/15'
                            : notif.read
                            ? 'bg-[#EAF2FA]/25 dark:bg-[#10212E] hover:bg-[#EAF2FA]/55 dark:hover:bg-[#162C3D]'
                            : 'bg-white dark:bg-[#1C364B] hover:bg-[#EAF2FA]/45 dark:hover:bg-[#244157]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectOne(notif.id);
                            }}
                            className="mt-0.5 p-0.5 rounded text-slate-400 hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] cursor-pointer shrink-0"
                            aria-label={isSelected ? `Deselect ${notif.title}` : `Select ${notif.title}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>

                          {/* Star Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleNotificationStar(notif.id, !notif.starred);
                            }}
                            className="mt-0.5 p-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/60 cursor-pointer shrink-0"
                            title={notif.starred ? 'Remove star' : 'Star notification'}
                            aria-label={notif.starred ? 'Remove star' : 'Star notification'}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                notif.starred
                                  ? 'fill-amber-400 text-amber-500'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                              }`}
                            />
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {getIcon(notif.type, 'w-4 h-4')}
                                <h4
                                  className={`text-sm leading-snug truncate ${
                                    notif.read
                                      ? 'font-medium text-slate-700 dark:text-slate-300'
                                      : 'font-semibold text-[#10212E] dark:text-white'
                                  }`}
                                >
                                  {notif.title}
                                </h4>
                              </div>
                              {!notif.read && (
                                <span
                                  className="w-2 h-2 rounded-full bg-[#1F5F99] dark:bg-[#6FAEE0] shrink-0 mt-1.5"
                                  aria-label="Unread"
                                />
                              )}
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed line-clamp-2">
                              {notif.message}
                            </p>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                                  {formatCatTimestamp(notif.timestamp)}
                                </span>
                                {notif.archived && folder !== 'archived' && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    Archived
                                  </span>
                                )}
                              </div>

                              {/* Inline Mail Actions */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (notif.read) {
                                      void markNotificationUnread(notif.id);
                                    } else {
                                      void markNotificationRead(notif.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors cursor-pointer dark:text-[#9CB4C9]"
                                  title={notif.read ? 'Mark as unread' : 'Mark as read'}
                                  aria-label={notif.read ? 'Mark as unread' : 'Mark as read'}
                                >
                                  {notif.read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void toggleNotificationArchive(notif.id, !notif.archived);
                                    setStatusFeedback(notif.archived ? 'Moved to inbox.' : 'Notification archived.');
                                  }}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors cursor-pointer dark:text-[#9CB4C9]"
                                  title={notif.archived ? 'Move to inbox' : 'Archive'}
                                  aria-label={notif.archived ? 'Move to inbox' : 'Archive'}
                                >
                                  {notif.archived ? (
                                    <ArchiveRestore className="w-3.5 h-3.5" />
                                  ) : (
                                    <Archive className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteNotification(notif.id);
                                    setStatusFeedback('Notification deleted.');
                                  }}
                                  className="p-1.5 rounded-md text-slate-500 hover:text-[#C2412D] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer dark:text-[#9CB4C9]"
                                  title="Delete"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReader(notif);
                                  }}
                                  className="ml-1 px-2 py-1 rounded-md text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:bg-[#EAF2FA] dark:hover:bg-[#1F5F99]/20 inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <span>Read</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#D5E0EA] dark:border-[#244157] bg-[#EAF2FA]/45 dark:bg-[#162C3D] flex items-center justify-between text-xs text-[#6B7A87] dark:text-[#9CB4C9]">
            <span>In-app procurement inbox</span>
            <span className="tabular-nums">
              {counts.inbox} in inbox · {counts.archived} archived
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
