# CHIAVI-OK — 21/10/2026 01:05

- Chiave: `~/.config/tako-webapp/anthropic-key.txt` (account di servizio `takomenu-bot`), mai stampata né copiata nel repo.
- **A0 (schema vero `BRAIN_SCHEMA`, union `type:[x,'null']`, strict):** `POST /v1/messages`, `claude-haiku-5-5`, `output_config:{effort:'low',format:{type:'json_schema',schema}}` → **HTTP 200**, `stop_reason=end_turn`, JSON valido (set_price p1=13 per «la carbonara a 13»), 5,9 s (prima chiamata con lo schema: compilazione grammatica), input 1.802 token (lo schema pesa ~1,7k), output 207, thinking 0. Nessuna conversione a `anyOf` necessaria → E2 non scatta.
- Groq: nessuna prova (escluso dal piano).
