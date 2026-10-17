# Latenza modifiche → menu cliente · PIANO (17/10/2026)

Base: c5693fa (online: edge v105, read-edge v21, web aea28f62, public 2ffa12a4).

## Goal (stop testabile, QA 26050ecd, p50 su ≥5 giri per tipo)
- Dashboard «salva+pubblica» → schermo cliente: p50 ≤ 2,0 s (oggi 4,2–8,4), p95 ≤ 3,0 s
- WhatsApp comando deterministico (prezzo/esaurito/nascondi) webhook → schermo: p50 ≤ 2,5 s (oggi 3,5–4,2)
- WhatsApp via AI: misurato, ≤ 4 s p50 (budget token ≤ 15k)
- Nessuna regressione: batterie bot 0 gravi/0 medi, scroll/lingua/categoria preservati, nessun dato di bozza esposto, carico 30–40 telefoni senza 429

## Perimetri (disgiunti)
- **A – edge + dashboard** (worktree Tako-live-edge, branch codex/live-latenza-edge): scrittura pubblicazione a delta, salva+pubblica senza round-trip seriali, bot pubblica prima di rispondere. Deploy: edge operativa (+ takomenu-web se tocca staff).
- **B – pagina pubblica + DB** (worktree Tako-live-client, branch codex/live-latenza-client): jitter, payload nel segnale per prezzo/esaurito/nascosto, aggancio socket più rapido, rilettura più veloce (cache). Deploy: takomenu-public + SQL trigger (+ read-edge se serve).

## Exit di fallimento
Max 4 giri misura→fix per perimetro; se un tratto non scende sotto target dopo 2 giri → documentare causa e fermarsi. Un deploy che non passa check-active → stop, niente forzature.
