import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const dir=fileURLToPath(new URL('.',import.meta.url))
export default defineConfig({
 root:dir,
 publicDir:resolve(dir,'../web/public'),
 envDir:dir,
 resolve:{alias:[{find:'@/lib/socket',replacement:resolve(dir,'src/socket-polling.ts')},{find:'@/lib/api',replacement:resolve(dir,'src/api-polling.ts')},{find:'next/link',replacement:resolve(dir,'src/next-link.tsx')},{find:'@',replacement:resolve(dir,'../web/src')}],dedupe:['react','react-dom']},
 oxc:{jsx:{runtime:'automatic'}},
 css:{postcss:dir},
 build:{outDir:resolve(dir,'../../release/serverless/customer'),emptyOutDir:true,target:'es2020',sourcemap:false,rolldownOptions:{onwarn(warning,defaultHandler){if(warning.code==='MODULE_LEVEL_DIRECTIVE'&&warning.message.includes('use client'))return;defaultHandler(warning)}}},
 server:{host:'127.0.0.1',port:5147,strictPort:true,fs:{allow:[resolve(dir,'../web'),dir,resolve(dir,'../../packages')]}}
})
