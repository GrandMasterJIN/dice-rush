// Dice Rush — Session Logger
// Logs one game session to localStorage. Overwrites on every new game.
// Access the log via window.diceRushLog() in the browser console,
// or click the export button that appears in the bottom-right corner.
//
// Log structure:
//   sessionLog.meta      — player name, difficulty, start time
//   sessionLog.turns[]   — one entry per turn
//     turn.player        — player name
//     turn.turnNumber    — global turn counter (1-based)
//     turn.rolls[]       — one entry per roll within the turn
//       roll.rollNumber  — roll within the turn (1-based)
//       roll.dice        — [d1,d2,d3,d4,d5] all 5 die values
//       roll.activeDice  — only the re-rolled dice this throw
//       roll.lockedBefore— locked indices before this roll
//       roll.combo       — combo label(s) e.g. "Small Straight" / "3x 4s + 1x single 5"
//       roll.points      — points scored this roll
//       roll.turnTotal   — running turn total after this roll
//       roll.phase       — 'scored' | 'bust' | 'hot' | 'dumptruck'
//     turn.banked        — pts banked (null if bust/dump)
//     turn.scoreAfter    — player total score after turn ends
//     turn.outcome       — 'banked' | 'bust' | 'dumptruck' | 'win'
//   sessionLog.events[]  — notable game events (bolt penalties, pits, barrel, dump, win)
//   sessionLog.endTime   — ISO timestamp when game ended

const STORAGE_KEY = 'diceRush_sessionLog';

var sessionLog = null;
var currentTurn = null;

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export function logSessionStart(playerNameArg, difficultyArg) {
  sessionLog = {
    meta: {
      playerName: playerNameArg,
      difficulty: difficultyArg,
      startTime: new Date().toISOString(),
      version: 'web-mvp-v8',
    },
    turns: [],
    events: [],
    endTime: null,
  };
  currentTurn = null;
  _save();
  _log('SESSION START — ' + playerNameArg + ' vs Bot (' + difficultyArg + ')');
}

export function logTurnStart(playerNameArg, turnNumber, scores) {
  currentTurn = {
    player:     playerNameArg,
    turnNumber: turnNumber,
    rolls:      [],
    banked:     null,
    scoreAfter: null,
    outcome:    null,
    scoreBefore: scores,
  };
  _log('--- Turn ' + turnNumber + ': ' + playerNameArg +
       ' (score: ' + scores[playerNameArg] + ') ---');
}

export function logRoll(activeDice, allDice, lockedBefore, comboLabel, points, turnTotal, phase) {
  if (!currentTurn) return;
  var rollNum = currentTurn.rolls.length + 1;
  var entry = {
    rollNumber:   rollNum,
    dice:         allDice.slice(),
    activeDice:   activeDice.slice(),
    lockedBefore: lockedBefore.slice(),
    combo:        comboLabel || '—',
    points:       points,
    turnTotal:    turnTotal,
    phase:        phase,
  };
  currentTurn.rolls.push(entry);

  var line = '  Roll ' + rollNum + ': [' + allDice.join(' ') + ']';
  if (lockedBefore.length) line += ' (locked: ' + lockedBefore.map(function(i){ return allDice[i]; }).join(' ') + ')';
  line += ' → ' + (comboLabel || 'no score');
  if (points) line += ' +' + points + ' (turn: ' + turnTotal + ')';
  line += ' [' + phase + ']';
  _log(line);
}

export function logTurnEnd(outcome, banked, scoreAfter) {
  if (!currentTurn) return;
  currentTurn.outcome    = outcome;
  currentTurn.banked     = banked;
  currentTurn.scoreAfter = scoreAfter;
  sessionLog.turns.push(currentTurn);
  _log('  → ' + outcome.toUpperCase() +
       (banked != null ? ' +' + banked : '') +
       ' | Score: ' + JSON.stringify(scoreAfter));
  currentTurn = null;
  _save();
}

