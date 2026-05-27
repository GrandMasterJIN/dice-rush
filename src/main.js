// Dice Rush - main.js v8 (Three.js dice)
import { createGame, processRoll, bankTurn, endTurnOnly, CONFIG } from './logic/gameState.js';
import { scoreDice } from './logic/scoring.js';
import { botDecision } from './logic/bot.js';
import { initDice3D } from './dice3d.js';
import { logSessionStart, logTurnStart, logRoll, logTurnEnd, logEvent, logSessionEnd, exportLog } from './sessionLogger.js';
import { getSession, saveScore } from './auth.js';
import { supabase } from './supabase.js';
import { initAuthModal, showAuthModal, updateAuthUI } from './authModal.js';
import { initTutorial, tutorialHook, tutorialComplete, getHintsEnabled, getTutorialCompleted, setHintsEnabled, replayTutorial } from './tutorial.js';
import { playBank, playRollStart, playDiceLand, playBolt, playBoltPenalty, playHotDice, playWin, playLoss, playDumpTruck, playBust, playStraight, playOvertake, isMuted, toggleMute } from './sound.js';

// Turn counter — incremented on every turn start
var turnCounter = 0;

// ─── AUTH STATE ──────────────────────────────────────────────────────────────
var currentUser = null;

function onAuthChange(user) {
  currentUser = user;
  updateAuthUI(user);
  if (user) {
    // Pre-fill name from username if name screen is still showing
    var username = user.user_metadata?.username || '';
    if (username && inputName) inputName.value = username;
    playerName = username || playerName;
  }
}

// ─── 3D DICE API ─────────────────────────────────────────────────────────────
var dice3D = null;

// ─── STATE ───────────────────────────────────────────────────────────────────
var game       = null;
var playerName = 'You';
var difficulty = 'easy';

// ─── ELEMENT REFS ─────────────────────────────────────────────────────────────
var screenName  = document.getElementById('screen-name');
var screenGame  = document.getElementById('screen-game');
var inputName   = null; // removed — auth replaces name input
var btnStartGame= null; // removed — auth replaces start button
var btnRoll     = document.getElementById('btn-roll');
var btnBank     = document.getElementById('btn-bank');
var turnLabel   = document.getElementById('turn-watermark');   // legacy compat
var turnRoundLabel = document.getElementById('turn-round-label'); // legacy compat
var turnScoreEl = document.getElementById('turn-score-display'); // legacy compat
var diceEls     = [0,1,2,3,4];
var comboLabel  = document.getElementById('combo-label');        // legacy compat
var messageBar  = document.getElementById('message-bar');        // legacy compat
// Narrator panel elements (legacy — kept for compat, elements hidden via CSS)
var narratorRound = document.getElementById('narrator-round');
var narratorTurn  = document.getElementById('narrator-turn');
var narratorScore = document.getElementById('narrator-score');
var narratorHint  = document.getElementById('narrator-hint');
// Comms panel elements
var commsTurnNum   = document.getElementById('comms-turn-num');
var commsWhoseTurn = document.getElementById('comms-whose-turn');
var commsTurnScore = document.getElementById('comms-turn-score');
var commsMessage   = document.getElementById('comms-message');
var commsIcon      = document.getElementById('comms-icon');
var commsText      = document.getElementById('comms-text');
// Toast elements (winner ceremony only)
var toastEl       = document.getElementById('event-toast');
var toastIconEl   = document.getElementById('toast-icon');
var toastTitleEl  = document.getElementById('toast-title');
var toastSubEl    = document.getElementById('toast-sub');
var toastBarEl    = document.getElementById('toast-bar-inner');
var toastTimer    = null;

var humanScoreBox  = null;
var botScoreBox    = null;
var sBoltsH        = [];
var sBoltsB        = [];

var fillHuman        = document.getElementById('fill-human');
var fillBot          = document.getElementById('fill-bot');
var trackHuman       = document.getElementById('track-human');
var trackBot         = document.getElementById('track-bot');
var scaleHumanTopTag = document.getElementById('scale-human-top-tag');
var scaleBotTopTag   = document.getElementById('scale-bot-top-tag');
var scaleHumanScore  = null;
var scaleBotScore    = null;
var scaleBoltsH      = [0,1,2].map(function(i){ return document.getElementById('bolt-h-'+i); });
var scaleBoltsB      = [0,1,2].map(function(i){ return document.getElementById('bolt-b-'+i); });
var scaleHumanStatus = document.getElementById('scale-human-status');
var scaleBotStatus   = document.getElementById('scale-bot-status');
var scaleHumanSub    = document.getElementById('scale-human-sub');
var scaleBotSub      = document.getElementById('scale-bot-sub');
var lockHuman        = document.getElementById('lock-human');
var lockBot          = document.getElementById('lock-bot');
var markerHuman      = document.getElementById('marker-human');
var markerBot        = document.getElementById('marker-bot');

var SVG_LOCKED   = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="11" width="16" height="11" rx="2" fill="#7a5010" stroke="#c89020" stroke-width="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#c89020" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="16" r="1.5" fill="#c89020"/></svg>';
var SVG_UNLOCKED = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="11" width="16" height="11" rx="2" fill="#1a4a2e" stroke="#3a9a3a" stroke-width="1.5"/><path d="M16 11V7a4 4 0 0 0 -8 0" stroke="#3a9a3a" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="16" r="1.5" fill="#3a9a3a"/></svg>';

// ─── TILE STATE TRACKING (for entry flash detection) ─────────────────────────
var tileState = { human: null, bot: null };

var overlayDump    = null; // removed — dump truck inline
var dumpMessage    = null;
var btnDismissDump = null;

var overlayGameover= document.getElementById('overlay-gameover');
var gameoverIcon   = document.getElementById('gameover-icon');
var gameoverTitle  = document.getElementById('gameover-title');
var gameoverMsg    = document.getElementById('gameover-message');
var btnPlayAgain   = document.getElementById('btn-play-again');
var btnPlayAgainInline = document.getElementById('btn-play-again-inline');
var btnExitToLobby    = document.getElementById('btn-exit-to-lobby');
var endGameButtons    = document.getElementById('end-game-buttons');

// ─── LOBBY REFS ────────────────────────────────────────────────────────────────────────
var lobbyPanel       = document.getElementById('lobby-panel');
var lobbyUsername    = document.getElementById('lobby-username');
var lobbyNameInput   = document.getElementById('lobby-name-input');
var lobbyHintsToggle = document.getElementById('lobby-hints-toggle');
var lobbyReplayRow   = document.getElementById('lobby-replay-row');
var lobbyReplayBtn   = document.getElementById('lobby-replay-btn');
var lobbyPlayBtn     = document.getElementById('lobby-play-btn');
var lobbyLogoutBtn   = document.getElementById('lobby-logout-btn');
var lobbyDiffBtns    = document.querySelectorAll('#lobby-panel .diff-btn');
var tooltipEl      = document.getElementById('tooltip');

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function currentScores() {
  if (!game) return {};
  var s = {};
  game.players.forEach(function(p) { s[p.name] = p.score; });
  return s;
}

function comboNameFromDice(dice) {
  var result = scoreDice(dice);
  if (!result.combinations || !result.combinations.length) return '';
  return result.combinations.map(function(c){ return c.label; }).join(' + ');
}

// ─── SCALE BUILDER ───────────────────────────────────────────────────────────
function buildScaleZones(trackEl, labelsEl) {
  trackEl.querySelectorAll('.scale-tick-mark, .scale-zone, .scale-dump-mark').forEach(function(el){ el.remove(); });
  if (labelsEl) labelsEl.innerHTML = '';

  var TOTAL = 1000;
  var DUMP  = 555;
  var zones = [
    { min: 200, max: 299, cls: 'scale-zone-pit',    icon: '⛏', name: 'Pit 1',  badgeCls: 'pit' },
    { min: 600, max: 699, cls: 'scale-zone-pit',    icon: '⛏', name: 'Pit 2',  badgeCls: 'pit' },
    { min: 880, max: 999, cls: 'scale-zone-barrel', icon: '🛢', name: 'Brl', badgeCls: 'barrel' },
  ];

  zones.forEach(function(z) {
    var el = document.createElement('div');
    el.className = 'scale-zone ' + z.cls;
    el.style.bottom = (z.min / TOTAL * 100) + '%';
    el.style.height = ((z.max - z.min + 1) / TOTAL * 100) + '%';
    trackEl.appendChild(el);
  });

  for (var pts = 0; pts <= TOTAL; pts += 5) {
    var tick = document.createElement('div');
    tick.className = 'scale-tick-mark ' + (pts % 100 === 0 ? 'hundred' : 'five');
    tick.style.bottom = (pts / TOTAL * 100) + '%';
    trackEl.appendChild(tick);
  }

  var dumpTick = document.createElement('div');
  dumpTick.className = 'scale-tick-mark scale-dump-tick';
  dumpTick.style.bottom = (DUMP / TOTAL * 100) + '%';
  trackEl.appendChild(dumpTick);

  if (!labelsEl) return;

  for (var score = 0; score <= TOTAL; score += 100) {
    var label = document.createElement('div');
    label.className = 'scale-hundred-label';
    label.textContent = score;
    label.style.bottom = (score / TOTAL * 100) + '%';
    if (score === 200 || score === 300 || score === 600 || score === 700) {
      label.style.color = 'var(--status-bad)';
    } else if (score >= 880 || score === 1000) {
      label.style.color = 'var(--status-warn)';
    }
    labelsEl.appendChild(label);
  }

  var TOOLTIPS = {
    'Pit 1':  'Pit 1 (200–299): You must reach 300+ to escape.',
    'Pit 2':  'Pit 2 (600–699): You must reach 700+ to escape.',
    'Barrel': 'Barrel (880–999): One roll to win — bust and you stay on the barrel.',
  };

  zones.forEach(function(z) {
    var mid = (z.min + z.max) / 2;
    var badge = document.createElement('div');
    badge.className = 'scale-zone-badge ' + z.badgeCls;
    badge.style.bottom = (mid / TOTAL * 100) + '%';
    badge.innerHTML = '<span style="font-size:11px;line-height:1">' + z.icon + '</span><span>' + z.name + '</span>';
    badge.dataset.tooltip = TOOLTIPS[z.name];
    labelsEl.appendChild(badge);
  });

  var dumpBadge = document.createElement('div');
  dumpBadge.className = 'scale-zone-badge scale-dump-badge';
  dumpBadge.style.bottom = (DUMP / TOTAL * 100) + '%';
  dumpBadge.innerHTML = '<span style="font-size:11px;line-height:1">🚛</span><span>555</span>';
  dumpBadge.dataset.tooltip = 'Dump Truck: landing exactly on 555 resets your score to 0!';
  labelsEl.appendChild(dumpBadge);
}

