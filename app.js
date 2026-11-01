(function () {
  var btn = document.getElementById('tocBtn'), toc = document.getElementById('toc'),
      scrim = document.getElementById('scrim'), close = document.getElementById('tocClose');
  function setOpen(o) {
    document.body.classList.toggle('toc-open', o);
    btn.setAttribute('aria-expanded', o ? 'true' : 'false');
    scrim.hidden = !o;
  }
  btn.addEventListener('click', function () { setOpen(!document.body.classList.contains('toc-open')); });
  close.addEventListener('click', function () { setOpen(false); });
  scrim.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  toc.addEventListener('click', function (e) {
    if (e.target.closest('a') && window.matchMedia('(max-width: 1099px)').matches) setOpen(false);
  });
  // scroll-spy
  var links = {}, items = toc.querySelectorAll('li[data-id]');
  items.forEach(function (li) { links[li.getAttribute('data-id')] = li; });
  var heads = document.querySelectorAll('.content h2[id], .content h3[id]'), current = null;
  function spy() {
    var y = 90, found = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top - y <= 0) found = heads[i]; else break;
    }
    var id = found ? found.id : null;
    if (id === current) return; current = id;
    items.forEach(function (li) { li.classList.remove('active'); });
    if (id && links[id]) {
      var li = links[id]; li.classList.add('active');
      var top = li.closest('li.l2'); if (top) { top.classList.add('active'); var d = top.querySelector('details'); if (d && window.matchMedia('(min-width: 1100px)').matches) d.open = true; }
    }
    document.body.classList.toggle('scrolled', window.scrollY > 400);
  }
  var ticking = false;
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; spy(); }); } }, { passive: true });
  spy();
  // table scroll hints
  function hint() {
    document.querySelectorAll('.table-wrap').forEach(function (w) {
      w.classList.toggle('scrollable', w.scrollWidth > w.clientWidth + 2);
    });
  }
  window.addEventListener('resize', hint); hint();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(hint);
})();

