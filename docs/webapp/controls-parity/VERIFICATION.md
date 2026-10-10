# Verifica controlli completi — 10 ottobre 2026

## Gate completati
- TypeScript server/web verdi; build produzione Next riuscita e runtime locale attivo (5137/5131/5132), build staff18script407414bytes.
- Vitest mirato21file118/118 verdi +2/2 immagini PDF, totale120 test: workspace, controlli schema/output, HTTP/PostgreSQL isolato, runtime/tenant/asset. Non inclusi vecchi test appliance che richiedono DB localhost5432.
- Node frontend50/50 verdi; ultima correzione fallback PDF4/4 ripassati.
- PDF stress con due colonne e font/spazi estremi: ogni marker presente una sola volta e coordinate entro pagine. Footer grande conserva il testo; sottocategoria pubblica mantiene parentSectionId.
- Browser reale: editor mobile Font→Staatliches +Sottolineato produce computed fontFamilyStaatliches e textDecorationunderline nel piatto; modifica solo locale e valori poi ripristinati, nessun Save/Publish.
- Browser desktop: Aspetto nav/settings/phone; PDF nav/settings/documento. Trovata e corretta anteprima cliente extra nella scheda PDF; verificata canvas pagina1/1 reale nella scheda QA separata. Screenshot pdf-controlli-desktop.png e style-controlli-desktop.png nel brain/output/tako-parita-2026-10-10. Schede QA create chiuse e viewport ripristinato.
- Impostazioni/menu pubblico QA restano versione8; nessuna scrittura durante QA browser. Menumal solo consultato, nessun Save/upload/toggle. Tentativo leggere HACCP senza download o variazione osservata.

- PDF immagini rasterizzate: opacità0/.5, adattamento cover/contain, clipping logo square/circle/rounded, colore sfondo e rifiuto asset estraneo verificati con pixel/operatori reali (2/2).

## Limiti concreti
HACCP riferimento non verificabile: nessuna attestazione o replica del suo documento. Traduzioni PDF usano traduzioni già salvate, provider esterno non esercitato. Font inclusi: quattro famiglie osservate e tre famiglie base; non replica del catalogo integrale font del fornitore.
