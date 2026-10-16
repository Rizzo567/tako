import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify'
import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import {requireAuth} from '../middleware/auth.js'
import {isAgencyUser} from '../lib/agency-access.js'
import {summarizeAgencyRestaurant} from '../lib/agency-overview.js'
import {readAgencyMe} from '../lib/read-queries.js'
export const agencyOverviewQuery=sql`SELECT r.id,r.name,r.slug,r.logo_url,r.settings,w.revision,w.published_revision,w.draft,GREATEST(r.updated_at,w.updated_at) AS updated_at,
 (SELECT count(*)::int FROM menus m WHERE m.restaurant_id=r.id) AS menu_count,
 (SELECT count(*)::int FROM menu_items i WHERE i.restaurant_id=r.id) AS dish_count
 FROM restaurants r LEFT JOIN menu_workspaces w ON w.restaurant_id=r.id WHERE r.active=true ORDER BY lower(r.name),r.id`
type Dependencies={authenticate?:(req:FastifyRequest,reply:FastifyReply)=>Promise<unknown>;loadOverview?:()=>Promise<any[]>;env?:NodeJS.ProcessEnv}
export async function agencyRoutes(app:FastifyInstance,options:Dependencies={}){
 const authenticate=options.authenticate??requireAuth,env=options.env??process.env
 const guard=async(req:FastifyRequest,reply:FastifyReply)=>{await authenticate(req,reply);if(reply.sent)return;if(!req.user||!isAgencyUser(req.user.id,env))return reply.code(403).send({error:{code:'AGENCY_FORBIDDEN',message:'Accesso riservato a Serie B Agency.'}})}
 app.get('/me',{preHandler:authenticate},async(req,reply)=>{const r=readAgencyMe(req.user!.id,env);return reply.code(r.status).send(r.body)})
 app.get('/restaurants',{preHandler:guard},async()=>{const rows=await (options.loadOverview??(()=>db.execute(agencyOverviewQuery)))();return {data:rows.map(summarizeAgencyRestaurant)}})
}
