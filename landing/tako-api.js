/* tako-api.js — client minimale per il control-plane cloud Tako (api.tako.app).
   Caricato come <script> NORMALE (non modulo ES, non type=text/babel): deve essere
   disponibile su window.TakoAPI PRIMA che i componenti .jsx (Babel) lo usino.
   Coerente col pattern globale del sito: tutto appeso a window.

   Espone:
     TakoAPI.API_BASE            → base URL del backend cloud
     TakoAPI.apiPost(path, body) → POST JSON con credentials:'include'
     TakoAPI.apiGet(path)        → GET JSON con credentials:'include'
     TakoAPI.oauthUrl(provider)  → URL assoluto per "Continua con Google/GitHub"

   Tutte le chiamate ritornano un envelope uniforme:
     { ok: boolean, status: number, data: any, error: string|null, code: string|null }
   così i componenti non devono mai gestire try/catch né forme di risposta diverse.
*/
(function () {
  'use strict';

  /* ─────────── Risoluzione API_BASE ───────────
     Priorità:
       1. window.__TAKO_API__  → override esplicito (staging / locale / preview)
       2. hostname di produzione (tako.app / www.tako.app) → https://api.tako.app
       3. fallback configurabile (staging) — modificabile qui o via __TAKO_API__
     Il fallback evita di puntare ciecamente a localhost quando si apre il sito
     da un dominio sconosciuto (es. *.pages.dev): in quel caso si usa lo staging.
  */
  function resolveApiBase() {
    if (typeof window !== 'undefined' && window.__TAKO_API__) {
      return String(window.__TAKO_API__).replace(/\/+$/, '');
    }
    var host = (typeof location !== 'undefined' && location.hostname) || '';
    if (host === 'takoitalia.com' || host === 'www.takoitalia.com') {
      return 'https://api.takoitalia.com';
    }
    // Sviluppo locale: backend in modo cloud su 3001.
    if (host === 'localhost' || host === '127.0.0.1' || host === 'tako.local') {
      return 'http://localhost:3001';
    }
    // Fallback (preview Cloudflare Pages *.pages.dev, domini sconosciuti):
    // punta comunque all'API di produzione. Sovrascrivibile con window.__TAKO_API__.
    return 'https://api.takoitalia.com';
  }

  var API_BASE = resolveApiBase();

  /* ─────────── CSRF (preparazione, no-op in same-site) ───────────
     Il backend in COOKIE_MODE=crosssite imposta un cookie NON-HttpOnly
     `tako_cloud_csrf` (double-submit): se presente lo rispediamo come header
     X-Tako-CSRF sui metodi mutanti. In same-site il cookie non esiste → no-op.
  */
  function readCookie(name) {
    if (typeof document === 'undefined' || !document.cookie) return null;
    var parts = document.cookie.split(';');
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c.indexOf(name + '=') === 0) {
        return decodeURIComponent(c.substring(name.length + 1));
      }
    }
    return null;
  }

  function csrfHeaders() {
    var token = readCookie('tako_cloud_csrf');
    return token ? { 'X-Tako-CSRF': token } : {};
  }

  /* ─────────── Normalizzazione errori ───────────
     Il backend usa l'envelope { error: { code, message } } (vedi contratto).
     Qui lo appiattiamo in { error, code } stringa per la UI. */
  function extractError(payload, status) {
    if (payload && payload.error) {
      if (typeof payload.error === 'object') {
        return {
          message: payload.error.message || 'Errore imprevisto.',
          code: payload.error.code || null,
        };
      }
      return { message: String(payload.error), code: payload.code || null };
    }
    return { message: 'Errore del server (' + status + ').', code: null };
  }

  function request(method, path, body) {
    var url = path.charAt(0) === '/' ? API_BASE + path : path;
    var opts = {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    };
    if (body !== undefined && body !== null) {
      opts.body = JSON.stringify(body);
    }
    if (method !== 'GET' && method !== 'HEAD') {
      Object.assign(opts.headers, csrfHeaders());
    }

    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var payload = null;
        if (text) {
          try { payload = JSON.parse(text); } catch (e) { payload = null; }
        }
        if (res.ok) {
          // Il backend incapsula in { data: ... }; espongo data sia grezzo che annidato.
          var data = (payload && Object.prototype.hasOwnProperty.call(payload, 'data'))
            ? payload.data
            : payload;
          return { ok: true, status: res.status, data: data, error: null, code: null };
        }
        var err = extractError(payload, res.status);
        return { ok: false, status: res.status, data: null, error: err.message, code: err.code };
      });
    }).catch(function () {
      // Errore di rete / CORS / backend irraggiungibile.
      return {
        ok: false,
        status: 0,
        data: null,
        error: 'Impossibile contattare il server. Controlla la connessione e riprova.',
        code: 'NETWORK',
      };
    });
  }

  window.TakoAPI = {
    API_BASE: API_BASE,
    apiPost: function (path, body) { return request('POST', path, body); },
    apiGet: function (path) { return request('GET', path); },
    oauthUrl: function (provider) { return API_BASE + '/api/auth/' + provider; },
  };
})();
