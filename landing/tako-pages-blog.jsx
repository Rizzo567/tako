/* global React, TAKO_PAGES, PageHero, Band, SectionHead, CtaBand, pageUrl, TRIAL_URL */
/* tako-pages-blog.jsx — Articoli del blog: case study verosimili di trattorie,
   ristoranti e bar che usano Tako. Ogni articolo è registrato come pagina
   dedicata (slug "blog-...") e linkato dall'indice blog. */

/* ─────────── Layout articolo ─────────── */
function ArticleMeta({ kind, city, author, date, read }) {
  const initials = author.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <div className="flex flex-col items-center gap-5 mb-12">
      <a href={pageUrl('blog')} className="text-sm font-bold reveal" style={{ color: 'var(--coral-deep)' }}>← Tutti gli articoli</a>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 reveal">
        <span className="chip" style={{ padding: '4px 12px', fontSize: 12 }}>{kind} · {city}</span>
        <span className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
          <span className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-display font-black text-white" style={{ background: 'var(--coral)' }}>{initials}</span>
          {author}
        </span>
        <span className="text-sm" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>· {date} · {read} di lettura</span>
      </div>
    </div>
  );
}

function ArticleBody({ blocks }) {
  return (
    <div className="article-prose">
      {blocks.map((b, i) => {
        if (b.h) return <h3 key={i} className="text-2xl md:text-3xl mt-11 mb-3 reveal" style={{ color: 'var(--ink)', lineHeight: 1.15 }}>{b.h}</h3>;
        if (b.quote) return (
          <blockquote key={i} className="my-10 pl-6 reveal" style={{ borderLeft: '4px solid var(--coral)' }}>
            <p className="font-display font-black text-2xl md:text-[28px] leading-snug" style={{ color: 'var(--ink)' }}>“{b.quote}”</p>
            {b.by && <footer className="mt-4 text-[15px] font-bold" style={{ color: 'var(--ink-soft)' }}>— {b.by}</footer>}
          </blockquote>
        );
        if (b.list) return (
          <ul key={i} className="my-6 space-y-3">
            {b.list.map((li, j) => (
              <li key={j} className="flex items-start gap-3 text-[17px] md:text-[18px] leading-relaxed reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                <span className="flex-none w-6 h-6 mt-0.5 grid place-items-center rounded-full text-white text-[12px] font-black" style={{ background: 'var(--coral)' }}>✓</span>
                <span>{li}</span>
              </li>
            ))}
          </ul>
        );
        return <p key={i} className="text-[17px] md:text-[18px] leading-relaxed mb-5 reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{b.p}</p>;
      })}
    </div>
  );
}

