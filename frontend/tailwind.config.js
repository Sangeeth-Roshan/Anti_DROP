/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Risk tier palette
        risk: {
          high:     '#d32f2f',
          highBg:   '#ffebee',
          moderate: '#f57c00',
          modBg:    '#fff3e0',
          low:      '#2e7d32',
          lowBg:    '#e8f5e9',
        },
        // Primary accent
        primary: {
          DEFAULT: '#1E88E5',
          dark:    '#1565C0',
          light:   '#64B5F6',
        },
        // Dark surface palette
        surface: {
          900: '#0A0F1E',
          800: '#0F172A',
          700: '#1E293B',
          600: '#334155',
          500: '#475569',
          400: '#64748B',
          300: '#94A3B8',
          200: '#CBD5E1',
          100: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'fade-in':     'fadeIn 0.3s ease-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'pulse-ring':  'pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseRing: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(30,136,229,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(30,136,229,0)' } },
      },
    },
  },
  plugins: [],
}
