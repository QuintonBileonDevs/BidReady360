import React from 'react';
import { AuthScreenRouter, AuthSubRoute } from './AuthScreenRouter';

interface AuthScreenProps {
  initialMode?: 'signin' | 'signup';
  initialTenant?: 'supplier' | 'buyer' | 'auditor';
  initialRoute?: AuthSubRoute;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode = 'signin',
  initialTenant = 'supplier',
  initialRoute,
}) => {
  const defaultRoute: AuthSubRoute =
    initialRoute ||
    (initialTenant === 'buyer'
      ? initialMode === 'signup'
        ? 'buyer-signup'
        : 'buyer-login'
      : initialMode === 'signup'
      ? 'supplier-signup'
      : 'supplier-login');

  return <AuthScreenRouter initialRoute={defaultRoute} />;
};
