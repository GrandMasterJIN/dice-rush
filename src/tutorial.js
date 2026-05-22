// tutorial.js — Dice Rush onboarding & contextual hints
// Uses Driver.js for coach marks (new users) and comms panel messages (returning users)
// All Supabase state stored in user_metadata — no extra table

import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { supabase } from './supabase.js';

// ─── STATE ──────────────────────────────────────────────────────────────────────────────

var _user            = null;   // current Supabase user object
var _tutorialMode    = false;  // true = full Driver.js coach marks
var _hintsMode       = false;  // true = lightweight comms panel hints
var _driverInst      = null;   // Driver.js instance (tutorial mode only)
var _setMessage      = null;   // injected setMessage() from main.js
var _seenThisSession = new Set(); // prevents hints repeating within a session
var _stepsFired      = new Set(); // which tutorial steps have fired this game
var _disabledHints   = new Set(); // hints permanently dismissed by user (Fix 5)

// ─── INIT ────────────────────────────────────────────────────────────────────────────────

/**
 * Call at the start of every game (startGame()).
 * @param {object}   user       - Supabase user object (null if guest)
 * @param {function} setMsgFn   - main.js setMessage(text, skin) reference
 */
export function initTutorial(user, setMsgFn) {
  _user       = user;
  _setMessage = setMsgFn;
  _stepsFired = new Set();

  if (_driverInst) { _driverInst.destroy(); _driverInst = null; }

  if (!user) {
    _tutorialMode = false;
    _hintsMode    = false;
    return;
  }

  var meta              = user.user_metadata || {};
  var tutorialCompleted = meta.tutorial_completed ?? false;
  var hintsEnabled      = meta.hints_enabled      ?? true;
  // Load permanently disabled hints from user_metadata (Fix 5: disable-from-tip)
  _disabledHints = new Set(Array.isArray(meta.hints_disabled) ? meta.hints_disabled : []);

  if (!tutorialCompleted) {
    _tutorialMode = true;
    _hintsMode    = false;
  } else if (hintsEnabled) {
    _tutorialMode = false;
    _hintsMode    = true;
  } else {
    _tutorialMode = false;
    _hintsMode    = false;
  }
}

// ─── HOOK DISPATCHER ────────────────────────────────────────────────────────────────────

/**
 * Call from main.js at each teaching moment.
 * Events: 'game-start' | 'first-roll' | 'first-open' | 'first-bank' | 'first-bust' |
 *         'enter-pit' | 'enter-barrel' | 'first-bolt' | 'overtake'
 */
export function tutorialHook(event, opts) {
  if (!_tutorialMode && !_hintsMode) return;
  if (_stepsFired.has(event)) return;
  _stepsFired.add(event);

  if (_tutorialMode) {
    // Fix 1: also check session-level dedup in tutorial mode — prevents re-firing on Play Again
    if (_seenThisSession.has(event)) return;
    _seenThisSession.add(event);
    _handleTutorialStep(event, opts);
  } else {
    _handleHint(event);
  }
}

// ─── TUTORIAL STEPS (Driver.js coach marks) ───────────────────────────────────────────────

