module.exports = {
  content: ["./pages/*.{html,js}", "./index.html", "./js/*.js"],
  theme: {
    extend: {
      colors: {
        // Primary Colors
        primary: "#F7931A", // bitcoin-orange
        secondary: "#FFB366", // golden-warm
        accent: "#4ADE80", // success-green
        
        // Background Colors
        background: "#1A1A1A", // deep-charcoal
        surface: "#2D2D2D", // elevated-surface
        
        // Text Colors
        "text-primary": "#FFFFFF", // pure-white
        "text-secondary": "#A3A3A3", // neutral-gray
        
        // Status Colors
        success: "#22C55E", // success-green
        warning: "#F59E0B", // amber-warning
        error: "#EF4444", // error-red
        
        // Border Colors
        "border-subtle": "rgba(255, 255, 255, 0.1)", // subtle-white-10
        "border-accent": "#F7931A", // bitcoin-orange
        
        // Additional Shades for Better Design Flexibility
        "primary-50": "#FFF7ED", // primary-lightest
        "primary-100": "#FFEDD5", // primary-lighter
        "primary-200": "#FED7AA", // primary-light
        "primary-300": "#FDBA74", // primary-medium-light
        "primary-400": "#FB923C", // primary-medium
        "primary-500": "#F7931A", // primary-base
        "primary-600": "#EA580C", // primary-medium-dark
        "primary-700": "#C2410C", // primary-dark
        "primary-800": "#9A3412", // primary-darker
        "primary-900": "#7C2D12", // primary-darkest
        
        "surface-50": "#FAFAFA", // surface-lightest
        "surface-100": "#F5F5F5", // surface-lighter
        "surface-200": "#E5E5E5", // surface-light
        "surface-300": "#D4D4D4", // surface-medium-light
        "surface-400": "#A3A3A3", // surface-medium
        "surface-500": "#737373", // surface-medium-dark
        "surface-600": "#525252", // surface-dark
        "surface-700": "#404040", // surface-darker
        "surface-800": "#2D2D2D", // surface-base
        "surface-900": "#1A1A1A", // surface-darkest
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        inter: ['Inter', 'sans-serif'],
        jetbrains: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      boxShadow: {
        'sm': '0 2px 4px rgba(0, 0, 0, 0.1)', // elevation-1
        'md': '0 4px 8px rgba(0, 0, 0, 0.15)', // elevation-2
        'lg': '0 8px 16px rgba(0, 0, 0, 0.2)', // elevation-3
        'glow-primary': '0 0 20px rgba(247, 147, 26, 0.3)', // primary-glow
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.3)', // success-glow
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-in-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(247, 147, 26, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(247, 147, 26, 0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
      },
      transitionDuration: {
        '150': '150ms', // button-press
        '200': '200ms', // hover-states
        '300': '300ms', // state-changes
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)', // hover-timing
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)', // state-timing
      },
      spacing: {
        '18': '4.5rem', // 72px
        '88': '22rem', // 352px
        '128': '32rem', // 512px
      },
      minHeight: {
        'touch': '40px', // minimum-touch-target
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.touch-target': {
          minHeight: '40px',
          minWidth: '40px',
        },
        '.skeleton': {
          background: 'linear-gradient(90deg, #2D2D2D 25%, #404040 50%, #2D2D2D 75%)',
          backgroundSize: '200px 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
        },
        '.text-gradient-primary': {
          background: 'linear-gradient(135deg, #F7931A, #FFB366)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}