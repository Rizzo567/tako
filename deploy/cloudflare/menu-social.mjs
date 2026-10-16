import {menuSocialData} from './menu-social-data.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Social crawlers do not run the customer app: metadata must be in initial HTML. */
export async function menuSocialDocument(response,route,method='GET'){
 const menu=route.kind==='digital-menu'?menuSocialData[route.restaurantId]:null;
 if(!menu||!response.ok||method==='HEAD')return response;
 const title=`${menu.name} - Menu digitale`,description=`Scopri il menu di ${menu.name}: piatti, prezzi e informazioni.`,url=`https://takoitalia.com/${menu.slug}`;
 let html=await response.text();
 html=html.replace(/<title>[^<]*<\/title>/i,`<title>${escape(title)}</title>`).replace(/<meta\b(?=[^>]*(?:property|name)=["'](?:og:|twitter:|description)[^"']*["'])[^>]*>/gi,'');
 const tags=[['name','description',description],['property','og:type','website'],['property','og:site_name','Takomenu'],['property','og:title',title],['property','og:description',description],['property','og:url',url],['property','og:image',menu.image],['property','og:image:type','image/jpeg'],['property','og:image:width',menu.width],['property','og:image:height',menu.height],['property','og:image:alt',`Menu di ${menu.name}`],['name','twitter:card','summary_large_image'],['name','twitter:title',title],['name','twitter:description',description],['name','twitter:image',menu.image]].map(([attribute,key,value])=>`<meta ${attribute}="${key}" content="${escape(value)}"/>`).join('');
 html=html.replace('</head>',tags+`<link rel="canonical" href="${escape(url)}"/></head>`);
 const headers=new Headers(response.headers);for(const key of ['Content-Length','Content-Encoding','ETag'])headers.delete(key);headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','no-store');
 return new Response(html,{status:response.status,headers});
}
