// sound.js — Dice Rush procedural sound effects via Web Audio API
// All sounds generated programmatically — no audio files required.
// Mute state persisted in localStorage under 'diceRush_muted'.

var _ctx  = null;  // AudioContext — created on first user gesture
var _muted = localStorage.getItem('diceRush_muted') === '1';

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ─── MUTE TOGGLE ─────────────────────────────────────────────────────────────
export function isMuted() { return _muted; }

export function setMuted(val) {
  _muted = !!val;
  localStorage.setItem('diceRush_muted', _muted ? '1' : '0');
}

export function toggleMute() {
  setMuted(!_muted);
  return _muted;
}

// ─── LOW-LEVEL HELPERS ────────────────────────────────────────────────────────
function gain(c, vol) {
  var g = c.createGain();
  g.gain.value = vol;
  g.connect(c.destination);
  return g;
}

function osc(c, type, freq, startT, endT, g) {
  var o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  o.start(startT);
  o.stop(endT);
}

function noise(c, durationS, gNode) {
  // White noise via script processor polyfill using buffer source
  var bufSize = Math.ceil(c.sampleRate * durationS);
  var buf = c.createBuffer(1, bufSize, c.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  var src = c.createBufferSource();
  src.buffer = buf;
  src.connect(gNode);
  src.start();
  return src;
}

function envelope(gainNode, c, attackT, decayT, vol) {
  var t = c.currentTime;
  gainNode.gain.cancelScheduledValues(t);
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(vol, t + attackT);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + attackT + decayT);
}

// ─── SOUND DEFINITIONS ────────────────────────────────────────────────────────

// Single die land — short dry clatter thud
function playDieLand(delay) {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime + (delay || 0);

  // Low thud — filtered noise burst
  var g1 = c.createGain();
  g1.gain.setValueAtTime(0, t);
  g1.gain.linearRampToValueAtTime(0.5, t + 0.005);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

  var filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 160 + Math.random() * 80;
  filter.Q.value = 1.2;

  var bufSize = Math.ceil(c.sampleRate * 0.1);
  var buf = c.createBuffer(1, bufSize, c.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  var src = c.createBufferSource();
  src.buffer = buf;
  src.connect(filter);
  filter.connect(g1);
  g1.connect(c.destination);
  src.start(t);

  // High click layer
  var g2 = c.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.25, t + 0.002);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  g2.connect(c.destination);
  osc(c, 'square', 800 + Math.random() * 400, t, t + 0.03, g2);
}

// Bank — chip stack click (satisfying multi-click)
export function playBank() {
  if (_muted) return;
  var c = ctx();
  var clicks = 4;
  for (var i = 0; i < clicks; i++) {
    (function(idx) {
      var t = c.currentTime + idx * 0.045;
      var g = c.createGain();
      g.gain.setValueAtTime(0.35 - idx * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      g.connect(c.destination);
      osc(c, 'square', 1200 - idx * 60, t, t + 0.04, g);
    })(i);
  }
}

// Dice roll launch — light rattling
export function playRollStart() {
  if (_muted) return;
  var c = ctx();
  var count = 8;
  for (var i = 0; i < count; i++) {
    (function(idx) {
      var delay = idx * 0.025 + Math.random() * 0.015;
      playDieLand(delay * 0.4);
    })(i);
  }
}

// Dice land — 5 staggered thuds
export function playDiceLand(count) {
  if (_muted) return;
  var n = count || 5;
  for (var i = 0; i < n; i++) {
    playDieLand(i * 0.06 + Math.random() * 0.04);
  }
}

// Bolt warning (bolt 1 or 2) — short sharp buzz
export function playBolt() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var g = c.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  g.connect(c.destination);
  osc(c, 'sawtooth', 180, t, t + 0.18, g);
  // Second buzz pulse
  var t2 = t + 0.22;
  var g2 = c.createGain();
  g2.gain.setValueAtTime(0.2, t2);
  g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.12);
  g2.connect(c.destination);
  osc(c, 'sawtooth', 160, t2, t2 + 0.12, g2);
}

// Bolt penalty — alarm buzzer (harsh)
export function playBoltPenalty() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var pulses = 3;
  for (var i = 0; i < pulses; i++) {
    (function(idx) {
      var pt = t + idx * 0.18;
      var g = c.createGain();
      g.gain.setValueAtTime(0.4, pt);
      g.gain.exponentialRampToValueAtTime(0.001, pt + 0.14);
      g.connect(c.destination);
      osc(c, 'sawtooth', 220, pt, pt + 0.14, g);
    })(i);
  }
}

