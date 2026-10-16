/* Interfaccia bloccata (14/10/2026, richiesta di Manuel) per il menu pubblico: copia della logica di apps/dashboard/public/staff/src/00-ui-lock.js. */
export {};
(function(){
 const w=window as unknown as {__takoUiLock?:boolean};if(w.__takoUiLock)return;w.__takoUiLock=true;
 const d=document,opts={passive:false,capture:true};
 const EDITABLE='input,textarea,select,[contenteditable]:not([contenteditable="false"]),.tako-selectable';
 function stop(e:Event){if(e.cancelable)e.preventDefault();}
 function editable(target:EventTarget|null){let t=target as Node|null;if(t&&t.nodeType!==1)t=t.parentElement;return !!(t&&(t as Element).closest&&(t as Element).closest(EDITABLE));}
 ['gesturestart','gesturechange','gestureend'].forEach(function(type:string){d.addEventListener(type,stop,opts);});
 d.addEventListener('touchstart',function(e:TouchEvent){if(e.touches&&e.touches.length>1)stop(e);},opts);
 d.addEventListener('touchmove',function(e){if((e.touches&&e.touches.length>1)||(typeof (e as unknown as {scale?:number}).scale==="number"&&(e as unknown as {scale:number}).scale!==1))stop(e);},opts);
 window.addEventListener('wheel',function(e:WheelEvent){if(e.ctrlKey||e.metaKey)stop(e);},opts);
 window.addEventListener('keydown',function(e:KeyboardEvent){if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const k=e.key,c=e.code;if(k==='+'||k==='-'||k==='='||k==='_'||k==='0'||c==='Equal'||c==='Minus'||c==='Digit0'||c==='NumpadAdd'||c==='NumpadSubtract'||c==='Numpad0')stop(e);},true);
 d.addEventListener('selectstart',function(e:Event){if(!editable(e.target))stop(e);},true);
 d.addEventListener('dragstart',function(e:DragEvent){const t=e.target as Element|null;if(t&&t.nodeType===1&&t.tagName==="IMG")stop(e);},true);
})();
