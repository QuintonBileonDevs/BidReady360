import React, { useState } from 'react';
import { Save, CheckCircle2, Shield, Database } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [cipaEndpoint, setCipaEndpoint] = useState('https://api.cipa.gov.bw/v2/registry');
  const [bursEndpoint, setBursEndpoint] = useState('https://etax.burs.org.bw/gateway/api');
  const [retentionYears, setRetentionYears] = useState('7');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            System & regulatory settings
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Configure statutory gateway endpoints, encryption parameters, and record retention rules.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center gap-2 text-[14px]">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>System configuration parameters saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4 text-[14px]">
          <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Statutory integration endpoints
          </h2>

          <div className="space-y-4 max-w-xl">
            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">
                CIPA Companies Registry Gateway URL
              </label>
              <input
                type="text"
                value={cipaEndpoint}
                onChange={(e) => setCipaEndpoint(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">
                BURS e-Tax Real-time Verification API
              </label>
              <input
                type="text"
                value={bursEndpoint}
                onChange={(e) => setBursEndpoint(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4 text-[14px]">
          <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Data retention & compliance policy
          </h2>

          <div className="space-y-4 max-w-xl">
            <div className="space-y-1">
              <label className="font-medium text-[#10212E] dark:text-white block">
                Tender dossier statutory retention period
              </label>
              <select
                value={retentionYears}
                onChange={(e) => setRetentionYears(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px]"
              >
                <option value="7">7 Years (Public Procurement Act Standard)</option>
                <option value="10">10 Years (Extended Infrastructure Works)</option>
                <option value="15">15 Years (Permanent Statutory Archive)</option>
              </select>
              <span className="text-[12px] text-[#6B7A87]">
                Sealed bid hash certificates and evaluation matrices remain immutable for this duration.
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save configuration</span>
        </button>
      </form>
    </div>
  );
};
