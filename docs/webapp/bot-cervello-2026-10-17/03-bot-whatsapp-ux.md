# Takomenu — bot WhatsApp: UX, regole, qualità, privacy (ricerca 17/10/2026)

Metodo: 10 ricerche web. Molte fonti sono blog/vendor: per ogni dato è indicato il grado di affidabilità. Dove non ho trovato una fonte ufficiale lo dico, e va verificato prima di fidarsi.

## 0. Cosa NON ho trovato (onestà)
- Nessun case study indipendente di titolari di ristoranti che modificano il menu via WhatsApp/vocale, né tassi di adozione. Le pagine trovate (es. achiya-automation.com, hyperleap.ai) sono marketing di bot **lato cliente** (prenotazioni, menu), con numeri non sorgentati. Nulla su Sidekick/Square/Toast/TheFork/Glovo via web search.
- Prezzo ufficiale Italia 2026 non verificato (vedi §2). Limiti media Twilio/Meta non verificati su fonte ufficiale.
- Conclusione: il bot Takomenu è un caso poco documentato. Le raccomandazioni sotto sono principi consolidati + vostra telemetria, non benchmark di settore.

## 1. Design conversazionale per bot che modificano dati
Fonti (pratica, non standard): [Conversational Error Recovery Patterns](https://geosurge.ai/corpus/gen-3027/natural-language-user-interface/conversational-error-recovery-patterns-for-natural-language-user-interfaces.html), [Human-in-the-loop: when agents should stop and ask](https://dev.to/gantz/human-in-the-loop-when-ai-agents-should-stop-and-ask-30gc), [When the agent asks forgiveness instead of permission](https://tianpan.co/blog/2026/05/23/when-the-agent-asks-forgiveness-instead-of-permission) (23/05/2026).

Principi ricorrenti:
1. **Conferma proporzionale alla reversibilità.** Le azioni reversibili passano senza chiedere; si chiede solo su ciò che è difficile da annullare o ha impatto largo. Troppe conferme addestrano l'utente a dire «sì» senza leggere.
2. **Impegno progressivo:** raccogli info liberamente, mostra anteprima dell'effetto reale, chiedi conferma solo al confine finale. Una conferma deve mostrare l'effetto concreto («Carbonara 12,00 → 13,50»), non «Confermi?».
3. **Undo dichiarato onestamente:** registra per ogni azione se è annullabile; dì all'utente cosa si può ancora annullare. Chi tratta l'undo come ripiego finisce a scusarsi dopo azioni irreversibili.
4. **Default sicuro:** nelle domande di conferma l'opzione ovvia/sicura è quella di non-modifica; il silenzio non deve mai eseguire un'azione distruttiva.
5. **Modelli che «agiscono prima»:** il bias verso l'azione va contenuto nel livello tool + eval + system prompt, non lasciato al modello. Per un nuovo tipo di azione, prima volta = calibrazione (conferma sempre).

**Raccomandazioni Takomenu (regola «agisci / chiedi»):**
| Caso | Comportamento |
|---|---|
| Modifica singola, inequivocabile, reversibile (prezzo, esaurito/disponibile, rinomina) | Esegui subito + riepilogo di 1 riga con valore vecchio→nuovo + «Scrivi *annulla* per tornare indietro» |
| Match ambiguo (2+ piatti simili) | Chiedi con scelta numerata (max 3 opzioni, vedi §2), mai indovinare |
| Cancellazione piatto/categoria, modifica di massa (>3 voci), variazione prezzo >30% o prezzo 0/anomalo | Anteprima + «Sì/No» esplicito; non eseguire senza risposta |
| Vocale trascritto con bassa confidenza o numeri | Ripeti i numeri compresi («Ho capito: Margherita a 9,50. Giusto?») prima di scrivere |
| Richiesta fuori perimetro | Una riga che dice cosa sai fare, senza scuse lunghe |

- **Undo reale lato server:** snapshot per ogni modifica con ID, «annulla» ripristina l'ultima; «annulla tutto» per l'ultima richiesta multipla. È la rete che permette di chiedere meno.
- **Tono e lunghezza:** titolari di ristoranti = telefono, servizio in corso, mani occupate. Risposta max 2-3 righe, prima la cosa fatta, poi eventuale domanda. Italiano informale-rispettoso, niente elenchi lunghi. Emoji: una funzionale (✅ fatto, ⚠️ attenzione), non decorative. (Convenzione, non misurata: testare A/B sul feedback dei clienti.)
- **Un solo messaggio per richiesta** quando possibile: ogni risposta separata è fatturabile in alcuni casi (§2) e rumorosa.

## 2. WhatsApp Business / Twilio — regole e limiti
- **Finestra 24h:** il bot risponde a messaggi del titolare, quindi è sempre dentro la finestra «servizio». Messaggi di servizio avviati dal cliente: **gratuiti dal 01/11/2024** ([Meta, pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). Le risposte di un tuo bot a un utente che ha scritto <24h fa non costano come messaggio. Costano i **template** avviati da voi fuori finestra (utility/marketing/authentication). Es. promemoria proattivi («il menu non è aggiornato da 20 giorni») = template a pagamento.
- **Prezzi Italia:** tariffe per messaggio (non più per conversazione) dal 2025. Un blog non ufficiale indica ~0,038 € utility e ~0,078 € marketing in Italia a metà 2026 ([chatniuexa](https://chatniuexa.onrender.com/blog/whatsapp-business-ai-chatbot-italy-2026), bassa affidabilità). **Verificare sul rate card Meta** prima di calcolare i margini. Aggiungere il markup Twilio per messaggio.
- **Policy AI (Meta, in vigore 15/01/2026):** vietato distribuire via Business API assistenti AI generalisti/LLM come servizio principale (ChatGPT lasciò WhatsApp). **Non colpisce** chi usa AI per attività di servizio verso clienti (supporto, prenotazioni, ordini, notifiche), come Meta ha dichiarato a TechCrunch ([Gulf News](https://gulfnews.com/technology/no-more-chatgpt-and-perplexity-on-whatsapp-meta-bans-major-ai-chatbots-from-2026-1.500316016), [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)). Un bot a scopo ristretto (modifica menu) è nel lato consentito; rischio: tenerlo **vincolato al compito** (rifiutare chiacchiere/domande generiche), così non somiglia a un assistente generalista. Fonti post-gennaio 2026 sull'applicazione: non trovate; ricontrollare i termini Meta correnti.
- **Typing indicator + lettura:** Twilio permette di inviare l'indicatore «sta scrivendo» legato all'ID del messaggio in arrivo; **segna anche il messaggio come letto** (spunte blu). Scompare quando arriva la risposta o dopo 25 s. API v3 con supporto WhatsApp (changelog 14/06/2026) ma in beta a dicembre 2025, senza SLA ([Twilio docs](https://www.twilio.com/docs/whatsapp/api/typing-indicators-resource), [Courier](https://www.courier.com/blog/how-to-use-whatsapp-typing-indicators-on-twilio-public-beta-guide)). Verificare se ancora beta.
- **Pulsanti/liste:** max **3 reply button** (titolo ≤20 caratteri); liste fino a **10 righe** in sezioni; sono messaggi di sessione (solo dentro le 24h) ([CM.com](https://developers.cm.com/messaging/docs/whatsapp-interactive-messages), [Bird](https://bird.com/docs/guides/whatsapp/message-types/interactive/list-menus.md)). Utili per: conferma Sì/No/Annulla e disambiguazione fino a 3-10 piatti. Contro: per chi parla a voce, un tap è comunque più lento di «sì»; accettare sempre anche testo libero («si», «ok», «no»). Verificare supporto in Twilio (Content API) prima di costruirci sopra.
- **Reazioni:** supportate dalla piattaforma (fonte secondaria Zernio); non verificato su Twilio. Idea: reazione ✅ sul messaggio originale come conferma ultraleggera, da testare.
- **Media/vocali:** audio fino a ~16 MB (fonte terza, non ufficiale); i vocali dei titolari durano pochi secondi, non è un vincolo reale. Il limite pratico è la scadenza dell'URL media Twilio: scaricare subito.
- **Timeout webhook:** fonti terze citano 15 s con 1 retry (non confermato per WhatsApp). Pratica sicura: rispondere subito 200/204, elaborare in background, inviare con REST API; **idempotenza sul MessageSid** per i retry; validare `X-Twilio-Signature` ([Hookdeck](https://hookdeck.com/webhooks/platforms/twilio-webhooks-features-and-best-practices-guide)).

## 3. Valutazione, osservabilità, privacy
**Eval** (fonti: [State Farm engineering](https://engineering.statefarm.com/grading-the-machine-using-llm-as-a-judge-to-monitor-ai-agents-in-production-25a071db9c50), [Fini](https://www.usefini.com/glossary/what-is-llm-as-a-judge), [Channel.tel](https://www.channel.tel/blog/llm-as-a-judge-production-eval-pipeline)):
- Set di partenza 50-100 casi **da conversazioni reali**, più una batteria avversaria sintetica; un test set tenuto separato dallo sviluppo. I casi sintetici da soli non riproducono la distribuzione reale.
- Giudice LLM con rubrica in linguaggio naturale; ha bias (posizione, verbosità, auto-preferenza): calibrarlo su etichette umane (vendor dicono 70-85% di accordo, non sorgentato). I revisori umani coprono <1% dei messaggi in produzione (State Farm) → campionare e giudicare in automatico.
- Spezzare le metriche per categoria (prezzi, disponibilità, cancellazioni, vocali, ambigui): la media nasconde regressioni.
- Per Takomenu, giudizio **deterministico** dove possibile (lo stato finale del DB atteso vs ottenuto): più affidabile del giudice LLM per un bot che scrive dati. Giudice LLM solo per tono/chiarezza.
- Metriche proposte: task success (stato DB corretto al primo tentativo), tasso di chiarimenti (né troppo alto né zero), tasso di correzione dell'utente («no, intendevo…», «annulla» entro 2 min = errore proxy), modifiche sbagliate non annullate (target 0), latenza p50/p95, costo per richiesta. Regression: ogni bug reale diventa un caso permanente (già previsto dalla vostra regola batteria avversaria).
- Strumenti: Langfuse/Helicone non ho potuto confermare con fonti dirette (ricerca vuota); valutare self-host EU di Langfuse per evitare trasferimenti extra-UE.

**GDPR / AI Act** (nessun parere del Garante specifico trovato; fonti secondarie, non è consulenza legale):
- I log contengono dati del titolare (persona fisica o ditta individuale) e possibili voci. Base giuridica plausibile: **esecuzione del contratto** per il servizio, **legittimo interesse** per qualità/sicurezza. Informativa dedicata (anche in onboarding e primo messaggio), DPA art. 28 con Twilio/Groq/fornitore log, retention definita. Proposta: audio cancellato dopo trascrizione (o ≤24-48h), testo log 90 giorni per debug/eval, poi anonimizzare i casi tenuti negli eval. Verificare con un consulente se la voce implichi dati biometrici (art. 9): in genere non lo è se non usata per identificare, non confermato qui.
- **AI Act art. 50**: l'obbligo di informare che si interagisce con un'AI è **applicabile dal 02/08/2026** (il Digital Omnibus ha rinviato solo gli obblighi high-risk al 02/12/2027); sanzioni fino a 15 M€ / 3% ([ProcessExcellence](https://www.processexcellencenetwork.com/ai/articles/eu-ai-act-2026-what-actually-changed-and-what-deployers-still-must-do), [FEDIL](https://fedil.lu/en/publications/ai-act-update-enforcement-begins-as-the-digital-omnibus-reshapes-the-timeline/?pdf=1)). Stato legislativo discordante tra fonti: verificare in Gazzetta UE. Azione: nel primo messaggio e nell'onboarding dire «Sono l'assistente automatico di Takomenu» (non fingersi umano). Costo zero.
- Groq/gpt-oss: verificare dove avviene l'inferenza e il DPA (trasferimento extra-UE, clausole standard).

## 4. Velocità percepita
Nessuna fonte quantitativa trovata sul tema WhatsApp; tecniche di ingegneria standard:
1. **Typing indicator immediato** (<1 s) sul messaggio in arrivo: segna letto e mostra «sta scrivendo» fino a 25 s. Per i vocali è il singolo guadagno maggiore.
2. **ACK rapido solo se lento:** se la richiesta supera ~4-5 s, mandare «Ci sono, un attimo…» e poi il risultato. Sotto quella soglia niente doppio messaggio.
3. **Budget:** trascrizione vocale (Groq Whisper) + un solo giro LLM + una scrittura DB; evitare più giri tool quando una richiesta semplice si risolve con un solo tool call; cache del menu del locale in memoria/edge; prompt corto e prefisso stabile (prompt caching dove disponibile).
4. **Trascrivi in streaming/parallelo:** scarica il media appena arriva il webhook, non dopo l'accodamento.
5. **Risposta = risultato**, non preambolo: «✅ Carbonara ora 13,50 (era 12,00)».
6. Misurare **p50/p95 end-to-end** (da invio utente a consegna) e fissare obiettivo: p50 <4 s testo, <7 s vocale (obiettivi proposti da me, non di settore).

## Priorità
1. Undo server-side + conferma proporzionale (§1). 2. Disclosure AI nel primo messaggio (§3). 3. Typing indicator + 204/background + idempotenza (§2, §4). 4. Verifica prezzi Meta Italia e termini Meta post-gennaio 2026. 5. Policy di retention + informativa + DPA. 6. Metriche in produzione (correzioni utente, annulla entro 2 min).
