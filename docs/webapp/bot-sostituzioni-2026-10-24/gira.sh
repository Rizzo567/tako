#!/bin/zsh
# gira.sh <nome-uscita> [record|replay] [casi-now.json casi-base.json] — gira la batteria sul route vero in locale (Haiku record/replay)
cd ${0:A:h}/../../..
D=docs/webapp/bot-sostituzioni-2026-10-24; OUT=$1; MODE=${2:-replay}; CN=${3:-$D/casi-now.json}; CB=${4:-$D/casi-base.json}
for pair in "now:$CN:$D/fixture-now.json" "base:$CB:$D/fixture-base.json"; do
  k=${pair%%:*}; rest=${pair#*:}; cf=${rest%%:*}; fx=${rest#*:}
  [ -s "$cf" ] || continue
  TAKO_SOST=1 TAKO_TEST_NOW=${TAKO_TEST_NOW:-2026-10-24T09:30:00Z} TAKO_SOST_CASES=$cf TAKO_SOST_FIXTURE=$fx TAKO_SOST_OUT=$D/out/$OUT-$k.json TAKO_BOT_LLM=$MODE TAKO_EVAL_ANTHROPIC_MAX_USD=${MAXUSD:-1.2} taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-sost-1024.test.ts 2>&1 | grep -E "SPESA|passed|failed|Error" | head -5
  node $D/controlla.mjs $cf $fx $D/out/$OUT-$k.json > $D/out/$OUT-$k.txt; tail -1 $D/out/$OUT-$k.txt
done
