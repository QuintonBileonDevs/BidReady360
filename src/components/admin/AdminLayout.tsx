import React, { useState } from 'react';
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
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  Lock,
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
import { NotificationDrawer } from '../common/NotificationDrawer';

export const AdminLayout: React.FC = () => {
  const { setRole, setActiveNav } = useApp();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Support Diagnostic Session State
  const [activeSupportSession, setActiveSupportSession] = useState<{
    entityName: string;
    reason: string;
  } | null>(null);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
    { id: 'verification', label: 'Verification', icon: FileCheck2 },
    { id: 'risk-debarments', label: 'Risk and debarments', icon: ShieldAlert },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'catalogues', label: 'Catalogues', icon: FolderTree },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'audit-log', label: 'Audit log', icon: ScrollText },
    { id: 'admin-users', label: 'Admin users', icon: UserCog },
    { id: 'support', label: 'Support', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSignOut = () => {
    setRole('public');
    setActiveNav('about');
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
        return (
          <AdminOverview
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onApproveOrg={(orgId) => {}}
          />
        );
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
        return (
          <AdminOverview
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onApproveOrg={(orgId) => {}}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-white flex flex-col">
      {/* 1. Dedicated Operations Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] h-16 flex items-center px-4 sm:px-6 justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="md:hidden p-1.5 text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] hover:bg-[#F7FAFD]"
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Logo theme="light" size="md" />
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-[4px] bg-[#EAF2FA] text-[#1F5F99] font-medium text-[12px]">
            Platform operations
          </span>
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search organizations, suppliers, verification IDs, audit records..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-[#F7FAFD] dark:bg-[#132635] text-[13px] text-[#10212E] dark:text-white focus:bg-white"
            />
          </div>
        </div>

        {/* Right: Notifications & Admin User Menu */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsNotifOpen(true)}
            className="p-2 text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] rounded-[6px] hover:bg-[#F7FAFD] transition-colors cursor-pointer"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Admin User Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-[6px] bg-[#10212E] text-white flex items-center justify-center font-semibold text-[13px]">
                LM
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                  Lesedi Mokgweetsi
                </span>
                <span className="text-[12px] text-[#6B7A87] block">
                  Super admin
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B7A87]" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-2 z-50 text-[13px] space-y-1 shadow-sm">
                <div className="px-3 py-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                  <div className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                    Lesedi Mokgweetsi
                  </div>
                  <div className="text-[12px] text-[#6B7A87]">
                    admin@bidready360.gov.bw
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('settings');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white transition-colors"
                >
                  System settings
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-rose-50 text-[#C2412D] transition-colors font-medium flex items-center justify-between"
                >
                  <span>Sign out</span>
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Privacy-Enforced Active Support Banner */}
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
            className="px-3 py-1 bg-[#92400E] hover:bg-[#78350f] text-white rounded-[4px] text-[12px] font-medium whitespace-nowrap"
          >
            End support session
          </button>
        </div>
      )}

      {/* 3. Main Dashboard Body (Left Sidebar + Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`w-64 bg-white dark:bg-[#10212E] border-r border-[#D5E0EA] dark:border-[#1E364A] p-4 flex flex-col justify-between shrink-0 ${
            isMobileNavOpen ? 'block fixed inset-y-0 left-0 z-50 pt-20' : 'hidden md:flex'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-[#6B7A87] uppercase tracking-wider px-3 pb-2 block">
              Operations
            </span>
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EAF2FA] text-[#1F5F99] font-semibold'
                      : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] hover:text-[#10212E]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#1F5F99]' : 'text-[#6B7A87]'}`} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[12px] text-[#6B7A87] space-y-1">
            <div>Republic of Botswana</div>
            <div className="text-[11px]">Audit Engine v2.4 · Compliant</div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-6xl mx-auto">{renderActiveContent()}</div>
        </main>
      </div>

      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  );
};
