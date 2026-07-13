'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { SPRING_SHEET, EASE_OUT } from '@/lib/motion'
import { useI18n } from '@/lib/i18n'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  sub?: string | null
  leadIcon?: ReactNode
  accent?: string
  maxH?: string
}

/**
 * Bottom sheet con backdrop + swipe-to-close (Framer drag).
 * Chiude se trascinato oltre 120px o con velocità > 550.
 */
export function Sheet({ open, onClose, children, title, sub, leadIcon, accent, maxH = '90vh' }: SheetProps) {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(30,20,16,.42)', backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative mx-auto flex w-full max-w-lg flex-col"
            style={{
              background: 'var(--raised)',
              borderTopLeftRadius: 'var(--r-sheet)', borderTopRightRadius: 'var(--r-sheet)',
              boxShadow: 'var(--sh-sheet)', maxHeight: maxH,
              paddingBottom: 'calc(var(--safe-b) + 4px)',
            }}
            initial={{ y: '101%' }}
            animate={{ y: 0 }}
            exit={{ y: '101%' }}
            transition={reduce ? { duration: 0.2 } : SPRING_SHEET}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 550) onClose()
            }}
          >
            {/* grabber */}
            <div className="flex-none cursor-grab pt-2.5 pb-1" style={{ touchAction: 'none' }}>
              <div className="mx-auto h-[5px] w-9 rounded-full" style={{ background: 'var(--hairline)' }} />
            </div>

            {title && (
              <div className="flex flex-none items-center gap-3 px-5 pb-3.5 pt-1.5">
                {leadIcon && (
                  <span
                    className="grid h-[38px] w-[38px] place-items-center rounded-xl"
                    style={{ background: accent || 'var(--brand-tint)', color: accent ? '#fff' : 'var(--brand)' }}
                  >
                    {leadIcon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[19px] font-bold text-[var(--ink)]">{title}</h3>
                  {sub && <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">{sub}</p>}
                </div>
                <button
                  aria-label={t('close')}
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full text-[var(--ink-2)] active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            <div className="min-h-0 overflow-y-auto scrollbar-hide">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    host,
  )
}
