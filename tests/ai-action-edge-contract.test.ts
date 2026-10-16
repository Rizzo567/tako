import {describe,it,expect,vi,beforeEach} from 'vitest'
const mocks=vi.hoisted(()=>({insert:vi.fn(),persist:vi.fn(),workspace:vi.fn()}))
vi.mock('../apps/server/src/index.js',()=>({io:undefined}))
vi.mock('../apps/server/src/lib/menu-workspace-store.js',()=>({readWorkspace:mocks.workspace}))
vi.mock('../apps/server/src/lib/billing.js',()=>({round2:(v:number)=>v,restaurantTimezone:vi.fn(),dayKeyInTz:vi.fn(),dayStartInTz:vi.fn(),coverUnit:vi.fn(),billTotalsFromOrders:vi.fn(),recomputeOpenBill:vi.fn(),BILLABLE_STATUSES:[]}))
vi.mock('../packages/db/src/index.ts',()=>{
 const names=['restaurants','menus','menuSections','menuItems','menuItemTranslations','itemVariants','orders','orderItems','tables','rooms','bills','billPayments','reservations','inventoryItems','inventoryMovements','staffShifts','users','sessions','loyaltyAccounts','recipes']
 return {...Object.fromEntries(names.map(n=>[n,{}])),waiterCalls:{tableId:'table_id',resolvedAt:'resolved_at'},db:{insert:mocks.insert}}
})
vi.mock('drizzle-orm',()=>({eq:vi.fn(),and:vi.fn(),asc:vi.fn(),desc:vi.fn(),gte:vi.fn(),lt:vi.fn(),lte:vi.fn(),ne:vi.fn(),inArray:vi.fn(),isNull:vi.fn(),sql:vi.fn()}))
import {executeAction,getAction,actionsForScope,toolSchemasFor} from '../apps/server/src/lib/ai-actions.js'

describe('AI Edge persistence and removed-feature boundaries',()=>{
 beforeEach(()=>{vi.stubEnv('TAKO_EXECUTION_RUNTIME','edge');mocks.persist.mockReset();mocks.insert.mockReset();mocks.workspace.mockReset();mocks.insert.mockReturnValue({values:vi.fn(()=>({onConflictDoUpdate:mocks.persist}))})})
 it('removed features are neither offered nor executable even by an owner',async()=>{
  for(const name of ['close_bill','open_bills','adjust_stock','create_inventory_item','staff_on_shift','clock_in_staff','clock_out_staff','create_table','refresh_table_qr','menu_engineering']){
   expect(getAction(name)).toBeUndefined();expect(actionsForScope('owner').some(a=>a.name===name)).toBe(false)
   expect(toolSchemasFor('owner','magazzino cassa turni menu engineering').some(t=>t.function.name===name)).toBe(false)
   expect((await executeAction(name,{}, {restaurantId:'r',role:'owner'},'owner',{allowMutation:true})).ok).toBe(false)
  }
  expect(mocks.insert).not.toHaveBeenCalled()
 })
 it('waiter success requires a durable upsert, rather than a socket',async()=>{
  mocks.persist.mockResolvedValue(undefined)
  const result=await executeAction('call_waiter',{reason:'water'},{restaurantId:'r',tableId:'t',tableNumber:'7'},'customer')
  expect(mocks.persist).toHaveBeenCalledOnce();expect(result.ok).toBe(true);expect(result.clientAction).toEqual({type:'waiter_called',reason:'water'})
 })
 it('persistence failure cannot claim that waiter was called',async()=>{
  mocks.persist.mockRejectedValue(new Error('database unavailable'))
  await expect(executeAction('call_waiter',{}, {restaurantId:'r',tableId:'t'},'customer')).rejects.toThrow('database unavailable')
 })
})
