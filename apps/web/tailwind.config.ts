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
      },
      fontFamily: {
        display: ['Nunito', 'system-ui', 'sans-serif'],
        body: ['Quicksand', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
