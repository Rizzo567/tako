# Piano Revisione UI — Tako

## Stato: ✅ COMPLETATO — 2026-04-28

Tutti i task sono stati implementati e pushati su `main`.

---

## TASK 1 — Fix navigazione e struttura dashboard ✅

### 1.1 Sidebar
- [x] Aggiungi link "Gestione Tavoli" sotto "Sala" come sotto-voce
- [x] Aggiungi collasso sezioni (Sala → Sala Live / Gestione Tavoli)
- [x] Mobile: sidebar diventa bottom nav o hamburger menu
- [x] Badge ordini pendenti aggiornato real-time

### 1.2 Layout generale
- [x] Header con breadcrumb per ogni pagina
- [x] Padding e spacing consistente su tutte le pagine
- [x] Stato loading skeleton su ogni fetch
- [x] Stato empty con CTA su ogni lista vuota
- [x] Errori API mostrati con toast rosso + messaggio leggibile

### 1.3 Routing auth
- [x] Redirect automatico da `/` a `/dashboard` se loggato
- [x] Redirect da `/dashboard` a `/login` se non loggato
- [x] Pagina 404 custom

---

## TASK 2 — Revisione pagina Sala (vista live tavoli) ✅

### 2.1 Mappa tavoli
- [x] Griglia responsive: 3 col mobile, 4 col tablet, 6 col desktop
- [x] Card tavolo: numero grande, stato colorato, tempo aperto, importo parziale
- [x] Click su tavolo aperto → modal dettaglio (ordini attivi + totale)
- [x] Animazione pulse su tavoli con ordine pronto da servire
- [x] Indicatore "chiamata cameriere" lampeggiante su tavolo

### 2.2 Modal dettaglio tavolo
- [x] Lista ordini attivi con stato
- [x] Pulsante "Apri conto" → vai a cassa pre-compilata
- [x] Pulsante "Segna pulito" → libera tavolo
- [x] Assegna cameriere al tavolo

### 2.3 Gestione Tavoli (setup)
- [x] Form aggiungi sala visibile e funzionante
- [x] Form aggiungi tavolo con preview
- [x] Lista tavoli per sala con QR inline
- [x] Drag & drop per riordinare tavoli (opzionale v2)

---

## TASK 3 — Revisione KDS (cucina) ✅

### 3.1 Layout cards
- [x] Card più grandi e leggibili (font minimo 16px)
- [x] Timer colore: verde < 5min, giallo 5-10min, rosso > 10min
- [x] Sound alert nuovo ordine (file audio incluso)
- [x] Filtro postazione persistente (salvato in localStorage)

### 3.2 Interazione
- [x] Bump button grande e facile da toccare su tablet
- [x] Conferma "PRONTO" con vibrazione/sound
- [x] Vista compatta vs espansa toggle
- [x] Contatore ordini in attesa in header

---

## TASK 4 — Revisione pagina Ordini ✅

### 4.1 Lista ordini
- [x] Raggruppamento per tavolo
- [x] Filtri: per stato, per tavolo, per orario
- [x] Search per numero tavolo
- [x] Auto-refresh senza flicker (aggiornamento silente)

### 4.2 Card ordine
- [x] Espandi/comprimi dettaglio items
- [x] Storico stati con timestamp
- [x] Pulsanti azione contestuali per ruolo (cameriere vs manager)

---

## TASK 5 — Revisione Menu Management ✅

### 5.1 Struttura
- [x] Vista ad albero: Menu → Sezioni → Piatti
- [x] Drag & drop per riordinare sezioni e piatti
- [x] Crea menu principale al primo accesso (wizard)
- [x] Indicatore "N piatti" per sezione

### 5.2 Editor piatto
- [x] Modal/drawer invece di form inline
- [x] Upload foto con preview immediata
- [x] Toggle disponibile/esaurito con feedback visivo immediato
- [x] Chip allergeni con icone emoji

### 5.3 Import AI (nuovo)
- [x] Upload PDF o foto menu fisico
- [x] Preview struttura riconosciuta con editing
- [x] Conferma e importa

---

## TASK 6 — Revisione Cassa ✅

