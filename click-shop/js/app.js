(() => {
'use strict';
document.documentElement.classList.add('js');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const S = window.SHOP, PR = window.PRODUCTS, COLS = window.COLLECTIONS;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const money = n => n.toLocaleString('ru-RU') + ' ' + S.currency;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = id => PR.find(p => p.id === id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
const ico = (n, cls = '') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;

/* ---------------- state ---------------- */
let cart = store.get('cm_cart', {});
let favs = new Set(store.get('cm_favs', []));
Object.keys(cart).forEach(id => { if (!byId(id)) delete cart[id]; });
const F = { col: 'all', color: 'all', sort: 'pop', q: '', fav: false };

const COLOR_HEX = { 'прозрачный': '#e9f1f4', 'золотой': '#e2bf6c', 'белый': '#ffffff', 'розовый': '#f08bb0', 'красный': '#d23a45', 'фиолетовый': '#8e6bd8', 'синий': '#2754c5', 'голубой': '#6cc3e8', 'зелёный': '#4fc26b', 'жёлтый': '#f6e03b', 'чёрный': '#1c1c22', 'разноцветный': 'conic-gradient(#f08bb0,#f6e03b,#4fc26b,#6cc3e8,#8e6bd8,#f08bb0)' };

/* ---------------- toasts ---------------- */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = ico('check') + esc(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

/* ---------------- cards ---------------- */
function badgeHTML(p) {
  if (!p.badge) return '';
  const c = p.badge === 'Новинка' ? 'b-new' : (p.badge === 'Хит' || p.badge === 'Бестселлер') ? 'b-hit' : '';
  return `<span class="badge ${c}">${esc(p.badge)}</span>`;
}
function cardHTML(p, i = 0) {
  const on = favs.has(p.id);
  return `<article class="card pop" data-id="${p.id}" style="animation-delay:${Math.min(i, 14) * 40}ms">
    <div class="card-img ${p.col === 'system' ? 'sys' : ''}" data-open>
      ${badgeHTML(p)}
      <img src="${p.img}" alt="${esc(p.name)}" loading="lazy" width="320" height="300">
      <button class="fav ${on ? 'on' : ''}" data-fav aria-label="В избранное" aria-pressed="${on}">${ico('heart')}</button>
    </div>
    <div class="card-body">
      <h3 class="card-name" data-open>${esc(p.name)}</h3>
      <div class="card-meta">${esc(p.collection)} · ${esc(p.code)}</div>
      <div class="card-foot">
        <div class="price">${money(p.price)}<small>/ ${p.unit}</small></div>
        <button class="add" data-add>${ico('bag')}<span>В корзину</span></button>
      </div>
    </div>
    <i class="glare"></i>
  </article>`;
}
function bindGrid(el) {
  el.addEventListener('click', e => {
    const card = e.target.closest('.card'); if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('[data-fav]')) { toggleFav(id, e.target.closest('[data-fav]')); return; }
    if (e.target.closest('[data-add]')) { addToCart(id, 1, $('.card-img img', card), e.target.closest('[data-add]')); return; }
    if (e.target.closest('[data-open]')) openQV(id);
  });
  el.addEventListener('animationend', e => { if (e.animationName === 'cardIn') e.target.classList.remove('pop'); });
}

/* ---------------- collections ---------------- */
function renderCols() {
  $('#cols').innerHTML = COLS.map(c => `
    <a class="col" href="#catalog" data-filter="${c.id}">
      <div class="ring"><img src="${c.cover}" alt="" loading="lazy"></div>
      <div class="txt"><b>${c.name}</b><span>${c.sub}</span></div>${ico('arrow', 'arr')}<i class="glare"></i>
    </a>`).join('');
}

/* ---------------- new grid ---------------- */
function renderNew() {
  const ids = ['instrument', 'B3Y', 'RCZ204Y', 'DS02Y', 'BT04Y', 'RD25Y'];
  $('#newGrid').innerHTML = ids.map((id, i) => cardHTML(byId(id), i)).join('');
  $$('#newGrid .card').forEach(c => c.classList.remove('pop'));
}

/* ---------------- catalog ---------------- */
function renderChips() {
  const all = [{ id: 'all', name: 'Все', n: PR.length }, { id: 'fav', name: '♡ Избранное', n: favs.size }]
    .concat(COLS.map(c => ({ id: c.id, name: c.name, n: PR.filter(p => p.col === c.id).length })));
  $('#colChips').innerHTML = all.map(c => {
    const on = c.id === 'fav' ? F.fav : (!F.fav && F.col === c.id);
    return `<button class="chip ${on ? 'on' : ''}" data-chip="${c.id}">${c.name}<small>${c.n}</small></button>`;
  }).join('');
  const colors = [...new Set(PR.flatMap(p => p.colors))];
  $('#swatches').innerHTML = `<button class="sw all ${F.color === 'all' ? 'on' : ''}" data-sw="all" title="Все цвета" aria-label="Все цвета"></button>` +
    colors.map(c => `<button class="sw ${F.color === c ? 'on' : ''}" data-sw="${c}" title="${c}" aria-label="${c}" style="--c:${COLOR_HEX[c] || '#ccc'}"></button>`).join('');
}
function filtered() {
  const q = F.q.trim().toLowerCase();
  let list = PR.filter(p =>
    (F.fav ? favs.has(p.id) : (F.col === 'all' || p.col === F.col)) &&
    (F.color === 'all' || p.colors.includes(F.color)) &&
    (!q || (p.name + ' ' + p.code + ' ' + p.collection + ' ' + p.colors.join(' ')).toLowerCase().includes(q)));
  if (F.sort === 'asc') list.sort((a, b) => a.price - b.price);
  else if (F.sort === 'desc') list.sort((a, b) => b.price - a.price);
  else list.sort((a, b) => (!!b.badge - !!a.badge));
  return list;
}
function renderCatalog() {
  renderChips();
  const list = filtered();
  $('#grid').innerHTML = list.map(cardHTML).join('');
  $('#empty').hidden = list.length > 0;
  const parts = [];
  if (F.q) parts.push(`по запросу «${esc(F.q)}»`);
  $('#resultLine').innerHTML = `Найдено: <b>${list.length}</b> ${parts.join(' ')}${F.q ? ' <button class="link" id="clearQ" style="font-size:14px">Сбросить поиск</button>' : ''}`;
}
function setFilter(p) { Object.assign(F, p); renderCatalog(); }
$('#colChips').addEventListener('click', e => {
  const b = e.target.closest('[data-chip]'); if (!b) return;
  b.dataset.chip === 'fav' ? setFilter({ fav: true }) : setFilter({ fav: false, col: b.dataset.chip });
});
$('#swatches').addEventListener('click', e => { const b = e.target.closest('[data-sw]'); if (b) setFilter({ color: b.dataset.sw }); });
$('#sort').addEventListener('change', e => setFilter({ sort: e.target.value }));
$('#resetF').addEventListener('click', () => { $('#q').value = ''; setFilter({ col: 'all', color: 'all', q: '', fav: false }); });
$('#resultLine').addEventListener('click', e => { if (e.target.id === 'clearQ') { $('#q').value = ''; setFilter({ q: '' }); } });
document.addEventListener('click', e => {
  const f = e.target.closest('[data-filter]');
  if (f) setFilter({ col: f.dataset.filter, fav: false, color: 'all', q: '' });
});

/* ---------------- favorites ---------------- */
function toggleFav(id, btn) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  store.set('cm_favs', [...favs]);
  $$(`.card[data-id="${id}"] .fav`).forEach(b => { b.classList.toggle('on', favs.has(id)); b.setAttribute('aria-pressed', favs.has(id)); b.classList.remove('beat'); void b.offsetWidth; b.classList.add('beat'); });
  if (btn && $('#qv:not([hidden])')) { const qb = $('#qvFav'); if (qb) qb.classList.toggle('on', favs.has(id)); }
  updateCounts();
  if (F.fav) renderCatalog(); else renderChips();
  toast(favs.has(id) ? 'Добавлено в избранное' : 'Убрано из избранного');
}
function showFavs() { setFilter({ fav: true, col: 'all', color: 'all', q: '' }); $('#catalog').scrollIntoView({ behavior: 'smooth' }); }
$('#favBtn').addEventListener('click', showFavs);
$('#tabFav').addEventListener('click', showFavs);

/* ---------------- cart ---------------- */
const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
const cartSub = () => Object.entries(cart).reduce((s, [id, q]) => s + byId(id).price * q, 0);
function updateCounts() {
  [['#cartCnt', cartCount()], ['#cartCnt2', cartCount()], ['#favCnt', favs.size]].forEach(([s, n]) => {
    const el = $(s); el.textContent = n; el.classList.toggle('on', n > 0);
  });
}
function bump(sel) { const el = $(sel); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function saveCart() { store.set('cm_cart', cart); updateCounts(); renderCart(); }
function addToCart(id, qty = 1, srcImg, btn) {
  cart[id] = Math.min(99, (cart[id] || 0) + qty);
  saveCart(); bump('#cartCnt'); bump('#cartCnt2');
  if (btn) { const t = btn.innerHTML; btn.classList.add('ok'); btn.innerHTML = ico('check') + '<span>Добавлено</span>'; setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = t; }, 1200); }
  if (srcImg && !reduce) fly(srcImg);
  toast('Товар в корзине');
}
function fly(img) {
  const target = [$('#cartBtn'), $('.tabbar #tabCart')].find(el => el && el.getBoundingClientRect().width > 0);
  if (!target) return;
  const a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
  if (!a.width) return;
  const c = document.createElement('img'); c.src = img.src; c.className = 'fly';
  Object.assign(c.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.appendChild(c);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const an = c.animate([
    { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
    { transform: `translate(${dx * .55}px,${dy * .35 - 70}px) scale(.55) rotate(-90deg)`, opacity: 1, offset: .55 },
    { transform: `translate(${dx}px,${dy}px) scale(.12) rotate(-200deg)`, opacity: .2 }], { duration: 800, easing: 'cubic-bezier(.5,0,.3,1)' });
  an.onfinish = () => c.remove();
}
function totals() {
  const sub = cartSub(), ship = sub >= S.freeShippingFrom || !sub ? 0 : S.shippingFlat;
  return { sub, ship, total: sub + ship };
}
function renderCart() {
  const ids = Object.keys(cart), t = totals();
  const left = S.freeShippingFrom - t.sub;
  $('#ship').innerHTML = !ids.length ? '' : (left > 0
    ? `Добавьте ещё на <b>${money(left)}</b> до бесплатной доставки`
    : `<b>Бесплатная доставка включена</b>`) +
    `<div class="bar"><i style="width:${Math.min(100, t.sub / S.freeShippingFrom * 100)}%"></i></div>`;
  $('#cartBody').innerHTML = !ids.length
    ? `<div class="cart-empty">${ico('bag')}<p>В корзине пока пусто</p><button class="btn btn-primary" data-close data-goto="#catalog">Выбрать украшения</button></div>`
    : ids.map(id => { const p = byId(id), q = cart[id]; return `
      <div class="li" data-id="${id}">
        <img src="${p.img}" alt="">
        <div><b>${esc(p.name)}</b><small>${esc(p.collection)} · ${esc(p.code)}</small>
          <div class="qty"><button data-dec aria-label="Меньше">${ico('minus')}</button><span>${q}</span><button data-inc aria-label="Больше">${ico('plus')}</button></div></div>
        <div><div class="sum">${money(p.price * q)}</div><button class="rm" data-rm>Удалить</button></div>
      </div>`; }).join('');
  $('#cartFoot').innerHTML = !ids.length ? '' : `
    <div class="sumrow"><span>Товары (${cartCount()})</span><span>${money(t.sub)}</span></div>
    <div class="sumrow"><span>Доставка</span><span>${t.ship ? money(t.ship) : 'Бесплатно'}</span></div>
    <div class="sumrow total"><span>Итого</span><b>${money(t.total)}</b></div>
    <button class="btn btn-primary" id="goCheckout">Оформить заказ ${ico('arrow')}</button>`;
}
$('#cartBody').addEventListener('click', e => {
  const li = e.target.closest('.li'); if (!li) return; const id = li.dataset.id;
  if (e.target.closest('[data-inc]')) cart[id] = Math.min(99, cart[id] + 1);
  else if (e.target.closest('[data-dec]')) { cart[id]--; if (cart[id] < 1) delete cart[id]; }
  else if (e.target.closest('[data-rm]')) delete cart[id];
  else return;
  saveCart();
});
$('#cartFoot').addEventListener('click', e => { if (e.target.closest('#goCheckout')) { closeDrawer(); openCheckout(); } });
function openDrawer() { const d = $('#cart'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); lock(true); setTimeout(() => $('[data-close].icon-btn', d).focus(), 50); }
function closeDrawer() { const d = $('#cart'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); lock(false); }
$('#cartBtn').addEventListener('click', openDrawer);
$('#tabCart').addEventListener('click', openDrawer);
$('#cart').addEventListener('click', e => {
  const g = e.target.closest('[data-goto]');
  if (e.target.closest('[data-close]')) { closeDrawer(); if (g) $(g.dataset.goto).scrollIntoView({ behavior: 'smooth' }); }
});

/* ---------------- scroll lock / esc ---------------- */
let locks = 0;
function lock(on) { locks = Math.max(0, locks + (on ? 1 : -1)); document.body.style.overflow = locks ? 'hidden' : ''; }
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#checkout').hidden) closeModal($('#checkout'));
  else if (!$('#qv').hidden) closeModal($('#qv'));
  else if ($('#cart').classList.contains('open')) closeDrawer();
  $('#suggest').classList.remove('open');
});
function closeModal(m) { if (m.hidden) return; m.hidden = true; lock(false); if (lastFocus) lastFocus.focus?.(); }
let lastFocus = null;
function openModal(m) { lastFocus = document.activeElement; m.hidden = false; lock(true); setTimeout(() => $('.modal-x', m).focus(), 50); }
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(m); }));

