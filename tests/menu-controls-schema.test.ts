import {it,expect} from 'vitest'
import {pdfConfigSchema,workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
it('additive controls retain legacy font/typography/legend fallbacks',()=>{
 const pdf=pdfConfigSchema.parse({font:'serif',fontSize:12,nameBold:false,showFoodLegends:false})
 expect(pdf.font).toBe('serif');expect(pdf.typography).toBeUndefined();expect(pdf.spaces).toBeUndefined();expect(pdf.legends).toBeUndefined();expect(pdf.verticalCentered).toBe(false)
 expect(pdf.translationActive).toBeUndefined();expect(pdf.translationNamesPolicy).toBe('all')
})
it('extended controls roundtrip and reject excessive dimensions or unsafe color formats',()=>{
 const value={menus:[],design:{standard:{name:{font:'poppins',underline:true}},subcategoryStyle:{font:'italiana',fontSize:24,paddingX:8},imageRadius:50,showSpecificationIcons:true,reviewStyle:{type:'border',width:300}},pdf:{font:'amaranth',translationActive:true,translationNamesPolicy:'auto',typography:{price:{font:'mono',fontSize:14,underline:true,color:'#ff0000'},subcategory:{italic:true},traits:{font:'staatliches'}},spaces:{subcategory:{left:12,right:14,top:8,bottom:10}},legends:{allergens:false,traits:true,additives:true},verticalCentered:true,logoBackground:'#eeeeee'}}
 const parsed=workspaceSchema.parse(value);expect(workspaceSchema.parse(parsed)).toEqual(parsed)
 expect(parsed.pdf.typography?.price?.underline).toBe(true);expect(parsed.design.reviewStyle?.type).toBe('border')
 expect(pdfConfigSchema.safeParse({typography:{price:{fontSize:99}}}).success).toBe(false)
 expect(pdfConfigSchema.safeParse({spaces:{category:{left:1000}}}).success).toBe(false)
 expect(pdfConfigSchema.safeParse({backgroundOpacity:2}).success).toBe(false)
})
