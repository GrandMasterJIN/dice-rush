// Dice Rush - Game State Machine
import { scoreDice } from './scoring.js';

export const CONFIG = {
  WINNING_SCORE: 1000,
  BOLT_PENALTY_EVERY: 3,
  BOLT_PENALTY_PTS: 100,
  PIT1_MIN: 200, PIT1_MAX: 299, PIT1_EXIT: 300,
  PIT2_MIN: 600, PIT2_MAX: 699, PIT2_EXIT: 700,
  DUMP_TRUCK_SCORE: 555,
  OVERTAKE_PENALTY: 50,
  THEME_VOTE_THRESHOLD: 75,
  OPENING_THRESHOLD_CLASSIC: 50,
  OPENING_THRESHOLD_VARIANT2: 75,
  BARREL_THRESHOLD_CLASSIC: 880,
  BARREL_THRESHOLD_VARIANT2: 850,
  BARREL_FALL_SCORE: 800,      // score after 3 failed attempts (below 880 threshold)
  BARREL_MAX_ATTEMPTS: 3,      // failed turns before falling off barrel
  BARREL_MAX_FALLS: 3,         // falls before score burned to 0
};

export function createGame(playerNames, ruleSet) {
  if (!playerNames) playerNames = ['Player', 'Bot'];
  if (!ruleSet) ruleSet = 'classic';
  return {
    ruleSet: ruleSet,
    players: playerNames.map(function(name) {
      return { name: name, score: 0, bolts: 0, isOpen: false, isOnBarrel: false, barrelAttempts: 0, barrelFalls: 0 };
    }),
    currentPlayerIndex: 0,
    turn: createTurn(),
    themeVoteDone: false,
    winner: null,
    log: [],
  };
}

function createTurn() {
  return {
    rollCount: 0,
    turnScore: 0,
    // All 5 dice values after merging locked + newly rolled
    diceValues: [],
    // Which positions (0-4) are locked from previous rolls this turn
    lockedIndices: [],
    // How many dice to roll next (5 minus locked count, resets to 5 on hot dice)
    activeDiceCount: 5,
    phase: 'rolling',
    hotDice: false,  // true if last roll locked all dice -> rolled all 5 again
  };
}

// rollN kept as fallback only — values now come from physics in dice3d.js
function rollN(n) {
  var dice = [];
  for (var i = 0; i < n; i++) {
    dice.push(Math.floor(Math.random() * 6) + 1);
  }
  return dice;
}

export function pitNumber(player) {
  if (player.score >= CONFIG.PIT1_MIN && player.score <= CONFIG.PIT1_MAX) return 1;
  if (player.score >= CONFIG.PIT2_MIN && player.score <= CONFIG.PIT2_MAX) return 2;
  return 0;
}

export function pitExitScore(player) {
  var pit = pitNumber(player);
  if (pit === 1) return CONFIG.PIT1_EXIT;
  if (pit === 2) return CONFIG.PIT2_EXIT;
  return 0;
}

export function canBank(game) {
  var player = game.players[game.currentPlayerIndex];
  var pit = pitNumber(player);
  if (pit > 0) {
    return player.score + game.turn.turnScore >= pitExitScore(player);
  }
  return game.turn.turnScore > 0;
}

