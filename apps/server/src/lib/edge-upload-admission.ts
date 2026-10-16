import type {FastifyInstance} from 'fastify'
/** Per-worker memory admission, independent of durable per-tenant byte quota. */
export function registerEdgeUploadAdmission(app:FastifyInstance,maxConcurrent=2){
 if(!Number.isInteger(maxConcurrent)||maxConcurrent<1)throw new Error('Invalid upload admission limit')
 let active=0;const admitted=new WeakSet<object>()
 const release=(request:object)=>{if(admitted.delete(request))active--}
 app.addHook('onRequest',async(request,reply)=>{
  const path=request.url.split('?')[0]||''
  const upload=request.method==='POST'&&(/^\/api\/menu-workspace\/assets\/?$/.test(path)||/^\/api\/uploads\/image\/?$/.test(path)||/^\/api\/menus\/items\/[^/]+\/image\/?$/.test(path))
  if(!upload)return
  if(active>=maxConcurrent)return reply.code(503).header('Retry-After','2').send({error:{code:'IMAGE_CODEC_BUSY',message:'Elaborazione immagini occupata. Riprova tra poco.'}})
  active++;admitted.add(request)
 })
 app.addHook('onResponse',async request=>{release(request)})
 app.addHook('onError',async request=>{release(request)})
 // A client timeout does not prove the encoder stopped. Keep its slot until
 // completion/error (or worker disposal) rather than oversubscribing memory.
}
