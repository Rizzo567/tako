// Adattatore del motore ANTHROPIC (Haiku 5.5 a strumenti, PIANO cervello Anthropic 17/10, task 4.3): SOLO interfaccia.
// TODO(agente A/motore Anthropic): implementare run() sullo stesso route vero (createRouteBot con l'interruttore del motore,
// es. settings.botEngine='anthropic') e intercettare le chiamate a api.anthropic.com come groq-cache fa per Groq (cache/record,
// tetto di spesa per giro, chiave di test da file, mai stampata). Finché ready=false il runner salta il bot e lo scrive nel report.
import type {BotUnderTest} from '../types.js'

export type AnthropicBotOptions={model?:string,keyFile?:string,maxUsdPerRun?:number}

export function createAnthropicBot(opts:AnthropicBotOptions={}):BotUnderTest{
 return{name:`anthropic-${opts.model??'haiku-5.5'}`,ready:false,
  async run(){throw new Error('TODO: adattatore Anthropic non ancora implementato (tests/eval/adapters/anthropic-bot.ts)')}}
}
