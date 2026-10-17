/** Sul runtime Edge (Deno, Supabase) sharp non si carica: è un addon nativo (verificato il 17/10/2026, errore
 * «Could not load the "sharp" module using the linux-arm64 runtime»). Tutti gli usi Edge passano già dai codec
 * WASM; i rami sharp sono solo Node. Questo stub tiene il pacchetto (≈30 MB di binari) fuori dal bundle Edge,
 * che costava ~0,3 s a OGNI richiesta all'edge operativa. Stesso esito di prima: chiamarlo fallisce. */
export default function sharp(){throw new Error('Could not load the "sharp" module using the edge runtime')}
