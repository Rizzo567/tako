---
titolo: Tako — Piano Master per la Perfezione
piano-id: T01
data: 2026-06-13
progetto: Tako
tipo: roadmap
stato: attivo
modello-stile: jarvis-piano-perfection
obiettivo: rendere Tako il sistema operativo che ogni ristoratore italiano sente di DOVER avere + assistente AI agentico (ristoratore e cliente) che fa e modifica qualsiasi cosa via chat
---

# Tako — Piano Master per la Perfezione

> Documento generato dopo avvio reale del sistema (pg 16.2 :5432, redis :6379, dashboard :3000, server :3001, customer PWA :3002 — tutti UP) e ispezione diretta del codice: 13 route server, 10 tabelle, dashboard 11 sezioni, customer PWA, AI chat esistente.
>
> Stile: lo stesso `jarvis-piano-perfection` del brain — stato attuale netto, gap ordinati per impatto, piani per ruolo, criteri misurabili, ordine di esecuzione. Ogni task ha un **Done:** verificabile.

---

## TESI CENTRALE

Tako oggi è un buon **gestionale di sala**. Non è ancora un **must**.

Un ristoratore italiano cambia sistema solo se quello nuovo:
1. **Sostituisce roba che già paga** (registratore di cassa, gestionale, menu QR di terzi, commissioni delivery) → ROI immediato.
2. **È a norma di legge senza pensarci** (scontrino elettronico, corrispettivi, allergeni, privacy) → toglie ansia.
3. **Gli fa guadagnare di più stasera** (upsell, asporto senza commissioni, recensioni, fedeltà) → vede i soldi.
4. **Si usa parlando** (assistente AI che fa tutto via chat) → zero curva di apprendimento, è il "wow" che lo fa raccontare agli altri ristoratori.

Il piano sotto copre i 4 livelli. Il punto 4 — l'AI agentico bilaterale — è il differenziatore che nessun competitor italiano (Scloby, Cassa in Cloud, TheFork, Plateform) ha.

---

## STATO ATTUALE (preciso, da ispezione codice)

### Cosa funziona con certezza
- **Multi-app monorepo** Next.js 15 + Fastify + Socket.io + Drizzle/Postgres, avvio `pnpm dev`, gira locale senza internet (tranne le feature AI).
- **Dashboard staff** (`:3000`): 11 sezioni — ordini, KDS, cassa, sala, menu, inventario, staff, statistiche, insights, impostazioni, onboarding wizard.
- **Customer PWA** (`:3002`): menu da QR, carrello, ordine, tracking, chiamata cameriere, AI chat.
- **Real-time** Socket.io rooms `restaurant:{id}` / `table:{id}`.
- **Sicurezza già fatta** (commit mag): PIN bcrypt, JWT obbligatorio, IDOR su ordini/menu, MIME whitelist upload, Socket auth.
- **Analytics**: peak hours, conversione, tempo al primo ordine, menu engineering (Boston Matrix via Groq llama-3.3-70b in `insights.ts:243`).
- **AI cliente esistente** (`customer.ts:272` + `web/src/components/AiChat.tsx`): Q&A sul menu via Groq. Costruisce contesto menu, risponde in italiano, max 3 righe.

### Limiti strutturali dell'AI attuale
- **È read-only.** L'AI cliente sa *parlare* del menu ma non può **ordinare, modificare, pagare, chiamare**. È un FAQ bot, non un assistente.
- **Lato ristoratore non esiste AI operativa.** Insights genera testo, non esegue azioni.
- **Nessun tool-calling / function-calling.** Nessun registry di azioni. L'AI non è agganciata alle 13 route esistenti.
- **Modello fragile per tool-use.** llama-3.3-70b via Groq è ok per chat, debole per chiamate strumenti affidabili (vedi storia Jarvis: tool-calling con llama richiedeva pre-tool injection per funzionare).

### Cosa manca per legge (oggi in "FUORI SCOPE" nel BACKLOG)
Queste sono marcate "rimandato" ma **sono esattamente ciò che rende Tako un must o un giocattolo**:
- Scontrino/Registratore Telematico (RT), corrispettivi telematici Agenzia Entrate.
- Pagamenti elettronici (POS obbligatorio dal 2022).
- Fattura elettronica SDI.
- WhatsApp/SMS notifiche.
- Login/account cliente.

