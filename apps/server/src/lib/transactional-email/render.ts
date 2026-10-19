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
export function renderTransactionalEmail(id: EmailTemplate, values: Record<string, string>, logoUrl?: string) {
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
  const button = buttonUrl && template.button ? `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#F16A4C" style="border-radius:12px"><a href="${escape(buttonUrl)}" style="display:inline-block;padding:17px 24px;color:#fff;text-decoration:none;font-weight:bold">${escape(substitute(template.button, false))}</a></td></tr></table>` : ''
  const brand = logoUrl ? `<img src="${escape(httpsLink(logoUrl))}" width="180" alt="Takomenu" style="display:block;width:180px;height:auto">` : 'Takomenu'
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#FAF9F6;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e8e2dc;border-radius:24px;overflow:hidden"><tr><td style="height:18px;background:#F16A4C;border-bottom:10px solid #FFEDE5"></td></tr><tr><td style="padding:32px 32px 20px;color:#292724;font-size:28px;font-weight:bold">${brand}</td></tr><tr><td style="padding:10px 32px 32px"><h1 style="margin:0 0 22px;color:#292724;font-size:28px">${title}</h1><div style="font-size:17px;line-height:1.65;color:#45413d;margin-bottom:28px">${body}</div>${button}</td></tr><tr><td style="padding:24px 32px;background:#FFEDE5;font-size:13px;line-height:1.6;color:#62544b">Takomenu<br>Hai bisogno di aiuto? <a href="mailto:${support}" style="color:inherit">${support}</a></td></tr></table></td></tr></table></body></html>`
  const text = substitute(template.body.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ''), false)
  return { subject, html, text: `${substitute(template.title, false)}\n\n${text}${buttonUrl ? `\n\n${template.button}: ${buttonUrl}` : ''}\n\nAssistenza: ${support}` }
}