// ─── MESSAGE DELAYS ──────────────────────────────────────────────────────────
var DELAY_NORMAL = 2000;  // standard bust / barrel bust
var DELAY_BIG    = 2800;  // bolt penalty, overtake, straight, overshoot
var DELAY_DUMP   = 3200;  // dump truck (has its own shake animation too)

// ─── DIFFICULTY ───────────────────────────────────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.diff-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
  });
});

// ─── START GAME ───────────────────────────────────────────────────────────────
// Entry is now via auth — startGame() is called from onEntryAuth()

// ─── LOBBY ──────────────────────────────────────────────────────────────────────────────

async function showLobby() {
  // Re-fetch user to get latest metadata (e.g. tutorial_completed updated mid-session)
  try {
    var { data } = await supabase.auth.getUser();
    if (data && data.user) {
      currentUser = data.user;
      updateAuthUI(currentUser);
    }
  } catch(e) { console.warn('showLobby getUser failed:', e); }

  // Hide auth panels, show lobby panel
  var authPanels = document.querySelectorAll('.entry-auth-panel, .entry-auth-tabs');
  authPanels.forEach(function(el) { el.style.display = 'none'; });
  if (lobbyPanel) lobbyPanel.style.display = 'block';

  // Pre-fill username
  var username = currentUser ? (currentUser.user_metadata?.username || currentUser.email || '') : '';
  if (lobbyUsername) lobbyUsername.textContent = username || 'Player';
  if (lobbyNameInput) lobbyNameInput.value = username;

  // Sync hints toggle
  var hintsOn = currentUser ? (currentUser.user_metadata?.hints_enabled ?? true) : true;
  if (lobbyHintsToggle) lobbyHintsToggle.setAttribute('aria-checked', hintsOn ? 'true' : 'false');

  // Show replay tutorial row only if tutorial completed
  var tutDone = currentUser ? (currentUser.user_metadata?.tutorial_completed ?? false) : false;
  if (lobbyReplayRow) lobbyReplayRow.style.display = tutDone ? 'flex' : 'none';

  // Switch to name screen
  screenGame.classList.remove('active');
  screenName.classList.add('active');
}

// Difficulty selection
lobbyDiffBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    lobbyDiffBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
  });
});

// Hints toggle
if (lobbyHintsToggle) lobbyHintsToggle.addEventListener('click', async function() {
  var current = lobbyHintsToggle.getAttribute('aria-checked') === 'true';
  var next = !current;
  lobbyHintsToggle.setAttribute('aria-checked', next ? 'true' : 'false');
  await setHintsEnabled(next);
});

// Replay tutorial
if (lobbyReplayBtn) lobbyReplayBtn.addEventListener('click', async function() {
  await replayTutorial(currentUser);
  // Sync currentUser so initTutorial() sees the updated metadata on next startGame()
  if (currentUser && currentUser.user_metadata) {
    currentUser.user_metadata.tutorial_completed = false;
    currentUser.user_metadata.hints_enabled = true;
  }
  if (lobbyReplayRow) lobbyReplayRow.style.display = 'none';
});

// Play button
if (lobbyPlayBtn) lobbyPlayBtn.addEventListener('click', async function() {
  // Save name if changed
  var newName = lobbyNameInput ? lobbyNameInput.value.trim() : '';
  if (newName && newName !== playerName && currentUser) {
    playerName = newName;
    if (lobbyUsername) lobbyUsername.textContent = newName;
    try {
      await supabase.auth.updateUser({ data: { username: newName } });
      if (currentUser.user_metadata) currentUser.user_metadata.username = newName;
    } catch(e) { console.warn('Name save failed:', e); }
  }
  screenName.classList.remove('active');
  screenGame.classList.add('active');
  startGame();
});

// Log out
if (lobbyLogoutBtn) lobbyLogoutBtn.addEventListener('click', async function() {
  await supabase.auth.signOut();
  // Hide lobby, show auth panels
  if (lobbyPanel) lobbyPanel.style.display = 'none';
  var authPanels = document.querySelectorAll('.entry-auth-panel, .entry-auth-tabs');
  authPanels.forEach(function(el) { el.style.removeProperty('display'); });
  screenGame.classList.remove('active');
  screenName.classList.add('active');
  currentUser = null;
  updateAuthUI(null);
});

// ────────────────────────────────────────────────────────────────────────────────
async function startGame() {
  game = createGame([playerName, 'Bot'], 'classic');
  turnCounter = 0;

  // Reset end-of-game UI
  if (endGameButtons) endGameButtons.classList.remove('visible');
  document.getElementById('action-buttons').style.display = '';
  var guestPrompt = document.getElementById('auth-guest-prompt');
  if (guestPrompt) guestPrompt.style.display = 'none';

  // Session logger
  logSessionStart(playerName, difficulty);

  if (scaleHumanTopTag) scaleHumanTopTag.textContent = playerName;
  if (scaleBotTopTag)   scaleBotTopTag.textContent   = 'Bot';

  buildScaleZones(trackHuman, document.getElementById('labels-human'));
  buildScaleZones(trackBot,   document.getElementById('labels-bot'));
  screenName.classList.remove('active');
  screenGame.classList.add('active');

  if (!dice3D) {
    dice3D = await initDice3D('dice-canvas');
  }
  if (dice3D) dice3D.setWaiting(true);

  renderAll();
  setMessage('Roll the dice to start!', '');

  // Tutorial / onboarding
  initTutorial(currentUser, setMessage);
  tutorialHook('game-start');

  // Log first human turn start
  turnCounter++;
  logTurnStart(playerName, turnCounter, currentScores());
}

// ─── ROLL ─────────────────────────────────────────────────────────────────────
btnRoll.addEventListener('click', function() {
  if (!game || game.currentPlayerIndex !== 0) return;
  disableActions();
  if (dice3D) dice3D.setWaiting(false);
  playRollStart();
  animateDice(function(physicsValues) {
    var lockedBefore = game.turn.lockedIndices.slice();
    game = processRoll(game, physicsValues);

    // Log the roll
    var activeDice = game.turn.diceValues.filter(function(_, i) {
      return lockedBefore.indexOf(i) === -1;
    });
    var phase = game.turn.phase;
    var combo = phase === 'bust' ? 'BUST' : comboNameFromDice(activeDice);
    var pts   = phase === 'bust' ? 0 : scoreDice(activeDice).total;
    logRoll(activeDice, game.turn.diceValues, lockedBefore, combo, pts, game.turn.turnScore,
      phase === 'bust' ? 'bust' : game.turn.hotDice ? 'hot' : phase === 'dumptruck' ? 'dumptruck' : 'scored');

    handleRollResult();
    playDiceLand(5);
  });
});

