// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock driver.js and supabase.js before importing tutorial ────────────────
vi.mock('driver.js', () => ({
  driver: vi.fn(() => ({
    highlight: vi.fn(),
    destroy:   vi.fn(),
  })),
}));

vi.mock('../../supabase.js', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Import AFTER mocks are declared
import {
  initTutorial,
  tutorialHook,
  tutorialComplete,
  getHintsEnabled,
  getTutorialCompleted,
  setHintsEnabled,
  replayTutorial,
  dismissHint,
  resetForTesting,
} from '../tutorial.js';

// ─── Reset all module state before every test ────────────────────────────────────────────
beforeEach(() => { resetForTesting(); });

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────

function makeUser(tutorialCompleted, hintsEnabled) {
  return {
    id: 'test-user',
    user_metadata: {
      tutorial_completed: tutorialCompleted,
      hints_enabled:      hintsEnabled,
    },
  };
}

// ─── Suite T-1: initTutorial — mode selection ───────────────────────────────────────────

describe('T-1: initTutorial — mode selection', () => {

  it('T-01: new user (no metadata) → tutorial mode — driver fires, not setMessage', () => {
    const msgs = [];
    const user = { id: 'u1', user_metadata: {} };
    initTutorial(user, (t) => msgs.push(t));
    tutorialHook('first-bust');
    // In tutorial mode Driver.js highlight fires, setMessage is NOT called
    expect(msgs.length).toBe(0);
  });

  it('T-02: null user → silent (no tutorial, no hints)', () => {
    const msgs = [];
    initTutorial(null, (t) => msgs.push(t));
    tutorialHook('first-bust');
    expect(msgs.length).toBe(0);
  });

  it('T-03: tutorial_completed=true, hints_enabled=true → hints mode fires setMessage', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bust');
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toMatch(/Bust/i);
  });

  it('T-04: tutorial_completed=true, hints_enabled=false → silent', () => {
    const msgs = [];
    initTutorial(makeUser(true, false), (t) => msgs.push(t));
    tutorialHook('first-bust');
    expect(msgs.length).toBe(0);
  });

  it('T-05: tutorial_completed=false, hints_enabled=false → tutorial mode (completed=false wins)', () => {
    const msgs = [];
    initTutorial(makeUser(false, false), (t) => msgs.push(t));
    tutorialHook('first-bust');
    // Driver.js fires in tutorial mode, not setMessage
    expect(msgs.length).toBe(0);
  });

});

// ─── Suite T-2: tutorialHook — deduplication ──────────────────────────────────────────

describe('T-2: tutorialHook — deduplication', () => {

  it('T-06: same event fires only once per game (hints mode)', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bust');
    tutorialHook('first-bust');
    tutorialHook('first-bust');
    expect(msgs.length).toBe(1);
  });

  it('T-07: different events each fire once (hints mode)', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-roll');
    tutorialHook('first-bank');
    tutorialHook('first-bust');
    expect(msgs.length).toBe(3);
  });

  it('T-08: initTutorial resets _stepsFired — same event can fire again in new game', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bust');
    expect(msgs.length).toBe(1);
    // New game — re-init resets _stepsFired so first-bust can fire again
    // BUT _seenThisSession persists (session-level dedup), so use a fresh event
    // to confirm _stepsFired was reset: fire first-bust again — blocked by _seenThisSession
    // then fire first-bank (not seen yet) — should go through
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bust');  // blocked by _seenThisSession
    tutorialHook('first-bank');  // new event, not seen — should fire
    expect(msgs.length).toBe(2);
  });

});

// ─── Suite T-3: hint message content ───────────────────────────────────────────────────

describe('T-3: hint message content (hints mode)', () => {

  it('T-09: first-roll hint contains scoring rule', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-roll');
    expect(msgs[0]).toMatch(/1s.*10.*pts|10.*pts.*1s/i);
  });

  it('T-10: first-bank hint contains "Banked"', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bank');
    expect(msgs[0]).toMatch(/Banked/i);
  });

  it('T-11: first-bust hint contains "Bust"', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bust');
    expect(msgs[0]).toMatch(/Bust/i);
  });

  it('T-12: enter-pit hint contains "Pit"', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('enter-pit', { pitNum: 1, needed: 50 });
    expect(msgs[0]).toMatch(/Pit/i);
  });

  it('T-13: enter-barrel hint contains "Barrel"', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('enter-barrel');
    expect(msgs[0]).toMatch(/Barrel/i);
  });

});

