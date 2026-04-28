import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div
        className="bg-white border-2 border-ink rounded-2xl p-12 max-w-md w-full text-center"
        style={{ boxShadow: '4px 4px 0 #2A1F1A' }}
      >
        <p className="font-display font-black text-[120px] leading-none text-coral select-none">
          404
        </p>
        <h1 className="font-display font-black text-2xl text-ink mt-2">
          Pagina non trovata
        </h1>
        <p className="font-body text-ink/60 mt-3 text-sm">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-8 px-6 py-3 bg-coral text-white font-display font-black text-sm rounded-xl border-2 border-ink transition-transform active:translate-y-px"
          style={{ boxShadow: '3px 3px 0 #2A1F1A' }}
        >
          Torna alla dashboard
        </Link>
      </div>
    </div>
  )
}
