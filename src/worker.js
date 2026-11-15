// Worker: فقط /api/* را اجرا می‌کند. بقیه مسیرها مستقیم از public/ سرو می‌شوند.
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
const ID = /^[\w-]{1,64}$/;

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (!u.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!(await auth(req, env))) return J({ error: 'unauthorized' }, 401);
    try { return await route(req, env, u); }
    catch (e) { return J({ error: String((e && e.message) || e) }, 500); }
  },
};

async function route(req, env, u) {
  const s = u.pathname.split('/').filter(Boolean); // api books :id sub ...
  const m = req.method, id = s[2], sub = s[3], now = Date.now();
  if (s[1] !== 'books') return J({ error: 'not found' }, 404);
  if (!id) {
    if (m !== 'GET') return J({ error: 'method' }, 405);
    const r = await env.DB.prepare('SELECT id,name,size,added,deleted FROM books WHERE ready=1 OR deleted=1').all();
    return J(r.results);
  }
  if (!ID.test(id)) return J({ error: 'bad id' }, 400);
  const key = 'b/' + id;

  if (!sub && m === 'DELETE') {
    await env.BOOKS.delete(key);
    await env.DB.batch([
      env.DB.prepare('UPDATE books SET deleted=1,ready=0,updated=? WHERE id=?').bind(now, id),
      env.DB.prepare('DELETE FROM ink WHERE book=?').bind(id),
      env.DB.prepare('DELETE FROM meta WHERE book=?').bind(id),
    ]);
    return J({ ok: 1 });
  }

  if (sub === 'file' && m === 'GET') {
    const o = await env.BOOKS.get(key);
    if (!o) return J({ error: 'no file' }, 404);
    return new Response(o.body, { headers: { 'content-type': 'application/pdf', 'content-length': String(o.size), etag: o.httpEtag } });
  }

  if (sub === 'ink' && m === 'GET') {
    const since = +u.searchParams.get('since') || 0;
    const rows = await env.DB.prepare('SELECT page,data FROM ink WHERE book=? AND updated>?').bind(id, since).all();
    const mt = await env.DB.prepare('SELECT pages,updated FROM meta WHERE book=? AND updated>?').bind(id, since).first();
    const pages = {};
    for (const r of rows.results) pages[r.page] = JSON.parse(r.data);
    return J({ now, pages, meta: mt ? { pages: JSON.parse(mt.pages), updated: mt.updated } : null });
  }

  if (sub === 'ink' && m === 'PUT') {
    const b = await req.json(), st = [];
    for (const [p, d] of Object.entries(b.pages || {})) {
      if (!ID.test(p)) continue;
      st.push(d
        ? env.DB.prepare('INSERT INTO ink(book,page,data,updated) VALUES(?,?,?,?) ON CONFLICT(book,page) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(id, p, JSON.stringify(d), now)
        : env.DB.prepare('DELETE FROM ink WHERE book=? AND page=?').bind(id, p));
    }
    if (b.meta && Array.isArray(b.meta.pages))
      st.push(env.DB.prepare('INSERT INTO meta(book,pages,updated) VALUES(?,?,?) ON CONFLICT(book) DO UPDATE SET pages=excluded.pages,updated=excluded.updated').bind(id, JSON.stringify(b.meta.pages), now));
    if (st.length > 45) return J({ error: 'too many pages in one request' }, 400);
    if (st.length) await env.DB.batch(st);
    return J({ now });
  }

  if (sub === 'upload') {
    // آپلود چندبخشی تا محدودیت ۱۰۰ مگ درخواست مشکل ایجاد نکند
    if (m === 'POST' && s[4] === 'start') {
      const b = await req.json();
      const mp = await env.BOOKS.createMultipartUpload(key);
      await env.DB.prepare('INSERT INTO books(id,name,size,added,deleted,ready,updated) VALUES(?,?,?,?,0,0,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,size=excluded.size,deleted=0,ready=0,updated=excluded.updated')
        .bind(id, String(b.name || 'book.pdf').slice(0, 200), +b.size || 0, +b.added || now, now).run();
      return J({ uploadId: mp.uploadId });
    }
    if (m === 'PUT' && s[4] && s[5]) {
      const mp = env.BOOKS.resumeMultipartUpload(key, s[4]);
      return J(await mp.uploadPart(+s[5], await req.arrayBuffer()));
    }
    if (m === 'POST' && s[4] && s[5] === 'complete') {
      const { parts } = await req.json();
      await env.BOOKS.resumeMultipartUpload(key, s[4]).complete(parts);
      await env.DB.prepare('UPDATE books SET ready=1,updated=? WHERE id=?').bind(now, id).run();
      return J({ ok: 1 });
    }
  }
  return J({ error: 'not found' }, 404);
}

/* ---- احراز هویت: JWT کلودفلر اکسس را بررسی می‌کند ---- */
let JWKS, JT = 0;
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function keys(team) {
  if (!JWKS || Date.now() - JT > 36e5) {
    JWKS = (await (await fetch(`https://${team}/cdn-cgi/access/certs`)).json()).keys;
    JT = Date.now();
  }
  return JWKS;
}
async function auth(req, env) {
  if (env.ALLOW_INSECURE === '1') return true; // فقط برای تست محلی (.dev.vars)
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return false; // تنظیم نشده = بسته
  const t = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!t) return false;
  try {
    const [h, p, sg] = t.split('.');
    const hd = JSON.parse(new TextDecoder().decode(b64(h))), pl = JSON.parse(new TextDecoder().decode(b64(p)));
    const jwk = (await keys(env.ACCESS_TEAM)).find((k) => k.kid === hd.kid);
    if (!jwk) return false;
    const k = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, b64(sg), new TextEncoder().encode(h + '.' + p));
    return ok && [].concat(pl.aud).includes(env.ACCESS_AUD) && pl.exp * 1000 > Date.now() && pl.iss === `https://${env.ACCESS_TEAM}`;
  } catch { return false; }
}
