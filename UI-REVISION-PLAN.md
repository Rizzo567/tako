# Piano Revisione UI — Tako

## Problemi attuali

- Dashboard: navigazione incompleta, pagine mancanti (Gestione Tavoli non raggiungibile da sidebar)
- Dashboard: nessun feedback visivo su azioni (toast insufficienti)
- Customer PWA: non testata end-to-end
- Entrambe: nessun stato empty/loading/error consistente
- Mobile dashboard: sidebar non responsive

---

## TASK 1 — Fix navigazione e struttura dashboard

### 1.1 Sidebar
- [ ] Aggiungi link "Gestione Tavoli" sotto "Sala" come sotto-voce
- [ ] Aggiungi collasso sezioni (Sala → Sala Live / Gestione Tavoli)
- [ ] Mobile: sidebar diventa bottom nav o hamburger menu
- [ ] Badge ordini pendenti aggiornato real-time

### 1.2 Layout generale
- [ ] Header con breadcrumb per ogni pagina
- [ ] Padding e spacing consistente su tutte le pagine
- [ ] Stato loading skeleton su ogni fetch
- [ ] Stato empty con CTA su ogni lista vuota
- [ ] Errori API mostrati con toast rosso + messaggio leggibile

### 1.3 Routing auth
- [ ] Redirect automatico da `/` a `/dashboard` se loggato
- [ ] Redirect da `/dashboard` a `/login` se non loggato
- [ ] Pagina 404 custom

---

## TASK 2 — Revisione pagina Sala (vista live tavoli)

### 2.1 Mappa tavoli
- [ ] Griglia responsive: 3 col mobile, 4 col tablet, 6 col desktop
- [ ] Card tavolo: numero grande, stato colorato, tempo aperto, importo parziale
- [ ] Click su tavolo aperto → modal dettaglio (ordini attivi + totale)
- [ ] Animazione pulse su tavoli con ordine pronto da servire
- [ ] Indicatore "chiamata cameriere" lampeggiante su tavolo

### 2.2 Modal dettaglio tavolo
- [ ] Lista ordini attivi con stato
- [ ] Pulsante "Apri conto" → vai a cassa pre-compilata
- [ ] Pulsante "Segna pulito" → libera tavolo
- [ ] Assegna cameriere al tavolo

### 2.3 Gestione Tavoli (setup)
- [ ] Form aggiungi sala visibile e funzionante
- [ ] Form aggiungi tavolo con preview
- [ ] Lista tavoli per sala con QR inline
- [ ] Drag & drop per riordinare tavoli (opzionale v2)

---

## TASK 3 — Revisione KDS (cucina)

### 3.1 Layout cards
- [ ] Card più grandi e leggibili (font minimo 16px)
- [ ] Timer colore: verde < 5min, giallo 5-10min, rosso > 10min
- [ ] Sound alert nuovo ordine (file audio incluso)
- [ ] Filtro postazione persistente (salvato in localStorage)

### 3.2 Interazione
- [ ] Bump button grande e facile da toccare su tablet
- [ ] Conferma "PRONTO" con vibrazione/sound
- [ ] Vista compatta vs espansa toggle
- [ ] Contatore ordini in attesa in header

---

## TASK 4 — Revisione pagina Ordini

### 4.1 Lista ordini
- [ ] Raggruppamento per tavolo
- [ ] Filtri: per stato, per tavolo, per orario
- [ ] Search per numero tavolo
- [ ] Auto-refresh senza flicker (aggiornamento silente)

### 4.2 Card ordine
- [ ] Espandi/comprimi dettaglio items
- [ ] Storico stati con timestamp
- [ ] Pulsanti azione contestuali per ruolo (cameriere vs manager)

---

## TASK 5 — Revisione Menu Management

### 5.1 Struttura
- [ ] Vista ad albero: Menu → Sezioni → Piatti
- [ ] Drag & drop per riordinare sezioni e piatti
- [ ] Crea menu principale al primo accesso (wizard)
- [ ] Indicatore "N piatti" per sezione

### 5.2 Editor piatto
- [ ] Modal/drawer invece di form inline
- [ ] Upload foto con preview immediata
- [ ] Toggle disponibile/esaurito con feedback visivo immediato
- [ ] Chip allergeni con icone emoji

