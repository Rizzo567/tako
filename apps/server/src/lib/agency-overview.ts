import {foodCatalogs} from './menu-workspace-catalogs.js'
export const AGENCY_LANGUAGES=['it','en','fr','de','es','pt','nl','pl','ru','ar','zh','ja'] as const
const text=(value:unknown)=>typeof value==='string'&&value.trim().length>0
const rows=(value:any)=>Array.isArray(value)?value:[]
const fingerprint=(entity:any)=>{let hash=2166136261;const source=JSON.stringify([entity.name,entity.description||'']);for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619)}return `v1:${(hash>>>0).toString(16)}`}
/** Summarizes actual stored draft only; it never initializes or mutates a workspace. */
export function summarizeAgencyRestaurant(row:any){
 const draft=row.draft&&typeof row.draft==='object'?row.draft:null,menus=rows(draft?.menus)
 const entities=menus.flatMap(m=>[m,...rows(m.sections).flatMap(s=>[s,...rows(s.items)])])
 const food=['allergens',...foodCatalogs.allergens.map(c=>c.id),...foodCatalogs.traits.map(c=>c.id),...foodCatalogs.additives.map(c=>c.id)]
 const translations=AGENCY_LANGUAGES.map(language=>{
  const original=language===(draft?.defaultLanguage||'it');let complete=0,stale=0
  for(const entity of entities){const t=entity.translations?.[language];if(original||(text(t?.name)&&(!text(entity.description)||text(t?.description))))complete++;if(!original&&t?.sourceFingerprint&&t.sourceFingerprint!==fingerprint(entity))stale++}
  const legendsComplete=original?food.length:food.filter(id=>text(draft?.foodTranslations?.[language]?.[id])).length
  return {language,complete,total:entities.length,legendsComplete,legendsTotal:food.length,stale,ready:!!draft&&entities.length>0&&complete===entities.length&&legendsComplete===food.length&&stale===0}
 })
 const revision=row.revision==null?null:Number(row.revision),publishedRevision=row.published_revision==null?null:Number(row.published_revision)
 return {id:String(row.id),name:String(row.name||''),slug:String(row.slug||''),logoUrl:draft?.design?.logoUrl||row.logo_url||null,
  menuCount:draft?menus.length:Number(row.menu_count||0),dishCount:draft?new Set(menus.flatMap(m=>rows(m.sections).flatMap(s=>rows(s.items).map(i=>i.id))).filter(Boolean)).size:Number(row.dish_count||0),
  revision,publishedRevision,status:!draft?'unconfigured':publishedRevision===null?'unpublished':publishedRevision===revision?'published':'draft',
  translations,completeLanguages:translations.filter(t=>t.ready).length,requiredLanguages:AGENCY_LANGUAGES.length,updatedAt:row.updated_at instanceof Date?row.updated_at.toISOString():row.updated_at||null}
}
