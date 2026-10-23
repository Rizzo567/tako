# Email — verifica e sostituzione 23 ottobre
| Sappiamo | Non sappiamo | Ipotesi / verifica | Punti ciechi |
|---|---|---|---|
| Online v178 contiene renderer precedente. Le sei bozze sono locali. | Stato inbox dei clienti e modifiche backend concorrenti. | Delta limitato al renderer; confronto moduli del bundle corrente prima del rilascio. | Outlook/Apple Mail richiedono verifica reale. |
| Bucket pubblico email esistente; non serve cambiare DNS/secret. | Collegamenti newsletter/social definitivi. | Non mostrare CTA senza destinazione valida; nessuna iscrizione implicita. | Il benvenuto online non riceve password temporanea. Non ricostruibile da hash. |
| Manuel ha chiesto di aspettare sul deploy. | Quando sarà libero il backend. | Preparazione e test soltanto; nessun deploy o invio. | Le email già accodate contengono snapshot HTML e non cambiano retroattivamente. |

Goal: sei renderer con grafica approvata, CTA reali, escaping e test verdi. Max tre cicli correzione/verifica, poi blocco documentato. Nessun cliente usato per QA.