/* ---------------- quick view ---------------- */
function openQV(id) {
  const p = byId(id), c = COLS.find(c => c.id === p.col);
  let q = 1;
  $('#qvPic').src = p.img; $('#qvPic').alt = p.name;
  const rel = PR.filter(x => x.id !== id && (x.col === p.col)).slice(0, 8);
  const extra = p.col === 'system' ? [] : [byId('cartridge'), byId('instrument')];
  const more = [...extra, ...rel].slice(0, 9);
  $('#qvInfo').innerHTML = `
    <p class="eyebrow">${esc(p.collection)} · ${esc(p.code)}</p>
    <h3>${esc(p.name)}</h3>
    <div class="price">${money(p.price)}<small>/ ${p.unit}</small></div>
    <p class="desc">${esc(p.desc)}</p>
    <ul class="qv-facts">
      <li>${ico('leaf')}Гипоаллергенно, сталь без никеля</li>
      <li>${ico('lock')}Замок безопасности Safety Lock</li>
      <li>${ico('eu')}Соответствует EU REACH</li>
    </ul>
    <div class="qv-buy">
      <div class="qty"><button id="qMinus" aria-label="Меньше">${ico('minus')}</button><span id="qNum">1</span><button id="qPlus" aria-label="Больше">${ico('plus')}</button></div>
      <button class="btn btn-primary" id="qAdd" style="flex:1">${ico('bag')} В корзину</button>
      <button class="icon-btn fav ${favs.has(id) ? 'on' : ''}" id="qvFav" style="position:static;transform:none;border:1px solid var(--line)" aria-label="В избранное">${ico('heart')}</button>
    </div>
    ${more.length ? `<div class="qv-more"><h5>${p.col === 'system' ? 'Из этой коллекции' : 'Вместе покупают и похожее'}</h5><div class="row">${more.map(m => `<div class="mini" data-id="${m.id}"><img src="${m.img}" alt="" loading="lazy"><span>${esc(m.code)}</span></div>`).join('')}</div></div>` : ''}`;
  const num = $('#qNum');
  $('#qMinus').onclick = () => num.textContent = q = Math.max(1, q - 1);
  $('#qPlus').onclick = () => num.textContent = q = Math.min(99, q + 1);
  $('#qAdd').onclick = e => { addToCart(id, q, $('#qvPic'), e.currentTarget); };
  $('#qvFav').onclick = e => toggleFav(id, e.currentTarget);
  $$('.mini', $('#qvInfo')).forEach(m => m.onclick = () => openQV(m.dataset.id));
  if ($('#qv').hidden) openModal($('#qv'));
  $('#qv .qv-box').scrollTop = 0;
}
(() => { // 3D-наклон картинки в модалке
  const box = $('#qvImg'), img = $('#qvPic');
  box.addEventListener('pointermove', e => {
    const r = box.getBoundingClientRect();
    img.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 30 + 'deg');
    img.style.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 24 + 'deg');
  });
  box.addEventListener('pointerleave', () => { img.style.setProperty('--ry', '0deg'); img.style.setProperty('--rx', '0deg'); });
})();

