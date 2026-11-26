import React, { useState, useEffect, useCallback } from 'react';
import { Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { buyerApi } from '../../services/api';

export const BuyerSettings: React.FC = () => {
  const [minDays, setMinDays] = useState('21');
  const [currency, setCurrency] = useState('BWP');
  const [closingTime, setClosingTime] = useState('14:00');
  const [cutoffDays, setCutoffDays] = useState('7');
  const [requireGazetteNotice, setRequireGazetteNotice] = useState(true);
  const [autoDeadlineReminders, setAutoDeadlineReminders] = useState(true);
  const [requireMfaEvaluators, setRequireMfaEvaluators] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await buyerApi.getSettings();
      if (data) {
        setMinDays(String(data.minRfpAdvertisingDays ?? 21));
        setCurrency(data.defaultCurrency || 'BWP');
        setClosingTime(data.defaultClosingTimeCat || '14:00');
        setCutoffDays(String(data.clarificationCutoffDays ?? 7));
        setRequireGazetteNotice(Boolean(data.requireGazetteNotice));
        setAutoDeadlineReminders(Boolean(data.autoDeadlineReminders));
        setRequireMfaEvaluators(Boolean(data.requireMfaEvaluators));
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load organization procurement settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await buyerApi.updateSettings({
        minRfpAdvertisingDays: Number(minDays),
        defaultCurrency: currency,
        defaultClosingTimeCat: closingTime,
        clarificationCutoffDays: Number(cutoffDays),
        requireGazetteNotice,
        autoDeadlineReminders,
        requireMfaEvaluators,
      });
      if (updated) {
        setMinDays(String(updated.minRfpAdvertisingDays));
        setCurrency(updated.defaultCurrency);
        setClosingTime(updated.defaultClosingTimeCat);
        setCutoffDays(String(updated.clarificationCutoffDays));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save organization settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Procurement policies &amp; council settings
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Configure minimum tender advertising durations, clarification cut-offs, and automated reminder controls.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-[12px] text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>Organization procurement parameters saved to PostgreSQL and logged to the audit trail.</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-10 flex items-center justify-center gap-2.5 text-[#6B7A87]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99]" />
          <span className="text-[14px]">Loading procurement settings...</span>
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-5 max-w-2xl text-[14px]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">
                Minimum advertising period for competitive RFPs
              </label>
              <select
                value={minDays}
                onChange={(e) => setMinDays(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              >
                <option value="14">14 Days (Fast-track EOI)</option>
                <option value="21">21 Days (Public Procurement Standard)</option>
                <option value="30">30 Days (Major Infrastructure Works)</option>
                <option value="45">45 Days (International Competitive Bidding)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">
                Clarification cut-off (days before closing)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={cutoffDays}
                onChange={(e) => setCutoffDays(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">Default closing time (CAT)</label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">Default currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              >
                <option value="BWP">Botswana Pula (BWP)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="ZAR">South African Rand (ZAR)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireGazetteNotice}
                onChange={(e) => setRequireGazetteNotice(e.target.checked)}
                className="mt-1 rounded border-[#D5E0EA]"
              />
              <span>
                <strong className="block text-[#10212E] dark:text-white">Require statutory gazette notice tracking</strong>
                <span className="text-[12px] text-[#6B7A87]">
                  Enforces public notice reference verification before publishing open RFP tenders.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoDeadlineReminders}
                onChange={(e) => setAutoDeadlineReminders(e.target.checked)}
                className="mt-1 rounded border-[#D5E0EA]"
              />
              <span>
                <strong className="block text-[#10212E] dark:text-white">Automated closing &amp; addendum reminders</strong>
                <span className="text-[12px] text-[#6B7A87]">
                  Dispatches template-backed notifications to invited and applicant suppliers before deadlines.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireMfaEvaluators}
                onChange={(e) => setRequireMfaEvaluators(e.target.checked)}
                className="mt-1 rounded border-[#D5E0EA]"
              />
              <span>
                <strong className="block text-[#10212E] dark:text-white">Enforce MFA for evaluation &amp; bid opening officers</strong>
                <span className="text-[12px] text-[#6B7A87]">
                  Requires two-factor authentication for officers conducting sealed bid openings or scoring.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : 'Save settings'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
