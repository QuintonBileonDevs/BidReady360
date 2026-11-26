/**
 * BidReady360 Brand Guide Design Tokens
 *
 * Calm, confident public-sector procurement design system.
 * Supports Light, System, and Dark themes with semantic CSS custom properties.
 * Typography: Sora (headings & numbers) + Source Sans 3 (body, forms, tables, buttons), no monospace.
 */

export const tokens = {
  colors: {
    // Core Brand Palette
    chalk: '#FFFFFF',         // Light page background, dark-mode primary text
    mist: '#EAF2FA',          // Light soft panel/row surface, hover tint, dark-mode secondary text
    ink: '#10212E',           // Light primary text, dark page background
    ink70: '#43525F',         // Light secondary text
    ink50: '#6B7A87',         // Light muted text
    line: '#D5E0EA',          // Light hairline borders and dividers
    surface: '#EAF2FA',       // Alias for Mist panel surface

    // Pula Brand Colors
    pulaDeep: '#1F5F99',      // Light primary actions, links, headings, logo ring
    pulaBlue: '#6FAEE0',      // Dark primary actions, accents, logo ring
    kalahariAmber: '#E8A33D', // Signature focal highlight (max 1 focal highlight per screen)

    // Shared Semantic Status Colors
    verifiedGreen: '#2F8F5B', // Approved, verified, live compliance
    alertRed: '#C2412D',      // Expired, urgent, non-compliant, error
    warningAmber: '#E8A33D',  // Expiring soon, requires action
    neutralSlate: '#6B7A87',  // Draft, archived, pending review

    // Dark Theme Ink Tints
    white: '#FFFFFF',
    darkPage: '#10212E',      // Ink page canvas
    darkSurface: '#162C3D',   // Elevated subtle panel/row surface
    darkCard: '#1C364B',      // Elevated card/modal surface
    darkLine: '#244157',      // Crisp subtle dark border
    darkTextSecondary: '#D3E3F2',
    darkTextMuted: '#9CB4C9',
  },

  themes: {
    light: {
      bgPage: '#FFFFFF',
      bgSurface: '#EAF2FA',
      bgCard: '#FFFFFF',
      borderSubtle: '#D5E0EA',
      textPrimary: '#10212E',
      textSecondary: '#43525F',
      textMuted: '#6B7A87',
      brandPrimary: '#1F5F99',
      brandAccent: '#6FAEE0',
      statusVerified: '#2F8F5B',
      statusAlert: '#C2412D',
      statusAmber: '#E8A33D',
    },
    dark: {
      bgPage: '#10212E',
      bgSurface: '#162C3D',
      bgCard: '#1C364B',
      borderSubtle: '#244157',
      textPrimary: '#FFFFFF',
      textSecondary: '#D3E3F2',
      textMuted: '#9CB4C9',
      brandPrimary: '#6FAEE0',
      brandAccent: '#1F5F99',
      statusVerified: '#2F8F5B',
      statusAlert: '#C2412D',
      statusAmber: '#E8A33D',
    },
  },

  cssVars: {
    bgPage: 'var(--bg-page)',
    bgSurface: 'var(--bg-surface)',
    bgCard: 'var(--bg-card)',
    borderSubtle: 'var(--border-subtle)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    brandPrimary: 'var(--brand-primary)',
    brandAccent: 'var(--brand-accent)',
    statusVerified: 'var(--status-verified)',
    statusAlert: 'var(--status-alert)',
  },

  typography: {
    fonts: {
      heading: '"Sora", "Segoe UI", system-ui, sans-serif',
      body: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
    },
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '2rem',    // 32px
      '4xl': '2.75rem', // 44px
      '5xl': '3.75rem', // 60px
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  radii: {
    control: '6px',
    panel: '10px',
    full: '9999px',
  },

  shadows: {
    subtle: '0 1px 3px 0 rgba(16, 33, 46, 0.05), 0 1px 2px -1px rgba(16, 33, 46, 0.04)',
    elevated: '0 4px 16px -2px rgba(16, 33, 46, 0.09), 0 2px 6px -2px rgba(16, 33, 46, 0.05)',
  },

  layout: {
    maxWidth: '1160px',
    gridColumns: 12,
  },
} as const;

export type DesignTokens = typeof tokens;
