import { describe, it, expect } from 'vitest';
import { botDecision } from '../bot.js';
import { createGame, CONFIG } from '../gameState.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeGame(opts = {}) {
  const g = createGame(['Bot', 'Player'], 'classic');

  // Bot is player 0
  g.players[0].score        = opts.botScore   ?? 0;
  g.players[0].isOpen       = opts.botScore    > 0 || opts.botOpen === true;
  g.players[0].isOnBarrel   = opts.onBarrel   ?? false;
  g.turn.turnScore          = opts.turnScore  ?? 0;
  g.turn.activeDiceCount    = opts.activeDice ?? 5;

  // Opponent is player 1
  g.players[1].score        = opts.oppScore   ?? 0;
  g.players[1].isOpen       = (opts.oppScore ?? 0) > 0;

  return g;
}

// ─── Suite 3.1 — Easy bot decisions ──────────────────────────────────────────
describe('Easy bot decisions', () => {
  it('B-01: turnScore=0 → roll',             () => expect(botDecision(makeGame({ turnScore: 0 }), 'easy')).toBe('roll'));
  it('B-02: turnScore=49 → roll',            () => expect(botDecision(makeGame({ turnScore: 49 }), 'easy')).toBe('roll'));
  it('B-03: turnScore=50 → bank',            () => expect(botDecision(makeGame({ turnScore: 50, botScore: 100 }), 'easy')).toBe('bank'));
  it('B-04: turnScore=200 → bank',           () => expect(botDecision(makeGame({ turnScore: 200, botScore: 100 }), 'easy')).toBe('bank'));
  it('B-05: on barrel, turnScore=0 → roll',  () => expect(botDecision(makeGame({ onBarrel: true, turnScore: 0 }), 'easy')).toBe('roll'));
  it('B-06: on barrel, turnScore=500 → roll',() => expect(botDecision(makeGame({ onBarrel: true, turnScore: 500, botScore: 900 }), 'easy')).toBe('roll'));
});

// ─── Suite 3.2 — Hard bot decisions ──────────────────────────────────────────
describe('Hard bot decisions', () => {
  it('B-07: turnScore=100, 5 active dice → roll',                  () => expect(botDecision(makeGame({ turnScore: 100, botScore: 100, activeDice: 5 }), 'hard')).toBe('roll'));
  it('B-08: turnScore=300 → bank',                                  () => expect(botDecision(makeGame({ turnScore: 300, botScore: 100 }), 'hard')).toBe('bank'));
  it('B-09: turnScore=150, activeDice=2 → bank',                   () => expect(botDecision(makeGame({ turnScore: 150, botScore: 100, activeDice: 2 }), 'hard')).toBe('bank'));
  it('B-10: turnScore=200 → bank',                                  () => expect(botDecision(makeGame({ turnScore: 200, botScore: 100 }), 'hard')).toBe('bank'));
  it('B-11: on barrel → always roll',                               () => expect(botDecision(makeGame({ onBarrel: true, turnScore: 500, botScore: 900 }), 'hard')).toBe('roll'));

  it('B-12: in Pit 1, turnScore < needed → roll', () => {
    // Bot at 250 (Pit 1), needs 50 to escape (→300), has only 40
    const g = makeGame({ botScore: 250, turnScore: 40 });
    expect(botDecision(g, 'hard')).toBe('roll');
  });

  it('B-13: in Pit 1, turnScore >= needed → bank', () => {
    const g = makeGame({ botScore: 250, turnScore: 50 });
    expect(botDecision(g, 'hard')).toBe('bank');
  });

  it('B-14: in Pit 2, turnScore < needed → roll', () => {
    const g = makeGame({ botScore: 650, turnScore: 40 });
    expect(botDecision(g, 'hard')).toBe('roll');
  });

  it('B-15: opponent near win (≥880), turnScore=250 → bank (aggression)', () => {
    const g = makeGame({ botScore: 400, turnScore: 250, oppScore: 880 });
    expect(botDecision(g, 'hard')).toBe('bank');
  });

  it('B-16: opponent NOT near win, turnScore=250 → bank (200+ threshold)', () => {
    // Hard bot banks at turnScore >= 200 regardless of opponent score
    // This is correct behaviour — aggression only changes the threshold slightly
    const g = makeGame({ botScore: 400, turnScore: 250, oppScore: 100 });
    expect(botDecision(g, 'hard')).toBe('bank');
  });
});

// ─── Suite 3.3 — botDecision routing ─────────────────────────────────────────
describe('botDecision routing', () => {
  it('B-17: difficulty=easy → routes to easy logic (banks at 50)', () => {
    expect(botDecision(makeGame({ turnScore: 50, botScore: 100 }), 'easy')).toBe('bank');
  });

  it('B-18: difficulty=hard → routes to hard logic', () => {
    // Hard bot won't bank at 50 with 5 active dice
    expect(botDecision(makeGame({ turnScore: 50, botScore: 100, activeDice: 5 }), 'hard')).toBe('roll');
  });

  it('B-19: difficulty=undefined → defaults to easy', () => {
    expect(botDecision(makeGame({ turnScore: 50, botScore: 100 }), undefined)).toBe('bank');
  });

  it('B-20: difficulty=medium (unrecognised) → defaults to easy', () => {
    expect(botDecision(makeGame({ turnScore: 50, botScore: 100 }), 'medium')).toBe('bank');
  });
});
