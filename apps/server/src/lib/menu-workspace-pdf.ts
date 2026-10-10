import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadRemoteImage, remoteStorageEnabled, imageObjectKey } from './remote-image-store.js'
import { publicWorkspace } from './menu-workspace-schedule.js'
import { foodCatalogs } from './menu-workspace-catalogs.js'
import type { Workspace } from './menu-workspace-contract.js'
const fonts=fileURLToPath(new URL('../../assets/fonts/',import.meta.url))
type Element='name'|'price'|'description'|'category'|'menu'|'footer'|'legend'|'subcategory'|'allergens'|'traits'|'additives'
type Area='menu'|'category'|'subcategory'|'item'|'description'|'legend'|'logo'
type Style={font:Workspace['pdf']['font'];fontSize:number;color:string;bold:boolean;italic:boolean;underline:boolean;align:'left'|'center'|'right'}
export async function renderWorkspacePdf(workspace:Workspace,menuIds:string[],language:string,title:string,restaurantId:string):Promise<Buffer>{
 if(!workspace.languages.includes(language))throw new Error('Unsupported PDF language')
 const cfg=workspace.pdf,lang=cfg.translationActive===false?workspace.defaultLanguage:language
 const w=publicWorkspace(cfg.includeUnavailable?{...workspace,menus:workspace.menus.map(m=>({...m,sections:m.sections.map(s=>({...s,items:s.items.map(i=>({...i,available:true}))}))}))}:workspace)
 const top=cfg.marginTop??cfg.margin,right=cfg.marginRight??cfg.margin,bottom=cfg.marginBottom??cfg.margin,left=cfg.marginLeft??cfg.margin
 const doc=new PDFDocument({size:cfg.format,layout:cfg.orientation,margins:{top,right,bottom,left},bufferPages:true,info:{Title:title,Creator:'Tako'}})
 const chunks:Buffer[]=[];const completed=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>chunks.push(Buffer.from(c)));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)})
 const families={sans:'NotoSans',serif:'NotoSerif',mono:'NotoSansMono',poppins:'Poppins',staatliches:'Staatliches',amaranth:'Amaranth',italiana:'Italiana'}
 const registered=new Set<string>()
 const choose=(value:string,style:Style)=>{
  const family=/[\u0600-\u06ff]/.test(value)?'NotoSansArabic':/[\u0590-\u05ff]/.test(value)?'NotoSansHebrew':families[style.font]
  const face=style.bold&&style.italic?'BoldItalic':style.bold?'Bold':style.italic?'Italic':'Regular'
  const desired=join(fonts,`${family}-${face}.ttf`),regular=join(fonts,`${family}-Regular.ttf`)
  const file=existsSync(desired)?desired:regular
  if(!existsSync(file))throw new Error('Bundled PDF font unavailable')
  if(!registered.has(file)){doc.registerFont(file,file);registered.add(file)}doc.font(file).fontSize(style.fontSize)
  return {oblique:style.italic&&!existsSync(desired),syntheticBold:style.bold&&!existsSync(desired)}
 }
 const style=(element:Element):Style=>({font:cfg.font,fontSize:element==='category'||element==='subcategory'?cfg.headingFontSize-2:element==='menu'?cfg.headingFontSize:element==='footer'?8:element==='description'||element==='legend'?cfg.fontSize-1:cfg.fontSize,color:element==='category'||element==='subcategory'||element==='menu'?cfg.headingColor:cfg.textColor,bold:element==='name'?cfg.nameBold:element==='category'||element==='subcategory'||element==='menu',italic:element==='description'&&cfg.descriptionItalic,underline:false,align:cfg.alignment,...cfg.typography?.[element]})
 const fs=style('footer');choose(cfg.footer||'1 / 1',fs);const footerHeight=(cfg.footer||cfg.showPageNumbers)?doc.currentLineHeight()+8:0
 const width=doc.page.width,height=doc.page.height,bodyBottom=height-bottom-footerHeight-8,gap=20,columnWidth=(width-left-right-gap*(cfg.columns-1))/cfg.columns
 let column=0,y=top,page=0
 type Op={page:number;column:number;y:number;height:number;draw:(offset:number)=>void}
 const ops:Op[]=[]
 const x=()=>left+column*(columnWidth+gap)
 const advance=()=>{column++;if(column>=cfg.columns){doc.addPage();page++;column=0}y=top}
 const newPage=()=>{doc.addPage();page++;column=0;y=top}
 const space=(area:Area)=>cfg.spaces?.[area]??{top:0,right:0,bottom:0,left:0}
 const add=(h:number,draw:(offset:number)=>void)=>{ops.push({page,column,y,height:h,draw});y+=h}
 const drawText=(value:string,px:number,py:number,available:number,s:Style)=>{
  doc.save();const face=choose(value,s);doc.fillColor(s.color).strokeColor(s.color).lineWidth(Math.max(.15,s.fontSize*.025))
  const rtl=/[\u0590-\u06ff]/.test(value)
  if(rtl){let cursor=px+available;for(const word of value.split(/\s+/)){choose(word,s);const ww=doc.widthOfString(word);cursor-=ww;doc.text(word,cursor,py,{lineBreak:false,underline:s.underline,oblique:face.oblique?12:false,fill:true,stroke:face.syntheticBold});cursor-=s.fontSize*.3}}
  else doc.text(value,px,py,{width:available,align:s.align,lineBreak:false,underline:s.underline,oblique:face.oblique?12:false,fill:true,stroke:face.syntheticBold})
  doc.restore()
 }
 const linesFor=(value:string,s:Style,available:number)=>{choose(value,s);const lines:string[]=[];for(const paragraph of value.split('\n')){let line='';for(const wholeWord of paragraph.split(/\s+/)){if(!wholeWord)continue;const words:string[]=[];let part='';for(const ch of wholeWord){if(part&&doc.widthOfString(part+ch)>available){words.push(part);part=ch}else part+=ch}if(part)words.push(part);for(const word of words){const candidate=line?`${line} ${word}`:word;if(doc.widthOfString(candidate)>available&&line){lines.push(line);line=word}else line=candidate}}lines.push(line)}return lines}
 const write=(value:string,element:Element,spacing=6,area:Area='item',override:Partial<Style>={})=>{
  const s={...style(element),...override},a=space(area),available=Math.max(24,columnWidth-a.left-a.right)
  y+=a.top
  for(const text of linesFor(value,s,available)){choose(text,s);const h=doc.currentLineHeight()+2;if(y+h>bodyBottom)advance();const px=x()+a.left,py=y;add(h,offset=>drawText(text,px,py+offset,available,s))}
  y+=spacing+a.bottom
 }
 const imageCache=new Map<string,Buffer|null>();let imageBytes=0
 const image=async(url:string|null|undefined)=>{if(!url?.startsWith(`/uploads/${restaurantId}/`))return null;if(imageCache.has(url))return imageCache.get(url)!;try{const filename=url.split('/').pop()!;imageObjectKey(restaurantId,filename);const bytes=remoteStorageEnabled()?await(async()=>{const response=await downloadRemoteImage(restaurantId,filename);if(!response.ok)throw new Error('Image unavailable');return Buffer.from(await response.arrayBuffer())})():await readFile(join(process.env.UPLOADS_DIR??'uploads',restaurantId,filename));imageBytes+=bytes.length;if(bytes.length>10*1024*1024||imageBytes>40*1024*1024)throw new Error('Image limit');imageCache.set(url,bytes);return bytes}catch{imageCache.set(url,null);return null}}
 const background=await image(cfg.backgroundImageUrl)
 if(cfg.showLogo){const logo=await image(w.design.logoUrl);if(logo){const a=space('logo');y+=a.top;const px=x()+a.left,py=y;add(60,offset=>{const yy=py+offset;doc.save();if(cfg.logoShape==='circle')doc.circle(px+30,yy+30,30).clip();else if(cfg.logoShape==='rounded')doc.roundedRect(px,yy,60,60,10).clip();else doc.rect(px,yy,60,60).clip();if(cfg.logoBackground)doc.rect(px,yy,60,60).fill(cfg.logoBackground);doc.image(logo,px,yy,{fit:[Math.max(16,60-a.right),60]});doc.restore()});y+=10+a.bottom}}
 if(cfg.showCover){write(title,'menu',16,'menu',{fontSize:28});write(w.design.headerDescription||'Menu','description',6,'description');newPage()}
 if(cfg.showDate)write(new Intl.DateTimeFormat(lang,{dateStyle:'long'}).format(new Date()),'footer')
 for(const m of w.menus.filter(m=>menuIds.includes(m.id))){const mt=m.translations[lang];if(cfg.translationPolicy==='translated-only'&&lang!==w.defaultLanguage&&!mt)continue;if(y+70>bodyBottom)advance();if(cfg.showMenuName)write(mt?.name??m.name,'menu',12,'menu')
  for(const section of m.sections){const st=section.translations[lang];if(cfg.translationPolicy==='translated-only'&&lang!==w.defaultLanguage&&!st)continue;if(cfg.categoryPageBreak&&y>top)newPage();else if(y+80>bodyBottom)advance();write(st?.name??section.name,section.parentSectionId?'subcategory':'category',8,section.parentSectionId?'subcategory':'category');if(cfg.showDescriptions&&(st?.description??section.description))write(st?.description??section.description??'','description',6,'description')
   for(const item of section.items){const t=item.translations[lang];if(cfg.translationPolicy==='translated-only'&&lang!==w.defaultLanguage&&!t)continue
    const translatedName=cfg.translationNamesPolicy==='auto'&&(item.description||t?.description)?item.name:t?.name??item.name
    const description=cfg.showDescriptions?t?.description??item.description??'':''
    const align=item.displayMode==='centered'?'center':cfg.alignment,ns={...style('name'),align:cfg.typography?.name?.align??align},ps={...style('price'),align:cfg.typography?.price?.align??'right' as const}
    const price=cfg.showPrices?(item.priceDisplay??new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(item.price)):''
    const a=space('item'),available=Math.max(24,columnWidth-a.left-a.right),priceWidth=price?Math.min(available*.45,Math.max(45,price.length*ps.fontSize*.65)):0,nameWidth=Math.max(24,available-priceWidth-(price?8:0))
    const nameLines=linesFor(translatedName,ns,nameWidth),priceLines=price?linesFor(price,ps,priceWidth):[],lineCount=Math.max(nameLines.length,priceLines.length);choose(translatedName,ns);const nameHeight=doc.currentLineHeight()+2;choose(price,ps);const rowHeight=Math.max(nameHeight,doc.currentLineHeight()+2)
    const needed=lineCount*rowHeight+(description?style('description').fontSize*2:0)+a.top+a.bottom+24;if(y+needed>bodyBottom&&needed<bodyBottom-top)advance()
    if(cfg.showImages){const bytes=await image(item.imageUrl);if(bytes){if(y+90>bodyBottom)advance();const px=x(),py=y;add(80,offset=>doc.image(bytes,px,py+offset,{fit:[columnWidth,80]}));y+=8}}
    y+=a.top
    for(let n=0;n<lineCount;n++){if(y+rowHeight>bodyBottom)advance();const px=x()+a.left,py=y,text=nameLines[n]??'';add(rowHeight,offset=>{drawText(text,px,py+offset,nameWidth,ns);if(priceLines[n])drawText(priceLines[n]!,px+available-priceWidth,py+offset,priceWidth,ps)})}y+=4+a.bottom
    if(description)write(description,'description',4,'description',{align:cfg.typography?.description?.align??align})
    if(cfg.showAllergens&&item.allergens.length)write(`${w.foodTranslations[lang]?.allergens??'Allergeni'}: ${item.allergens.map(id=>w.foodTranslations[lang]?.[id]??id).join(', ')}`,'allergens',4,'legend')
    if(item.tags.length)write(item.tags.map(id=>w.foodTranslations[lang]?.[id]??foodCatalogs.traits.find(t=>t.id===id)?.label??id).join(', '),'traits',4,'legend')
    if(item.additives.length)write(item.additives.map(id=>w.foodTranslations[lang]?.[id]??foodCatalogs.additives.find(t=>t.id===id)?.label??id).join(', '),'additives',4,'legend')
    for(const variant of item.variants.filter(v=>v.available)){write(variant.name,'name',4);if(cfg.showPrices)write(new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(item.price+variant.priceModifier),'price',4)}y+=8
   }
  }
 }
 const legends=cfg.legends??{allergens:cfg.showFoodLegends,traits:false,additives:false}
 for(const key of ['allergens','traits','additives'] as const)if(legends[key]){write(w.foodTranslations[lang]?.[key]??({allergens:'Allergeni',traits:'Specifiche alimentari',additives:'Additivi'}[key]),'category',8,'legend');for(const entry of foodCatalogs[key])write(`${'number' in entry?entry.number+'. ':''}${w.foodTranslations[lang]?.[entry.id]??entry.label}`,key,2,'legend')}
 if(cfg.showQr&&process.env.WEB_ORIGIN){const qr=await QRCode.toBuffer(`${process.env.WEB_ORIGIN}/r/${restaurantId}/menu${menuIds.length===1?'?menuId='+menuIds[0]:''}`,{width:160,margin:1});if(y+100>bodyBottom)advance();const px=x(),py=y;add(80,offset=>doc.image(qr,px,py+offset,{width:80}));y+=8}
 const range=doc.bufferedPageRange()
 for(let p=range.start;p<range.start+range.count;p++){
  doc.switchToPage(p);doc.save().rect(0,0,width,height).fill(cfg.background).restore()
  if(background){doc.save().opacity(cfg.backgroundOpacity);const options=cfg.backgroundSize==='cover'?{cover:[width,height] as [number,number]}:{fit:[width,height] as [number,number]};doc.image(background,0,0,options);doc.restore()}
  for(let c=0;c<cfg.columns;c++){const list=ops.filter(op=>op.page===p&&op.column===c),last=list.at(-1);const offset=cfg.verticalCentered&&last?Math.max(0,(bodyBottom-top-(last.y+last.height-top))/2):0;for(const op of list)op.draw(offset)}
  const footer=[cfg.footer,cfg.showPageNumbers?`${p+1} / ${range.count}`:''].filter(Boolean).join(' · ');if(footer)drawText(footer,left,height-bottom-footerHeight,width-left-right,{...style('footer'),align:cfg.typography?.footer?.align??'center'})
 }
 doc.end();return completed
}