// processRoll now accepts physicsValues — the full 5-die array read from physics
// orientation by dice3d.js. Active dice values come from physics; locked dice
// keep their existing values (also already in physicsValues from diceState).
export function processRoll(game, physicsValues) {
  var g = JSON.parse(JSON.stringify(game));
  var player = g.players[g.currentPlayerIndex];
  var turn = g.turn;
  turn.rollCount++;
  turn.hotDice = false;

  // physicsValues is the full [d0..d4] array from dice3d readFaceUp().
  // Active positions hold new physics results; locked positions already have
  // their correct values carried over from the previous roll.
  var activePositions = getActivePositions(turn.lockedIndices);
  var newRolled = activePositions.map(function(pos) {
    return physicsValues[pos];
  });

  // Store the full 5-die array
  turn.diceValues = physicsValues.slice();

  // Score only the newly rolled dice
  var result = scoreDice(newRolled);
  var total = result.total;

  // Bust: newly rolled dice scored nothing
  if (total === 0) {
    turn.turnScore = 0;
    if (player.isOnBarrel) {
      // Barrel: zero roll ends session — handled as barrel bust, fall applied in endTurn
      turn.phase = 'barrel_bust';
      g.log.push(player.name + ' rolled zero on barrel — session failed');
    } else if (turn.lockedIndices.length > 0) {
      turn.phase = 'bust';
      g.log.push(player.name + ' rolled zero with locked dice - turn ends, no bolt');
    } else {
      turn.phase = 'bust';
      player.bolts++;
      g.log.push(player.name + ' rolled zero - bolt #' + player.bolts);
      if (player.bolts % CONFIG.BOLT_PENALTY_EVERY === 0) {
        var scoreBeforePenalty = player.score;
        player.score = Math.max(0, player.score - CONFIG.BOLT_PENALTY_PTS);
        player.bolts = 0;
        g.log.push(player.name + ' penalty: -' + CONFIG.BOLT_PENALTY_PTS + ' pts, bolts reset');
        // Item 1: overtake check — bolt penalty may drop player below an open opponent
        for (var oi = 0; oi < g.players.length; oi++) {
          if (oi === g.currentPlayerIndex) continue;
          var opp = g.players[oi];
          if (opp.isOpen && scoreBeforePenalty > opp.score && player.score <= opp.score) {
            opp.score = Math.max(0, opp.score - CONFIG.OVERTAKE_PENALTY);
            turn.overtake_by_penalty = opp.name;
            g.log.push(opp.name + ' overtook ' + player.name + ' via penalty — ' + opp.name + ' -' + CONFIG.OVERTAKE_PENALTY + ' pts');
          }
        }
      }
    }
    return g;
  }

  // Add newly scored dice to locked indices
  var newlyScoredActiveIndices = getScoredActiveIndices(newRolled, result);
  var newlyLockedPositions = newlyScoredActiveIndices.map(function(i) {
    return activePositions[i];
  });
  turn.lockedIndices = turn.lockedIndices.concat(newlyLockedPositions);
  turn.lockedIndices.sort(function(a,b){return a-b;});

  turn.turnScore += total;
  g.log.push(player.name + ' rolled [' + newRolled.join(', ') + '] scored ' + total + ' (turn: ' + turn.turnScore + ')');

  // Five-ones autowin: single roll of 1000 pts wins unconditionally
  if (total === 1000) {
    turn.phase = 'autowin';
    g.log.push(player.name + ' rolled FIVE ONES — autowin!');
    return g;
  }

  // Hot dice: all 5 locked — reset and roll all 5 again next turn
  if (turn.lockedIndices.length === 5) {
    turn.lockedIndices = [];
    turn.activeDiceCount = 5;
    turn.hotDice = true;
    g.log.push(player.name + ' hot dice! All 5 scored - roll all 5 again');
  } else {
    turn.activeDiceCount = 5 - turn.lockedIndices.length;
  }

  // Dump truck check
  if (player.isOpen && player.score + turn.turnScore === CONFIG.DUMP_TRUCK_SCORE) {
    player.score = 0;
    turn.phase = 'dumptruck';
    g.log.push('DUMP TRUCK! ' + player.name + ' hit 555 - score reset to 0!');
    return g;
  }

  // Barrel exact win: turn total brings score to exactly 1000 — auto-bank, no choice
  if (player.isOnBarrel && player.score + turn.turnScore === CONFIG.WINNING_SCORE) {
    turn.phase = 'barrel_win';
    g.log.push(player.name + ' hit exactly 1000 on barrel — auto-win!');
    return g;
  }

  // Barrel overshoot: exceeded 1000 — session fails, fall applied in endTurn
  if (player.isOnBarrel && player.score + turn.turnScore > CONFIG.WINNING_SCORE) {
    turn.phase = 'barrel_bust';
    g.log.push(player.name + ' overshot 1000 on barrel — session failed');
    return g;
  }

  // Barrel scoring roll that didn’t reach 1000 yet: player keeps rolling (phase stays 'rolling')

  // Theme vote trigger
  if (!g.themeVoteDone && turn.turnScore >= CONFIG.THEME_VOTE_THRESHOLD) {
    g.themeVoteDone = true;
    g.log.push('Theme vote triggered by ' + player.name);
  }

  return g;
}

