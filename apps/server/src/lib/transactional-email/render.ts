import { renderEmailDesign } from './design.js'
import { emailCatalog } from './catalog.js'

export type EmailTemplate = keyof typeof emailCatalog
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
const support = 'manuelrizzo474@gmail.com'

function httpsLink(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error('Invalid email URL')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Email links must use HTTPS without credentials')
  return value
}

/** Only catalog HTML is trusted. Caller-supplied copy is always plain text. */
export function renderTransactionalEmail(id: EmailTemplate, values: Record<string, string>, logoUrl?: string, assetBase?: string) {
  const template = emailCatalog[id]
  const substitute = (source: string, html: boolean, header = false) => source.replace(/\{([a-z_]+)\}/g, (_match, key: string) => {
    const value = values[key]
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing email variable: ${key}`)
    if (key.startsWith('link_')) httpsLink(value)
    return html ? escape(value) : header ? value.replace(/[\r\n]/g, ' ') : value
  })
  const subject = substitute(template.subject, false, true)
  const title = substitute(template.title, true)
  const body = substitute(template.body, true)
  const hasButton = id !== 'servizio' || !!(values.link_azione?.trim() && values.etichetta_bottone?.trim())
  if (id === 'servizio' && !!values.link_azione?.trim() !== !!values.etichetta_bottone?.trim()) throw new Error('Service action requires both URL and label')
  const buttonUrl = hasButton && template.url ? httpsLink(substitute(template.url, false)) : null
  const button = buttonUrl && template.button ? `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#19434c" style="border-radius:12px"><a href="${escape(buttonUrl)}" style="display:inline-block;padding:17px 24px;color:#fff;text-decoration:none;font-weight:bold">${escape(substitute(template.button, false))}</a></td></tr></table>` : ''
  if (logoUrl) httpsLink(logoUrl)
  if (assetBase) httpsLink(assetBase)
  const html = renderEmailDesign({id, subject, values, body, button, assetBase})
  const text = substitute(template.body.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ''), false)
  return { subject, html, text: `${substitute(template.title, false)}\n\n${text}${buttonUrl ? `\n\n${substitute(template.button || "", false)}: ${buttonUrl}` : ''}\n\nAssistenza: ${support}` }
}
