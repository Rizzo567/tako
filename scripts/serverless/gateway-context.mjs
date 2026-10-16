/** Backend-only verification of a gateway secret over TLS. Browser identity headers
 * are discarded; client IP is trusted only after this guard. Never put the secret
 * in frontend assets or allow direct backend calls without it. */
export function verifyGatewayContext(request, {secret, origin}) {
 if(typeof secret!=='string'||secret.length<32)throw new Error('Gateway secret missing');
 const received=request.headers.get('x-tako-gateway-secret')||'';
 // Fixed-size comparison avoids an early-exit character comparison.
 let difference=received.length^secret.length;
 for(let i=0;i<secret.length;i++)difference|=secret.charCodeAt(i)^(received.charCodeAt(i)||0);
 if(difference)return null;
 const source=request.headers.get('x-tako-gateway-origin');
 if(source!==origin)return null;
 const ip=request.headers.get('x-tako-client-ip')||'';
 // No hostname, comma-separated proxy chain, zone or whitespace is accepted.
 if(!/^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{2,45})$/i.test(ip))return null;
 if(ip.includes('.')&&ip.split('.').some(n=>Number(n)>255))return null;
 if(!ip.includes('.')&&(!ip.includes(':')||ip.split(':').some(n=>n.length>4)))return null;
 return {ip,origin:source};
}
