#!/usr/bin/env node
/** Precompile the original shared-global staff SPA; never mutate its source directory. */
import { transform } from 'esbuild';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const pdfjs=dirname(require.resolve('pdfjs-dist/package.json'));

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(repo, 'apps/dashboard/public/staff');
const boot = `(function () {
  var shown = false;
  function panel(msg) {
    if (shown) return;
    var boot = document.getElementById('boot');
    if (!boot) return;
    shown = true;
    boot.replaceChildren();
    var title = document.createElement('b'); title.textContent = 'Tako non si è avviato';
    var detail = document.createElement('small'); detail.textContent = msg || '';
    var help = document.createElement('small'); help.textContent = 'Controlla la connessione e ricarica la pagina. Se il problema continua, contatta l’assistenza Tako.';
    var button = document.createElement('button'); button.textContent = 'Ricarica';
    button.addEventListener('click', function () { location.reload(); });
    boot.append(title, detail, help, button);
  }
  window.addEventListener('error', function (e) { panel((e && e.message) || 'Errore di caricamento'); });
  setTimeout(function () { if (document.getElementById('boot')) panel('Il server non risponde o la pagina non si è caricata.'); }, 12000);
})();\n`;
export async function buildStaffWeb(out = resolve(repo,'release/staff-web')) {
  out = resolve(out);
  if (out === source || out.startsWith(source + '/') || source.startsWith(out + '/')) throw new Error('Output must be separate from the staff source tree');
  let html = await readFile(resolve(source,'index.html'),'utf8');
  const jsx = [...html.matchAll(/<script\b[^>]*type=["']text\/babel["'][^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi)];
  if (!jsx.length) throw new Error('No ordered staff JSX sources found');
  const chunks=[];
  for(const match of jsx) {
    const path=resolve(source,match[1]);const rel=relative(source,path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Staff source path escapes its directory');
    chunks.push(`\n/* Source: ${match[1]} */\n` + await readFile(path,'utf8'));
  }
  // A single lexical scope matches the existing cross-file globals. Compile before
  // removing output so a parser failure preserves the previous generated build.
  const compiled = await transform(chunks.join('\n'),{loader:'jsx',format:'iife',target:['es2020'],minify:true,legalComments:'none'});
  html=html.replace(/<script\b[^>]*>\s*([\s\S]*?)<\/script>/gi,(tag,body)=> /\bsrc\s*=/.test(tag.split('>')[0]) ? tag : '<script src="boot.js"></script>');
  html=html.replace(/<script\b[^>]*src=["']lib\/babel\.js["'][^>]*>\s*<\/script>\s*/gi,'');
  let inserted=false;
  html=html.replace(/<script\b[^>]*type=["']text\/babel["'][^>]*>\s*<\/script>\s*/gi,()=>{if(inserted)return '';inserted=true;return '<script src="app.js"></script>\n';});
  if (/text\/babel|lib\/babel\.js|\bon\w+\s*=/i.test(html) || /<script\b(?![^>]*\bsrc=)/i.test(html)) throw new Error('Generated HTML still needs inline script or Babel');
  await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  await cp(source,out,{recursive:true,filter:path=> {
    const rel=relative(source,path);
    return (!rel.startsWith('src/') || rel.endsWith('.css')) && rel !== 'lib/babel.js' && rel !== 'index.html';
  }});
  await mkdir(resolve(out,'lib/pdfjs'),{recursive:true});
  for(const name of ['pdf.mjs','pdf.worker.mjs']) await cp(resolve(pdfjs,'legacy/build',name),resolve(out,'lib/pdfjs',name));
  for(const name of ['cmaps','standard_fonts','wasm']) await cp(resolve(pdfjs,name),resolve(out,'lib/pdfjs',name),{recursive:true});
  await cp(resolve(pdfjs,'LICENSE'),resolve(out,'lib/pdfjs/LICENSE'));
  await writeFile(resolve(out,'index.html'),html);
  await writeFile(resolve(out,'boot.js'),boot);
  await writeFile(resolve(out,'app.js'),compiled.code);
  return {out,sources:jsx.map(m=>m[1]),bytes:Buffer.byteLength(compiled.code)};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2); const index=args.indexOf('--out');
  if(index>=0 && !args[index+1]) {console.error('Missing --out path');process.exit(1);}
  buildStaffWeb(index>=0 ? args[index+1] : undefined).then(result=>console.log(`Staff web compiled: ${result.sources.length} sources, ${result.bytes} bytes → ${result.out}`)).catch(error=>{console.error(error.message);process.exit(1);});
}
