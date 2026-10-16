import {publicMenuAliases} from './public-menu-aliases.mjs';
// Only routing is new. All screens are shared with the existing customer web app.
const segment=value=>{try{const decoded=decodeURIComponent(value);return decoded.length>0&&decoded.length<=512&&!/[\x00-\x1f\x7f/\\]/.test(decoded)&&decoded!=='.'&&decoded!=='..'?decoded:null;}catch{return null;}};
export function parseStaticRoute(pathname) {
 if(typeof pathname!=='string'||!pathname.startsWith('/')||pathname.startsWith('//'))return {kind:'not-found'};
 const path=pathname.split(/[?#]/,1)[0].replace(/\/$/,'')||'/';
 if(path==='/')return {kind:'home'};
 if(path==='/privacy')return {kind:'privacy'};
 const alias=path.slice(1);if(Object.hasOwn(publicMenuAliases,alias))return {kind:'digital-menu',restaurantId:publicMenuAliases[alias]};
 let privateRoute=path.match(/^\/(onboarding-preview|onboarding-claim|trial-menu|leads-demo)\/([^/]+)$/);if(privateRoute){const token=segment(privateRoute[2]);return token?{kind:privateRoute[1],token}:{kind:'not-found'};}
 let m=path.match(/^\/r\/([^/]+)\/t\/([^/]+)$/);if(m){const restaurantId=segment(m[1]),token=segment(m[2]);return restaurantId&&token?{kind:'table',restaurantId,token}:{kind:'not-found'};}
 m=path.match(/^\/r\/([^/]+)\/menu$/);if(m){const restaurantId=segment(m[1]);return restaurantId?{kind:'digital-menu',restaurantId}:{kind:'not-found'};}
 m=path.match(/^\/(prenota|menu-preview)\/([^/]+)$/);if(m){const id=segment(m[2]);if(!id)return {kind:'not-found'};return m[1]==='menu-preview'?{kind:'menu-preview',menuId:id}:{kind:'reservation',restaurantId:id};}
 return {kind:'not-found'};
}
