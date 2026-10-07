/**
 * BidReady360 Design Tokens
 * 
 * Calm, confident, and editorial public-sector procurement system design tokens.
 * 8px spacing scale, 6px control radius, 10px panel radius, 1160px max content width.
 */

export const tokens = {
  colors: {
    // Primary Brand & Surfaces
    ink: '#10212E',        // Primary text, dark backgrounds
    ink70: '#43525F',      // Secondary text, subheadings, active icons
    ink50: '#6B7A87',      // Muted text, captions, placeholder text
    line: '#D5E0EA',       // Fine hairline borders and dividers
    surface: '#F7FAFD',    // Off-white neutral card backgrounds, subtle zebra striping
    mist: '#EAF2FA',       // Light primary tint for hover states, selected items

    // Pula Brand Colors
    pulaDeep: '#1F5F99',   // Primary actions, active links, primary buttons
    pulaBlue: '#6FAEE0',   // Accent highlights on dark surfaces, badges
    kalahariAmber: '#E8A33D', // Signature focal highlight (use sparingly: 1 per screen)

    // Semantic Status Colors
    verifiedGreen: '#2F8F5B', // Approved, verified, live compliance
    alertRed: '#C2412D',      // Expired, urgent, non-compliant, error
    warningAmber: '#E8A33D',  // Expiring soon, requires action
    neutralSlate: '#6B7A87',  // Draft, archived, pending review

    // Pure Neutrals
    white: '#FFFFFF',
    darkCard: '#132635',
    darkSurface: '#0D1A25',
    darkLine: '#1E364A',
  },

  typography: {
    fonts: {
      heading: '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      body: '"Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    },
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',      // 16px
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
    control: '6px',  // Buttons, inputs, chips, checkboxes, tags
    panel: '10px',   // Cards, modals, containers, tables, dropdowns
    full: '9999px',  // Circular badges, avatar rings
  },

  shadows: {
    subtle: '0 1px 3px 0 rgba(16, 33, 46, 0.04), 0 1px 2px -1px rgba(16, 33, 46, 0.04)',
    elevated: '0 4px 16px -2px rgba(16, 33, 46, 0.08), 0 2px 6px -2px rgba(16, 33, 46, 0.04)',
  },

  layout: {
    maxWidth: '1160px',
    gridColumns: 12,
  },
} as const;

export type DesignTokens = typeof tokens;
