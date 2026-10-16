import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify'
import {requireAuth} from '../middleware/auth.js'
import {isAgencyUser} from '../lib/agency-access.js'
import {agencyLeadStore,leadPatchSchema,leadActivitySchema,LeadError} from '../lib/agency-leads.js'
type Dependencies={authenticate?:(req:FastifyRequest,reply:FastifyReply)=>Promise<unknown>;store?:typeof agencyLeadStore;env?:NodeJS.ProcessEnv}
export async function agencyLeadRoutes(app:FastifyInstance,options:Dependencies={}){
 const authenticate=options.authenticate??requireAuth,store=options.store??agencyLeadStore,env=options.env??process.env
 const guard=async(req:FastifyRequest,reply:FastifyReply)=>{await authenticate(req,reply);if(reply.sent)return;if(!req.user||!isAgencyUser(req.user.id,env))return reply.code(403).send({error:{code:'AGENCY_FORBIDDEN',message:'Accesso riservato all’agenzia.'}})}
 const params={type:'object',required:['id'],properties:{id:{type:'string',minLength:1,maxLength:100,pattern:'^[A-Za-z0-9_-]+$'}},additionalProperties:false}
 const failure=(error:unknown,reply:FastifyReply)=>{if(error instanceof LeadError)return reply.code(error.code==='NOT_FOUND'?404:409).send({error:{code:error.code,message:error.code==='NOT_FOUND'?'Contatto non trovato.':error.code==='NOT_TRIAL'?'Questo locale non è un menu di prova: non si può rimuovere da qui.':'Il contatto è stato aggiornato da un’altra sessione. Ricarica e riprova.'}});throw error}
 app.get('/preview/:token',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req,reply)=>{reply.header('Cache-Control','no-store').header('X-Robots-Tag','noindex, nofollow, noarchive');const token=(req.params as {token:string}).token;if(!/^[a-f0-9]{64}$/.test(token))return reply.code(404).send({error:{code:'NOT_FOUND',message:'Anteprima non disponibile.'}});try{return await store.preview(token)}catch(e){return failure(e,reply)}})
 app.get('/',{preHandler:guard},async()=>({data:await store.list()}))
 app.get('/:id',{preHandler:guard,schema:{params}},async(req,reply)=>{try{return await store.detail((req.params as {id:string}).id)}catch(e){return failure(e,reply)}})
 app.patch('/:id',{preHandler:guard,schema:{params}},async(req,reply)=>{const input=leadPatchSchema.safeParse(req.body);if(!input.success)return reply.code(400).send({error:{code:'INVALID_INPUT',message:'Controlla i dati del contatto.'}});try{return await store.patch((req.params as {id:string}).id,input.data,req.user!.id)}catch(e){return failure(e,reply)}})
 app.post('/:id/activities',{preHandler:guard,schema:{params}},async(req,reply)=>{const input=leadActivitySchema.safeParse(req.body);if(!input.success)return reply.code(400).send({error:{code:'INVALID_INPUT',message:'Controlla i dati dell’attività.'}});try{return await store.activity((req.params as {id:string}).id,input.data,req.user!.id)}catch(e){return failure(e,reply)}})
}
