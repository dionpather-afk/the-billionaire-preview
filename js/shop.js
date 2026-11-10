/* The Billionaire — shop engine front end.
   Talks to the PHP back end (api/order.php). Prices are always re-checked on the server.
   Content (products, prices, WhatsApp, bank details, delivery fees) comes from /store.json. */
(function () {
  'use strict';

  var STORE = null, PRODUCTS = [], cart = {};
  var dlg = document.getElementById('dlg'), pane = document.getElementById('pane');
  var R = function (n) { return 'R' + Number(n).toLocaleString('en-ZA'); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var $ = function (id) { return document.getElementById(id); };

  function waLink(text) {
    var n = (STORE.whatsapp || '').replace(/\D/g, '');
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : '';
  }
  function priceLabel(p) {
    return R(p.price) + (STORE.demo ? ' <small class="demo-note">demo price</small>' : '');
  }

  /* ---------- load store.json and fill the page ---------- */
  fetch('store.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      STORE = s; PRODUCTS = s.products || [];
      if (s.demo) $('demoBar').hidden = false;

      var f = PRODUCTS[0];
      if (f) {
        if (f.image) $('featImg').src = f.image;
        if (f.title_html) $('featName').innerHTML = f.title_html; else $('featName').textContent = f.name;
        if (f.meta) $('featMeta').textContent = f.meta;
        if (f.description) $('featDesc').textContent = f.description;
        $('featPrice').innerHTML = priceLabel(f);
        var add = $('featAdd'); add.disabled = false; add.dataset.add = f.id;
        var wa = waLink('Hi, I would like to order ' + f.name + '.');
        if (wa) { $('featWa').href = wa; $('featWa').target = '_blank'; $('featWa').rel = 'noopener'; }
      }

      var rest = PRODUCTS.slice(1);
      if (rest.length) {
        $('shop').hidden = false;
        $('products').innerHTML = rest.map(function (p) {
          var pic = p.image
            ? '<div class="tile"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy"></div>'
            : '<div class="tile">Photo coming soon</div>';
          return '<div class="p">' + pic + '<h3>' + esc(p.name) + '</h3><span class="p-price">' + priceLabel(p) +
            '</span><button type="button" class="btn btn-ghost btn-sm" data-add="' + p.id + '">Add to bag</button></div>';
        }).join('');
      }

      // footer contact details are filled in by js/site.js
    })
    .catch(function () {
      $('featPrice').textContent = 'The shop could not load. Please refresh the page.';
    });

  /* ---------- bag maths ---------- */
  function sub() { return PRODUCTS.reduce(function (t, p) { return t + (cart[p.id] || 0) * p.price; }, 0); }
  function count() { return Object.keys(cart).reduce(function (a, k) { return a + cart[k]; }, 0); }
  function sync() { $('count').textContent = count(); }
  function open() { if (!dlg.open) dlg.showModal(); }

  /* ---------- views ---------- */
  function viewBag() {
    var items = PRODUCTS.filter(function (p) { return cart[p.id]; });
    pane.innerHTML = '<button type="button" class="x" data-close>Close &times;</button><p class="eyebrow">Your bag</p>' +
      (items.length
        ? items.map(function (p) {
            return '<div class="row"><div>' + esc(p.name) + '<small>' + R(p.price) + '</small></div>' +
              '<div class="qty"><button type="button" data-dec="' + p.id + '" aria-label="Remove one">&minus;</button> ' + cart[p.id] +
              ' <button type="button" data-add="' + p.id + '" aria-label="Add one">+</button></div></div>';
          }).join('') +
          '<div class="row total"><span>Subtotal</span><span>' + R(sub()) + '</span></div>' +
          '<button type="button" class="btn btn-red" data-go="checkout">Checkout</button>'
        : '<p>Your bag is empty.</p><button type="button" class="btn btn-ghost" data-close>Browse the collection</button>');
    open();
  }

  function viewCheckout() {
    var areas = STORE.delivery.areas || [];
    var areaField = areas.length
      ? '<div><label for="ar">Delivery area</label><select id="ar"><option value="">Choose area</option>' +
        areas.map(function (a) { return '<option value="' + esc(a.name) + '">' + esc(a.name) + ' (+' + R(a.fee) + ')</option>'; }).join('') +
        '</select></div>'
      : '';
    var pf = STORE.payfast && (STORE.payfast.enabled || (STORE.demo && STORE.payfast.demo_checkout));
    pane.innerHTML = '<button type="button" class="x" data-back>&larr; Back to bag</button><p class="eyebrow">Delivery details</p>' +
      '<div><label for="n">Full name</label><input id="n" autocomplete="name"></div>' +
      '<div><label for="ph">Phone number</label><input id="ph" type="tel" autocomplete="tel"></div>' +
      '<div><label for="ad">Delivery address</label><textarea id="ad" rows="3" autocomplete="street-address"></textarea></div>' + areaField +
      (pf ? '<div><label for="m">How do you want to pay?</label><select id="m"><option value="eft">Bank transfer</option><option value="payfast">Card or Instant EFT (PayFast)</option></select></div>' : '') +
      '<div class="row total"><span>Subtotal</span><span>' + R(sub()) + '</span></div>' +
      '<p class="agree">By confirming you agree to our <a href="terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a> and <a href="refunds.html" target="_blank" rel="noopener">Refund Policy</a>.</p>' +
      '<p id="err" role="alert" class="err"></p><button type="button" class="btn btn-red" data-confirm>Confirm order</button>';
    open();
  }

  function confirmOrder(btn) {
    var g = function (i) { var e = $(i); return e ? e.value.trim() : ''; };
    var body = { name: g('n'), phone: g('ph'), address: g('ad'), area: g('ar'), method: g('m') || 'eft', cart: cart };
    if (!body.name || !body.phone || !body.address) { $('err').textContent = 'Enter your name, phone number and delivery address.'; return; }
    if ((STORE.delivery.areas || []).length && !body.area) { $('err').textContent = 'Choose your delivery area.'; return; }
    btn.disabled = true; btn.textContent = 'Sending...';
    if (STORE.static_preview) return previewOrder(body);
    fetch('api/order.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { $('err').textContent = x.j.error || 'Something went wrong. Please try again.'; btn.disabled = false; btn.textContent = 'Confirm order'; return; }
        var o = x.j; cart = {}; sync();
        showOrder(o, body);
      })
      .catch(function () { $('err').textContent = 'No connection. Please try again.'; btn.disabled = false; btn.textContent = 'Confirm order'; });
  }

  // Client preview (no server): builds the same order the server would, nothing is sent or saved.
  function previewOrder(body) {
    var lines = PRODUCTS.filter(function (p) { return cart[p.id]; }).map(function (p) { return { id: p.id, name: p.name, qty: cart[p.id], price: p.price }; });
    var area = (STORE.delivery.areas || []).filter(function (a) { return a.name === body.area; })[0];
    var fee = area ? area.fee : (STORE.delivery.default || 0), subtotal = sub();
    var o = { ref: 'ORD-' + (10000 + Math.floor(Math.random() * 90000)), lines: lines, subtotal: subtotal, delivery: fee,
              total: subtotal + fee, method: body.method, bank: STORE.bank, whatsapp: STORE.whatsapp, demo_pay: body.method === 'payfast', preview: true };
    cart = {}; sync();
    setTimeout(function () { showOrder(o, body); }, 600);
  }

  function showOrder(o, body) {
        if (o.demo_pay) return viewDemoPay(o);
        if (o.payfast) {
          var f = '<form id="pf" method="post" action="' + esc(o.payfast.url) + '">' +
            Object.keys(o.payfast.fields).map(function (k) { return '<input type="hidden" name="' + esc(k) + '" value="' + esc(o.payfast.fields[k]) + '">'; }).join('') + '</form>';
          pane.innerHTML = '<p class="eyebrow">Secure payment</p><h2>Taking you to PayFast&hellip;</h2>' + f;
          $('pf').submit(); return;
        }
        var b = o.bank;
        var wa = o.whatsapp
          ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/' + esc(o.whatsapp.replace(/\D/g, '')) + '?text=' +
            encodeURIComponent('Hi, I placed order ' + o.ref + ' for ' + R(o.total) + '. Proof of payment attached.') + '">Send proof of payment on WhatsApp</a>'
          : '';
        pane.innerHTML = '<p class="eyebrow">Order received</p><h2>Thank you, ' + esc(body.name) + '.</h2>' +
          '<p>Your reference is <b>' + esc(o.ref) + '</b>.</p>' +
          '<div class="bank">' + o.lines.map(function (l) { return esc(l.qty + ' x ' + l.name); }).join('<br>') +
          '<br>Delivery: ' + R(o.delivery) + '<br>Total: <b>' + R(o.total) + '</b></div>' +
          '<div class="bank"><b>Pay by bank transfer</b><br>' + esc(b.name) + '<br>' + esc(b.bank) + ' &middot; ' + esc(b.type) +
          '<br>Account: ' + esc(b.acc) + '<br>Branch code: ' + esc(b.branch) + '<br>Reference: <b>' + esc(o.ref) + '</b></div>' +
          '<p>We will confirm and arrange delivery once your payment reflects.</p>' + wa +
          (o.preview ? '<p class="agree">Preview: this order was not sent anywhere.</p>' : '') +
          '<button type="button" class="btn btn-red" data-done>Done</button>';
  }

  /* ---------- demo payment (only while the site is in demo mode) ---------- */
  function viewDemoPay(o) {
    pane.innerHTML = '<p class="eyebrow">Demo payment</p>' +
      '<div class="demo-pay"><b>Demo payment: PayFast connects at launch.</b><br>' +
      'This is not PayFast and no money moves. On the live site the customer goes to PayFast\'s secure page here.</div>' +
      '<div class="bank">Order <b>' + esc(o.ref) + '</b><br>' + o.lines.map(function (l) { return esc(l.qty + ' x ' + l.name); }).join('<br>') +
      '<br>Delivery: ' + R(o.delivery) + '<br>Total: <b>' + R(o.total) + '</b></div>' +
      '<p id="err" role="alert" class="err"></p>' +
      '<button type="button" class="btn btn-red" data-demo="1" data-ref="' + esc(o.ref) + '">Approve demo payment</button>' +
      '<button type="button" class="btn btn-ghost" data-demo="0" data-ref="' + esc(o.ref) + '">Decline demo payment</button>';
  }
  function demoPay(btn) {
    var approve = btn.dataset.demo === '1', ref = btn.dataset.ref;
    btn.disabled = true;
    if (STORE.static_preview) { location.href = 'result.html?ok=' + (approve ? '1' : '0') + '&ref=' + encodeURIComponent(ref) + '&demo=1'; return; }
    fetch('api/demo_pay.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: ref, approve: approve }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { $('err').textContent = x.j.error || 'Demo payment failed.'; btn.disabled = false; return; }
        location.href = 'result.html?ok=' + (approve ? '1' : '0') + '&ref=' + encodeURIComponent(ref) + '&demo=1';
      })
      .catch(function () { $('err').textContent = 'No connection. Please try again.'; btn.disabled = false; });
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button,a'); if (!t || !STORE) return;
    if (t.id === 'bagBtn') return viewBag();
    if (t.dataset.add) {
      cart[t.dataset.add] = (cart[t.dataset.add] || 0) + 1; sync();
      if (dlg.open) viewBag();
      else { var label = t.textContent; t.textContent = 'Added ✓'; setTimeout(function () { t.textContent = label; }, 1000); }
      return;
    }
    if (t.dataset.dec) { var k = t.dataset.dec; cart[k]--; if (cart[k] <= 0) delete cart[k]; sync(); return viewBag(); }
    if (t.dataset.go) return viewCheckout();
    if ('back' in t.dataset) return viewBag();
    if ('confirm' in t.dataset) return confirmOrder(t);
    if (t.dataset.demo) return demoPay(t);
    if ('close' in t.dataset || 'done' in t.dataset) dlg.close();
  });
  // click on the dark backdrop closes the drawer
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();
