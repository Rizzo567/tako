import {describe,it,expect} from 'vitest'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
describe('dish background gradient persistence',()=>{
 it('preserves colors and direction through schema serialization',()=>{const gradient={from:'#181613',to:'#40351f',angle:160};const w=workspaceSchema.parse({menus:[],design:{backgroundGradient:gradient}});expect(workspaceSchema.parse(JSON.parse(JSON.stringify(w))).design.backgroundGradient).toEqual(gradient)})
 it('keeps solid backgrounds and rejects unsafe or invalid gradient values',()=>{expect(workspaceSchema.parse({menus:[],design:{backgroundGradient:null}}).design.backgroundGradient).toBeNull();for(const g of [{from:'url(x)',to:'#ffffff',angle:0},{from:'#111111',to:'#ffffff',angle:361}])expect(workspaceSchema.safeParse({menus:[],design:{backgroundGradient:g}}).success).toBe(false)})
})
