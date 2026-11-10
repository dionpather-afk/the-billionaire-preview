/* The Billionaire — intro animation + page interactions */
(function () {
  'use strict';

  var intro = document.getElementById('intro');
  var body = document.body;
  var timers = [];
  var mistRaf = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Browser storage can be unavailable (private mode, some embeds) — never let it break the page.
  function seenIntro() {
    try { return sessionStorage.getItem('tb_intro_seen') === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem('tb_intro_seen', '1'); } catch (e) { /* ignore */ }
  }
  function forceIntro() {
    return /[?&]intro=1\b/.test(window.location.search) || window.location.hash === '#intro';
  }

  /* ---------------- Spray sound (made in the browser, no audio file) ---------------- */
  var audio = null;
  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }
  function playSpraySound(seconds) {
    if (!audio) return;
    try {
      var ctx = audio, now = ctx.currentTime, len = Math.ceil(ctx.sampleRate * (seconds + 0.6));
      var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;           // white noise = hiss

      var src = ctx.createBufferSource(); src.buffer = buf;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      var peak = ctx.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 6500; peak.Q.value = 0.8; peak.gain.value = 9;
      var env = ctx.createGain();
      var comp = ctx.createDynamicsCompressor();                            // makes it loud without crackling
      comp.threshold.value = -30; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.2;
      var master = ctx.createGain(); master.gain.value = 1.9;                // VERY loud on purpose (peaks just under the maximum)

      // envelope: sharp "pssst" attack, long full spray, soft tail
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(1.0, now + 0.03);
      env.gain.setValueAtTime(1.0, now + seconds * 0.15);
      env.gain.linearRampToValueAtTime(0.85, now + seconds * 0.85);
      env.gain.exponentialRampToValueAtTime(0.0001, now + seconds + 0.45);

      src.connect(hp); hp.connect(peak); peak.connect(env); env.connect(comp); comp.connect(master); master.connect(ctx.destination);

      // nozzle "click" at the very start
      var click = ctx.createBufferSource(); click.buffer = buf;
      var cg = ctx.createGain(); cg.gain.setValueAtTime(1.0, now); cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      var cbp = ctx.createBiquadFilter(); cbp.type = 'bandpass'; cbp.frequency.value = 2500; cbp.Q.value = 3;
      click.connect(cbp); cbp.connect(cg); cg.connect(master);

      src.start(now); src.stop(now + seconds + 0.6);
      click.start(now); click.stop(now + 0.05);
    } catch (e) { /* sound is a bonus; never break the intro */ }
  }

  /* ---------------- Mist spray (canvas particles) ---------------- */
  var SPRAY_SECONDS = 2.6;
  function sprayMist() {
    var canvas = document.getElementById('mist');
    var bottle = intro.querySelector('.intro-bottle');
    if (!canvas || !canvas.getContext || !bottle) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // one soft mist puff drawn once, then stamped thousands of times (fast)
    function puff(rgb) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.4, 'rgba(' + rgb + ',.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
    }
    var white = puff('255,255,255'), mint = puff('175,240,215');

    var r = bottle.getBoundingClientRect();
    var ox = r.left + r.width * 0.24;      // top-left of the cap
    var oy = r.top + r.height * 0.06;
    var scale = Math.max(0.6, r.height / 680);
    var parts = [], MAX = 2200;
    var start = performance.now(), emitFor = SPRAY_SECONDS * 1000;

    function emit(n, strength) {
      for (var i = 0; i < n && parts.length < MAX; i++) {
        var ang = Math.PI * 1.1 + (Math.random() - 0.5) * 0.9;            // wide up-left cone
        var spd = (2 + Math.random() * 11) * scale * strength;
        var droplet = Math.random() < 0.18;                                  // fine fast droplets + soft cloud
        parts.push({
          x: ox + (Math.random() - 0.5) * 8, y: oy + (Math.random() - 0.5) * 8,
          vx: Math.cos(ang) * spd * (droplet ? 1.4 : 1), vy: Math.sin(ang) * spd * 0.7 - 0.4 * scale + (Math.random() - 0.5) * 1.2 * scale,
          r: (droplet ? 0.8 + Math.random() * 1.4 : 4 + Math.random() * 9) * scale,
          grow: droplet ? 0.02 : 0.42,
          a: droplet ? 0.4 + Math.random() * 0.3 : 0.03 + Math.random() * 0.045,
          life: 0, max: droplet ? 700 + Math.random() * 700 : 2200 + Math.random() * 2800,
          img: Math.random() < 0.3 ? mint : white
        });
      }
    }

    var last = start;
    function frame(now) {
      var t = now - start, dt = Math.min(40, now - last); last = now;
      if (t < emitFor) {
        var strength = t < 200 ? 1.35 : 1;                                   // hard first burst
        emit(Math.round(26 * dt / 16), strength);
      }
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';                          // soft, never blown-out white
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life += dt;
        var k = 1 - p.life / p.max;
        if (k <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt / 16; p.y += p.vy * dt / 16;
        p.vx *= 0.972; p.vy = p.vy * 0.972 - 0.012 * scale;                 // slows down, rises like a cloud
        p.vx += (Math.random() - 0.5) * 0.15 * scale;                        // gentle swirl
        p.r += p.grow * scale * dt / 16;                                     // mist spreads out
        ctx.globalAlpha = p.a * k;
        ctx.drawImage(p.img, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      ctx.globalAlpha = 1;
      if (t < emitFor || parts.length) mistRaf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    }
    playSpraySound(SPRAY_SECONDS);
    mistRaf = requestAnimationFrame(frame);
  }

  /* ---------------- Timeline ---------------- */
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function endIntro() {
    timers.forEach(clearTimeout); timers = [];
    if (mistRaf) cancelAnimationFrame(mistRaf);
    markSeen();
    intro.classList.add('done');
    body.classList.remove('intro-active');
    setTimeout(function () { intro.classList.add('off'); }, 1100);
    revealVisible();
  }

  function playIntro() {
    intro.className = '';
    body.classList.add('intro-active');
    window.scrollTo(0, 0);

    if (reduceMotion) {           // still version: logo + tagline, then the site
      intro.classList.add('s4', 's5');
      at(2200, endIntro);
      return;
    }
    at(250, function () { intro.classList.add('s1'); });   // marble, spotlight, bottle rises
    at(2300, function () { intro.classList.add('s2'); });  // light sweeps across glass
    at(3000, sprayMist);                                     // long, loud spray of mist (2.6s)
    at(3200, function () { intro.classList.add('s3'); });  // slow push in
    at(7300, function () { intro.classList.add('s4'); });  // mist settles, bottle fades, logo writes on
    at(8500, function () { intro.classList.add('s5'); });  // tagline
    at(10600, endIntro);                                     // into the site
  }

  if (intro) {
    document.getElementById('introSkip').addEventListener('click', endIntro);
    if (seenIntro() && !forceIntro()) {
      intro.classList.add('done', 'off');
      body.classList.remove('intro-active');
    } else {
      // wait for the bottle image so the reveal never shows an empty frame
      var gate = document.getElementById('introGate');
      if (reduceMotion) { gate.classList.add('gone'); playIntro(); }
      else {
        // browsers only allow sound after a tap, so the intro starts on "Tap to enter"
        document.getElementById('introEnter').addEventListener('click', function () {
          unlockAudio();
          gate.classList.add('gone');
          playIntro();
        });
      }
    }
    var replay = document.getElementById('replayLink');
    if (replay) replay.addEventListener('click', function (e) {
      e.preventDefault();
      unlockAudio();                                   // the click itself allows the sound
      document.getElementById('introGate').classList.add('gone');
      intro.classList.remove('off');
      requestAnimationFrame(playIntro);
    });
  }

  /* ---------------- Mobile menu ---------------- */
  var toggle = document.getElementById('menuToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = body.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.site-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------------- Scroll reveal ---------------- */
  var reveals = document.querySelectorAll('.reveal');
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  function revealVisible() {
    reveals.forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); });
  }
  if (!intro || intro.classList.contains('off')) revealVisible();

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
