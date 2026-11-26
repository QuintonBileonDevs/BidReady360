import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Globe,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { buyerApi } from '../../services/api';

const WEBHOOK_EVENTS = [
  { code: 'application.submitted', label: 'Application submitted' },
  { code: 'bid.opened', label: 'Sealed bids opened' },
  { code: 'award.approved', label: 'Contract award approved' },
  { code: 'call.addendum', label: 'Call addendum published' },
];

export const BuyerIntegrations: React.FC = () => {
  const [apiClients, setApiClients] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Create API key state
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [createdKeyOnce, setCreatedKeyOnce] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  // Create webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'award.approved',
    'application.submitted',
    'bid.opened',
  ]);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);

  const loadIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await buyerApi.getIntegrations();
      setApiClients(Array.isArray(data?.apiClients) ? data.apiClients : []);
      setWebhooks(Array.isArray(data?.webhooks) ? data.webhooks : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load API keys and webhook integrations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  const handleCopy = (val: string, label: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedSecret(label);
    setTimeout(() => setCopiedSecret(null), 2500);
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    setError(null);
    setCreatedKeyOnce(null);
    try {
      const res = await buyerApi.createApiKey({
        name: newKeyName.trim(),
        scopes: ['calls.read', 'applications.read', 'awards.read'],
      });
      setCreatedKeyOnce(res.plainKeyOnce);
      setNewKeyName('');
      setFeedback(`Issued new API client "${res.name}". Copy the secret key now — it will not be displayed again.`);
      await loadIntegrations();
    } catch (err: any) {
      setError(err?.message || 'Failed to issue API key.');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (clientId: string) => {
    setError(null);
    try {
      await buyerApi.revokeApiKey(clientId);
      setFeedback('API key revoked immediately.');
      await loadIntegrations();
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke API key.');
    }
  };

  const toggleEvent = (code: string) => {
    setSelectedEvents((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    setIsSavingWebhook(true);
    setError(null);
    setCreatedWebhookSecret(null);
    try {
      const res = await buyerApi.saveWebhook({
        url: webhookUrl.trim(),
        eventTypes: selectedEvents.length > 0 ? selectedEvents : ['award.approved'],
      });
      if (res.signingSecretOnce) {
        setCreatedWebhookSecret(res.signingSecretOnce);
      }
      setWebhookUrl('');
      setFeedback('Outbound HTTPS webhook endpoint saved to PostgreSQL.');
      await loadIntegrations();
    } catch (err: any) {
      setError(err?.message || 'Failed to save webhook endpoint.');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (endpointId: string) => {
    setError(null);
    try {
      await buyerApi.deleteWebhook(endpointId);
      setFeedback('Webhook endpoint removed.');
      await loadIntegrations();
    } catch (err: any) {
      setError(err?.message || 'Failed to remove webhook endpoint.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            ERP integrations &amp; API webhooks
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Manage hashed API client credentials and signed HTTPS webhook endpoints for your ERP or financial ledger.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[12px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-10 flex items-center justify-center gap-2.5 text-[#6B7A87]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99]" />
          <span className="text-[14px]">Loading API clients and webhooks...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* API Clients Section */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-5 text-[14px]">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[#1F5F99]" />
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Organization API Keys
              </h2>
            </div>

            {createdKeyOnce && (
              <div className="p-4 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <div className="flex items-center gap-2 text-[#92400E] font-semibold text-[13px]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Copy your new API secret key now — only its SHA-256 hash is stored on the server.</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 rounded bg-white border border-[#FDE68A] font-mono text-[12px] break-all text-[#10212E]">
                    {createdKeyOnce}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdKeyOnce, 'apiKey')}
                    className="px-3 py-2 bg-[#1F5F99] text-white rounded-[6px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedSecret === 'apiKey' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateApiKey} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Integration name (e.g. Municipal Finance ERP)"
                className="flex-1 p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
              />
              <button
                type="submit"
                disabled={isCreatingKey || !newKeyName.trim()}
                className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCreatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Generate API key</span>
              </button>
            </form>

            {apiClients.length === 0 ? (
              <p className="text-[13px] text-[#6B7A87]">No API integration keys have been issued yet.</p>
            ) : (
              <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                {apiClients.map((client) => (
                  <div key={client.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-[#10212E] dark:text-white flex items-center gap-2">
                        <span>{client.name}</span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                            client.revokedAt
                              ? 'bg-rose-50 text-[#C2412D]'
                              : 'bg-[#ECFDF5] text-[#2F8F5B]'
                          }`}
                        >
                          {client.revokedAt ? 'Revoked' : 'Active'}
                        </span>
                      </div>
                      <div className="text-[12px] font-mono text-[#6B7A87]">
                        Prefix: {client.keyPrefix}•••••••••••••••• · Issued by {client.createdByName}
                      </div>
                    </div>
                    {!client.revokedAt && (
                      <button
                        type="button"
                        onClick={() => handleRevokeKey(client.id)}
                        className="px-3 py-1.5 text-[12px] font-medium text-[#C2412D] border border-rose-200 rounded-[6px] hover:bg-rose-50 cursor-pointer"
                      >
                        Revoke key
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outbound Webhooks Section */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-5 text-[14px]">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#1F5F99]" />
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Outbound HTTPS Webhooks
              </h2>
            </div>

            {createdWebhookSecret && (
              <div className="p-4 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                <div className="text-[#92400E] font-semibold text-[13px]">
                  HMAC-SHA256 Signing Secret (shown once):
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 rounded bg-white border border-[#FDE68A] font-mono text-[12px] break-all text-[#10212E]">
                    {createdWebhookSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdWebhookSecret, 'webhook')}
                    className="px-3 py-2 bg-[#1F5F99] text-white rounded-[6px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedSecret === 'webhook' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAddWebhook} className="space-y-3 max-w-2xl">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://erp.example.gov.bw/api/procurement-events"
                  className="flex-1 p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                />
                <button
                  type="submit"
                  disabled={isSavingWebhook || !webhookUrl.trim()}
                  className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Register webhook</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-3 text-[12px]">
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.code} className="inline-flex items-center gap-1.5 cursor-pointer text-[#43525F] dark:text-[#B2C3D2]">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev.code)}
                      onChange={() => toggleEvent(ev.code)}
                      className="rounded border-[#D5E0EA]"
                    />
                    <span>{ev.label}</span>
                  </label>
                ))}
              </div>
              <span className="text-[12px] text-[#6B7A87] block">
                HTTPS required. Localhost and private network addresses are blocked; payloads are signed with HMAC-SHA256.
              </span>
            </form>

            {webhooks.length === 0 ? (
              <p className="text-[13px] text-[#6B7A87]">No outbound webhook endpoints configured yet.</p>
            ) : (
              <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-mono text-[13px] text-[#10212E] dark:text-white break-all">
                        {wh.url}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(wh.eventTypes) ? wh.eventTypes : []).map((ev: string) => (
                          <span
                            key={ev}
                            className="text-[11px] font-mono bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] px-2 py-0.5 rounded"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="p-2 text-[#C2412D] hover:bg-rose-50 rounded-[6px] cursor-pointer"
                      title="Remove webhook endpoint"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
