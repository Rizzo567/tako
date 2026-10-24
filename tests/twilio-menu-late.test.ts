import {describe,expect,it} from 'vitest'
import {lateReply,nextMessage,twiml,LATE_GATEWAY_MS} from '../apps/server/src/lib/twilio-menu-command.js'
// notte 22/10: richiesta arrivata in ritardo dal gateway → risposte immediate via REST, TwiML vuoto (mai con TakoSyncTest).
describe('risposte immediate in ritardo',()=>{
 const now=1_000_000
 it('in tempo: tutto nel TwiML',()=>{expect(lateReply('ciao',{gatewayAt:String(now-2000),arrivedAt:now})).toEqual({xml:twiml('ciao'),send:[]})})
 it('senza header: tutto nel TwiML',()=>{expect(lateReply('ciao',{gatewayAt:undefined,arrivedAt:now}).send).toEqual([])})
 it('in ritardo: TwiML vuoto, le parti via REST in ordine',()=>{const r=lateReply('uno'+nextMessage+' due ',{gatewayAt:String(now-LATE_GATEWAY_MS-1),arrivedAt:now});expect(r.xml).toBe(twiml(''));expect(r.send).toEqual(['uno','due'])})
 it('in ritardo ma verifica sincrona QA: niente REST',()=>{expect(lateReply('ciao',{gatewayAt:String(now-60000),arrivedAt:now,syncTest:true}).send).toEqual([])})
 it('in ritardo e testo vuoto: niente da mandare',()=>{expect(lateReply('',{gatewayAt:String(now-60000),arrivedAt:now})).toEqual({xml:twiml(''),send:[]})})
 it('header non numerico: ignorato',()=>{expect(lateReply('ciao',{gatewayAt:'abc',arrivedAt:now}).send).toEqual([])})})
