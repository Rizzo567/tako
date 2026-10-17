# Latenza live · perimetro B (pagina pubblica + DB) · REPORT (17/10/2026)

Branch `codex/live-latenza-client`, base c5693fa. Goal: commit nel DB → cambiamento sullo schermo del cliente p50 ≤ 0,6 s, p95 ≤ 1,2 s, carico 30–40 telefoni senza 429. **Raggiunto per tutti i tipi.**

## Online
| Componente | Prima | Dopo |
|---|---|---|
| takomenu-public | 2ffa12a4 | **d9c80a18** (intermedio 55cbbd75). Worker: solo `liveMenu` (lettura condivisa per gettone). Asset: a chunk normalizzati cambiano solo `DigitalMenu` e `index`; gli asset di 2ffa12a4 restano pubblicati |
| DB (Supabase) | trigger Compito 2 | `sql/up.sql`: 3 funzioni nuove + corpi nuovi delle 4 esistenti + 4 trigger differiti. Nessuna tabella né dato |
| Edge operativa, read-edge, takomenu-web | — | non toccati |

## Numeri (QA, `verify-live-B.mjs`, 5 giri per tipo × 3 pagine: it scorsa a metà, en con pannello lingue aperto, desktop)
Commit = osservatore del DB ogni 50 ms (risoluzione ~±50 ms: per i delta il segnale arriva spesso prima che il poll veda il commit). Segnale DB → telefono 20–60 ms.

| Tipo | Prima p50 / p95 | Dopo p50 / p95 | Come |
|---|---|---|---|
| prezzo | 2,93 / 3,93 s | **0,04 / 0,08 s** | delta nel segnale |
| nome | 2,48 / 10,5 s* | **0,04 / 0,13 s** | delta |
| nome + traduzione EN | 3,02 / 16,3 s* | **0,09 / 0,11 s** (la pagina en mostra la traduzione) | delta |
| esaurito (PATCH) | 2,37 / 3,68 s | **0,02 / 0,11 s** | delta |
| nascosto | 2,47 / 4,23 s | **0,02 / 0,21 s** | delta |
| eliminato | 2,89 / 4,03 s | **0,09 / 0,24 s** | delta (deviazione: in origine strutturale) |
| piatto nuovo | 3,01 / 4,17 s | **0,45 / 0,64 s** | rilettura immediata condivisa |
| categoria | 1,90 / 3,80 s | **0,46 / 0,60 s** | rilettura |
| menu nuovo | 3,11 / 4,19 s | **0,47 / 0,56 s** | rilettura |

\* outlier dovuti a scritture concorrenti dell'altro agente sul QA.

Giri: base `evidence/prima-run.log`; giro 1 (bundle in locale, delta + jitter 0–0,3 s) strutturali 0,77–0,92 s; giro 2 (online 55cbbd75, + lettura condivisa, jitter 0–0,1 s) strutturali 0,63–0,69 s; giro 3 (online d9c80a18, jitter 0) strutturali 0,45–0,47 s; delta rifatti a QA libero (`dopo-g3b`, 22/22 controlli).
In tutti i giri: punto di lettura invariato (Δ 0 px), lista non rimontata, nessun lampeggio, categoria e pannello lingue mantenuti, nessun secondo cambio dopo la riconferma (delta = rilettura), console pulita.

**Carico** (`load-live-B.mjs`, telefoni sullo stesso IP, 3 cambi delta + 3 strutturali):

| | 429 | 5xx | letture all'origine | strutturale segnale→lettura p50 / p95 |
|---|---|---|---|---|
| 30 tel., giro 1 (senza lettura condivisa, jitter 0–0,3 s) | 1 | 41 × 503 | 131/131 | 5,1 / 9,4 s |
| 30 tel., jitter 0, lettura condivisa | 0 | 0 | 7 su 210 | 0,45 / 0,62 s |
| **40 tel., finale** | **0** | **0** | 9 su 280 | **0,44 / 0,50 s** |

Altre misure: delta SQL ~8–13 ms su un pubblicato di 300 piatti (transazione annullata); socket agganciato ~0,3 s dopo il menu a schermo (prima ~0,5 s, `socket-join.mjs`); test: 47 nuovi/aggiornati (live, parità del delta con la proiezione vera del server 8 casi × 4 lingue + eliminato, lettura condivisa del Worker) + test Worker esistenti verdi; `tsc` web verde.

QA: ripristinato e verificato per hash (7 impronte: bozza, pubblicato, locale, piatti, categorie, menu, risposta pubblica it+en) dopo ogni giro; stato finale = stato iniziale del giro di base.

## Rollback
- Pagina: `npx wrangler rollback 2ffa12a4-b158-4ac9-923c-cb1d1ea96c73 --config deploy/cloudflare/wrangler-public.jsonc`
- DB: `sql/rollback.sql` con la connessione owner (torna esattamente ai corpi del Compito 2). I due rollback sono indipendenti: pagina nuova + DB vecchio = rilettura come prima; pagina vecchia + DB nuovo = ignora `d`/`k` e rilegge come prima.
- Copia in `~/.config/tako-webapp/rollback-live-latenza-B-20261017/`.

## Cosa resta
1. Non provati su dispositivo reale: Safari/iPhone, browser in-app, standby lungo (coperti da test unitari con timer congelati).
2. Piatto nuovo/categoria/menu: il tratto residuo è la lettura dall'origine (~0,45 s, `Server-Timing read` ~170 ms). Più in basso solo toccando la read-edge (contatore e lettura in parallelo) o con un delta anche strutturale.
3. Le riletture servite dalla copia condivisa (60 s per gettone) non passano dal contatore per IP: scelta voluta (come una CDN).
4. Problema preesistente lato server: 503 della read-edge con ~30 letture simultanee dallo stesso IP (evitato dal Worker per le riletture live; resta per 30 aperture simultanee).
5. Una stringa di connessione del DB runtime è comparsa in un output di errore del terminale locale (non in file né commit): valutare la rotazione della password `takomenu_runtime`.
6. Il QA è condiviso con il perimetro A: due verifier insieme si disturbano (409, revisioni estranee). Conviene alternare i giri.