function handleRollResult() {
  var phase = game.turn.phase;

  // ── BARREL WIN: hit exactly 1000 — auto-bank and win ──
  if (phase === 'barrel_win') {
    game.players[game.currentPlayerIndex].score = CONFIG.WINNING_SCORE;
    game.winner = game.players[game.currentPlayerIndex].name;
    renderDice(false); renderTurnInfo(); renderScales();
    setMessage('🏆 Barrel Win — you hit 1,000!', 'good');
    logEvent('BARREL_WIN', playerName + ' hit exactly 1000 on Barrel — auto-win');
    logSessionEnd(game.winner, currentScores());
    setTimeout(function() { showGameOver(true); }, 1200);
    return;
  }

  // ── BARREL PENALTY: 3 failed attempts — -100 pts, exits barrel ──
  if (phase === 'barrel_penalty') {
    renderDice(true); renderTurnInfo(); renderScales();
    setMessage('⚡ Barrel session failed — score drops to 800.', 'bad');
    logEvent('BARREL_FALL', playerName + ' barrel session failed — score drops to 850');
    logTurnEnd('barrel_bust', null, currentScores());
    disableActions();
    setTimeout(function() {
      game = endTurnOnly(game);
      turnCounter++;
      var nh = game.currentPlayerIndex === 0;
      logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
      setTurnUI(nh); resetDiceDisplay(); renderScales();
      if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
      else    { setMessage('Bot is thinking...', ''); scheduleBotAction(); }
    }, DELAY_BIG);
    return;
  }

  // ── BARREL BURNED: 3 failed sessions — score reset to 0 ──
  if (phase === 'barrel_burned') {
    resetFillInstant(fillHuman);
    renderDice(true); renderTurnInfo(); renderScales();
    setMessage('🔥 Score burned to 0 — 3 sessions failed.', 'bad');
    logEvent('BARREL_BURNED', playerName + ' failed 3 barrel sessions — score burned to 0');
    logTurnEnd('barrel_burned', null, currentScores());
    disableActions();
    setTimeout(function() {
      game = endTurnOnly(game);
      turnCounter++;
      var nh = game.currentPlayerIndex === 0;
      logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
      setTurnUI(nh); resetDiceDisplay(); renderScales();
      if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
      else    { setMessage('Bot is thinking...', ''); scheduleBotAction(); }
    }, DELAY_BIG);
    return;
  }

  // ── BARREL BUST: attempt failed, pass turn (may still have attempts left) ──
  if (phase === 'barrel_bust') {
    renderDice(true);
    renderTurnInfo(); renderScales();
    disableActions();
    // endTurnOnly will count the attempt and set phase to barrel_fall or barrel_burned if needed
    var preEndGame = game; // capture current state to read overtake_by_penalty after endTurnOnly
    game = endTurnOnly(game);
    var newPhase = game.turn ? game.turn.phase : '';
    var overtakeViaBarrel = preEndGame.turn.overtake_by_penalty || null;
    var attempts = game.players[0].barrelAttempts;
    var falls = game.players[0].barrelFalls;

    if (newPhase === 'barrel_burned') {
      resetFillInstant(fillHuman);
      renderScales();
      var burnMsg = overtakeViaBarrel ? ' Bot overtook you — Bot -50 pts.' : '';
      showToast('🔥', 'Score burned!', '3 barrel sessions failed — back to zero.' + burnMsg, 'bad', 3200);
      setMessage('🔥 Score burned to 0.' + burnMsg, 'bad');
      logEvent('BARREL_BURNED', playerName + ' — 3 sessions burned score to 0' + (overtakeViaBarrel ? ' | Bot overtook via barrel -50 pts' : ''));
    } else if (newPhase === 'barrel_fall') {
      renderScales();
      var fallMsg = overtakeViaBarrel ? ' Bot overtook you — Bot -50 pts.' : '';
      setMessage('⚡ Score drops to 800. Fall ' + falls + '/' + CONFIG.BARREL_MAX_FALLS + '.' + fallMsg, 'bad');
      logEvent('BARREL_FALL', playerName + ' used 3 attempts — fall ' + falls + (overtakeViaBarrel ? ' | Bot overtook via barrel -50 pts' : ''));
    } else {
      renderScales();
      setMessage('🛢 Barrel attempt ' + attempts + '/' + CONFIG.BARREL_MAX_ATTEMPTS + ' failed — turn passes.', 'warn');
      logEvent('BARREL_BUST', playerName + ' barrel attempt ' + attempts + ' failed');
    }

    logTurnEnd('barrel_bust', null, currentScores());
    setTimeout(function() {
      turnCounter++;
      var nh = game.currentPlayerIndex === 0;
      logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
      setTurnUI(nh); resetDiceDisplay();
      if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
      else    { setMessage('Bot is thinking...', ''); scheduleBotAction(); }
    }, DELAY_BIG);
    return;
  }

  // ── BARREL OVERSHOOT: forced turn end, no banking ──
  if (phase === 'overshoot') {
    renderDice(false); renderTurnInfo(); renderScales();
    setMessage('🚨 Overshoot — turn total exceeds 1,000, turn passes.', 'warn');
    logEvent('OVERSHOOT', playerName + ' overshot 1000 on Barrel');
    logTurnEnd('overshoot', null, currentScores());
    disableActions();
    setTimeout(function() {
      game = bankTurn(game);
      turnCounter++;
      var nh = game.currentPlayerIndex === 0;
      logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
      setTurnUI(nh); resetDiceDisplay(); renderScales();
      if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
      else    { setMessage('Bot is thinking...', ''); scheduleBotAction(); }
    }, DELAY_BIG);
    return;
  }

  // ── AUTOWIN: five ones — player chooses to claim or keep rolling ──
  if (phase === 'autowin') {
    renderDice(false); renderTurnInfo(); renderScales();
    setMessage('🌟 Five Ones — automatic win available! Claim it or keep rolling.', 'good');
    logEvent('AUTOWIN_AVAILABLE', playerName + ' rolled five ones');
    // Show Claim Win button in place of Bank
    btnBank.textContent  = 'Claim Win!';
    btnBank.disabled     = false;
    btnRoll.disabled     = false;
    document.getElementById('action-buttons').classList.add('bank-available');
    // Mark state so bank handler knows this is a claim
    game.turn._autowin = true;
    return;
  }

  if (phase === 'bust') {
    renderDice(true);
    renderTurnInfo(); renderScales();
    var bolts   = game.players[0].bolts;
    var penalty = (bolts === 0);
    var hadLocked = (game.turn.lockedIndices && game.turn.lockedIndices.length > 0);
    if (hadLocked) {
      playBust();
      setMessage('No score on remaining dice — turn ends.', 'warn');
      logEvent('BUST_LOCKED', playerName + ' busted with locked dice — no bolt');
    } else if (penalty) {
      playBoltPenalty();
      flashBoltPenalty(scaleBoltsH, CONFIG.BOLT_PENALTY_PTS);
      var overtakeMsg = game.turn.overtake_by_penalty
        ? ' Bot overtook you — Bot loses 50 pts.' : '';
      setMessage('⚡ Bolt penalty: -100 pts.' + overtakeMsg, 'bad');
      logEvent('BOLT_PENALTY', playerName + ' -' + CONFIG.BOLT_PENALTY_PTS + ' pts' + (game.turn.overtake_by_penalty ? ' | Bot overtook via penalty -50 pts' : ''));
    } else {
      playBolt();
      setMessage('⚡ Bolt ' + bolts + '/3 — turn ends.', 'warn');
      logEvent('BOLT', playerName + ' bolt ' + bolts + '/3');
      tutorialHook('first-bolt'); // Fix 3: bolt teaching moment
    }
    logTurnEnd('bust', null, currentScores());
    tutorialHook('first-bust');
    disableActions();
    setTimeout(function() {
      game = bankTurn(game);
      turnCounter++;
      var nh = game.currentPlayerIndex === 0;
      logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
      setTurnUI(nh); resetDiceDisplay(); renderScales();
      if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
      else    { setMessage('Bot is thinking...', ''); scheduleBotAction(); }
    }, DELAY_BIG);
    return;
  }

  if (phase === 'dumptruck') {
    resetFillInstant(fillHuman);
    renderDice(false); renderScales();
    playDumpTruck();
    logEvent('DUMP_TRUCK', playerName + ' hit 555 — reset to 0');
    logTurnEnd('dumptruck', null, currentScores());
    showDumpTruck(playerName);
    return;
  }

  renderDice(false);
  renderTurnInfo();
  renderScales();
  tutorialHook('first-roll');

  if (!game.turn.hotDice) {
    var newlyRolled = (function() {
      var active = [];
      for (var i = 0; i < 5; i++) {
        if (game.turn.lockedIndices.indexOf(i) === -1) active.push(game.turn.diceValues[i]);
      }
      return active;
    })();
    var rollResult = scoreDice(newlyRolled);
    var comboName  = rollResult.combinations && rollResult.combinations.length
      ? rollResult.combinations.map(function(c){ return c.label; }).join(' + ')
      : '';
    if (comboName === 'Small Straight') {
      playStraight();
      setMessage('🎲 Small Straight — 125 pts!', 'good');
      logEvent('SMALL_STRAIGHT', playerName + ' rolled a Small Straight +125');
    } else if (comboName === 'Large Straight') {
      playStraight();
      setMessage('🎲 Large Straight — 250 pts!', 'good');
      logEvent('LARGE_STRAIGHT', playerName + ' rolled a Large Straight +250');
    } else {
      var pts = rollResult.total || 0;
      var hint = pts > 0
        ? (comboName ? comboName + ' (' + pts + ' pts) — roll again or bank?' : 'Scored ' + pts + ' pts — roll again or bank?')
        : (game.turn.turnScore > 0 ? 'No new score — roll again or bank ' + game.turn.turnScore + ' pts?' : 'No score this roll.');
      setMessage(hint, pts === 0 && game.turn.turnScore === 0 ? 'warn' : '');
    }
  } else {
    var hotNewlyRolled = game.turn.diceValues.slice();
    var hotResult  = scoreDice(hotNewlyRolled);
    var hotCombo   = hotResult.combinations && hotResult.combinations.length
      ? hotResult.combinations.map(function(c){ return c.label; }).join(' + ')
      : '';
    if (hotCombo === 'Small Straight') {
      playStraight();
      setMessage('🎲 Small Straight + Hot Dice!', 'good');
    } else if (hotCombo === 'Large Straight') {
      playStraight();
      setMessage('🎲 Large Straight + Hot Dice!', 'good');
    } else {
      playHotDice();
      setMessage('🔥 Hot Dice — roll all 5!', 'good');
    }
  }

  btnBank.disabled = !canBankCheck();
  btnRoll.disabled = false;
  if (!btnBank.disabled) {
    document.getElementById('action-buttons').classList.add('bank-available');
  }
}

