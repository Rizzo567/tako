// Copy WhatsApp: italiano semplice, messaggi brevi, nessuna emoji (eccezione: il benvenuto del titolare).
// I segnaposto sono compilati dal server con dati verificati del menu.
export const copy={
 // 19/10: benvenuto del titolare (unica eccezione emoji, decisa da Manuel). Esempi presi dal menu vero del locale.
 welcome:`Ciao! Sono Takomenu, il menu digitale di *{locale}*.

I clienti inquadrano il QR sul tavolo e vedono il menu sul telefono.

Tu lo aggiorni scrivendomi qui, come a un collega:
🍝 {esempioPrezzo}
❌ {esempioFinito}
📷 manda la foto di un piatto

Prima di cambiare qualcosa ti chiedo conferma. Scrivi *cosa sai fare* quando vuoi.`,
 welcomeExamples:{price:'«carbonara 12 euro»',finished:'«tiramisù finito»'},
 help:`Puoi aggiornare *prezzi, disponibilità, descrizioni, etichette e piatti in evidenza*. Puoi aggiungere *piatti, foto e piatti del giorno*.

Scrivi o manda un *vocale*, anche con più richieste. Fino a *3 modifiche* pubblico subito; oltre, aspetto il tuo *OK*.

Esempio: «carbonara finita, diavola a 10 euro».

Puoi mandarmi anche il *menu di oggi* intero, anche a voce: «menu di oggi: primi carbonara 10, amatriciana 9». Lo pubblico dopo il tuo *OK*.
*Promo*: «carbonara in promo a 9 fino a domenica». Etichette: «carbonara ultime porzioni», «tiramisù solo per oggi».

*Allergeni, nomi, eliminazioni, categorie e grafica*: usa la dashboard.`,
 proposal:`*{locale}*: ecco le modifiche.

{righe}

Hai dimenticato qualcosa o vuoi cambiare una voce? Mandami le correzioni, oppure scrivi *OK* per pubblicare tutto.

*ANNULLA* lascia il menu invariato. Il riepilogo vale *10 minuti*.`,
 photoProposal:`Foto per *{piatto}*{sostituisce}.

Scrivi *CONFERMA* per pubblicarla o *ANNULLA* per lasciare il menu invariato. Hai *10 minuti*.`,
 photoReplaces:'; sostituisce quella attuale',
 brainWhatFor:'Cosa vuoi cambiare per *{piatto}*: il prezzo, se è finito o altro? Non ho cambiato nulla.',
 brainNoContext:'A quale piatto ti riferisci, e cosa vuoi cambiare? Non ho cambiato nulla.',
 // 17/10 (A4.5): con una cronologia recente la domanda cita i piatti di cui si stava parlando.
 brainWhichRecent:'Ti riferisci a {piatti}? Dimmi il piatto e cosa cambiare. Non ho cambiato nulla.',
 noChanges:'Nessuna modifica: il menu è *già così*. Non ho cambiato nulla.',
 pendingEmpty:'Ho tolto tutte le modifiche dal riepilogo. Il menu è *invariato*.',
 typedOk:'Per pubblicare il riepilogo scrivi *OK* in chat. Puoi ancora mandarmi correzioni.',
 applied:'*Confermato.* Ho aggiornato il menu: {piatti}.',
 photoApplied:'*Confermato.* Foto pubblicata per *{piatto}*.',
 nothingToCancel:'Non ci sono modifiche in attesa. Quelle *già pubblicate* restano nel menu. Dimmi cosa vuoi ripristinare.',
 cancelled:'*Annullato.* Il menu è rimasto invariato.',
 nothingToConfirm:'Non ci sono modifiche da confermare. Dimmi cosa vuoi cambiare.',
 menuChanged:'Il menu è cambiato nel frattempo, quindi *non ho applicato nulla*. Dimmi di nuovo cosa vuoi cambiare.',
 notPublished:'Il menu *non è ancora online*. Pubblicalo dalla dashboard, poi torna qui.',
 dashboardPending:'Ci sono modifiche in attesa nella *dashboard*. Pubblicale o scartale prima di continuare qui.',
 notUnderstood:'*Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?',
 choosePrice:'Per *{piatto}*, quale prezzo vuoi: *{primo}* o *{secondo}*? Non ho cambiato nulla.',
 // 17/10 (QA WhatsApp): prezzi alternativi in forma di domanda, senza piatto chiaro, in una richiesta più lunga; risposta non valida.
 choosePriceNow:'*{piatto}* ora costa *{attuale}*. Se vuoi cambiarlo, quale prezzo: *{primo}* o *{secondo}*? Non ho cambiato nulla.',
 choosePriceNoDish:'Quale prezzo vuoi: *{primo}* o *{secondo}*? E per quale piatto? Non ho cambiato nulla.',
 choosePriceMulti:'Per *{piatto}* hai scritto due prezzi: *{primo}* o *{secondo}*? Non ho cambiato nulla.',
 choosePriceAgain:'Per *{piatto}* rispondi *{primo}* o *{secondo}*. Non ho cambiato nulla.',
 chooseInvalid:'*{nome}* non è tra i piatti che ti ho proposto, quindi non ho cambiato nulla. Dimmi il piatto e cosa cambiare.',
 chooseAgain:'Rispondi con il *numero* o il *nome* del piatto. Non ho cambiato nulla.',
 negatedOnly:'Va bene, *{piatti}* resta com’è. Non ho cambiato nulla.',
 whichDish:'Quale piatto intendi: {opzioni}? Dimmi quale e cosa cambiare. Non ho cambiato nulla.',
 dishNotFound:'*Non trovo il piatto.* Scrivi il nome come appare nel menu.',
 sameName:`Ci sono più piatti con questo nome: {opzioni}.

Indica anche il menu, per esempio «{esempio}».`,
 createMissing:'Per aggiungere {piatto} mi manca *{mancante}*.{categorie} Dimmelo e lo aggiungo. Non ho ancora aggiunto nulla.',
 createCategories:'\nCategorie disponibili: {categorie}.',
 alreadyExists:'*{piatto}* è già in *{categoria}*: non l’ho aggiunto di nuovo. Se vuoi cambiarlo, dimmi cosa.',
 notVerbatim:'*Non invento nomi o descrizioni.* Scrivi il testo esatto dopo i due punti, per esempio «nella carbonara scrivi: guanciale e pecorino».',
 readNone:{unavailable:'Nessun piatto è *finito*: sono tutti disponibili.',hidden:'Non ci sono piatti *nascosti*.'},
 readList:{unavailable:'*Piatti finiti ({n})*\n{elenco}',hidden:'*Piatti nascosti ({n})*\n{elenco}'},
 // A7.13 (off): Groq giù su una richiesta che serve all'IA → mai «c'è stato un problema»: si dice cosa funziona adesso.
 unreadAsk:'Non sono sicuro di aver capito tutta la richiesta: cosa intendi con «{testo}»? Non ho cambiato nulla.',
 aiDown:'*Non ho cambiato nulla.* Questa richiesta adesso non la riesco a leggere: l’assistente che capisce le frasi lunghe è *temporaneamente non disponibile*. Funzionano i comandi semplici, un piatto per messaggio, come «carbonara 13» o «la gricia è finita».',
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
 // 17/10 (AI Act art. 50): detto una sola volta per numero, al collegamento o al primo messaggio.
 aiDisclosure:'Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona.',
 // Fase R (17/10 notte, decisione di Manuel): l'UNICO altro testo fisso col cervello acceso. Groq giù / 429 / timeout / JSON non
 // valido dopo il ripiego: nessuna modifica, nessuna riserva a regole.
 brainDown:'Sono momentaneamente non disponibile, riprova tra un minuto.',
 // 17/10 (vocale di Manuel): richiesta multipla con una parte incerta. Le parti chiare restano in sospeso, mai perse.
 holdHead:'Ho capito, *non ancora pubblicato*:\n{righe}',
 holdRemove:'«{parola}» non è nel menu. Intendi *togliere {piatto}* dal menu? Rispondi *sì* o *no*: poi pubblico tutto insieme. Non ho ancora cambiato nulla.',
 holdPrice:'Quanto costa *{piatto}*? Poi pubblico tutto insieme. Non ho ancora cambiato nulla.',
 holdNotTouched:'Non ho toccato *{piatto}*.',
 holdAskRemove:'per «{parola}» intendi *togliere {piatto}* dal menu?',
 holdAskPrice:'quanto costa *{piatto}*?',
 holdAskChoose:'per «{parola}» quale intendi? {opzioni}',
 holdAskConfirm:'per «{parola}» intendi: {cosa}?',
 holdAskUnknown:'«{parola}» non l’ho capito: cosa intendevi?',
 holdAskFooter:'Rispondi a ogni domanda (anche con le lettere, per esempio «A sì, B la seconda»): poi pubblico tutto insieme. *No* pubblica solo le parti chiare, *annulla* non pubblica niente. Non ho ancora cambiato nulla.',
 // 17/10 (A5): una domanda sola, senza lettere né esempi.
 holdAskFooterOne:'Rispondi e pubblico tutto insieme: *no* pubblica solo le parti chiare, *annulla* non pubblica niente. Non ho ancora cambiato nulla.',
 holdAskFooterOnly:'Rispondi *sì* o *no*. Non ho ancora cambiato nulla.',
 holdAskFooterChoose:'Rispondi con il *numero* o il *nome*. Non ho ancora cambiato nulla.',
 holdDropped:'La richiesta di prima non l’ho pubblicata: se ti serve ancora, rimandamela.',
 holdExists:'*{piatto}* è già in *{categoria}* a {prezzo}: non l’ho aggiunto di nuovo.',
 holdRestUnclear:'Non ho capito «{testo}»: rimandamelo da solo.',
 deleteAsk:'Elimino {piatti} dal menu? Rispondi *sì* per eliminare (per 10 minuti potrai ancora scrivere «annulla»), *no* per lasciarlo com’è. Non ho ancora cambiato nulla.',
 draftDropped:'Va bene, non aggiungo {piatto}. Non ho cambiato nulla.',
 batchStill:'Le modifiche del riepilogo di prima non sono ancora pubblicate: rispondi *ok* per pubblicarle, *no* per lasciarle perdere.',
 pendingStill:'La richiesta di prima aspetta ancora la tua risposta: *sì* per procedere, *no* per lasciar perdere.',
 deleteUndoHint:'Per 10 minuti puoi scrivere «annulla» per rimetterlo.',
 sectionAsk:'Nel menu non c’è la categoria *{categoria}*: la creo e ci metto {piatti}? Rispondi *sì*, oppure dimmi in quale categoria metterlo. Categorie: {categorie}. Non ho ancora cambiato nulla.',
 sectionExists:'La categoria *{categoria}* c’è già: uso quella.',
 hiddenNotDeletedPlain:'L’ho *nascosto*. Se vuoi eliminarlo del tutto scrivi «elimina {piatto}».',
 hiddenNotDeleted:'I piatti non li elimino: li *nascondo*. Per rimetterli scrivi «rimetti {piatto}».',
 // 17/10: annulla vero, entro 10 minuti da una modifica pubblicata da WhatsApp.
 undoDone:'*Annullato.* Il menu è tornato com’era prima dell’ultima modifica.\n\n{righe}',
 undoRestored:'*{piatto}*: com’era prima',
 undoRemoved:'*{piatto}*: tolto (era stato aggiunto)',
 undoConflict:'*Non annullo*: nel frattempo {piatti} è stato cambiato dalla dashboard. Non ho toccato nulla. Dimmi cosa vuoi cambiare.',
 undoExpired:'Posso annullare solo le modifiche fatte qui negli *ultimi 10 minuti*. Non ho toccato nulla. Dimmi cosa vuoi cambiare.',
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
 // Fase B (17/10): struttura del menu.
 deleted:'*{piatto}*: *eliminato* dal menu',
 deletedNew:'*{piatto}*: tolto (l’avevo appena aggiunto)',
 renamed:'*{piatto}*: nuovo nome *{nome}*',
 moved:'*{piatto}*: spostato in *{categoria}*',
 newSection:'Nuova categoria *{categoria}*',
 renameSection:'Categoria *{prima}*: nuovo nome *{nome}*',
 read:'*{piatto}*: *{prezzo}* · {stato}{extra}',
}
export const capabilities:{id:string,can:boolean,text:string,example?:string,alternative?:string}[]=[
 {id:'price',can:true,text:'cambiare un prezzo',example:'«la caprese costa 11 euro»'},
 {id:'unavailable',can:true,text:'segnare un piatto finito',example:'«è finita la carbonara»'},
 {id:'available',can:true,text:'rimettere un piatto disponibile',example:'«la carbonara è tornata»'},
 {id:'hidden',can:true,text:'nascondere o mostrare un piatto',example:'«togli il polpo» o «rimetti il polpo»'},
 {id:'description',can:true,text:'cambiare una descrizione',example:'«nella carbonara scrivi: guanciale e pecorino»'},
 {id:'tags',can:true,text:'aggiungere o togliere un’etichetta',example:'«la caprese è vegetariana»'},
 {id:'featured',can:true,text:'mettere un piatto in evidenza',example:'«metti in evidenza la tagliata»'},
 {id:'create',can:true,text:'aggiungere un piatto in una categoria esistente',example:'«aggiungi tra i primi: pasta al ragù, 12 euro»'},
 {id:'special',can:true,text:'aggiungere un piatto del giorno',example:'«oggi piatto del giorno: risotto, 16 euro». Si nasconde a fine giornata.'},
 {id:'photo',can:true,text:'aggiungere una foto',example:'Manda la foto con il nome del piatto.'},
 {id:'promo',can:true,text:'mettere o togliere un prezzo promo',example:'«carbonara in promo a 9 fino a domenica» o «togli la promo dalla carbonara». Il prezzo pieno resta barrato accanto.'},
 {id:'scarcity',can:true,text:'segnare *Ultime porzioni* o *Solo oggi*',example:'«carbonara ultime porzioni», «tiramisù solo per oggi», «togli ultime porzioni». *Solo oggi* sparisce il giorno dopo alle 6.'},
 {id:'questions',can:true,text:'dirti prezzi e disponibilità',example:'«quanto costa la tagliata?» o «cosa è finito?»'},
 {id:'fullmenu',can:true,text:'cambiare tutto il menu del giorno',example:'«menu di oggi: primi carbonara 10, amatriciana 9; secondi tagliata 16», anche a voce. Ti mostro il riepilogo e aspetto il tuo *OK*. I piatti di prima si nascondono, non si eliminano.'},
 {id:'voice',can:true,text:'ricevere più richieste in un vocale',example:'Fino a *3 modifiche* pubblico subito. Per più modifiche aspetto il tuo *OK*.'},
 {id:'allergens',can:false,text:'Gli *allergeni* non si cambiano da questa chat.',alternative:'Usa la scheda del piatto nella *dashboard*.'},
 {id:'delete',can:true,text:'eliminare un piatto (ti chiedo conferma, poi per 10 minuti puoi annullare)',example:'«elimina il polpo»; «togli il polpo» invece lo nasconde'},
 {id:'rename',can:true,text:'cambiare il nome di un piatto o di una categoria',example:'«rinomina il polpo in Polpo alla griglia»'},
 {id:'bulk',can:false,text:'Non applico modifiche generiche a *tutto il menu*.',alternative:'Indica i piatti e i cambiamenti, anche nello stesso vocale. Oppure mandami il *menu completo* del giorno: lo sostituisco dopo il tuo *OK*.'},
 {id:'graphics',can:false,text:'La *grafica* si cambia dalla dashboard.',alternative:'Lì puoi modificare colori, font e impaginazione.'},
 {id:'categories',can:true,text:'creare categorie e spostare piatti',example:'«crea la categoria speciali» o «sposta il polpo nei secondi»'},
 {id:'translations',can:false,text:'Le *traduzioni* si gestiscono dalla dashboard.',alternative:'Apri la sezione dedicata alle lingue.'},
 {id:'other',can:false,text:'Questa funzione *non è disponibile* nella chat.',alternative:'Scrivi *cosa sai fare* per vedere le funzioni.'},
]
// Menu intero da messaggio o vocale (Feature 1). Il server compila i segnaposto con dati verificati.
export const fullMenuCopy={
 doubt:'È il *menu completo* da mettere al posto di quello attuale, o sono *modifiche* ai piatti che ci sono già?\n\nRispondi *MENU* oppure *MODIFICHE*. Non ho ancora cambiato nulla.',
 doubtAgain:'Rispondi *MENU* (sostituisco il menu dopo il riepilogo) oppure *MODIFICHE* (le applico ai piatti che ci sono). *ANNULLA* per lasciar perdere.',
 where:'Dove lo metto?\n{domanda}\n\nNon ho ancora cambiato nulla.',
 whereMenu:'Nel menu {opzioni}?',
 whereMode:'Al posto del *menu attuale* o nel *preset di un giorno* (per esempio «pranzo di lunedì»)?',
 whereReplaceOnly:'Lo metto *al posto del menu attuale*.',
 whereConfirmReplace:'Vuoi metterlo al posto del menu attuale ({menu})? Rispondi *al posto* oppure *ANNULLA*.',
 presetOff:'I *menu dei singoli giorni* (preset) non sono ancora attivi per questo locale.',
 destReplace:'menu *{menu}*, al posto di quello attuale',
 destPreset:'preset *{preset}* del menu *{menu}*',
 head:'*{locale}*, {destinazione}.\n{origine}',
 fromVoice:'Ecco il menu che ho capito dal *vocale*: controlla nomi e prezzi.',
 fromText:'Ecco il menu che ho letto.',
 noSection:'Senza categoria',
 missing:'*Senza prezzo*, non li metto online: {piatti}. Scrivimi il prezzo, per esempio «{esempio} 12».',
 twoPrices:' (ho letto più prezzi)',
 check:'*Da controllare*:',
 changes:'Rispetto a oggi: {nuovi} nuovi, {aggiornati} con prezzo cambiato, {nascosti} nascosti (non eliminati){elenco}.',
 hiddenList:': {piatti}',
 others:'Gli altri menu non cambiano: {menu}.',
 presetNote:'Lo salvo nel preset *{preset}*: il menu online non cambia.',
 confirm:'Confermi? Rispondi OK, oppure correggi (es. "{esempio}").\n*ANNULLA* butta via questa bozza. Vale *30 minuti*.',
 fixPrice:'*{piatto}*: {prima} → *{dopo}*',
 fixRemoved:'*{piatto}*: tolto',
 fixAdded:'*{piatto}*: *{prezzo}*',
 fixDone:'Fatto: {modifiche}.',
 fixFailed:'Non ho capito: «{testo}». Scrivi per esempio «la carbonara è 11», «togli la tagliata» o «aggiungi panna cotta 5 tra i dolci».',
 pending:'C’è un *menu in attesa* della tua conferma. Rispondi *OK* per pubblicarlo, mandami una correzione, oppure *ANNULLA*.',
 empty:'Non sono riuscito a leggere *piatti e prezzi* nel menu. *Non ho cambiato nulla.* Rimandalo scritto, una riga per piatto: «carbonara 10».',
 noRows:'Il menu non ha più piatti con prezzo. *Non ho cambiato nulla.* Mandami i prezzi o scrivi *ANNULLA*.',
 failed:'Non sono riuscito a leggere il menu. *Non ho cambiato nulla.* Riprova tra poco o mandalo scritto.',
 applied:'*Fatto.* Il menu *{menu}* è online con {piatti} piatti: {nuovi} nuovi, {aggiornati} con prezzo cambiato, {nascosti} nascosti (non eliminati).{senzaPrezzo}\n\nLe traduzioni arrivano da sole: finché non sono pronte si vede l’italiano. Per tornare indietro scrivi «ripristina il menu di prima».',
 appliedMissing:'\nNon ho messo online: {piatti} (senza prezzo).',
 savedPreset:'*Fatto.* Ho salvato il menu nel {preset}. Il menu online *non cambia*.',
 restored:'*Ripristinato.* Il menu *{menu}* è tornato com’era prima del menu intero. Gli altri menu non cambiano.',
 restoreNone:'Non trovo un menu di prima da ripristinare. Da qui ripristino solo un menu intero mandato in chat; per le altre versioni usa la dashboard.',
 restoreDone:'Ho *già ripristinato* il menu di prima. Per altre versioni usa la dashboard.',
}
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
// F3+F4 (16/10): prezzo promo e scarsità. Chiavi nuove e separate, per non toccare i testi esistenti.
export const salesLine={
 promo:'*{piatto}*: in *promo* a *{promo}* (prezzo pieno {pieno}){fino}',
 until:', fino a *{giorno}*',
 noEnd:', finché non la togli',
 promoOff:'*{piatto}*: tolgo la *promo*, torna a {pieno}',
 lastOn:'*{piatto}*: etichetta *Ultime porzioni*',
 lastOff:'*{piatto}*: tolgo *Ultime porzioni*',
 todayOn:'*{piatto}*: etichetta *Solo oggi*, sparisce domani alle 6',
 todayOff:'*{piatto}*: tolgo *Solo oggi*',
}
export const salesCopy={
 promoInvalid:'*Non ho cambiato nulla.* Il prezzo promo di *{piatto}* ({promo}) deve essere *più basso del prezzo pieno* ({pieno}) e maggiore di zero.',
 promoPriceText:'*Non ho cambiato nulla.* *{piatto}* mostra un prezzo scritto a testo («{testo}»): la promo non si vedrebbe. Toglilo dalla dashboard e riprova.',
 untilUnclear:'*Non ho cambiato nulla.* Non ho capito *fino a quando* vale la promo. Scrivi per esempio «carbonara in promo a 9 fino a domenica» o «fino al 20/10».',
 noneWithLabel:{promo:'Nessun piatto è in *promo* adesso.',lastPortions:'Nessun piatto ha l’etichetta *Ultime porzioni*.',onlyToday:'Nessun piatto ha l’etichetta *Solo oggi*.'} as Record<'promo'|'lastPortions'|'onlyToday',string>,
}