// ─── Suite T-4: tutorialComplete ────────────────────────────────────────────────────────────

describe('T-4: tutorialComplete', () => {

  it('T-14: fires completion message and switches to hints mode', () => {
    const msgs = [];
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    tutorialComplete();
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toMatch(/basics/i);
    // After completion, further hooks use hints mode
    tutorialHook('first-bust');
    expect(msgs.length).toBe(2);
    expect(msgs[1]).toMatch(/Bust/i);
  });

  it('T-15: no-op if already in hints mode (tutorial_completed=true)', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialComplete();
    expect(msgs.length).toBe(0);
  });

  it('T-16: no-op for null user', () => {
    const msgs = [];
    initTutorial(null, (t) => msgs.push(t));
    tutorialComplete();
    expect(msgs.length).toBe(0);
  });

});

// ─── Suite T-5: settings API ───────────────────────────────────────────────────────────────────

describe('T-5: settings API', () => {

  it('T-17: getHintsEnabled returns true when hints_enabled=true', () => {
    initTutorial(makeUser(true, true), vi.fn());
    expect(getHintsEnabled()).toBe(true);
  });

  it('T-18: getHintsEnabled returns false when hints_enabled=false', () => {
    initTutorial(makeUser(true, false), vi.fn());
    expect(getHintsEnabled()).toBe(false);
  });

  it('T-19: getHintsEnabled returns false for null user', () => {
    initTutorial(null, vi.fn());
    expect(getHintsEnabled()).toBe(false);
  });

  it('T-20: getTutorialCompleted returns false for new user', () => {
    initTutorial(makeUser(false, true), vi.fn());
    expect(getTutorialCompleted()).toBe(false);
  });

  it('T-21: getTutorialCompleted returns true for returning user', () => {
    initTutorial(makeUser(true, true), vi.fn());
    expect(getTutorialCompleted()).toBe(true);
  });

  it('T-22: getTutorialCompleted returns false for null user', () => {
    initTutorial(null, vi.fn());
    expect(getTutorialCompleted()).toBe(false);
  });

  it('T-23: setHintsEnabled(false) silences future hints', async () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    await setHintsEnabled(false);
    tutorialHook('first-bust');
    expect(msgs.length).toBe(0);
  });

  it('T-24: setHintsEnabled(true) re-enables hints', async () => {
    const msgs = [];
    initTutorial(makeUser(true, false), (t) => msgs.push(t));
    await setHintsEnabled(true);
    tutorialHook('first-bust');
    expect(msgs.length).toBe(1);
  });

  it('T-25: replayTutorial resets tutorial_completed on user metadata object', async () => {
    const user = makeUser(true, true);
    initTutorial(user, vi.fn());
    await replayTutorial();
    expect(user.user_metadata.tutorial_completed).toBe(false);
    expect(user.user_metadata.hints_enabled).toBe(true);
  });

});

// ─── Suite T-6: session hint deduplication (_seenThisSession) ───────────────────────

describe('T-6: session hint deduplication', () => {

  it('T-26: hint fires once per session even across game re-inits', () => {
    const msgs = [];
    // Game 1
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('enter-barrel');
    expect(msgs.length).toBe(1);
    // Game 2 in same browser session — _seenThisSession persists
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('enter-barrel');
    expect(msgs.length).toBe(1); // should NOT fire again
  });

});

// ─── Suite T-7: new hint events (first-open, first-bolt, overtake) ─────────────────────

describe('T-7: new hint events', () => {

  it('T-27: first-open hint contains "open"', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-open');
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toMatch(/open/i);
  });

  it('T-28: first-bolt hint contains "bolt" and penalty info', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bolt');
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toMatch(/bolt/i);
    expect(msgs[0]).toMatch(/100/i);
  });

  it('T-29: overtake hint contains "overtake"', () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('overtake');
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toMatch(/overtake/i);
  });

  it('T-30: first-open does not fire in tutorial mode (driver fires instead)', () => {
    const msgs = [];
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    tutorialHook('first-open');
    expect(msgs.length).toBe(0); // driver.js fires, not setMessage
  });

  it('T-31: first-bolt does not fire in tutorial mode', () => {
    const msgs = [];
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    tutorialHook('first-bolt');
    expect(msgs.length).toBe(0);
  });

  it('T-32: overtake does not fire in tutorial mode', () => {
    const msgs = [];
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    tutorialHook('overtake');
    expect(msgs.length).toBe(0);
  });

});