function canBankCheck() {
  var p = game.players[game.currentPlayerIndex];
  if (p.isOnBarrel) return false;  // barrel: must roll for exact 1000, no banking
  if (game.turn.turnScore === 0) return false;
  if (!p.isOpen && game.turn.turnScore < CONFIG.OPENING_THRESHOLD_CLASSIC) return false;
  if (p.score >= CONFIG.PIT1_MIN && p.score <= CONFIG.PIT1_MAX) return p.score + game.turn.turnScore >= CONFIG.PIT1_EXIT;
  if (p.score >= CONFIG.PIT2_MIN && p.score <= CONFIG.PIT2_MAX) return p.score + game.turn.turnScore >= CONFIG.PIT2_EXIT;
  return true;
}

// ─── BANK ─────────────────────────────────────────────────────────────────────
btnBank.addEventListener('click', function() {
  if (!game || game.currentPlayerIndex !== 0) return;
  disableActions();
  // Reset button text in case it was showing 'Claim Win!'
  btnBank.textContent = 'Bank';

  // Autowin claim: set player score to 1000 and trigger win
  if (game.turn._autowin) {
    game.players[0].score = CONFIG.WINNING_SCORE;
    game.winner = game.players[0].name;
    logEvent('AUTOWIN_CLAIMED', playerName + ' claimed five-ones win');
    logSessionEnd(game.winner, currentScores());
    renderScales();
    showGameOver(true);
    return;
  }

  var wasOpen    = game.players[0] ? game.players[0].isOpen : false;
  var bankedPts  = game.turn.turnScore;
  game = bankTurn(game);
  playBank();
  logTurnEnd('banked', bankedPts, currentScores());
  tutorialHook('first-bank');
  // Fix 2: fire first-open only when the opening bank just happened
  if (!wasOpen && game.players[0] && game.players[0].isOpen) {
    tutorialHook('first-open');
  }

  // Check special events
  if (game.players[0] && game.players[0].isOnBarrel) {
    logEvent('BARREL', playerName + ' is on Barrel');
    tutorialHook('enter-barrel');
  }

  handleBankResult();
});

function handleBankResult() {
  renderTurnInfo(); renderScales();
  if (comboLabel) comboLabel.textContent = '';
  if (narratorHint) { narratorHint.textContent = ''; narratorHint.className = ''; }
  // Pit entry hook
  var _hp = game.players[0];
  if (_hp) {
    if (_hp.score >= CONFIG.PIT1_MIN && _hp.score <= CONFIG.PIT1_MAX)
      tutorialHook('enter-pit', { pitNum: 1, needed: CONFIG.PIT1_EXIT - _hp.score });
    else if (_hp.score >= CONFIG.PIT2_MIN && _hp.score <= CONFIG.PIT2_MAX)
      tutorialHook('enter-pit', { pitNum: 2, needed: CONFIG.PIT2_EXIT - _hp.score });
  }
  if (game.winner) {
    logSessionEnd(game.winner, currentScores());
    showGameOver(game.winner === playerName);
    return;
  }
  if (game.turn.phase === 'dumptruck' || game.turn.phase === 'dumptruck_other') {
    var isDumpHuman = game.turn.phase === 'dumptruck';
    var who = isDumpHuman ? playerName : 'Bot';
    if (isDumpHuman) resetFillInstant(fillHuman); else resetFillInstant(fillBot);
    logEvent('DUMP_TRUCK', who + ' hit 555 from banking — reset to 0');
    renderScales();
    showDumpTruck(who);
    return;
  }
  // Overtake check — scan recent log for overtake entry
  var lastLog = game.log[game.log.length - 2] || '';
  var prevLog = game.log[game.log.length - 3] || '';
  if (lastLog.indexOf(playerName + ' overtook') !== -1 || prevLog.indexOf(playerName + ' overtook') !== -1) {
    playOvertake();
    setMessage('🗡 You overtook Bot — Bot loses 50 pts.', 'good');
    logEvent('OVERTAKE', playerName + ' overtook Bot — Bot -50 pts');
    tutorialHook('overtake'); // Fix 4: overtake teaching moment
  } else if (lastLog.indexOf('Bot overtook') !== -1 || prevLog.indexOf('Bot overtook') !== -1) {
    playOvertake();
    setMessage('🗡 Bot overtook you — -50 pts.', 'bad');
    logEvent('OVERTAKE', 'Bot overtook ' + playerName + ' — ' + playerName + ' -50 pts');
    tutorialHook('overtake'); // Fix 4: overtake teaching moment
  }
  var nextHuman = game.currentPlayerIndex === 0;
  setTimeout(function() {
    turnCounter++;
    logTurnStart(nextHuman ? playerName : 'Bot', turnCounter, currentScores());
    setTurnUI(nextHuman);
    resetDiceDisplay();
    if (nextHuman) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
    else           { setMessage('Bot is thinking...', ''); scheduleBotAction(); }
  }, DELAY_BIG);
}

// ─── BOT ──────────────────────────────────────────────────────────────────────
function scheduleBotAction() {
  disableActions();
  setTimeout(function() {
    if (!game || game.currentPlayerIndex !== 1) return;
    if (botDecision(game, difficulty) === 'bank') onBotBank(); else onBotRoll();
  }, 700 + Math.random() * 800);
}

