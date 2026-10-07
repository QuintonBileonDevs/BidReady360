import React, { useState } from 'react';
import { Key, Globe, CheckCircle2, Copy, RefreshCw } from 'lucide-react';

export const BuyerIntegrations: React.FC = () => {
  const [apiKey, setApiKey] = useState('grc_live_9f83a042918bc32014ea8390');
  const [webhookUrl, setWebhookUrl] = useState('https://erp.grc.gov.bw/api/procurement-events');
  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard?.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            ERP integrations & API webhooks
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Connect your municipal financial ledger or ERP system to receive real-time award notices and application dossiers.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6 text-[14px]">
        <div className="space-y-2">
          <span className="font-semibold text-[#10212E] dark:text-white block">Production API Key</span>
          <div className="flex items-center gap-2 max-w-xl">
            <input
              type="password"
              value={apiKey}
              readOnly
              className="flex-1 p-2.5 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] font-sans"
            />
            <button
              type="button"
              onClick={handleCopyKey}
              className="px-3.5 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] hover:bg-[#F7FAFD] text-[13px] font-medium"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="font-semibold text-[#10212E] dark:text-white block">Outbound Webhook Endpoint</span>
          <div className="flex items-center gap-2 max-w-xl">
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
            />
            <button
              type="button"
              className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium"
            >
              Update URL
            </button>
          </div>
          <span className="text-[12px] text-[#6B7A87]">
            Payloads signed with HMAC-SHA256 headers for verification.
          </span>
        </div>
      </div>
    </div>
  );
};
