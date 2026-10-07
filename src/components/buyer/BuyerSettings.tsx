import React, { useState } from 'react';
import { Save, CheckCircle2, Shield } from 'lucide-react';

export const BuyerSettings: React.FC = () => {
  const [minDays, setMinDays] = useState('21');
  const [currency, setCurrency] = useState('BWP');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Procurement policies & council settings
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Configure minimum tender advertising durations, gazette notice dispatch, and automated reminder alerts.
          </p>
        </div>
      </div>

      {saved && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>Council procurement parameters saved.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4 max-w-xl text-[14px]">
        <div className="space-y-1">
          <label className="font-medium text-[#10212E] dark:text-white block">
            Minimum advertising period for competitive RFPs
          </label>
          <select
            value={minDays}
            onChange={(e) => setMinDays(e.target.value)}
            className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
          >
            <option value="14">14 Days (Fast-track EOI)</option>
            <option value="21">21 Days (Public Procurement Standard)</option>
            <option value="30">30 Days (Major Works)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-medium text-[#10212E] dark:text-white block">Default currency</label>
          <input
            type="text"
            value="Botswana Pula (BWP)"
            disabled
            className="w-full p-2.5 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#6B7A87]"
          />
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px]"
        >
          Save settings
        </button>
      </form>
    </div>
  );
};