### 5.3 Import AI (nuovo)
- [ ] Upload PDF o foto menu fisico
- [ ] Preview struttura riconosciuta con editing
- [ ] Conferma e importa

---

## TASK 6 — Revisione Cassa

### 6.1 Vista principale
- [ ] Card conti aperti più grandi con info rilevanti
- [ ] Ricerca per numero tavolo
- [ ] Somma totale incasso in evidenza

### 6.2 Modal pagamento
- [ ] Tastierino numerico per inserimento importo cash
- [ ] Calcolo resto automatico
- [ ] Split conto: slider numero persone
- [ ] Stampa/invia ricevuta email

---

## TASK 7 — Revisione Customer PWA (cliente)

### 7.1 Entry + menu
- [ ] Splash screen con logo ristorante al caricamento
- [ ] Scroll orizzontale categorie sticky in alto
- [ ] Card piatto: foto grande, nome, prezzo, badge allergeni
- [ ] Bottone "+ Aggiungi" diretto senza modal per piatti senza varianti

### 7.2 Modal dettaglio piatto
- [ ] Foto full-width in alto
- [ ] Selezione varianti a pulsanti
- [ ] Campo note pulito
- [ ] Quantità con +/- grandi
- [ ] Prezzo totale aggiornato live

### 7.3 Carrello
- [ ] Bottom sheet (slide up) invece di pagina separata
- [ ] Edit quantità inline nella lista
- [ ] Nota globale ordine
- [ ] Riepilogo prezzi chiaro

### 7.4 Tracking ordine
- [ ] Animazione progress steps
- [ ] Notifica push quando pronto
- [ ] "Chiama cameriere" sempre visibile
- [ ] Pulsante ordina ancora (per dessert/bevande)

### 7.5 AI Chat
- [ ] Bubble suggerimenti predefiniti (es. "Hai piatti vegani?")
- [ ] Typing indicator realistico
- [ ] Risposte con card piatto cliccabili

---

## TASK 8 — Design system unificato

### 8.1 Token
- [ ] Colori: coral, cream, ink, mint, sun, sky → CSS variables consistenti
- [ ] Spaziature: scale 4px (4, 8, 12, 16, 24, 32, 48, 64)
- [ ] Border radius: sm=8, md=12, lg=16, xl=24, full=9999
- [ ] Shadow: sm, md, lg, coral-glow

### 8.2 Componenti condivisi
- [ ] Button (coral, outline, ghost, danger) con stati hover/active/disabled
- [ ] Input + Select + Textarea con label e error state
- [ ] Card con varianti (default, bordered, elevated)
- [ ] Badge/Chip con colori semantici
- [ ] Modal/Drawer animato
- [ ] Toast notifications (success, error, warning, info)
- [ ] Skeleton loader per ogni tipo di contenuto
- [ ] Empty state con illustrazione e CTA

### 8.3 Responsive
- [ ] Breakpoints: mobile < 640, tablet 640-1024, desktop > 1024
- [ ] Dashboard: sidebar collassabile su tablet
- [ ] Dashboard: bottom nav su mobile
- [ ] Customer PWA: ottimizzata solo mobile (max-w-lg)

---

## TASK 9 — Onboarding wizard ristoratore

### 9.1 Flusso setup guidato
- [ ] Step 1: dati ristorante (nome, logo, colore brand)
- [ ] Step 2: crea prima sala + tavoli (form semplificato)
- [ ] Step 3: crea menu (sezione + 3 piatti di esempio)
- [ ] Step 4: scarica primo QR
- [ ] Step 5: invita primo membro staff (opzionale)
- [ ] Progress bar con step completati

### 9.2 Checklist dashboard
- [ ] Widget "Prossimi passi" su home dashboard finché setup incompleto
- [ ] Check verde per ogni step completato

---

## Ordine di esecuzione

```
Settimana 1: TASK 1 (navigazione) + TASK 2 (sala) + TASK 5.1-5.2 (menu base)
Settimana 2: TASK 7 (customer PWA completa)
Settimana 3: TASK 3 (KDS) + TASK 6 (cassa) + TASK 8 (design system)
Settimana 4: TASK 9 (onboarding) + TASK 4 (ordini) + bug fix
```
