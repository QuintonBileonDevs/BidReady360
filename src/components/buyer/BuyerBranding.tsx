import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';

export const BuyerBranding: React.FC = () => {
  const { profileSummary, registeredBuyerOrgName, setBuyerBranding, refreshCalls } = useApp();
  const fallbackOrgName = profileSummary?.supplierOrOrgName || registeredBuyerOrgName || 'Procuring Organization';

  const [orgName, setOrgName] = useState(fallbackOrgName);
  const [subtext, setSubtext] = useState('Procurement & Asset Disposal Board');
  const [primaryColor, setPrimaryColor] = useState('#1F5F99');
  const [customDomain, setCustomDomain] = useState('');
  const [welcomeNotice, setWelcomeNotice] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadBranding = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await buyerApi.getBranding();
      if (data) {
        setOrgName(data.name || fallbackOrgName);
        setSubtext(data.brandSubtext || 'Procurement & Asset Disposal Board');
        setPrimaryColor(data.brandPrimaryColor || '#1F5F99');
        setCustomDomain(data.customDomain || '');
        setWelcomeNotice(data.welcomeNotice || '');
        setContactEmail(data.contactEmail || '');
        setContactPhone(data.contactPhone || '');
        setBuyerBranding(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load organization branding settings.');
    } finally {
      setIsLoading(false);
    }
  }, [fallbackOrgName]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const initials =
    orgName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'PO';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSavedSuccess(false);
    try {
      const updated = await buyerApi.updateBranding({
        name: orgName.trim(),
        brandSubtext: subtext.trim(),
        brandPrimaryColor: primaryColor,
        customDomain: customDomain.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        welcomeNotice: welcomeNotice.trim(),
      });
      if (updated) {
        setOrgName(updated.name);
        setSubtext(updated.brandSubtext);
        setPrimaryColor(updated.brandPrimaryColor);
        setCustomDomain(updated.customDomain || '');
        setWelcomeNotice(updated.welcomeNotice || '');
        setBuyerBranding(updated);
        void refreshCalls();
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save branding changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Organization branding &amp; public profile
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Customize your public procurement portal header, accent color, and supplier onboarding notice.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-[12px] text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>Branding settings persisted to your organization profile and logged to the audit trail.</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-10 flex items-center justify-center gap-2.5 text-[#6B7A87]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99]" />
          <span className="text-[14px]">Loading organization branding profile...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleSave}
            className="lg:col-span-7 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4 text-[14px]"
          >
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Entity details
            </h2>

            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">Official entity name *</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">Subheading / Unit designation</label>
              <input
                type="text"
                value={subtext}
                onChange={(e) => setSubtext(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">Primary theme accent</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-[6px] cursor-pointer border border-[#D5E0EA]"
                  />
                  <span className="font-mono text-[13px] text-[#43525F] dark:text-[#B2C3D2]">{primaryColor}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">Custom portal domain (optional)</label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="tenders.entity.gov.bw"
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">Procurement contact email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="procurement@entity.gov.bw"
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">Contact telephone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+267 365 7400"
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">Supplier portal welcome notice</label>
              <textarea
                rows={3}
                value={welcomeNotice}
                onChange={(e) => setWelcomeNotice(e.target.value)}
                placeholder={`Welcome to the official electronic procurement portal for ${orgName}.`}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving...' : 'Save branding changes'}</span>
            </button>
          </form>

          {/* Live Preview Card */}
          <div className="lg:col-span-5 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
            <span className="text-[12px] font-semibold text-[#6B7A87] uppercase tracking-wider block">
              Public portal preview
            </span>

            <div className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#10212E] space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-[6px] text-white flex items-center justify-center font-bold text-[14px]"
                  style={{ backgroundColor: primaryColor }}
                >
                  {initials}
                </div>
                <div>
                  <h4 className="font-semibold text-[15px] text-[#10212E] dark:text-white">
                    {orgName}
                  </h4>
                  <span className="text-[12px] text-[#6B7A87]">{subtext}</span>
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-[#132635] rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                {welcomeNotice.trim() || `Welcome to the official electronic procurement portal for ${orgName}.`}
              </div>
              {customDomain && (
                <div className="text-[11px] font-mono text-[#6B7A87]">
                  Portal URL: https://{customDomain}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
