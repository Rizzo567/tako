# STATO — motore Haiku 5.5 (21/10/2026)

**Aggiornato 09:15 — deploy QA fatto (edge v129), in attesa della prova di Manuel.** Vedi `REPORT.md` §0.

- Gate verde: banco 85,9% (0 GRAVI sicurezza), avversario 150 92% (0), Victoria 10/10, parlato 30/30, playground 20/20, V1–V9 verdi.
- Edge `tako-operational-candidate` v129 (ezbr 3a2f5c16…). Secret nuovi: ANTHROPIC + `TAKO_BOT_ENGINE_DEFAULT=groq` (clienti su Groq). `botEngine='haiku'` solo su QA 26050ecd.
- **Numero di Manuel non ricollegato**: è collegato dal 19/10 al locale 739024ee (rizzobusiness1@gmail.com). Spostarlo non era autorizzato → prova sincrona non eseguita. Per provare dal telefono: Manuel collega il suo numero al QA dalla dashboard del QA (sposta dal locale 739024ee) oppure autorizza lo spostamento.
- Rollback pronto: DEPLOY-QA.md §g (copia v127 in ~/.config/tako-webapp/rollback-edge-20261021/).
- Spesa Anthropic totale ~0,33 $.
