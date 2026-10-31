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
