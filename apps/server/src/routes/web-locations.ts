import type {FastifyInstance} from 'fastify'
import {db,restaurants,menus,users} from '@tako/db'
import {sql,eq,and} from 'drizzle-orm'
import {z} from 'zod'
import {requireAuth,requireRole} from '../middleware/auth.js'
import {SESSION_COOKIE} from '../lib/cookies.js'
const fail=(reply:any,code:number,message:string)=>reply.code(code).send({error:{code:code===404?'NOT_FOUND':'VALIDATION',message}})
export async function webLocationRoutes(app:FastifyInstance){
 app.get('/',{preHandler:requireAuth},async req=>({data:await db.execute(sql`SELECT r.id,r.name,r.slug,CASE WHEN r.id=u.restaurant_id THEN u.role ELSE m.role END AS role FROM users u JOIN restaurants r ON r.id=u.restaurant_id OR r.id IN (SELECT restaurant_id FROM web_location_memberships WHERE user_id=u.id) LEFT JOIN web_location_memberships m ON m.restaurant_id=r.id AND m.user_id=u.id WHERE u.id=${req.user!.id} AND r.active=true ORDER BY r.name`),currentId:req.user!.restaurantId}))
 app.post('/switch',{preHandler:requireAuth},async(req,reply)=>{
 const body=z.object({restaurantId:z.string().uuid()}).safeParse(req.body);if(!body.success)return fail(reply,400,'Locale non valido')
 const rows=await db.execute(sql`SELECT r.id FROM users u JOIN restaurants r ON r.id=${body.data.restaurantId} AND r.active=true WHERE u.id=${req.user!.id} AND (r.id=u.restaurant_id OR EXISTS(SELECT 1 FROM web_location_memberships m WHERE m.user_id=u.id AND m.restaurant_id=r.id))`)
 if(!rows.length)return fail(reply,404,'Locale non trovato')
 const token=req.cookies?.[SESSION_COOKIE]??req.headers.authorization?.replace('Bearer ','')
 await db.execute(sql`INSERT INTO web_session_locations(session_token,restaurant_id) VALUES(${token!},${body.data.restaurantId}) ON CONFLICT(session_token) DO UPDATE SET restaurant_id=excluded.restaurant_id`)
 return {data:{restaurantId:body.data.restaurantId}}
 })
 app.post('/',{preHandler:requireRole('owner')},async(req,reply)=>{
 const body=z.object({name:z.string().trim().min(1).max(150),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100)}).safeParse(req.body);if(!body.success)return fail(reply,400,'Nome o indirizzo non valido')
 try{const restaurant=await db.transaction(async tx=>{const [r]=await tx.insert(restaurants).values({name:body.data.name,slug:body.data.slug}).returning();await tx.insert(menus).values({restaurantId:r!.id,name:'Menu',type:'main',active:true});await tx.execute(sql`INSERT INTO web_location_memberships(user_id,restaurant_id,role) VALUES(${req.user!.id},${r!.id},'owner')`);return r!});return {data:{id:restaurant.id,name:restaurant.name,slug:restaurant.slug}}}catch(e){if((e as any)?.code==='23505')return fail(reply,409,'Indirizzo già utilizzato');throw e}
 })
 app.get('/members',{preHandler:requireRole('owner')},async req=>({data:await db.execute(sql`SELECT u.id,u.name,u.email,m.role FROM web_location_memberships m JOIN users u ON u.id=m.user_id WHERE m.restaurant_id=${req.user!.restaurantId} ORDER BY u.name`)}))
 app.post('/members',{preHandler:requireRole('owner')},async(req,reply)=>{
 const body=z.object({email:z.string().email().max(254),role:z.literal('menu_editor')}).safeParse(req.body);if(!body.success)return fail(reply,400,'Dati non validi')
 const [user]=await db.select().from(users).where(and(sql`lower(${users.email})=${body.data.email.toLowerCase()}`,eq(users.active,true))).limit(1)
 if(!user||user.id===req.user!.id||user.restaurantId===req.user!.restaurantId)return fail(reply,404,'Account esterno non trovato')
 await db.execute(sql`INSERT INTO web_location_memberships(user_id,restaurant_id,role) VALUES(${user.id},${req.user!.restaurantId},'menu_editor') ON CONFLICT(user_id,restaurant_id) DO UPDATE SET role='menu_editor'`)
 return {data:{id:user.id,role:'menu_editor'}}
 })
 app.delete('/members/:id',{preHandler:requireRole('owner')},async(req,reply)=>{
 const id=z.string().uuid().safeParse((req.params as any).id);if(!id.success)return fail(reply,404,'Account non trovato')
 const rows=await db.execute(sql`DELETE FROM web_location_memberships WHERE user_id=${id.data} AND restaurant_id=${req.user!.restaurantId} AND role='menu_editor' RETURNING user_id`)
 if(!rows.length)return fail(reply,404,'Accesso non trovato');return {data:{revoked:true}}
 })
}
