/** Cookie parsing for untrusted Socket.io handshake headers; malformed input fails closed. */
export function socketCookie(raw: string | undefined, name: string): string | null {
  if (!raw) return null
  for (const part of raw.split(';')) {
    const index = part.indexOf('=')
    if (index === -1 || part.slice(0, index).trim() !== name) continue
    try { return decodeURIComponent(part.slice(index + 1).trim()) }
    catch { return null }
  }
  return null
}
