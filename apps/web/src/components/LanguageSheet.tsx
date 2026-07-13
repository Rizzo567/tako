'use client'
import { Check } from 'lucide-react'
import { Languages } from 'lucide-react'
import { Sheet } from './ui/Sheet'
import { useI18n, LANG_NATIVE, SUPPORTED, type Lang } from '@/lib/i18n'

const nativeName = (code: string): string =>
  LANG_NATIVE[code.toLowerCase() as Lang] ?? code.toUpperCase()

// Sheet lingua aperto dal pulsante "Language" nell'header. Cambia lingua SENZA reload
// (aggiorna il context i18n → tutta la UI e il rifetch traduzioni del menu).
// Mostra TUTTE le lingue supportate: la UI è tradotta in tutte, quindi il cliente può
// sempre scegliere la propria (i nomi dei piatti restano in IT se il ristorante non li
// ha tradotti). La lista `languages` del ristorante serve solo alle traduzioni del menu.
export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, setLang, t } = useI18n()
  return (
    <Sheet open={open} onClose={onClose} title={t('language')} sub={t('languageSub')} leadIcon={<Languages size={20} />}>
      <div className="flex flex-col gap-2 px-5 pb-[calc(var(--safe-b)+18px)] pt-1">
        {SUPPORTED.map(code => {
          const on = code.toLowerCase() === lang.toLowerCase()
          return (
            <button
              key={code}
              onClick={() => { setLang(code); onClose() }}
              className="flex items-center gap-3 rounded-[var(--r-card)] px-3.5 py-3 text-left transition-all active:scale-[0.99]"
              style={{
                background: on ? 'var(--brand-tint)' : 'var(--raised)',
                border: `1.5px solid ${on ? 'var(--brand)' : 'var(--hairline)'}`,
                boxShadow: on ? 'none' : 'var(--sh-1)',
              }}
            >
              <span
                className="grid h-[34px] w-[34px] place-items-center rounded-[10px] text-[12px] font-extrabold tracking-wide"
                style={{
                  background: on ? 'var(--brand)' : 'var(--sunken)',
                  color: on ? 'var(--on-brand)' : 'var(--ink-2)',
                }}
              >
                {code.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-[var(--ink)]">{nativeName(code)}</span>
              {on && <Check size={18} style={{ color: 'var(--brand-deep)' }} />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
