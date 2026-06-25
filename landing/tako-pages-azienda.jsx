/* global React, TAKO_PAGES, PageHero, Band, SectionHead, CardGrid, StatRow, LegalDoc, ContactForm, CtaBand, pageUrl, TRIAL_URL */
/* tako-pages-azienda.jsx — Chi siamo · Careers · Contatti · Privacy · Termini */

TAKO_PAGES['chi-siamo'] = {
  title: 'Chi siamo',
  render: () => (
    <>
      <PageHero kicker="Azienda · Chi siamo" title={<span>Nati in sala,<br /><span className="grad-text">non in un ufficio.</span></span>} sub="Tako nasce dalla voglia di togliere ai ristoratori il lavoro che non si vede. La tecnologia che sparisce, il servizio che resta." mascot="assets/tako-chef.png" />
      <Band tint="cream" narrow>
        <SectionHead chip="La storia" title="Perché esistiamo" />
        <p className="text-lg leading-relaxed reveal" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
          Tutto è iniziato da un sabato sera ingestibile: comande perse, code alla cassa, clienti che aspettavano il conto. Abbiamo pensato che un ristorante dovesse poter contare su strumenti semplici quanto un menu di carta, ma vivi come una buona brigata. Così è nato Tako — un piccolo polpo che con otto tentacoli tiene insieme ordini, menu, sala e clienti, lasciando a te il mestiere che ami.
        </p>
      </Band>
      <Band tint="tint">
        <SectionHead chip="I nostri valori" title={<span>Tre cose <span className="grad-text">su cui non transigiamo.</span></span>} />
        <CardGrid items={[
          { icon: '🍝', title: 'Il ristorante prima di tutto', desc: 'Costruiamo per chi sta in sala e in cucina, non per chi ama i gadget tecnologici.', color: '#FFEEE8' },
          { icon: '✨', title: 'Semplice è difficile', desc: 'Lavoriamo perché ogni funzione si capisca in un secondo. La complessità la teniamo noi.', color: '#E8F4ED' },
          { icon: '🤝', title: 'Trasparenza', desc: 'Prezzi chiari, roadmap pubblica, nessun vincolo. Ti trattiamo come vorremmo essere trattati.', color: '#EAF2F8' },
        ]} />
      </Band>
      <Band tint="cream">
        <StatRow items={[{ n: '2.400+', l: 'ristoranti' }, { n: '4.2M', l: 'ordini gestiti' }, { n: '38', l: 'città' }, { n: '2023', l: 'fondata' }]} />
      </Band>
      <CtaBand title="Entra nel branco." sub="Unisciti ai ristoratori che hanno già scelto Tako." />
    </>
  ),
};

TAKO_PAGES['careers'] = {
  title: 'Lavora con noi',
  render: () => {
    const roles = [
      { t: 'Product Designer', d: 'Design · Remoto', tag: 'Full-time' },
      { t: 'Frontend Engineer (React)', d: 'Engineering · Remoto', tag: 'Full-time' },
      { t: 'Customer Success (ristorazione)', d: 'Supporto · Remoto', tag: 'Full-time' },
      { t: 'Account Executive', d: 'Sales · Milano', tag: 'Full-time' },
      { t: 'Content & Social', d: 'Marketing · Remoto', tag: 'Part-time' },
    ];
    return (
      <>
        <PageHero kicker="Azienda · Careers" title={<span>Aiutaci a far <span className="grad-text">girare le sale.</span></span>} sub="Team piccolo, impatto grande. Cerchiamo persone curiose che amano i ristoranti tanto quanto noi." mascot="assets/tako-thumbsup.png" />
        <Band tint="cream">
          <SectionHead chip="Come si lavora" title="La nostra cultura" />
          <CardGrid items={[
            { icon: '🌍', title: 'Remote-first', desc: 'Lavora da dove rendi meglio. Ci vediamo di persona ogni trimestre.', color: '#EAF2F8' },
            { icon: '🍽️', title: 'Mangia dove costruisci', desc: 'Budget mensile per provare i ristoranti che usano Tako. Ricerca sul campo.', color: '#FFEEE8' },
            { icon: '📈', title: 'Crescita reale', desc: 'Responsabilità da subito, feedback onesto, percorsi chiari.', color: '#E8F4ED' },
          ]} />
        </Band>
        <Band tint="tint">
          <SectionHead chip="Posizioni aperte" title="Unisciti a noi" />
          <div className="space-y-4 max-w-3xl mx-auto">
            {roles.map((r, i) => (
              <a key={i} href={pageUrl('contatti')} className="chunky p-6 flex items-center justify-between gap-4 hover-rise reveal block" style={{ transitionDelay: `${i * 0.05}s` }}>
                <div>
                  <h3 className="text-xl">{r.t}</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{r.d}</p>
                </div>
                <span className="flex items-center gap-3 flex-none">
                  <span className="chip" style={{ padding: '4px 12px', fontSize: 12 }}>{r.tag}</span>
                  <span className="text-2xl" style={{ color: 'var(--coral)' }}>→</span>
                </span>
              </a>
            ))}
          </div>
          <p className="text-center mt-8 reveal" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Non trovi il tuo ruolo? Scrivici comunque a <b style={{ color: 'var(--coral-deep)' }}>jobs@tako.it</b></p>
        </Band>
      </>
    );
  },
};

