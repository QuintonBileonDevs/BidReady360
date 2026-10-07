import React, { useState, useEffect } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DigitCodeInput } from './DigitCodeInput';
import {
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  GraduationCap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface OrgBrandedLoginProps {
  onNavigate: (route: string) => void;
}

interface BrandedOrg {
  slug: string;
  name: string;
  type: string;
  badgeCode: string;
  accentColor: string;
  domain: string;
}

export const OrgBrandedLogin: React.FC<OrgBrandedLoginProps> = ({ onNavigate }) => {
  const { currentOrgSlug, setCurrentOrgSlug, setRole, setActiveNav, loginSuccess } = useApp();

  const brandedOrgs: Record<string, BrandedOrg> = {
    'org-grc': {
      slug: 'org-grc',
      name: 'Gaborone Regional Council',
      type: 'Local authority',
      badgeCode: 'GRC',
      accentColor: '#1F5F99',
      domain: 'grc.gov.bw',
    },
    'org-nta': {
      slug: 'org-nta',
      name: 'National Training Agency',
      type: 'Parastatal agency',
      badgeCode: 'NTA',
      accentColor: '#0D9488',
      domain: 'nta.gov.bw',
    },
  };

  const activeOrg = brandedOrgs[currentOrgSlug] || brandedOrgs['org-grc'];

  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [mfaCountdown, setMfaCountdown] = useState(60);

  useEffect(() => {
    if (step === 'mfa' && mfaCountdown > 0) {
      const timer = setInterval(() => setMfaCountdown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [step, mfaCountdown]);

  const handleOrgSwitch = (slug: string) => {
    setCurrentOrgSlug(slug);
    const newOrg = brandedOrgs[slug];
    setEmail(`officer@${newOrg.domain}`);
    setStep('credentials');
  };

  const handleBlur = (field: 'email' | 'password') => {
    const newErrors = { ...errors };
    if (field === 'email') {
      if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
        newErrors.email = `Enter an official work email like name@${activeOrg.domain}`;
      } else {
        delete newErrors.email;
      }
    }
    if (field === 'password') {
      if (!password) {
        newErrors.password = 'Enter your account password.';
      } else {
        delete newErrors.password;
      }
    }
    setErrors(newErrors);
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = `Enter an official work email like name@${activeOrg.domain}`;
    }
    if (!password) {
      newErrors.password = 'Enter your account password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep('mfa');
      setMfaCountdown(60);
    }, 600);
  };

  const handleMfaComplete = (code: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      loginSuccess(
        {
          user: {
            id: `officer-${Date.now()}`,
            email: email || `officer@${activeOrg.domain}`,
            fullName: 'Procurement Officer',
            isPlatformAdmin: false,
          },
          activeTenant: {
            tenantType: 'organization',
            tenantId: activeOrg.slug,
            tenantName: activeOrg.name,
          },
        },
        'buyer'
      );
    }, 700);
  };

  const customLogoNode = (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-[8px] text-white flex items-center justify-center font-heading font-bold text-[15px]"
        style={{ backgroundColor: activeOrg.accentColor }}
      >
        {activeOrg.badgeCode === 'NTA' ? (
          <GraduationCap className="w-5 h-5 text-white" strokeWidth={1.5} />
        ) : (
          <Building2 className="w-5 h-5 text-white" strokeWidth={1.5} />
        )}
      </div>
      <div>
        <h2 className="font-heading font-semibold text-[18px] text-white leading-tight">
          {activeOrg.name}
        </h2>
        <span className="text-[13px] text-[#B2C3D2]">{activeOrg.type}</span>
      </div>
    </div>
  );

  return (
    <AuthLayout
      leftMessage={`Sign in to ${activeOrg.name}`}
      tagline={`Official electronic procurement gateway for ${activeOrg.name}. Sign in to access your organization's calls, applications, and bids.`}
      customLogo={customLogoNode}
      organizationName={activeOrg.name}
      showPoweredBy={true}
    >
      <div className="space-y-6">
        {step === 'credentials' ? (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: activeOrg.accentColor }}
                />
                <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
                  {activeOrg.name}
                </h2>
              </div>
              <p className="text-[14px] text-[#6B7A87]">
                Sign in to manage your organization's tenders and evaluation scorecards.
              </p>
            </div>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <Input
                label="Official work email *"
                type="email"
                placeholder={`name@${activeOrg.domain}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                error={errors.email}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="username"
              />

              <div className="space-y-1">
                <Input
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  error={errors.password}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="focus:outline-none hover:text-[#10212E] dark:hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center justify-between text-[14px] pt-1">
                <span className="text-[#6B7A87]">Two-step verification required</span>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                isLoading={isLoading}
                style={{ backgroundColor: activeOrg.accentColor, borderColor: activeOrg.accentColor }}
                rightIcon={<ArrowRight />}
              >
                Continue to verification code
              </Button>
            </form>
          </>
        ) : (
          /* STEP 2: 6-DIGIT CODE INPUT */
          <div className="space-y-6 text-center">
            <div
              className="w-12 h-12 rounded-[8px] text-white flex items-center justify-center mx-auto"
              style={{ backgroundColor: activeOrg.accentColor }}
            >
              <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
                Enter verification code
              </h2>
              <p className="text-[14px] text-[#6B7A87] max-w-sm mx-auto">
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below to sign in.
              </p>
            </div>

            <div className="py-2">
              <DigitCodeInput onComplete={handleMfaComplete} disabled={isLoading} />
            </div>

            <div className="pt-2 text-[14px] text-[#6B7A87] space-y-3">
              <div>
                Resend code in{' '}
                <span className="font-semibold tabular-nums" style={{ color: activeOrg.accentColor }}>
                  {mfaCountdown}s
                </span>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('credentials')}
                  leftIcon={<ArrowLeft />}
                >
                  Change email
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleMfaComplete('123456')}
                  isLoading={isLoading}
                >
                  Simulate code entry
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