function Article(a) {
  return (
    <>
      <PageHero kicker={`Blog · ${a.tag}`} title={a.title} sub={a.lede} />
      <Band tint="cream" narrow>
        <ArticleMeta kind={a.kind} city={a.city} author={a.author} date={a.date} read={a.read} />
        <div className="chunky overflow-hidden mb-12 reveal-pop">
          <div className="px-7 py-8 flex items-center gap-5" style={{ background: a.color }}>
            <img src={a.mascot || 'assets/tako-chef.png'} alt="" className="w-20 h-20 flex-none float-y" style={{ objectFit: 'contain' }} />
            <div>
              <div className="text-xs font-bold tracking-wider uppercase mb-1" style={{ color: 'var(--coral-deep)' }}>Il locale</div>
              <div className="font-display font-black text-2xl" style={{ color: 'var(--ink)' }}>{a.venue}</div>
              <div className="text-[15px] mt-0.5" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{a.kind} · {a.city} · {a.detail}</div>
            </div>
          </div>
        </div>
        <ArticleBody blocks={a.blocks} />
      </Band>
      <Band tint="tint">
        <SectionHead chip="Il risultato" title={<span>Cosa è cambiato <span className="grad-text">in numeri.</span></span>} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {a.results.map((s, i) => (
            <div key={i} className="text-center reveal-pop" style={{ transitionDelay: `${i * 0.06}s` }}>
              <div className="font-display font-black text-4xl md:text-5xl grad-text">{s.n}</div>
              <div className="mt-2 font-bold text-[15px]" style={{ color: 'var(--ink-soft)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Band>
      <CtaBand title="La tua storia, il prossimo articolo." sub="Prova Tako 30 giorni. Senza carta, senza vincoli." />
    </>
  );
}

/* ─────────── Articoli ─────────── */
const TAKO_ARTICLES = [
  {
    slug: 'blog-attesa',
    tag: 'Gestione', color: '#FFEEE8', read: '5 min', mascot: 'assets/tako-cloche.png',
    title: <span>Come ridurre i tempi di attesa <span className="grad-text">del 30%</span></span>,
    docTitle: 'Trattoria Pomposa — meno attese del 30%',
    lede: 'Alla Trattoria Pomposa di Modena il sabato sera era una battaglia. Poi hanno smesso di correre in cucina con i foglietti in mano.',
    venue: 'Trattoria Pomposa', kind: 'Trattoria', city: 'Modena', detail: '48 coperti',
    author: 'Sara Montanari', date: '14 marzo 2026',
    blocks: [
      { p: 'Lucia Ferraresi gestisce la Trattoria Pomposa da diciannove anni, nel cuore del centro di Modena. Quarantotto coperti, una cucina che fa tortellini a mano e un sabato sera che, fino allo scorso autunno, somigliava più a un\'emergenza che a un servizio.' },
      { p: '«Avevamo due camerieri bravissimi, ma passavano metà del tempo a fare avanti e indietro dalla cucina», racconta. «Comanda presa al tavolo, corsa al pass, dettata allo chef, poi ti accorgevi che mancava una modifica e ricominciavi. Nei picchi qualche ordine si perdeva proprio.»' },
      { h: 'Il collo di bottiglia non era la cucina' },
      { p: 'Quando Lucia ha installato Tako, la prima sorpresa è arrivata dai dati. La cucina reggeva: il tempo morto era tutto nel tragitto tra il tavolo e il pass. Tra il momento in cui il cliente decideva e quello in cui lo chef leggeva l\'ordine passavano in media nove minuti. Nei picchi, anche quindici.' },
      { p: 'La soluzione è stata togliere quel tragitto. Con i QR ai tavoli, i clienti che volevano potevano ordinare da soli; per gli altri, i camerieri prendevano la comanda sul telefono e finiva dritta sul monitor in cucina. Niente più foglietti, niente più viaggi.' },
      { h: 'Una settimana per cambiare abitudini' },
      { p: 'Il vero ostacolo non è stato tecnico, ammette Lucia. «Marco, il mio cameriere storico, era convinto che il telefono lo avrebbe rallentato. I primi due giorni brontolava. Il terzo mi ha detto: "non mi togliere più il telefono".»' },
      { p: 'L\'onboarding è durato una settimana. Menu importato da un vecchio PDF in mezz\'ora, QR stampati e plastificati internamente, una sera di prova a sala mezza piena per prendere la mano. Dal venerdì successivo, servizio pieno con il nuovo flusso.' },
      { quote: 'Il sabato non urlo più "chi ha preso il tavolo sette?". Lo vedo sullo schermo. Sembra una sciocchezza, ma è la sciocchezza che mi ha ridato le serate.', by: 'Lucia Ferraresi, Trattoria Pomposa' },
      { h: 'I numeri dopo due mesi' },
      { p: 'Dopo otto settimane, il tempo medio tra ordine e cucina è sceso da nove minuti a poco più di due. L\'attesa percepita dai clienti — quella che finisce nelle recensioni — è calata di quasi un terzo. E con tavoli che girano più in fretta, il sabato la trattoria riesce a servire un turno e mezzo in più senza aggiungere personale.' },
      { p: 'Non tutto è merito della tecnologia, precisa Lucia. «Il sugo è ancora il mio. Ma adesso ho la testa libera per controllarlo, invece di rincorrere le comande.»' },
    ],
    results: [
      { n: '−31%', l: 'tempo di attesa' },
      { n: '9→2 min', l: 'ordine → cucina' },
      { n: '+1,5', l: 'turni il sabato' },
      { n: '0', l: 'comande perse' },
    ],
  },
  {
    slug: 'blog-menu-engineering',
    tag: 'Menu', color: '#E8F4ED', read: '7 min', mascot: 'assets/tako-pasta.png',
    title: <span>Menu engineering: <span className="grad-text">i 4 quadranti</span></span>,
    docTitle: 'Osteria del Pontile (Rimini) — menu engineering sui dati',
    lede: 'Al ristorante Osteria del Pontile di Rimini il menu aveva 64 piatti. Dopo tre mesi di dati con Tako ne sono rimasti 41 — e il margine è salito.',
    venue: 'Osteria del Pontile', kind: 'Ristorante di pesce', city: 'Rimini', detail: '90 coperti, stagionale',
    author: 'Luca Bonetti', date: '2 febbraio 2026',
    blocks: [
      { p: 'Andrea Pruccoli ha un problema che molti ristoratori conoscono bene: un menu troppo lungo. «Ogni piatto che toglievo era un piccolo lutto. Quello lo faceva mia madre, quell\'altro piaceva a un cliente affezionato. Risultato: 64 voci, una cucina in affanno e nessuna idea di cosa rendesse davvero.»' },
      { p: 'Osteria del Pontile è un ristorante di pesce sul lungomare di Rimini, fortissimo in estate e più lento d\'inverno. Esattamente il tipo di locale dove un menu gonfio costa caro: scorte ferme, sprechi, tempi di preparazione che si allungano.' },
      { h: 'La mappa: volume contro margine' },
      { p: 'Il menu engineering è una vecchia idea della ristorazione, ma serve un dato per applicarla: quanto vende ogni piatto e quanto margine lascia. Tako li mette insieme in automatico, perché conosce sia gli incassi sia i costi che Andrea ha caricato per ogni ricetta. Ne esce una griglia a quattro quadranti.' },
      { list: [
        'Star — vendono tanto e marginano bene. Vanno protetti e messi in evidenza.',
        'Puzzle — buon margine ma pochi ordini. Si possono spingere con la descrizione o la posizione nel menu.',
        'Plowhorse — vendono tantissimo ma marginano poco. Da ottimizzare nel costo o nel prezzo.',
        'Dog — pochi ordini e poco margine. Candidati a uscire dal menu.',
      ] },
      { h: 'Le sorprese nei dati' },
      { p: 'La prima sorpresa è stata il risotto alla pescatora: amatissimo, in cima alle vendite, ma con un food cost altissimo per via dei crostacei. Un classico plowhorse. Andrea non l\'ha tolto — sarebbe stato un suicidio — ma ha rivisto la porzione e il prezzo, allineandolo al mercato. Tre euro in più che nessuno ha notato e che hanno raddrizzato il margine.' },
      { p: 'La seconda sorpresa erano i "dog": nove piatti che insieme facevano meno del 4% degli ordini ma occupavano spazio, scorte e attenzione. Tra questi, due antipasti che Andrea era convinto fossero popolari. I numeri dicevano il contrario.' },
      { quote: 'Per anni ho deciso il menu a sensazione. Avevo torto su almeno dieci piatti. Vedere i dati è stato umiliante e liberatorio insieme.', by: 'Andrea Pruccoli, Osteria del Pontile' },
      { h: 'Da 64 a 41 piatti' },
      { p: 'In tre mesi il menu è passato da 64 a 41 voci. La cucina prepara meno mise en place, gli sprechi sono calati, e i piatti "puzzle" ad alto margine — spostati in alto nella pagina e riscritti con descrizioni più appetitose — hanno iniziato a vendere. Il margine medio per coperto è cresciuto del 12% senza alzare lo scontrino in modo aggressivo.' },
      { p: 'Il menu più corto, dice Andrea, ha avuto anche un effetto inatteso: «I clienti scelgono prima. E un tavolo che ordina prima è un tavolo più sereno.»' },
    ],
    results: [
      { n: '64→41', l: 'piatti a menu' },
      { n: '+12%', l: 'margine per coperto' },
      { n: '−18%', l: 'sprechi in cucina' },
      { n: '9', l: '"dog" eliminati' },
    ],
  },
  {
    slug: 'blog-ai-sala',
    tag: 'AI', color: '#F3ECFB', read: '4 min', mascot: 'assets/tako-tablet.png',
    title: <span>L'AI in sala: <span className="grad-text">aiuto o moda?</span></span>,
    docTitle: 'Pizzeria Da Gennaro (Napoli) — l\'AI alla prova',
    lede: 'Gennaro Esposito era il più scettico di tutti. Poi l\'assistente di Tako ha iniziato a rispondere alle domande sugli allergeni meglio del suo staff.',
    venue: 'Pizzeria Da Gennaro', kind: 'Pizzeria', city: 'Napoli', detail: '120 coperti, alto volume',
    author: 'Chiara De Santis', date: '21 gennaio 2026',
    blocks: [
      { p: '«AI in pizzeria? A me serve il forno, non il robot.» Gennaro Esposito lo dice ridendo, oggi. Ma quando il figlio Salvatore ha proposto di attivare l\'assistente di Tako, la discussione in famiglia è stata accesa.' },
      { p: 'Da Gennaro è una pizzeria napoletana ad alto volume: 120 coperti, sale piene, turni veloci. Il tipo di posto dove un cameriere non ha trenta secondi per spiegare se la pizza ai frutti di mare contiene tracce di glutine nella farina dell\'impasto.' },
      { h: 'Il problema vero: le domande ripetute' },
      { p: 'Il punto non era sostituire nessuno. Era gestire le centinaia di micro-domande che inondano la sala ogni sera: «questa è piccante?», «c\'è qualcosa senza lattosio?», «la bufala è del giorno?». Domande legittime, ma che bloccano un cameriere proprio nei minuti di picco.' },
      { p: 'L\'assistente di Tako vive dentro il menu digitale. Conosce ingredienti, allergeni e disponibilità perché legge gli stessi dati che la cucina aggiorna. Quando un cliente chiede, risponde in chat in pochi secondi, con il tono che Gennaro ha impostato: sbrigativo ma gentile, napoletano quanto basta.' },
      { h: 'La prova del nove sugli allergeni' },
      { p: 'A convincere Gennaro è stata proprio la cosa che temeva. Una cliente celiaca ha chiesto in chat dettagli sulla contaminazione. L\'assistente ha spiegato con precisione quali pizze erano preparate con impasto dedicato e quali no, suggerendo le opzioni sicure. «Una risposta che il mio cameriere, di corsa, non avrebbe dato così bene», ammette.' },
      { quote: 'Non mi ha tolto lavoro. Mi ha tolto le domande che mi facevano perdere il filo. Adesso lo staff sta tra i tavoli, non fermo a spiegare gli ingredienti.', by: 'Gennaro Esposito, Pizzeria Da Gennaro' },
      { h: 'Aiuto, non moda' },
      { p: 'Dopo due mesi, circa il 40% delle domande dei clienti viene gestito interamente in chat, senza coinvolgere il personale. Gli errori sugli ordini speciali — la pizza senza un ingrediente, la modifica dimenticata — sono crollati, perché la richiesta arriva scritta e chiara in cucina.' },
      { p: 'Resta una regola, in casa Esposito: l\'AI risponde alle domande, le persone fanno le pizze. «La tecnologia che funziona è quella che non si vede», dice Gennaro. «La mia si vede solo se la cerchi. Il resto è ancora tutto nelle mani.»' },
    ],
    results: [
      { n: '40%', l: 'domande gestite in chat' },
      { n: '−27%', l: 'errori sugli ordini' },
      { n: '24/7', l: 'risposte sugli allergeni' },
      { n: '~0', l: 'attese per informazioni' },
    ],
  },
  {
    slug: 'blog-da-nino',
    tag: 'Storie', color: '#EAF2F8', read: '6 min', mascot: 'assets/tako-thumbsup.png',
    title: <span>Trattoria da Nino: <span className="grad-text">+18% di scontrino</span></span>,
    docTitle: 'Trattoria da Nino (Bologna) — +18% di scontrino',
    lede: 'Un\'osteria di quartiere a Bologna, due tovaglie a quadri e zero esperienza tecnologica. In una settimana hanno digitalizzato il servizio. In tre mesi lo scontrino medio è salito del 18%.',
    venue: 'Trattoria da Nino', kind: 'Osteria', city: 'Bologna', detail: '36 coperti, a conduzione familiare',
    author: 'Sara Montanari', date: '8 dicembre 2025',
    blocks: [
      { p: 'Da Nino è esattamente come te lo immagini: trentasei coperti, tovaglie a quadri, tagliatelle tirate al mattino e Nino Cavallari che gira tra i tavoli da trent\'anni. L\'ultima cosa che avresti associato a questo posto è la parola "software".' },
      { p: 'A spingere per il cambiamento è stata Sara, la figlia, che da due anni dà una mano in sala. «Papà segnava le comande su un blocchetto e i vini li consigliava a memoria. Funzionava, ma dipendeva tutto da lui. Se Nino aveva una serata storta, la serata storta ce l\'avevamo tutti.»' },
      { h: 'Una settimana, non un trimestre' },
      { p: 'La paura più grande era il tempo. Chi gestisce un\'osteria non ha settimane da dedicare a un gestionale. L\'importazione del menu è partita da una foto del cartaceo: l\'AI lo ha trasformato in piatti, categorie e prezzi, e Sara ha solo rifinito qualche descrizione. I QR per i dodici tavoli erano pronti il giorno dopo.' },
      { p: 'Nino, va detto, non ha toccato un telefono. Continua a girare tra i tavoli come sempre. Ma adesso quando consiglia un Sangiovese, il cliente lo trova già nel menu digitale con due righe di descrizione — e spesso lo aggiunge senza nemmeno chiamare il cameriere.' },
      { h: 'Il segreto era nei suggerimenti' },
      { p: 'L\'aumento dello scontrino non è arrivato alzando i prezzi. È arrivato dai suggerimenti automatici: quando un cliente ordinava le tagliatelle al ragù, il menu proponeva il calice di Sangiovese in abbinamento; dopo il secondo, il carrello dei dolci fatti in casa appariva con una foto che, dice Sara, «vende da sola».' },
      { quote: 'Mio padre consigliava i vini a chi aveva davanti. Adesso il suo modo di consigliare ce l\'hanno tutti i tavoli, anche quando lui è in cucina. È come averlo clonato, ma gentile.', by: 'Sara Cavallari, Trattoria da Nino' },
      { h: 'I numeri di una piccola osteria' },
      { p: 'In tre mesi lo scontrino medio è cresciuto del 18%, trainato soprattutto da vini al calice e dolci — le due voci che prima si "dimenticavano" più spesso. Gli ordini arrivano scritti in cucina, quindi gli errori sono spariti, e Sara ha smesso di rifare i conti a mano a fine serata.' },
      { p: 'La cosa di cui Nino va più fiero, però, non è un numero. «Una signora mi ha detto che si è trovata bene come a casa di sua nonna, ma senza aspettare. Ecco, quello lì. Quello è il lavoro fatto bene.»' },
    ],
    results: [
      { n: '+18%', l: 'scontrino medio' },
      { n: '7 giorni', l: 'per partire' },
      { n: '+34%', l: 'vini al calice' },
      { n: '+22%', l: 'dolci venduti' },
    ],
  },
  {
    slug: 'blog-recensioni',
    tag: 'Marketing', color: '#FFF4E0', read: '5 min', mascot: 'assets/tako-bell.png',
    title: <span>Recensioni: trasformare <span className="grad-text">i clienti in fan</span></span>,
    docTitle: 'Caffè Sant\'Oronzo (Lecce) — da 4,1 a 4,7 stelle',
    lede: 'Il Caffè Sant\'Oronzo di Lecce faceva 300 caffè al giorno e quasi nessuna recensione. Cambiando il momento in cui le chiedeva, è passato da 4,1 a 4,7 stelle in un\'estate.',
    venue: 'Caffè Sant\'Oronzo', kind: 'Bar / caffetteria', city: 'Lecce', detail: '300+ scontrini al giorno',
    author: 'Luca Bonetti', date: '17 settembre 2025',
    blocks: [
      { p: 'Marta Greco ha rilevato il Caffè Sant\'Oronzo, in piazza a Lecce, tre anni fa. Caffè ottimo, pasticciotti fatti in casa, una clientela fedele di habitué. Eppure online il bar quasi non esisteva: 41 recensioni in totale, media 4,1. «Per il giro che facevamo, era ridicolo», dice.' },
      { p: 'Il problema delle recensioni in un bar è il tempo. Un cliente sta dieci minuti, beve, paga, esce. Non c\'è il momento "fine cena" in cui chiedere con calma un parere. E chiederlo a voce, di corsa, suona quasi sempre forzato.' },
      { h: 'Il momento giusto è subito dopo il pagamento' },
      { p: 'Con Tako, Marta ha automatizzato una richiesta semplice: appena il cliente paga dal telefono — o scansiona lo scontrino digitale — appare un messaggio breve e gentile. Se l\'esperienza è stata buona, un tocco porta direttamente alla pagina recensioni. Niente moduli, niente attese.' },
      { p: 'La differenza, spiega, è tutta nel tempismo. «Il cliente è ancora lì, ha appena bevuto il caffè migliore della sua giornata. È in quel momento che ha voglia di dire grazie, non tre ore dopo via email.»' },
      { h: 'Filtrare prima di pubblicare' },
      { p: 'C\'è un dettaglio che Marta apprezza più di tutti: la richiesta chiede prima com\'è andata. Chi è entusiasta viene invitato a lasciare la recensione pubblica; chi ha avuto un problema viene indirizzato a un messaggio privato. Così i guai si risolvono in chat, prima di diventare una stella in meno in piazza.' },
      { quote: 'Prima le recensioni le lasciavano solo gli arrabbiati. Adesso le lasciano anche i contenti. Sembra ovvio, ma ha cambiato completamente la nostra faccia online.', by: 'Marta Greco, Caffè Sant\'Oronzo' },
      { h: 'Da 41 a oltre 400 recensioni' },
      { p: 'In una sola estate il Caffè Sant\'Oronzo è passato da 41 a più di 400 recensioni, con una media salita a 4,7. Marta giura che il riflesso si è visto anche in cassa: turisti che, cercando "colazione Lecce", ora trovano il bar in cima e si presentano col telefono già aperto sulla foto del pasticciotto.' },
      { p: 'Il bello, conclude, è che non ha cambiato nulla nel servizio. «Facevamo già un buon lavoro. Semplicemente, adesso si vede.»' },
    ],
    results: [
      { n: '4,1→4,7', l: 'stelle medie' },
      { n: '×10', l: 'recensioni in un\'estate' },
      { n: '6×', l: 'tasso di risposta' },
      { n: '−70%', l: 'lamentele pubbliche' },
    ],
  },
  {
    slug: 'blog-turni-picchi',
    tag: 'Operations', color: '#FFE9E0', read: '6 min', mascot: 'assets/tako-bowtie.png',
    title: <span>Turni e picchi: <span className="grad-text">leggere i dati giusti</span></span>,
    docTitle: 'Osteria Vico Palla (Genova) — turni sui dati reali',
    lede: 'Al ristorante Osteria Vico Palla di Genova i turni si facevano "a sentimento". Guardando i dati veri dei picchi, hanno tagliato il costo del personale senza mai restare scoperti.',
    venue: 'Osteria Vico Palla', kind: 'Ristorante', city: 'Genova', detail: '70 coperti, 7 giorni su 7',
    author: 'Chiara De Santis', date: '4 novembre 2025',
    blocks: [
      { p: 'Davide Parodi ha un\'ossessione sana per i conti. Eppure, fino a un anno fa, la voce di costo più grande del suo Osteria Vico Palla — il personale — la pianificava nel modo meno scientifico possibile: a memoria. «Il venerdì metto più gente, la domenica a pranzo pure. Ma "più gente" quanta? Non lo sapevo davvero.»' },
      { p: 'Il Osteria Vico Palla è un ristorante sul porto di Genova, aperto sette giorni su sette. Con margini stretti come quelli della ristorazione, sbagliare i turni di due persone per servizio, ripetuto ogni settimana, diventa una cifra seria a fine anno.' },
      { h: 'I picchi non erano dove pensava' },
      { p: 'La prima cosa che Davide ha fatto con Tako è stata guardare la distribuzione reale degli ordini per fascia oraria, giorno per giorno, su tre mesi. Due convinzioni sono crollate subito.' },
      { list: [
        'Il giovedì sera, considerato "morto", aveva in realtà un picco costante alle 21: troppo personale prima, troppo poco dopo.',
        'La domenica a pranzo finiva molto prima del previsto: dalle 14:30 la sala era vuota, ma il turno restava coperto fino alle 16.',
        'Il sabato il vero stress non era la cena, ma l\'aperitivo tra le 18:30 e le 20, scoperto da personale.',
      ] },
      { h: 'Aggiustare, non tagliare' },
      { p: 'Davide non ha licenziato nessuno. Ha solo spostato le ore dove servivano davvero: anticipato qualcuno il sabato per coprire l\'aperitivo, accorciato il turno della domenica pomeriggio, rinforzato il giovedì tardi. Le stesse persone, le stesse buste paga, distribuite sui momenti reali.' },
      { quote: 'Pensavo di conoscere il mio ristorante a memoria. I dati mi hanno mostrato tre buchi che pagavo da anni senza accorgermene.', by: 'Davide Parodi, Osteria Vico Palla' },
      { h: 'Meno costi, meno stress' },
      { p: 'Nel giro di un trimestre il costo del personale in rapporto agli incassi è sceso di quasi quattro punti, restando sempre coperti nei momenti di pressione — anzi, con meno serate "in apnea" per lo staff. Perché un turno organizzato sui picchi veri non è solo più economico: è anche meno stressante per chi ci lavora.' },
      { p: 'Adesso Davide la riunione dei turni la fa in dieci minuti, con il grafico aperto. «Non discuto più con i ragazzi su "secondo me". Guardiamo la stessa curva e decidiamo insieme. È tutta un\'altra aria.»' },
    ],
    results: [
      { n: '−3,8 pt', l: 'costo personale / incassi' },
      { n: '3', l: 'fasce riorganizzate' },
      { n: '+100%', l: 'copertura negli aperitivi' },
      { n: '10 min', l: 'per pianificare i turni' },
    ],
  },
];

TAKO_ARTICLES.forEach((a) => {
  TAKO_PAGES[a.slug] = { title: a.docTitle, render: () => <Article {...a} /> };
});

window.TAKO_ARTICLES = TAKO_ARTICLES;
