// ESLint flat config (ESLint 9) — sostituisce il vecchio `next lint` (deprecato) che
// nel repo non aveva config e si bloccava sul setup interattivo.
//
// Scope: SOLO il codice sorgente TypeScript/TSX (server, web, dashboard, app, packages).
// Escluso lo staff `apps/dashboard/public/staff` (JS "script a globali" con Babel-in-browser:
// React/ReactDOM/hook globali → produrrebbe solo rumore no-undef, non è codice a modulo).
//
// Regole tarate per essere UTILI senza sommergere: correttezza in `error`, stile in `warn`.
// `no-undef` è OFF ovunque: i riferimenti non definiti li intercettano già TypeScript e la
// build (evita falsi positivi su window/document/process/console e sui tipi globali).
// `react-hooks` è applicato SOLO al frontend React (web/dashboard/app), non al server
// (dove `useX` di librerie — es. Baileys `useMultiFileAuthState` — non sono hook React).

import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'apps/app/src-tauri/**',
      'apps/dashboard/public/**', // staff JS a globali (Babel-in-browser) — non a modulo
      'apps/web/public/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.ts',
      'scripts/**',
    ],
  },

  js.configs.recommended,

  // no-undef off ovunque (lo copre TypeScript/la build).
  { rules: { 'no-undef': 'off' } },

  // Sorgente TypeScript / TSX.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off',
      // Stile → warn (non blocca), correttezza → error.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': 'warn',
    },
  },

  // Regole degli Hook: solo frontend React.
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/dashboard/**/*.{ts,tsx}', 'apps/app/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  // Next.js: solo web + dashboard.
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/dashboard/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
]
