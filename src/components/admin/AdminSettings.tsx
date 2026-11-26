import React, { useState, useEffect, useCallback } from 'react';
import { Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { adminApi } from '../../services/api';
import { ThemeSwitcher } from '../common/ThemeSwitcher';

export const AdminSettings: React.FC = () => {
  const [cipaEndpoint, setCipaEndpoint] = useState('');
  const [bursEndpoint, setBursEndpoint] = useState('');
  const [retentionYears, setRetentionYears] = useState('7');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getSettings();
      setCipaEndpoint(data.cipaEndpoint);
      setBursEndpoint(data.bursEndpoint);
      setRetentionYears(data.retentionYears);
    } catch (err: any) {
      setError(err?.message || 'Unable to load platform configuration.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSavedSuccess(false);
    try {
      const updated = await adminApi.updateSettings({
        cipaEndpoint: cipaEndpoint.trim(),
        bursEndpoint: bursEndpoint.trim(),
        retentionYears,
      });
      setCipaEndpoint(updated.cipaEndpoint);
      setBursEndpoint(updated.bursEndpoint);
      setRetentionYears(updated.retentionYears);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save platform settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            System &amp; regulatory settings
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Configure statutory gateway endpoints and record retention rules persisted in PostgreSQL.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[12px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] dark:bg-[#2F8F5B]/20 text-[#065F46] dark:text-[#86EFAC] border border-[#A7F3D0] dark:border-[#2F8F5B]/40 flex items-center gap-2 text-[14px]">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] dark:text-[#86EFAC]" />
          <span>System configuration parameters saved to PostgreSQL and logged to the audit trail.</span>
        </div>
      )}

      <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Display appearance
          </h2>
          <p className="text-[14px] text-[#43525F] dark:text-[#D3E3F2]">
            Choose Light, System, or Dark mode for this browser. System follows your operating system setting automatically.
          </p>
        </div>
        <ThemeSwitcher variant="segmented" className="shrink-0" />
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-12 flex items-center justify-center gap-2 text-[#6B7A87] dark:text-[#9CB4C9]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
          <span>Loading system settings...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4 text-[14px]">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Statutory integration endpoints
            </h2>

            <div className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">
                  CIPA Companies Registry Gateway URL
                </label>
                <input
                  type="url"
                  required
                  value={cipaEndpoint}
                  onChange={(e) => setCipaEndpoint(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">
                  BURS e-Tax Real-time Verification API
                </label>
                <input
                  type="url"
                  required
                  value={bursEndpoint}
                  onChange={(e) => setBursEndpoint(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4 text-[14px]">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Data retention &amp; compliance policy
            </h2>

            <div className="space-y-4 max-w-xl">
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">
                  Tender dossier statutory retention period
                </label>
                <select
                  value={retentionYears}
                  onChange={(e) => setRetentionYears(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                >
                  <option value="7">7 Years (Public Procurement Act Standard)</option>
                  <option value="10">10 Years (Extended Infrastructure Works)</option>
                  <option value="15">15 Years (Permanent Statutory Archive)</option>
                </select>
                <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
                  Sealed bid hash certificates and evaluation matrices remain immutable for this duration.
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save configuration'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
