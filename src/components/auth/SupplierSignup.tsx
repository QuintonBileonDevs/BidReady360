import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PasswordRulesCheck } from './PasswordRulesCheck';
import { authApi } from '../../services/api';
import {
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface SupplierSignupProps {
  onNavigate: (route: string) => void;
}

export const SupplierSignup: React.FC<SupplierSignupProps> = ({ onNavigate }) => {
  const { setRole, updateSupplierProfile } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+267 ');
  const [password, setPassword] = useState('');

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBlur = async (field: string) => {
    const newErrors = { ...errors };
    if (field === 'fullName') {
      if (!fullName.trim()) newErrors.fullName = 'Enter your full name.';
      else delete newErrors.fullName;
    }
    if (field === 'email') {
      const cleanEmail = email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        newErrors.email = 'Enter a valid email address (e.g. name@example.com).';
      } else {
        delete newErrors.email;
      }
    }
    if (field === 'phone') {
      if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
        newErrors.phone = 'Enter a valid mobile number like +267 71234567';
      } else {
        delete newErrors.phone;
      }
    }
    if (field === 'password') {
      if (password && password.length < 8) {
        newErrors.password = 'Enter a password with at least 8 characters.';
      } else {
        delete newErrors.password;
      }
    }
    setErrors(newErrors);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Enter your full name.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Enter a valid email address (e.g. name@example.com).';
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      newErrors.phone = 'Enter a valid mobile number like +267 71234567';
    }
    if (!password || password.length < 8) {
      newErrors.password = 'Enter a password with at least 8 characters.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await authApi.saveSupplierStep({
        step: 1,
        email: cleanEmail,
        fullName: fullName.trim(),
        phone: phone.trim(),
        password,
      });

      // Automatically complete registration terms acceptance
      await authApi.saveSupplierStep({
        step: 3,
        email: cleanEmail,
        agreedToTerms: true,
        agreedToPrivacy: true,
      });

      updateSupplierProfile({
        id: res.supplier?.id,
        legalName: res.supplier?.legalName || `${fullName.trim()}'s Enterprise`,
        email: cleanEmail,
        primaryPhone: phone.trim(),
        detailsSaved: true,
      });

      setToastNotice('Account created successfully! Welcome to BidReady360.');
      setRole('supplier', 'profile');
      onNavigate('supplier-welcome');
    } catch (err: any) {
      console.error('[SUPPLIER SIGNUP ERROR]', err);
      const errMsg = err.message || 'Registration failed. Please check your details.';
      setErrors({ general: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      leftMessage="Register once. Bid anywhere."
      tagline="Create your supplier account once to manage documents and bid for tenders across all participating organizations in Botswana."
    >
      <div className="space-y-6">
        {toastNotice && (
          <div className="p-3.5 rounded-[8px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-[14px] text-emerald-800 dark:text-emerald-200 font-medium flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{toastNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastNotice(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 text-xs font-semibold px-1.5 py-0.5 rounded cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full name *"
            placeholder="e.g. Neo Morapedi"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => handleBlur('fullName')}
            error={errors.fullName}
            leftIcon={<User className="w-4 h-4" />}
            autoComplete="name"
          />

          <div>
            <Input
              label="Email address *"
              type="email"
              placeholder="e.g. name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur('email')}
              error={errors.email}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
            />
            {!errors.email && (
              <p className="text-[12px] text-[#6B7A87] dark:text-[#8FA2B2] mt-1.5 leading-snug">
                Use an email you check regularly. Company and personal addresses are both fine.
              </p>
            )}
          </div>

          <Input
            label="Mobile number *"
            type="tel"
            placeholder="+267 71234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => handleBlur('phone')}
            error={errors.phone}
            leftIcon={<Phone className="w-4 h-4" />}
            autoComplete="tel"
          />

          <div className="space-y-1">
            <Input
              label="Password *"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              error={errors.password}
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="focus:outline-none hover:text-[#10212E] dark:hover:text-white cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              autoComplete="new-password"
            />
            <PasswordRulesCheck password={password} />
          </div>

          {errors.general && (
            <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[14px] text-[#C2412D] font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-3"
            isLoading={isLoading}
            rightIcon={<CheckCircle2 />}
          >
            Create supplier account
          </Button>
        </form>

        {/* Bottom Switcher Link */}
        <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-center text-[14px] text-[#6B7A87]">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('supplier-login')}
            className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
          >
            Sign in
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
