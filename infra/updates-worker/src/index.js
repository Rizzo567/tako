// tako-updates — serve gli update Tauri dall'ultima GitHub Release di un repo privato.
//
//   GET /latest.json   → asset "latest.json" dell'ultima release (streamato, content-type JSON)
//   GET /<file>        → 302 verso l'URL firmato GitHub dell'asset (i binari NON passano dal Worker)
//
// Il token GitHub resta nel Worker: il client riceve solo URL firmati a scadenza.

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405 })
    }
    const name = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''))
    if (!name || name.includes('/') || name.includes('..')) {
      return new Response('not found', { status: 404 })
    }

    const ghHeaders = {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'tako-updates-worker',
      'x-github-api-version': '2022-11-28',
    }

    const relRes = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/releases/latest`,
      { headers: ghHeaders },
    )
    if (!relRes.ok) {
      return new Response(`release lookup failed (${relRes.status})`, { status: 502 })
    }
    const release = await relRes.json()
    const asset = (release.assets || []).find((a) => a.name === name)
    if (!asset) return new Response('not found', { status: 404 })

    const binHeaders = { ...ghHeaders, accept: 'application/octet-stream' }

    if (name.endsWith('.json')) {
      // Piccolo: passa dal Worker così il content-type resta JSON.
      const res = await fetch(asset.url, { headers: binHeaders })
      if (!res.ok) return new Response('asset fetch failed', { status: 502 })
      return new Response(res.body, {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      })
    }

    // Binari grossi: non seguiamo il redirect, giriamo al client l'URL firmato.
    const res = await fetch(asset.url, { redirect: 'manual', headers: binHeaders })
    const loc = res.headers.get('location')
    if (loc) return Response.redirect(loc, 302)
    if (!res.ok) return new Response('asset fetch failed', { status: 502 })
    return new Response(res.body, {
      headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' },
    })
  },
}
