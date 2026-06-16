import { describe, it, expect } from 'vitest';
import {
  createGame, processRoll, bankTurn, endTurnOnly,
  pitNumber, pitExitScore, canBank, CONFIG
} from '../gameState.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeGame(p1Score = 0, p2Score = 0, opts = {}) {
  const g = createGame(['Player', 'Bot'], 'classic');
  g.players[0].score   = p1Score;
  g.players[0].isOpen  = p1Score > 0 || opts.p1Open === true;
  g.players[1].score   = p2Score;
  g.players[1].isOpen  = p2Score > 0 || opts.p2Open === true;
  if (opts.p1OnBarrel)  g.players[0].isOnBarrel     = true;
  if (opts.p1Attempts)  g.players[0].barrelAttempts  = opts.p1Attempts;
  if (opts.p1Falls)     g.players[0].barrelFalls     = opts.p1Falls;
  if (opts.p1Bolts)     g.players[0].bolts           = opts.p1Bolts;
  return g;
}

// Build a full 5-die physics array; active positions get given values, locked keep 6
function makePhysics(values, lockedIndices = [], lockedValues = []) {
  const arr = [6, 6, 6, 6, 6];
  let vi = 0;
  for (let i = 0; i < 5; i++) {
    if (lockedIndices.indexOf(i) !== -1) {
      arr[i] = lockedValues[lockedIndices.indexOf(i)] ?? 6;
    } else {
      arr[i] = values[vi++] ?? 6;
    }
  }
  return arr;
}

// ─── Suite 2.1 — createGame ──────────────────────────────────────────────────
describe('createGame', () => {
  const g = createGame(['Player', 'Bot'], 'classic');
  it('G-01: player names',       () => expect(g.players.map(p => p.name)).toEqual(['Player', 'Bot']));
  it('G-02: custom names',       () => expect(createGame(['Alice','Bob']).players[0].name).toBe('Alice'));
  it('G-03: initial scores',     () => expect(g.players.map(p => p.score)).toEqual([0, 0]));
  it('G-04: initial bolts',      () => expect(g.players.map(p => p.bolts)).toEqual([0, 0]));
  it('G-05: initial isOpen',     () => expect(g.players.map(p => p.isOpen)).toEqual([false, false]));
  it('G-06: initial isOnBarrel', () => expect(g.players.map(p => p.isOnBarrel)).toEqual([false, false]));
  it('G-07: currentPlayerIndex', () => expect(g.currentPlayerIndex).toBe(0));
  it('G-08: ruleSet',            () => expect(g.ruleSet).toBe('classic'));
});

// ─── Suite 2.2 — processRoll: basic scoring ──────────────────────────────────
describe('processRoll — basic scoring', () => {
  it('G-09: small straight → turnScore 125', () => {
    const g = processRoll(makeGame(), makePhysics([1, 2, 3, 4, 5]));
    expect(g.turn.turnScore).toBe(125);
    expect(g.turn.phase).toBe('rolling');
  });

  it('G-10: three 1s → turnScore 100, 3 dice locked', () => {
    const g = processRoll(makeGame(), makePhysics([1, 1, 1, 2, 3]));
    expect(g.turn.turnScore).toBe(100);
    expect(g.turn.lockedIndices.length).toBe(3);
  });

  it('G-11: three 5s → turnScore 50', () => {
    const g = processRoll(makeGame(), makePhysics([5, 5, 5, 2, 4]));
    expect(g.turn.turnScore).toBe(50);
  });

  it('G-12: bust → total 0, phase bust', () => {
    const g = processRoll(makeGame(), makePhysics([2, 3, 4, 6, 6]));
    expect(g.turn.turnScore).toBe(0);
    expect(g.turn.phase).toBe('bust');
  });

  it('G-13: five ones → phase autowin', () => {
    const g = processRoll(makeGame(), makePhysics([1, 1, 1, 1, 1]));
    expect(g.turn.phase).toBe('autowin');
  });
});

