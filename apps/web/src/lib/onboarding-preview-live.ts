/** Serial polling. Viewing a draft never extends its lifetime or writes to it. */
export function startOnboardingPreviewPolling<T>(options:{load:(signal:AbortSignal)=>Promise<T>;visible:()=>boolean;onData:(value:T)=>void;onError:(message:string,terminal:boolean)=>void;interval?:number;timeout?:number}){
 let active=true,running=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined
 const schedule=()=>{if(active)timer=setTimeout(()=>void refresh(),options.interval??5000)}
 const refresh=async()=>{if(!active||running)return;if(timer)clearTimeout(timer);if(!options.visible()){schedule();return}running=true;const request=new AbortController();controller=request;let timedOut=false;const deadline=setTimeout(()=>{timedOut=true;request.abort()},options.timeout??15000)
  try{const value=await options.load(request.signal);if(active&&!request.signal.aborted)options.onData(value)}catch(error){if(active){const status=Number((error as {status?:number})?.status),terminal=status===404||status===410;options.onError(timedOut?'L’aggiornamento richiede troppo tempo. Riprovo tra poco.':error instanceof Error?error.message:'Non riesco ad aggiornare la bozza. Riprovo tra poco.',terminal);if(terminal)active=false}}finally{clearTimeout(deadline);running=false;if(controller===request)controller=undefined;schedule()}
 }
 void refresh()
 return{refresh,stop:()=>{active=false;if(timer)clearTimeout(timer);controller?.abort()}}
}
export function reconcileOnboardingPreviewSelection(workspace:any,selected:string,language:string){
 const menus=Array.isArray(workspace?.menus)?workspace.menus:[],languages=Array.isArray(workspace?.languages)&&workspace.languages.length?workspace.languages:[workspace?.defaultLanguage||'it']
 return{menu:menus.some((menu:any)=>menu.id===selected)?selected:menus[0]?.id||'',language:languages.includes(language)?language:languages.includes(workspace?.defaultLanguage)?workspace.defaultLanguage:languages[0]}
}
