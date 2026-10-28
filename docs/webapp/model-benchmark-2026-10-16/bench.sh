#!/bin/zsh
# Esecuzione sequenziale (un modello alla volta, priorità bassa). 120b limitato a 5000 TPM e 70k token totali: la chiave è condivisa col bot online.
cd "${0:A:h}"
N=${N:-45}
taskpolicy -b node --no-warnings --experimental-strip-types run.ts groq openai/gpt-oss-120b --sample $N --tpm 5000 --max-tokens-total 70000
taskpolicy -b node --no-warnings --experimental-strip-types run.ts groq openai/gpt-oss-20b --sample $N --tpm 7500
taskpolicy -b node --no-warnings --experimental-strip-types run.ts groq qwen/qwen3.8-27b --sample $N --tpm 7500
