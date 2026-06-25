/* global React, TAKO_PAGES, PageHero, Band, SectionHead, CardGrid, ChipRow, FAQList, Timeline, StatRow, CtaBand, pageUrl, TRIAL_URL */
/* tako-pages-prodotto.jsx — Funzioni · Tako AI · Integrazioni · Roadmap */

TAKO_PAGES['funzioni'] = {
  title: 'Funzioni',
  render: () => (
    <>
      <PageHero
        kicker="Prodotto · Funzioni"
        title={<span>Otto tentacoli,<br /><span className="grad-text">mille superpoteri.</span></span>}
        sub="Ordini, menu, AI e dashboard: tutto ciò che serve al tuo ristorante, in un solo posto. Niente più quattro abbonamenti diversi."
        mascot="assets/tako-cloche.png"
      />
      <Band tint="cream">
        <SectionHead chip="Le basi" title={<span>Quello che fa <span className="grad-text">ogni giorno.</span></span>} />
        <CardGrid items={[
          { icon: '📲', title: 'Ordini al tavolo', desc: 'QR sul tavolo, ordine diretto in cucina. Zero attese, zero errori di trascrizione.', color: '#FFEEE8' },
          { icon: '📖', title: 'Menu digitale', desc: 'Foto, allergeni, ingredienti e traduzioni in 12 lingue. Aggiorni in due tocchi.', color: '#E8F4ED' },
          { icon: '🔔', title: 'Chiamata cameriere', desc: 'Il cliente chiama o chiede il conto dal telefono. Tu lo vedi subito in sala.', color: '#FFF4E0' },
          { icon: '💳', title: 'Conto & pagamenti', desc: 'Conto diviso, mancia e pagamento dal tavolo. Il tavolo si libera prima.', color: '#EAF2F8' },
          { icon: '📊', title: 'Dashboard live', desc: 'Sala, ordini e incassi in tempo reale, su iPad, telefono o cassa.', color: '#F3ECFB' },
          { icon: '🤖', title: 'Tako AI', desc: "L'assistente che risponde ai clienti su piatti, abbinamenti e intolleranze.", color: '#FFE9E0' },
        ]} />
      </Band>
      <Band tint="tint">
        <SectionHead chip="In profondità" title={<span>Pensato per <span className="grad-text">come lavori.</span></span>} />
        <CardGrid cols={2} items={[
          { icon: '🍽️', title: 'Mappa della sala', desc: 'Disponi i tavoli come nel tuo locale. Stato libero / occupato / in attesa a colpo d’occhio.', color: '#FFEEE8' },
          { icon: '⏱️', title: 'Tempi di cucina', desc: 'Ogni portata smistata alla stazione giusta, con i tempi sotto controllo.', color: '#E8F4ED' },
          { icon: '🌍', title: 'Multilingua reale', desc: 'Il cliente ordina nella sua lingua, tu ricevi la comanda sempre in italiano.', color: '#EAF2F8' },
          { icon: '📈', title: 'Report & insight', desc: 'Piatti più venduti, orari di punta, scontrino medio. Decidi sui dati, non a sensazione.', color: '#FFF4E0' },
        ]} />
      </Band>
      <BookingBand />
    </>
  ),
};

TAKO_PAGES['ai'] = {
  title: 'Tako AI',
  render: () => (
    <>
      <PageHero kicker="Prodotto · Intelligenza" title={<span>Un cameriere AI<br /><span className="grad-text">sempre in turno.</span></span>} sub="Tako AI conosce ogni piatto del tuo menu e risponde ai clienti 24/7 — su allergeni, abbinamenti e consigli. Tu approvi, l’AI fa il resto." mascot="assets/tako-assistant.png" />
      <Band tint="cream">
        <SectionHead chip="Cosa sa fare" title={<span>Risponde, consiglia, <span className="grad-text">vende.</span></span>} />
        <CardGrid items={[
          { icon: '🧠', title: 'Conosce il menu', desc: 'Ingredienti, allergeni, provenienza: l’AI legge il tuo menu e risponde con precisione.', color: '#FFEEE8' },
          { icon: '🍷', title: 'Abbina i vini', desc: 'Suggerisce il calice giusto per ogni piatto e aumenta lo scontrino medio.', color: '#F3ECFB' },
          { icon: '🌱', title: 'Gestisce le diete', desc: 'Vegano, senza glutine, intolleranze: filtra il menu in un attimo per ogni cliente.', color: '#E8F4ED' },
          { icon: '💬', title: 'Parla 12 lingue', desc: 'Ogni cliente chiede nella sua lingua e riceve una risposta naturale e immediata.', color: '#EAF2F8' },
        ]} />
      </Band>
      <Band tint="tint" narrow>
        <SectionHead chip="Sempre tu al comando" title="L’AI suggerisce, tu approvi." sub="Niente automazioni invasive: ogni risposta segue il tono e le regole del tuo locale. La spegni quando vuoi." />
        <div className="flex justify-center"><a href={TRIAL_URL} className="btn-coral px-8 py-4 text-lg">Attiva Tako AI →</a></div>
      </Band>
      <BookingBand title={<>Fai provare l’AI <span className="grad-text">ai tuoi clienti.</span></>} mascot="assets/tako-assistant.png" />
    </>
  ),
};