function _handleTutorialStep(event, opts) {
  switch (event) {

    case 'game-start':
      _showStep({
        element:  '#btn-roll',
        title:    '\uD83C\uDFAF Your Goal',
        body:     'Roll the dice and score points. <strong>First to reach 1,000 wins.</strong> Press Roll to begin!',
        side:     'top',
        showSkip: true,
      });
      break;

    case 'first-roll':
      _showStep({
        element: document.querySelector('.die-wrap.scored') || '#comms-panel',
        title:   '\uD83C\uDFB2 Scoring Dice',
        body:    'Only 1s and 5s score alone: a single 1 = 10 pts, a single 5 = 5 pts. <strong>Three of a kind unlocks big points</strong> \u2014 three 1s = 100 pts, three 5s = 50 pts, three of anything else = face \xD7 10. Bank to keep your points \u2014 or roll again for more!',
        side:    'top',
      });
      break;

    // Fix 2: first-open fires specifically when the opening bank happens (isOpen transition)
    case 'first-open':
      _showStep({
        element: '#lock-human-wrap',
        title:   '\uD83D\uDD13 You\'re Open!',
        body:    'Banking saved your points and <strong>opened your account.</strong> Watch your score climb the thermometer. You needed 50+ pts to open \u2014 done!',
        side:    'top',
      });
      break;

    case 'first-bank':
      // Generic bank — teaching moment handled by first-open on the opening bank
      break;

    case 'first-bust':
      _showStep({
        element: '#comms-panel',
        title:   '\uD83D\uDCA5 Bust!',
        body:    '<strong>No scoring dice</strong> \u2014 you lose all points earned this turn. The turn passes to your opponent. It happens to everyone!',
        side:    'top',
      });
      break;

    case 'enter-pit':
      _showStep({
        element: '#lock-human-wrap',
        title:   '\u26CF You\'re in a Pit!',
        body:    'Pit ' + ((opts && opts.pitNum) || '') + ' is a danger zone. <strong>Score enough in a single turn to escape.</strong>' +
                 ((opts && opts.needed) ? ' You need <strong>' + opts.needed + ' pts</strong> right now.' : ' Watch the "Need X pts" counter on your tile.'),
        side:    'top',
      });
      break;

    case 'enter-barrel':
      _showStep({
        element: '#lock-human-wrap',
        title:   '\uD83D\uDEE2 You\'re on the Barrel!',
        body:    'So close! <strong>Score exactly enough to hit 1,000 and win.</strong> You have 3 attempts per session \u2014 overshoot or bust and you\'re knocked back. Make them count!',
        side:    'top',
      });
      // Barrel step = final teaching moment — mark complete after dismiss
      // tutorialComplete() will be called from the button handler below
      break;

    // Fix 3: first-bolt teaching moment
    case 'first-bolt':
      _showStep({
        element: '#comms-panel',
        title:   '\u26A1 Bolts!',
        body:    'You just got a bolt \u2014 <strong>3 bolts in a row = -100 pts penalty.</strong> Bolts reset when you bank. Don\'t risk it on bolt 2!',
        side:    'top',
      });
      break;

    // Fix 4: overtake teaching moment
    case 'overtake':
      _showStep({
        element: '#comms-panel',
        title:   '\uD83D\uDDE1 Overtake!',
        body:    'When a player\'s score drops <strong>below an opponent who is already open,</strong> that opponent loses 50 pts. Cuts both ways \u2014 stay sharp!',
        side:    'top',
      });
      break;
  }
}

function _showStep({ element, title, body, side, showSkip }) {
  if (_driverInst) { _driverInst.destroy(); _driverInst = null; }

  var isBarrelStep = (title.indexOf('Barrel') !== -1);
  var skipHtml = showSkip
    ? '<button class="dr-btn-skip">Skip tutorial</button>'
    : '';
  var nextLabel = isBarrelStep ? 'Got it \u2014 let\'s win!' : 'Got it';

  _driverInst = driver({
    overlayColor:     'rgba(0,0,0,0.65)',
    smoothScroll:     false,
    allowClose:       true,
    popoverClass:     'dr-dice-rush',
    onDestroyStarted: function() {
      if (_driverInst) { _driverInst.destroy(); _driverInst = null; }
    },
  });

  _driverInst.highlight({
    element: element,
    popover: {
      title:       title,
      description: body +
        '<div class="dr-btn-row">' + skipHtml +
        '<button class="dr-btn-next">' + nextLabel + '</button></div>',
      side:  side || 'top',
      align: 'center',
    },
  });

  setTimeout(function() {
    if (typeof document === 'undefined') return;
    var nextBtn = document.querySelector('.dr-btn-next');
    var skipBtn = document.querySelector('.dr-btn-skip');
    if (nextBtn) nextBtn.addEventListener('click', function() {
      if (_driverInst) { _driverInst.destroy(); _driverInst = null; }
      if (isBarrelStep) tutorialComplete();
    });
    if (skipBtn) skipBtn.addEventListener('click', function() {
      if (_driverInst) { _driverInst.destroy(); _driverInst = null; }
      _onSkip();
    });
  }, 80);
}

