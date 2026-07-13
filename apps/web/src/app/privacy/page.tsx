import type { Metadata } from 'next'

// Informativa privacy pubblica (/privacy). Pagina statica in italiano: la raggiungono
// dai form che raccolgono nome+telefono (prenotazioni). Il titolare è un segnaposto che
// ogni ristorante compila con la propria ragione sociale prima della messa online.
export const metadata: Metadata = {
  title: 'Informativa privacy · Tako',
  description: 'Come trattiamo i tuoi dati per prenotazioni e ordini',
}

// Ultimo aggiornamento del testo dell'informativa.
const AGGIORNATO = '13 luglio 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[16px] font-bold text-[var(--ink,#2a1f1a)]">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-[14.5px] leading-relaxed text-[var(--ink-2,#666)]">
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 py-10">
      <h1 className="text-2xl font-extrabold text-[var(--ink,#2a1f1a)]">Informativa sulla privacy</h1>
      <p className="mt-1.5 text-[13px] text-[var(--ink-3,#999)]">Ultimo aggiornamento: {AGGIORNATO}</p>

      <p className="mt-5 text-[14.5px] leading-relaxed text-[var(--ink-2,#666)]">
        Questa informativa spiega quali dati personali raccogliamo quando usi questo servizio per
        prenotare un tavolo o ordinare, perché li trattiamo e quali diritti hai, ai sensi del
        Regolamento UE 2016/679 (GDPR).
      </p>

      <Section title="Titolare del trattamento">
        <p>
          Il titolare del trattamento è <strong className="font-semibold text-[var(--ink,#2a1f1a)]">[RAGIONE SOCIALE / NOME]</strong>,
          ossia il ristorante che gestisce questo locale. Per esercitare i tuoi diritti o per qualsiasi
          domanda sui tuoi dati puoi contattare direttamente il ristorante.
        </p>
      </Section>

      <Section title="Dati che trattiamo">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li><strong className="font-semibold text-[var(--ink,#2a1f1a)]">Nome e numero di telefono</strong>, quando li fornisci per una prenotazione o un ordine da asporto.</li>
          <li><strong className="font-semibold text-[var(--ink,#2a1f1a)]">Contenuto dell&apos;ordine</strong>: piatti scelti, quantità ed eventuali note per la cucina (es. allergie, preferenze).</li>
          <li><strong className="font-semibold text-[var(--ink,#2a1f1a)]">Cookie tecnico di sessione</strong>: un identificativo del tavolo o della sessione d&apos;ordine, necessario al funzionamento del servizio. Non usiamo cookie di profilazione o pubblicitari.</li>
        </ul>
      </Section>

      <Section title="Finalità del trattamento">
        <p>Trattiamo i tuoi dati esclusivamente per:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>gestire e confermare la tua prenotazione o il tuo ordine;</li>
          <li>contattarti, se necessario, in merito alla prenotazione o all&apos;ordine;</li>
          <li>far funzionare tecnicamente il servizio (sessione del tavolo).</li>
        </ul>
        <p>
          La base giuridica è l&apos;esecuzione di misure precontrattuali e del servizio richiesto
          (art. 6.1.b GDPR) e il legittimo interesse a far funzionare il servizio (art. 6.1.f GDPR).
        </p>
      </Section>

      <Section title="Dove sono conservati i dati">
        <p>
          I dati sono conservati <strong className="font-semibold text-[var(--ink,#2a1f1a)]">localmente sul sistema informatico del ristorante</strong>,
          non su server centralizzati di terze parti. Vengono conservati per il tempo necessario a gestire
          la prenotazione o l&apos;ordine e adempiere agli obblighi di legge, poi cancellati o resi anonimi.
        </p>
      </Section>

      <Section title="Fornitori esterni (quando abilitati)">
        <p>
          Alcune funzioni opzionali, se attivate dal ristorante, comportano l&apos;invio di alcuni dati a
          fornitori esterni che agiscono come responsabili del trattamento:
        </p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li><strong className="font-semibold text-[var(--ink,#2a1f1a)]">Groq</strong> — per l&apos;assistente conversazionale: il testo che scrivi in chat viene elaborato per generare le risposte.</li>
          <li><strong className="font-semibold text-[var(--ink,#2a1f1a)]">Google Gemini</strong> — per la generazione delle foto dei piatti del menù.</li>
        </ul>
        <p>
          Questi servizi ricevono solo i dati strettamente necessari alla funzione. Non vendiamo i tuoi
          dati a nessuno.
        </p>
      </Section>

      <Section title="I tuoi diritti">
        <p>In qualsiasi momento hai diritto di:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>accedere ai tuoi dati e ottenerne una copia;</li>
          <li>chiederne la rettifica o la cancellazione;</li>
          <li>chiedere la limitazione o opporti al trattamento;</li>
          <li>revocare un eventuale consenso;</li>
          <li>proporre reclamo all&apos;autorità di controllo (in Italia, il Garante per la protezione dei dati personali).</li>
        </ul>
        <p>Per esercitare questi diritti contatta il ristorante titolare indicato sopra.</p>
      </Section>

      <p className="mt-9 text-[12.5px] leading-relaxed text-[var(--ink-3,#999)]">
        Servizio fornito tramite Tako. Il ristorante è l&apos;unico titolare dei dati trattati.
      </p>
    </div>
  )
}