/* ---------------- search ---------------- */
const qEl = $('#q'), sg = $('#suggest');
function suggest() {
  const q = qEl.value.trim().toLowerCase();
  if (!q) { sg.classList.remove('open'); return; }
  const hits = PR.filter(p => (p.name + ' ' + p.code + ' ' + p.collection + ' ' + p.colors.join(' ')).toLowerCase().includes(q)).slice(0, 6);
  sg.innerHTML = hits.length
    ? hits.map(p => `<button data-id="${p.id}"><img src="${p.img}" alt=""><span><b>${esc(p.name)}</b><small>${esc(p.collection)} · ${esc(p.code)} · ${money(p.price)}</small></span></button>`).join('')
    : '<div class="none">Ничего не найдено</div>';
  sg.classList.add('open');
}
qEl.addEventListener('input', suggest);
qEl.addEventListener('focus', suggest);
qEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    setFilter({ q: qEl.value, col: 'all', fav: false, color: 'all' }); sg.classList.remove('open');
    $('#catalog').scrollIntoView({ behavior: 'smooth' }); qEl.blur(); hdr.classList.remove('search-open');
  }
});
sg.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { sg.classList.remove('open'); openQV(b.dataset.id); } });
document.addEventListener('click', e => { if (!e.target.closest('#search')) sg.classList.remove('open'); });

