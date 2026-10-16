// Copy WhatsApp: italiano semplice, messaggi brevi, nessuna emoji.
// I segnaposto sono compilati dal server con dati verificati del menu.
export const copy={
 welcome:`Benvenuto nel *Takomenu di {locale}*.

Mandami un messaggio o un vocale per aggiornare il menu, anche con più richieste insieme.

Fino a *3 modifiche* le pubblico subito. Per più modifiche ti mostro il riepilogo e aspetto il tuo *OK*.

Scrivi *cosa sai fare* per vedere le funzioni.`,
 welcomeExamples:{price:'«la caprese costa 11»',finished:'«è finita la carbonara»',create:'«aggiungi tra i primi: pasta al ragù, 12 euro»'},
 help:`Puoi aggiornare *prezzi, disponibilità, descrizioni, etichette e piatti in evidenza*. Puoi aggiungere *piatti, foto e piatti del giorno*.

Scrivi o manda un *vocale*, anche con più richieste. Fino a *3 modifiche* pubblico subito; oltre, aspetto il tuo *OK*.

Esempio: «carbonara finita, diavola a 10 euro».

*Allergeni, nomi, eliminazioni, categorie e grafica*: usa la dashboard.`,
 proposal:`*{locale}*: ecco le modifiche.

{righe}

Hai dimenticato qualcosa o vuoi cambiare una voce? Mandami le correzioni, oppure scrivi *OK* per pubblicare tutto.

*ANNULLA* lascia il menu invariato. Il riepilogo vale *10 minuti*.`,
 photoProposal:`Foto per *{piatto}*{sostituisce}.

Scrivi *CONFERMA* per pubblicarla o *ANNULLA* per lasciare il menu invariato. Hai *10 minuti*.`,
 photoReplaces:'; sostituisce quella attuale',
 noChanges:'Il menu è *già aggiornato* così. Non serve cambiare nulla.',
 pendingEmpty:'Ho tolto tutte le modifiche dal riepilogo. Il menu è *invariato*.',
 typedOk:'Per pubblicare il riepilogo scrivi *OK* in chat. Puoi ancora mandarmi correzioni.',
 applied:'*Confermato.* Ho aggiornato il menu: {piatti}.',
 photoApplied:'*Confermato.* Foto pubblicata per *{piatto}*.',
 nothingToCancel:'Non ci sono modifiche in attesa. Quelle *già pubblicate* restano nel menu. Dimmi cosa vuoi ripristinare.',
 cancelled:'*Annullato.* Il menu è rimasto invariato.',
 nothingToConfirm:'Non ci sono modifiche da confermare. Dimmi cosa vuoi cambiare.',
 menuChanged:'Il menu è cambiato nel frattempo. *Non ho applicato nulla.* Rimandami la richiesta.',
 notPublished:'Il menu *non è ancora online*. Pubblicalo dalla dashboard, poi torna qui.',
 dashboardPending:'Ci sono modifiche in attesa nella *dashboard*. Pubblicale o scartale prima di continuare qui.',
 notUnderstood:'*Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?',
 choosePrice:'Per *{piatto}*, quale prezzo vuoi: *{primo}* o *{secondo}*? Non ho cambiato nulla.',
 whichDish:'Quale piatto intendi: {opzioni}? Scrivi il nome come appare nel menu.',
 dishNotFound:'*Non trovo il piatto.* Scrivi il nome come appare nel menu.',
 sameName:`Ci sono più piatti con questo nome: {opzioni}.

Indica anche il menu, per esempio «{esempio}».`,
 createMissing:'Per aggiungere {piatto} manca *{mancante}*.{categorie}\n\nRimandami la richiesta completa: «aggiungi tra {categoria}: {nomeEsempio}, 12 euro».',
 createCategories:'\nCategorie disponibili: {categorie}.',
 alreadyExists:'*{piatto}* è già in *{categoria}*. Dimmi cosa vuoi cambiare, per esempio «{piatto} costa 12 euro».',
 notVerbatim:'*Non invento nomi o descrizioni.* Scrivi il testo esatto dopo i due punti, per esempio «nella carbonara scrivi: guanciale e pecorino».',
 readNone:{unavailable:'Tutti i piatti sono *disponibili*.',hidden:'Non ci sono piatti *nascosti*.'},
 readList:{unavailable:'*Piatti finiti ({n})*\n{elenco}',hidden:'*Piatti nascosti ({n})*\n{elenco}'},
 noAi:'L’assistente è *temporaneamente non disponibile*. Puoi usare comandi semplici: «prezzo Carbonara a 12», «esaurito Carbonara», «nascondi Carbonara».',
 failed:'*Non ho cambiato nulla.* C’è stato un problema. Riprova tra poco.',
 heard:'Ho capito: «{testo}».\n\n',
 voiceEmpty:'*Non ho capito il vocale.* Puoi mandarlo di nuovo o scrivere la richiesta?',
 voiceFailed:'*Non riesco ad ascoltare il vocale.* Puoi mandarlo di nuovo o scrivere la richiesta?',
 mediaOnly:'Qui posso leggere *testo, vocali e foto dei piatti*. Per questa richiesta usa uno di questi formati.',
 photoAsk:'*Foto ricevuta.* Per quale piatto è? Mandami il nome entro *10 minuti*.',
 photoNameFirst:'Per quale piatto è la *foto*? Scrivi o pronuncia il nome.',
 photoWhich:'Per quale piatto è la *foto*: {opzioni}?',
 photoNotFound:'*Non trovo «{nome}».* Scrivi il nome del piatto come appare nel menu.',
 photoFirstOnly:'Ho usato *solo la prima foto*. Manda le altre una per messaggio.\n\n',
 photoDownload:'*Non riesco a scaricare la foto.* Puoi rimandarla?',
 photoHeic:'Il formato *HEIC* non è supportato. Invia la foto come immagine WhatsApp, non come documento.',
 photoTooBig:'La foto è *troppo grande*. Inviala senza HD oppure caricala dalla dashboard.',
 photoBytes:'La foto supera *10 MB*. Invia una versione più leggera.',
 photoAnimated:'Usa una *foto statica JPG, PNG o WebP*.',
 photoInvalid:'Il file non è una *foto JPG, PNG o WebP valida*. Puoi mandarne un’altra?',
 photoUploadFailed:'*Foto non pubblicata*: {motivo}. Scrivi *CONFERMA* per riprovare o *ANNULLA*.',
 photoPrepareFailed:'*Foto non pubblicata*: {motivo}. Rimandala oppure usa la dashboard.',
 photoWorking:'Sto caricando la *foto* e aggiornando il menu.',
 photoTimeout:'La foto richiede troppo tempo. *Non ho cambiato nulla.* Rimandala o usa la dashboard.',
 jobTimeout:'La richiesta richiede troppo tempo e mi sono fermato. *Controlla il menu*: se manca la modifica, riprova.',
 photoPublishFailed:'*Foto non pubblicata.* È rimasta nella galleria. Scrivi *CONFERMA* per riprovare o *ANNULLA*.',
 codeInvalid:'Il collegamento è *scaduto o non valido*. Generane uno nuovo dalla dashboard del locale.',
 thanks:'Di nulla. Se ti serve altro, scrivimi.',
 wait:'Sto elaborando la richiesta. *Attendi un momento*.',
 busy:'Il servizio è *temporaneamente occupato*. Non ho cambiato nulla. Riprova tra qualche minuto.',
 noMatch:'*Non trovo il piatto.* Scrivi il nome come appare nel menu. Per gli esempi scrivi *cosa sai fare*.',
 notFoundNamed:'*Non trovo «{nome}».* Scrivi il nome come appare nel menu.',
 choose:'Quale piatto intendi?\n\n{opzioni}\n\nRispondi con il *numero* o il *nome*.',
 chooseFirst:'Prima indica il *piatto*: rispondi con il numero o il nome.',
 usageWarning:'*Uso del servizio AI*: {modello} ha raggiunto il *{percento}%* del limite giornaliero ({uso}).',
 capabilityYes:'Posso *{testo}*.\n{esempio}',
 capabilityNo:'{testo}\n\n{alternativa}',
}
export const line={
 price:'*{piatto}*: prezzo da {prima} a *{dopo}*',
 available:'*{piatto}*: di nuovo *disponibile*',
 unavailable:'*{piatto}*: *finito*',
 hide:'*{piatto}*: *nascosto* dal menu',
 show:'*{piatto}*: di nuovo *visibile* nel menu',
 photo:'*{piatto}*: nuova *foto*{sostituisce}',
 description:'*{piatto}*: descrizione «{testo}»',
 tagAdd:'*{piatto}*: aggiungo l’etichetta *{etichetta}*',
 tagRemove:'*{piatto}*: tolgo l’etichetta *{etichetta}*',
 featured:'*{piatto}*: *in evidenza*',
 unfeatured:'*{piatto}*: non più in evidenza',
 create:'Nuovo piatto *{piatto}* in *{categoria}*: *{prezzo}*{descrizione}',
 special:'Piatto del giorno *{piatto}*: *{prezzo}*{descrizione}. Si nasconde a fine giornata',
 newDescription:' («{testo}»)',
 read:'*{piatto}*: *{prezzo}* · {stato}{extra}',
}
export const capabilities:{id:string,can:boolean,text:string,example?:string,alternative?:string}[]=[
 {id:'price',can:true,text:'cambiare un prezzo',example:'«la caprese costa 11 euro»'},
 {id:'unavailable',can:true,text:'segnare un piatto finito',example:'«è finita la carbonara»'},
 {id:'available',can:true,text:'rimettere un piatto disponibile',example:'«la carbonara è tornata»'},
 {id:'hidden',can:true,text:'nascondere o mostrare un piatto',example:'«nascondi il polpo» o «rimetti il polpo»'},
 {id:'description',can:true,text:'cambiare una descrizione',example:'«nella carbonara scrivi: guanciale e pecorino»'},
 {id:'tags',can:true,text:'aggiungere o togliere un’etichetta',example:'«la caprese è vegetariana»'},
 {id:'featured',can:true,text:'mettere un piatto in evidenza',example:'«metti in evidenza la tagliata»'},
 {id:'create',can:true,text:'aggiungere un piatto in una categoria esistente',example:'«aggiungi tra i primi: pasta al ragù, 12 euro»'},
 {id:'special',can:true,text:'aggiungere un piatto del giorno',example:'«oggi piatto del giorno: risotto, 16 euro». Si nasconde a fine giornata.'},
 {id:'photo',can:true,text:'aggiungere una foto',example:'Manda la foto con il nome del piatto.'},
 {id:'questions',can:true,text:'dirti prezzi e disponibilità',example:'«quanto costa la tagliata?» o «cosa è finito?»'},
 {id:'voice',can:true,text:'ricevere più richieste in un vocale',example:'Fino a *3 modifiche* pubblico subito. Per più modifiche aspetto il tuo *OK*.'},
 {id:'allergens',can:false,text:'Gli *allergeni* non si cambiano da questa chat.',alternative:'Usa la scheda del piatto nella *dashboard*.'},
 {id:'delete',can:false,text:'Da questa chat non posso *eliminare* un piatto.',alternative:'Puoi nasconderlo: «nascondi il polpo».'},
 {id:'rename',can:false,text:'Il *nome del piatto* si cambia dalla dashboard.',alternative:'Qui posso cambiare la descrizione: «nella caprese scrivi: …».'},
 {id:'bulk',can:false,text:'Non applico modifiche generiche a *tutto il menu*.',alternative:'Indica i piatti e i cambiamenti, anche nello stesso vocale.'},
 {id:'graphics',can:false,text:'La *grafica* si cambia dalla dashboard.',alternative:'Lì puoi modificare colori, font e impaginazione.'},
 {id:'categories',can:false,text:'Le *categorie* si creano e si spostano dalla dashboard.',alternative:'Qui posso aggiungere un piatto in una categoria già presente.'},
 {id:'translations',can:false,text:'Le *traduzioni* si gestiscono dalla dashboard.',alternative:'Apri la sezione dedicata alle lingue.'},
 {id:'other',can:false,text:'Questa funzione *non è disponibile* nella chat.',alternative:'Scrivi *cosa sai fare* per vedere le funzioni.'},
]
export const allowedTags:Record<string,string>={vegetariano:'Vegetariano',vegano:'Vegano',piccante:'Piccante',surgelato:'Surgelato',biologico:'Biologico',locale:'Locale'}
export const alertCopy={
 alert:'*Problema WhatsApp Takomenu*: {cosa}.\nLocale: *{locale}*\nOra: {ora}',
 test:'*Prova avviso Takomenu*: nessun guasto reale.\nEvento: {cosa}.\nLocale: *{locale}*\nOra: {ora}',
 unknownPlace:'non identificato',
 kinds:{job_timeout:'richiesta senza risposta per tempo scaduto',job_failed:'richiesta non elaborata',webhook_error:'messaggio non elaborato',send_failed:'risposta non inviata dopo due tentativi',burst:'{n} errori negli ultimi 10 minuti',test_fault:'guasto simulato sul locale di prova'} as Record<string,string>,
}
export const helpWords=['cosa sai fare','cosa puoi fare','aiuto','help','come funziona','comandi','ciao']
export const dailySectionName='Piatto del giorno'
export const fill=(template:string,values:Record<string,string|number>)=>template.replace(/\{(\w+)\}/g,(m,k:string)=>k in values?String(values[k]):m)