---

## GAP CRITICI ORDINATI PER IMPATTO

| # | Gap | Impatto | Perché blocca il "must" |
|---|-----|---------|-------------------------|
| **G1** | **AI non agentica** — nessun assistente che esegue azioni via chat (né cliente né owner) | DIFFERENZIATORE | È la richiesta esplicita e il "wow" che vende. Senza, Tako è un gestionale come altri. |
| **G2** | **Nessuna conformità fiscale** — scontrino/RT, corrispettivi | BLOCCANTE LEGALE | Un ristorante non può usare come sistema primario qualcosa che non emette scontrino fiscale. |
| **G3** | **Nessun pagamento digitale** — niente pay-at-table, Satispay, carta, mance | ALTO ($) | Senza incasso digitale il cliente non chiude il loop sul telefono; il ristoratore resta legato alla cassa fisica. |
| **G4** | **Niente stampa comanda termica** | ALTO OPERATIVO | In cucina/bar serve la carta. Senza stampa, lo staff non si fida e torna al blocchetto. |
| **G5** | **Niente prenotazioni** | ALTO ($) | Sostituisce TheFork (che prende commissioni). Forte gancio di vendita. |
| **G6** | **Niente asporto/delivery proprio** | ALTO ($) | Sostituisce Glovo/Deliveroo (commissioni 25-35%). ROI enorme e raccontabile. |
| **G7** | **Menu monolingua** | MEDIO-ALTO | Italia = turismo. Menu multilingua auto-tradotto è decisivo in città. |
| **G8** | **Niente recensioni/fedeltà** — nessun funnel Google review, nessun programma punti | MEDIO ($) | Acquisizione e ritorno cliente. Il ristoratore vede crescere le stelle = ci tiene. |
| **G9** | **Offline-first non reale** — è Next.js dev, nessun service worker/queue | MEDIO | La promessa "funziona senza internet" deve reggere davvero quando salta la linea. |
| **G10** | **Multi-tenant RLS non applicato** — `withRestaurantContext()` definita ma non usata | MEDIO SICUREZZA | Necessario per vendere a più ristoranti / catene in cloud. |

---

# PARTE 1 — L'ASSISTENTE AI AGENTICO (G1, il cuore)

Questa è la feature richiesta: **una chat con un assistente AI sia lato ristoratore sia lato cliente che permetta di fare e modificare qualsiasi cosa via chat.**

## Architettura: un solo cervello, due personalità, permessi diversi

```
apps/server/src/ai/
├── agent.ts            — loop function-calling (provider-agnostic)
├── registry.ts         — ToolRegistry: nome → { schema zod, scope, requiresConfirm, handler }
├── provider.ts         — wrapper Anthropic (primario) + Groq (fallback)
├── tools/
│   ├── menu.tools.ts        — create_item, update_price, set_availability(86), reorder...
│   ├── order.tools.ts       — place_order, modify_order, cancel_order, order_status
│   ├── stats.tools.ts       — revenue_today, top_items, compare_week, occupancy
│   ├── inventory.tools.ts   — stock_level, set_stock, low_stock
│   ├── staff.tools.ts       — add_staff, edit_staff, list_staff
│   ├── table.tools.ts       — call_waiter, request_bill, assign_waiter, open/close
│   ├── promo.tools.ts       — create_promo, happy_hour
│   ├── reservation.tools.ts — create/list/confirm (dopo G5)
│   └── payment.tools.ts     — pay, split, tip (dopo G3)
└── personas.ts         — system prompt OWNER vs CUSTOMER
```

### Principio chiave: i tool RIUSANO la logica delle route esistenti
Ogni tool non reimplementa nulla — chiama lo stesso service/handler delle 13 route già testate. Il tool è solo: `schema zod` + `scope` + `handler che invoca la logica esistente`. Il prezzo resta sempre dal DB (regola di sicurezza già in vigore).

