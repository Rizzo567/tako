'use client'
import { useState } from 'react'
import { Check, Languages } from 'lucide-react'
import { Sheet } from './ui/Sheet'

// Etichette + bandiera per i codici lingua più comuni; fallback = codice maiuscolo.
const LANG_META: Record<string, { flag: string; label: string }> = {
  it: { flag: '🇮🇹', label: 'Italiano' },
  en: { flag: '🇬🇧', label: 'English' },
  fr: { flag: '🇫🇷', label: 'Français' },
  de: { flag: '🇩🇪', label: 'Deutsch' },
  es: { flag: '🇪🇸', label: 'Español' },
  pt: { flag: '🇵🇹', label: 'Português' },
  nl: { flag: '🇳🇱', label: 'Nederlands' },
  zh: { flag: '🇨🇳', label: '中文' },
  ja: { flag: '🇯🇵', label: '日本語' },
  ru: { flag: '🇷🇺', label: 'Русский' },
  ar: { flag: '🇸🇦', label: 'العربية' },
}

export function langMeta(code: string) {
  return LANG_META[code.toLowerCase()] ?? { flag: '🌐', label: code.toUpperCase() }
}

export function LanguageSelector({
  languages, value, onChange,
}: {
  languages: string[]
  value: string
  onChange: (lang: string) => void
}) {
  const [open, setOpen] = useState(false)
  const cur = langMeta(value)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Cambia lingua"
        className="relative z-[1] flex flex-none items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-bold active:scale-[0.97]"
        style={{ background: 'var(--raised)', color: 'var(--ink-2)', boxShadow: 'var(--sh-1)' }}
      >
        <span style={{ fontSize: 15 }}>{cur.flag}</span>
        <span className="uppercase">{value}</span>
      </button>

      <Sheet
        open={open} onClose={() => setOpen(false)}
        title="Lingua del menu" sub="Scegli la lingua di piatti e descrizioni"
        leadIcon={<Languages size={20} />}
      >
        <div className="flex flex-col gap-2 px-5 pb-[18px] pt-1">
          {languages.map(code => {
            const m = langMeta(code)
            const on = code.toLowerCase() === value.toLowerCase()
            return (
              <button
                key={code}
                onClick={() => { onChange(code.toLowerCase()); setOpen(false) }}
                className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-all active:scale-[0.99]"
                style={{
                  background: on ? 'var(--brand-tint)' : 'var(--surface)',
                  boxShadow: on ? 'inset 0 0 0 2px var(--brand)' : 'inset 0 0 0 1.5px var(--hairline)',
                }}
              >
                <span style={{ fontSize: 22 }}>{m.flag}</span>
                <span className="flex-1 text-[15px] font-semibold text-[var(--ink)]">{m.label}</span>
                {on && <Check size={18} style={{ color: 'var(--brand-deep)' }} />}
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}
