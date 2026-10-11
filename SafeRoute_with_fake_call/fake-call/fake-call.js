/*!
 * Tether Fake Call - drop-in module, no dependencies, no build step.
 *
 * Adds a "Fake call" button. Tapping it opens a small sheet: pick who calls
 * and when. The phone then "rings" with a full-screen call screen; after you
 * accept, the other person talks to you using voice clips pre-generated with
 * ElevenLabs (audio/<persona>/<line>.mp3). If a clip is missing, the browser's
 * built-in voice reads the line instead, so it always works.
 *
 * Zero data: no accounts, no storage, no analytics, no network calls except
 * loading this folder's own static files. Nothing is recorded.
 *
 * Use:
 *   <script src="/fake-call/fake-call.js" defer></script>
 * Optional attributes on that tag:
 *   data-button="false"      hide the floating button (use your own button)
 *   data-position="left"     put the floating button bottom-left
 *   data-captions="true"     show the spoken text on the call screen
 *   data-base="/some/path/"  where this folder is served from
 *
 * API (window.FakeCall):
 *   FakeCall.open()                     show the options sheet
 *   FakeCall.start('mom', {delay: 0})   start a call (delay in ms)
 *   FakeCall.next()                     same as tapping "Next line" (only while a call is active)
 *   FakeCall.hangup()                   end / cancel whatever is happening
 *   FakeCall.configure({captions: true})
 *   FakeCall.phase                      'idle' | 'scheduled' | 'ringing' | 'active' | 'ended'
 * Event: window 'fakecall', event.detail = { phase, persona }  (pause your
 * own soundscape while phase is 'ringing' or 'active', for example).
 */
