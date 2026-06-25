/* global React, TAKO_PAGES, PageHero, Band, SectionHead, CardGrid, ChipRow, FAQList, StatRow, CtaBand, pageUrl, TRIAL_URL */
/* tako-pages-risorse.jsx — Centro aiuto · Blog · API docs · Community · Stato sistema */

const { useState: rS } = React;

TAKO_PAGES['aiuto'] = {
  title: 'Centro aiuto',
  render: () => (
    <>
      <PageHero kicker="Risorse · Supporto" title={<span>Come possiamo <span className="grad-text">aiutarti?</span></span>} sub="Guide, risposte rapide e un team umano dietro ogni messaggio." mascot="assets/tako-hugplate.png" />
      <Band tint="cream">
        <SectionHead chip="Categorie" title="Sfoglia per argomento" />
        <CardGrid items={[
          { icon: '🚀', title: 'Primi passi', desc: 'Crea l’account, importa il menu, stampa i QR. Online in 10 minuti.', color: '#FFEEE8' },
          { icon: '📖', title: 'Gestire il menu', desc: 'Prezzi, foto, allergeni, esauriti e specialità del giorno.', color: '#E8F4ED' },
          { icon: '📲', title: 'Ordini & sala', desc: 'Ricevere comande, gestire i tavoli e le chiamate cameriere.', color: '#FFF4E0' },
          { icon: '🤖', title: 'Tako AI', desc: 'Attivare l’assistente, impostare il tono e le regole.', color: '#F3ECFB' },
          { icon: '💳', title: 'Pagamenti & conto', desc: 'Conto diviso, mance, ricevute e metodi di pagamento.', color: '#EAF2F8' },
          { icon: '⚙️', title: 'Account & fatturazione', desc: 'Piani, utenti, dati di fatturazione e disdetta.', color: '#FFE9E0' },
        ]} />
      </Band>
      <Band tint="tint">
        <SectionHead chip="Le più lette" title="Risposte rapide" />
        <FAQList items={[
          { q: 'Come importo il mio menu?', a: 'Carica un PDF o un foglio Excel: l’AI lo struttura per te in piatti, prezzi e categorie. Poi rifinisci con un tocco.' },
          { q: 'Come stampo i QR dei tavoli?', a: 'Dalla dashboard generi i QR per ogni tavolo e li scarichi pronti da stampare, già brandizzati.' },
          { q: 'Posso usare Tako su più dispositivi?', a: 'Sì: sala su iPad, comande sul telefono, report sul computer. Tutto sincronizzato in tempo reale.' },
          { q: 'Come disdico l’abbonamento?', a: 'In due clic dalla sezione Fatturazione. Nessuna penale, mantieni l’accesso fino a fine periodo.' },
        ]} />
      </Band>
      <Band tint="cream" narrow>
        <div className="chunky p-8 text-center">
          <h3 className="text-2xl mb-2">Non hai trovato la risposta?</h3>
          <p className="mb-6" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Il nostro team risponde in chat entro pochi minuti, dal lunedì alla domenica.</p>
          <a href={pageUrl('contatti')} className="btn-coral px-8 py-4 text-lg">Contatta il supporto →</a>
        </div>
      </Band>
    </>
  ),
};

