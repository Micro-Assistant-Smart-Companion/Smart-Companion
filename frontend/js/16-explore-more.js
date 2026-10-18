// [16/19] links and images under an answer
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// ---- EXPLORE MORE: links + images under the answer ----
// Paste at the bottom of app.js. Called from sendMessage (see step 3 in the guide).

function isSafeUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }

async function attachResources(goal, bubble) {
  if (!goal || !goal.trim()) return;
  try {
    const res = await fetch(`${API}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: goal }),
    });
    if (!res.ok) return;                       // silent: resources are a bonus, never an error
    const data = await res.json();
    const links = (data.links || []).filter(l => isSafeUrl(l.url));
    const images = (data.images || []).filter(i => isSafeUrl(i.src));
    if (!links.length && !images.length) return;

    const card = document.createElement('div');
    card.className = 'explore-card';

    const head = document.createElement('div');
    head.className = 'explore-head';
    head.textContent = 'EXPLORE MORE';
    card.appendChild(head);

    if (images.length) {
      const strip = document.createElement('div');
      strip.className = 'explore-images';
      images.forEach(img => {
        const a = document.createElement('a');
        a.href = isSafeUrl(img.link) ? img.link : img.src;
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.title = img.caption || '';
        const el = document.createElement('img');
        el.src = img.src; el.alt = img.caption || 'related image';
        el.loading = 'lazy'; el.referrerPolicy = 'no-referrer';
        el.onerror = () => a.remove();          // hide broken images
        a.appendChild(el);
        strip.appendChild(a);
      });
      card.appendChild(strip);
    }

    links.forEach(l => {
      const a = document.createElement('a');
      a.className = 'explore-link';
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const t = document.createElement('div');
      t.className = 'explore-link-title'; t.textContent = l.title || l.url;
      const s = document.createElement('div');
      s.className = 'explore-link-snippet';
      let host = ''; try { host = new URL(l.url).hostname.replace('www.', ''); } catch (e) {}
      s.textContent = (host ? host + ' - ' : '') + (l.snippet || '');
      a.appendChild(t); a.appendChild(s);
      card.appendChild(a);
    });

    (bubble || feedEl).appendChild(card);
    scrollToBottom();
    snapshotCurrentSession();   // saves the card too, so it survives switching chats or reloading
  } catch (e) {
    console.warn('resources skipped:', e);
  }
}