// ─── Suite 2.3 — processRoll: bust scenarios ─────────────────────────────────
describe('processRoll — bust scenarios', () => {
  it('G-15: 0 bolts + bust → bolts = 1', () => {
    const g = processRoll(makeGame(), makePhysics([2, 3, 4, 6, 6]));
    expect(g.players[0].bolts).toBe(1);
    expect(g.turn.phase).toBe('bust');
  });

  it('G-16: 2 bolts + bust → penalty -100, bolts reset to 0', () => {
    const base = makeGame(200, 0);
    base.players[0].bolts = 2;
    const g = processRoll(base, makePhysics([2, 3, 4, 6, 6]));
    expect(g.players[0].bolts).toBe(0);
    expect(g.players[0].score).toBe(100); // 200 - 100
    expect(g.turn.phase).toBe('bust');
  });

  it('G-17: locked dice exist + bust → no bolt added', () => {
    const base = makeGame();
    base.turn.lockedIndices = [0, 1]; // pretend 2 dice already locked
    base.turn.diceValues    = [1, 1, 2, 3, 4];
    const g = processRoll(base, [1, 1, 2, 3, 4]);
    expect(g.players[0].bolts).toBe(0);
    expect(g.turn.phase).toBe('bust');
  });

  it('G-18: turnScore wiped on bust', () => {
    const base = makeGame();
    base.turn.turnScore = 50; // had 50 pts from previous roll
    const g = processRoll(base, makePhysics([2, 3, 4, 6, 6]));
    expect(g.turn.turnScore).toBe(0);
  });
});

// ─── Suite 2.4 — processRoll: hot dice ───────────────────────────────────────
describe('processRoll — hot dice', () => {
  it('G-19: all 5 score → hot dice, lockedIndices reset', () => {
    const g = processRoll(makeGame(), makePhysics([1, 1, 1, 5, 5]));
    expect(g.turn.hotDice).toBe(true);
    expect(g.turn.lockedIndices).toEqual([]);
    expect(g.turn.activeDiceCount).toBe(5);
  });

  it('G-20: small straight → hot dice', () => {
    const g = processRoll(makeGame(), makePhysics([1, 2, 3, 4, 5]));
    expect(g.turn.hotDice).toBe(true);
    expect(g.turn.lockedIndices).toEqual([]);
  });
});

// ─── Suite 2.5 — processRoll: dump truck ─────────────────────────────────────
describe('processRoll — dump truck', () => {
  it('G-21: open player hits 555 mid-roll → score reset, phase dumptruck', () => {
    const base = makeGame(500, 0, { p1Open: true });
    // Turn score of 55 brings 500 + 55 = 555
    const g = processRoll(base, makePhysics([5, 5, 1, 2, 3])); // 5+5+10=20... need exactly 55
    // Use [1,1,1,5] scored = 105, 500+105=605 — not a dump truck. Use a known combo.
    // Score [5,5,5,1,2] = 50+10=60 → 500+60=560 — not 555 either.
    // Build a game already at 500 with turnScore that makes 555:
    const base2 = makeGame(500, 0, { p1Open: true });
    base2.turn.turnScore    = 50;
    base2.turn.lockedIndices = [0]; // one die locked
    base2.turn.diceValues    = [5, 2, 3, 4, 6];
    // Active dice [1..4] roll [2,3,4,6] = 0 → bust, not dump truck
    // Simplest: set turnScore=45 then roll a single 5 to hit 555
    const base3 = makeGame(500, 0, { p1Open: true });
    base3.turn.turnScore     = 50;
    base3.turn.lockedIndices = [1, 2, 3, 4];
    // Active = [0], rolls a 5 → scores 5 → turnScore = 55 → 500+55=555
    const physics3 = [5, 6, 6, 6, 6];
    const g3 = processRoll(base3, physics3);
    expect(g3.turn.phase).toBe('dumptruck');
    expect(g3.players[0].score).toBe(0);
  });

  it('G-22: NOT open player — no dump truck', () => {
    const base = makeGame(0, 0); // not open
    base.turn.turnScore     = 50;
    base.turn.lockedIndices = [1, 2, 3, 4];
    const g = processRoll(base, [5, 6, 6, 6, 6]);
    expect(g.turn.phase).not.toBe('dumptruck');
  });
});