(function () {
  'use strict';
  if (window.FakeCall) { return; }

  // ------------------------------------------------------------------ config
  var script = document.currentScript;
  var cfg = { base: '/fake-call/', captions: false, ringTimeoutMs: 25000 };
  var showButton = true;
  var side = 'right';
  if (script) {
    try { if (script.src) { cfg.base = new URL('./', script.src).href; } } catch (e) { /* keep default */ }
    var ds = script.dataset || {};
    if (ds.base) { cfg.base = ds.base.replace(/\/*$/, '/'); }
    if (ds.button === 'false') { showButton = false; }
    if (ds.position === 'left') { side = 'left'; }
    if (ds.captions === 'true') { cfg.captions = true; }
  }

  var data = null;          // contents of scripts.json
  var dataPromise = null;
  var ui = null;            // DOM references, built once

  var state = {
    phase: 'idle',          // idle | scheduled | ringing | active | ended
    busy: false,
    delayMs: 0,
    persona: null,
    run: null,
    ringTimer: null, ringTimeout: null, schedTimer: null,
    pillTimer: null, clockTimer: null, endTimer: null,
    startedAt: 0
  };

  // ----------------------------------------------------------------- helpers
  function h(tag, props, kids) {
    var n = document.createElement(tag);
    var k;
    if (props) {
      for (k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) { continue; }
        if (k === 'class') { n.className = props[k]; }
        else if (k === 'text') { n.textContent = props[k]; }
        else { n.setAttribute(k, props[k]); }
      }
    }
    (kids || []).forEach(function (c) { if (c) { n.appendChild(c); } });
    return n;
  }
  function svg(path) {
    var s = document.createElement('span');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + path + '"/></svg>';
    return s.firstChild;
  }
  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }
  function initial(name) { return (String(name || '?').trim().charAt(0) || '?').toUpperCase(); }
  function hue(name) {
    var n = 0, s = String(name || '');
    for (var i = 0; i < s.length; i++) { n = (n * 31 + s.charCodeAt(i)) % 360; }
    return n;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Material Design icon paths (Apache 2.0)
  var PATH_PHONE = 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';
  var PATH_MIC_OFF = 'M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z';
  var PATH_KEYPAD = 'M12 19c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zM6 1c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm12-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 12c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z';
  var PATH_VOLUME = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z';
  var PATH_ADD = 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z';
  var PATH_VIDEO = 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z';
  var PATH_PEOPLE = 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z';

  // --------------------------------------------------------------- data load
  function loadData() {
    if (data) { return Promise.resolve(data); }
    if (!dataPromise) {
      dataPromise = fetch(cfg.base + 'scripts.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) { throw new Error('could not load ' + cfg.base + 'scripts.json (HTTP ' + r.status + ')'); }
          return r.json();
        })
        .then(function (d) {
          if (!d || !Array.isArray(d.personas) || !d.personas.length) { throw new Error('scripts.json has no personas'); }
          data = d;
          return d;
        })
        .catch(function (e) { dataPromise = null; throw e; });
    }
    return dataPromise;
  }
  function findPersona(d, id) {
    for (var i = 0; i < d.personas.length; i++) { if (d.personas[i].id === id) { return d.personas[i]; } }
    return null;
  }

  // ------------------------------------------------------------------- audio
  var audioEl = null, audioCtx = null, silentUri = null;

  function getAudioEl() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.preload = 'auto';
      audioEl.setAttribute('playsinline', '');
    }
    return audioEl;
  }

  // A tiny valid silent WAV, used to "unlock" audio on iOS Safari.
  function silentWavUri() {
    if (silentUri) { return silentUri; }
    var samples = 800, rate = 8000, i;
    var buf = new ArrayBuffer(44 + samples), v = new DataView(buf);
    function str(o, s) { for (var k = 0; k < s.length; k++) { v.setUint8(o + k, s.charCodeAt(k)); } }
    str(0, 'RIFF'); v.setUint32(4, 36 + samples, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, samples, true);
    for (i = 0; i < samples; i++) { v.setUint8(44 + i, 128); }
    var bytes = new Uint8Array(buf), bin = '';
    for (i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]); }
    silentUri = 'data:audio/wav;base64,' + btoa(bin);
    return silentUri;
  }

  // Must run inside a tap/click. Browsers (iOS Safari especially) only let
  // pages play sound later if sound was started by the user once.
  function primeAudio() {
    try {
      var a = getAudioEl();
      a.src = silentWavUri();
      var p = a.play();
      if (p && p.catch) { p.catch(function () { /* ignore */ }); }
    } catch (e) { /* ignore */ }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === 'suspended') { audioCtx.resume(); }
      }
    } catch (e) { /* ignore */ }
    try {
      if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
        var u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch (e) { /* ignore */ }
  }

  // ---- ringtone (synthesised, so there is no audio file to ship) ----
  function ringBurst(t, dur) {
    var osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    var freqs = [880, 1175], k;
    osc.type = 'sine';
    for (k = 0; k * 0.08 < dur; k++) { osc.frequency.setValueAtTime(freqs[k % 2], t + k * 0.08); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.setValueAtTime(0.22, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function ringCycle() {
    if (audioCtx) {
      var t = audioCtx.currentTime + 0.02;
      ringBurst(t, 0.5);
      ringBurst(t + 0.65, 0.5);
    }
    try { if (navigator.vibrate) { navigator.vibrate([500, 150, 500]); } } catch (e) { /* ignore */ }
  }
  function startRing() {
    stopRing();
    ringCycle();
    state.ringTimer = setInterval(ringCycle, 3000);
  }
  function stopRing() {
    if (state.ringTimer) { clearInterval(state.ringTimer); state.ringTimer = null; }
    try { if (navigator.vibrate) { navigator.vibrate(0); } } catch (e) { /* ignore */ }
  }

  // ---- keep the screen on during the call ----
  var wake = null;
  function acquireWake() {
    try {
      if ('wakeLock' in navigator && !wake) {
        navigator.wakeLock.request('screen').then(function (lock) {
          wake = lock;
          lock.addEventListener('release', function () { wake = null; });
        }).catch(function () { /* not allowed here, fine */ });
      }
    } catch (e) { /* ignore */ }
  }
  function releaseWake() {
    try { if (wake) { wake.release(); } } catch (e) { /* ignore */ }
    wake = null;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.phase !== 'idle') { acquireWake(); }
  });

  // ---------------------------------------------------- conversation engine
  // A "run" is one call. Cancelling it stops every pending wait and sound.
  function newRun() { return { cancelled: false, cancels: [] }; }
  function cancelRun(run) {
    if (!run) { return; }
    run.cancelled = true;
    var fns = run.cancels.slice();
    run.cancels.length = 0;
    fns.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }
  function unregister(run, fn) {
    var i = run.cancels.indexOf(fn);
    if (i >= 0) { run.cancels.splice(i, 1); }
  }

  function wait(run, ms) {
    return new Promise(function (resolve) {
      if (run.cancelled) { resolve(false); return; }
      var t = setTimeout(function () { unregister(run, cancel); resolve(true); }, ms);
      function cancel() { clearTimeout(t); resolve(false); }
      run.cancels.push(cancel);
    });
  }

  // Resolves 'ok' | 'error' | 'cancel'
  function playClip(run, url) {
    return new Promise(function (resolve) {
      var a = getAudioEl(), settled = false, safety = null;
      function done(result) {
        if (settled) { return; }
        settled = true;
        clearTimeout(safety);
        a.onended = null; a.onerror = null; a.onplaying = null;
        unregister(run, cancel);
        resolve(result);
      }
      function cancel() { try { a.pause(); } catch (e) { /* ignore */ } done('cancel'); }
      run.cancels.push(cancel);
      a.onended = function () { done('ok'); };
      a.onerror = function () { done('error'); };
      a.onplaying = function () {
        var ms = isFinite(a.duration) ? a.duration * 1000 : 30000;
        clearTimeout(safety);
        safety = setTimeout(function () { done('ok'); }, ms + 3000);
      };
      safety = setTimeout(function () { done('error'); }, 10000);   // never started
      try {
        a.src = url;
        var p = a.play();
        if (p && p.catch) { p.catch(function () { done('error'); }); }
      } catch (e) { done('error'); }
    });
  }

  function pickVoice(synth, lang, hint) {
    var voices = synth.getVoices() || [];
    if (!voices.length) { return null; }
    var want = String(lang).toLowerCase().replace('_', '-');
    function norm(v) { return String(v.lang || '').toLowerCase().replace('_', '-'); }
    var pool = voices.filter(function (v) { return norm(v).indexOf(want) === 0; });
    if (!pool.length) { pool = voices.filter(function (v) { return norm(v).indexOf(want.split('-')[0]) === 0; }); }
    if (hint) {
      var m = pool.filter(function (v) { return v.name.toLowerCase().indexOf(String(hint).toLowerCase()) >= 0; });
      if (m.length) { return m[0]; }
    }
    return pool[0] || null;
  }

  // Fallback voice (the browser's built-in text to speech).
  function speak(run, text, persona) {
    return new Promise(function (resolve) {
      var estimate = Math.max(1500, text.length * 70);   // rough speaking time in ms
      var started = Date.now(), settled = false, timers = [];
      var synth = window.speechSynthesis;
      function done(result) {
        if (settled) { return; }
        settled = true;
        timers.forEach(clearTimeout);
        unregister(run, cancel);
        resolve(result);
      }
      function cancel() { try { if (synth) { synth.cancel(); } } catch (e) { /* ignore */ } done('cancel'); }
      run.cancels.push(cancel);
      // If no voice is available, stay silent but keep the call's natural pacing.
      function finishAfterEstimate() {
        if (settled) { return; }
        var left = estimate - (Date.now() - started);
        timers.push(setTimeout(function () { done('ok'); }, Math.max(0, left)));
      }
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { finishAfterEstimate(); return; }
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = persona.lang || 'en-US';
        u.rate = persona.ttsRate || 1;
        u.pitch = persona.ttsPitch || 1;
        var v = pickVoice(synth, u.lang, persona.ttsVoice);
        if (v) { u.voice = v; }
        u.onend = function () { done('ok'); };
        u.onerror = function () { finishAfterEstimate(); };
        timers.push(setTimeout(function () { done('ok'); }, estimate * 2 + 4000));   // events never fired
        synth.cancel();
        synth.speak(u);
      } catch (e) { finishAfterEstimate(); }
    });
  }

  function showCaption(text) {
    if (!ui) { return; }
    ui.caption.textContent = text || '';
    ui.caption.hidden = !(cfg.captions && text);
  }

  function playLine(run, persona, line) {
    showCaption(line.text);
    var url = cfg.base + 'audio/' + encodeURIComponent(persona.id) + '/' + encodeURIComponent(line.id) + '.mp3';
    return playClip(run, url).then(function (result) {
      if (result === 'error' && !run.cancelled) {
        if (window.console && console.info) { console.info('[FakeCall] no clip at ' + url + ' - using the browser voice for this line'); }
        return speak(run, line.text, persona);
      }
      return result;
    }).then(function (result) {
      if (!run.cancelled) { showCaption(''); }
      return result;
    });
  }

  // Tap-to-advance conversation. The greeting (first line) plays by itself when
  // the call is accepted; after that, every tap on "Next line" plays the next
  // one. A tap while a line is still playing cuts it off and moves on.
  // A call is a "run"; each spoken line gets its own child run (run.sub) so a
  // tap can stop just that line without ending the whole call.
  function newConversation() {
    var run = newRun();
    run.sub = null;        // the line being spoken (or waited for) right now
    run.idx = 0;           // next scripted line to play
    run.last = null;       // last line played, to avoid saying the same one twice in a row
    run.lastTap = 0;
    run.cancels.push(function () { if (run.sub) { cancelRun(run.sub); } });
    return run;
  }

  function pickNext(run, persona) {
    var lines = persona.lines || [], fillers = persona.fillers || [];
    if (run.idx < lines.length) { return lines[run.idx++]; }
    // Script used up: never go back to the greeting (lines[0]). Keep repeating
    // the follow-up lines and fillers in random order, never the same one twice running.
    var pool = lines.slice(1).concat(fillers);
    if (!pool.length) { pool = lines.concat(fillers); }
    if (!pool.length) { return null; }
    var pick, tries = 0;
    do { pick = pool[Math.floor(Math.random() * pool.length)]; tries++; }
    while (pool.length > 1 && pick === run.last && tries < 20);
    return pick;
  }

  async function sayNext(run, persona, delay) {
    if (run.cancelled) { return; }
    if (run.sub) { cancelRun(run.sub); }       // stop whatever is being said
    var sub = newRun();
    run.sub = sub;
    if (delay > 0 && !(await wait(sub, delay))) { return; }
    if (sub.cancelled || run.cancelled) { return; }
    var line = pickNext(run, persona);         // picked only now, so a skipped wait never loses a line
    if (!line) { return; }
    run.last = line;
    await playLine(sub, persona, line);
  }

  function logFail(e) { if (window.console) { console.error('[FakeCall]', e); } }

  function nextTap() {
    var run = state.run;
    if (state.phase !== 'active' || !run || run.cancelled) { return; }
    var now = Date.now();
    if (now - run.lastTap < 350) { return; }   // ignore accidental double taps
    run.lastTap = now;
    sayNext(run, state.persona, 0).catch(logFail);
  }

  // ---------------------------------------------------------------------- UI
  function buildUI() {
    if (ui) { return ui; }
    var root = h('div', { class: 'fc-root' });
    root.style.display = 'none';          // revealed once the CSS has loaded

    // floating button
    var fab = h('button', { class: 'fc-fab fc-' + side, type: 'button', 'aria-label': 'Fake call: open options' }, [
      svg(PATH_PHONE), h('span', { text: 'Fake call' })
    ]);
    fab.firstChild.setAttribute('width', '22'); fab.firstChild.setAttribute('height', '22');
    fab.firstChild.firstChild.setAttribute('fill', 'currentColor');
    fab.addEventListener('click', function () { api.open(); });
    if (!showButton) { fab.hidden = true; }

    // options sheet
    var chips = h('div', { class: 'fc-chips', role: 'radiogroup', 'aria-label': 'When should it ring' });
    [[0, 'Now'], [10000, 'In 10 s'], [30000, 'In 30 s']].forEach(function (opt) {
      var b = h('button', { class: 'fc-chip', type: 'button', role: 'radio', 'aria-checked': String(opt[0] === state.delayMs), text: opt[1] });
      b.addEventListener('click', function () {
        state.delayMs = opt[0];
        Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-checked', String(c === b)); });
      });
      chips.appendChild(b);
    });
    var list = h('div', { class: 'fc-personas' });
    var msg = h('p', { class: 'fc-error', role: 'alert' });
    msg.hidden = true;
    var capInput = h('input', { type: 'checkbox', id: 'fc-captions' });
    capInput.checked = cfg.captions;
    capInput.addEventListener('change', function () { cfg.captions = capInput.checked; if (!cfg.captions) { showCaption(''); } });
    var closeBtn = h('button', { class: 'fc-close', type: 'button', text: 'Close' });
    closeBtn.addEventListener('click', closeSheet);
    var sheet = h('div', { class: 'fc-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fc-sheet-title' }, [
      h('h2', { id: 'fc-sheet-title', text: 'Fake call' }),
      h('p', { class: 'fc-sub', text: 'Your phone rings and someone sounds like they are waiting for you. Nothing is recorded or sent anywhere.' }),
      h('div', { class: 'fc-label', text: 'Ring me' }), chips,
      h('div', { class: 'fc-label', text: 'Who is calling' }), list, msg,
      h('label', { class: 'fc-check', for: 'fc-captions' }, [capInput, h('span', { text: 'Show captions during the call' })]),
      h('p', { class: 'fc-note', text: 'Keep your screen on. Browsers pause sound when the phone locks, so it will not ring from a locked screen.' }),
      closeBtn
    ]);
    var backdrop = h('div', { class: 'fc-backdrop' }, [sheet]);
    backdrop.hidden = true;
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) { closeSheet(); } });

    // "ringing in N s" pill
    var pillText = h('span', { text: '' });
    var pillCancel = h('button', { type: 'button', text: 'Cancel' });
    pillCancel.addEventListener('click', function () { api.hangup(); });
    var pill = h('div', { class: 'fc-pill', role: 'status' }, [pillText, pillCancel]);
    pill.hidden = true;

    // call screen
    var avatar = h('div', { class: 'fc-avatar fc-avatar-lg', 'aria-hidden': 'true' });
    var nameEl = h('h2', { class: 'fc-name' });
    var status = h('p', { class: 'fc-status', 'aria-live': 'polite' });
    var caption = h('p', { class: 'fc-caption' });
    caption.hidden = true;
    function decoTile(t) {
      return h('div', { class: 'fc-tile', 'aria-hidden': 'true' }, [h('span', null, [svg(t[1])]), h('span', { text: t[0] })]);
    }
    // The one real button in the grid: it looks like the usual "add call" tile but says "next".
    var nextBtn = h('button', { class: 'fc-tile fc-next', type: 'button', 'aria-label': 'Next line: make them say the next thing' }, [
      h('span', null, [svg(PATH_ADD)]), h('span', { text: 'next' })
    ]);
    nextBtn.addEventListener('click', nextTap);
    var grid = h('div', { class: 'fc-grid' }, [
      decoTile(['mute', PATH_MIC_OFF]), decoTile(['keypad', PATH_KEYPAD]), decoTile(['speaker', PATH_VOLUME]),
      nextBtn, decoTile(['video', PATH_VIDEO]), decoTile(['contacts', PATH_PEOPLE])
    ]);

    function actionBtn(cls, label, onClick) {
      var b = h('button', { class: 'fc-act ' + cls, type: 'button', 'aria-label': label }, [
        h('span', { class: 'fc-round' }, [svg(PATH_PHONE)]), h('span', { text: label })
      ]);
      b.addEventListener('click', onClick);
      return b;
    }
    var decline = actionBtn('fc-decline', 'Decline', function () { api.hangup(); });
    var accept = actionBtn('fc-accept', 'Accept', accept_);
    var end = actionBtn('fc-end', 'End', function () { api.hangup(); });
    var incoming = h('div', { class: 'fc-actions fc-actions-incoming' }, [decline, accept]);
    var activeBar = h('div', { class: 'fc-actions fc-actions-active' }, [end]);

    var call = h('div', { class: 'fc-call', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Phone call', 'data-phase': 'idle' }, [
      h('div', { class: 'fc-call-top' }, [avatar, nameEl, status, caption]),
      grid,
      h('div', { class: 'fc-call-bottom' }, [incoming, activeBar])
    ]);
    call.hidden = true;
    call.querySelector('.fc-call-bottom').style.width = '100%';
    call.querySelector('.fc-call-bottom').style.display = 'flex';
    call.querySelector('.fc-call-bottom').style.justifyContent = 'center';

    root.appendChild(fab);
    root.appendChild(pill);
    root.appendChild(backdrop);
    root.appendChild(call);
    document.body.appendChild(root);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') { return; }
      if (!backdrop.hidden) { closeSheet(); }
      else if (state.phase === 'ringing') { api.hangup(); }
    });

    ui = {
      root: root, fab: fab, backdrop: backdrop, sheet: sheet, chips: chips, list: list, msg: msg, capInput: capInput,
      pill: pill, pillText: pillText, call: call, avatar: avatar, name: nameEl, status: status, caption: caption,
      accept: accept, end: end, next: nextBtn
    };
    return ui;
  }

  function loadCss(root) {
    var reveal = function () { root.style.display = ''; };
    try {
      var link = h('link', { rel: 'stylesheet', href: cfg.base + 'fake-call.css' });
      link.onload = reveal;
      link.onerror = function () {
        if (window.console) { console.warn('[FakeCall] could not load ' + cfg.base + 'fake-call.css'); }
        reveal();
      };
      document.head.appendChild(link);
    } catch (e) { reveal(); }
    setTimeout(reveal, 3000);
  }

  function renderPersonas(d) {
    clear(ui.list);
    d.personas.forEach(function (p) {
      var av = h('span', { class: 'fc-avatar', text: initial(p.name), 'aria-hidden': 'true' });
      av.style.background = 'hsl(' + hue(p.name) + ',45%,42%)';
      var btn = h('button', { class: 'fc-persona', type: 'button' }, [
        av,
        h('span', { class: 'fc-ptext' }, [h('strong', { text: p.name }), h('small', { text: p.blurb || '' })]),
        h('span', { class: 'fc-go', text: 'Call' })
      ]);
      btn.setAttribute('aria-label', 'Call from ' + p.name + (p.blurb ? '. ' + p.blurb : ''));
      btn.addEventListener('click', function () { api.start(p.id); });
      ui.list.appendChild(btn);
    });
  }

  function showError(text) {
    if (!ui) { return; }
    ui.msg.textContent = text || '';
    ui.msg.hidden = !text;
  }

  function openSheet() {
    buildUI();
    primeAudio();
    showError('');
    ui.capInput.checked = cfg.captions;
    ui.backdrop.hidden = false;
    loadData().then(function (d) {
      renderPersonas(d);
      var first = ui.list.querySelector('button');
      if (first) { first.focus(); }
    }).catch(function (e) {
      showError('Could not load the call scripts (' + e.message + '). Check that the fake-call folder is being served.');
    });
  }
  function closeSheet() { if (ui) { ui.backdrop.hidden = true; } }

  // ------------------------------------------------------------- call flow
  function setPhase(p) {
    state.phase = p;
    if (ui) { ui.call.setAttribute('data-phase', p); }
    try {
      window.dispatchEvent(new CustomEvent('fakecall', { detail: { phase: p, persona: state.persona ? state.persona.id : null } }));
    } catch (e) { /* ignore */ }
  }

  function fillCall(persona) {
    ui.name.textContent = persona.name;
    ui.avatar.textContent = initial(persona.name);
    ui.avatar.style.background = 'hsl(' + hue(persona.name) + ',45%,42%)';
    ui.call.setAttribute('aria-label', 'Phone call with ' + persona.name);
    showCaption('');
  }

  function showPill(ms) {
    var end = Date.now() + ms;
    function update() {
      var s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      ui.pillText.textContent = 'Ringing in ' + s + ' s';
    }
    update();
    ui.pill.hidden = false;
    clearInterval(state.pillTimer);
    state.pillTimer = setInterval(update, 250);
  }
  function hidePill() {
    clearInterval(state.pillTimer);
    state.pillTimer = null;
    if (ui) { ui.pill.hidden = true; }
  }

  function ring() {
    state.schedTimer = null;
    hidePill();
    setPhase('ringing');
    ui.status.textContent = 'mobile';
    ui.call.hidden = false;
    startRing();
    clearTimeout(state.ringTimeout);
    state.ringTimeout = setTimeout(function () { if (state.phase === 'ringing') { api.hangup(); } }, cfg.ringTimeoutMs);
    ui.accept.focus();
  }

  function tickClock() {
    var s = Math.floor((Date.now() - state.startedAt) / 1000);
    ui.status.textContent = Math.floor(s / 60) + ':' + pad2(s % 60);
  }

  function accept_() {
    if (state.phase !== 'ringing') { return; }
    clearTimeout(state.ringTimeout);
    stopRing();
    primeAudio();
    setPhase('active');
    state.startedAt = Date.now();
    tickClock();
    clearInterval(state.clockTimer);
    state.clockTimer = setInterval(tickClock, 1000);
    showCaption('');
    var run = newConversation();
    state.run = run;
    var first = (state.persona.lines || [])[0];
    var pause = first && first.pauseBefore != null ? first.pauseBefore : 1200;
    sayNext(run, state.persona, pause).catch(logFail);   // the greeting; the rest waits for taps
    ui.end.focus();
  }

  function closeCallScreen() {
    clearTimeout(state.endTimer);
    clearTimeout(state.ringTimeout);
    clearInterval(state.clockTimer);
    stopRing();
    hidePill();
    releaseWake();
    if (ui) { ui.call.hidden = true; }
    state.busy = false;
    setPhase('idle');
  }

  function hangup() {
    var phase = state.phase;
    if (phase === 'idle' || phase === 'ended') { return; }
    if (phase === 'scheduled') {
      clearTimeout(state.schedTimer);
      state.schedTimer = null;
      closeCallScreen();
      return;
    }
    if (phase === 'ringing') { closeCallScreen(); return; }
    // active
    cancelRun(state.run);
    state.run = null;
    clearInterval(state.clockTimer);
    try { getAudioEl().pause(); } catch (e) { /* ignore */ }
    try { if (window.speechSynthesis) { window.speechSynthesis.cancel(); } } catch (e) { /* ignore */ }
    showCaption('');
    ui.status.textContent = 'call ended';
    setPhase('ended');
    state.endTimer = setTimeout(closeCallScreen, 900);
  }

  function start(personaId, opts) {
    opts = opts || {};
    if (state.phase !== 'idle' || state.busy) { return Promise.resolve(false); }
    state.busy = true;
    buildUI();
    primeAudio();                              // keep this inside the tap
    var delay = opts.delay != null ? Number(opts.delay) : state.delayMs;
    return loadData().then(function (d) {
      var persona = (personaId && findPersona(d, personaId)) || d.personas[0];
      state.persona = persona;
      fillCall(persona);
      closeSheet();
      acquireWake();
      if (delay > 0) {
        setPhase('scheduled');
        showPill(delay);
        state.schedTimer = setTimeout(ring, delay);
      } else {
        ring();
      }
      return true;
    }).catch(function (e) {
      state.busy = false;
      if (window.console) { console.error('[FakeCall] could not start:', e); }
      showError('Could not load the call scripts (' + e.message + '). Check that the fake-call folder is being served.');
      if (ui && ui.backdrop.hidden) { ui.backdrop.hidden = false; }
      return false;
    });
  }

  // --------------------------------------------------------------- public API
  var api = {
    open: openSheet,
    close: closeSheet,
    start: start,
    hangup: hangup,
    next: nextTap,
    configure: function (o) {
      if (!o) { return; }
      if (typeof o.captions === 'boolean') { cfg.captions = o.captions; if (ui) { ui.capInput.checked = o.captions; } }
      if (o.base) { cfg.base = String(o.base).replace(/\/*$/, '/'); }
      if (o.data && Array.isArray(o.data.personas)) { data = o.data; }
    },
    get phase() { return state.phase; }
  };
  window.FakeCall = api;

  function init() {
    buildUI();
    loadCss(ui.root);
    loadData().catch(function () { /* shown later if the user opens the sheet */ });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();