// ---------- document search (client-side, Persian-aware) ----------
(function () {
  var btn = document.getElementById('searchBtn'), panel = document.getElementById('searchPanel'),
      input = document.getElementById('searchInput'), countEl = document.getElementById('searchCount'),
      list = document.getElementById('searchResults'), prev = document.getElementById('searchPrev'),
      next = document.getElementById('searchNext'), closeB = document.getElementById('searchClose'),
      content = document.getElementById('content');
  if (!btn || !content) return;
  var SEL = 'h2,h3,h4,p,li,th,td,blockquote';
  var DROP = /[\u064B-\u065F\u0670\u0640\u200B\u200D-\u200F\u061C\u2066-\u2069\u202A-\u202E\uFEFF]/;
  var MAP = { '\u064A': 'ی', '\u0649': 'ی', '\u06CC': 'ی', '\u0643': 'ک', '\u06A9': 'ک', '\u0629': 'ه', '\u06C0': 'ه',
    '\u0623': 'ا', '\u0625': 'ا', '\u0671': 'ا', '\u0624': 'و', '\u0626': 'ی', '\u066B': '.', '\u066C': ',', '\u060C': ',', '\u00A0': ' ', '\u200C': ' ' };  // ZWNJ ≡ space, so «پیش تنظیم» finds «پیش‌تنظیم»
  function nch(c) {
    if (DROP.test(c)) return '';
    var k = c.charCodeAt(0);
    if (k >= 0x06F0 && k <= 0x06F9) return String(k - 0x06F0);
    if (k >= 0x0660 && k <= 0x0669) return String(k - 0x0660);
    if (MAP[c]) return MAP[c];
    if (/\s/.test(c)) return ' ';
    return c.toLowerCase();
  }
  function norm(s) { var o = ''; for (var i = 0; i < s.length; i++) o += nch(s[i]); return o.replace(/ +/g, ' '); }
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); };
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Build index: each block -> its own text nodes, normalized text, map norm idx -> [node, offset]
  function buildIndex() {
    var blocks = [], h2 = '', h3 = '';
    content.querySelectorAll(SEL).forEach(function (el) {
      if (el.closest('ol.doc-toc')) return;
      if (el.tagName === 'H2') { h2 = el.textContent.replace('#', '').trim(); h3 = ''; }
      else if (el.tagName === 'H3') h3 = el.textContent.replace('#', '').trim();
      var nodes = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        var p = n.parentElement; return (p.closest(SEL) === el && !p.closest('.anchor')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
      var n, orig = '', nt = '', mapN = [], mapO = [], lastSpace = true;
      while ((n = tw.nextNode())) {
        var s = n.nodeValue;
        for (var i = 0; i < s.length; i++) {
          var c = nch(s[i]);
          if (c === ' ') { if (lastSpace) continue; lastSpace = true; } else if (c) lastSpace = false;
          for (var j = 0; j < c.length; j++) { nt += c[j]; mapN.push([n, i]); mapO.push(orig.length + i); }
        }
        nodes.push(n); orig += s;
      }
      if (!nt.trim()) return;
      var title = el.tagName === 'H2' ? h2 : (h3 && el.tagName !== 'H2' ? h2.split(' ').slice(0, 1).join(' ') + ' › ' + h3 : h2);
      blocks.push({ el: el, nt: nt, orig: orig, mapN: mapN, mapO: mapO, title: title || 'مقدمه' });
    });
    return blocks;
  }
  function clearMarks() {
    content.querySelectorAll('mark.sr-hit').forEach(function (m) {
      var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize();
    });
  }
  var matches = [], cur = -1, MAXHL = 1500;
  function run() {
    clearMarks(); matches = []; cur = -1; list.innerHTML = '';
    var q = norm(input.value).trim();
    if (!q || (q.length < 2 && !/\d/.test(q))) { list.hidden = true; update(); return; }
    var blocks = buildIndex(), hitsByBlock = [];
    blocks.forEach(function (b) {
      var from = 0, k, hits = [];
      while ((k = b.nt.indexOf(q, from)) !== -1) { hits.push([k, k + q.length]); from = k + q.length; }
      if (hits.length) hitsByBlock.push({ b: b, hits: hits });
    });
    // highlight in page (reverse order per block keeps earlier node offsets valid)
    var total = 0;
    hitsByBlock.forEach(function (h) { h.first = total; total += h.hits.length; });
    hitsByBlock.forEach(function (h) {
      if (h.first >= MAXHL) return;
      for (var x = h.hits.length - 1; x >= 0; x--) {
        var mi = h.first + x; if (mi >= MAXHL) continue;
        var a = h.hits[x][0], e = h.hits[x][1] - 1, segs = [], m = h.b.mapN;
        // group consecutive positions by node
        for (var p = a; p <= e; p++) {
          var nd = m[p][0], off = m[p][1], last = segs[segs.length - 1];
          if (last && last.n === nd) last.e = off + 1; else segs.push({ n: nd, s: off, e: off + 1 });
        }
        for (var y = segs.length - 1; y >= 0; y--) {
          var sg = segs[y], r = document.createRange();
          try { r.setStart(sg.n, sg.s); r.setEnd(sg.n, sg.e);
            var mk = document.createElement('mark'); mk.className = 'sr-hit'; mk.dataset.m = mi; r.surroundContents(mk); } catch (err) {}
        }
      }
    });
    matches = []; content.querySelectorAll('mark.sr-hit').forEach(function (mk) { var i = +mk.dataset.m; (matches[i] = matches[i] || []).push(mk); });
    matches = matches.filter(Boolean);
    // results list
    var html = '', shown = 0;
    hitsByBlock.forEach(function (h) {
      if (shown >= 80) return; shown++;
      var b = h.b, os = b.mapO[h.hits[0][0]], oe = b.mapO[h.hits[0][1] - 1] + 1;
      var s0 = Math.max(0, os - 45), s1 = Math.min(b.orig.length, oe + 70);
      var snip = (s0 > 0 ? '…' : '') + esc(b.orig.slice(s0, os)) + '<mark>' + esc(b.orig.slice(os, oe)) + '</mark>' + esc(b.orig.slice(oe, s1)) + (s1 < b.orig.length ? '…' : '');
      html += '<li><button type="button" data-m="' + h.first + '"><span class="sr-title">' + esc(b.title) +
        (h.hits.length > 1 ? ' <span class="sr-n">(' + fa(h.hits.length) + ')</span>' : '') + '</span><span class="sr-snip">' + snip + '</span></button></li>';
    });
    if (!hitsByBlock.length) html = '<li class="sr-empty">نتیجه‌ای پیدا نشد.</li>';
    else if (hitsByBlock.length > shown) html += '<li class="sr-empty">و ' + fa(hitsByBlock.length - shown) + ' بخش دیگر؛ با ▼ ادامه دهید.</li>';
    list.innerHTML = html; list.hidden = false; list.scrollTop = 0;
    update(total);
  }
  var totalAll = 0;
  function update(total) {
    if (total !== undefined) totalAll = total;
    var n = matches.length;
    countEl.textContent = !input.value.trim() ? '' : (n ? (cur >= 0 ? fa(cur + 1) + ' از ' : '') + fa(totalAll) : '۰');
    prev.disabled = next.disabled = !n;
  }
  function go(i) {
    if (!matches.length) return;
    if (cur >= 0 && matches[cur]) matches[cur].forEach(function (m) { m.classList.remove('cur'); });
    cur = (i + matches.length) % matches.length;
    matches[cur].forEach(function (m) { m.classList.add('cur'); });
    var el = matches[cur][0], head = document.querySelector('.site-head');
    var wrap = el.closest('.table-wrap');
    if (wrap) { var r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      wrap.scrollLeft += (r.left + r.width / 2) - (w.left + w.width / 2); wrap.scrollTop += (r.top + r.height / 2) - (w.top + w.height / 2); }
    var rr = el.getBoundingClientRect(), offset = head.getBoundingClientRect().bottom;
    window.scrollTo({ top: window.scrollY + rr.top - offset - (window.innerHeight - offset) / 3, behavior: 'smooth' });
    update();
  }
  function open() {
    document.body.classList.add('search-open'); panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
    if (document.body.classList.contains('toc-open')) document.getElementById('tocClose').click();
    input.focus(); input.select(); if (input.value.trim()) list.hidden = false;
  }
  function close() {
    document.body.classList.remove('search-open'); panel.hidden = true; btn.setAttribute('aria-expanded', 'false');
    clearMarks(); matches = []; cur = -1; input.value = ''; list.innerHTML = ''; list.hidden = true; update(0);
  }
  var t;
  btn.addEventListener('click', function () { panel.hidden ? open() : close(); });
  closeB.addEventListener('click', close);
  input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 160); });
  input.addEventListener('focus', function () { if (input.value.trim() && list.innerHTML) list.hidden = false; });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); if (!matches.length && input.value.trim()) run(); list.hidden = true; go(e.shiftKey ? cur - 1 : cur + 1); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); }
  });
  next.addEventListener('click', function () { list.hidden = true; go(cur + 1); });
  prev.addEventListener('click', function () { list.hidden = true; go(cur < 0 ? -1 : cur - 1); });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-m]'); if (!b) return;
    list.hidden = true; input.blur(); go(+b.dataset.m);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) close();
    else if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && panel.hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
  });
  document.addEventListener('click', function (e) { if (!panel.hidden && !e.target.closest('.site-head')) list.hidden = true; });
})();