### Modello di permessi (la parte che rende sicuro "fare qualsiasi cosa")
Ogni tool dichiara:
- `scope: 'customer' | 'staff' | 'owner'`
- `requiresConfirmation: boolean` — azioni irreversibili o sensibili (cancel, refund, delete, prezzo, elimina staff).
- `binding` — i tool `customer` sono **vincolati al `sessionId`/`tableId`** del JWT cliente (lega a P0 sicurezza): un cliente può agire SOLO sul proprio tavolo e ordine.

| | Assistente Cliente | Copilot Ristoratore |
|---|---|---|
| Vede | solo menu + il proprio tavolo/ordine/sessione | tutto il ristorante |
| Può fare | cerca piatti, filtra allergeni, **ordina**, modifica carrello, ri-ordina, stato ordine, chiama cameriere, chiedi conto, dividi, **paga** (post-G3) | menu, prezzi, 86 piatti, stato ordini, statistiche a voce, magazzino, staff, promo, prenotazioni, impostazioni |
| Conferma | ordine e pagamento mostrati come card prima di confermare | ogni azione che cambia dati o soldi |
| Modello | Claude Haiku (veloce, economico) | Claude Haiku/Sonnet (Sonnet per query analitiche complesse) |

### Provider: Claude primario, Groq fallback (DECISIONE da confermare)
La storia di Jarvis nel brain dimostra che **llama via Groq è inaffidabile sul tool-calling** (serviva pre-tool injection hardcoded). Per un assistente che *esegue azioni sui soldi e sul menu*, l'affidabilità del tool-use è tutto.
- **Primario: Anthropic Claude** — `claude-haiku-4-5` (latenza bassa, tool-use affidabile, ottimo italiano) per il 90% dei turni; `claude-sonnet-4-6` per query analitiche owner ("confronta marzo con febbraio e dimmi cosa è andato peggio").
- **Fallback: Groq llama-3.3-70b** se `ANTHROPIC_API_KEY` assente → degrada a sola conversazione (no azioni rischiose).
- Costo: spannometrico, ~€0.002–0.01 a conversazione su Haiku. Trascurabile vs valore.
- Vincolo: le feature AI richiedono internet. Il **core POS resta 100% locale**. Da comunicare chiaro: "Tako funziona senza internet; l'assistente AI no".

### Esperienza utente
- **Customer PWA**: upgrade di `AiChat.tsx` da bolla FAQ a **assistente che agisce**. Le risposte includono card azione ("Ho aggiunto Carbonara ×2 al carrello — confermi?"). Ordine e pagamento partono dalla chat.
- **Dashboard**: nuovo `/dashboard/assistente` a pagina piena + **palette rapida Cmd/Ctrl+K** richiamabile da ogni sezione ("aggiungi pizza margherita a 7 euro", "quanto ho incassato oggi?", "metti il branzino esaurito", "crea happy hour 18-20 -20% sui cocktail").

### Esempi reali di comandi da supportare
**Ristoratore:**
- "Quanto ho incassato oggi?" → `revenue_today` → "€1.240, 47 coperti, ticket medio €26."
- "Aggiungi 'Tagliata di manzo' a 18 euro nei secondi" → `create_item` (conferma) → creato.
- "Metti la carbonara fuori menu" → `set_availability(86)` (conferma) → fatto, sparisce dal menu cliente in real-time.
- "Alza del 10% tutti i primi" → `update_price` batch (conferma con anteprima) → aggiornati.
- "Chi è il piatto che rende meno?" → `stats` + insights → risposta + suggerimento.
- "Aggiungi Marco come cameriere, PIN 1234" → `add_staff` (conferma).

**Cliente:**
- "Cosa avete senza glutine?" → `filter_allergen` → card piatti.
- "Ordinami una margherita e due birre" → `add_to_cart` → card riepilogo → "confermi?" → `place_order`.
- "Togli una birra" → `modify_order`.
- "A che punto è il mio ordine?" → `order_status`.
- "Chiama il cameriere, vorrei il conto" → `call_waiter('bill')` + `request_bill`.
- "Paga, dividiamo in 3" → `split_bill` + `pay` (post-G3).

---

## PIANO AI_ENGINEER (priorità interne)

