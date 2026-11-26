-- =============================================================================
-- Migration 004: In-App Notification Indexes & Plain Sentence-Case Templates
-- Idempotent — safe to run multiple times in Aiven / DBeaver PostgreSQL Console
-- =============================================================================

-- 1. Performance indexes for live unread counts and tenant-scoped notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_scope
  ON notifications (user_id, organization_id, supplier_id, created_at DESC);

-- 2. Ensure composite unique index on notification_templates exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_templates_code_channel
  ON notification_templates (
    COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code,
    channel,
    locale
  );

-- 3. Upsert plain sentence-case in-app notification templates for core procurement events
INSERT INTO notification_templates (organization_id, code, channel, locale, subject, body, variables, is_active) VALUES
  -- Organization approval & rejection
  (NULL, 'organization_approved', 'in_app', 'en',
   'Your organization account is approved',
   '{{organizationName}} has been verified and approved. Open your workspace to publish tender calls and review supplier submissions.',
   ARRAY['organizationName'], TRUE),

  (NULL, 'organization_rejected', 'in_app', 'en',
   'Organization verification needs attention',
   '{{organizationName}} was not approved. Reason: {{reason}}. Review your organization details and contact platform support to resubmit.',
   ARRAY['organizationName', 'reason'], TRUE),

  -- Supplier document verification & expiry (<= 90 days)
  (NULL, 'document_verified', 'in_app', 'en',
   'Document verified: {{documentTitle}}',
   'Your {{documentTitle}} has been verified. Open your document vault to check your bidding readiness.',
   ARRAY['documentTitle'], TRUE),

  (NULL, 'document_rejected', 'in_app', 'en',
   'Document needs replacement: {{documentTitle}}',
   'Your {{documentTitle}} could not be accepted. Reason: {{reason}}. Upload a clear replacement copy in your document vault.',
   ARRAY['documentTitle', 'reason'], TRUE),

  (NULL, 'document_expiring_soon', 'in_app', 'en',
   '{{documentTitle}} expires on {{expiryDate}}',
   'Your {{documentTitle}} expires on {{expiryDate}} ({{daysRemaining}} days left). Upload a renewed certificate in your document vault to stay ready to bid.',
   ARRAY['documentTitle', 'expiryDate', 'daysRemaining'], TRUE),

  (NULL, 'director_verified', 'in_app', 'en',
   'Director identity verified: {{directorName}}',
   'Identity verification for {{directorName}} has been approved. Open your company profile to check your readiness.',
   ARRAY['directorName'], TRUE),

  (NULL, 'director_rejected', 'in_app', 'en',
   'Director verification needs attention: {{directorName}}',
   'Identity verification for {{directorName}} was not approved. Reason: {{reason}}. Update the director record in your company profile.',
   ARRAY['directorName', 'reason'], TRUE),

  (NULL, 'supplier_verified', 'in_app', 'en',
   'Your supplier profile is verified',
   '{{supplierName}} has been verified for bidding. Open your dashboard to view open tender calls.',
   ARRAY['supplierName'], TRUE),

  (NULL, 'supplier_rejected', 'in_app', 'en',
   'Supplier verification needs attention',
   '{{supplierName}} could not be verified. Reason: {{reason}}. Open your document vault to update and resubmit.',
   ARRAY['supplierName', 'reason'], TRUE),

  -- Clarifications
  (NULL, 'clarification_asked', 'in_app', 'en',
   'New clarification question on {{callNumber}}',
   '{{supplierName}} asked a clarification question under {{topic}}. Review the question and publish an official response.',
   ARRAY['callNumber', 'supplierName', 'topic'], TRUE),

  (NULL, 'clarification_answered', 'in_app', 'en',
   'Clarification answer published for {{callNumber}}',
   'An official clarification response was published for {{callTitle}}. Open the tender call to read the answer before submitting.',
   ARRAY['callNumber', 'callTitle'], TRUE),

  -- Addenda
  (NULL, 'addendum_published', 'in_app', 'en',
   'Addendum #{{addendumNo}} published for {{callNumber}}',
   '{{addendumTitle}} was issued for {{callTitle}}. Open the tender call to review and acknowledge this addendum.',
   ARRAY['callNumber', 'callTitle', 'addendumNo', 'addendumTitle'], TRUE),

  (NULL, 'call_addendum', 'in_app', 'en',
   'Addendum #{{addendumNo}} published for {{callNumber}}',
   '{{addendumTitle}} was issued for {{callNumber}}. Open the tender call to review and acknowledge this addendum.',
   ARRAY['callNumber', 'addendumNo', 'addendumTitle'], TRUE),

  -- Applications
  (NULL, 'application_submitted', 'in_app', 'en',
   'New application submitted for {{callNumber}}',
   '{{supplierName}} submitted an application dossier (receipt {{receiptNumber}}). Open the applications queue to review the submission.',
   ARRAY['supplierName', 'callNumber', 'receiptNumber'], TRUE),

  (NULL, 'application_status_changed', 'in_app', 'en',
   'Application status updated for {{callNumber}}',
   'Your application for {{callTitle}} is now {{status}}. {{note}}',
   ARRAY['callNumber', 'callTitle', 'status', 'note'], TRUE),

  (NULL, 'application_reviewed', 'in_app', 'en',
   'Application status updated for {{callNumber}}',
   'Your application for {{callNumber}} is now {{status}}. {{note}}',
   ARRAY['callNumber', 'status', 'note'], TRUE),

  (NULL, 'application_info_responded', 'in_app', 'en',
   'Additional information submitted for {{callNumber}}',
   '{{actorName}} replied to your information request. Open the applications queue to continue the review.',
   ARRAY['callNumber', 'actorName'], TRUE),

  (NULL, 'application_withdrawn', 'in_app', 'en',
   'Application withdrawn for {{callNumber}}',
   '{{supplierName}} withdrew their application for {{callTitle}} before closing. Open the applications queue to view the updated list.',
   ARRAY['supplierName', 'callNumber', 'callTitle'], TRUE),

  -- Sealed bids & bid opening
  (NULL, 'bid_submitted', 'in_app', 'en',
   'Sealed bid received for {{callNumber}}',
   '{{supplierName}} submitted a sealed bid (receipt {{receiptNumber}}). Pricing stays locked until the witnessed opening session.',
   ARRAY['supplierName', 'callNumber', 'receiptNumber'], TRUE),

  (NULL, 'bid_withdrawn', 'in_app', 'en',
   'Sealed bid withdrawn for {{callNumber}}',
   'A supplier withdrew sealed bid {{receiptNumber}} before the closing deadline. Open bids opening to view the register.',
   ARRAY['callNumber', 'receiptNumber'], TRUE),

  (NULL, 'bid_opened', 'in_app', 'en',
   'Sealed bid opened for {{callNumber}}',
   'Your bid ({{receiptNumber}}) for {{callTitle}} was unsealed during the witnessed opening session. Check your applications for evaluation updates.',
   ARRAY['callNumber', 'callTitle', 'receiptNumber', 'registerSha256'], TRUE),

  -- Awards
  (NULL, 'award_pending_approval', 'in_app', 'en',
   'Award recommendation waiting for approval ({{callNumber}})',
   '{{actorName}} recommended a contract award of BWP {{awardValue}}. Open awards to review and record your approval decision.',
   ARRAY['callNumber', 'actorName', 'awardValue'], TRUE),

  (NULL, 'award_decision', 'in_app', 'en',
   'Award recommendation {{decision}} for {{callNumber}}',
   '{{actorName}} {{decision}} the contract award recommendation for {{callTitle}}. Open awards to review the recorded decision.',
   ARRAY['callNumber', 'callTitle', 'actorName', 'decision'], TRUE),

  (NULL, 'award_approved', 'in_app', 'en',
   'Contract award approved for {{callNumber}}',
   'Your bid for {{callTitle}} (BWP {{awardValue}}) has been approved for contract award. Open your applications to view the next steps.',
   ARRAY['callNumber', 'callTitle', 'awardValue'], TRUE),

  (NULL, 'award_issued', 'in_app', 'en',
   'Contract award approved for {{callNumber}}',
   'Your bid for {{callTitle}} (BWP {{awardValue}}) has been approved for contract award. Open your applications to view the next steps.',
   ARRAY['callNumber', 'callTitle', 'awardValue'], TRUE),

  (NULL, 'award_rejected', 'in_app', 'en',
   'Award recommendation returned for {{callNumber}}',
   'The award recommendation for {{callTitle}} was returned during approval review. Open awards to inspect the feedback.',
   ARRAY['callNumber', 'callTitle'], TRUE),

  -- Invitations & consent
  (NULL, 'call_invitation', 'in_app', 'en',
   'You are invited to bid on {{callNumber}}',
   '{{organizationName}} invited your company to respond to {{callTitle}}. Open the tender call to review requirements and deadlines.',
   ARRAY['organizationName', 'callNumber', 'callTitle'], TRUE),

  (NULL, 'team_invitation', 'in_app', 'en',
   'Workspace invitation to {{tenantName}}',
   '{{inviterName}} invited you to join {{tenantName}} as {{roleName}}. Accept your invitation before {{expiresAt}}.',
   ARRAY['tenantName', 'inviterName', 'roleName', 'expiresAt'], TRUE),

  (NULL, 'consent_accessed', 'in_app', 'en',
   '{{organizationName}} viewed your shared data',
   '{{actorName}} at {{organizationName}} accessed {{scope}}. Open consent and data sharing to review the access log.',
   ARRAY['organizationName', 'actorName', 'scope'], TRUE)
ON CONFLICT ((COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)), code, channel, locale)
DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = TRUE;