function onBotRoll() {
  animateDice(function(physicsValues) {
    var lockedBefore = game.turn.lockedIndices.slice();
    game = processRoll(game, physicsValues);
    var phase = game.turn.phase;

    // Log bot roll
    var activeDice = game.turn.diceValues.filter(function(_, i) {
      return lockedBefore.indexOf(i) === -1;
    });
    var combo = phase === 'bust' ? 'BUST' : comboNameFromDice(activeDice);
    var pts   = phase === 'bust' ? 0 : scoreDice(activeDice).total;
    logRoll(activeDice, game.turn.diceValues, lockedBefore, combo, pts, game.turn.turnScore,
      phase === 'bust' ? 'bust' : game.turn.hotDice ? 'hot' : phase === 'dumptruck' ? 'dumptruck' : 'scored');

    if (phase === 'barrel_win') {
      game.players[1].score = CONFIG.WINNING_SCORE;
      game.winner = 'Bot';
      renderDice(false); renderTurnInfo(); renderScales();
      setMessage('🏆 Bot Barrel Win — Bot Wins!', 'bad');
      logEvent('BARREL_WIN', 'Bot hit exactly 1000 on Barrel — auto-win');
      logSessionEnd('Bot', currentScores());
      setTimeout(function() { showGameOver(false); }, 1200);
      return;
    }

    if (phase === 'barrel_penalty') {
      renderDice(true); renderTurnInfo(); renderScales();
      var bfalls = game.players[1].barrelFalls;
      setMessage('⚡ Bot barrel session failed — back to 800. (Fall ' + bfalls + '/' + CONFIG.BARREL_MAX_FALLS + ')', 'warn');
      logEvent('BARREL_FALL', 'Bot barrel session failed');
      logTurnEnd('barrel_bust', null, currentScores());
      game = endTurnOnly(game);
      renderScales();
      setTimeout(function() {
        resetDiceDisplay();
        turnCounter++;
        var nh = game.currentPlayerIndex === 0; setTurnUI(nh);
        logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
        if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
        else    { scheduleBotAction(); }
      }, DELAY_BIG);
      return;
    }

    if (phase === 'barrel_burned') {
      resetFillInstant(fillBot);
      renderDice(true); renderTurnInfo(); renderScales();
      setMessage('🔥 Bot score burned to 0 — 3 barrel sessions failed.', 'bad');
      logEvent('BARREL_BURNED', 'Bot failed 3 barrel sessions — score burned to 0');
      logTurnEnd('barrel_burned', null, currentScores());
      game = endTurnOnly(game);
      renderScales();
      setTimeout(function() {
        resetDiceDisplay();
        turnCounter++;
        var nh = game.currentPlayerIndex === 0; setTurnUI(nh);
        logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
        if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
        else    { scheduleBotAction(); }
      }, DELAY_BIG);
      return;
    }

    if (phase === 'barrel_bust') {
      renderDice(true); renderTurnInfo(); renderScales();
      var botPreEnd = game;
      game = endTurnOnly(game);
      var bNewPhase = game.turn ? game.turn.phase : '';
      var botOvertakeBarrel = botPreEnd.turn.overtake_by_penalty || null;
      var bAttempts = game.players[1].barrelAttempts;
      var bFalls = game.players[1].barrelFalls;
      if (bNewPhase === 'barrel_burned') {
        resetFillInstant(fillBot);
        renderScales();
        var botBurnMsg = botOvertakeBarrel ? ' ' + playerName + ' overtook Bot — you lose 50 pts.' : '';
        setMessage('🔥 Bot — 3 barrel sessions failed, score BURNED to 0!' + botBurnMsg, 'warn big');
        logEvent('BARREL_BURNED', 'Bot 3 sessions burned score to 0' + (botOvertakeBarrel ? ' | ' + playerName + ' overtook Bot via barrel -50 pts' : ''));
      } else if (bNewPhase === 'barrel_fall') {
        renderScales();
        var botFallMsg = botOvertakeBarrel ? ' ' + playerName + ' overtook Bot — you lose 50 pts.' : '';
        setMessage('🛂 Bot used 3 attempts — score drops to 800. (Session ' + bFalls + '/' + CONFIG.BARREL_MAX_FALLS + ')' + botFallMsg, 'warn big');
        logEvent('BARREL_FALL', 'Bot used 3 attempts — fall ' + bFalls + (botOvertakeBarrel ? ' | ' + playerName + ' overtook Bot via barrel -50 pts' : ''));
      } else {
        renderScales();
        setMessage('Bot barrel attempt ' + bAttempts + '/' + CONFIG.BARREL_MAX_ATTEMPTS + ' failed — turn passes.', 'warn');
        logEvent('BARREL_BUST', 'Bot barrel attempt ' + bAttempts + ' failed');
      }
      logTurnEnd('barrel_bust', null, currentScores());
      setTimeout(function() {
        resetDiceDisplay();
        turnCounter++;
        var nh = game.currentPlayerIndex === 0; setTurnUI(nh);
        logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
        if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
        else    { scheduleBotAction(); }
      }, DELAY_BIG);
      return;
    }

    if (phase === 'barrel_win') {
      game.players[1].score = CONFIG.WINNING_SCORE;
      game.winner = 'Bot';
      renderDice(false); renderTurnInfo(); renderScales();
      setMessage('🤖 Bot Barrel Win — Bot Wins!', 'bad');
      logEvent('BARREL_WIN', 'Bot hit exactly 1000 on Barrel — auto-win');
      logSessionEnd('Bot', currentScores());
      setTimeout(function() { showGameOver(false); }, 1200);
      return;
    }

    if (phase === 'overshoot') {
      renderDice(false); renderTurnInfo(); renderScales();
      setMessage('🚨 Bot overshot 1000 — turn passes!', 'warn');
      logEvent('OVERSHOOT', 'Bot overshot 1000 on Barrel');
      logTurnEnd('overshoot', null, currentScores());
      game = bankTurn(game);
      setTimeout(function() {
        resetDiceDisplay(); renderScales();
        turnCounter++;
        var nh = game.currentPlayerIndex === 0; setTurnUI(nh);
        logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
        if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
        else    { scheduleBotAction(); }
      }, DELAY_BIG);
      return;
    }

    if (phase === 'autowin') {
      // Bot immediately claims the autowin
      game.players[1].score = CONFIG.WINNING_SCORE;
      game.winner = 'Bot';
      logEvent('AUTOWIN_CLAIMED', 'Bot claimed five-ones win');
      logSessionEnd('Bot', currentScores());
      renderScales();
      setMessage('🌟 Bot rolled Five Ones — Bot wins!', 'bad');
      setTimeout(function() { showGameOver(false); }, 1200);
      return;
    }

    if (phase === 'bust') {
      renderDice(true); renderTurnInfo(); renderScales();
      var bolts   = game.players[1].bolts;
      var penalty = (bolts === 0);
      var hadLocked = (game.turn.lockedIndices && game.turn.lockedIndices.length > 0);
      if (hadLocked) {
        setMessage('Bot got no score on remaining dice — turn ends.', 'warn');
        logEvent('BUST_LOCKED', 'Bot busted with locked dice — no bolt');
      } else if (penalty) {
        flashBoltPenalty(scaleBoltsB, CONFIG.BOLT_PENALTY_PTS);
        var botOvertakeMsg = game.turn.overtake_by_penalty
          ? ' ' + playerName + ' overtook Bot — you lose 50 pts.' : '';
        setMessage('⚡ Bot 3 Bolts! -100 pts penalty.' + botOvertakeMsg, 'bad big');
        logEvent('BOLT_PENALTY', 'Bot -' + CONFIG.BOLT_PENALTY_PTS + ' pts' + (game.turn.overtake_by_penalty ? ' | ' + playerName + ' overtook Bot via penalty -50 pts' : ''));
      } else {
        setMessage('⚡ Bot bolt ' + bolts + '/3 — turn ends.', 'warn');
        logEvent('BOLT', 'Bot bolt ' + bolts + '/3');
      }
      logTurnEnd('bust', null, currentScores());
      game = bankTurn(game);
      setTimeout(function() {
        resetDiceDisplay(); renderScales();
        turnCounter++;
        var nh = game.currentPlayerIndex === 0; setTurnUI(nh);
        logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
        if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
        else    { scheduleBotAction(); }
      }, 1000);
      return;
    }

    if (phase === 'dumptruck') {
      resetFillInstant(fillBot);
      renderScales();
      logEvent('DUMP_TRUCK', 'Bot hit 555 — reset to 0');
      logTurnEnd('dumptruck', null, currentScores());
      showDumpTruck('Bot');
      return;
    }

    renderDice(false); renderTurnInfo(); renderScales();
    if (game.turn.hotDice) {
      setMessage('🔥 Bot got Hot Dice!', 'good');
    } else {
      var botNewlyRolled = (function() {
        var active = [];
        for (var i = 0; i < 5; i++) {
          if (game.turn.lockedIndices.indexOf(i) === -1) active.push(game.turn.diceValues[i]);
        }
        return active;
      })();
      var botRollResult = scoreDice(botNewlyRolled);
      var botComboName  = botRollResult.combinations && botRollResult.combinations.length
        ? botRollResult.combinations.map(function(c){ return c.label; }).join(' + ')
        : '';
      if (botComboName === 'Small Straight') {
        setMessage('🎲 Bot: Small Straight — 125 pts!', 'good big');
        logEvent('SMALL_STRAIGHT', 'Bot rolled a Small Straight +125');
      } else if (botComboName === 'Large Straight') {
        setMessage('🎲 Bot: Large Straight — 250 pts!', 'good big');
        logEvent('LARGE_STRAIGHT', 'Bot rolled a Large Straight +250');
      } else {
        setMessage('Bot scored ' + game.turn.turnScore + ' pts…', 'bot');
      }
    }
    scheduleBotAction();
  });
}

function onBotBank() {
  var bankedPts = game.turn.turnScore;
  game = bankTurn(game);
  logTurnEnd('banked', bankedPts, currentScores());
  if (game.players[1] && game.players[1].isOnBarrel) logEvent('BARREL', 'Bot is on Barrel');
  setMessage('Bot banks ' + bankedPts + ' pts!', 'good');
  setTimeout(function() { handleBankResult(); }, 1000);
}

// ─── BOLT PENALTY FLASH ──────────────────────────────────────────────────────
function flashBoltPenalty(boltEls, penaltyPts) {
  if (!boltEls || !boltEls[0]) return;
  var row = boltEls[0].parentElement;
  if (!row) return;
  var badge = document.createElement('div');
  badge.className = 'bolt-penalty-badge';
  badge.textContent = '-' + penaltyPts;
  row.appendChild(badge);
  row.classList.add('bolt-penalty-flash');
  boltEls.forEach(function(el, i) {
    if (!el) return;
    setTimeout(function() { el.classList.add('bolt-penalty-pip'); }, i * 60);
  });
  setTimeout(function() {
    row.classList.remove('bolt-penalty-flash');
    boltEls.forEach(function(el) { if (el) el.classList.remove('bolt-penalty-pip'); });
    if (badge.parentElement) badge.parentElement.removeChild(badge);
  }, 1200);
}

function animateDice(callback) {
  if (!game || !dice3D) {
    // Fallback: generate random values if no 3D engine
    var fallback = [0,1,2,3,4].map(function() { return Math.ceil(Math.random() * 6); });
    setTimeout(function() { callback(fallback); }, 100);
    return;
  }
  var locked = game.turn.lockedIndices || [];
  dice3D.animateDice(locked, callback);
}

// ─── RENDER: DICE ─────────────────────────────────────────────────────────────
function renderDice(isBust) {
  if (!game || !dice3D) return;
  var locked = game.turn.lockedIndices || [];
  [0,1,2,3,4].forEach(function(i) {
    if (locked.indexOf(i) !== -1)      dice3D.setDieClass(i, 'scored');
    else if (isBust)                   dice3D.setDieClass(i, 'bust');
    else                               dice3D.setDieClass(i, '');
  });
}