// Returns indices (0..4) of positions not in lockedIndices
function getActivePositions(lockedIndices) {
  var active = [];
  for (var i = 0; i < 5; i++) {
    if (lockedIndices.indexOf(i) === -1) active.push(i);
  }
  return active;
}

// Given the newly rolled dice and their score result,
// figure out which dice (by index within the rolled array) contributed to the score
function getScoredActiveIndices(dice, scoreResult) {
  if (!dice || !dice.length || !scoreResult || scoreResult.total === 0) return [];

  var indices = [];
  var counts = {};
  dice.forEach(function(v, i) {
    if (!counts[v]) counts[v] = [];
    counts[v].push(i);
  });

  // Check straights: all dice score
  var sorted = dice.slice().sort(function(a,b){return a-b;});
  var isSmall = JSON.stringify(sorted) === JSON.stringify([1,2,3,4,5]);
  var isLarge = JSON.stringify(sorted) === JSON.stringify([2,3,4,5,6]);
  if (isSmall || isLarge) {
    return dice.map(function(_, i){ return i; });
  }

  // Combos (3+ of a kind)
  dice.forEach(function(v, i) {
    if (counts[v] && counts[v].length >= 3) {
      if (indices.indexOf(i) === -1) indices.push(i);
    }
  });

  // Singles: 1s and 5s not already in a combo
  dice.forEach(function(v, i) {
    if ((v === 1 || v === 5) && counts[v].length < 3) {
      if (indices.indexOf(i) === -1) indices.push(i);
    }
  });

  return indices;
}

export function bankTurn(game) {
  var g = JSON.parse(JSON.stringify(game));
  var player = g.players[g.currentPlayerIndex];
  var openingThreshold = g.ruleSet === 'variant2'
    ? CONFIG.OPENING_THRESHOLD_VARIANT2
    : CONFIG.OPENING_THRESHOLD_CLASSIC;

  if (!player.isOpen) {
    if (g.turn.turnScore < openingThreshold) {
      g.log.push(player.name + ' needs ' + openingThreshold + ' pts to open');
      return endTurn(g);
    }
    player.isOpen = true;
    g.log.push(player.name + ' is now open!');
  }

  var newScore = player.score + g.turn.turnScore;

  var pit = pitNumber(player);
  if (pit > 0) {
    var exitScore = pitExitScore(player);
    if (newScore < exitScore) {
      g.log.push(player.name + ' cannot bank in pit - must reach ' + exitScore);
      return endTurn(g);
    }
    g.log.push(player.name + ' escaped pit ' + pit + '!');
  }

  if (newScore > CONFIG.WINNING_SCORE) {
    g.log.push(player.name + ' overshot 1000 - score stays at ' + player.score);
    return endTurn(g);
  }

  // Overtaking check
  for (var i = 0; i < g.players.length; i++) {
    if (i === g.currentPlayerIndex) continue;
    var other = g.players[i];
    if (player.score <= other.score && newScore > other.score && other.isOpen) {
      other.score = Math.max(0, other.score - CONFIG.OVERTAKE_PENALTY);
      g.log.push(player.name + ' overtook ' + other.name + ' -' + CONFIG.OVERTAKE_PENALTY + ' pts');
      if (other.score === CONFIG.DUMP_TRUCK_SCORE) {
        other.score = 0;
        g.turn.phase = 'dumptruck_other';
        g.log.push('DUMP TRUCK! ' + other.name + ' hit 555 from overtake - score reset to 0!');
      }
    }
  }

  player.score = newScore;

  // Dump truck check on banking player
  if (player.score === CONFIG.DUMP_TRUCK_SCORE) {
    player.score = 0;
    g.turn.phase = 'dumptruck';
    g.log.push('DUMP TRUCK! ' + player.name + ' hit 555 from banking - score reset to 0!');
    return endTurn(g);
  }

  var barrelThreshold = g.ruleSet === 'variant2'
    ? CONFIG.BARREL_THRESHOLD_VARIANT2
    : CONFIG.BARREL_THRESHOLD_CLASSIC;

  if (player.score >= barrelThreshold && player.score < CONFIG.WINNING_SCORE) {
    if (!player.isOnBarrel) {
      player.isOnBarrel = true;
      player.barrelAttempts = 0; // fresh session
      g.log.push(player.name + ' is on the barrel! Session ' + (player.barrelFalls + 1) + '/' + CONFIG.BARREL_MAX_FALLS);
    }
  }

  if (player.score === CONFIG.WINNING_SCORE) {
    g.winner = player.name;
    g.log.push(player.name + ' wins!');
    return g;
  }

  return endTurn(g);
}

