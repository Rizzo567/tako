# Verifica — parità Tako originale

## Gate già verificati
- 101 test mirati Vitest: runtime web/TLS/origin, isolamento tenant, storage, calendari/DST, workspace/PDF/import, credenziali/capienza/agenzia.
- 37 test Node: bootstrap atomico, trasferimento dati e segreti esclusi, launcher, compilazione staff/navigation/adapter, renderer condiviso/preview e link digitale.
- PostgreSQL isolato reale: token reset hash e consumo concorrente; ultimo posto concorrente; editor senza ordini/cassa/socket e revoca; bozza non esposta, restore nuova revisione, asset storico protetto.
- PDF renderizzato: 3 pagine due colonne, prezzo e footer non sovrapposti, Unicode arabo e segno euro. Font Noto OFL nel repo.
- Migrazioni remote19–21 installate atomiche con backup privato;22 migrazioni nel journal, nessuna pending.

## Prerequisiti e limitazioni
La suite appliance generale usa :3001 e database nativo: non è stata portata/avviata per questa fase e non è il gate web. I test specifici sopra hanno database temporanei indipendenti.

Nessuna email, transazione di pagamento o richiesta AI a provider esterni eseguita dal QA. Invio email e carta a garanzia sono capability esterne disattivate; hosting e WhatsApp rinviati. Microfono reale e compatibilità browser completa richiedono collaudo esplicito.

## Runtime e build finali
- Build produzione Next riuscita con gli stessi font originali distribuiti localmente (licenze OFL); TypeScript server e web verdi.
- `scripts/verify-webapp.mjs --run`: 10/10 controlli live su tenant QA Supabase (login, isolamento, QR, ordine, eventi cucina, conto, registrazione incasso di prova, immagini, logout). Nessun movimento finanziario reale.
- `scripts/verify-parity-webapp.mjs --run`: 10/10 controlli live QA (workspace, conflitto revisione, bozza separata, pubblicazione, diff, restore nuova revisione, PDF reale, QR reale, pagina digitale, quota libreria).
- Browser reale: editor desktop, renderer anteprima cliente e navigazione PDF/QR verificati; anteprima PDF canvas renderizza il PDF reale e il testo accessibile, verificata in IAB; editor e selettore locale mobile verificati.
- PDF e QR di prova: `/Users/manuel/Documents/brain/output/tako-parita-2026-10-10/`.

## Ultimo gate aperto
Il gate PDF/responsive è chiuso. Direttiva successiva10/10: struttura unica menu cliente implementata nel renderer condiviso, nel menu da tavolo/asporto e nell’anteprima. SSR di menu senza design, filtri e carrello verdi. Browser pubblico desktop/390px: ricerca con zero risultati e reset verificati; tavolo390px: apertura piatto e aggiunta1×12€ al carrello verificate. Toolbar servizi su seconda riga verificata nel browser390px; build finale riuscita. Le capability esterne indicate sopra restano rinviate/disattivate.
