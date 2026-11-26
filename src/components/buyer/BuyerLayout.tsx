import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../common/Logo';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  ClipboardList,
  Users,
  Lock,
  Award,
  BarChart3,
  UserCheck,
  FormInput,
  Layers,
  Palette,
  Key,
  CreditCard,
  ScrollText,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Bell,
} from 'lucide-react';

import { BuyerDashboard } from './BuyerDashboard';
import { BuyerCreateCallWizard } from './BuyerCreateCallWizard';
import { BuyerReviewQueue } from './BuyerReviewQueue';
import { BuyerSupplierDatabase } from './BuyerSupplierDatabase';
import { BuyerRFPManagement } from './BuyerRFPManagement';
import { BuyerBidsOpening } from './BuyerBidsOpening';
import { BuyerEvaluation } from './BuyerEvaluation';
import { BuyerAwards } from './BuyerAwards';
import { BuyerClarifications } from './BuyerClarifications';
import { BuyerReports } from './BuyerReports';
import { BuyerTeamRoles } from './BuyerTeamRoles';
import { BuyerFormBuilder } from './BuyerFormBuilder';
import { BuyerWorkflowsScoring } from './BuyerWorkflowsScoring';
import { BuyerBranding } from './BuyerBranding';
import { BuyerIntegrations } from './BuyerIntegrations';
import { BuyerBilling } from './BuyerBilling';
import { BuyerAuditLog } from './BuyerAuditLog';
import { BuyerSettings } from './BuyerSettings';
import { NotificationDrawer } from '../common/NotificationDrawer';
import { ThemeSwitcher } from '../common/ThemeSwitcher';