TAKO_PAGES['blog'] = {
  title: 'Blog',
  render: () => {
    const posts = [
      { slug: 'blog-attesa', tag: 'Gestione', color: '#FFEEE8', title: 'Come ridurre i tempi di attesa del 30%', desc: 'Tre leve concrete per far girare i tavoli senza stressare la cucina.', read: '5 min' },
      { slug: 'blog-menu-engineering', tag: 'Menu', color: '#E8F4ED', title: 'Menu engineering: i 4 quadranti', desc: 'Quali piatti spingere, quali ripensare. Una mappa semplice e potente.', read: '7 min' },
      { slug: 'blog-ai-sala', tag: 'AI', color: '#F3ECFB', title: 'L’AI in sala: aiuto o moda?', desc: 'Cosa cambia davvero quando un assistente risponde ai tuoi clienti.', read: '4 min' },
      { slug: 'blog-da-nino', tag: 'Storie', color: '#EAF2F8', title: 'Trattoria da Nino: +18% di scontrino', desc: 'Come un’osteria di quartiere ha digitalizzato il servizio in una settimana.', read: '6 min' },
      { slug: 'blog-recensioni', tag: 'Marketing', color: '#FFF4E0', title: 'Recensioni: trasformare i clienti in fan', desc: 'Il momento giusto per chiedere una recensione (e come farlo bene).', read: '5 min' },
      { slug: 'blog-turni-picchi', tag: 'Operations', color: '#FFE9E0', title: 'Turni e picchi: leggere i dati giusti', desc: 'Quali numeri guardare ogni lunedì mattina per organizzare la settimana.', read: '6 min' },
    ];
    return (
      <>
        <PageHero kicker="Risorse · Blog" title={<span>Idee per <span className="grad-text">ristoratori curiosi.</span></span>} sub="Gestione, menu, dati e storie dalla sala. Pratico, niente fuffa." />
        <Band tint="cream">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p, i) => (
              <a key={i} href={pageUrl(p.slug)} className="chunky overflow-hidden hover-rise reveal-pop block" style={{ transitionDelay: `${i * 0.05}s` }}>
                <div className="h-40 grid place-items-center text-5xl" style={{ background: p.color }}>🐙</div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold" style={{ color: 'var(--coral-deep)' }}><span className="chip" style={{ padding: '3px 10px', fontSize: 11 }}>{p.tag}</span><span style={{ color: 'var(--ink-soft)' }}>· {p.read}</span></div>
                  <h3 className="text-xl mb-2 leading-tight">{p.title}</h3>
                  <p className="text-[14px]" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{p.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </Band>
        <CtaBand title="Meno tempo sul gestionale, più in sala." />
      </>
    );
  },
};

TAKO_PAGES['api'] = {
  title: 'API & Documentazione',
  render: () => (
    <>
      <PageHero kicker="Risorse · Sviluppatori" title={<span>Costruisci <span className="grad-text">su Tako.</span></span>} sub="API REST pulite e webhook in tempo reale per ordini, tavoli, menu e incassi. Token in un minuto." />
      <Band tint="cream">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <SectionHead chip="REST API" title="Semplice, prevedibile." sub="Risorse chiare, risposte JSON, paginazione coerente. Se hai usato un’API moderna, ti sentirai a casa." />
            <ul className="space-y-3 max-w-md">
              {['/orders — crea e leggi gli ordini', '/tables — stato della sala in tempo reale', '/menu — piatti, prezzi, disponibilità', '/webhooks — eventi push instantanei'].map((t, i) => (
                <li key={i} className="flex items-center gap-3 font-bold reveal" style={{ transitionDelay: `${i * 0.05}s` }}>
                  <span className="w-7 h-7 grid place-items-center rounded-full text-white" style={{ background: 'var(--coral)' }}>›</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="chunky p-0 overflow-hidden reveal-r">
            <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#2A1F1A' }}>
              <span className="w-3 h-3 rounded-full" style={{ background: '#ED7159' }} /><span className="w-3 h-3 rounded-full" style={{ background: '#F5C065' }} /><span className="w-3 h-3 rounded-full" style={{ background: '#7FC4A8' }} />
              <span className="ml-2 text-xs font-bold" style={{ color: 'rgba(255,255,255,.6)', fontFamily: "'JetBrains Mono', monospace" }}>crea-ordine.sh</span>
            </div>
            <pre className="p-5 text-[13px] leading-relaxed" style={{ background: '#1c1512', color: '#F5E9DF', margin: 0, overflowX: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>{`curl https://api.tako.it/v1/orders \\
  -H "Authorization: Bearer sk_live_…" \\
  -d tavolo=7 \\
  -d '{"piatti":[{"id":"i9","qty":2}]}'

# → { "id": "ord_8x2", "stato":
#     "ricevuto", "tavolo": 7 }`}</pre>
          </div>
        </div>
      </Band>
      <Band tint="tint" narrow>
        <SectionHead title="Pronto a integrare?" sub="Genera una chiave API di test dalla dashboard e leggi la documentazione completa." />
        <div className="flex justify-center gap-4">
          <a href={TRIAL_URL} className="btn-coral px-8 py-4 text-lg">Ottieni una API key</a>
          <a href={pageUrl('aiuto')} className="btn-ghost px-8 py-4 text-lg">Leggi i docs</a>
        </div>
      </Band>
    </>
  ),
};

TAKO_PAGES['community'] = {
  title: 'Community',
  render: () => (
    <>
      <PageHero kicker="Risorse · Community" title={<span>Un branco di <span className="grad-text">ristoratori.</span></span>} sub="Confrontati con chi vive la sala ogni giorno: consigli, template e idee che funzionano davvero." mascot="assets/tako-hello.png" />
      <Band tint="cream">
        <CardGrid items={[
          { icon: '💬', title: 'Forum', desc: 'Domande, risposte e best practice tra ristoratori. Cerca prima, chiedi poi.', color: '#FFEEE8' },
          { icon: '🎧', title: 'Discord', desc: 'Chiacchiere in tempo reale, canali per cucina, sala e marketing.', color: '#F3ECFB' },
          { icon: '📅', title: 'Eventi & webinar', desc: 'Sessioni dal vivo con esperti del settore, una volta al mese.', color: '#E8F4ED' },
          { icon: '🧩', title: 'Template', desc: 'Menu, turni e checklist pronti da copiare, condivisi dalla community.', color: '#EAF2F8' },
        ]} />
      </Band>
      <Band tint="tint" narrow>
        <div className="text-center">
          <StatRow items={[{ n: '2.400+', l: 'ristoratori' }, { n: '38', l: 'città' }, { n: '12', l: 'eventi/anno' }, { n: '4.9★', l: 'soddisfazione' }]} />
          <div className="mt-12"><a href={pageUrl('contatti')} className="btn-coral px-8 py-4 text-lg">Unisciti alla community →</a></div>
        </div>
      </Band>
    </>
  ),
};

TAKO_PAGES['stato'] = {
  title: 'Stato del sistema',
  render: () => {
    const comps = [
      { n: 'App cliente (PWA)', s: 'ok' }, { n: 'Dashboard ristoratore', s: 'ok' },
      { n: 'Tako AI', s: 'ok' }, { n: 'Pagamenti', s: 'ok' },
      { n: 'API & Webhook', s: 'warn' }, { n: 'Notifiche', s: 'ok' },
    ];
    const map = { ok: { c: 'var(--mint)', t: 'Operativo' }, warn: { c: 'var(--sun)', t: 'Prestazioni ridotte' }, down: { c: 'var(--coral)', t: 'Disservizio' } };
    return (
      <>
        <PageHero kicker="Risorse · Stato" title={<span>Tutti i sistemi <span className="grad-text">in mare aperto.</span></span>} sub="Monitoraggio in tempo reale dei servizi Tako. Trasparenza totale, sempre." />
        <Band tint="cream" narrow>
          <div className="chunky p-5 mb-6 flex items-center gap-4 reveal" style={{ background: 'var(--coral-tint)' }}>
            <span className="w-4 h-4 rounded-full" style={{ background: 'var(--mint)', boxShadow: '0 0 0 5px rgba(127,196,168,.3)' }} />
            <span className="font-display font-black text-lg">Operatività generale · 99.98% negli ultimi 90 giorni</span>
          </div>
          <div className="chunky overflow-hidden">
            {comps.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4" style={{ borderTop: i ? '2px dashed rgba(42,31,26,.12)' : 'none' }}>
                <span className="font-bold">{c.n}</span>
                <span className="flex items-center gap-2 text-sm font-bold" style={{ color: map[c.s].c }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: map[c.s].c }} />{map[c.s].t}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm mt-6" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Aggiornato pochi secondi fa · fuso orario Europe/Rome</p>
        </Band>
      </>
    );
  },
};
