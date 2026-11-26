import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Logo } from './Logo';
import {
  Bell,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Lock,
  Loader2,
} from 'lucide-react';
import { NotificationDrawer } from './NotificationDrawer';
import { calculateSupplierCompleteness } from '../../utils/supplierOnboarding';
import { useReadiness } from '../../context/ReadinessContext';

export const Header: React.FC = () => {
  const { setReady: setHeaderReady } = useReadiness('header.user');
  const {
    role,
    activeNav,
    setActiveNav,
    supplier,
    documents,
    notifications,
    isAuthenticated,
    logout,
  } = useApp();

  const supplierCompleteness = calculateSupplierCompleteness(supplier, documents);
  const isProfileComplete = supplierCompleteness.score >= 100;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (role === 'supplier') {
      const isReady = Boolean(
        supplier &&
        supplier.legalName &&
        supplier.legalName !== 'Registered Supplier' &&
        supplier.legalName !== 'Supplier Account' &&
        supplier.legalName !== 'Loading profile...'
      );
      setHeaderReady(isReady);
    } else {
      setHeaderReady(true);
    }
  }, [role, supplier, setHeaderReady]);

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

  const unreadNotifs = notifications.filter(
    (n) =>
      !n.read &&
      ((role === 'supplier' && n.recipientRole === 'Supplier') ||
        (role === 'buyer' && n.recipientRole === 'Buyer'))
  ).length;

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

  const isAuthRoute = [
    'auth',
    'signin',
    'signup',
    'register',
    'supplier-login',
    'supplier-signup',
    'supplier-verify-email',
    'supplier-welcome',
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
    'account-locked',
  ].includes(activeNav);

  const navItems =
    isAuthRoute || role === 'admin' || role === 'buyer'
      ? []
      : !isAuthenticated || role === 'public'
      ? publicNavItems
      : supplierNavItems;

  const handleNavClick = (id: string) => {
    setActiveNav(id);
    setIsMobileMenuOpen(false);
  };

  const openAuth = (tenant: 'supplier' | 'buyer', mode: 'signin' | 'signup') => {
    if (tenant === 'buyer') {
      setActiveNav(mode === 'signup' ? 'buyer-signup' : 'buyer-login');
    } else {
      setActiveNav(mode === 'signup' ? 'supplier-signup' : 'supplier-login');
    }
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    await logout('user_initiated');
  };

  const handleLogoClick = () => {
    if (!isAuthenticated || role === 'public') setActiveNav('about');
    else if (role === 'admin') setActiveNav('admin-dashboard');
    else if (role === 'buyer') setActiveNav('buyer-dashboard');
    else setActiveNav('dashboard');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] transition-colors">
        <div className="container-1160 h-16 flex items-center justify-between gap-6 lg:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={handleLogoClick}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5F99] rounded-[4px] cursor-pointer whitespace-nowrap shrink-0"
            aria-label="BidReady360 home"
          >
            <Logo size="md" />
          </button>

          {/* Zone 2: Primary Navigation Links */}
          {navItems.length > 0 && (
            <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-6 h-full min-w-0">
              {navItems.map((item) => {
                const isActive =
                  activeNav === item.id ||
                  (item.id === 'sharing' && activeNav === 'consent') ||
                  (item.id === 'dashboard' && activeNav === 'supplier-dashboard');
                const isLocked =
                  (item.id === 'my-applications' || item.id === 'sharing') &&
                  role === 'supplier' &&
                  !isProfileComplete;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`h-full flex items-center gap-1.5 px-1 text-[14px] xl:text-[15px] font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'border-[#1F5F99] dark:border-[#6FAEE0] text-[#10212E] dark:text-white font-semibold'
                        : 'border-transparent text-[#43525F] dark:text-[#B2C3D2] hover:text-[#10212E] dark:hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isLocked && (
                      <Lock
                        className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0"
                        aria-label={
                          item.id === 'sharing'
                            ? `Document sharing locked (${supplierCompleteness.score}% completed)`
                            : `Applications locked (${supplierCompleteness.score}% completed)`
                        }
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Zone 3: Actions & Account Menu */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Public Role Action Buttons */}
            {(!isAuthenticated || role === 'public') && (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAuth('supplier', 'signin')}
                  className="px-3.5 py-2 text-[14px] font-medium text-[#10212E] dark:text-white hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('supplier', 'signup')}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-medium rounded-[6px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Register company
                </button>
              </div>
            )}

            {/* Notification Bell (Signed-in Supplier or Buyer) */}
            {isAuthenticated && (role === 'supplier' || role === 'buyer') && (
              <button
                type="button"
                onClick={() => setIsNotifOpen(true)}
                className="relative min-w-[40px] min-h-[40px] flex items-center justify-center text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] transition-colors cursor-pointer shrink-0"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" strokeWidth={1.75} />
                {unreadNotifs > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-[#C2412D] rounded-full" />
                )}
              </button>
            )}

            {/* Supplier User Menu */}
            {isAuthenticated && role === 'supplier' && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  title={supplier.legalName || 'Supplier'}
                  className="min-h-[40px] flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] transition-colors cursor-pointer text-left shrink-0"
                >
                  <div className="w-8 h-8 rounded-[6px] bg-[#EAF2FA] dark:bg-[#162C3E] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center font-semibold text-[13px] shrink-0">
                    {supplier.legalName ? (
                      supplier.legalName.trim().substring(0, 2).toUpperCase()
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99]" />
                    )}
                  </div>
                  <div className="hidden sm:block leading-tight">
                    <span
                      data-bind="supplier.name"
                      className="font-semibold text-[14px] text-[#10212E] dark:text-white block max-w-[160px] truncate"
                    >
                      {supplier.legalName || 'Supplier'}
                    </span>
                    <span className="text-[12px] text-[#6B7A87] dark:text-[#8DA2B5] block whitespace-nowrap">
                      {!supplier.emailVerified
                        ? 'Verification pending'
                        : 'Supplier account'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#6B7A87] transition-transform duration-150 shrink-0 ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                    strokeWidth={1.75}
                  />
                </button>

                {isUserMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[10px] p-1.5 z-50 text-[13px] space-y-1 shadow-sm"
                  >
                    <div className="px-3 py-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                      <div className="font-semibold text-[14px] text-[#10212E] dark:text-white truncate">
                        {supplier.legalName || 'Supplier'}
                      </div>
                      <div className="text-[12px] text-[#6B7A87] dark:text-[#8DA2B5] truncate">
                        {supplier.cipaNumber ? `CIPA ${supplier.cipaNumber}` : 'Account active'}
                        {!supplier.emailVerified ? ' · Email unverified' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveNav('profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#10212E] dark:text-white transition-colors cursor-pointer"
                    >
                      Company profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveNav('vault');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#10212E] dark:text-white transition-colors cursor-pointer"
                    >
                      Document vault
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
            )}

            {/* Buyer or Admin Return-to-Console Action (when viewing public/auth routes) */}
            {isAuthenticated && (role === 'buyer' || role === 'admin') && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveNav(role === 'admin' ? 'admin-dashboard' : 'buyer-dashboard')}
                  className="px-3.5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-medium rounded-[6px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {role === 'admin' ? 'Admin console' : 'Buyer console'}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-2 text-[14px] font-medium text-[#C2412D] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[6px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Sign out
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            {(navItems.length > 0 || !isAuthenticated || role === 'public') && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] cursor-pointer shrink-0"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" strokeWidth={1.75} />
                ) : (
                  <Menu className="w-5 h-5" strokeWidth={1.75} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] px-4 py-4 space-y-2">
            {navItems.map((item) => {
              const isActive =
                activeNav === item.id ||
                (item.id === 'sharing' && activeNav === 'consent') ||
                (item.id === 'dashboard' && activeNav === 'supplier-dashboard');
              const isLocked =
                (item.id === 'my-applications' || item.id === 'sharing') &&
                role === 'supplier' &&
                !isProfileComplete;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-[6px] text-[15px] font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] font-semibold'
                      : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#132635]'
                  }`}
                >
                  <span>{item.label}</span>
                  {isLocked && (
                    <span className="text-[12px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{supplierCompleteness.score}%</span>
                    </span>
                  )}
                </button>
              );
            })}

            {(!isAuthenticated || role === 'public') && (
              <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => openAuth('supplier', 'signin')}
                  className="w-full px-3.5 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white rounded-[6px] text-[14px] font-medium cursor-pointer"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('supplier', 'signup')}
                  className="w-full px-3.5 py-2.5 bg-[#1F5F99] text-white rounded-[6px] text-[14px] font-medium cursor-pointer"
                >
                  Register company
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
    </>
  );
};
