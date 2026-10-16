# Sincronizzazione delle sessioni di Manuel e Ale

## Fonte comune

Codice e documenti nel repository sono la fonte condivisa. La memoria privata delle chat non si replica. Il branch iniziale comune è `codex/takomenu-handoff-2026-10-16`; `main` è più vecchio alla consegna. Quando la consegna verrà integrata, aggiornare questo documento e TEAM_CONTEXT al nuovo branch comune.

## All'inizio di ogni sessione

1. Leggere AGENTS.md. Eseguire `git status --short --branch`, identificare branch e modifiche locali. Mai cancellare o nascondere automaticamente lavoro di altri.
2. Eseguire `git fetch origin --prune`. Controllare commit nuovi sul proprio branch remoto e sul branch comune dichiarato.
3. Su un branch pulito con upstream usare `git pull --ff-only`. Se diverge, esaminare prima i cambiamenti: niente reset o force-push. Se ci sono file modificati, salvaguardarli con commit pertinente o concordare l'integrazione; non fare pull cieco.
4. Per una nuova attività creare un branch `codex/manuel-<attivita>` o `codex/ale-<attivita>` dall'ultima versione remota del branch comune. Per attività già iniziate integrare gli aggiornamenti pertinenti del branch comune, preferendo merge sul proprio branch per preservare la cronologia condivisa.
5. Leggere docs/TEAM_CONTEXT.md, docs/DECISIONS.md e i nuovi resoconti in docs/sessions/. Controllare anche le PR aperte e i branch dell'altro collaboratore: file sul solo branch personale non compaiono con il pull del branch comune.
6. Identificare l'attività e il responsabile, verificare sovrapposizioni. Se la stessa area è già in lavorazione coordinarsi prima di duplicare il lavoro. Non dichiarare un'attività prenotata per entrambi finché la prenotazione non è visibile nel riferimento comune o nella PR.

## Durante il lavoro

Una attività per branch. Annotare decisioni condivise e variazioni di obiettivo. Codice e dati di test sintetici; configurazione segreta fuori Git. Non eseguire deploy, migrazioni, inviti clienti o scritture reali come effetto collaterale della sincronizzazione.

## Alla fine di ogni sessione

1. Scrivere `docs/sessions/YYYY-MM-DD-<autore>-<attivita>.md`: obiettivo, file/decisioni, commit o branch, test PASS/FAIL, deploy effettuati o assenti, blocchi e prossimo passo. Nessuna password o recap privato.
2. Aggiornare TEAM_CONTEXT per lo stato di propria competenza e DECISIONS per scelte nuove. Non sovrascrivere sezioni aggiornate dall'altro senza confrontarle.
3. Fare commit dei soli file pertinenti. Eseguire di nuovo fetch e confrontare upstream/branch comune. Integrare eventuali aggiornamenti necessari sul proprio branch; risolvere conflitti senza perdere modifiche, poi ripetere i test interessati.
4. Push del proprio branch, senza force. Aprire/aggiornare una PR per proporre l'integrazione. Il branch comune cambia solo dopo integrazione verificata; un documento su branch personale non è già comune.
5. Verificare che il commit remoto corrisponda al locale e comunicare branch/commit, verifiche e prossimo passo. Se il push o fetch non riesce, dirlo: non dichiarare sincronizzato.

## Limiti

Queste sono istruzioni per l'agente quando lavora nel repository. Non sono un monitor in background e non scattano da sole se si chiude l'app o la chat viene interrotta prima del resoconto. Per chiudere bene una sessione scrivere “fine sessione: sincronizza e salva stato”. Non sincronizzare cronologie chat o segreti. Ale deve usare una chat con ambiente di sviluppo collegato al repository per eseguire questi passi.