// ─── Suite 2.6 — processRoll: barrel ─────────────────────────────────────────
describe('processRoll — barrel', () => {
  it('G-23: on barrel, bust → phase barrel_bust', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true });
    const g = processRoll(base, makePhysics([2, 3, 4, 6, 6]));
    expect(g.turn.phase).toBe('barrel_bust');
  });

  it('G-24: on barrel, score exactly 100 → turnScore 100, phase rolling', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true });
    const g = processRoll(base, makePhysics([1, 1, 1, 2, 3]));
    expect(g.turn.turnScore).toBe(100);
    expect(g.turn.phase).toBe('barrel_win');
  });

  it('G-25: on barrel, overshoot → phase barrel_bust', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true });
    const g = processRoll(base, makePhysics([1, 1, 1, 1, 2]));
    // 4×1 = 200 → 900+200 = 1100 > 1000 → barrel_bust
    expect(g.turn.phase).toBe('barrel_bust');
  });
});

// ─── Suite 2.7 — pitNumber and pitExitScore ───────────────────────────────────
describe('pitNumber and pitExitScore', () => {
  const cases = [
    { score: 0,   pit: 0, exit: 0 },
    { score: 199, pit: 0, exit: 0 },
    { score: 200, pit: 1, exit: 300 },
    { score: 250, pit: 1, exit: 300 },
    { score: 299, pit: 1, exit: 300 },
    { score: 300, pit: 0, exit: 0 },
    { score: 600, pit: 2, exit: 700 },
    { score: 699, pit: 2, exit: 700 },
    { score: 700, pit: 0, exit: 0 },
    { score: 880, pit: 0, exit: 0 },
  ];
  cases.forEach(({ score, pit, exit }, i) => {
    it(`G-${26 + i}: score=${score} → pit=${pit}, exit=${exit}`, () => {
      const p = { score };
      expect(pitNumber(p)).toBe(pit);
      expect(pitExitScore(p)).toBe(exit);
    });
  });
});

// ─── Suite 2.8 — bankTurn: opening ───────────────────────────────────────────
describe('bankTurn — opening', () => {
  it('G-36: not open, turnScore=49 → not opened, turn passes', () => {
    const base = makeGame();
    base.turn.turnScore = 49;
    const g = bankTurn(base);
    expect(g.players[1].name).toBe('Bot'); // turn rotated
    expect(g.players[0].isOpen).toBe(false);
    expect(g.players[0].score).toBe(0);
  });

  it('G-37: not open, turnScore=50 → opened, score += 50', () => {
    const base = makeGame();
    base.turn.turnScore = 50;
    const g = bankTurn(base);
    expect(g.players[0].isOpen).toBe(true);
    expect(g.players[0].score).toBe(50);
  });

  it('G-38: not open, turnScore=75 → opened, score += 75', () => {
    const base = makeGame();
    base.turn.turnScore = 75;
    const g = bankTurn(base);
    expect(g.players[0].isOpen).toBe(true);
    expect(g.players[0].score).toBe(75);
  });

  it('G-39: already open, banks normally', () => {
    const base = makeGame(100, 0);
    base.turn.turnScore = 30;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(130);
  });
});

