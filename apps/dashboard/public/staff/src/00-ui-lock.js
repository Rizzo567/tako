/* Interfaccia bloccata (14/10/2026, richiesta di Manuel): niente zoom/dezoom e niente selezione fuori dai campi di testo.
   Il meta viewport (maximum-scale=1, user-scalable=no) basta a Chrome; Safari iOS lo ignora, quindi qui si bloccano
   i gesti di pinch (gesture*, touch a 2 dita), ctrl/cmd + rotella e ctrl/cmd + + - = 0. Lo scroll a un dito resta nativo.
   La selezione è bloccata in CSS (src/ui-lock.css) e qui su selectstart, con eccezione per input, textarea, select,
   contenteditable e .tako-selectable (codice WhatsApp da copiare). Copia identica in apps/web-static/src/ui-lock.ts. */
(function(){
 if(window.__takoUiLock)return;window.__takoUiLock=true;
 var d=document,opts={passive:false,capture:true};
 var EDITABLE='input,textarea,select,[contenteditable]:not([contenteditable="false"]),.tako-selectable';
 function stop(e){if(e.cancelable)e.preventDefault();}
 function editable(t){if(t&&t.nodeType!==1)t=t.parentElement;return !!(t&&t.closest&&t.closest(EDITABLE));}
 ['gesturestart','gesturechange','gestureend'].forEach(function(type){d.addEventListener(type,stop,opts);});
 d.addEventListener('touchstart',function(e){if(e.touches&&e.touches.length>1)stop(e);},opts);
 d.addEventListener('touchmove',function(e){if((e.touches&&e.touches.length>1)||(typeof e.scale==='number'&&e.scale!==1))stop(e);},opts);
 window.addEventListener('wheel',function(e){if(e.ctrlKey||e.metaKey)stop(e);},opts);
 window.addEventListener('keydown',function(e){if(!(e.ctrlKey||e.metaKey)||e.altKey)return;var k=e.key,c=e.code;if(k==='+'||k==='-'||k==='='||k==='_'||k==='0'||c==='Equal'||c==='Minus'||c==='Digit0'||c==='NumpadAdd'||c==='NumpadSubtract'||c==='Numpad0')stop(e);},true);
 d.addEventListener('selectstart',function(e){if(!editable(e.target))stop(e);},true);
 d.addEventListener('dragstart',function(e){var t=e.target;if(t&&t.nodeType===1&&t.tagName==='IMG')stop(e);},true);
})();
