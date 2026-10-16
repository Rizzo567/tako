import {defineConfig} from 'vitest/config'
import {fileURLToPath} from 'node:url'
export default defineConfig({test:{include:['docs/webapp/whatsapp-fix-2026-10-16/verify2/*.test.ts'],root:fileURLToPath(new URL('../../../../',import.meta.url)),testTimeout:20000,pool:'forks'}})
