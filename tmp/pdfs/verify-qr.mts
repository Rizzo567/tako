import { writeFile } from 'node:fs/promises'
import { digitalMenuUrl,renderDigitalQr } from '../../apps/server/src/lib/menu-workspace-qr.js'
process.env.NODE_ENV='development';process.env.WEB_ORIGIN='http://localhost:5137'
const url=digitalMenuUrl('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')
await writeFile('tmp/pdfs/qr-check.png',await renderDigitalQr(url,'png'))
await writeFile('tmp/pdfs/qr-expected.txt',url)
