import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { PasswordRulesCheck } from './PasswordRulesCheck';
import { authApi } from '../../services/api';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface SupplierSignupProps {
  onNavigate: (route: string) => void;
}

export const SupplierSignup: React.FC<SupplierSignupProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav, updateSupplierProfile, loginSuccess } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  // Step 1: Account fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+267 ');
  const [password, setPassword] = useState('');

  // Step 2: Company fields
  const [legalName, setLegalName] = useState('');
  const [cipaNumber, setCipaNumber] = useState('');
  const [companyType, setCompanyType] = useState('Private Limited Company ((Pty) Ltd)');
  const [city, setCity] = useState('Gaborone');

  // Step 3: Terms
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Restore draft on mount so user can resume where they left off
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('bidready_signup_draft');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.email) setEmail(p.email);
        if (p.fullName) setFullName(p.fullName);
        if (p.phone) setPhone(p.phone);
        if (p.legalName) setLegalName(p.legalName);
        if (p.cipaNumber) setCipaNumber(p.cipaNumber);
        if (p.companyType) setCompanyType(p.companyType);
        if (p.city) setCity(p.city);
        if (p.step && (p.step === 2 || p.step === 3)) {
          setStep(p.step);
          setDraftNotice(`Resuming registration at Step ${p.step}. Your previously saved details have been restored.`);
        }
      }
    } catch {}
  }, []);

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
        // Check if an existing registration progress exists for this email
        try {
          const prog = await authApi.getSupplierProgress(cleanEmail);
          if (prog && prog.found) {
            if (prog.fullName && !fullName) setFullName(prog.fullName);
            if (prog.phone && (!phone || phone === '+267 ')) setPhone(prog.phone);
            if (prog.legalName && !legalName) setLegalName(prog.legalName);
            if (prog.cipaNumber && !cipaNumber) setCipaNumber(prog.cipaNumber);
            if (prog.companyType) setCompanyType(prog.companyType);
            if (prog.city) setCity(prog.city);
            setDraftNotice(`Existing progress found for ${cleanEmail}. We've pre-filled your details.`);
            if (prog.currentStep && prog.currentStep > step) {
              setStep(prog.currentStep as 1 | 2 | 3);
            }
          }
        } catch {}
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
      if (password && password.length < 10) {
        newErrors.password = 'Enter a password with at least 10 characters.';
      } else {
        delete newErrors.password;
      }
    }
    if (field === 'legalName') {
      if (!legalName.trim()) newErrors.legalName = 'Enter your registered company legal name.';
      else delete newErrors.legalName;
    }
    if (field === 'cipaNumber') {
      if (!cipaNumber.trim()) newErrors.cipaNumber = 'Enter your registration number like BW00001234567';
      else delete newErrors.cipaNumber;
    }
    setErrors(newErrors);
  };

  const validateStep1 = () => {
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

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!legalName.trim()) newErrors.legalName = 'Enter your registered company legal name.';
    if (!cipaNumber.trim()) newErrors.cipaNumber = 'Enter your registration number like BW00001234567';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // STEP 1 & STEP 2: Save to PostgreSQL immediately so progress is never lost
  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      setIsLoading(true);
      setErrors({});
      try {
        const res = await authApi.saveSupplierStep({
          step: 1,
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          password,
        });

        // Store draft in localStorage for offline & reload recovery
        try {
          localStorage.setItem(
            'bidready_signup_draft',
            JSON.stringify({
              step: 2,
              email: email.trim().toLowerCase(),
              fullName: fullName.trim(),
              phone: phone.trim(),
              legalName,
              cipaNumber,
              companyType,
              city,
            })
          );
        } catch {}

        // Auto-populate supplier in AppContext so company details appear pre-filled
        updateSupplierProfile({
          id: res.supplier?.id,
          legalName: res.supplier?.legalName || legalName || `${fullName.trim()}'s Enterprise`,
          tradingName: res.supplier?.tradingName || legalName,
          email: email.trim().toLowerCase(),
          primaryPhone: phone.trim(),
          directors: [
            {
              id: 'dir-owner',
              fullName: fullName.trim(),
              nationalIdOrPassport: '',
              nationality: 'Motswana',
              isCitizen: true,
              shareholdingPercentage: 100,
              role: 'Director',
            },
          ],
        });

        setDraftNotice('Step 1 saved to database! Your account is created. Proceed with company details.');
        setStep(2);
      } catch (err: any) {
        console.error('[SUPPLIER SIGNUP STEP 1 ERROR]', err);
        const errMsg = err.message || 'Could not save account details.';
        setErrors({ general: errMsg });
      } finally {
        setIsLoading(false);
      }
    } else if (step === 2 && validateStep2()) {
      setIsLoading(true);
      setErrors({});
      try {
        const res = await authApi.saveSupplierStep({
          step: 2,
          email: email.trim().toLowerCase(),
          legalName: legalName.trim(),
          cipaUin: cipaNumber.trim().toUpperCase(),
          companyType,
          city,
        });

        try {
          localStorage.setItem(
            'bidready_signup_draft',
            JSON.stringify({
              step: 3,
              email: email.trim().toLowerCase(),
              fullName: fullName.trim(),
              phone: phone.trim(),
              legalName: legalName.trim(),
              cipaNumber: cipaNumber.trim().toUpperCase(),
              companyType,
              city,
            })
          );
        } catch {}

        // Pre-fill company profile with registered details
        updateSupplierProfile({
          id: res.supplier?.id,
          legalName: legalName.trim(),
          tradingName: legalName.trim(),
          cipaNumber: cipaNumber.trim().toUpperCase(),
          companyType,
          city,
          email: email.trim().toLowerCase(),
          primaryPhone: phone.trim(),
        });

        setDraftNotice('Step 2 saved to database! Company details recorded. Review and confirm.');
        setStep(3);
      } catch (err: any) {
        console.error('[SUPPLIER SIGNUP STEP 2 ERROR]', err);
        const errMsg = err.message || 'Could not save company details.';
        if (err.field === 'cipaNumber' || errMsg.toLowerCase().includes('cipa')) {
          setErrors({ cipaNumber: errMsg });
        } else {
          setErrors({ general: errMsg });
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // STEP 3: Complete terms agreement & final registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms || !agreedToPrivacy) {
      setErrors({ terms: 'You must agree to the Terms and Privacy notice to continue.' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await authApi.saveSupplierStep({
        step: 3,
        email: email.trim().toLowerCase(),
        agreedToTerms,
        agreedToPrivacy,
      });

      // Clear draft storage
      try {
        localStorage.removeItem('bidready_signup_draft');
      } catch {}

      // Ensure profile details are marked as saved
      updateSupplierProfile({
        legalName: legalName.trim(),
        tradingName: legalName.trim(),
        cipaNumber: cipaNumber.trim().toUpperCase(),
        companyType,
        city,
        email: email.trim().toLowerCase(),
        primaryPhone: phone.trim(),
        detailsSaved: true,
      });

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
        {/* Step Progress Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
              Step {step} of 3
            </span>
            <span className="text-[#6B7A87]">
              {step === 1 ? 'Your account' : step === 2 ? 'Your company' : 'Review and agree'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 h-1.5">
            <div className={`rounded-full transition-all ${step >= 1 ? 'bg-[#1F5F99]' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`rounded-full transition-all ${step >= 2 ? 'bg-[#1F5F99]' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`rounded-full transition-all ${step >= 3 ? 'bg-[#1F5F99]' : 'bg-slate-200 dark:bg-slate-800'}`} />
          </div>

          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight pt-1">
            {step === 1 && 'Your account'}
            {step === 2 && 'Your company'}
            {step === 3 && 'Review and agree'}
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            {step === 1 && 'Enter your contact credentials to manage your company bids and document vault.'}
            {step === 2 && 'Provide company registration details as recorded with CIPA Botswana.'}
            {step === 3 && 'Confirm your details and accept the platform terms.'}
          </p>
        </div>

        {/* STEP 1: Your Account */}
        {step === 1 && (
          <div className="space-y-4">
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
                placeholder="At least 10 characters"
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
                autoComplete="new-password"
              />
              <PasswordRulesCheck password={password} />
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              onClick={handleNext}
              rightIcon={<ArrowRight />}
            >
              Continue to company details
            </Button>
          </div>
        )}

        {/* STEP 2: Your Company */}
        {step === 2 && (
          <div className="space-y-4">
            <Input
              label="Company legal name *"
              placeholder="e.g. Tsodilo Civil Engineering (Pty) Ltd"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              onBlur={() => handleBlur('legalName')}
              error={errors.legalName}
              leftIcon={<Building2 className="w-4 h-4" />}
            />

            <Input
              label="Company registration number *"
              placeholder="e.g. BW00001234567"
              value={cipaNumber}
              onChange={(e) => setCipaNumber(e.target.value)}
              onBlur={() => handleBlur('cipaNumber')}
              error={errors.cipaNumber}
            />

            <Select
              label="Company type *"
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
            >
              <option value="Private Limited Company ((Pty) Ltd)">Private Limited Company ((Pty) Ltd)</option>
              <option value="Close Corporation (CC)">Close Corporation (CC)</option>
              <option value="Sole Proprietorship">Sole Proprietorship</option>
              <option value="Partnership / Joint Venture">Partnership / Joint Venture</option>
              <option value="Public Limited Company (PLC)">Public Limited Company (PLC)</option>
            </Select>

            <Select
              label="City *"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="Gaborone">Gaborone</option>
              <option value="Francistown">Francistown</option>
              <option value="Maun">Maun</option>
              <option value="Palapye">Palapye</option>
              <option value="Jwaneng">Jwaneng</option>
              <option value="Selebi-Phikwe">Selebi-Phikwe</option>
              <option value="Kasane">Kasane</option>
            </Select>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setStep(1)}
                leftIcon={<ArrowLeft />}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleNext}
                rightIcon={<ArrowRight />}
              >
                Continue to review
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Review and Agree */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Summary of what was entered */}
            <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3 text-[14px]">
              <span className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white block border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2">
                Summary of your details
              </span>

              <div className="space-y-1.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Account name:</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Email:</span>
                  <span className="text-[#10212E] dark:text-white">{email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Mobile:</span>
                  <span className="text-[#10212E] dark:text-white">{phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Company:</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{legalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Registration number:</span>
                  <span className="text-[#10212E] dark:text-white">{cipaNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">Company type:</span>
                  <span className="text-[#10212E] dark:text-white">{companyType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A87]">City:</span>
                  <span className="text-[#10212E] dark:text-white">{city}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <Checkbox
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                label="I agree to the Terms of Service"
                description="Your account information and bids will be managed in compliance with platform rules."
              />

              <Checkbox
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                label="I agree to the Privacy notice"
                description="Your documents are only visible to procuring entities that you explicitly authorize."
              />

              {errors.terms && (
                <p className="text-[14px] text-[#C2412D] font-medium">{errors.terms}</p>
              )}

              {errors.general && (
                <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[14px] text-[#C2412D] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errors.general}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setStep(2)}
                leftIcon={<ArrowLeft />}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                isLoading={isLoading}
                rightIcon={<CheckCircle2 />}
              >
                Create supplier account
              </Button>
            </div>
          </form>
        )}

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
