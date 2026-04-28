'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { QrCode, Printer, Copy, Check, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

function QrCard({ table }: { table: any }) {
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['table-qr', table.id],
    queryFn: () => api.get(`/tables/${table.id}/qr`).then(r => r.data.data),
    staleTime: Infinity,
  })

  function copyLink() {
    if (!data?.url) return
    navigator.clipboard.writeText(data.url)
    setCopied(true)
    toast.success('Link copiato')
    setTimeout(() => setCopied(false), 2000)
  }

  function printSingle() {
    if (!data?.qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR Tavolo ${table.number}</title>
      <style>
        body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FFF8F3;}
        img{width:300px;height:300px;}
        h1{font-size:2rem;font-weight:900;margin:16px 0 4px;color:#2A1F1A;}
        p{color:#2A1F1A99;font-size:.9rem;margin:0;}
      </style></head>
      <body>
        <img src="${data.qrDataUrl}" />
        <h1>Tavolo ${table.number}</h1>
        <p>Scansiona per ordinare</p>
        <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>`)
    win.document.close()
  }

  return (
    <div className="card flex flex-col items-center gap-4 p-6 text-center">
      <div className="font-display font-black text-2xl">T{table.number}</div>

      {isLoading ? (
        <div className="skeleton w-40 h-40 rounded-xl" />
      ) : data?.qrDataUrl ? (
        <img
          src={data.qrDataUrl}
          alt={`QR Tavolo ${table.number}`}
          className="w-40 h-40 rounded-xl border-2 border-ink/10"
          data-qr-img="true"
          data-table-number={table.number}
        />
      ) : (
        <div className="w-40 h-40 rounded-xl bg-ink/5 grid place-items-center">
          <QrCode size={40} className="text-ink/20" />
        </div>
      )}

      <div className="w-full space-y-2">
        <button
          onClick={printSingle}
          disabled={!data}
          className="btn-coral w-full py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <Printer size={14} /> Stampa
        </button>
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            disabled={!data}
            className="btn-outline flex-1 py-2 text-xs flex items-center justify-center gap-1.5"
          >
            {copied ? <Check size={12} className="text-mint" /> : <Copy size={12} />}
            {copied ? 'Copiato' : 'Copia link'}
          </button>
          {data?.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline px-3 py-2 flex items-center justify-center"
              title="Apri link cliente"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function QrPage() {
  const { restaurant } = useAuthStore()

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/tables/rooms').then(r => r.data.data),
  })

  const allTables = rooms.flatMap((r: any) => r.tables ?? [])

  function printAll() {
    const imgs = document.querySelectorAll<HTMLImageElement>('[data-qr-img]')
    if (imgs.length === 0) { toast.error('Carica prima i QR'); return }

    const win = window.open('', '_blank')
    if (!win) return

    const items = Array.from(imgs).map(img => `
      <div style="display:flex;flex-direction:column;align-items:center;break-inside:avoid;margin:16px;">
        <img src="${img.src}" style="width:200px;height:200px;" />
        <h2 style="font-size:1.5rem;font-weight:900;margin:8px 0 2px;color:#2A1F1A;">Tavolo ${img.dataset.tableNumber}</h2>
        <p style="color:#2A1F1A99;font-size:.8rem;margin:0;">Scansiona per ordinare</p>
      </div>`).join('')

    win.document.write(`
      <html><head><title>QR Codes — ${restaurant?.name ?? 'Tako'}</title>
      <style>
        body{font-family:sans-serif;background:#FFF8F3;}
        .grid{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;padding:24px;}
      </style></head>
      <body><div class="grid">${items}</div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>`)
    win.document.close()
  }

  if (isLoading) return (
    <div className="p-8">
      <div className="skeleton h-9 w-40 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-72 rounded-2xl" />)}
      </div>
    </div>
  )

  if (allTables.length === 0) return (
    <div className="p-8 text-center py-20">
      <p className="text-5xl mb-4">📱</p>
      <p className="font-display font-black text-xl text-ink/40 mb-2">Nessun tavolo configurato</p>
      <p className="text-sm text-ink/50 font-semibold mb-6">Crea prima i tavoli dalla sezione Gestione Tavoli</p>
      <a href="/dashboard/sala/tavoli" className="btn-coral px-6 py-3 inline-flex items-center gap-2">
        Gestione Tavoli
      </a>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-black text-3xl">QR Codes</h1>
          <p className="text-ink/60 font-semibold mt-1">
            Stampa e posiziona su ogni tavolo — il cliente scansiona e ordina
          </p>
        </div>
        <button onClick={printAll} className="btn-coral flex items-center gap-2 px-5 py-3">
          <Printer size={16} /> Stampa tutti
        </button>
      </div>

      {rooms.map((room: any) => {
        const tables = room.tables ?? []
        if (tables.length === 0) return null
        return (
          <div key={room.id} className="mb-10">
            <h2 className="font-display font-black text-xl mb-4 text-ink/70">{room.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tables.map((table: any) => <QrCard key={table.id} table={table} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
