/* Prototipo interazione Preset (Feature 2). Standalone, dati finti, nessuna rete.
   Regole: stato applicativo separato dal movimento; ogni gesto cambia subito lo stato e il CSS
   ritargetta dal valore corrente (transizioni su transform/opacity); nessun lock per animazione;
   callback obsolete scartate con contatori di epoca. */
(function () {
  'use strict';
  const M = window.TakoMenuMotion;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const qs = new URLSearchParams(location.search);
  const VARIANT = document.body.dataset.variant || 'a';
  const SAVE_FAILS = qs.has('fail') ? 1 : 0; // ?fail=1: il primo salvataggio fallisce (verifica stato di errore)
  let saveFailsLeft = SAVE_FAILS;

  const bez = a => `cubic-bezier(${a.join(',')})`;
  const dur = k => (RM.matches ? 0 : M.durationMs[k]);
  function applyTokens() {
    const r = document.documentElement.style, rm = RM.matches;
    ['press', 'micro', 'fast', 'standard', 'surface', 'exit', 'data'].forEach(k => r.setProperty('--d-' + k, (rm && k !== 'data' ? 0 : M.durationMs[k]) + 'ms'));
    r.setProperty('--e-out', bez(M.easing.out));
    r.setProperty('--e-exit', bez(M.easing.exit));
    r.setProperty('--content-delay', (rm ? 0 : M.recipeDelayMs.contentAfterSurface) + 'ms');
    r.setProperty('--stagger', (rm ? 0 : M.staggerMs.list) + 'ms');
    r.setProperty('--dist-micro', (rm ? 0 : M.distancePx.micro) + 'px');
  }
  applyTokens();
  RM.addEventListener('change', applyTokens);

  /* ---------- stato ---------- */
  const DB = JSON.parse(JSON.stringify(window.PP_DATA));
  const S = {
    menuId: 'pranzo',
    viewing: { pranzo: 'attuale', cena: 'attuale', drinks: 'attuale' },
    open: false,
    pickerOpen: false,
    draft: null // { menuId, presetId, prices: { key: price } }
  };
  let trayEpoch = 0, listEpoch = 0, labelAnim = null, newCount = 0;
  const menu = () => DB.menus.find(m => m.id === S.menuId);
  const presetOf = (m, id) => m.presets.find(p => p.id === id);
  const viewingId = () => S.viewing[S.menuId];
  function contentOf(m, id) {
    if (id === 'attuale') return m.weekly ? (presetOf(m, m.onlinePreset) || { sections: [] }).sections : m.current;
    return presetOf(m, id).sections;
  }
  const labelOf = (m, id) => (id === 'attuale' ? 'Menu attuale' : presetOf(m, id).label);
  const dirty = () => !!(S.draft && Object.keys(S.draft.prices).length);

  /* ---------- markup ---------- */
  const ico = {
    chev: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    gear: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    rchev: '<svg class="mw-catalog-chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bowl: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1 1-1.5 1-2.5M12 7c0-1 1-1.5 1-2.5M16 7c0-1 1-1.5 1-2.5"/></svg>',
    photo: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>',
    grip: '<svg aria-hidden="true" width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="3" r="1.4"/><circle cx="8" cy="3" r="1.4"/><circle cx="2" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="2" cy="13" r="1.4"/><circle cx="8" cy="13" r="1.4"/></svg>'
  };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => n.toFixed(2).replace('.', ',');

  const presetBtnHTML = '<button id="pp-preset" class="pp-preset-btn" type="button" aria-expanded="false" aria-controls="pp-tray" aria-haspopup="true"><span class="pp-label">Preset</span>' + ico.chev + '</button>';
  const toolbar = document.getElementById('pp-toolbar');
  toolbar.innerHTML =
    '<div class="mw-universal-search" id="pp-picker-host"><button class="mw-menu-picker" id="pp-picker" type="button" aria-label="Menu selezionato" aria-expanded="false" aria-controls="pp-menu-options"><span id="pp-menu-name"></span>' + ico.chev + '</button>' +
    '<div class="mw-search-results mw-menu-options" id="pp-menu-options" role="region" aria-label="Menu disponibili"></div></div>' +
    (VARIANT === 'a' ? presetBtnHTML + '<span class="pp-spacer"></span>' : '<span class="pp-spacer"></span>' + presetBtnHTML) +
    '<div class="mw-studio-toolbuttons"><button type="button" aria-label="Cerca nel menu (non attivo nel prototipo)">' + ico.search + '</button><button type="button" aria-label="Aggiungi categoria o piatto (non attivo nel prototipo)">' + ico.plus + '</button></div>';

  const $ = id => document.getElementById(id);
  const btn = $('pp-preset'), label = btn.querySelector('.pp-label'), stage = $('pp-stage'), tray = $('pp-tray'),
    trayInner = tray.querySelector('.pp-tray-inner'), chipsEl = $('pp-chips'), listEl = $('pp-list'), statusEl = $('pp-status'),
    picker = $('pp-picker'), pickerHost = $('pp-picker-host'), options = $('pp-menu-options'), dialog = $('pp-dialog'), toast = $('pp-toast'), phone = $('pp-phone');
  tray.inert = true;
  const listInner = document.createElement('div');
  listInner.className = 'pp-list-content';
  listEl.appendChild(listInner);

  function renderChips() {
    const m = menu(), cur = viewingId();
    const chip = (id, i, inner, extra) => `<li><button type="button" class="pp-chip${extra || ''}" data-id="${id}" style="--i:${Math.min(i, M.staggerMs.maximumItems - 1)}" aria-current="${id === cur ? 'true' : 'false'}" tabindex="${id === cur ? 0 : -1}">${inner}</button></li>`;
    let i = 0, html = '';
    m.presets.forEach(p => {
      const tags = [];
      if (p.id === DB.today) tags.push('oggi');
      if (p.id === m.onlinePreset) tags.push('<span class="pp-dot" aria-hidden="true"></span>online');
      const sr = (p.id === DB.today ? ', oggi' : '') + (p.id === m.onlinePreset ? ', online' : '') + (p.sections.length ? '' : ', vuoto');
      html += chip(p.id, i++, `<span aria-hidden="true">${esc(p.short)}</span><span class="sr">${esc(p.label + sr)}</span>${tags.length ? `<span class="pp-chip-tag" aria-hidden="true">${tags.join(' · ')}</span>` : ''}`);
    });
    html += '<li class="pp-chip-sep" aria-hidden="true"></li>';
    html += chip('__new', i++, '<span aria-hidden="true">+</span> Nuovo', ' pp-chip--action');
    html += chip('attuale', i++, 'Menu attuale', ' pp-chip--action');
    chipsEl.innerHTML = html;
    measureTray();
  }

  function renderList() {
    const m = menu(), id = viewingId(), secs = contentOf(m, id);
    if (!secs.length) {
      listInner.innerHTML = `<div class="pp-empty"><strong>«${esc(labelOf(m, id))}» è vuoto</strong>Aggiungi piatti con + oppure copia un altro giorno.</div>`;
    } else {
      listInner.innerHTML = secs.map((sec, si) => `<section class="mw-catalog-section"><div class="mw-catalog-category-row"><span class="pp-cat-icon">${ico.bowl}</span><span class="mw-catalog-category-name">${esc(sec.name)}</span><small>${sec.items.length}</small>${ico.rchev}<button type="button" class="mw-edit-gear" aria-label="Modifica categoria ${esc(sec.name)}">${ico.gear}</button></div>` +
        sec.items.map((it, ii) => {
          const key = si + ':' + ii, d = S.draft && S.draft.menuId === m.id && S.draft.presetId === id ? S.draft.prices[key] : undefined;
          return `<div class="mw-catalog-item"><span class="mw-catalog-grip">${ico.grip}</span><span class="mw-catalog-photo">${ico.photo}</span><div class="pp-item-text"><strong>${esc(it.name)}</strong><span class="mw-catalog-description">${esc(it.desc)}</span></div><label class="mw-daily-price"><input inputmode="decimal" data-key="${key}" aria-label="Prezzo ${esc(it.name)}" value="${fmt(d !== undefined ? d : it.price)}"${d !== undefined ? ' class="is-dirty"' : ''}></label></div>`;
        }).join('') + '</section>').join('');
    }
    statusEl.textContent = dirty() ? `Modifiche non salvate a «${labelOf(m, S.draft.presetId)}»` : '';
  }

  function renderPhone() {
    const m = menu(), secs = contentOf(m, 'attuale');
    const src = m.weekly ? `online: ${labelOf(m, m.onlinePreset)}` : 'menu unico';
    phone.innerHTML = `<h4>${esc(m.name)}</h4><div class="ph-sub">${esc(src)}</div>` + (secs.length ? secs.map(s => `<h5>${esc(s.name)}</h5>` + s.items.map(it => `<div class="ph-row"><span>${esc(it.name)}</span><span>€ ${fmt(it.price)}</span></div>`).join('')).join('') : '<div class="ph-sub">Nessun piatto</div>');
  }

  function renderToolbar() {
    const m = menu();
    $('pp-menu-name').textContent = m.name;
    options.innerHTML = DB.menus.map(x => `<button type="button" data-menu="${x.id}" aria-current="${x.id === m.id ? 'true' : 'false'}"><span>${esc(x.name)}</span><small>${x.weekly ? 'settimanale' : 'menu unico'}</small></button>`).join('');
    btn.hidden = !m.weekly;
    setLabel(false);
  }

  function setLabel(animate) {
    const m = menu(), id = viewingId();
    const text = id === 'attuale' ? 'Preset' : labelOf(m, id);
    btn.classList.toggle('is-preset', id !== 'attuale');
    btn.setAttribute('aria-label', 'Preset: ' + labelOf(m, id));
    if (label.textContent === text) return;
    label.textContent = text;
    if (labelAnim) labelAnim.cancel();
    if (animate && !RM.matches) {
      // M01: testo 140ms, blur ≤3px solo durante lo scambio, +40ms
      labelAnim = label.animate([{ opacity: 0, filter: `blur(${M.blurPx.textSwap}px)` }, { opacity: 1, filter: 'blur(0px)' }],
        { duration: dur('micro'), delay: M.recipeDelayMs.textSwap, easing: bez(M.easing.out), fill: 'backwards' });
    }
  }

  /* Cambio contenuto della lista: esce il vecchio (micro), entra il nuovo (micro). Ritargetta dall'opacità corrente. */
  function swapList() {
    const ep = ++listEpoch;
    const from = parseFloat(getComputedStyle(listInner).opacity);
    listInner.getAnimations().forEach(a => a.cancel());
    if (RM.matches) { renderList(); return; }
    // il contenitore .mw-catalog-list resta fermo; esce e rientra solo il contenuto
    const out = listInner.animate([{ opacity: from }, { opacity: 0 }], { duration: dur('micro') * from, easing: bez(M.easing.exit), fill: 'forwards' });
    out.onfinish = () => {
      if (ep !== listEpoch) return;
      renderList();
      listInner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur('micro'), easing: bez(M.easing.out) });
      out.cancel();
    };
  }

  function measureTray() {
    stage.style.setProperty('--tray-h', trayInner.offsetHeight + 'px');
  }
  new ResizeObserver(measureTray).observe(trayInner);

  /* ---------- vassoio ---------- */
  function openTray(focusChip) {
    if (!menu().weekly) return;
    closePicker();
    trayEpoch++;
    chipsEl.querySelectorAll('.is-picked').forEach(c => c.classList.remove('is-picked'));
    chipsEl.querySelectorAll('.pp-chip').forEach(c => (c.tabIndex = c.getAttribute('aria-current') === 'true' ? 0 : -1)); // roving riallineato al corrente
    S.open = true;
    measureTray();
    tray.inert = false;
    stage.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    if (focusChip) (chipsEl.querySelector('[aria-current=true]') || chipsEl.querySelector('.pp-chip')).focus();
  }
  function closeTray(opts) {
    opts = opts || {};
    if (!S.open) return;
    const ep = ++trayEpoch;
    S.open = false;
    const hadFocus = tray.contains(document.activeElement);
    if (opts.picked) {
      const c = chipsEl.querySelector(`[data-id="${opts.picked}"]`);
      if (c) c.classList.add('is-picked'); // resta visibile mentre la lista lo ricopre
    }
    // contenuto prima del collasso solo se il vassoio era fermo aperto; se interrompe un'apertura, inverte subito dal valore corrente
    const lw = stage.querySelector('.pp-list-wrap'), now = new DOMMatrix(getComputedStyle(lw).transform).f;
    const atRest = Math.abs(now - (parseFloat(stage.style.getPropertyValue('--tray-h')) + 12)) < 1;
    stage.style.setProperty('--collapse-delay', atRest ? 'var(--content-delay)' : '0ms');
    stage.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    if (hadFocus || opts.returnFocus) btn.focus();
    tray.inert = true;
    const settle = M.recipeDelayMs.contentAfterSurface + M.durationMs.surface;
    setTimeout(() => { if (ep === trayEpoch && !S.open) chipsEl.querySelectorAll('.is-picked').forEach(c => c.classList.remove('is-picked')); }, RM.matches ? 0 : settle);
  }

  function pick(id) {
    const m = menu();
    if (id === '__new') {
      newCount++;
      const p = { id: 'nuovo' + newCount, short: 'Nuovo preset' + (newCount > 1 ? ' ' + newCount : ''), sections: JSON.parse(JSON.stringify(contentOf(m, 'attuale'))) };
      p.label = p.short;
      m.presets.push(p);
      id = p.id;
      renderChips();
      showToast(`Creato «${p.label}» come copia del menu attuale`);
    }
    const changed = id !== viewingId();
    S.viewing[S.menuId] = id;
    chipsEl.querySelectorAll('.pp-chip').forEach(c => { const on = c.dataset.id === id; c.setAttribute('aria-current', on ? 'true' : 'false'); c.tabIndex = on ? 0 : -1; });
    closeTray({ picked: id, returnFocus: true });
    if (changed) { setLabel(true); swapList(); }
  }

  function requestPick(id) {
    if (id !== '__new' && id === viewingId()) { closeTray({ picked: id, returnFocus: true }); return; }
    guard(() => pick(id), document.activeElement);
  }

  /* ---------- selettore menu ---------- */
  function openPicker() { if (S.open) closeTray(); S.pickerOpen = true; options.classList.add('open'); picker.setAttribute('aria-expanded', 'true'); }
  function closePicker(returnFocus) { if (!S.pickerOpen) return; S.pickerOpen = false; options.classList.remove('open'); picker.setAttribute('aria-expanded', 'false'); if (returnFocus) picker.focus(); }
  function switchMenu(id) {
    closePicker(true);
    if (id === S.menuId) return;
    guard(() => {
      S.menuId = id;
      renderToolbar(); renderChips(); renderPhone(); swapList();
      if (!btn.hidden && !RM.matches) btn.animate([{ opacity: 0, transform: `scale(${M.scale.enter})` }, { opacity: 1, transform: 'none' }], { duration: dur('micro'), easing: bez(M.easing.out) });
    }, picker);
  }

  /* ---------- «Salva o scarta» ---------- */
  let pendingAction = null, returnTo = null, saving = false, dlgEpoch = 0;
  function guard(action, from) {
    if (!dirty()) { action(); return; }
    pendingAction = action; returnTo = from;
    const m = DB.menus.find(x => x.id === S.draft.menuId);
    $('pp-dlg-title').textContent = `Salvare le modifiche a «${labelOf(m, S.draft.presetId)}»?`;
    const n = Object.keys(S.draft.prices).length;
    $('pp-dlg-text').textContent = `Hai cambiato ${n === 1 ? '1 prezzo' : n + ' prezzi'}. Se scarti, torna la versione salvata.`;
    $('pp-dlg-error').textContent = '';
    openDialog();
  }
  function openDialog() {
    dlgEpoch++;
    dialog.getAnimations().forEach(a => a.cancel());
    if (!dialog.open) dialog.showModal();
    $('pp-dlg-save').focus();
    if (RM.matches) return;
    // M06: contenitore surface, poi contenuto (+60ms)
    dialog.animate([{ opacity: 0, transform: `translateY(${M.distancePx.panel}px) scale(${M.scale.enter})` }, { opacity: 1, transform: 'none' }], { duration: dur('surface'), easing: bez(M.easing.out) });
    dialog.querySelector('.pp-dialog-body').animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur('micro'), delay: M.recipeDelayMs.contentAfterSurface, easing: bez(M.easing.out), fill: 'backwards' });
  }
  function closeDialog(then) {
    const ep = ++dlgEpoch;
    const done = () => { if (ep !== dlgEpoch) return; dialog.close(); dialog.getAnimations().forEach(a => a.cancel()); if (then) then(); };
    if (RM.matches) { done(); return; }
    // uscita: prima il contenuto (micro), poi la superficie (exit)
    dialog.querySelector('.pp-dialog-body').animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur('micro'), easing: bez(M.easing.exit), fill: 'forwards' });
    const a = dialog.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `scale(${M.scale.enter})` }], { duration: dur('exit'), delay: M.recipeDelayMs.contentAfterSurface, easing: bez(M.easing.exit), fill: 'forwards' });
    a.onfinish = done;
  }
  function fakeSave() { // backend simulato: latenza di rete finta, non è un tempo di animazione
    return new Promise((res, rej) => setTimeout(() => (saveFailsLeft-- > 0 ? rej(new Error('Connessione assente: le modifiche sono ancora qui. Riprova.')) : res()), 700));
  }
  $('pp-dlg-save').addEventListener('click', async () => {
    if (saving) return;
    saving = true;
    const b = $('pp-dlg-save');
    b.setAttribute('aria-busy', 'true'); b.innerHTML = '<span class="pp-spin" aria-hidden="true"></span>Salvo…';
    $('pp-dlg-error').textContent = '';
    try {
      await fakeSave();
      const m = DB.menus.find(x => x.id === S.draft.menuId), secs = contentOf(m, S.draft.presetId);
      Object.entries(S.draft.prices).forEach(([k, v]) => { const [si, ii] = k.split(':').map(Number); secs[si].items[ii].price = v; });
      const name = labelOf(m, S.draft.presetId);
      S.draft = null;
      renderPhone();
      closeDialog(() => { showToast(`Salvato «${name}»`); const a = pendingAction; pendingAction = null; a && a(); });
    } catch (e) {
      $('pp-dlg-error').textContent = e.message; // dati conservati, azione ripristinata
    } finally {
      saving = false; b.removeAttribute('aria-busy'); b.textContent = 'Salva';
    }
  });
  $('pp-dlg-discard').addEventListener('click', () => { if (saving) return; S.draft = null; renderList(); closeDialog(() => { const a = pendingAction; pendingAction = null; a && a(); }); });
  $('pp-dlg-cancel').addEventListener('click', () => { if (saving) return; pendingAction = null; closeDialog(() => returnTo && returnTo.focus && returnTo.focus()); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); if (!saving) $('pp-dlg-cancel').click(); });

  let toastT = 0;
  function showToast(t) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2200); }

  /* ---------- eventi ---------- */
  btn.addEventListener('click', e => { if (S.open) closeTray(); else openTray(e.detail === 0); });
  btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' && !S.open) { e.preventDefault(); openTray(true); } });
  chipsEl.addEventListener('click', e => { const c = e.target.closest('.pp-chip'); if (c && S.open) requestPick(c.dataset.id); });
  chipsEl.addEventListener('keydown', e => {
    const all = [...chipsEl.querySelectorAll('.pp-chip')], i = all.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % all.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + all.length) % all.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = all.length - 1;
    if (j === null) return;
    e.preventDefault();
    all.forEach((c, k) => (c.tabIndex = k === j ? 0 : -1));
    all[j].focus();
  });
  tray.addEventListener('focusout', e => {
    const t = e.relatedTarget;
    if (S.open && t && !tray.contains(t) && t !== btn && !dialog.contains(t)) closeTray();
  });
  picker.addEventListener('click', () => (S.pickerOpen ? closePicker() : openPicker()));
  options.addEventListener('click', e => { const b = e.target.closest('[data-menu]'); if (b) switchMenu(b.dataset.menu); });
  document.addEventListener('pointerdown', e => {
    if (dialog.open) return;
    if (S.open && !tray.contains(e.target) && !btn.contains(e.target)) closeTray();
    if (S.pickerOpen && !pickerHost.contains(e.target)) closePicker();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || dialog.open) return;
    if (S.open) { e.preventDefault(); closeTray({ returnFocus: true }); } else if (S.pickerOpen) closePicker(true);
  });
  listEl.addEventListener('input', e => {
    const inp = e.target.closest('input[data-key]');
    if (!inp) return;
    const v = parseFloat(inp.value.replace(',', '.'));
    if (!isFinite(v) || v <= 0) return;
    if (!S.draft || S.draft.menuId !== S.menuId || S.draft.presetId !== viewingId()) S.draft = { menuId: S.menuId, presetId: viewingId(), prices: {} };
    S.draft.prices[inp.dataset.key] = v;
    inp.classList.add('is-dirty');
    statusEl.textContent = `Modifiche non salvate a «${labelOf(menu(), viewingId())}»`;
  });

  renderToolbar(); renderChips(); renderList(); renderPhone();
  window.__pp = { S, DB, openTray, closeTray, pick: requestPick }; // solo per il verificatore headless
})();