// Hot dice — bright shimmer
export function playHotDice() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var notes = [880, 1100, 1320, 1760];
  notes.forEach(function(freq, i) {
    var nt = t + i * 0.07;
    var g = c.createGain();
    g.gain.setValueAtTime(0.15, nt);
    g.gain.exponentialRampToValueAtTime(0.001, nt + 0.25);
    g.connect(c.destination);
    osc(c, 'sine', freq, nt, nt + 0.25, g);
  });
}

// Win — short fanfare
export function playWin() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var notes = [
    { f: 523, d: 0.12 },   // C5
    { f: 659, d: 0.12 },   // E5
    { f: 784, d: 0.12 },   // G5
    { f: 1047, d: 0.35 },  // C6
  ];
  var offset = 0;
  notes.forEach(function(n) {
    var nt = t + offset;
    var g = c.createGain();
    g.gain.setValueAtTime(0.25, nt);
    g.gain.exponentialRampToValueAtTime(0.001, nt + n.d + 0.1);
    g.connect(c.destination);
    osc(c, 'triangle', n.f, nt, nt + n.d + 0.1, g);
    offset += n.d;
  });
  // Harmony layer
  offset = 0;
  [659, 784, 988, 1319].forEach(function(freq, i) {
    var nt = t + i * notes[i].d;
    var g = c.createGain();
    g.gain.setValueAtTime(0.1, nt);
    g.gain.exponentialRampToValueAtTime(0.001, nt + notes[i].d + 0.1);
    g.connect(c.destination);
    osc(c, 'sine', freq, nt, nt + notes[i].d + 0.1, g);
  });
}

// Loss — deflated wah-wah
export function playLoss() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var notes = [392, 349, 311, 261]; // G4 F4 Eb4 C4
  var offset = 0;
  notes.forEach(function(freq, i) {
    var nt = t + offset;
    var g = c.createGain();
    g.gain.setValueAtTime(0.2, nt);
    g.gain.exponentialRampToValueAtTime(0.001, nt + 0.22);
    g.connect(c.destination);
    osc(c, 'sawtooth', freq, nt, nt + 0.22, g);
    offset += 0.16;
  });
}

// Dump truck — comic low horn
export function playDumpTruck() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  // Low honk 1
  var g1 = c.createGain();
  g1.gain.setValueAtTime(0, t);
  g1.gain.linearRampToValueAtTime(0.45, t + 0.04);
  g1.gain.setValueAtTime(0.45, t + 0.22);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  g1.connect(c.destination);
  osc(c, 'sawtooth', 98, t, t + 0.38, g1);
  // Low honk 2 (higher pitch, 0.4s later)
  var t2 = t + 0.45;
  var g2 = c.createGain();
  g2.gain.setValueAtTime(0, t2);
  g2.gain.linearRampToValueAtTime(0.35, t2 + 0.04);
  g2.gain.setValueAtTime(0.35, t2 + 0.28);
  g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.48);
  g2.connect(c.destination);
  osc(c, 'sawtooth', 73, t2, t2 + 0.48, g2);
}

// Bust — dull thud
export function playBust() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  var filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  filter.connect(g);
  g.connect(c.destination);
  var bufSize = Math.ceil(c.sampleRate * 0.25);
  var buf = c.createBuffer(1, bufSize, c.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  var src = c.createBufferSource();
  src.buffer = buf;
  src.connect(filter);
  src.start(t);
}

// Straight / big combo — ascending arpeggio
export function playStraight() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  [440, 550, 660, 880, 1100].forEach(function(freq, i) {
    var nt = t + i * 0.055;
    var g = c.createGain();
    g.gain.setValueAtTime(0.18, nt);
    g.gain.exponentialRampToValueAtTime(0.001, nt + 0.18);
    g.connect(c.destination);
    osc(c, 'triangle', freq, nt, nt + 0.18, g);
  });
}

// Overtake — dramatic low-mid hit
export function playOvertake() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var g = c.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  g.connect(c.destination);
  osc(c, 'sawtooth', 120, t, t + 0.35, g);
  var g2 = c.createGain();
  g2.gain.setValueAtTime(0.15, t + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  g2.connect(c.destination);
  osc(c, 'sine', 240, t + 0.05, t + 0.3, g2);
}
