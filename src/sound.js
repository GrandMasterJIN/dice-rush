// sound.js — Dice Rush procedural sound effects via Web Audio API
// Casino aesthetic: warm, soft, felt-appropriate. Nothing harsh or alarming.
// All sounds generated programmatically — no audio files required.
// Mute state persisted in localStorage under 'diceRush_muted'.

var _ctx   = null;
var _muted = localStorage.getItem('diceRush_muted') === '1';

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ─── MUTE TOGGLE ─────────────────────────────────────────────────────────────
export function isMuted()     { return _muted; }
export function setMuted(val) { _muted = !!val; localStorage.setItem('diceRush_muted', _muted ? '1' : '0'); }
export function toggleMute()  { setMuted(!_muted); return _muted; }

// ─── LOW-LEVEL HELPERS ────────────────────────────────────────────────────────

// Sine oscillator with smooth attack/decay — warm, no clicks
function sineNote(c, freq, startT, attackS, decayS, vol) {
  var g = c.createGain();
  g.gain.setValueAtTime(0, startT);
  g.gain.linearRampToValueAtTime(vol, startT + attackS);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + attackS + decayS);
  g.connect(c.destination);
  var o = c.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  o.connect(g);
  o.start(startT);
  o.stop(startT + attackS + decayS + 0.05);
}

// Soft filtered noise burst — wooden/felt texture
function feltThud(c, startT, freq, vol, durationS) {
  var bufSize = Math.ceil(c.sampleRate * durationS);
  var buf = c.createBuffer(1, bufSize, c.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  var filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 2.5;

  var g = c.createGain();
  g.gain.setValueAtTime(0, startT);
  g.gain.linearRampToValueAtTime(vol, startT + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + durationS);

  var src = c.createBufferSource();
  src.buffer = buf;
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(startT);
}

// Warm triangle note — rounded, soft
function triNote(c, freq, startT, attackS, decayS, vol) {
  var g = c.createGain();
  g.gain.setValueAtTime(0, startT);
  g.gain.linearRampToValueAtTime(vol, startT + attackS);
  g.gain.exponentialRampToValueAtTime(0.0001, startT + attackS + decayS);
  g.connect(c.destination);
  var o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  o.connect(g);
  o.start(startT);
  o.stop(startT + attackS + decayS + 0.05);
}

// ─── SOUNDS ───────────────────────────────────────────────────────────────────

// Dice land — gentle felt thuds, staggered per die
export function playDiceLand(count) {
  if (_muted) return;
  var c = ctx();
  var n = count || 5;
  for (var i = 0; i < n; i++) {
    var t = c.currentTime + i * 0.055 + Math.random() * 0.025;
    feltThud(c, t, 160 + Math.random() * 80, 0.22, 0.09);
  }
}

// Bank — warm coin/chip clink: two soft sine tones
export function playBank() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  sineNote(c, 880,  t,        0.005, 0.28, 0.18);
  sineNote(c, 1100, t + 0.07, 0.005, 0.22, 0.18);
  sineNote(c, 660,  t + 0.03, 0.005, 0.20, 0.15);
}

// Bust — soft dull thud, low and rounded
export function playBust() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  feltThud(c, t, 120, 0.28, 0.18);
  feltThud(c, t + 0.04, 100, 0.15, 0.14);
}

// Bolt warning (1st or 2nd bolt) — quiet low chime, gentle caution
export function playBolt() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  sineNote(c, 330, t,        0.01, 0.35, 0.12);
  sineNote(c, 277, t + 0.18, 0.01, 0.28, 0.10);
}

// Bolt penalty (3rd bolt) — two soft low tones, mild disappointment
export function playBoltPenalty() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  sineNote(c, 294, t,        0.01, 0.30, 0.14);
  sineNote(c, 247, t + 0.22, 0.01, 0.30, 0.14);
  sineNote(c, 220, t + 0.44, 0.01, 0.35, 0.16);
}

// Hot dice — warm ascending shimmer
export function playHotDice() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var notes = [440, 550, 660, 770, 880];
  notes.forEach(function(freq, i) {
    sineNote(c, freq, t + i * 0.065, 0.01, 0.25, 0.14);
  });
}

// Straight — gentle rising arpeggio (warm triangle tones)
export function playStraight() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var notes = [392, 494, 587, 698, 784]; // G4 B4 D5 F5 G5
  notes.forEach(function(freq, i) {
    triNote(c, freq, t + i * 0.07, 0.008, 0.28, 0.15);
  });
}

// Overtake — soft mid-tone double pulse, neutral
export function playOvertake() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  sineNote(c, 370, t,        0.01, 0.22, 0.13);
  sineNote(c, 370, t + 0.28, 0.01, 0.22, 0.11);
}

// Dump truck — low comedic "wump", warm and soft
export function playDumpTruck() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  // Deep low wump
  feltThud(c, t,        80,  0.30, 0.28);
  feltThud(c, t + 0.08, 65,  0.22, 0.22);
  // Soft descending sine — comedic fall
  var g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  g.connect(c.destination);
  var o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.55);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.6);
}

// Win — warm gentle fanfare (triangle chord + rising arpeggio)
export function playWin() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  // Rising arpeggio
  var melody = [523, 659, 784, 1047]; // C5 E5 G5 C6
  melody.forEach(function(freq, i) {
    triNote(c, freq, t + i * 0.11, 0.01, 0.45, 0.18);
  });
  // Soft harmony underneath
  var harmony = [330, 392, 494, 659];
  harmony.forEach(function(freq, i) {
    sineNote(c, freq, t + i * 0.11, 0.01, 0.40, 0.08);
  });
}

// Loss — soft descending notes, sad but gentle
export function playLoss() {
  if (_muted) return;
  var c = ctx();
  var t = c.currentTime;
  var notes = [392, 349, 330, 294]; // G4 F4 E4 D4
  notes.forEach(function(freq, i) {
    triNote(c, freq, t + i * 0.14, 0.01, 0.35, 0.13);
  });
}
