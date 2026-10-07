import React, { useState } from 'react';
import { Palette, CheckCircle2, Upload, Eye } from 'lucide-react';

export const BuyerBranding: React.FC = () => {
  const [orgName, setOrgName] = useState('Gaborone Regional Council');
  const [subtext, setSubtext] = useState('Procurement & Asset Disposal Board');
  const [primaryColor, setPrimaryColor] = useState('#1F5F99');
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
            Organization branding & public profile
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Customize your public procurement portal header, official coat of arms, and supplier onboarding notice.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>Branding settings updated across your public procurement workspace.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={handleSave} className="lg:col-span-7 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4 text-[14px]">
          <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Entity details
          </h2>

          <div className="space-y-1">
            <label className="font-medium text-[#10212E] dark:text-white block">Official entity name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#10212E] dark:text-white block">Subheading / Unit designation</label>
            <input
              type="text"
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
              className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#10212E] dark:text-white block">Primary theme accent</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-[6px] cursor-pointer border border-[#D5E0EA]"
              />
              <span className="font-sans text-[13px]">{primaryColor}</span>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] transition-colors"
          >
            Save branding changes
          </button>
        </form>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <span className="text-[12px] font-semibold text-[#6B7A87] uppercase tracking-wider block">
            Public portal preview
          </span>

          <div className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#10212E] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[6px] bg-[#1F5F99] text-white flex items-center justify-center font-bold text-[14px]">
                GR
              </div>
              <div>
                <h4 className="font-semibold text-[15px] text-[#10212E] dark:text-white">
                  {orgName}
                </h4>
                <span className="text-[12px] text-[#6B7A87]">{subtext}</span>
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-[#132635] rounded-[6px] border border-[#D5E0EA] text-[13px] text-[#43525F]">
              Welcome to the official electronic procurement portal for {orgName}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
