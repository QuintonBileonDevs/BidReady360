import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from '../common/Logo';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileCheck2,
  ShieldAlert,
  CreditCard,
  FolderTree,
  Bell,
  ScrollText,
  UserCog,
  HelpCircle,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  AlertTriangle,
} from 'lucide-react';

import { AdminOverview } from './AdminOverview';
import { AdminOrganizations } from './AdminOrganizations';
import { AdminSuppliers } from './AdminSuppliers';
import { AdminVerification } from './AdminVerification';
import { AdminRiskDebarments } from './AdminRiskDebarments';
import { AdminBilling } from './AdminBilling';
import { AdminCatalogues } from './AdminCatalogues';
import { AdminNotifications } from './AdminNotifications';
import { AdminAuditLog } from './AdminAuditLog';
import { AdminUsers } from './AdminUsers';
import { AdminSupport } from './AdminSupport';
import { AdminSettings } from './AdminSettings';

export const AdminLayout: React.FC = () => {
  const { currentUser, logout, setRole, setActiveNav } = useApp();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Support Diagnostic Session State
  const [activeSupportSession, setActiveSupportSession] = useState<{
    entityName: string;
    reason: string;
  } | null>(null);

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

  const adminName = currentUser?.fullName || 'Platform Administrator';
  const adminEmail = currentUser?.email || 'admin@bidready360.gov.bw';
  const adminInitials =
    adminName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'PA';

  const navItems = [
    { id: 'overview', label: 'Overview', pageTitle: 'Platform overview', icon: LayoutDashboard },
    { id: 'organizations', label: 'Organizations', pageTitle: 'Procuring organizations', icon: Building2 },
    { id: 'suppliers', label: 'Suppliers', pageTitle: 'Registered suppliers', icon: Users },
    { id: 'verification', label: 'Verification', pageTitle: 'Verification queue', icon: FileCheck2 },
    { id: 'risk-debarments', label: 'Risk and debarments', pageTitle: 'Risk and debarments', icon: ShieldAlert },
    { id: 'billing', label: 'Billing', pageTitle: 'Billing and subscriptions', icon: CreditCard },
    { id: 'catalogues', label: 'Catalogues', pageTitle: 'Reference catalogues', icon: FolderTree },
    { id: 'notifications', label: 'Notifications', pageTitle: 'Platform notifications', icon: Bell },
    { id: 'audit-log', label: 'Audit log', pageTitle: 'Statutory audit log', icon: ScrollText },
    { id: 'admin-users', label: 'Users & security', pageTitle: 'Users and security', icon: UserCog },
    { id: 'support', label: 'Support', pageTitle: 'Support diagnostics', icon: HelpCircle },
    { id: 'settings', label: 'Settings', pageTitle: 'System settings', icon: Settings },
  ];

  const activeNavItem = navItems.find((item) => item.id === currentTab) || navItems[0];

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    try {
      await logout('user_initiated');
    } catch {
      setRole('public');
      setActiveNav('about');
    }
  };

  const handleStartSupportSession = (entityName: string, reason: string) => {
    setActiveSupportSession({ entityName, reason });
  };

  const handleEndSupportSession = () => {
    setActiveSupportSession(null);
  };

  const renderActiveContent = () => {
    switch (currentTab) {
      case 'overview':
        return <AdminOverview onNavigateTab={(tab) => setCurrentTab(tab)} />;
      case 'organizations':
        return <AdminOrganizations onStartSupportSession={handleStartSupportSession} />;
      case 'suppliers':
        return <AdminSuppliers onStartSupportSession={handleStartSupportSession} />;
      case 'verification':
        return <AdminVerification />;
      case 'risk-debarments':
        return <AdminRiskDebarments />;
      case 'billing':
        return <AdminBilling />;
      case 'catalogues':
        return <AdminCatalogues />;
      case 'notifications':
        return <AdminNotifications />;
      case 'audit-log':
        return <AdminAuditLog />;
      case 'admin-users':
        return <AdminUsers />;
      case 'support':
        return <AdminSupport onStartSupportSession={handleStartSupportSession} />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminOverview onNavigateTab={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-white flex">
      {/* Mobile Backdrop */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (Houses single Brand Lockup + Admin Navigation) */}
      <aside
        className={`w-64 bg-white dark:bg-[#10212E] border-r border-[#D5E0EA] dark:border-[#1E364A] flex flex-col justify-between shrink-0 ${
          isMobileNavOpen
            ? 'flex fixed inset-y-0 left-0 z-50 h-screen'
            : 'hidden md:flex md:sticky md:top-0 md:h-screen'
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Sidebar Brand Header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#D5E0EA] dark:border-[#1E364A] shrink-0">
            <button
              type="button"
              onClick={() => {
                setCurrentTab('overview');
                setIsMobileNavOpen(false);
              }}
              className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5F99] rounded-[4px] cursor-pointer"
              aria-label="BidReady360 Admin Overview"
            >
              <Logo size="md" />
            </button>

            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="md:hidden min-w-[36px] min-h-[36px] flex items-center justify-center text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Admin Section Links */}
          <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto p-3.5 space-y-1">
            {navItems.map((item) => {
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] font-semibold'
                      : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] hover:text-[#10212E] dark:hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#1F5F99] dark:text-[#6FAEE0]' : 'text-[#6B7A87]'
                    }`}
                    strokeWidth={1.5}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="px-5 py-3.5 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[12px] text-[#6B7A87] dark:text-[#8DA2B5] shrink-0">
          Platform operations · Botswana
        </div>
      </aside>

      {/* Right Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Streamlined Admin Header: Current Page Title + Contextual Admin Controls */}
        <header className="sticky top-0 z-40 bg-white dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] h-16 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Mobile Drawer Trigger + Current Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white truncate">
              {activeNavItem.pageTitle}
            </span>
          </div>

          {/* Right: Contextual Admin Controls & Account Menu */}
          <div className="flex items-center gap-2 shrink-0" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setCurrentTab('notifications')}
              className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-[6px] transition-colors cursor-pointer ${
                currentTab === 'notifications'
                  ? 'bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0]'
                  : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] hover:text-[#10212E] dark:hover:text-white'
              }`}
              aria-label="Platform notifications"
              title="Platform notifications"
            >
              <Bell className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('settings')}
              className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-[6px] transition-colors cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0]'
                  : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] hover:text-[#10212E] dark:hover:text-white'
              }`}
              aria-label="System settings"
              title="System settings"
            >
              <Settings className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <span
              aria-hidden="true"
              className="hidden sm:block h-5 w-px bg-[#D5E0EA] dark:bg-[#1E364A] mx-1"
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                className="min-h-[40px] flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5F99]"
              >
                <div className="w-8 h-8 rounded-[6px] bg-[#10212E] dark:bg-[#1F5F99] text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
                  {adminInitials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block max-w-[180px] truncate">
                    {adminName}
                  </span>
                  <span className="text-[12px] text-[#6B7A87] dark:text-[#8DA2B5] block whitespace-nowrap">
                    Super admin
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#6B7A87] transition-transform duration-150 shrink-0 ${
                    isUserMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isUserMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[10px] p-1.5 z-50 text-[13px] space-y-1 shadow-sm"
                >
                  <div className="px-3 py-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                    <div className="font-semibold text-[14px] text-[#10212E] dark:text-white truncate">
                      {adminName}
                    </div>
                    <div className="text-[12px] text-[#6B7A87] dark:text-[#8DA2B5] truncate">
                      {adminEmail}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCurrentTab('admin-users');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#10212E] dark:text-white transition-colors cursor-pointer"
                  >
                    Users &amp; security
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCurrentTab('settings');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#10212E] dark:text-white transition-colors cursor-pointer"
                  >
                    System settings
                  </button>
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

        {/* Privacy-Enforced Active Support Banner */}
        {activeSupportSession && (
          <div className="bg-[#FFFBEB] dark:bg-[#92400E]/30 border-b border-[#FDE68A] dark:border-[#92400E]/50 px-6 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[14px] text-[#92400E] dark:text-[#FCD34D]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Support session active:</strong> All actions are recorded in the statutory audit log. (Target: {activeSupportSession.entityName} · Reason: {activeSupportSession.reason})
              </span>
            </div>
            <button
              type="button"
              onClick={handleEndSupportSession}
              className="px-3 py-1 bg-[#92400E] hover:bg-[#78350f] text-white rounded-[4px] text-[12px] font-medium whitespace-nowrap cursor-pointer"
            >
              End support session
            </button>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-6xl mx-auto">{renderActiveContent()}</div>
        </main>
      </div>
    </div>
  );
};