// Force-reset fill to 0% instantly (bypass springy transition for dump truck)
function resetFillInstant(fillEl) {
  fillEl.style.transition = 'none';
  fillEl.style.height = '0%';
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      fillEl.style.transition = '';
    });
  });
}

// ─── RENDER: SCALES ───────────────────────────────────────────────────────────
function renderScales() {
  if (!game) return;
  updateScale(fillHuman, scaleHumanScore, scaleHumanStatus, scaleBoltsH, sBoltsH, game.players[0], markerHuman);
  updateScale(fillBot,   scaleBotScore,   scaleBotStatus,   scaleBoltsB, sBoltsB, game.players[1], markerBot);
  renderStrips();
}

function updateScale(fillEl, scoreLabel, statusLabel, scaleBolts, topBolts, player, markerEl) {
  var pct = Math.min(100, (player.score / CONFIG.WINNING_SCORE) * 100);
  fillEl.style.height = pct + '%';

  if (markerEl) {
    markerEl.textContent = player.score;
    markerEl.style.bottom = pct + '%';
    var s = player.score;
    if ((s >= CONFIG.PIT1_MIN && s <= CONFIG.PIT1_MAX) || (s >= CONFIG.PIT2_MIN && s <= CONFIG.PIT2_MAX)) {
      markerEl.dataset.zone = 'pit';
    } else if (player.isOnBarrel) {
      markerEl.dataset.zone = 'barrel';
    } else {
      markerEl.dataset.zone = '';
    }
  }

  if (scoreLabel) scoreLabel.textContent = player.score;
  var topScoreEl = fillEl.id === 'fill-human' ? humanScoreBox : botScoreBox;
  if (topScoreEl) topScoreEl.textContent = player.score;

  fillEl.classList.toggle('on-barrel', !!player.isOnBarrel);
  var crown = fillEl.querySelector('.scale-barrel-crown');
  if (crown) crown.textContent = player.isOnBarrel ? '🛢' : '';

  var lockEl   = fillEl.id === 'fill-human' ? lockHuman : lockBot;
  var lockWrap = lockEl ? lockEl.parentElement : null;
  var subLabel = fillEl.id === 'fill-human' ? scaleHumanSub : scaleBotSub;
  var tileKey  = fillEl.id === 'fill-human' ? 'human' : 'bot';
  if (lockEl && lockWrap) {

    // Determine new state
    var newState;
    if (player.isOnBarrel) {
      newState = 'barrel';
    } else if (player.score >= CONFIG.PIT2_MIN && player.score <= CONFIG.PIT2_MAX) {
      newState = 'pit2';
    } else if (player.score >= CONFIG.PIT1_MIN && player.score <= CONFIG.PIT1_MAX) {
      newState = 'pit1';
    } else if (player.isOpen) {
      newState = 'open';
    } else {
      newState = 'locked';
    }

    // Fire entry flash on state transition
    var prevState = tileState[tileKey];
    if (prevState !== newState) {
      tileState[tileKey] = newState;
      lockWrap.classList.remove('enter-pit', 'enter-barrel', 'enter-open', 'enter-locked');
      void lockWrap.offsetWidth; // force reflow so animation restarts
      if (newState === 'pit1' || newState === 'pit2') lockWrap.classList.add('enter-pit');
      else if (newState === 'barrel')                 lockWrap.classList.add('enter-barrel');
      else if (newState === 'open')                   lockWrap.classList.add('enter-open');
      else if (newState === 'locked')                 lockWrap.classList.add('enter-locked');
      setTimeout(function() {
        lockWrap.classList.remove('enter-pit', 'enter-barrel', 'enter-open', 'enter-locked');
      }, 1200);
    }

    // Set steady-state class, icon, tooltip, sub-label
    lockWrap.classList.remove('state-locked', 'state-open', 'state-pit', 'state-barrel');
    if (newState === 'barrel') {
      lockEl.innerHTML = '<span style="font-size:26px;line-height:1">🛢</span>';
      lockWrap.classList.add('state-barrel');
      lockWrap.dataset.tooltip = 'On Barrel — roll to hit exactly 1,000 and win!';
      var attempts = player.barrelAttempts || 0;
      if (subLabel) subLabel.textContent = attempts > 0 ? 'Attempt ' + attempts + '/' + CONFIG.BARREL_MAX_ATTEMPTS : 'Roll to win!';
    } else if (newState === 'pit2' || newState === 'pit1') {
      var pitNum  = newState === 'pit2' ? '2' : '1';
      var pitExit = newState === 'pit2' ? CONFIG.PIT2_EXIT : CONFIG.PIT1_EXIT;
      var needed  = pitExit - player.score;
      lockEl.innerHTML = '<span style="font-size:26px;line-height:1">⛏</span>';
      lockWrap.classList.add('state-pit');
      lockWrap.dataset.tooltip = 'Pit ' + pitNum + ' — must reach ' + pitExit + '+ to escape.';
      if (subLabel) subLabel.textContent = 'Need ' + needed + ' pts';
    } else if (newState === 'open') {
      lockEl.innerHTML = SVG_UNLOCKED;
      lockWrap.classList.add('state-open');
      lockWrap.dataset.tooltip = 'Open — banking normally.';
      if (subLabel) subLabel.textContent = '';
    } else {
      lockEl.innerHTML = SVG_LOCKED;
      lockWrap.classList.add('state-locked');
      lockWrap.dataset.tooltip = 'Locked — bank 50+ pts in one turn to unlock.';
      if (subLabel) subLabel.textContent = '';
    }
  }

  if (statusLabel) {
    if (player.isOnBarrel)                                                             { statusLabel.textContent = 'On Barrel'; statusLabel.style.color = 'var(--status-warn)'; }
    else if (player.score >= CONFIG.PIT2_MIN && player.score <= CONFIG.PIT2_MAX)       { statusLabel.textContent = 'Pit 2';     statusLabel.style.color = 'var(--status-bad)'; }
    else if (player.score >= CONFIG.PIT1_MIN && player.score <= CONFIG.PIT1_MAX)       { statusLabel.textContent = 'Pit 1';     statusLabel.style.color = 'var(--status-bad)'; }
    else if (!player.isOpen)                                                           { statusLabel.textContent = 'Locked';    statusLabel.style.color = 'var(--text-dim)'; }
    else                                                                               { statusLabel.textContent = 'Open';      statusLabel.style.color = 'var(--status-good)'; }
  }

  var bolts = player.bolts || 0;
  if (scaleBolts) scaleBolts.forEach(function(el, i) { if (el) el.classList.toggle('on', i < bolts); });
  if (topBolts)   topBolts.forEach(function(el, i)   { if (el) el.classList.toggle('on', i < bolts); });
}

// ─── RENDER: TURN INFO ────────────────────────────────────────────────────────
function renderTurnInfo() {
  if (!game) return;
  var isHuman = game.currentPlayerIndex === 0;
  var ts = game.turn.turnScore;
  // Comms status strip
  if (commsTurnNum)   commsTurnNum.textContent   = turnCounter;
  if (commsWhoseTurn) {
    commsWhoseTurn.textContent = isHuman ? 'Your turn' : "Bot's turn";
    commsWhoseTurn.style.color = isHuman ? '' : '#c084fc';
  }
  if (commsTurnScore) commsTurnScore.textContent = ts > 0 ? '+' + ts + ' pts' : '';
  // Legacy sync
  if (narratorRound) narratorRound.textContent = 'Turn ' + turnCounter;
  if (narratorTurn)  narratorTurn.textContent  = isHuman ? 'Your turn' : "Bot's turn";
  if (narratorScore) narratorScore.textContent = ts > 0 ? '+' + ts : '';
  if (turnLabel)      turnLabel.textContent      = isHuman ? 'Your Turn' : "Bot's Turn";
  if (turnScoreEl)    turnScoreEl.textContent    = ts > 0 ? '+' + ts : '';
  if (turnRoundLabel) turnRoundLabel.textContent = 'Turn ' + turnCounter;
}

