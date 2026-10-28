import test from'node:test';import assert from'node:assert/strict';
import{resolveMenuMigration,DESTINATIONS}from'../../scripts/migration-access/menusmart/menu-migration-routing.mjs';
test('all 19 client routes are off by default; explicit activation preserves only language',()=>{
 assert.equal(Object.keys(DESTINATIONS).length,19);
 for(const [slug,target]of Object.entries(DESTINATIONS)){
  const source='https://menusmart.it/menu/'+encodeURIComponent(slug);
  assert.equal(resolveMenuMigration(source),null);
  assert.equal(resolveMenuMigration(source,[slug]),target);
  assert.equal(resolveMenuMigration(source+'?lang=en&cat=old&token=do-not-forward&redirect=https://evil.test',[slug]),target+'?lang=en');
  assert(!target.includes('staff'));assert(!target.includes('dashboard'));
 }
});
test('unrelated, malformed and untrusted QR URLs never redirect',()=>{
 const enabled=Object.keys(DESTINATIONS);
 for(const s of['https://evil.test/menu/l-agora','http://menusmart.it/menu/l-agora','https://menusmart.it:8443/menu/l-agora','https://user@menusmart.it/menu/l-agora','https://menusmart.it/admin','https://menusmart.it/auth','https://menusmart.it/menu/demo','https://menusmart.it/menu/%ZZ','https://menusmart.it/menu/l-agora/extra','not-a-url'])assert.equal(resolveMenuMigration(s,enabled),null,s);
});