### P1 — Core agentico (sblocca tutto il resto)
File: `apps/server/src/ai/{agent,registry,provider,personas}.ts`
- Loop function-calling provider-agnostico (Anthropic tool-use API; adapter Groq).
- `ToolRegistry` con `scope`, `requiresConfirmation`, `binding`.
- Persona OWNER e CUSTOMER (riusa il tono italiano già in `customer.ts`).
- **Done:** un tool di prova (`revenue_today`) eseguibile via chat owner; la chat cliente esistente passa al nuovo agent senza regressioni.

### P2 — Tool cliente (azioni sul proprio tavolo)
File: `apps/server/src/ai/tools/{menu,order,table}.tools.ts`
- `search_menu`, `item_details`, `recommend`, `filter_allergen`, `add_to_cart`, `modify_cart`, `place_order`, `reorder`, `order_status`, `call_waiter`, `request_bill`.
- Tutti vincolati al `sessionId` del JWT cliente (richiede P0 sicurezza — JWT al resolve QR).
- **Done:** dal telefono, ordine completo fatto interamente via chat; ordine compare in KDS in real-time.

### P3 — Upgrade UI cliente
File: `apps/web/src/components/AiChat.tsx`
- Render card azione (riepilogo carrello, conferma, stato).
- Pulsanti rapidi contestuali.
- **Done:** un cliente non tecnico ordina via chat senza usare il menu classico.

### P4 — Tool ristoratore (operazioni complete)
File: `apps/server/src/ai/tools/{menu,stats,inventory,staff,promo}.tools.ts`
- Tutte le mutazioni con `requiresConfirmation` + anteprima.
- **Done:** owner crea piatto, cambia prezzo, mette 86, legge incasso, aggiunge staff — solo via chat.

### P5 — UI Copilot dashboard
File: `apps/dashboard/src/app/dashboard/assistente/page.tsx` + componente palette Cmd+K globale in `layout`.
- Streaming risposte, conferme inline, link alla sezione toccata.
- **Done:** Cmd+K da qualunque pagina, comando eseguito, toast risultato.

### P6 — Guardrail e sicurezza azioni
- Rate limit per sessione/utente (lega a P0 "Rate limit AI chat").
- Log di ogni azione AI in tabella `ai_actions` (audit: chi, cosa, quando, esito).
- Conferma obbligatoria su: prezzo, cancel, refund, delete, set 86, modifica staff.
- **Done:** nessuna azione irreversibile parte senza conferma esplicita; ogni azione tracciata.

---

# PARTE 2 — DA GESTIONALE A MUST (G2–G10)

## PIANO COMPLIANCE_ENGINEER (G2 — sblocco legale)
Senza questo Tako resta un secondo schermo, non il sistema primario.

### P1 — Scontrino elettronico / Registratore Telematico
- Integrazione con RT via stampante fiscale (Epson FP-81II / RCH) attraverso protocollo, **oppure** soluzione RT cloud / documento commerciale online dell'Agenzia delle Entrate.
- Alla chiusura conto in `/dashboard/cassa` → emissione documento commerciale.
- **Done:** conto chiuso → scontrino fiscale valido emesso e registrato.

### P2 — Corrispettivi telematici
- Invio corrispettivi giornalieri all'Agenzia (tramite RT o provider).
- **Done:** chiusura giornaliera genera e trasmette il corrispettivo.

### P3 — Allergeni a norma Reg. UE 1169/2011
- Campo allergeni già esiste su `menuItems`. Renderlo **obbligatorio** in fase menu + disclaimer legale visibile nel menu cliente.
- **Done:** nessun piatto pubblicabile senza compilare allergeni; disclaimer presente.

### P4 — Privacy/GDPR su QR e dati cliente
- Informativa privacy al primo scan, consenso per dati/marketing.
- **Done:** primo scan mostra informativa; consensi registrati.

> Nota strategica: G2 può anche partire come **integrazione con un RT esistente** del ristorante (meno attrito di vendita) prima di diventare nativo.