/* ---------------- header / nav ---------------- */
const hdr = $('#header');
addEventListener('scroll', () => hdr.classList.toggle('scrolled', scrollY > 10), { passive: true });
$('#burger').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#burger use').setAttribute('href', o ? '#i-close' : '#i-menu'); });
$$('#nav a').forEach(a => a.addEventListener('click', () => { $('#nav').classList.remove('open'); $('#burger use').setAttribute('href', '#i-menu'); }));
(() => { // кнопка поиска на мобильных
  const b = document.createElement('button');
  b.className = 'icon-btn search-toggle'; b.setAttribute('aria-label', 'Поиск'); b.innerHTML = ico('search');
  b.style.display = 'none';
  $('.header-actions').prepend(b);
  const mq = matchMedia('(max-width:980px)');
  const sync = () => b.style.display = mq.matches ? 'grid' : 'none';
  mq.addEventListener('change', sync); sync();
  b.addEventListener('click', () => { hdr.classList.toggle('search-open'); if (hdr.classList.contains('search-open')) qEl.focus(); });
})();

/* ---------------- hero: 3D-сцена ---------------- */
(() => {
  const stage = $('#stage'), scene = $('#scene');
  if (!stage || reduce) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, active = true, hover = false, t0 = performance.now();
  const hero = $('.hero');
  hero.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = stage.getBoundingClientRect();
    ty = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2))) * 16;
    tx = -Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2))) * 11;
    hover = true;
  });
  hero.addEventListener('pointerleave', () => { hover = false; });
  new IntersectionObserver(([en]) => active = en.isIntersecting).observe(hero);
  (function loop(t) {
    if (active) {
      if (!hover) { const s = (t - t0) / 1000; ty = Math.sin(s * .6) * 9; tx = Math.cos(s * .45) * 4; }
      cx += (tx - cx) * .07; cy += (ty - cy) * .07;
      scene.style.setProperty('--rx', cx.toFixed(2) + 'deg'); scene.style.setProperty('--ry', cy.toFixed(2) + 'deg');
    }
    requestAnimationFrame(loop);
  })(t0);
})();