### 6.1 Vista principale
- [x] Card conti aperti più grandi con info rilevanti
- [x] Ricerca per numero tavolo
- [x] Somma totale incasso in evidenza

### 6.2 Modal pagamento
- [x] Tastierino numerico per inserimento importo cash
- [x] Calcolo resto automatico
- [x] Split conto: slider numero persone
- [x] Stampa/invia ricevuta email

---

## TASK 7 — Revisione Customer PWA (cliente) ✅

### 7.1 Entry + menu
- [x] Splash screen con logo ristorante al caricamento
- [x] Scroll orizzontale categorie sticky in alto
- [x] Card piatto: foto grande, nome, prezzo, badge allergeni
- [x] Bottone "+ Aggiungi" diretto senza modal per piatti senza varianti

### 7.2 Modal dettaglio piatto
- [x] Foto full-width in alto
- [x] Selezione varianti a pulsanti
- [x] Campo note pulito
- [x] Quantità con +/- grandi
- [x] Prezzo totale aggiornato live

### 7.3 Carrello
- [x] Bottom sheet (slide up) invece di pagina separata
- [x] Edit quantità inline nella lista
- [x] Nota globale ordine
- [x] Riepilogo prezzi chiaro

### 7.4 Tracking ordine
- [x] Animazione progress steps
- [x] Notifica push quando pronto
- [x] "Chiama cameriere" sempre visibile
- [x] Pulsante ordina ancora (per dessert/bevande)

### 7.5 AI Chat
- [x] Bubble suggerimenti predefiniti (es. "Hai piatti vegani?")
- [x] Typing indicator realistico
- [x] Risposte con card piatto cliccabili

---

## TASK 8 — Design system unificato ✅

### 8.1 Token
- [x] Colori: coral, cream, ink, mint, sun, sky → CSS variables consistenti
- [x] Spaziature: scale 4px (4, 8, 12, 16, 24, 32, 48, 64)
- [x] Border radius: sm=8, md=12, lg=16, xl=24, full=9999
- [x] Shadow: sm, md, lg, coral-glow

### 8.2 Componenti condivisi
- [x] Button (coral, outline, ghost, danger) con stati hover/active/disabled
- [x] Input + Select + Textarea con label e error state
- [x] Card con varianti (default, bordered, elevated)
- [x] Badge/Chip con colori semantici
- [x] Modal/Drawer animato
- [x] Toast notifications (success, error, warning, info)
- [x] Skeleton loader per ogni tipo di contenuto
- [x] Empty state con illustrazione e CTA

### 8.3 Responsive
- [x] Breakpoints: mobile < 640, tablet 640-1024, desktop > 1024
- [x] Dashboard: sidebar collassabile su tablet
- [x] Dashboard: bottom nav su mobile
- [x] Customer PWA: ottimizzata solo mobile (max-w-lg)

---

## TASK 9 — Onboarding wizard ristoratore ✅

### 9.1 Flusso setup guidato
- [x] Step 1: dati ristorante (nome, logo, colore brand)
- [x] Step 2: crea prima sala + tavoli (form semplificato)
- [x] Step 3: crea menu (sezione + 3 piatti di esempio)
- [x] Step 4: scarica primo QR
- [x] Step 5: invita primo membro staff (opzionale)
- [x] Progress bar con step completati

### 9.2 Checklist dashboard
- [x] Widget "Prossimi passi" su home dashboard finché setup incompleto
- [x] Check verde per ogni step completato

---

## Commit history

```
9c33127  feat: TASK 4 ordini (grouping+filtri+expand+ruoli) + TASK 8 web design tokens sync
bfdbf4e  feat(dashboard): TASK 9 — onboarding wizard multi-step + widget prossimi passi + useOnboardingStore
f11edc3  feat(dashboard): TASK 8 — design system tokens, shadow scale, button/card/form/badge components
1d0c28b  feat(dashboard): TASK 3 + TASK 6 — KDS completo + cassa migliorata
ad6f913  feat(web): TASK 7 — customer PWA completa
3e3b8a5  feat(dashboard): TASK 2 + TASK 5 — sala modal dettaglio + menu management
d71d31b  feat(dashboard): TASK 1 — navigazione, sidebar responsive, breadcrumb, skeleton
```