// ─── Suite T-8: Play Again fix — tutorial mode _seenThisSession dedup ──────────────────

describe('T-8: Play Again fix — tutorial mode dedup', () => {

  it('T-33: tutorial step does not re-fire on Play Again (same session)', () => {
    const msgs = [];
    // Game 1 — tutorial mode, first-bust fires via driver (no setMessage)
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    tutorialHook('first-bust');
    expect(msgs.length).toBe(0); // driver, not setMessage

    // Play Again — re-init resets _stepsFired but _seenThisSession persists
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    tutorialHook('first-bust'); // _seenThisSession blocks it
    expect(msgs.length).toBe(0); // still no setMessage, and driver should NOT re-fire
  });

  it('T-34: tutorial step fires for a NEW event after Play Again', () => {
    const msgs = [];
    // Game 1
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    tutorialHook('first-bust');

    // Play Again
    initTutorial(makeUser(false, true), (t) => msgs.push(t));
    // first-bust blocked, but enter-pit is new this session — driver fires (no setMessage)
    tutorialHook('enter-pit', { pitNum: 1, needed: 50 });
    expect(msgs.length).toBe(0); // driver fires for enter-pit, not setMessage
  });

});

// ─── Suite T-9: dismissHint (Fix 5) ────────────────────────────────────────────────────

describe('T-9: dismissHint — permanent suppression', () => {

  it('T-35: dismissed hint does not fire again in same session', async () => {
    const msgs = [];
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    tutorialHook('first-bust');
    expect(msgs.length).toBe(1);

    // Dismiss the hint — but first-bust already fired and is in _seenThisSession
    // Reset session state to test dismissHint in isolation
    resetForTesting();
    initTutorial(makeUser(true, true), (t) => msgs.push(t));
    await dismissHint('first-bust');
    tutorialHook('first-bust'); // blocked by _disabledHints
    expect(msgs.length).toBe(1); // no new message
  });

  it('T-36: dismissHint blocks hint on next game re-init', async () => {
    const msgs = [];
    const user = makeUser(true, true);
    initTutorial(user, (t) => msgs.push(t));
    await dismissHint('enter-barrel');

    // New game
    initTutorial(user, (t) => msgs.push(t));
    tutorialHook('enter-barrel'); // blocked by _disabledHints (loaded from user.user_metadata)
    expect(msgs.length).toBe(0);
  });

  it('T-37: dismissHint writes hints_disabled to user metadata', async () => {
    const user = makeUser(true, true);
    initTutorial(user, vi.fn());
    await dismissHint('first-roll');
    expect(user.user_metadata.hints_disabled).toContain('first-roll');
  });

  it('T-38: dismissHint accumulates multiple dismissed hints', async () => {
    const user = makeUser(true, true);
    initTutorial(user, vi.fn());
    await dismissHint('first-roll');
    await dismissHint('first-bust');
    expect(user.user_metadata.hints_disabled).toContain('first-roll');
    expect(user.user_metadata.hints_disabled).toContain('first-bust');
  });

  it('T-39: hints_disabled loaded from user_metadata on initTutorial', () => {
    const msgs = [];
    const user = {
      id: 'u1',
      user_metadata: {
        tutorial_completed: true,
        hints_enabled: true,
        hints_disabled: ['first-bust', 'enter-barrel'],
      },
    };
    initTutorial(user, (t) => msgs.push(t));
    tutorialHook('first-bust');    // in hints_disabled — should be blocked
    tutorialHook('enter-barrel'); // in hints_disabled — should be blocked
    tutorialHook('first-roll');   // not disabled — should fire
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toMatch(/1s.*10|10.*1s/i);
  });

  it('T-40: dismissHint is no-op for null user', async () => {
    initTutorial(null, vi.fn());
    await expect(dismissHint('first-bust')).resolves.toBeUndefined();
  });

});