TAKO_PAGES['integrazioni'] = {
  title: 'Integrazioni',
  render: () => (
    <>
      <PageHero kicker="Prodotto · Integrazioni" title={<span>Tako si parla con <span className="grad-text">i tuoi strumenti.</span></span>} sub="Collega cassa, delivery, pagamenti e contabilità. I dati fluiscono da soli, senza doppie digitazioni." />
      <Band tint="cream">
        <div className="space-y-12">
          {[
            { t: 'Casse & POS', items: ['Cassa in Cloud', 'Scloby', 'TilbyPOS', 'Square', 'SumUp'] },
            { t: 'Delivery', items: ['Deliveroo', 'Glovo', 'Just Eat', 'Uber Eats'] },
            { t: 'Pagamenti', items: ['Stripe', 'Nexi', 'SatisPay', 'PayPal', 'Apple Pay'] },
            { t: 'Contabilità & gestione', items: ['Fatture in Cloud', 'TeamSystem', 'Zucchetti', 'Google Sheets'] },
          ].map((g, i) => (
            <div key={i} className="reveal">
              <h3 className="font-display font-black text-2xl mb-4" style={{ color: 'var(--ink)' }}>{g.t}</h3>
              <ChipRow items={g.items} />
            </div>
          ))}
        </div>
      </Band>
      <Band tint="tint" narrow>
        <SectionHead chip="Sviluppatori" title="Ti serve qualcosa di su misura?" sub="Con le API di Tako colleghi qualsiasi sistema. Webhook in tempo reale per ordini, tavoli e incassi." />
        <div className="flex justify-center gap-4"><a href={pageUrl('api')} className="btn-coral px-8 py-4 text-lg">Vedi le API →</a></div>
      </Band>
      <BookingBand />
    </>
  ),
};

TAKO_PAGES['roadmap'] = {
  title: 'Roadmap',
  render: () => (
    <>
      <PageHero kicker="Prodotto · Roadmap" title={<span>Dove sta <span className="grad-text">nuotando</span> Tako.</span>} sub="Costruiamo in pubblico. Ecco cosa è appena uscito e cosa bolle in pentola." mascot="assets/tako-pasta.png" />
      <Band tint="cream">
        <Timeline items={[
          { done: true, tag: 'Rilasciato', title: 'Conto diviso al tavolo', desc: 'I clienti dividono il conto e pagano ciascuno dal proprio telefono.' },
          { done: true, tag: 'Rilasciato', title: 'Tako AI multilingua', desc: 'Risposte naturali in 12 lingue, con il tono del tuo locale.' },
          { q: 'Q3', tag: 'In arrivo', title: 'Programma fedeltà', desc: 'Punti, premi e ritorni: un programma fedeltà integrato, senza tessere.' },
          { q: 'Q4', tag: 'In arrivo', title: 'Prenotazioni intelligenti', desc: 'Gestione tavoli e prenotazioni con previsione del no-show.' },
          { q: 'Q1', tag: 'Esplorando', title: 'App cucina dedicata', desc: 'Display di cucina (KDS) con smistamento automatico per stazione.' },
        ]} />
      </Band>
      <Band tint="tint" narrow>
        <SectionHead title="Hai un’idea?" sub="Le funzioni migliori nascono dai ristoratori. Scrivici cosa ti semplificherebbe la vita." />
        <div className="flex justify-center"><a href={pageUrl('contatti')} className="btn-ghost px-8 py-4 text-lg">Proponi una funzione</a></div>
      </Band>
      <BookingBand />
    </>
  ),
};