// ─── HINT MESSAGES (returning users, lightweight) ──────────────────────────────────────────

var _HINTS = {
  'first-roll':   { text: '\uD83D\uDCA1 1s = 10 pts, 5s = 5 pts alone. Three of a kind scores big. Bank to save or roll for more.', skin: 'hint' },
  'first-open':   { text: '\uD83D\uDD13 Account open! You scored 50+ pts in one turn.',                skin: 'good' },
  'first-bank':   { text: '\u2705 Banked! Points saved.',                                              skin: 'good' },
  'first-bust':   { text: '\uD83D\uDCA5 Bust \u2014 no scoring dice. Turn passes to opponent.',        skin: 'bad'  },
  'enter-pit':    { text: '\u26CF Pit zone \u2014 score enough in one turn to escape.',                skin: 'warn' },
  'enter-barrel': { text: '\uD83D\uDEE2 Barrel \u2014 3 attempts to reach exactly 1,000 and win!',    skin: 'warn' },
  'first-bolt':   { text: '\u26A1 Bolt! 3 in a row = -100 pts penalty. Bolts reset on bank.',         skin: 'warn' },
  'overtake':     { text: '\uD83D\uDDE1 Overtake \u2014 score drops can cost opponents 50 pts.',       skin: 'warn' },
};

function _handleHint(event) {
  if (_seenThisSession.has(event)) return;
  if (_disabledHints.has(event)) return;
  _seenThisSession.add(event);
  var hint = _HINTS[event];
  if (hint && _setMessage) _setMessage(hint.text, hint.skin);
}

// ─── SKIP ───────────────────────────────────────────────────────────────────────────────────

function _onSkip() {
  _tutorialMode = false;
  _hintsMode    = true;
  _writeMeta({ tutorial_completed: true });
  if (_setMessage) _setMessage('Tutorial skipped \u2014 hints are still on. Turn them off in Settings \u2699.', 'hint');
}

// ─── COMPLETION ────────────────────────────────────────────────────────────────────────────

/**
 * Called after barrel step dismissed, or from showGameOver() if player
 * wins/loses before reaching the barrel step.
 */
export function tutorialComplete() {
  if (!_tutorialMode) return;
  _tutorialMode = false;
  _hintsMode    = true;
  _writeMeta({ tutorial_completed: true });
  if (_setMessage) _setMessage('\uD83C\uDF93 You know the basics! Hints stay on \u2014 turn them off in Settings \u2699 anytime.', 'hint');
}

// ─── SETTINGS API ────────────────────────────────────────────────────────────────────────────

export function getHintsEnabled() {
  if (!_user) return false;
  return _user.user_metadata?.hints_enabled ?? true;
}

export function getTutorialCompleted() {
  if (!_user) return false;
  return _user.user_metadata?.tutorial_completed ?? false;
}

export async function setHintsEnabled(enabled) {
  _hintsMode = enabled && !_tutorialMode;
  if (_user) _user.user_metadata = Object.assign({}, _user.user_metadata, { hints_enabled: enabled });
  await _writeMeta({ hints_enabled: enabled });
}

export async function replayTutorial(user) {
  // Accept optional user override — needed when called from lobby before initTutorial()
  if (user) _user = user;
  if (_user) _user.user_metadata = Object.assign({}, _user.user_metadata, { tutorial_completed: false, hints_enabled: true });
  await _writeMeta({ tutorial_completed: false, hints_enabled: true });
  // initTutorial() will re-evaluate on next startGame()
}

// ─── TEST HELPER (not used in production) ───────────────────────────────────

export function resetForTesting() {
  _user            = null;
  _tutorialMode    = false;
  _hintsMode       = false;
  _driverInst      = null;
  _setMessage      = null;
  _seenThisSession = new Set();
  _stepsFired      = new Set();
  _disabledHints   = new Set();
}

// ─── SUPABASE WRITE ───────────────────────────────────────────────────────────────────────────

async function _writeMeta(fields) {
  if (!_user) return;
  try {
    await supabase.auth.updateUser({ data: fields });
  } catch (e) {
    console.warn('[tutorial] Failed to save user metadata:', e);
  }
}
