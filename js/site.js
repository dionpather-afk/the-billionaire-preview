/* The Billionaire — shared bits for every page:
   fills business details from store.json, footer contact links, demo bar,
   and the "register interest" form (saved by api/interest.php). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, obj);
  }

  var STATIC = false;
  fetch('store.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      STATIC = !!s.static_preview;
      if (s.demo && $('demoBar')) $('demoBar').hidden = false;
      if (!s.demo) document.querySelectorAll('[data-demo-only]').forEach(function (el) { el.remove(); });

      // business details typed once in store.json, shown wherever data-store="..." appears
      document.querySelectorAll('[data-store]').forEach(function (el) {
        var v = get(s, el.getAttribute('data-store'));
        if (typeof v === 'string' && v.trim()) el.textContent = v;
      });

      var wa = (s.whatsapp || '').replace(/\D/g, '');
      if (wa && $('footWa')) {
        $('footWa').textContent = 'WhatsApp: ' + s.whatsapp;
        $('footWa').href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hi, I have a question about The Billionaire.');
        $('footWa').target = '_blank'; $('footWa').rel = 'noopener';
      }
      if (s.email && $('footEmail')) {
        $('footEmail').textContent = 'Email: ' + s.email;
        $('footEmail').href = 'mailto:' + s.email;
      }
    })
    .catch(function () { /* page still works without these extras */ });

  /* ---------- register interest ---------- */
  var form = $('interestForm');
  if (!form) return;

  // "Tell me when it drops" buttons pre-select the topic
  var wanted = (location.hash.match(/topic=(\w+)/) || [])[1];
  try { wanted = wanted || sessionStorage.getItem('tb_interest'); } catch (e) { /* ignore */ }
  if (wanted && $('i_topic').querySelector('option[value="' + wanted + '"]')) $('i_topic').value = wanted;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('i_msg'), btn = form.querySelector('button[type="submit"]');
    var body = {
      name: $('i_name').value.trim(), contact: $('i_contact').value.trim(),
      topic: $('i_topic').value, website: $('i_web').value, consent: $('i_ok').checked
    };
    msg.className = 'err';
    if (!body.name || !body.contact) { msg.textContent = 'Enter your name and a phone number or email.'; return; }
    if (!body.consent) { msg.textContent = 'Please tick the box so we are allowed to contact you.'; return; }
    btn.disabled = true; btn.textContent = 'Sending...';
    if (STATIC) {   // client preview: nothing is saved
      setTimeout(function () {
        form.innerHTML = '<p class="ok-msg">Thank you, ' + body.name.replace(/[<>&"]/g, '') + '. You are on the list. We will be in touch.</p>' +
          '<p>Preview: on the live site this is saved for Chris to see.</p>';
      }, 500);
      return;
    }
    fetch('api/interest.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { msg.textContent = x.j.error || 'Something went wrong. Please try again.'; btn.disabled = false; btn.textContent = 'Register interest'; return; }
        form.innerHTML = '<p class="ok-msg">Thank you, ' + body.name.replace(/[<>&"]/g, '') + '. You are on the list. We will be in touch.</p>';
      })
      .catch(function () { msg.textContent = 'No connection. Please try again.'; btn.disabled = false; btn.textContent = 'Register interest'; });
  });
})();

/* remember which "Tell me when it drops" button was used */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-interest]');
  if (t) { try { sessionStorage.setItem('tb_interest', t.getAttribute('data-interest')); } catch (err) { /* ignore */ } }
});
