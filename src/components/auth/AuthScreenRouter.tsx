import React, { useState } from 'react';
import { SupplierSignup } from './SupplierSignup';
import { SupplierLogin } from './SupplierLogin';
import { SupplierVerifyEmail } from './SupplierVerifyEmail';
import { SupplierWelcome } from './SupplierWelcome';
import { BuyerSignup } from './BuyerSignup';
import { BuyerPendingApproval } from './BuyerPendingApproval';
import { BuyerLogin } from './BuyerLogin';
import { OrgBrandedLogin } from './OrgBrandedLogin';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { ForgotPassword } from './ForgotPassword';
import { ResetPassword } from './ResetPassword';
import { AcceptInvitation } from './AcceptInvitation';
import { ChooseWorkspace } from './ChooseWorkspace';
import { SessionExpired } from './SessionExpired';
import { AccountLocked } from './AccountLocked';

export type AuthSubRoute =
  | 'supplier-login'
  | 'supplier-signup'
  | 'supplier-verify-email'
  | 'supplier-welcome'
  | 'buyer-login'
  | 'buyer-signup'
  | 'buyer-pending'
  | 'org-login'
  | 'admin-login'
  | 'admin-dashboard'
  | 'forgot-password'
  | 'reset-password'
  | 'accept-invite'
  | 'choose-workspace'
  | 'session-expired'
  | 'account-locked';

interface AuthScreenRouterProps {
  initialRoute?: AuthSubRoute;
}

export const AuthScreenRouter: React.FC<AuthScreenRouterProps> = ({
  initialRoute = 'supplier-login',
}) => {
  const [currentSubRoute, setCurrentSubRoute] = useState<AuthSubRoute>(initialRoute);

  const handleNavigate = (route: string) => {
    setCurrentSubRoute(route as AuthSubRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderActiveScreen = () => {
    switch (currentSubRoute) {
      case 'supplier-signup':
        return <SupplierSignup onNavigate={handleNavigate} />;
      case 'supplier-login':
        return <SupplierLogin onNavigate={handleNavigate} />;
      case 'supplier-verify-email':
        return <SupplierVerifyEmail onNavigate={handleNavigate} />;
      case 'supplier-welcome':
        return <SupplierWelcome onNavigate={handleNavigate} />;
      case 'buyer-signup':
        return <BuyerSignup onNavigate={handleNavigate} />;
      case 'buyer-pending':
        return <BuyerPendingApproval onNavigate={handleNavigate} />;
      case 'buyer-login':
        return <BuyerLogin onNavigate={handleNavigate} />;
      case 'org-login':
        return <OrgBrandedLogin onNavigate={handleNavigate} />;
      case 'admin-login':
        return <AdminLogin onNavigate={handleNavigate} />;
      case 'admin-dashboard':
        return <AdminDashboard />;
      case 'forgot-password':
        return <ForgotPassword onNavigate={handleNavigate} />;
      case 'reset-password':
        return <ResetPassword onNavigate={handleNavigate} />;
      case 'accept-invite':
        return <AcceptInvitation onNavigate={handleNavigate} />;
      case 'choose-workspace':
        return <ChooseWorkspace onNavigate={handleNavigate} />;
      case 'session-expired':
        return <SessionExpired onNavigate={handleNavigate} />;
      case 'account-locked':
        return <AccountLocked onNavigate={handleNavigate} />;
      default:
        return <SupplierLogin onNavigate={handleNavigate} />;
    }
  };

  return <div className="min-h-screen">{renderActiveScreen()}</div>;
};
