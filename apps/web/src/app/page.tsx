export default function Home() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--surface-base)] p-6 text-center">
      <div>
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full" style={{ background: 'var(--brand-tint)' }}>
          <span className="font-serif text-2xl" style={{ color: 'var(--brand)' }}>T</span>
        </div>
        <h1 className="mb-2 font-serif text-3xl text-[var(--text-primary)]">Tako</h1>
        <p className="font-medium text-[var(--text-secondary)]">Scansiona il QR sul tuo tavolo per ordinare.</p>
      </div>
    </div>
  )
}
