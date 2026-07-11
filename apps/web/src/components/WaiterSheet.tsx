'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HandHelping, ReceiptText, GlassWater, Check, ChevronRight, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useSessionStore } from '@/lib/store'
import { useI18n, type UIKey } from '@/lib/i18n'
import { SPRING, EASE_OUT } from '@/lib/motion'
import { Sheet } from './ui/Sheet'
import { Confetti } from './ui/Confetti'

type WaiterType = 'help' | 'bill' | 'water'
const OPTS: { type: WaiterType; Icon: typeof HandHelping; labelKey: UIKey; subKey: UIKey }[] = [
  { type: 'help', Icon: HandHelping, labelKey: 'waiterHelp', subKey: 'waiterHelpSub' },
  { type: 'bill', Icon: ReceiptText, labelKey: 'waiterBill', subKey: 'waiterBillSub' },
  { type: 'water', Icon: GlassWater, labelKey: 'waiterWater', subKey: 'waiterWaterSub' },
]

export function WaiterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { tableNumber } = useSessionStore()
  const [sent, setSent] = useState<{ type: WaiterType; label: string } | null>(null)

  useEffect(() => { if (open) setSent(null) }, [open])

  async function call(opt: (typeof OPTS)[number]) {
    const { restaurantId, tableId, tableNumber } = useSessionStore.getState()
    try {
      await api.post('/customer/waiter-call', { restaurantId, tableId, tableNumber, type: opt.type })
      // Conferma solo se il POST va a buon fine: niente falso "Fatto!".
      setSent({ type: opt.type, label: t(opt.labelKey) })
      setTimeout(onClose, 2100)
    } catch {
      toast.error(t('waiterError'))
    }
  }

  return (
    <Sheet
      open={open} onClose={onClose}
      title={sent ? undefined : t('callWaiter')}
      sub={sent ? undefined : `${t('table')} ${tableNumber ?? ''}`}
      leadIcon={sent ? undefined : <Bell size={20} />}
    >
      {sent ? (
        <div className="relative px-8 pb-10 pt-3.5 text-center">
          <Confetti n={18} />
          <motion.div
            className="mx-auto grid h-[76px] w-[76px] place-items-center rounded-full text-white"
            style={{ background: 'var(--ok)' }}
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.08, 1], opacity: 1 }} transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <Check size={40} strokeWidth={2.6} />
          </motion.div>
          <h3 className="mt-4 text-[21px] font-bold text-[var(--ink)]">{t('waiterDone')}</h3>
          <p className="mt-1.5 text-[14.5px] text-[var(--ink-2)]">{sent.label} — {t('waiterComing')} {tableNumber}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 px-5 pb-[calc(var(--safe-b)+22px)] pt-1">
          {OPTS.map((o, i) => (
            <motion.button
              key={o.type} onClick={() => call(o)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE_OUT, delay: i * 0.06 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3.5 rounded-[var(--r-card)] p-4 text-left"
              style={{ background: 'var(--surface)', boxShadow: 'inset 0 0 0 1.5px var(--hairline)' }}
            >
              <span className="grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px]" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                <o.Icon size={23} strokeWidth={2.2} />
              </span>
              <span className="flex-1">
                <span className="block text-[16px] font-bold text-[var(--ink)]">{t(o.labelKey)}</span>
                <span className="mt-0.5 block text-[13px] text-[var(--ink-2)]">{t(o.subKey)}</span>
              </span>
              <ChevronRight size={20} style={{ color: 'var(--ink-3)' }} />
            </motion.button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