/* ---------------- waves (фирменный фон) ---------------- */
(() => {
  const svg = $('#waves'); if (!svg) return; let d = '';
  for (let i = 0; i < 22; i++) {
    const y = 120 + i * 18, a = 40 + i * 3.2, ph = i * .22;
    let p = `M0 ${y}`;
    for (let x = 0; x <= 1440; x += 40) p += ` L${x} ${(y + Math.sin(x / 230 + ph) * a + Math.cos(x / 410 - ph) * a * .6).toFixed(1)}`;
    d += `<path d="${p}"/>`;
  }
  svg.innerHTML = d;
})();

/* ---------------- sparkles ---------------- */
(() => {
  const cv = $('#sparkles'); if (!cv || reduce) return;
  const ctx = cv.getContext('2d'); let W, H, dpr, ps = [];
  const n = innerWidth < 700 ? 18 : 38;
  function size() { dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; }
  size(); addEventListener('resize', size);
  const mk = (init) => ({ x: Math.random() * W, y: init ? Math.random() * H : H + 20, r: (2 + Math.random() * 5) * dpr, v: (.12 + Math.random() * .35) * dpr, ph: Math.random() * 6, c: Math.random() < .6 ? '201,164,92' : '88,169,179', tw: .6 + Math.random() * 1.4 });
  for (let i = 0; i < n; i++) ps.push(mk(true));
  function star(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); }
  (function loop(t) {
    if (!document.hidden) {
      ctx.clearRect(0, 0, W, H);
      ps.forEach((p, i) => {
        p.y -= p.v; p.x += Math.sin(t / 1800 + p.ph) * .25 * dpr;
        if (p.y < -20) ps[i] = mk(false);
        const a = (.25 + .45 * Math.abs(Math.sin(t / 1000 * p.tw + p.ph)));
        ctx.fillStyle = `rgba(${p.c},${a})`; star(p.x, p.y, p.r);
      });
    }
    requestAnimationFrame(loop);
  })(0);
})();

