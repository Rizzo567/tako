/** Matches existing menu-i18n's lowercase keys; accepts legacy locale underscores. */
export function supportedMenuLanguage(value:unknown):string|null{
 if(typeof value!=='string')return null
 const normalized=value.trim().replace(/_/g,'-').toLowerCase()
 return /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(normalized)?normalized:null
}
export function baselineLanguageConfiguration(settings:{languages?:unknown;defaultLanguage?:unknown}|null|undefined,observed:string[]){
 const configured=(Array.isArray(settings?.languages)?settings.languages:[]).map(supportedMenuLanguage).filter((l):l is string=>!!l)
 const defaultLanguage=supportedMenuLanguage(settings?.defaultLanguage)??configured[0]??'it'
 const languages=[...new Set([...configured,defaultLanguage,...observed.map(supportedMenuLanguage).filter((l):l is string=>!!l)])]
 // Never silently drop configured or imported language data to meet the UI limit.
 if(languages.length>30)throw new Error('Il menu contiene più di 30 lingue: serve riconciliare la configurazione prima di inizializzare l’editor')
 return {languages,defaultLanguage}
}
export function normalizeBaselineTranslations<T>(translations:Record<string,T>):Record<string,T>{
 const result:Record<string,T>={};for(const [key,value]of Object.entries(translations)){const normalized=supportedMenuLanguage(key);result[normalized??key]=value}return result
}
