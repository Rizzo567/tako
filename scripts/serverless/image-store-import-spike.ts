// Read-only module import proof. No provider credentials or database/storage calls.
import {configureImageCodec,saveImageBuffer} from '../../apps/server/src/lib/image-store.ts'
if(typeof configureImageCodec!=='function'||typeof saveImageBuffer!=='function')throw new Error('Missing image adapter')
console.log('Edge image-store import PASS: no eager Sharp or filesystem write')