// ─── MOBILE STRIPS ─────────────────────────────────────────────────────────────────────────
function renderStrips() {
  if (!game) return;
  var players = [
    { player: game.players[0], stripEl: document.getElementById('strip-human'),
      fillEl: document.getElementById('strip-human-fill'),
      markerEl: document.getElementById('strip-human-marker'),
      scoreEl: document.getElementById('strip-human-score'),
      lockEl: document.getElementById('strip-human-lock'),
      lockLabelEl: document.getElementById('strip-human-lock-label'),
      boltsEl: document.getElementById('strip-human-bolts'),
      pit1El: document.getElementById('strip-human-pit1'),
      pit2El: document.getElementById('strip-human-pit2'),
      barrelEl: document.getElementById('strip-human-barrel'),
      nameEl: document.getElementById('strip-human-name'),
    },
    { player: game.players[1], stripEl: document.getElementById('strip-bot'),
      fillEl: document.getElementById('strip-bot-fill'),
      markerEl: document.getElementById('strip-bot-marker'),
      scoreEl: document.getElementById('strip-bot-score'),
      lockEl: document.getElementById('strip-bot-lock'),
      lockLabelEl: document.getElementById('strip-bot-lock-label'),
      boltsEl: document.getElementById('strip-bot-bolts'),
      pit1El: document.getElementById('strip-bot-pit1'),
      pit2El: document.getElementById('strip-bot-pit2'),
      barrelEl: document.getElementById('strip-bot-barrel'),
      nameEl: document.getElementById('strip-bot-name'),
    },
  ];

  players.forEach(function(p, idx) {
    if (!p.stripEl || !p.player) return;
    var score   = p.player.score || 0;
    var pct     = Math.min(score / 1000, 1) * 100;

    // Score fill + marker
    if (p.fillEl)   p.fillEl.style.width = pct + '%';
    if (p.markerEl) p.markerEl.style.left = pct + '%';
    if (p.scoreEl)  p.scoreEl.textContent = score;

    // Name
    if (p.nameEl) p.nameEl.textContent = p.player.name || (idx === 0 ? playerName : 'Bot');

    // Bolts
    var bolts = p.player.bolts || 0;
    if (p.boltsEl) {
      var boltHtml = '';
      for (var b = 0; b < 3; b++) {
        boltHtml += '<span style="opacity:' + (b < bolts ? '1' : '0.2') + '">⚡</span>';
      }
      p.boltsEl.innerHTML = boltHtml;
    }

    // State
    var inPit1   = score >= CONFIG.PIT1_MIN && score <= CONFIG.PIT1_MAX;
    var inPit2   = score >= CONFIG.PIT2_MIN && score <= CONFIG.PIT2_MAX;
    var onBarrel = p.player.isOnBarrel;
    var isOpen   = p.player.isOpen;

    p.stripEl.classList.remove('state-pit', 'state-barrel', 'state-open');
    if (onBarrel) {
      p.stripEl.classList.add('state-barrel');
      if (p.lockEl)      p.lockEl.textContent = '🛢';
      if (p.lockLabelEl) p.lockLabelEl.textContent = 'Barrel';
    } else if (inPit1 || inPit2) {
      p.stripEl.classList.add('state-pit');
      if (p.lockEl)      p.lockEl.textContent = '⛏';
      if (p.lockLabelEl) p.lockLabelEl.textContent = inPit1 ? 'Pit 1' : 'Pit 2';
    } else if (isOpen) {
      p.stripEl.classList.add('state-open');
      if (p.lockEl)      p.lockEl.textContent = '🔓';
      if (p.lockLabelEl) p.lockLabelEl.textContent = 'Open';
    } else {
      if (p.lockEl)      p.lockEl.textContent = '🔒';
      if (p.lockLabelEl) p.lockLabelEl.textContent = 'Locked';
    }

    // Zone active highlights
    if (p.pit1El)   p.pit1El.classList.toggle('active', inPit1);
    if (p.pit2El)   p.pit2El.classList.toggle('active', inPit2);
    if (p.barrelEl) p.barrelEl.classList.toggle('active', !!onBarrel);

    // Active turn
    var isCurrentPlayer = (idx === game.currentPlayerIndex);
    p.stripEl.classList.toggle('active-turn', isCurrentPlayer);
  });
}

function renderAll() {
  renderTurnInfo(); renderScales();
  resetDiceDisplay(); setTurnUI(true); enableActions();
}

function resetDiceDisplay() {
  if (dice3D) dice3D.resetAll();
  if (comboLabel)    comboLabel.textContent   = '';
  if (narratorScore) narratorScore.textContent = '';
  if (narratorHint)  { narratorHint.textContent = ''; narratorHint.className = ''; }
  if (commsTurnScore) commsTurnScore.textContent = '';
  if (turnScoreEl)   turnScoreEl.textContent = '';
  setMessage('Roll the dice!', 'neutral');
  btnBank.textContent = 'Bank';
}

function setTurnUI(isHuman) {
  if (turnLabel) turnLabel.textContent = isHuman ? 'Your Turn' : "Bot's Turn";
  if (commsWhoseTurn) {
    commsWhoseTurn.textContent = isHuman ? 'Your turn' : "Bot's turn";
    commsWhoseTurn.style.color = isHuman ? '' : '#c084fc';
  }
  if (narratorTurn) {
    narratorTurn.textContent = isHuman ? 'Your turn' : "Bot's turn";
    narratorTurn.style.color = isHuman ? '' : '#c084fc';
  }
  document.getElementById('table-inner').classList.toggle('bot-turn', !isHuman);
}

function enableActions()  {
  btnRoll.disabled = false;
  btnBank.disabled = true;
  document.getElementById('action-buttons').classList.remove('bank-available');
}
function disableActions() {
  btnRoll.disabled = true;
  btnBank.disabled = true;
  document.getElementById('action-buttons').classList.remove('bank-available');
}
function setMessage(text, skin, icon) {
  // skin: 'neutral'|'hint'|'good'|'warn'|'bad'|'bot'|'big'
  if (commsMessage) {
    // Strip legacy compound classes like 'bad big', 'good big', 'warn big'
    var baseSkin = (skin || 'neutral').split(' ')[0];
    var isBig    = (skin || '').indexOf('big') !== -1;
    commsMessage.className = 'skin-' + (isBig ? 'big' : baseSkin);
    if (commsIcon) commsIcon.textContent = icon || '';
    if (commsText) {
      commsText.textContent = text || '';
      commsText.title       = text || '';
    }
    // Re-trigger pulse animation for big skin
    if (isBig) {
      commsMessage.classList.remove('skin-big');
      void commsMessage.offsetWidth; // force reflow
      commsMessage.classList.add('skin-big');
    }
  }
  // Legacy sync (hidden via CSS)
  if (narratorHint) { narratorHint.textContent = text || ''; narratorHint.className = skin || ''; }
  if (messageBar)   { messageBar.textContent   = text || ''; messageBar.className   = skin || ''; }
}

// ── EVENT TOAST ──
function showToast(icon, title, sub, skin, duration) {
  if (!toastEl) return;
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  toastEl.className = 'toast-' + (skin || 'warn');
  toastIconEl.textContent  = icon  || '';
  toastTitleEl.textContent = title || '';
  toastSubEl.textContent   = sub   || '';
  if (toastBarEl) {
    toastBarEl.style.transition = 'none';
    toastBarEl.style.transform  = 'scaleX(1)';
  }
  toastEl.classList.add('visible');
  var ms = (duration === undefined) ? 2800 : duration;
  if (ms > 0) {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (toastBarEl) {
          toastBarEl.style.transition = 'transform ' + ms + 'ms linear';
          toastBarEl.style.transform  = 'scaleX(0)';
        }
      });
    });
    toastTimer = setTimeout(function() {
      toastEl.classList.remove('visible');
    }, ms);
  }
}
function showOverlay(el) { if (el) el.classList.remove('hidden'); }
function hideOverlay(el)  { if (el) el.classList.add('hidden'); }

// ─── DUMP TRUCK (inline) ──────────────────────────────────────────────────────
function showDumpTruck(whoName) {
  var tableFrame = document.getElementById('table-frame');
  tableFrame.classList.add('dump-shake');
  setTimeout(function() { tableFrame.classList.remove('dump-shake'); }, 550);
  setMessage('🚛 DUMP TRUCK! ' + whoName + ' hits 555 — reset to 0!', 'bad big');
  disableActions();
  setTimeout(function() {
    setMessage('');
    // Score already zeroed by engine — just end turn and pass play
    game = endTurnOnly(game);
    var nh = game.currentPlayerIndex === 0;
    setTurnUI(nh); resetDiceDisplay(); renderScales();
    turnCounter++;
    logTurnStart(nh ? playerName : 'Bot', turnCounter, currentScores());
    if (nh) { setMessage('Your turn — roll the dice!', ''); enableActions(); }
    else    { setMessage('Bot is thinking...', ''); scheduleBotAction(); }
  }, DELAY_DUMP);
}

function showGameOver(humanWon) {
  logSessionEnd(humanWon ? playerName : 'Bot', currentScores());
  disableActions();
  tutorialComplete();
  if (humanWon) playWin(); else playLoss(); // no-op if already completed or not in tutorial mode

  // ── Step 1: scale blink on the winner's column ──
  var winnerCol = document.getElementById(humanWon ? 'scale-human-col' : 'scale-bot-col');
  if (winnerCol) {
    winnerCol.classList.add('winner-blink');
    setTimeout(function() { winnerCol.classList.remove('winner-blink'); }, 4400);
  }

  // ── Step 2: big winner toast (3 s hold) ──
  var winnerName = humanWon ? playerName : 'Bot';
  showToast(
    humanWon ? '🏆' : '🤖',
    'And the winner is ' + winnerName + '!',
    humanWon ? 'Congratulations — you reached 1,000 points!' : 'Better luck next time!',
    'winner',
    3200
  );

  // ── Step 3: hint bar message ──
  if (humanWon) {
    setMessage('🏆 ' + playerName + ' wins! You reached 1,000!', 'good big');
  } else {
    setMessage('🤖 Bot wins! Better luck next time.', 'bad big');
  }

  // ── Step 4: save score or show guest prompt ──
  setTimeout(function() {
    // Hide action buttons, show end-game buttons (Play Again + Exit)
    document.getElementById('action-buttons').style.display = 'none';
    if (endGameButtons) endGameButtons.classList.add('visible');

    if (currentUser) {
      // Logged in — save score silently
      saveScore({
        userId:     currentUser.id,
        username:   playerName,
        score:      game.players[0].score,
        turns:      turnCounter,
        won:        humanWon,
        difficulty: difficulty,
      }).then(function() {
        setMessage('🏆 Score saved to leaderboard!', 'good');
      }).catch(function(err) {
        console.warn('Score save failed:', err);
      });
      // Hide guest prompt
      var guestPrompt = document.getElementById('auth-guest-prompt');
      if (guestPrompt) guestPrompt.style.display = 'none';
    } else {
      // Guest — show prompt to sign up / log in
      var guestPrompt = document.getElementById('auth-guest-prompt');
      if (guestPrompt) guestPrompt.style.display = 'flex';
    }
  }, 3400);
}