export function logEvent(type, detail) {
  var entry = { time: _elapsed(), type: type, detail: detail };
  sessionLog.events.push(entry);
  _log('EVENT [' + type + '] ' + detail);
  _save();
}

export function logSessionEnd(winner, finalScores) {
  if (!sessionLog) return;
  sessionLog.endTime = new Date().toISOString();
  sessionLog.winner  = winner;
  sessionLog.finalScores = finalScores;
  _save();
  _log('SESSION END — Winner: ' + winner +
       ' | Scores: ' + JSON.stringify(finalScores));
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export function exportLog() {
  if (!sessionLog) {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) { alert('No session log found.'); return; }
    sessionLog = JSON.parse(stored);
  }
  var text = _buildReadableLog(sessionLog);
  var blob = new Blob([text], { type: 'text/plain' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'dice-rush-session-' + _dateStamp() + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// Also expose on window for quick console access
window.diceRushLog = function() {
  var stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) { console.log('No session log found.'); return null; }
  var log = JSON.parse(stored);
  console.log(_buildReadableLog(log));
  return log;
};

// ─── INTERNAL ─────────────────────────────────────────────────────────────────

var _startMs = null;

function _elapsed() {
  if (!_startMs) return '0s';
  var s = Math.round((Date.now() - _startMs) / 1000);
  return s + 's';
}

function _save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionLog)); } catch(e) {}
}

var _lines = [];

function _log(line) {
  if (!sessionLog) return;
  if (!sessionLog._raw) sessionLog._raw = [];
  sessionLog._raw.push(line);
}

function _dateStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

function _buildReadableLog(log) {
  var lines = [];
  lines.push('═══════════════════════════════════════════════════');
  lines.push('  DICE RUSH — SESSION LOG');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('  Player:     ' + log.meta.playerName);
  lines.push('  Difficulty: ' + log.meta.difficulty);
  lines.push('  Started:    ' + log.meta.startTime);
  lines.push('  Ended:      ' + (log.endTime || 'in progress'));
  lines.push('  Winner:     ' + (log.winner || '—'));
  if (log.finalScores) {
    Object.keys(log.finalScores).forEach(function(name) {
      lines.push('  Final score [' + name + ']: ' + log.finalScores[name]);
    });
  }
  lines.push('');
  lines.push('── TURN BY TURN ──────────────────────────────────');

  log.turns.forEach(function(turn) {
    lines.push('');
    lines.push('Turn ' + turn.turnNumber + ' — ' + turn.player +
               ' (before: ' + _scoreStr(turn.scoreBefore) + ')');

    turn.rolls.forEach(function(roll) {
      var diceStr = roll.dice.map(function(v, i) {
        return roll.lockedBefore.indexOf(i) !== -1 ? '[' + v + ']' : v;
      }).join(' ');
      var line = '  Roll ' + roll.rollNumber + ': ' + diceStr;
      line += '  →  ' + roll.combo;
      if (roll.points) line += '  +' + roll.points;
      line += '  (turn total: ' + roll.turnTotal + ')';
      if (roll.phase !== 'scored') line += '  [' + roll.phase.toUpperCase() + ']';
      lines.push(line);
    });

    var outcomeStr = '  Outcome: ' + turn.outcome.toUpperCase();
    if (turn.banked != null) outcomeStr += '  +' + turn.banked + ' pts';
    if (turn.scoreAfter) outcomeStr += '  →  ' + _scoreStr(turn.scoreAfter);
    lines.push(outcomeStr);
  });

  if (log.events && log.events.length) {
    lines.push('');
    lines.push('── NOTABLE EVENTS ────────────────────────────────');
    log.events.forEach(function(ev) {
      lines.push('  [' + ev.type + '] ' + ev.detail);
    });
  }

  lines.push('');
  lines.push('── RAW LOG ───────────────────────────────────────');
  (log._raw || []).forEach(function(l) { lines.push(l); });
  lines.push('');
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}

function _scoreStr(scores) {
  if (!scores) return '—';
  return Object.keys(scores).map(function(k) { return k + ':' + scores[k]; }).join(' | ');
}
