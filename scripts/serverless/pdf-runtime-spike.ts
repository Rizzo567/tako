// Deno compatibility/budget spike. No network calls, database, credentials or files written.
import PDFDocument from 'npm:pdfkit@0.17.2';
import {fileURLToPath} from 'node:url';
const start=performance.now();
const doc=new PDFDocument({size:'A4',margin:36});
const bytes:Uint8Array[]=[];
const done=new Promise<void>((resolve,reject)=>{doc.on('data',(b:Uint8Array)=>bytes.push(b));doc.on('end',resolve);doc.on('error',reject)});
for(const [font,text] of [['NotoSans-Regular.ttf','Menu Tako — Pasta al pomodoro 12,00 €'],['NotoSansArabic-Regular.ttf','قائمة الطعام'],['NotoSansCJKsc-Regular.otf','餐厅菜单 意大利面'],['NotoSansCJKjp-Regular.otf','レストラン メニュー パスタ']]) {
 doc.font(fileURLToPath(new URL('../../apps/server/assets/fonts/'+font,import.meta.url))).fontSize(12);
 for(let i=0;i<270;i++)doc.text(text);
 doc.addPage();
}
doc.end();await done;
const result={elapsedMs:Math.round(performance.now()-start),rssMiB:Math.round(Deno.memoryUsage().rss/1024/1024),pdfBytes:bytes.reduce((sum,b)=>sum+b.byteLength,0)};
console.log(JSON.stringify(result));