## PIANO PAYMENTS_ENGINEER (G3)
### P1 — Pay-at-table digitale
- Satispay (fortissimo in Italia), Apple/Google Pay, carta. Provider: Stripe/SumUp/Nexi/Satispay Business.
- Dal telefono cliente, a fine pasto: paga il conto.
- **Done:** cliente paga dal telefono, bill marcato `paid`, staff notificato.
### P2 — Split e mance
- Dividi conto digitale (slider già previsto) + mancia.
- **Done:** 3 persone pagano quote separate; mancia opzionale aggiunta.
### P3 — Riconciliazione cassa
- Incassi digitali nel registro cassa + statistiche metodo pagamento.
- **Done:** statistiche mostrano contante vs digitale.

## PIANO OPS_ENGINEER (G4, G5, G6 + backlog operativo)
### P1 — Stampa comanda termica (G4, già in backlog)
- `escpos` Node; settings IP/porta stampante; stampa su conferma ordine; routing per reparto (cucina/bar).
- **Done:** ordine confermato → comanda esce dalla stampante giusta.
### P2 — Prenotazioni (G5, già in backlog Fase 3)
- Form pubblico `/prenota/:slug` (no login); sezione `/dashboard/prenotazioni`; conferma/rifiuto; notifica.
- **Done:** cliente prenota da link/QR; staff gestisce in dashboard.
### P3 — Asporto & delivery proprio (G6)
- Modalità ordine `takeaway`/`delivery` nel customer PWA; slot orari; raggio consegna; nessuna commissione.
- **Done:** cliente ordina asporto con orario di ritiro; ordine in KDS con tag asporto.
### P4 — Mappa sala + assegnazione cameriere (backlog Fase 3)
- `tables.posX/posY` già in schema; drag&drop; `assignedWaiterId`.
- **Done:** sala digitale rispecchia quella fisica; ordini filtrabili per cameriere.
### P5 — Scarico magazzino automatico (backlog Fase 3)
- `menu_item_ingredients`; su `served` scala ingredienti.
- **Done:** ogni piatto venduto scala gli ingredienti; alert sotto soglia.

## PIANO GROWTH_ENGINEER (G7, G8)
### P1 — Menu multilingua (G7)
- Auto-traduzione menu (IT→EN/DE/FR/ES) via AI; cache; selettore lingua nel PWA.
- **Done:** turista vede il menu nella sua lingua con un tap.
### P2 — Funnel recensioni Google (G8)
- A fine pasto / dopo pagamento: invito a lasciare recensione Google (deep link).
- **Done:** cliente soddisfatto portato alla pagina recensione Google.
### P3 — Programma fedeltà (G8)
- Punti per scontrino (no login: identità leggera via telefono/email con consenso); premi.
- **Done:** cliente accumula punti e li redime su un ordine.
### P4 — WhatsApp/notifiche (backlog "fuori scope")
- Notifica "ordine pronto" / "tavolo pronto" / conferma prenotazione via WhatsApp Business API o SMS.
- **Done:** cliente riceve notifica fuori dall'app.

## PIANO DATA_ENGINEER (intelligenza, su analytics esistenti)
### P1 — Alert proattivi
- Magazzino sotto soglia, piatto in perdita (food cost > prezzo×soglia), calo incassi vs settimana.
- **Done:** owner riceve alert in dashboard + via Copilot AI.
### P2 — Food cost & margini real-time
- Da `menu_item_ingredients` + costo ingredienti → margine per piatto live in insights.
- **Done:** insights mostra margine € e % per piatto.
### P3 — Forecast domanda / staffing
- Da `table_sessions` + ordini storici → previsione coperti per fascia/giorno.
- **Done:** "giovedì sera previsti ~80 coperti, considera un cameriere in più".
### P4 — Upsell dinamico
- Suggerimenti AI in fase ordine (cliente) e abbinamenti.
- **Done:** carrello con margherita suggerisce bibita/dolce ad alto margine.

