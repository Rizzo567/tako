import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        coral: { DEFAULT: '#ED7159', deep: '#D9533A', soft: '#F8B7A6', tint: '#FFEEE8' },
        cream: '#FFF8F3',
        ink: { DEFAULT: '#2A1F1A', soft: '#5C4A41' },
        mint: '#7FC4A8',
        sun: '#F5C065',
        sky: '#BDD9E8',
      },
      fontFamily: {
        display: ['Nunito', 'system-ui', 'sans-serif'],
        body: ['Quicksand', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '18': '72px',
      },
      boxShadow: {
        'hard-sm': '2px 2px 0 rgba(42,31,26,0.12)',
        'hard-md': '4px 4px 0 rgba(42,31,26,0.15)',
        'hard-lg': '6px 6px 0 rgba(42,31,26,0.18)',
        'hard-ink': '4px 4px 0 #2A1F1A',
        'coral-glow': '0 4px 16px rgba(237,113,89,0.35)',
        'coral-hard': '4px 4px 0 #D9533A',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config
