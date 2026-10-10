# Tako — Memoria: come creo le ad "creative" con Claude

Dammi in pasto questo file a inizio chat: contiene tutto quello che serve per riprendere
esattamente da dove eravamo rimasti sulla creazione dei post/ads creativi di Tako.

## Il prodotto
Tako è un'app per ristoranti (menù digitale via QR, ordini dal tavolo, assistente AI
"cameriere", carrello, tracking ordine). Mascotte: un polpo corallo. Tono del brand:
giocoso ma premium, mai infantile.

## Dove vivono le ads
- File canvas: `ads/Tako Campagne Creative.html` — 5 card 1080×1350 (4:5) affiancate
  su canvas pannabile (`<meta name="design_doc_mode" content="canvas">`).
- Ogni card = 1 campagna. Anatomia della card:
  - `.ph` = pannello descrittivo con `num`, `tag` (tecnica), `desc` (concept in italiano),
    `prompt` (prompt ENG pronto da copiare per il generatore di immagini) e `file`
    ("trascina qui → posts/cc-N.jpeg").
  - `<img class="photo" src="posts/cc-N.jpeg" onerror="this.style.display='none'">` —
    finché l'immagine non c'è, resta visibile il pannello col prompt; quando l'utente
    trascina l'immagine generata in `ads/posts/`, la foto copre il pannello.
  - `.headline` = titolo grande sopra la foto, con parole chiave evidenziate
    (`<span class="hl hl-green hl-serif">` / `hl-blue` / `hl-mono`).
  - `.brand` = logo `posts/tako-logo.png` + handle "Tako" (center/right).

## Il flusso di lavoro (IMPORTANTE)
1. L'utente propone un concept per una campagna (o chiede idee: proporne 3-4, brevi).
2. Io scrivo/aggiorno la card: `tag`, `desc` (ITA) e `prompt` (ENG).
3. L'utente genera l'immagine ALTROVE (Midjourney/simili) allegando il PNG della
   mascotte come riferimento, poi mi riallega il risultato in chat.
4. Io copio l'upload in `ads/posts/cc-N.jpeg` — la card la mostra da sola.
Non genero immagini io; non disegno SVG; il mio output sono prompt + markup.

## La regola d'oro del prompt (mascotte identica)
Ogni prompt con Tako DEVE includere questo blocco descrittivo, letterale:

> the octopus EXACTLY like the reference image: flat coral-red (#ED7159) rounded body,
> lighter coral belly and highlight patch, two big white oval eyes with happy closed
> curved lashes, small smile, soft pink blush cheeks, eight smooth tentacles with pale
> suction cups, thick dark outline feel translated into soft 3D.

E chiudere con: `— 4:5. Attach the reference PNG of the mascot for character match.`
Il PNG di riferimento è la mascotte "hello" (in progetto: `uploads/tako-hello.png`).

## Lo stile visivo dei prompt
- **premium 3D CGI render, Pixar-style** — sempre, salvo la campagna "arte".
- Ripresa **cinematica**: wide shot, prospettiva profonda, angolo basso/tre quarti,
  soggetto NON incollato all'oggetto di scena (es. lontano dal bersaglio, sulla linea
  di tiro); elementi in primo piano sfocati (pinte, sabbia), shallow depth of field,
  warm light, rim light, `8k octane render`.
- Formato sempre **4:5** (1080×1350).
- Umorismo situazionale: la gag deve leggersi in mezzo secondo (scottatura, freccetta
  nel bersaglio, sipario).

## Le 5 campagne (stato attuale)
1. **Mostra la natura del tuo prodotto** — Tako scottato su sdraio in spiaggia,
   espressione infastidita, "maschera" chiara da occhiali. ✅ `posts/cc-1.jpeg`
2. **Lancia una frecciatina al tuo competitor** — Tako gioca a freccette al pub,
   ripresa cinematica da dietro, bersaglio lontano. Pun letterale. ✅ `posts/cc-2.jpeg`
3. **Giochi di parole nella tua nicchia** — "È un polpo di scena": Tako sbuca dal
   sipario rosso a teatro sotto spotlight. ⬜ manca `posts/cc-3.jpeg`
4. **Gioca con l'arte e l'effetto del tuo prodotto** — L'Urlo di Munch in galleria,
   il telefono nel quadro mostra l'app Tako VERA (composited). ✅ `posts/cc-4.png`
   (fatto con chroma-key: vedi `Tako Urlo.html`, app live nel green screen del quadro).
5. **Il tuo brand è già un personaggio iconico** — Tako supereroe CGI su una rupe,
   mantello e fulmini. ✅ `posts/cc-5.jpeg`

## Preferenze dell'utente (imparate sul campo)
- Chiede modifiche piccole e iterative: eseguile e basta, risposte brevissime in italiano.
- "Risoluzione perfetta" = niente immagini scalate male; per UI dentro immagini si usa
  la tecnica iframe live + PNG scontornato davanti (come hero landing e Tako Urlo).
- I pun in italiano contano più della descrizione: headline corta, gioco di parole al centro.