export const BuyerLayout: React.FC = () => {
  const {
    currentUser,
    profileSummary,
    registeredBuyerOrgName,
    registeredBuyerEmail,
    notifications,
    logout,
    setRole,
    setActiveNav,
    buyerSubRole,
    setSelectedCallId,
    buyerBranding,
  } = useApp();

  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const orgDisplayName =
    buyerBranding?.name ||
    registeredBuyerOrgName ||
    profileSummary?.supplierOrOrgName ||
    'Procuring Organization';
  const brandColor =
    buyerBranding?.brandPrimaryColor && /^#[0-9A-Fa-f]{6}$/.test(buyerBranding.brandPrimaryColor)
      ? buyerBranding.brandPrimaryColor
      : '#1F5F99';
  const brandSubtext = buyerBranding?.brandSubtext || 'Procuring entity workspace';
  const brandDomain = buyerBranding?.customDomain || '';
  const orgInitials =
    orgDisplayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'PO';
  const buyerName = currentUser?.fullName || profileSummary?.displayName || 'Procurement Officer';
  const buyerEmail = currentUser?.email || registeredBuyerEmail || '';
  const buyerInitials =
    buyerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'PO';

  const unreadNotifs = notifications.filter(
    (n) => !n.read && !n.archived && n.recipientRole === 'Buyer'
  ).length;

  const navGroups = [
    {
      groupTitle: 'Overview',
      items: [{ id: 'overview', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      groupTitle: 'Calls',
      items: [
        { id: 'calls', label: 'Calls', icon: FileText },
        { id: 'clarifications', label: 'Clarifications', icon: MessageSquare },
      ],
    },
    {
      groupTitle: 'Review',
      items: [
        { id: 'applications', label: 'Applications', icon: ClipboardList },
        { id: 'roster', label: 'Supplier roster', icon: Users },
      ],
    },
    {
      groupTitle: 'Bids',
      items: [
        { id: 'bids-opening', label: 'Bids and opening', icon: Lock },
        { id: 'evaluation', label: 'Evaluation', icon: BarChart3 },
        { id: 'awards', label: 'Awards and contracts', icon: Award },
      ],
    },
    {
      groupTitle: 'Reports',
      items: [{ id: 'reports', label: 'Reports', icon: BarChart3 }],
    },
    {
      groupTitle: 'Admin',
      items: [
        { id: 'team', label: 'Team and roles', icon: UserCheck },
        { id: 'form-builder', label: 'Form builder', icon: FormInput },
        { id: 'scoring-workflows', label: 'Workflows and scoring', icon: Layers },
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'integrations', label: 'Integrations', icon: Key },
        { id: 'billing', label: 'Billing', icon: CreditCard },
        { id: 'audit-log', label: 'Audit log', icon: ScrollText },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);
  const activeTabLabel =
    currentTab === 'create-call'
      ? 'Publish call'
      : allNavItems.find((item) => item.id === currentTab)?.label || 'Dashboard';

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    setIsMobileNavOpen(false);
    try {
      await logout('user_initiated');
    } catch {
      setRole('public');
      setActiveNav('about');
    }
  };

  const renderActiveContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <BuyerDashboard
            onNavigate={(tabId) => setCurrentTab(tabId)}
            onSelectCall={(cId) => setSelectedCallId(cId)}
          />
        );
      case 'calls':
        return <BuyerRFPManagement />;
      case 'create-call':
        return (
          <BuyerCreateCallWizard
            onFinished={() => setCurrentTab('calls')}
            onCancel={() => setCurrentTab('overview')}
          />
        );
      case 'clarifications':
        return <BuyerClarifications />;
      case 'applications':
        return <BuyerReviewQueue />;
      case 'roster':
        return <BuyerSupplierDatabase />;
      case 'bids-opening':
        return <BuyerBidsOpening />;
      case 'evaluation':
        return <BuyerEvaluation />;
      case 'awards':
        return <BuyerAwards />;
      case 'reports':
        return <BuyerReports />;
      case 'team':
        return <BuyerTeamRoles />;
      case 'form-builder':
        return <BuyerFormBuilder />;
      case 'scoring-workflows':
        return <BuyerWorkflowsScoring />;
      case 'branding':
        return <BuyerBranding />;
      case 'integrations':
        return <BuyerIntegrations />;
      case 'billing':
        return <BuyerBilling />;
      case 'audit-log':
        return <BuyerAuditLog />;
      case 'settings':
        return <BuyerSettings />;
      default:
        return (
          <BuyerDashboard
            onNavigate={(tabId) => setCurrentTab(tabId)}
            onSelectCall={(cId) => setSelectedCallId(cId)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white flex flex-col">
      {/* 1. Unified Buyer Workspace Header */}
      <header
        className="sticky top-0 z-40 bg-white dark:bg-[#162C3D] border-b border-[#D5E0EA] dark:border-[#244157] h-16 flex items-center px-4 sm:px-6 justify-between gap-6 border-t-[3px]"
        style={{ borderTopColor: brandColor }}
      >
        {/* Left: Brand Wordmark + Organization Breadcrumb */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center text-[#43525F] dark:text-[#D3E3F2] rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#1C364B] cursor-pointer shrink-0"
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('overview')}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5F99] rounded-[4px] cursor-pointer shrink-0"
            aria-label="BidReady360 Buyer Dashboard"
          >
            <Logo size="md" />
          </button>

          <span
            aria-hidden="true"
            className="hidden sm:block h-5 w-px bg-[#D5E0EA] dark:bg-[#244157] shrink-0"
          />

          <nav aria-label="Workspace breadcrumb" className="hidden sm:flex items-center gap-2.5 text-[13px] min-w-0">
            <button
              type="button"
              onClick={() => setCurrentTab('overview')}
              className="flex items-center gap-2 text-[#43525F] dark:text-[#D3E3F2] hover:text-[#10212E] dark:hover:text-white transition-colors min-w-0 cursor-pointer"
              title={`${orgDisplayName} — ${brandSubtext}`}
            >
              <span
                className="w-6 h-6 rounded-[5px] text-white font-bold text-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                {orgInitials}
              </span>
              <span className="truncate max-w-[220px] font-medium">{orgDisplayName}</span>
            </button>
            <span aria-hidden="true" className="text-[#94A3B8] dark:text-[#4B6378] shrink-0">
              /
            </span>
            <span className="font-semibold text-[#10212E] dark:text-white whitespace-nowrap truncate">
              {activeTabLabel}
            </span>
          </nav>
        </div>

        {/* Right: Theme Switcher, Notifications & Buyer User Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeSwitcher variant="compact" />
          <button
            type="button"
            onClick={() => setIsNotifOpen(true)}
            className="relative min-w-[40px] min-h-[40px] flex items-center justify-center text-[#43525F] dark:text-[#D3E3F2] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] rounded-[6px] hover:bg-[#EAF2FA] dark:hover:bg-[#1C364B] transition-colors cursor-pointer shrink-0"
            aria-label={unreadNotifs > 0 ? `Open notifications (${unreadNotifs} unread)` : 'Open notifications'}
          >
            <Bell className="w-4 h-4" strokeWidth={1.75} />
            {unreadNotifs > 0 && (
              <span
                data-testid="buyer-notification-unread-badge"
                className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#C2412D] text-white text-[10px] font-semibold leading-none rounded-[4px] flex items-center justify-center tabular-nums"
              >
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              className="min-h-[40px] flex items-center gap-2.5 pl-2 pr-2 py-1 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#1C364B] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5F99]"
            >
              <div
                className="w-8 h-8 rounded-[6px] text-white flex items-center justify-center font-semibold text-[13px] shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                {buyerInitials}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block max-w-[180px] truncate">
                  {buyerName}
                </span>
                <span className="text-[12px] text-[#6B7A87] dark:text-[#8DA2B5] block whitespace-nowrap">
                  {buyerSubRole}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#6B7A87] transition-transform duration-150 shrink-0 dark:text-[#9CB4C9] ${
                  isUserMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] rounded-[10px] p-1.5 z-50 text-[13px] space-y-1 shadow-elevated"
              >
                <div className="px-3 py-2 border-b border-[#D5E0EA] dark:border-[#244157]">
                  <div className="font-semibold text-[14px] text-[#10212E] dark:text-white truncate">
                    {buyerName}
                  </div>
                  <div className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9] truncate">
                    {buyerEmail ? `${buyerEmail} · ${buyerSubRole}` : buyerSubRole}
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCurrentTab('team');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#EAF2FA] dark:hover:bg-[#162C3D] text-[#10212E] dark:text-white transition-colors cursor-pointer"
                >
                  Team profile &amp; roles
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCurrentTab('settings');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#EAF2FA] dark:hover:bg-[#162C3D] text-[#10212E] dark:text-white transition-colors cursor-pointer"
                >
                  Procurement settings
                </button>
                <div className="px-2.5 py-2 border-y border-[#D5E0EA] dark:border-[#244157] space-y-1.5">
                  <span className="text-[11px] font-medium text-[#6B7A87] dark:text-[#9CB4C9] block">
                    Appearance
                  </span>
                  <ThemeSwitcher variant="segmented" className="w-full justify-between" />
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[#C2412D] dark:text-rose-400 transition-colors font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>Sign out</span>
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Body with Grouped Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {isMobileNavOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar */}
        <aside
          className={`w-64 bg-white dark:bg-[#162C3D] border-r border-[#D5E0EA] dark:border-[#244157] p-4 flex flex-col justify-between shrink-0 overflow-y-auto ${
            isMobileNavOpen ? 'flex fixed inset-y-0 left-0 z-50 pt-20' : 'hidden md:flex'
          }`}
        >
          <div className="space-y-4">
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <span className="text-[11px] font-semibold text-[#6B7A87] dark:text-[#8DA2B5] uppercase tracking-wider px-3 block">
                  {group.groupTitle}
                </span>
                {group.items.map((item) => {
                  const isActive = currentTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCurrentTab(item.id);
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'font-semibold'
                          : 'text-[#43525F] dark:text-[#D3E3F2] hover:bg-[#F7FAFD] dark:hover:bg-[#1C364B] hover:text-[#10212E] dark:hover:text-white'
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: `${brandColor}18`, color: brandColor }
                          : undefined
                      }
                    >
                      <Icon
                        className="w-4 h-4 shrink-0"
                        style={isActive ? { color: brandColor } : undefined}
                        strokeWidth={1.5}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="pt-4 mt-6 border-t border-[#D5E0EA] dark:border-[#244157] flex items-start gap-2.5 text-[12px] text-[#6B7A87] dark:text-[#8DA2B5]">
            <div
              className="w-8 h-8 rounded-[6px] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: brandColor }}
            >
              {orgInitials}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="truncate font-semibold text-[#10212E] dark:text-white">{orgDisplayName}</div>
              <div className="text-[11px] truncate">{brandSubtext}</div>
              {brandDomain && (
                <div className="text-[10px] tabular-nums truncate opacity-80">{brandDomain}</div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content View */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-6xl mx-auto space-y-4">
            {buyerSubRole === 'Auditor' && (
              <div className="p-3.5 rounded-[8px] bg-[#EAF2FA] dark:bg-[#162C3D] border border-[#C9D9E8] dark:border-[#244157] text-[13px] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Auditor mode (Read-only):</strong> You have inspection access across tender calls, scorecards, submissions, and cryptographic receipts. Mutating actions and publishing are restricted.
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#1F5F99] dark:text-[#6FAEE0] shrink-0">
                  Read-only
                </span>
              </div>
            )}
            {renderActiveContent()}
          </div>
        </main>
      </div>

      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onNavigate={(link) => {
          const normalized = link.trim().toLowerCase();
          const map: Record<string, string> = {
            overview: 'overview',
            dashboard: 'overview',
            'buyer-dashboard': 'overview',
            calls: 'calls',
            'rfp-management': 'calls',
            clarifications: 'clarifications',
            applications: 'applications',
            'review-queue': 'applications',
            roster: 'roster',
            'supplier-database': 'roster',
            'bids-opening': 'bids-opening',
            evaluation: 'evaluation',
            awards: 'awards',
            reports: 'reports',
            team: 'team',
            branding: 'branding',
            'audit-log': 'audit-log',
            audit: 'audit-log',
            settings: 'settings',
            'buyer-settings': 'settings',
          };
          const targetTab = normalized.startsWith('call:') ? 'calls' : map[normalized] || 'overview';
          setCurrentTab(targetTab);
        }}
      />
    </div>
  );
};
