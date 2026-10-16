import {describe,it,expect} from 'vitest'
import {onboardingAssetRole,onboardingHasPrice} from '../apps/server/src/lib/onboarding-asset-role.js'
describe('explicit WhatsApp asset role and menu-source intent',()=>{
 it('keeps a LOGO label authoritative over a negated copertina mention',()=>{expect(onboardingAssetRole('LOGO: sostituisci il logo con questo PNG originale e mantieni la trasparenza. Non cambiare la copertina.')).toBe('logo')})
 it('keeps a HERO label authoritative over a negated logo mention',()=>{expect(onboardingAssetRole('HERO: usa questa copertina. Non sostituire il logo.')).toBe('hero')})
 it('refuses ambiguous and entirely negated image instructions',()=>{expect(onboardingAssetRole('Usa questa immagine per logo e hero')).toBe('ambiguous');expect(onboardingAssetRole('Non cambiare il logo. Non cambiare la copertina.')).toBe('ambiguous');expect(onboardingAssetRole('Ecco il menu')).toBeNull()})
 it('accepts integer and spoken euro prices without making arbitrary numbers a menu',()=>{expect(onboardingHasPrice('Aggiungi Tiramisu a 6 euro')).toBe(true);expect(onboardingHasPrice('Aggiungi Tiramisu a sei euro')).toBe(true);expect(onboardingHasPrice('Sfondo a 90 gradi')).toBe(false)})
})
