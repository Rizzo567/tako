# Onboarding Tako — piano verificabile

## Obiettivo e stop
Il cliente può configurare logo/sfondo/colori e incollare un menu semplice, vedere piatti/prezzi/sezioni e warning, applicare soltanto alla bozza locale e scegliere separatamente Salva bozza e Pubblica. UUID e piatti esistenti restano conservati; nessun accesso ad altro tenant, inferenza allergeni o pubblicazione automatica.

## Contratti ritoccabili
`POST /api/menu-workspace/import/preview`: `format: "text"`, `source`, `expectedRevision`, `menuId` opzionale. Risposta workspace clonata, importedCount e warnings. GET workspace inizializza la base storica; il preview può fare lo stesso bootstrap sul primo accesso. Requisito approvato: non salvare l’import e non pubblicare implicitamente. Il test HTTP parte da workspace inizializzati e verifica bozza/pubblico/revisioni/versioni invariati.

Formato conservativo: `# Sezione`, `Nome — 12,50 €`, descrizione successiva multiline facoltativa. Accettato anche `Nome 12,50€`; prezzo senza euro richiede il trattino. Titoli semplici a inizio blocco accettati con warning; righe ambigue ignorate con posizione e motivo. Nessun prezzo, allergene o variante dedotto. Import ripetuto aggiunge nuovamente i piatti: anteprima e conferma esplicite, nessun claim deduplica.

## Ownership
- web_runtime: parser testo, endpoint preview e test unitari parser.
- web_navigation: wizard/menu editor e guard asincrone, senza endpoint nuovi di salvataggio automatico.
- web_tenant_tests: audit read-only sorgenti, questi documenti e nuovo test HTTP/DB isolato.
- root: entry route, coordinamento QA browser e nota decisione nel brain.

## Loop e verifier
1. Leggere parser/route/guard; identificare ambiguità e vincoli senza duplicare schema o provider.
2. Test mirati parser a cura backend; HTTP su PostgreSQL temporaneo con autenticazione reale: preview non muta bozza/pubblico, target foreign fallisce, revisione obsoleta409, append conserva IDs.
3. Audit UI: preview applicabile soltanto con stesso testo, target, tenant e fingerprint bozza; applicazione locale non chiama save/publish. QA browser sul tenant di prova, nessuna scrittura Menumal cliente.
4. Dichiarare il bootstrap storico distinto dal salvataggio import; verificare dopo riparazione solo il gate fallito.
5. Massimo due riparazioni per batch, adattate alla causa. Dopo due fallimenti fermare il batch con evidenza e gate aperto; nessun retry cieco o suite generale ripetuta.

Stop successo: test mirati verdi, nessun gap tenant/dati/asincronia, QA browser completato o limite esplicito. Nessun invio reale, pagamento, hosting o modifica ai dati originali necessario in questa fase.
