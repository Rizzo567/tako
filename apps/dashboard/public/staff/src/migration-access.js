/* Additive staff-login adapter. Existing application bundle/assets are preserved. */
(() => {
  'use strict';
  if(window.__takoMigrationAccessUI)return;window.__takoMigrationAccessUI=true;
  const nativeFetch=window.fetch.bind(window);let resetFlow=null;
  function updateLogin(){
    for(const form of document.querySelectorAll('form')){
      const submit=form.querySelector('button[type="submit"]'),input=form.querySelector('input[type="email"]');
      if(!input||!submit||!/^Entra$/.test(submit.textContent.trim()))continue;
      input.type='text';input.autocomplete='username';input.autocapitalize='none';input.spellcheck=false;
      const label=input.previousElementSibling;if(label&&label.tagName==='LABEL'&&label.textContent.trim()==='Email')label.textContent='Email o nome utente';
    }
  }
  const observer=new MutationObserver(updateLogin);observer.observe(document.documentElement,{childList:true,subtree:true});updateLogin();
  function choosePassword(){return new Promise((resolve,reject)=>{
    const layer=document.createElement('div');layer.id='tako-migration-password';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','migration-password-title');
    const style=document.createElement('style');style.textContent=`#tako-migration-password{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:var(--bg,#f8f7f4);padding:24px;color:var(--ink,#191919);font-family:inherit}#tako-migration-password form{width:360px;max-width:100%;background:var(--surface,#fff);border:1px solid var(--hairline,#ddd);border-radius:12px;padding:28px;box-shadow:0 8px 40px #0001}#tako-migration-password .migration-brand{display:block;margin:0 auto 26px;width:228px;height:44px;background:currentColor;mask:url(/staff/assets/branding/takomenu-wordmark-v2.svg) center/contain no-repeat;-webkit-mask:url(/staff/assets/branding/takomenu-wordmark-v2.svg) center/contain no-repeat}#tako-migration-password h1{font-size:23px;line-height:1.2;letter-spacing:-.4px;margin:0 0 10px}#tako-migration-password p{font-size:14px;color:var(--ink2,#555);line-height:1.45;margin:0 0 24px}#tako-migration-password label{display:block;font-size:12.5px;font-weight:700}#tako-migration-password input{box-sizing:border-box;width:100%;margin:6px 0 18px;padding:12px;border:1px solid var(--hairline,#ddd);border-radius:11px;background:var(--sunken,#fafafa);color:inherit;font:inherit;outline-offset:3px}#tako-migration-password button{width:100%;min-height:48px;border:0;border-radius:12px;cursor:pointer;font:600 15px inherit}#tako-migration-password .migration-save{background:var(--brand,#202020);color:var(--on-brand,#fff)}#tako-migration-password .migration-exit{margin-top:10px;background:transparent;color:inherit;border:1px solid var(--hairline,#ddd)}#tako-migration-password .migration-error{color:#a72c20;font-size:13px;min-height:0;margin:0 0 14px}#tako-migration-password button:disabled{opacity:.6;cursor:wait}@media(prefers-reduced-motion:no-preference){#tako-migration-password form{animation:migration-enter 280ms cubic-bezier(.22,1,.36,1)}@keyframes migration-enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`;
    layer.innerHTML='<form><span class="migration-brand" role="img" aria-label="Takomenu"></span><h1 id="migration-password-title">Scegli la nuova password</h1><p>Questo è il tuo primo accesso a Takomenu. Scegli una password personale di almeno 10 caratteri.</p><label for="migration-password-new">Nuova password</label><input id="migration-password-new" type="password" autocomplete="new-password" minlength="10" maxlength="72" required><label for="migration-password-confirm">Conferma password</label><input id="migration-password-confirm" type="password" autocomplete="new-password" minlength="10" maxlength="72" required><div class="migration-error" role="alert" aria-live="polite"></div><button class="migration-save" type="submit">Salva e accedi</button><button class="migration-exit" type="button">Esci</button></form>';
    layer.append(style);document.body.append(layer);
    const form=layer.querySelector('form'),password=layer.querySelector('#migration-password-new'),confirm=layer.querySelector('#migration-password-confirm'),error=layer.querySelector('.migration-error'),buttons=[...layer.querySelectorAll('button')];
    password.focus();
    layer.addEventListener('keydown',e=>{if(e.key==='Tab'){const f=[...layer.querySelectorAll('input,button')].filter(x=>!x.disabled);if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus()}}});
    form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';if(password.value!==confirm.value){error.textContent='Le due password non coincidono.';confirm.focus();return;}buttons.forEach(b=>b.disabled=true);try{
      const response=await nativeFetch('/api/auth/migration-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password.value,confirmPassword:confirm.value})});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Non è stato possibile aggiornare la password. Riprova.');
      const boot=await nativeFetch('/api/auth/bootstrap',{credentials:'include',cache:'no-store'});if(!boot.ok)throw Error('Password aggiornata. Esci e accedi di nuovo.');const fresh=await boot.json();if(fresh.data?.user?.mustChangePassword)throw Error('Completa il cambio password prima di continuare.');
      password.value='';confirm.value='';layer.remove();resolve(fresh);
    }catch(ex){error.textContent=ex.message||'Errore di connessione. Riprova.';buttons.forEach(b=>b.disabled=false);}});
    layer.querySelector('.migration-exit').addEventListener('click',async()=>{buttons.forEach(b=>b.disabled=true);try{await nativeFetch('/api/auth/logout',{method:'POST',credentials:'include'});}finally{layer.remove();reject(Error('Accesso annullato'));location.assign('/staff/');}});
  });}
  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);let url;try{url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);}catch{return response;}
    if(url.origin!==location.origin||!['/api/auth/login','/api/auth/bootstrap'].includes(url.pathname)||!response.ok)return response;
    let json;try{json=await response.clone().json();}catch{return response;}
    if(!json.data?.user?.mustChangePassword)return response;
    if(!resetFlow)resetFlow=choosePassword().finally(()=>{resetFlow=null});
    const fresh=await resetFlow;const headers=new Headers(response.headers);headers.delete('content-length');headers.set('content-type','application/json');headers.set('cache-control','no-store');
    return new Response(JSON.stringify(fresh),{status:200,headers});
  };
})();
