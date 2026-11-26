-- Idempotent Step 4 Migration: Buyer Workspace Customization, Consent Access Logs & Notification Templates
-- Safe to run multiple times in DBeaver or Aiven PostgreSQL console.

-- 1. Organization member delegation override & conflict flag
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS approval_limit_bwp NUMERIC(15,2);

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS conflict_declared BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Organization branding columns (idempotent safety for older schemas)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS brand_primary_color CHAR(7);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS brand_subtext VARCHAR(255);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);

-- 3. Performance & uniqueness indexes for Step 4 governance tables
CREATE INDEX IF NOT EXISTS idx_org_data_access_logs_sup
  ON organization_data_access_logs (supplier_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_data_access_logs_org
  ON organization_data_access_logs (organization_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_templates_org
  ON form_templates (organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_org
  ON workflow_stages (organization_id, applies_to, sequence_no ASC);

CREATE INDEX IF NOT EXISTS idx_api_clients_org
  ON api_clients (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org
  ON webhook_endpoints (organization_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_templates_code_channel
  ON notification_templates (
    COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code,
    channel,
    locale
  );

-- 4. Seed baseline platform notification_templates (in_app + email)
INSERT INTO notification_templates (organization_id, code, channel, locale, subject, body, variables, is_active) VALUES
  -- Team invitations
  (NULL, 'team_invitation', 'in_app', 'en',
   'Workspace Invitation: {{tenantName}}',
   '{{inviterName}} invited you to join {{tenantName}} as {{roleName}}.',
   ARRAY['tenantName', 'inviterName', 'roleName', 'expiresAt'], TRUE),
  (NULL, 'team_invitation', 'email', 'en',
   'You have been invited to join {{tenantName}} on BidReady360',
   'Hello, {{inviterName}} has invited you to join {{tenantName}} with the role {{roleName}}. Accept your invitation before {{expiresAt}} using your workspace invite link.',
   ARRAY['tenantName', 'inviterName', 'roleName', 'expiresAt'], TRUE),

  -- Call invitations
  (NULL, 'call_invitation', 'in_app', 'en',
   'Tender Invitation: {{callNumber}}',
   '{{organizationName}} has invited your company to participate in {{callTitle}} ({{callNumber}}).',
   ARRAY['organizationName', 'callNumber', 'callTitle'], TRUE),
  (NULL, 'call_invitation', 'email', 'en',
   'Formal Tender Invitation — {{callNumber}}: {{callTitle}}',
   'Your organization has been formally invited by {{organizationName}} to respond to {{callTitle}} ({{callNumber}}). Sign in to BidReady360 to review the call details.',
   ARRAY['organizationName', 'callNumber', 'callTitle'], TRUE),

  -- Call addenda
  (NULL, 'call_addendum', 'in_app', 'en',
   'Addendum Issued on {{callNumber}}',
   'Addendum #{{addendumNo}} ("{{addendumTitle}}") has been published. Please review and acknowledge before submitting.',
   ARRAY['callNumber', 'addendumNo', 'addendumTitle'], TRUE),
  (NULL, 'call_addendum', 'email', 'en',
   'Official Tender Addendum #{{addendumNo}} — {{callNumber}}',
   'A formal addendum ("{{addendumTitle}}") has been issued for tender {{callNumber}}. Sign in to BidReady360 to acknowledge receipt.',
   ARRAY['callNumber', 'addendumNo', 'addendumTitle'], TRUE),

  -- Applications
  (NULL, 'application_submitted', 'in_app', 'en',
   'New Application Submitted ({{callNumber}})',
   '{{supplierName}} submitted an application dossier (Receipt {{receiptNumber}}) for {{callNumber}}.',
   ARRAY['supplierName', 'callNumber', 'receiptNumber'], TRUE),
  (NULL, 'application_submitted', 'email', 'en',
   'New Supplier Application Received — {{callNumber}}',
   '{{supplierName}} has submitted an application dossier under receipt {{receiptNumber}} for {{callNumber}}.',
   ARRAY['supplierName', 'callNumber', 'receiptNumber'], TRUE),

  (NULL, 'application_reviewed', 'in_app', 'en',
   'Application Status Updated ({{callNumber}})',
   'Your application for {{callNumber}} is now marked "{{status}}". {{note}}',
   ARRAY['callNumber', 'status', 'note'], TRUE),
  (NULL, 'application_reviewed', 'email', 'en',
   'Application Status Update — {{callNumber}}',
   'Your application for {{callNumber}} has been updated to "{{status}}". {{note}}',
   ARRAY['callNumber', 'status', 'note'], TRUE),

  (NULL, 'application_withdrawn', 'in_app', 'en',
   'Application Withdrawn ({{callNumber}})',
   '{{supplierName}} withdrew their application for {{callNumber}} prior to closing.',
   ARRAY['supplierName', 'callNumber'], TRUE),
  (NULL, 'application_withdrawn', 'email', 'en',
   'Supplier Application Withdrawn — {{callNumber}}',
   '{{supplierName}} has withdrawn their submission on {{callNumber}} prior to the closing deadline.',
   ARRAY['supplierName', 'callNumber'], TRUE),

  -- Sealed Bids
  (NULL, 'bid_submitted', 'in_app', 'en',
   'Sealed Bid Envelope Logged ({{callNumber}})',
   'A sealed bid envelope (Receipt {{receiptNumber}}) was submitted for {{callNumber}}.',
   ARRAY['callNumber', 'receiptNumber'], TRUE),
  (NULL, 'bid_submitted', 'email', 'en',
   'Sealed Bid Envelope Received — {{callNumber}}',
   'A cryptographically sealed bid (Receipt {{receiptNumber}}) has been logged for {{callNumber}}.',
   ARRAY['callNumber', 'receiptNumber'], TRUE),

  (NULL, 'bid_opened', 'in_app', 'en',
   'Official Bid Opening Completed ({{callNumber}})',
   'The witnessed bid opening ceremony for {{callNumber}} has concluded. Register SHA-256: {{registerSha256}}.',
   ARRAY['callNumber', 'registerSha256'], TRUE),
  (NULL, 'bid_opened', 'email', 'en',
   'Bid Opening Ceremony Completed — {{callNumber}}',
   'The official bid opening session for {{callNumber}} has completed with verified witness quorum. Register hash: {{registerSha256}}.',
   ARRAY['callNumber', 'registerSha256'], TRUE),

  -- Awards
  (NULL, 'award_pending_approval', 'in_app', 'en',
   'Award Awaiting Approval ({{callNumber}})',
   'An award recommendation for {{callNumber}} requires independent approval sign-off.',
   ARRAY['callNumber', 'awardValue'], TRUE),
  (NULL, 'award_pending_approval', 'email', 'en',
   'Action Required: Award Approval Pending — {{callNumber}}',
   'An award recommendation for {{callNumber}} is awaiting independent approval under organizational delegation rules.',
   ARRAY['callNumber', 'awardValue'], TRUE),

  (NULL, 'award_approved', 'in_app', 'en',
   'Contract Award Approved ({{callNumber}})',
   'The contract award for {{callNumber}} has been formally approved and issued.',
   ARRAY['callNumber'], TRUE),
  (NULL, 'award_approved', 'email', 'en',
   'Official Notice of Contract Award — {{callNumber}}',
   'The contract award for {{callNumber}} has been approved. Sign in to BidReady360 to review the award notice and contract terms.',
   ARRAY['callNumber'], TRUE),

  (NULL, 'award_rejected', 'in_app', 'en',
   'Award Recommendation Returned ({{callNumber}})',
   'The award recommendation for {{callNumber}} was rejected during approval review.',
   ARRAY['callNumber'], TRUE),
  (NULL, 'award_rejected', 'email', 'en',
   'Award Recommendation Returned — {{callNumber}}',
   'The award recommendation for {{callNumber}} was returned by the approving authority.',
   ARRAY['callNumber'], TRUE),

  -- Clarifications
  (NULL, 'clarification_asked', 'in_app', 'en',
   'New Clarification Question ({{callNumber}})',
   'A supplier submitted a clarification inquiry on {{callNumber}} awaiting procurement review.',
   ARRAY['callNumber'], TRUE),
  (NULL, 'clarification_asked', 'email', 'en',
   'New Tender Clarification Submitted — {{callNumber}}',
   'A supplier has posted a clarification question on {{callNumber}}. Sign in to review and publish an official response.',
   ARRAY['callNumber'], TRUE),

  (NULL, 'clarification_answered', 'in_app', 'en',
   'Clarification Response Published ({{callNumber}})',
   'The procuring organization published an official response to a clarification on {{callNumber}}.',
   ARRAY['callNumber'], TRUE),
  (NULL, 'clarification_answered', 'email', 'en',
   'Clarification Response Published — {{callNumber}}',
   'An official clarification response has been published on {{callNumber}}.',
   ARRAY['callNumber'], TRUE),

  -- Consent data access
  (NULL, 'consent_accessed', 'in_app', 'en',
   'Supplier Data Accessed by {{organizationName}}',
   '{{actorName}} ({{organizationName}}) accessed your consented profile/document scope: {{scope}}.',
   ARRAY['organizationName', 'actorName', 'scope'], TRUE),
  (NULL, 'consent_accessed', 'email', 'en',
   'Data Access Log Notice — {{organizationName}}',
   '{{actorName}} at {{organizationName}} accessed your shared supplier data ({{scope}}). Review full access logs in Consent & Data Sharing.',
   ARRAY['organizationName', 'actorName', 'scope'], TRUE)
ON CONFLICT DO NOTHING;
