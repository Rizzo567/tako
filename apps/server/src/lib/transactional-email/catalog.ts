/* Approved Italian transactional copy. Values are escaped by render.ts. */
export const emailCatalog = {
  "benvenuto": {
    "id": "benvenuto",
    "subject": "Benvenuto in Takomenu, {nome_titolare}",
    "title": "Il tuo Takomenu è pronto.",
    "body": "Ciao {nome_titolare}, il tuo accesso per <strong>{nome_locale}</strong> è attivo.<br><br>Il tuo utente è <strong>{utente}</strong>. La password ti arriva su WhatsApp.<br>Il menu pubblico è qui: <a href=\"{link_menu}\">Apri il menu</a>.<br><br>Scrivi al bot WhatsApp <strong>{numero_bot}</strong> per aggiornare piatti e prezzi: puoi inviare un messaggio, un audio o una foto del menu. Ti risponde in chat.",
    "button": "Apri la dashboard",
    "url": "{link_dashboard}"
  },
  "reset-password": {
    "id": "reset-password",
    "subject": "Reimposta la tua password Takomenu",
    "title": "Scegli una nuova password.",
    "body": "Ciao {nome_titolare}, hai chiesto di reimpostare la password.<br><br>Usa il pulsante entro <strong>{minuti_validita} minuti</strong>. Se non sei stato tu, ignora questa email: la password resta invariata.",
    "button": "Reimposta la password",
    "url": "{link_reset}"
  },
  "password-cambiata": {
    "id": "password-cambiata",
    "subject": "La tua password Takomenu è stata cambiata",
    "title": "Password aggiornata.",
    "body": "Ciao {nome_titolare}, la tua password è stata cambiata il <strong>{data_ora}</strong>.<br><br>Se non sei stato tu, scrivici subito: <strong>manuelrizzo474@gmail.com</strong>.",
    "button": null,
    "url": null
  },
  "conferma-email": {
    "id": "conferma-email",
    "subject": "Conferma il tuo nuovo indirizzo email",
    "title": "Conferma il nuovo indirizzo.",
    "body": "Ciao {nome_titolare}, hai richiesto di usare <strong>{nuova_email}</strong> per accedere a Takomenu.<br><br>Conferma entro <strong>30 minuti</strong>. Se non sei stato tu, non confermare e scrivici: manuelrizzo474@gmail.com.",
    "button": "Conferma email",
    "url": "{link_conferma}"
  },
  "avviso-cambio-email": {
    "id": "avviso-cambio-email",
    "subject": "Richiesto un cambio email su Takomenu",
    "title": "La tua email sta per cambiare.",
    "body": "Ciao {nome_titolare}, è stato richiesto di cambiare la tua email di accesso in <strong>{nuova_email}</strong>.<br><br>Il cambio avverrà solo dopo la conferma del nuovo indirizzo. Se non sei stato tu, scrivici subito: <strong>manuelrizzo474@gmail.com</strong>.",
    "button": null,
    "url": null
  },
  "servizio": {
    "id": "servizio",
    "subject": "{titolo}",
    "title": "{titolo}",
    "body": "Ciao {nome_titolare},<br><br>{testo}",
    "button": "{etichetta_bottone}",
    "url": "{link_azione}"
  }
} as const