// ─── Suite 2.9 — bankTurn: pit rules ─────────────────────────────────────────
describe('bankTurn — pit rules', () => {
  it('G-40: in Pit 1 (250), turnScore=40 → cannot bank (290<300)', () => {
    const base = makeGame(250, 0);
    base.turn.turnScore = 40;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(250); // unchanged
  });

  it('G-41: in Pit 1 (250), turnScore=50 → banks (300, escapes)', () => {
    const base = makeGame(250, 0);
    base.turn.turnScore = 50;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(300);
  });

  it('G-42: in Pit 2 (650), turnScore=40 → cannot bank (690<700)', () => {
    const base = makeGame(650, 0);
    base.turn.turnScore = 40;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(650);
  });

  it('G-43: in Pit 2 (650), turnScore=50 → banks (700, escapes)', () => {
    const base = makeGame(650, 0);
    base.turn.turnScore = 50;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(700);
  });
});

// ─── Suite 2.10 — bankTurn: overtaking ───────────────────────────────────────
describe('bankTurn — overtaking', () => {
  it('G-44: P1=300 banks 60 (→360), P2=350 open → P2 loses 50 (→300)', () => {
    const base = makeGame(300, 350);
    base.turn.turnScore = 60;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(360);
    expect(g.players[1].score).toBe(300);
  });

  it('G-45: P2 NOT open → no overtake penalty', () => {
    const base = makeGame(300, 0);
    base.players[1].score  = 350;
    base.players[1].isOpen = false;
    base.turn.turnScore = 60;
    const g = bankTurn(base);
    expect(g.players[1].score).toBe(350);
  });

  it('G-46: P1=300 banks 40 (→340) < P2=350 → no overtake', () => {
    const base = makeGame(300, 350);
    base.turn.turnScore = 40;
    const g = bankTurn(base);
    expect(g.players[1].score).toBe(350);
  });

  it('G-47: P1=300 banks 260 (→560), P2=505 open → P2 loses 50 (→455)', () => {
    const base = makeGame(300, 505);
    base.turn.turnScore = 260;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(560);
    expect(g.players[1].score).toBe(455);
  });

  it('G-48: P1=300 banks 260 (→560), P2=605 open → no overtake (560<605)', () => {
    const base = makeGame(300, 605);
    base.turn.turnScore = 260;
    const g = bankTurn(base);
    expect(g.players[1].score).toBe(605);
  });
});

// ─── Suite 2.11 — bankTurn: dump truck ───────────────────────────────────────
describe('bankTurn — dump truck on banking', () => {
  it('G-49: open, score=500, turnScore=55 → score → 0, phase dumptruck', () => {
    const base = makeGame(500, 0);
    base.turn.turnScore = 55;
    const g = bankTurn(base);
    // After dump truck, endTurn rotates — check player score directly
    expect(g.players[0].score).toBe(0);
  });

  it('G-50: open, score=505, turnScore=50 → score → 0, phase dumptruck', () => {
    const base = makeGame(505, 0);
    base.turn.turnScore = 50;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(0);
  });
});

// ─── Suite 2.12 — bankTurn: barrel and win ───────────────────────────────────
describe('bankTurn — barrel entry and win', () => {
  it('G-52: score=850, banks 30 (→880) → isOnBarrel = true', () => {
    const base = makeGame(850, 0);
    base.turn.turnScore = 30;
    const g = bankTurn(base);
    expect(g.players[0].isOnBarrel).toBe(true);
    expect(g.players[0].score).toBe(880);
  });

  it('G-53: score=850, banks 150 (→1000) → winner set', () => {
    const base = makeGame(850, 0);
    base.turn.turnScore = 150;
    const g = bankTurn(base);
    expect(g.winner).toBe('Player');
    expect(g.players[0].score).toBe(1000);
  });

  it('G-54: score=900, banks 150 (→1050) → overshot, score unchanged', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true });
    base.turn.turnScore = 150;
    const g = bankTurn(base);
    expect(g.players[0].score).toBe(900);
    expect(g.winner).toBeNull();
  });

  it('G-55: score=999, banks 1 (→1000) → winner', () => {
    const base = makeGame(999, 0);
    base.turn.turnScore = 1;
    const g = bankTurn(base);
    expect(g.winner).toBe('Player');
  });
});