btnPlayAgainInline.addEventListener('click', function() {
  if (endGameButtons) endGameButtons.classList.remove('visible');
  document.getElementById('action-buttons').style.display = '';
  hideEmailCapture();
  startGame();
});

if (btnExitToLobby) btnExitToLobby.addEventListener('click', function() {
  if (endGameButtons) endGameButtons.classList.remove('visible');
  document.getElementById('action-buttons').style.display = '';
  hideEmailCapture();
  showLobby();
});

if (btnPlayAgain) btnPlayAgain.addEventListener('click', function() {
  hideOverlay(overlayGameover);
  screenGame.classList.remove('active');
  screenName.classList.add('active');
  inputName.value = playerName;
});

// ─── TOOLTIP (P3-A: hybrid hover + touch) ────────────────────────────────────


var tooltipDismissTimer = null;

// ─── EMAIL CAPTURE ─────────────────────────────────────────────────────────
var SUPABASE_URL = 'https://jchueroccwbpkfiodchn.supabase.co';
var SUPABASE_KEY = 'sb_publishable_yJ_9Vy6_MTGbGlDtUo2WBQ_FwBvf3dQ';
var EMAIL_STORAGE_KEY = 'diceRush_emailCaptured';
var emailCaptureEl = null;

function buildEmailCapture() {
  if (emailCaptureEl) return;
  emailCaptureEl = document.createElement('div');
  emailCaptureEl.id = 'email-capture';
  emailCaptureEl.innerHTML = [
    '<p id="email-capture-label">Get notified when multiplayer launches</p>',
    '<div id="email-capture-row">',
    '  <input id="email-input" type="email" placeholder="your@email.com" autocomplete="email" />',
    '  <button id="email-submit">Notify Me</button>',
    '</div>',
    '<p id="email-capture-msg"></p>',
  ].join('');
  btnPlayAgainInline.parentElement.insertBefore(emailCaptureEl, btnPlayAgainInline.nextSibling);
  document.getElementById('email-submit').addEventListener('click', submitEmail);
  document.getElementById('email-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') submitEmail();
  });
}

function showEmailCapture() {
  if (localStorage.getItem(EMAIL_STORAGE_KEY)) return;
  buildEmailCapture();
  emailCaptureEl.classList.add('visible');
}

function hideEmailCapture() {
  if (emailCaptureEl) emailCaptureEl.classList.remove('visible');
}

async function submitEmail() {
  var input = document.getElementById('email-input');
  var msg   = document.getElementById('email-capture-msg');
  var btn   = document.getElementById('email-submit');
  var email = input ? input.value.trim() : '';
  if (!email || !email.includes('@')) {
    msg.textContent = 'Please enter a valid email.';
    msg.className = 'error';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    var device = navigator.userAgent.substring(0, 120);
    var res = await fetch(SUPABASE_URL + '/rest/v1/signups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ email: email, device: device }),
    });
    if (res.ok || res.status === 201) {
      localStorage.setItem(EMAIL_STORAGE_KEY, '1');
      input.style.display = 'none';
      btn.style.display   = 'none';
      document.getElementById('email-capture-label').textContent = '🎉 You’re on the list!';
      msg.textContent = 'We’ll let you know when multiplayer is ready.';
      msg.className = 'success';
    } else if (res.status === 409) {
      localStorage.setItem(EMAIL_STORAGE_KEY, '1');
      msg.textContent = 'You’re already on the list!';
      msg.className = 'success';
      btn.textContent = 'Notify Me';
      btn.disabled = false;
    } else {
      throw new Error('status ' + res.status);
    }
  } catch (err) {
    msg.textContent = 'Something went wrong — try again.';
    msg.className = 'error';
    btn.textContent = 'Notify Me';
    btn.disabled = false;
  }
}

function showTooltip(text, x, y) {
  tooltipEl.textContent = text;
  tooltipEl.classList.add('visible');
  positionTooltip(x, y);
}
function hideTooltip() {
  tooltipEl.classList.remove('visible');
  if (tooltipDismissTimer) { clearTimeout(tooltipDismissTimer); tooltipDismissTimer = null; }
}
function positionTooltip(x, y) {
  var tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
  var nx = x + 14, ny = y - 10;
  if (nx + tw > window.innerWidth  - 8) nx = x - tw - 14;
  if (ny + th > window.innerHeight - 8) ny = y - th - 10;
  tooltipEl.style.left = nx + 'px';
  tooltipEl.style.top  = ny + 'px';
}

document.addEventListener('mouseover', function(e) {
  var t = e.target.closest('[data-tooltip]');
  if (!t) return;
  showTooltip(t.dataset.tooltip, e.clientX, e.clientY);
});
document.addEventListener('mousemove', function(e) {
  if (!tooltipEl.classList.contains('visible')) return;
  positionTooltip(e.clientX, e.clientY);
});
document.addEventListener('mouseout', function(e) {
  var t = e.target.closest('[data-tooltip]');
  if (!t) return;
  hideTooltip();
});
document.addEventListener('touchstart', function(e) {
  var t = e.target.closest('[data-tooltip]');
  if (!t) { hideTooltip(); return; }
  var touch = e.touches[0];
  showTooltip(t.dataset.tooltip, touch.clientX, touch.clientY);
  if (tooltipDismissTimer) clearTimeout(tooltipDismissTimer);
  tooltipDismissTimer = setTimeout(hideTooltip, 2000);
}, { passive: true });

// ─── MUTE BUTTON ────────────────────────────────────────────────────────────
var btnMute = document.getElementById('btn-mute');
if (btnMute) {
  btnMute.textContent = isMuted() ? '🔇' : '🔊';
  btnMute.addEventListener('click', function() {
    var muted = toggleMute();
    btnMute.textContent = muted ? '🔇' : '🔊';
  });
}

// ─── LOG EXPORT BUTTON ────────────────────────────────────────────────────────
(function() {
  var btn = document.createElement('button');
  btn.id = 'btn-export-log';
  btn.title = 'Export session log';
  btn.innerHTML = '📋';
  btn.addEventListener('click', exportLog);
  document.body.appendChild(btn);
})();

// ─── AUTH INIT ───────────────────────────────────────────────────────────────
(async function initAuth() {
  // Called when entry screen auth succeeds — start the game
  function onEntryAuth(user) {
    currentUser = user;
    updateAuthUI(user);
    var username = user.user_metadata?.username || user.email || 'Player';
    playerName = username;
    showLobby();
  }

  // Init modal + entry screen listeners
  initAuthModal(onAuthChange, onEntryAuth);

  // Wire game over guest prompt buttons
  var goSignupBtn = document.getElementById('gameover-signup-btn');
  var goLoginBtn  = document.getElementById('gameover-login-btn');
  if (goSignupBtn) goSignupBtn.addEventListener('click', function() { showAuthModal('signup'); });
  if (goLoginBtn)  goLoginBtn.addEventListener('click',  function() { showAuthModal('login');  });

  // Listen for Supabase auth events (token refresh, sign-out from another tab, etc.)
  // We handle this here instead of ignoring it, so currentUser stays in sync
  // without disrupting an in-progress game.
  supabase.auth.onAuthStateChange(function(event, session) {
    if (event === 'TOKEN_REFRESHED') {
      // Silently update currentUser — no screen change, no game reset
      if (session) {
        currentUser = session.user;
        updateAuthUI(currentUser);
      }
    } else if (event === 'SIGNED_OUT') {
      // Only act on explicit sign-out (e.g. another tab logged out)
      if (game) return; // don't interrupt a game in progress
      currentUser = null;
      updateAuthUI(null);
    }
    // SIGNED_IN is handled by onEntryAuth / handleLogin — ignore here
  });

  // Restore session silently on load — skip entry screen if already logged in
  try {
    var data = await getSession();
    if (data.session) {
      currentUser = data.session.user;
      updateAuthUI(currentUser);
      var username = currentUser.user_metadata?.username || currentUser.email || 'Player';
      playerName = username;
      if (inputName) inputName.value = username;
      // Only auto-start if a game isn't already running
      if (!game) {
        showLobby();
      }
    } else {
      updateAuthUI(null);
      // Stay on entry screen — user must log in or sign up
    }
  } catch (e) {
    console.warn('Session restore failed:', e);
    updateAuthUI(null);
  }
})();

// Calibration panel removed — Rapier physics reads faces via quaternion, no snapping needed.
