// Dice Rush - Bot Opponent
import { scoreDice } from './scoring.js';
import { CONFIG } from './gameState.js';

// Easy bot - banks conservatively as soon as it has any score
function easyDecision(game) {
  var player = game.players[game.currentPlayerIndex];
  var turn = game.turn;
  // On barrel: must always roll, engine handles win/fail
  if (player.isOnBarrel) return 'roll';
  if (turn.turnScore >= 50) return 'bank';
  return 'roll';
}

// Hard bot - uses expected value logic
function hardDecision(game) {
  var turn = game.turn;
  var player = game.players[game.currentPlayerIndex];
  var opponent = game.players.find(function(p, i) {
    return i !== game.currentPlayerIndex;
  });

  // On barrel: bot has no choice — must always roll, engine handles win/fail
  if (player.isOnBarrel) return 'roll';

  // If in a pit, keep rolling until we escape
  if (player.score >= CONFIG.PIT1_MIN && player.score <= CONFIG.PIT1_MAX) {
    var needed1 = CONFIG.PIT1_EXIT - player.score;
    if (turn.turnScore >= needed1) return 'bank';
    return 'roll';
  }
  if (player.score >= CONFIG.PIT2_MIN && player.score <= CONFIG.PIT2_MAX) {
    var needed2 = CONFIG.PIT2_EXIT - player.score;
    if (turn.turnScore >= needed2) return 'bank';
    return 'roll';
  }

  // Opponent is close to winning - increase aggression
  var opponentNearWin = opponent && opponent.score >= CONFIG.BARREL_THRESHOLD_CLASSIC;
  var aggressionBonus = opponentNearWin ? 50 : 0;

  // Bank if turn score is high enough
  if (turn.turnScore >= 300 + aggressionBonus) return 'bank';
  if (turn.turnScore >= 150 + aggressionBonus && turn.activeDiceCount <= 2) return 'bank';
  if (turn.turnScore >= 200 + aggressionBonus) return 'bank';

  return 'roll';
}

// Main bot decision function
// Returns 'roll' or 'bank'
export function botDecision(game, difficulty) {
  if (difficulty === 'hard') {
    return hardDecision(game);
  }
  return easyDecision(game);
}

// Run a full bot turn with simulated delay between actions
// onRoll and onBank are callbacks so the UI can animate each step
export function runBotTurn(game, difficulty, onRoll, onBank) {
  var delay = 500 + Math.random() * 1000;

  setTimeout(function() {
    var decision = botDecision(game, difficulty);
    if (decision === 'bank') {
      onBank();
    } else {
      onRoll();
    }
  }, delay);
}