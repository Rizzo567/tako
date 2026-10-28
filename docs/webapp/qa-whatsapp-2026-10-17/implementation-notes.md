# Bot titolare: correzioni dal collaudo WhatsApp del 17/10. Note e deviazioni

Branch `codex/qa-whatsapp-1017`, base `3c09c11`, cioè main e il codice online con edge v107.
Per ogni scelta ho preso l'opzione più conservativa: nel dubbio il bot fa una domanda e non scrive nulla.

## Deviazioni dal piano

1. **Orologio delle batterie.** Le batterie dal round 1 al 4 e quelle nuove girano con l'orologio fissato con `vi.useFakeTimers({toFake:['Date']})`, su venerdì 16/10/2026 alle 12:00 di Roma. Per il menu del QA uso il 17/10.
   - Con `TAKO_TEST_NOW=<ISO>` si prova un altro istante.
   - Ho provato 5 istanti: 12:00, 03:00, 23:30, 08:30 di domenica, 31/10. Solo alle 03:00 compaiono 15 GRAVI, sulle date «solo oggi», «stasera» e «domani».
   - Non è un bug del bot: prima delle 06:00 `businessDate` considera ancora la giornata precedente, mentre il banco calcola «oggi» sulla data di calendario.
   - Ho lasciato la regola delle 06:00 com'è. Resta aperta una domanda di prodotto: alle 3 di notte «stasera» indica la sera appena passata o quella che arriva?
2. **I 19 rossi delle 08:35 erano i BASSI già noti del 16/10**, identici nei `results*.json` committati. Nessun GRAVE e nessun MEDIO nuovo. Ho corretto tutti i 19.
   - **Due correzioni nel banco, non nel bot:**
     - `menuintero-02`: il finto estrattore del menu dava come prova di una riga tutto il resto del vocale, prezzi degli altri piatti compresi, e il server la scartava giustamente. Ora la prova va dal nome al suo prezzo, come fa un modello vero.
     - `domanda-06`: il testo era corretto, ma la regex `/tutto/` non riconosceva «Tutti». Ho cambiato il testo del bot in «Nessun piatto è *finito*: sono tutti disponibili.».
   - Nessuna aspettativa è stata indebolita.
3. **«lascia stare X» in testa al messaggio** segue ancora la regola del round 3: annulla X se X era l'ultima modifica. Le altre negazioni passano dal nuovo filtro. Il separatore ora accetta anche «;» e non spezza «13,50».
4. **«piatto» senza articolo:**
   - subito dopo il verbo («aggiungi piatto X …») resta un'introduzione e si toglie;
   - dopo la categoria («nei piatti di prova piatto test qa …») fa parte del nome.
   - Una dettatura tutta minuscola come «aggiungi piatto test qa nei piatti di prova» resta quindi «Test qa». È il caso più ambiguo; tra virgolette il nome viene sempre preservato.
5. **«non cambiare il prezzo di X, mettilo in promo a 12».** Con un pronome (o con un resto senza piatto, per esempio «…, è finito») il testo resta intero e va all'IA. Si esclude solo il **prezzo** di X: la promo e «finito» valgono.
6. **Risposta a «Quale piatto intendi?» fuori dalle opzioni:**
   - se ha la forma di una risposta (un nome di piatto, un numero, un ordinale), il bot dice di riscrivere la richiesta e cancella la proposta;
   - se è un comando completo («la lasagna è finita», «carbonara 10»), vale come comando nuovo e il valore vecchio in sospeso non si applica mai.
7. **Righe dei piatti eliminati.** «Test QA» non è più nella bozza né nel pubblicato del QA. La sua riga in `menu_items` resta con `available=false`, come quella degli altri 10 piatti eliminati prima sul QA: è la regola dello store quando si elimina un piatto. Il menu pubblico non lo mostra. Non ho toccato l'SQL.
8. **Il chiarimento dell'IA resta in sospeso.** Il validatore fa un controllo di completezza: se un piatto è nominato per intero ma non modificato, il bot chiede quale piatto. Se l'IA aveva una sola azione chiara, ora questa diventa una proposta `choose` di 10 minuti, la stessa usata dal percorso deterministico. Prima la risposta andava persa.
9. **Bundle.** Ho rinominato gli identificatori del nuovo modulo (`NEG_SEP`, `negFillers`, `dishTokens`): con i nomi generici esbuild rinominava variabili in altri 3 moduli (`menu-full-extract`, `onboarding-lifecycle`, `stats`). Ora il bundle cambia solo nelle sezioni del bot.
10. **Verificatori indipendenti.** Oltre alla mia batteria `round5` ci sono due batterie scritte da verificatori indipendenti:
    - `round5b` (193 casi): le stesse 4 famiglie;
    - `round5c` (186 casi): falsi positivi delle nuove regole.

    Ho corretto il bot, non le loro attese, con due sole eccezioni:
    - **round5c `altrisp-04`**, «13,50» dopo «13 o 14?»: le due batterie si contraddicevano (round5b `altrisp-06` chiede di non scrivere). Ho scelto l'opzione conservativa: un prezzo diverso dalle due opzioni non si applica e il bot ripete la domanda. Lo stesso vale per «4» dopo «10 o 11?», che altrimenti avrebbe scritto 4 €. **Da confermare con Manuel.**
    - **round5 `altrisp-08`** («15»): resta senza scrittura, con la stessa regola.
11. **Conferma del riepilogo.** Vale solo se c'è un riepilogo aperto:
    - «ok grazie» conta come «ok»;
    - «annulla, no anzi conferma» conta l'ultima parola.

    Tocca la regola decisa da Manuel il 16/10 («conferma solo un messaggio fatto solo di parole di conferma»). Ho tolto solo il «grazie» in coda e l'autocorrezione dopo «anzi»; «va bene così» e «ok la prima a 30» non confermano ancora. Da confermare.
12. **«a parte».** «a parte X» non è più un'esclusione generica: spesso vuol dire «oltre a» («a parte la carbonara è finita anche la lasagna»). Resta un'esclusione solo nei comandi di gruppo («tutte le pizze finite a parte la margherita»).
13. **Gate con Groq vero, 4 frasi, 5.942 token in tutto.** Ha trovato un buco che il modello finto non vedeva: con «non cambiare boh, mettilo a 25» gpt-oss restituiva `set_price` su boh, e una mia regola aveva fatto cadere l'esclusione. Ora una negazione esplicita esclude sempre il piatto. In `round5` ci sono 2 casi nuovi che simulano proprio quella risposta.
14. **Fuori perimetro, lasciati com'erano.** La conferma con «va bene così» e la regola delle 06:00 per «stasera» alle 3 di notte.
