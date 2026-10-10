# Piano verificabile — Tako originale

## Obiettivo e stop
Tutte le aree approvate sono implementate nel runtime web, con test e collaudo QA; funzioni provider-dipendenti dichiarano capability reale. WhatsApp rinviato. Zero acquisti, zero scritture Menumal cliente, backup e dati originali protetti. Nessun merge main automatico.

## Contratti ritoccabili prima del codice
DTO editor gerarchico con revisione ottimistica; stile e PDF distinti; versioni menu senza segreti; calendario timezone; email reset hash-only; agency assegnazioni esplicite. Estensioni additive, preservare UUID degli ordini.

## Loop
1. Discovery frontend/backend/QA e contratti.
2. Implementazione in batch con ownership disgiunte.
3. Verifica TypeScript, test PostgreSQL isolato avversariali, PDF renderizzato, browser sul tenant QA.
4. Errori: adattare al motivo, massimo due riparazioni per batch; blocco dati/architettura ritorna alla discovery.
5. Integrare migrazioni su Supabase soltanto dopo verifica; aggiornare build locale e verificare core precedente.
6. Handoff finale con matrice feature/pass/block, screenshot e limiti esterni reali.

## Ownership
- web_navigation: nuovi13workspace/14pdf/15gallery-history +CSS; noindex/root condivisi.
- web_runtime: menu-workspaceAPI, versioni/stili/gallery/PDF/calendario/cataloghi/analytics helpers; contratti.
- web_tenant_tests: reservations+capacity/DST, web-accounts/reset/mail/outbox +test dedicati.
- root: schema/migrazioni/registrazioneAPI, customerfrontend/publicintegration, agency e integration QA, brain.

## Scope
Editor/anteprima; grafica/preset; PDF; versioni/diff/restore; calendari; allergeni/caratteristiche/additivi; gallery; traduzioni; metriche QR/lingue; onboarding/reset; prenotazioni/reminder; gestione agenzia/locali; voce web se provider configurato; pubblicazione senza servizi a pagamento se infrastruttura disponibile. Hosting Render resta rimandato, niente attivazione implicita.
