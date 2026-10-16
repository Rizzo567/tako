import {publicMenuPaths} from './public-menu-paths.js'
import { webOrigin } from './web-runtime.js'
export function digitalMenuUrl(restaurantId:string,menuId?:string):string{
 if(!/^[0-9a-f-]{36}$/i.test(restaurantId)||(menuId&&!/^[0-9a-f-]{36}$/i.test(menuId)))throw new Error('Invalid QR resource')
 return `${webOrigin()}${publicMenuPaths[restaurantId]||`/r/${restaurantId}/menu`}${menuId?'?menuId='+encodeURIComponent(menuId):''}`
}
export async function renderDigitalQr(url:string,format:'png'|'svg'){
 const {default:QRCode}=await import('qrcode');
 return format==='svg'?QRCode.toString(url,{type:'svg',width:512,margin:2,errorCorrectionLevel:'M'}):QRCode.toBuffer(url,{width:512,margin:2,errorCorrectionLevel:'M'})
}