## PIANO INFRA_ENGINEER (G9, G10 + backlog tecnico)
### P1 — Offline-first reale (G9)
- Service worker PWA, coda ordini offline, sync alla riconnessione.
- **Done:** stacca il WiFi → cliente ordina lo stesso → sync al ritorno linea.
### P2 — Multi-tenant RLS completo (G10, backlog)
- `withRestaurantContext()` applicata a ogni route autenticata.
- **Done:** nessuna query cross-tenant possibile; test di isolamento verde.
### P3 — Backup automatici + onboarding self-serve
- Dump Postgres schedulato; wizard onboarding già esiste, renderlo end-to-end.
- **Done:** backup giornaliero; un ristoratore nuovo va da zero a operativo da solo.
### P4 — Hardening P0 sicurezza (dal BACKLOG, prerequisito AI cliente)
- JWT al resolve QR (sblocca scope tool cliente), CSP on, token in cookie HttpOnly, rate limit ai-chat.
- **Done:** waiter-call/ai-chat senza token → 401; nessun token in localStorage.

---

## CRITERI DI SUCCESSO MISURABILI

| Criterio | Oggi | Target |
|----------|------|--------|
| Azioni eseguibili via chat (cliente) | 0 | ordina, modifica, stato, chiama, paga |
| Azioni eseguibili via chat (owner) | 0 | menu, prezzi, 86, stats, magazzino, staff, promo |
| Affidabilità tool-use (azione giusta al 1° tentativo) | n/a | ≥ 90% |
| Conferma su azioni irreversibili | n/a | 100% |
| Scontrino fiscale emesso a chiusura conto | ❌ | ✅ valido |
| Pagamento digitale dal telefono | ❌ | ✅ Satispay/carta |
| Stampa comanda termica | ❌ | ✅ |
| Prenotazioni gestite in dashboard | ❌ | ✅ |
| Menu multilingua | ❌ | ✅ ≥4 lingue |
| Offline: ordine con linea staccata | ❌ | ✅ sync al ritorno |
| Multi-tenant RLS su tutte le route | parziale | 100% |
| Tempo onboarding ristoratore nuovo | n/a | < 30 min self-serve |

---

## ORDINE DI ESECUZIONE CONSIGLIATO

**Fase 0 — Prerequisiti (sblocca AI cliente sicura)**
1. INFRA P4 — P0 sicurezza: JWT al resolve QR + rate limit + CSP + cookie.

**Fase 1 — Il differenziatore (l'AI agentico, la richiesta)**
2. AI P1 — Core agentico (agent + registry + provider Claude).
3. AI P2 — Tool cliente vincolati a sessione.
4. AI P3 — Upgrade UI chat cliente (ordina via chat).
5. AI P4 — Tool ristoratore.
6. AI P5 — UI Copilot dashboard (Cmd+K).
7. AI P6 — Guardrail + audit log.

**Fase 2 — Il must legale ed economico**
8. COMPLIANCE P1–P2 — Scontrino/RT + corrispettivi.
9. PAYMENTS P1–P2 — Pay-at-table + split/mance.
10. OPS P1 — Stampa comanda termica.

**Fase 3 — Ganci di vendita**
11. OPS P2–P3 — Prenotazioni + asporto/delivery.
12. GROWTH P1–P2 — Multilingua + recensioni Google.
13. DATA P1–P2 — Alert + food cost.

**Fase 4 — Scala e robustezza**
14. INFRA P1 — Offline-first reale.
15. INFRA P2–P3 — RLS + backup + onboarding.
16. OPS P4–P5, GROWTH P3–P4, DATA P3–P4 — completamento.

---

## DECISIONI APERTE DA CONFERMARE CON MANUEL
1. **Modello AI**: Claude (Anthropic) primario vs restare su Groq. → Raccomando Claude Haiku per affidabilità tool-use; Groq fallback.
2. **Conformità fiscale**: integrare un RT esistente del ristorante (veloce, meno attrito) vs RT nativo (più lavoro, più valore). → Raccomando integrazione prima, nativo poi.
3. **Pagamenti**: Satispay-first (mercato IT) vs Stripe generico. → Raccomando Satispay + carta via Stripe/SumUp.
4. **Offline + AI**: comunicare chiaro che core è locale ma AI richiede internet. Confermare che va bene.

## Connessioni (brain)
- [[progetto-tako]] · [[jarvis-piano-perfection]] (modello di stile) · [[marketing-tako]] · [[piano-studio-2026]]
