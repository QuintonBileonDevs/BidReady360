import React, { useState } from 'react';
import { useApp, UserRole } from '../../context/AppContext';
import { Logo } from './Logo';
import {
  Bell,
  Menu,
  X,
  Globe,
  ChevronDown,
  Building2,
  Briefcase,
  LogOut,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { NotificationDrawer } from './NotificationDrawer';
import { AuthModal, AuthTenant } from '../auth/AuthModal';

export const Header: React.FC = () => {
  const {
    role,
    setRole,
    activeNav,
    setActiveNav,
    supplier,
    notifications,
    language,
    setLanguage,
    isAuthenticated,
    currentUser,
    logout,
  } = useApp();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTenant, setAuthTenant] = useState<AuthTenant>('supplier');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSignInDropdownOpen, setIsSignInDropdownOpen] = useState(false);

  const unreadNotifs = notifications.filter(
    (n) =>
      !n.read &&
      ((role === 'supplier' && n.recipientRole === 'Supplier') ||
        (role === 'buyer' && n.recipientRole === 'Buyer'))
  ).length;

  // Shortened navigation labels per user specification
  const publicNavItems = [
    { id: 'opportunities', label: 'Opportunities' },
    { id: 'suppliers', label: 'For suppliers' },
    { id: 'buyers', label: 'For buyers' },
    { id: 'help', label: 'Help' },
  ];

  const supplierNavItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'profile', label: 'Profile' },
    { id: 'vault', label: 'Documents' },
    { id: 'sharing', label: 'Sharing' },
    { id: 'my-applications', label: 'Applications' },
  ];

  const buyerNavItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'review-queue', label: 'Review queue' },
    { id: 'rfp-management', label: 'Tenders' },
    { id: 'evaluation', label: 'Evaluation' },
    { id: 'awards', label: 'Awards' },
    { id: 'supplier-database', label: 'Roster' },
  ];

  const isAuthRoute = [
    'auth',
    'signin',
    'signup',
    'register',
    'supplier-login',
    'supplier-signup',
    'buyer-login',
    'buyer-signup',
    'buyer-pending',
    'org-login',
    'admin-login',
    'forgot-password',
    'reset-password',
    'accept-invite',
    'choose-workspace',
    'session-expired',
  ].includes(activeNav);

  const navItems = isAuthRoute
    ? []
    : (!isAuthenticated || role === 'public')
    ? publicNavItems
    : role === 'supplier'
    ? supplierNavItems
    : buyerNavItems;

  const handleNavClick = (id: string) => {
    setActiveNav(id);
    setIsMobileMenuOpen(false);
  };

  const openAuth = (tenant: AuthTenant, mode: 'signin' | 'signup') => {
    setAuthTenant(tenant);
    setAuthMode(mode);
    setIsAuthModalOpen(true);
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsSignInDropdownOpen(false);
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    await logout();
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] transition-colors">
        <div className="container-1160 h-16 flex items-center justify-between gap-6">
          {/* 1. Left: Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (role === 'public') setActiveNav('about');
                else setActiveNav('dashboard');
              }}
              className="text-left focus:outline-none cursor-pointer"
              aria-label="BidReady360 home"
            >
              <Logo theme="light" size="md" />
            </button>
          </div>

          {/* 2. Center: Navigation with 2px Pula Deep underline for active item */}
          {navItems.length > 0 && (
            <nav className="hidden lg:flex items-center gap-6 h-full">
              {navItems.map((item) => {
                const isActive = activeNav === item.id || (item.id === 'sharing' && activeNav === 'consent');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`h-full flex items-center px-1 text-[15px] font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                      isActive
                        ? 'border-[#1F5F99] text-[#10212E] dark:text-white font-semibold'
                        : 'border-transparent text-[#43525F] dark:text-[#B2C3D2] hover:text-[#10212E] dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* 3. Right: Language toggle, Notification Bell, User Menu */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Language Toggle: EN / TN */}
            <div className="flex items-center gap-1 text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
              <Globe className="w-3.5 h-3.5 text-[#1F5F99]" strokeWidth={1.5} />
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`font-semibold cursor-pointer min-h-[44px] min-w-[28px] inline-flex items-center justify-center ${
                  language === 'en'
                    ? 'text-[#1F5F99] underline'
                    : 'text-[#6B7A87] hover:text-[#10212E]'
                }`}
              >
                EN
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => setLanguage('tn')}
                className={`font-semibold cursor-pointer min-h-[44px] min-w-[28px] inline-flex items-center justify-center ${
                  language === 'tn'
                    ? 'text-[#1F5F99] underline'
                    : 'text-[#6B7A87] hover:text-[#10212E]'
                }`}
              >
                TN
              </button>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] rounded-[6px] hover:bg-[#F7FAFD] transition-colors cursor-pointer"
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" strokeWidth={1.5} />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#C2412D] rounded-full" />
              )}
            </button>

            {/* Public Role Action Buttons */}
            {role === 'public' && (
              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() => openAuth('supplier', 'signin')}
                  className="px-3.5 py-2 text-[15px] font-medium text-[#10212E] dark:text-white hover:text-[#1F5F99] transition-colors cursor-pointer"
                >
                  Sign in
                </button>
                <button
                  onClick={() => openAuth('supplier', 'signup')}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[15px] font-medium rounded-[6px] transition-colors cursor-pointer"
                >
                  Register company
                </button>
              </div>
            )}

            {/* Supplier User Menu: Avatar, Full Company Name with Tooltip, Second line "Verified supplier" */}
            {role === 'supplier' && (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  title={supplier.legalName}
                  className="flex items-center gap-2.5 pl-2 pr-1.5 py-1 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] transition-colors cursor-pointer text-left"
                >
                  <div className="w-8 h-8 rounded-[6px] bg-[#EAF2FA] text-[#1F5F99] flex items-center justify-center font-semibold text-[13px] shrink-0">
                    KB
                  </div>
                  <div className="hidden sm:block leading-tight">
                    <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block max-w-[150px] truncate">
                      {supplier.legalName}
                    </span>
                    <span className="text-[13px] text-[#6B7A87] block">
                      Verified supplier
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#6B7A87]" strokeWidth={1.5} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-2 z-50 text-[13px] space-y-1">
                    <div className="px-3 py-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                      <div className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                        {supplier.legalName}
                      </div>
                      <div className="text-[13px] text-[#6B7A87]">
                        CIPA: {supplier.cipaNumber}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveNav('profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white transition-colors"
                    >
                      Company profile
                    </button>
                    <button
                      onClick={() => {
                        setActiveNav('vault');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white transition-colors"
                    >
                      Document vault
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-rose-50 text-[#C2412D] transition-colors font-medium flex items-center justify-between"
                    >
                      <span>Sign out</span>
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Buyer User Menu */}
            {role === 'buyer' && (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  title="Gaborone Regional Council"
                  className="flex items-center gap-2.5 pl-2 pr-1.5 py-1 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] transition-colors cursor-pointer text-left"
                >
                  <div className="w-8 h-8 rounded-[6px] bg-[#EAF2FA] text-[#1F5F99] flex items-center justify-center font-semibold text-[13px] shrink-0">
                    GR
                  </div>
                  <div className="hidden sm:block leading-tight">
                    <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block max-w-[150px] truncate">
                      Gaborone Council
                    </span>
                    <span className="text-[13px] text-[#6B7A87] block">
                      Procurement body
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#6B7A87]" strokeWidth={1.5} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-2 z-50 text-[13px] space-y-1">
                    <div className="px-3 py-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                      <div className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                        Gaborone Regional Council
                      </div>
                      <div className="text-[13px] text-[#6B7A87]">
                        Supply Chain Unit
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-rose-50 text-[#C2412D] transition-colors font-medium flex items-center justify-between"
                    >
                      <span>Sign out</span>
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Button */}
            {navItems.length > 0 && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] hover:bg-[#F7FAFD] cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" strokeWidth={1.5} />
                ) : (
                  <Menu className="w-5 h-5" strokeWidth={1.5} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && navItems.length > 0 && (
          <div className="lg:hidden bg-white dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] px-4 py-4 space-y-2">
            {navItems.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-[6px] text-[15px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#EAF2FA] text-[#1F5F99] font-semibold'
                      : 'text-[#43525F] hover:bg-[#F7FAFD]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTenant={authTenant}
        initialMode={authMode}
      />
    </>
  );
};