/* ---------------- 3D-наклон карточек ---------------- */
(() => {
  if (!fine || reduce) return;
  const SEL = '.card,.col,.banner,.cmp-card,.certs,.step';
  let cur = null;
  const reset = el => { el.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; el.classList.remove('tilting'); };
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest?.(SEL);
    if (cur && cur !== el) { reset(cur); cur = null; }
    if (!el) return;
    cur = el;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const m = el.classList.contains('banner') ? 5 : el.classList.contains('step') ? 7 : 9;
    el.style.transition = 'transform .1s linear';
    el.style.transform = `perspective(1000px) rotateX(${(.5 - py) * m}deg) rotateY(${(px - .5) * m * 1.3}deg) translateY(-4px)`;
    el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
    el.classList.add('tilting');
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (cur) { reset(cur); cur = null; } });
  $$('.banner,.certs').forEach(b => { if (!$('.glare', b)) b.insertAdjacentHTML('beforeend', '<i class="glare"></i>'); });
})();

/* ---------------- магнитные кнопки ---------------- */
if (fine && !reduce) $$('.magnet').forEach(b => {
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px,${(e.clientY - r.top - r.height / 2) * .28}px)`; });
  b.addEventListener('pointerleave', () => b.style.transform = '');
});

/* ---------------- reveal + counters ---------------- */
(() => {
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in'); io.unobserve(en.target);
    $$('[data-count]', en.target).forEach(countUp);
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  function countUp(el) {
    const to = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), d = 1400;
    (function f(t) { const k = Math.min(1, (t - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(f); })(t0);
  }
  setTimeout(() => $$('.reveal:not(.in)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) { el.classList.add('in'); $$('[data-count]', el).forEach(countUp); } }), 800);
})();

/* ---------------- шаги ---------------- */
const STEPS = [
  ['Очистите мочку', 'Обработайте ухо спереди и сзади, особенно место будущего прокола.'],
  ['Сделайте метку', 'Отметьте точное место специальным маркером, который идёт в комплекте Click.'],
  ['Достаньте картридж', 'Берите его двумя пальцами за <b>центр</b>, а не за край.'],
  ['Проверьте держатель', 'Убедитесь, что держатель серьги полностью установлен внутри картриджа.'],
  ['Совместите иглу', 'Игла должна быть ровно по замку безопасности. Это важно, смотрите фото.'],
  ['Вставьте картридж', 'Вставьте в паз сзади и слегка нажмите, чтобы он встал на место.'],
  ['Мягко оттяните ухо', 'Держите инструмент параллельно лицу. Торец картриджа с замком прижмите к задней стороне мочки.'],
  ['Угол 90° и 2 секунды', 'Совместите с меткой, держите прибор под <b>углом 90°</b>. Нажмите до упора на <b>2 секунды</b> и отпустите.'],
  ['Работает POP-UP', 'Эти 2 секунды запускают систему POP-UP: защитная капсула серьги выбрасывается и не застревает.'],
  ['Уберите прибор', 'Аккуратно отведите прибор от уха вниз.'],
];
(() => {
  const el = $('#steps');
  el.innerHTML = STEPS.map((s, i) => `<article class="step"><div class="pic"><img src="assets/steps/s${i + 1}.webp" alt="Шаг ${i + 1}: ${s[0]}" loading="lazy" draggable="false"></div><div class="n">${String(i + 1).padStart(2, '0')}</div><p><b>${s[0]}.</b> ${s[1]}</p></article>`).join('') +
    `<article class="step final"><div><h4>Готово. Ровно и аккуратно</h4><p>Полная видеоинструкция от производителя и подбор серёг в каталоге.</p><div style="display:grid;gap:10px"><a href="https://www.youtube.com/watch?v=wwmKN2epERk" target="_blank" rel="noopener" class="btn btn-gold">Смотреть видео ${ico('arrow')}</a><a href="#catalog" class="btn btn-outline" data-filter="system">В каталог</a></div></div></article>`;
  let down = false, sx = 0, sl = 0, moved = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = el.scrollLeft; moved = 0; });
  addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; moved = Math.abs(dx); if (moved > 4) el.classList.add('drag'); el.scrollLeft = sl - dx; });
  addEventListener('pointerup', () => { down = false; el.classList.remove('drag'); });
  el.addEventListener('click', e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
})();

/* ---------------- оформление заказа ---------------- */
function openCheckout() {
  if (!cartCount()) return;
  const t = totals();
  const items = Object.entries(cart).map(([id, q]) => `${esc(byId(id).name)} × ${q}`).join('<br>');
  $('#coBody').innerHTML = `
    <h3>Оформление заказа</h3><p class="sub">Оставьте контакты. Мы подтвердим состав, сроки и стоимость доставки.</p>
    <form id="coForm" novalidate>
      <div class="two">
        <label class="field"><span>Имя*</span><input name="name" required placeholder="Анна" autocomplete="name"></label>
        <label class="field"><span>Телефон*</span><input name="phone" required placeholder="+7 (___) ___-__-__" inputmode="tel" autocomplete="tel"></label>
      </div>
      <div class="two">
        <label class="field"><span>E-mail</span><input name="email" type="email" placeholder="you@mail.ru" autocomplete="email"></label>
        <label class="field"><span>Город*</span><input name="city" required placeholder="Москва" autocomplete="address-level2"></label>
      </div>
      <div class="opts">
        <label class="opt"><input type="radio" name="ship" value="Курьер" checked><div>Курьер<small>до двери</small></div></label>
        <label class="opt"><input type="radio" name="ship" value="Пункт выдачи"><div>Пункт выдачи<small>рядом с домом</small></div></label>
        <label class="opt"><input type="radio" name="ship" value="Почта России"><div>Почта России<small>по всей стране</small></div></label>
      </div>
      <label class="field"><span>Комментарий</span><textarea name="comment" placeholder="Адрес, удобное время, пожелания"></textarea></label>
      <div class="co-sum"><div style="font-size:13.5px;color:var(--muted)">${items}</div>
        <div class="sumrow"><span>Доставка</span><span>${t.ship ? money(t.ship) : 'Бесплатно'}</span></div>
        <div class="sumrow total"><span>Итого</span><b>${money(t.total)}</b></div></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Подтвердить заказ ${ico('arrow')}</button>
      <p class="agree">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
    </form>`;
  openModal($('#checkout'));
  const f = $('#coForm'), ph = f.phone;
  ph.addEventListener('input', () => {
    let d = ph.value.replace(/\D/g, ''); if (d[0] === '8') d = '7' + d.slice(1); if (d && d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    ph.value = d ? '+7' + (p[0] ? ' (' + p[0] : '') + (p[0].length === 3 ? ')' : '') + (p[1] ? ' ' + p[1] : '') + (p[2] ? '-' + p[2] : '') + (p[3] ? '-' + p[3] : '') : '';
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const bad = [f.name, f.city].find(i => !i.value.trim()) || (ph.value.replace(/\D/g, '').length < 11 ? ph : null);
    if (bad) { bad.focus(); bad.style.borderColor = 'var(--rose)'; toast('Проверьте поля формы'); return; }
    finishOrder(Object.fromEntries(new FormData(f)));
  });
}
function finishOrder(data) {
  const t = totals(), no = 'CM-' + Date.now().toString().slice(-6);
  const lines = Object.entries(cart).map(([id, q]) => ({ code: byId(id).code, name: byId(id).name, qty: q, price: byId(id).price }));
  const order = { no, date: new Date().toISOString(), ...data, items: lines, ...t };
  const text = `Заказ ${no}\n${lines.map(l => `${l.code} ${l.name} × ${l.qty} = ${l.price * l.qty} ${S.currency}`).join('\n')}\nИтого: ${t.total} ${S.currency} (доставка ${t.ship})\n\n${data.name}, ${data.phone}\n${data.city}, ${data.ship}${data.comment ? '\n' + data.comment : ''}`;
  const orders = store.get('cm_orders', []); orders.push(order); store.set('cm_orders', orders);
  if (S.orderWebhook) fetch(S.orderWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) }).catch(() => {});
  cart = {}; saveCart();
  const wa = S.whatsapp ? `${S.whatsapp}?text=${encodeURIComponent(text)}` : '';
  $('#coBody').innerHTML = `<div class="co-done">
    <div class="ok">${ico('check')}</div>
    <h3>Спасибо за заказ!</h3>
    <p class="sub">Номер заказа <b>${no}</b>. Мы свяжемся с вами по телефону ${esc(data.phone)} и подтвердим детали.</p>
    <div class="acts">
      ${wa ? `<a class="btn btn-primary" href="${wa}" target="_blank" rel="noopener">Отправить в WhatsApp</a>` : ''}
      ${S.telegram ? `<a class="btn ${wa ? 'btn-ghost' : 'btn-primary'}" href="${S.telegram}" target="_blank" rel="noopener">Написать в Telegram</a>` : ''}
      <button class="btn btn-ghost" id="copyOrder">Скопировать заказ</button>
      <button class="btn btn-dark" data-close>Вернуться в магазин</button>
    </div></div>`;
  $('#copyOrder').onclick = async e => { try { await navigator.clipboard.writeText(text); e.target.textContent = 'Скопировано'; } catch (er) { e.target.textContent = 'Не удалось скопировать'; } };
}

/* ---------------- footer / misc ---------------- */
$('#yr').textContent = new Date().getFullYear();
(() => {
  const a = $('#fPhone'); a.href = 'tel:' + S.phone.replace(/[^\d+]/g, ''); $('span', a).textContent = S.phone;
  $('#fTg').href = S.telegram || '#';
})();
$('#newsForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = e.target.querySelector('input').value; const l = store.get('cm_news', []); l.push(v); store.set('cm_news', l);
  $('#newsMsg').textContent = 'Спасибо! Вы подписаны.'; e.target.reset();
});

/* ---------------- init ---------------- */
renderCols(); renderNew(); renderCatalog(); renderCart(); updateCounts();
bindGrid($('#newGrid')); bindGrid($('#grid'));
})();