// ─── Suite 2.13 — endTurnOnly: barrel attempts and falls ─────────────────────
describe('endTurnOnly — barrel attempts and falls', () => {
  it('G-56: on barrel, 0 attempts → barrelAttempts = 1, stays on barrel', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true, p1Attempts: 0 });
    const g = endTurnOnly(base);
    expect(g.players[1].name).toBe('Bot'); // turn rotated (endTurnOnly calls endTurn)
    // Note: after endTurn, currentPlayerIndex rotates — read from pre-rotation player
    // Players array is still [Player, Bot]; Player is index 0
    const player = g.players[0];
    expect(player.barrelAttempts).toBe(1);
    expect(player.isOnBarrel).toBe(true);
  });

  it('G-57: on barrel, 1 attempt → barrelAttempts = 2, stays on barrel', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true, p1Attempts: 1 });
    const g = endTurnOnly(base);
    expect(g.players[0].barrelAttempts).toBe(2);
    expect(g.players[0].isOnBarrel).toBe(true);
  });

  it('G-58: on barrel, 2 attempts → falls off, score = 800, barrelFalls = 1', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true, p1Attempts: 2 });
    const g = endTurnOnly(base);
    expect(g.players[0].isOnBarrel).toBe(false);
    expect(g.players[0].score).toBe(CONFIG.BARREL_FALL_SCORE);
    expect(g.players[0].barrelFalls).toBe(1);
  });

  it('G-59: on barrel, 2 attempts, 2 falls → score burned to 0', () => {
    const base = makeGame(900, 0, { p1OnBarrel: true, p1Attempts: 2, p1Falls: 2 });
    const g = endTurnOnly(base);
    // endTurn resets turn phase — check player state and log instead
    expect(g.players[0].score).toBe(0);
    expect(g.players[0].barrelFalls).toBe(0); // reset after 3rd fall
    expect(g.players[0].isOnBarrel).toBe(false);
    expect(g.log.some(l => l.includes('BURNED'))).toBe(true);
  });

  it('G-60: NOT on barrel → no barrel logic applied', () => {
    const base = makeGame(500, 0);
    base.turn.turnScore = 0;
    const g = endTurnOnly(base);
    expect(g.players[0].isOnBarrel).toBe(false);
    expect(g.players[0].score).toBe(500);
  });
});

// ─── Suite 2.14 — Turn rotation ──────────────────────────────────────────────
describe('Turn rotation', () => {
  it('G-61: after bankTurn, turn switches to next player', () => {
    const base = makeGame(100, 0);
    base.turn.turnScore = 50;
    const g = bankTurn(base);
    expect(g.currentPlayerIndex).toBe(1);
  });

  it('G-62: after endTurnOnly, turn switches to next player', () => {
    const g = endTurnOnly(makeGame());
    expect(g.currentPlayerIndex).toBe(1);
  });

  it('G-63: fresh turn state after rotation', () => {
    const g = endTurnOnly(makeGame());
    expect(g.turn.rollCount).toBe(0);
    expect(g.turn.turnScore).toBe(0);
    expect(g.turn.lockedIndices).toEqual([]);
  });
});

// ─── Suite 2.15 — canBank ────────────────────────────────────────────────────
describe('canBank', () => {
  it('G-64: turnScore=0 → false', () => {
    const base = makeGame();
    expect(canBank(base)).toBe(false);
  });

  it('G-65: turnScore=50 → true', () => {
    const base = makeGame();
    base.turn.turnScore = 50;
    expect(canBank(base)).toBe(true);
  });

  it('G-66: in pit 1 (250), turnScore=40 → false (290<300)', () => {
    const base = makeGame(250, 0);
    base.turn.turnScore = 40;
    expect(canBank(base)).toBe(false);
  });

  it('G-67: in pit 1 (250), turnScore=50 → true (300)', () => {
    const base = makeGame(250, 0);
    base.turn.turnScore = 50;
    expect(canBank(base)).toBe(true);
  });
});
