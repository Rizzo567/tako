'use client'
import { useEffect, useState } from 'react'

/* ───────── live-notif bus (header mobile / capsula volante) ───────── */
export interface LiveNotif { title: string; sub?: string; icon?: string; tone?: string }
const liveSubs = new Set<(n: LiveNotif) => void>()

export interface NotifEntry extends LiveNotif { id: number; at: number; unread: boolean }
const notifStore = { list: [] as NotifEntry[], subs: new Set<() => void>(), id: 0 }
function emitNotif() { notifStore.subs.forEach((f) => f()) }

// Pubblica una notifica: fa partire la capsula volante E la aggiunge al pannello.
export function pushLiveNotif(n: LiveNotif) {
  liveSubs.forEach((f) => f(n))
  notifStore.list = [{ ...n, id: ++notifStore.id, at: Date.now(), unread: true }, ...notifStore.list].slice(0, 40)
  emitNotif()
}
export function useLiveNotif(handler: (n: LiveNotif) => void) {
  useEffect(() => { liveSubs.add(handler); return () => { liveSubs.delete(handler) } }, [handler])
}

// Pannello notifiche: lista reattiva + conteggio non lette + segna lette.
export function useNotifications() {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force((x) => x + 1); notifStore.subs.add(f); return () => { notifStore.subs.delete(f) } }, [])
  return {
    list: notifStore.list,
    unread: notifStore.list.filter((n) => n.unread).length,
    markAllRead: () => { notifStore.list = notifStore.list.map((n) => ({ ...n, unread: false })); emitNotif() },
  }
}

/* ───────── scroll-direction store (bottom-bar che si rimpicciolisce) ───────── */
const scroll = { down: false, subs: new Set<() => void>() }
export function setScrollDown(v: boolean) { if (scroll.down !== v) { scroll.down = v; scroll.subs.forEach((f) => f()) } }
export function useScrollDown() {
  const [, force] = useState(0)
  useEffect(() => { const cb = () => force((x) => x + 1); scroll.subs.add(cb); return () => { scroll.subs.delete(cb) } }, [])
  return scroll.down
}
