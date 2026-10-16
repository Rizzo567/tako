// Deterministic quality gate for generated menu translations (no model involved).
//
// Brand rule (explicit): a translated NAME identical to the Italian source is VALID — brands, wines, cocktails,
// beers and dish proper names ("Negroni", "Gin Mare", "Rigatoni cacio e pepe") may stay unchanged.
// Exception, only for values coming from an old cache (`strict`): a name that reads as an ordinary Italian phrase
// (>=4 words including an Italian function word, e.g. "Per i Più Piccoli") is regenerated once; if the fresh
// generation keeps it identical, it is accepted as a deliberate choice.
// A DESCRIPTION identical to the source is valid only when it does not read as Italian prose (>=4 words with a
// function word); ingredient lists of brands such as "Gin, Vermouth rosso, Bitter" stay valid.
const fn=/(^|[^\p{L}])(di|con|e|al|alla|alle|allo|ai|agli|del|della|delle|dei|degli|dello|in|su|sul|sulla|per|il|la|le|lo|gli|da|dal|dalla|nel|nella|ed|oppure|servit[oaie]|accompagnat[oaie]|nostr[oaie]|fresc[oaie]|prezzo|scelta)(?=$|[^\p{L}])/iu;
const words=s=>(s.match(/\p{L}+/gu)||[]);
export const italianProse=(s,minWords)=>words(s).length>=minWords&&fn.test(s);
const groups=(s,min=1)=>(s.match(/\d+/g)||[]).filter(g=>g.length>=min);
function containsAll(source,target){const pool=[...target];for(const g of source){const i=pool.indexOf(g);if(i<0)return false;pool.splice(i,1)}return true}
const norm=s=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function trigrams(s){const t=' '+norm(s)+' ',set=new Set();for(let i=0;i<t.length-2;i++)set.add(t.slice(i,i+3));return set}
export function similarity(a,b){const x=trigrams(a),y=trigrams(b);if(!x.size||!y.size)return 0;let n=0;for(const g of x)if(y.has(g))n++;return 2*n/(x.size+y.size)}
const script={cyr:/\p{Script=Cyrillic}/u,arab:/\p{Script=Arabic}/u,han:/\p{Script=Han}/u,kana:/[\p{Script=Hiragana}\p{Script=Katakana}]/u};
const allowed={ru:['cyr'],ar:['arab'],zh:['han'],ja:['han','kana']};
// Foreign script = a non-Latin script that is neither expected for the language nor present in the source.
function foreignScript(language,source,text){const ok=allowed[language]||[];return Object.entries(script).some(([k,re])=>!ok.includes(k)&&re.test(text)&&!re.test(source))}
const hasExpectedScript=(language,text)=>(allowed[language]||[]).some(k=>script[k].test(text));
const stop={
 it:['è','sono','per','da','non','chiedere','con','di','della','delle','dello','alla','alle','al','del','dei','e','il','gli','servito','servita','nostro','nostra','oppure','sugo','un','una','in'],
 en:['to','be','is','are','for','from','price','ask','staff','the','and','with','of','our','served','or','sauce','cheese','topped','fried','fresh'],
 fr:['est','sont','pour','sur','et','avec','aux','du','des','les','le','sauce','fromage','servi','frais','à','au','de','en','une','un','nez','bouche'],
 de:['ist','sind','für','zu','ein','eine','nach','wahl','und','mit','der','die','das','von','aus','auf','frisch','soße','sauce','käse','serviert','oder'],
 es:['es','son','para','por','y','con','los','las','del','el','salsa','queso','servido','fresco','o','de','en','un','una','al'],
 pt:['é','são','para','por','não','em','com','ao','dos','das','do','da','molho','queijo','servido','fresco','ou','e','de','em','um','uma','no','na'],
 nl:['te','nog','zijn','die','voor','bij','is','naar','keuze','en','met','het','van','een','op','saus','kaas','vers','geserveerd','of','de'],
 pl:['jest','są','dla','do','od','z','i','w','ze','oraz','sos','ser','podawany','lub','na']};
const marks={pl:/[łśżźąęćń]/iu,de:/[ßäöü]/iu,es:/[ñ¿¡]/iu,pt:/[ãõ]/iu,fr:/[èêœ]/iu,nl:/ij|ë/iu};
/** Rough stopword language guess for Latin-script prose; returns null when not confident. */
export function guessLanguage(text,{marksWeight=1}={}){const toks=(text.toLowerCase().match(/\p{L}+/gu)||[]);if(toks.length<4)return null;const score={};for(const [l,list] of Object.entries(stop)){const set=new Set(list);score[l]=toks.filter(t=>set.has(t)).length+(marks[l]?.test(text)?marksWeight:0)}const ranked=Object.entries(score).sort((a,b)=>b[1]-a[1]);const [best,second]=ranked;if(best[1]<2||best[1]<second[1]*2)return null;return best[0]}
// Reasons that indicate a misaligned multi-target batch: all languages of that source are regenerated.
export const SHUFFLE_REASONS=new Set(['description-equals-name','description-is-name','name-is-description','description-digits','name-wrong-script','description-wrong-script','name-wrong-language','description-wrong-language']);
/** Returns a reason string when the value must not be used, otherwise null. `strict` is used for cached values. */
export function qualityIssue(language,source,value,{strict=false}={}){
 const name=value?.name??'',desc=value?.description??'',sn=source.name??'',sd=source.description?.trim()?source.description:'';
 if(!name.trim())return 'empty-name';if(name.length>4000||desc.length>4000)return 'too-long';
 if(sd&&!desc.trim())return 'empty-description';
 if(foreignScript(language,sn,name))return 'name-wrong-script';
 if(sd&&foreignScript(language,sd,desc))return 'description-wrong-script';
 if(!containsAll(groups(sn,2),groups(name)))return 'name-digits';
 if(sd&&!containsAll(groups(sd),groups(desc)))return 'description-digits';
 if(strict&&name===sn&&italianProse(sn,6))return 'name-untranslated';
 if(!allowed[language]){const g=sd?guessLanguage(desc):null;if(g&&g!==language&&!(g==='it'&&desc===sd&&!italianProse(sd,4))&&guessLanguage(sd)!==g)return 'description-wrong-language';const gn=guessLanguage(name,{marksWeight:0});if(gn&&gn!==language&&gn!==guessLanguage(sn,{marksWeight:0}))return 'name-wrong-language'}
 if(sd){
  if(desc===sd&&italianProse(sd,4))return 'description-untranslated';
  if(allowed[language]&&italianProse(sd,4)&&!hasExpectedScript(language,desc))return 'description-untranslated';
  if(similarity(sn,sd)<0.4){
   if(desc.trim()===name.trim())return 'description-equals-name';
   const dn=similarity(desc,sn),dd=similarity(desc,sd);if(dn>0.5&&dn>dd+0.2)return 'description-is-name';
   const nd=similarity(name,sd),nn=similarity(name,sn);if(sd.length>=25&&nd>0.5&&nd>nn+0.2)return 'name-is-description';
   const r=desc.length/Math.max(1,sd.length);if(sd.length>=30&&(language==='zh'||language==='ja'?r<0.12:r<0.3))return 'description-truncated';
  }
 }
 return null;
}