TAKO_PAGES['contatti'] = {
  title: 'Contatti',
  render: () => (
    <>
      <PageHero kicker="Azienda · Contatti" title={<span>Parliamone <span className="grad-text">davanti a un caffè.</span></span>} sub="Domande, demo o solo due chiacchiere: siamo qui. Risposta entro un giorno lavorativo." />
      <Band tint="cream">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionHead chip="Scrivici" title="Mandaci un messaggio" />
            <ContactForm />
          </div>
          <div className="space-y-5">
            {[
              { ic: '💬', t: 'Chat & supporto', d: 'In app, 7 giorni su 7 · risposta in pochi minuti' },
              { ic: '✉️', t: 'Email', d: 'ciao@tako.it · supporto@tako.it' },
              { ic: '📞', t: 'Telefono', d: '+39 051 000 0000 · lun–ven 9:00–18:00' },
              { ic: '🌍', t: 'Dove siamo', d: 'Team remote-first in tutta Italia' },
            ].map((c, i) => (
              <div key={i} className="chunky p-6 flex items-start gap-4 reveal-r" style={{ transitionDelay: `${i * 0.05}s` }}>
                <div className="w-12 h-12 rounded-2xl grid place-items-center text-2xl border-2 flex-none" style={{ background: 'var(--coral-tint)', borderColor: 'var(--ink)' }}>{c.ic}</div>
                <div>
                  <h3 className="text-lg">{c.t}</h3>
                  <p className="text-[15px] mt-1" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{c.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Band>
    </>
  ),
};

const LEGAL_INTRO = 'Questo documento è un fac-simile dimostrativo creato per il prototipo Tako e non costituisce un testo legale valido.';

TAKO_PAGES['privacy'] = {
  title: 'Privacy Policy',
  render: () => (
    <>
      <PageHero kicker="Azienda · Legale" title={<span>Privacy <span className="grad-text">Policy</span></span>} sub="I tuoi dati e quelli dei tuoi clienti sono tuoi. Ecco come li trattiamo." />
      <Band tint="cream">
        <LegalDoc updated="Giugno 2026" sections={[
          { h: 'Premessa', p: LEGAL_INTRO + ' Tako Srl tratta i dati personali nel rispetto del Regolamento (UE) 2016/679 (GDPR).' },
          { h: 'Titolare del trattamento', p: 'Il titolare è Tako Srl. Per qualsiasi richiesta sui tuoi dati scrivi a privacy@tako.it.' },
          { h: 'Dati raccolti', p: 'Raccogliamo i dati dell’account (nome, email, ristorante), i dati operativi (ordini, menu, tavoli) e dati tecnici di utilizzo necessari a far funzionare il servizio.' },
          { h: 'Finalità', p: 'Usiamo i dati per erogare il servizio, fornire assistenza, migliorare il prodotto e adempiere agli obblighi di legge. Non vendiamo i tuoi dati a terzi.' },
          { h: 'Conservazione', p: 'Conserviamo i dati per il tempo necessario alle finalità descritte e secondo gli obblighi fiscali. Alla chiusura dell’account puoi richiederne la cancellazione.' },
          { h: 'I tuoi diritti', p: 'Hai diritto di accesso, rettifica, cancellazione, limitazione e portabilità dei dati. Puoi esercitarli in qualsiasi momento contattandoci.' },
        ]} />
      </Band>
    </>
  ),
};

TAKO_PAGES['termini'] = {
  title: 'Termini di servizio',
  render: () => (
    <>
      <PageHero kicker="Azienda · Legale" title={<span>Termini di <span className="grad-text">servizio</span></span>} sub="Le regole, in italiano semplice, per usare Tako serenamente." />
      <Band tint="cream">
        <LegalDoc updated="Giugno 2026" sections={[
          { h: 'Accettazione', p: LEGAL_INTRO + ' Usando Tako accetti questi termini. Se non sei d’accordo, ti chiediamo di non utilizzare il servizio.' },
          { h: 'Il servizio', p: 'Tako fornisce strumenti software per la gestione di ordini, menu e sala. Ci impegniamo per la massima continuità del servizio ma non garantiamo l’assenza assoluta di interruzioni.' },
          { h: 'Account', p: 'Sei responsabile della riservatezza delle credenziali e delle attività svolte dal tuo account. Avvisaci subito in caso di accesso non autorizzato.' },
          { h: 'Abbonamenti e pagamenti', p: 'I piani sono mensili e si rinnovano automaticamente. Puoi disdire in qualsiasi momento: l’accesso resta attivo fino a fine periodo, senza penali.' },
          { h: 'Uso corretto', p: 'Ti impegni a non usare Tako per attività illecite o a sovraccaricare l’infrastruttura. Possiamo sospendere account che violano queste regole.' },
          { h: 'Limitazione di responsabilità', p: 'Nei limiti di legge, Tako non è responsabile per danni indiretti derivanti dall’uso del servizio. La responsabilità complessiva è limitata a quanto pagato negli ultimi 12 mesi.' },
        ]} />
      </Band>
    </>
  ),
};
