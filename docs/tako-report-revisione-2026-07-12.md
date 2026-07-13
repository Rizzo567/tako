# Tako — Report revisione totale (2026-07-12)

Revisione completa dell'appliance Tako: test funzionale di tutte le aree contro l'API reale (ristorante di test "Pizzeria"), correzione dei bug trovati, potenziamento inventario, e produzione della documentazione. Metodo: goal + loop engineering, test con token owner e sessione tavolo reale, verifica end-to-end di ogni fix.

## Esito complessivo
**12/12 aree funzionanti** dopo i fix (11/12 al primo giro, poi corretto l'ultimo bug). 3 bug reali trovati e **tutti risolti e verificati**. Inventario trasformato da lista statica a gestionale completo.

## Aree testate (PASS)
| Area | Esito | Note |
|---|---|---|
| Auth / sessioni | ✅ | token owner ok, 401 senza token, cookie tavolo ok |
| Menu CRUD (sezioni, piatti, varianti, traduzioni) | ✅ | delete su piatto di ordine pagato → ok (fix confermato) |
| Ordini (cliente + staff, stati, idempotenza) | ✅ | transizioni illecite → 409; annullo con ricalcolo conto |
| Conti / cassa (apertura auto, sconto, pagamento) | ✅ | chiusura revoca sessione tavolo; pagamento su chiuso → 409 |
| Tavoli / sale / QR | ✅ | QR con mode/lanUrl/cloudUrl/ipUrl; **numero duplicato ora respinto (fix)** |
| Prenotazioni (self-service + owner, gating) | ✅ | flag reservationsEnabled rispettato, orario invalido → 400 |
| Inventario (potenziato) | ✅ | create/edit/movimenti/reorder/stats/archive coerenti |
| Assistente cliente AI | ✅ | 14 lingue, add_to_cart + pulsanti, prezzo dal server |
| Sistema / rete (connectivity, net-health, info) | ✅ | online, loss 0%, avg ~14ms |
| WhatsApp | ✅ | status connesso, whitelist numeri |
| Stats / insights | ✅ | dashboard revenue/ticket/conversione |
| Impostazioni (merge flag) | ✅ | persistenza + merge che preserva le altre chiavi |

## Bug trovati e risolti (verificati)
1. **[ALTA] Delete sezioni/piatti dava 500** — la colonna `order_items.menu_item_id` era `NOT NULL` sul DB mentre il codice la azzera per conservare lo storico ordini. → Migration `0012` la rende nullable. Verificato: delete di un piatto referenziato da un ordine pagato riesce.
2. **[MEDIA] Numeri tavolo duplicati accettati** — il vincolo UNIQUE `(restaurant_id, number)` non esisteva sul DB (la 0006 lo saltava in presenza di duplicati). Rischio: conti/ordini sul tavolo sbagliato quando si risolve per numero. → Migration `0014` (dedup difensivo + indice UNIQUE parziale sugli attivi). Verificato: creazione di un numero già esistente → **409**.
3. **[MEDIA] QR Codes: scroll rotto + pulsante Scarica fuori a destra** — due bottoni `full` (100%) affiancati sforavano la card e l'overflow orizzontale rompeva lo scroll. → Bottoni adattivi/wrap, card `overflow:hidden`, azioni header che wrappano.
4. **[BASSA] Inventario: articoli archiviati restavano in lista** — `GET /inventory` non filtrava `active`. → Aggiunto filtro `active=true` a lista e alert.

Bug minore già risolto in precedenza nella stessa sessione: assistente cliente sempre in italiano (short-circuit) + leak tool-call.

## Inventario — potenziamento (nuovo)
Da lista statica a gestionale di magazzino:
- **Modifica** e **archiviazione** articoli (prima impossibile — mancanza più grave).
- **Cruscotto**: valore totale magazzino, n° articoli, sotto-scorta, esauriti.
- **Lista di riordino** per fornitore con quantità suggerita (fino al *par level*), costo stimato, "Copia lista".
- **Consumo 30gg** e **giorni-alla-rottura** di stock per articolo.
- **Quick-adjust** giacenza (carico/scarico/rettifica/spreco) + **storico movimenti**.
- Nuova colonna `par_level` (migration `0013`); endpoint `PATCH/DELETE /:id`, `GET /stats`, `GET /reorder`, `GET /:id/movements`; azione AI copilot `reorder_list`.
- Già esistenti e confermati: import inventario da testo con AI, scarico automatico da ricetta (`stock-deduct`, flag `autoStockDeductEnabled`).

## Punti deboli / carenze (onesti, dal codice)
- **Nessun pagamento online** nel core (no Stripe/carte); nessuna **fatturazione fiscale** (RT/SDI) — scontrino ESC/POS solo di cortesia. *(decisione attiva)*
- **Dipendenza da un Mac sempre acceso**; app macOS **non firmata/notarizzata** (blocco: Apple Developer $99).
- **AI richiede internet + chiave** (Groq testo, Gemini foto). Offline le funzioni AI si disabilitano (by design).
- **mDNS `tako.local`** non affidabile su **Android < 12** → fallback IP diretto (serve IP stabile / DHCP reservation).
- **Scarico magazzino da ricetta** best-effort, non atomico; richiede di definire le ricette piatto→ingredienti.
- **WhatsApp** non collaudato end-to-end in produzione (opt-in, whitelist).
- Niente **account cliente**, niente **marketing WA/SMS**, **analytics** limitate.
- Reference stile WhatsApp scritta raw (non ripassa da `sharp` come le foto piatto) — minore.

## Documenti prodotti
- `docs/tako-funzionalita-ristoratori.md` — cosa fa Tako, per i ristoratori (+ limiti).
- `docs/tako-tecnico-interno.md` — riferimento tecnico completo (architettura, dati, route, AI, rete, deploy).
- `docs/setup-rete-ristorante.md` — guida installazione rete (LAN-first, hotspot Mac).
- questo report.

## Migrazioni aggiunte
`0012` order_items nullable · `0013` inventory par_level · `0014` tables unique number. Applicate all'avvio dell'appliance.