export function endTurnOnly(game) {
  var g = JSON.parse(JSON.stringify(game));
  var player = g.players[g.currentPlayerIndex];

  // Barrel turn ended without winning — count the attempt
  if (player.isOnBarrel) {
    player.barrelAttempts++;
    g.log.push(player.name + ' barrel attempt ' + player.barrelAttempts + '/' + CONFIG.BARREL_MAX_ATTEMPTS + ' failed');

    if (player.barrelAttempts >= CONFIG.BARREL_MAX_ATTEMPTS) {
      // 3 failed attempts — fall off barrel
      player.barrelAttempts = 0;
      player.isOnBarrel = false;
      player.barrelFalls++;
      g.log.push(player.name + ' used all 3 barrel attempts — fall ' + player.barrelFalls + '/' + CONFIG.BARREL_MAX_FALLS + ', score drops to ' + CONFIG.BARREL_FALL_SCORE);

      if (player.barrelFalls >= CONFIG.BARREL_MAX_FALLS) {
        // 3 failed sessions — score burned to 0
        var scoreBeforeBurn = player.score;
        player.score = 0;
        player.barrelFalls = 0;
        g.turn.phase = 'barrel_burned';
        g.log.push(player.name + ' 3 barrel falls — score BURNED to 0!');
        // Item 1: overtake check after burn
        checkOvertakeByPenalty(g, g.currentPlayerIndex, scoreBeforeBurn);
      } else {
        var scoreBeforeFall = player.score;
        player.score = CONFIG.BARREL_FALL_SCORE;
        g.turn.phase = 'barrel_fall';
        // Item 1: overtake check after fall
        checkOvertakeByPenalty(g, g.currentPlayerIndex, scoreBeforeFall);
      }
    }
    // else: attempt counted, player stays on barrel, next turn is attempt 2 or 3
  }

  return endTurn(g);
}

// Item 1: check if a score drop caused an open opponent to overtake the penalised player
function checkOvertakeByPenalty(g, penalisedIndex, scoreBefore) {
  var player = g.players[penalisedIndex];
  for (var oi = 0; oi < g.players.length; oi++) {
    if (oi === penalisedIndex) continue;
    var opp = g.players[oi];
    // Overtake only fires if: opponent was behind before the drop, AND is now ahead
    if (opp.isOpen && opp.score > 0 && scoreBefore > opp.score && player.score < opp.score) {
      opp.score = Math.max(0, opp.score - CONFIG.OVERTAKE_PENALTY);
      g.turn.overtake_by_penalty = opp.name;
      g.log.push(opp.name + ' overtook ' + player.name + ' via penalty — ' + opp.name + ' -' + CONFIG.OVERTAKE_PENALTY + ' pts');
    }
  }
}

function endTurn(game) {
  game.turn = createTurn();
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.log.push('--- ' + game.players[game.currentPlayerIndex].name + ' turn ---');
  return game;
}

export function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

export function isInPit(player) {
  return pitNumber(player) > 0;
}
