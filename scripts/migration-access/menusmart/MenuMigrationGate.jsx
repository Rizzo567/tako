// Install only in MenuSmart, after reviewing its unpublished changes.
import {useEffect} from 'react';
import PublicMenu from './pages/PublicMenu';
import {resolveMenuMigration} from './menu-migration-routing.mjs';
export default function MenuMigrationGate(){
 const target=resolveMenuMigration(window.location.href);
 useEffect(()=>{if(target)window.location.replace(target)},[target]);
 if(!target)return <PublicMenu />;
 return <main aria-live="polite"><a href={target}>Apri il menu</a></main>;
}
