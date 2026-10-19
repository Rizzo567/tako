# A0 · Prova chiavi (19/10/2026 18:00 UTC)

| Fornitore | Chiave | Esito | Token (`usage`) | Latenza |
|---|---|---|---|---|
| Anthropic `claude-haiku-5-5` | `ANTHROPIC_API_KEY` **assente** nell'ambiente | **errore 401** `authentication_error` «x-api-key header is required» | 0 | — |
| Groq `openai/gpt-oss-120b` | `GROQ_API_KEY` | **ok** (200) | 72 in / 5 out | 0,77 s |
| Groq `openai/gpt-oss-120b` | `GROQ_API_KEY2` (nell'ambiente si chiama così, non `GROQ_API_KEY_2`) | **ok** (200) | 72 in / 5 out | 0,31 s |

Richiesta: `max_tokens: 5`, messaggio «ok», nessun system, nessuno strumento. Anthropic non ritentato (una sola prova, come da regola).

**Conseguenza:** il motore Anthropic si costruisce e si testa **offline** con un client registrato deterministico. Il confronto Haiku vs Groq della run è **solo architetturale** lato Haiku; Groq si può misurare col modello vero. Costo Anthropic della run: 0 $.
