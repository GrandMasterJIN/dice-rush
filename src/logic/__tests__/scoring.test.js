import { describe, it, expect } from 'vitest';
import { scoreDice, isZeroRoll } from '../scoring.js';

// Helper: just get the total
const score = (dice) => scoreDice(dice).total;

// ─── Suite 1.1 — Singles ─────────────────────────────────────────────────────
describe('Singles', () => {
  it('S-01: single 1 = 10', () => expect(score([1])).toBe(10));
  it('S-02: single 5 = 5',  () => expect(score([5])).toBe(5));
  it('S-03: two 1s = 20',   () => expect(score([1, 1])).toBe(20));
  it('S-04: two 5s = 10',   () => expect(score([5, 5])).toBe(10));
  it('S-05: 1 and 5 = 15',  () => expect(score([1, 5])).toBe(15));
  it('S-06: single 2 = 0',  () => expect(score([2])).toBe(0));
  it('S-07: 2,3,4,6 = 0',   () => expect(score([2, 3, 4, 6])).toBe(0));
});

// ─── Suite 1.2 — Three of a Kind ─────────────────────────────────────────────
describe('Three of a Kind', () => {
  it('S-08: 3×1 = 100', () => expect(score([1, 1, 1])).toBe(100));
  it('S-09: 3×2 = 20',  () => expect(score([2, 2, 2])).toBe(20));
  it('S-10: 3×3 = 30',  () => expect(score([3, 3, 3])).toBe(30));
  it('S-11: 3×4 = 40',  () => expect(score([4, 4, 4])).toBe(40));
  it('S-12: 3×5 = 50',  () => expect(score([5, 5, 5])).toBe(50));
  it('S-13: 3×6 = 60',  () => expect(score([6, 6, 6])).toBe(60));
});

// ─── Suite 1.3 — Four of a Kind ──────────────────────────────────────────────
describe('Four of a Kind', () => {
  it('S-14: 4×1 = 200', () => expect(score([1, 1, 1, 1])).toBe(200));
  it('S-15: 4×2 = 40',  () => expect(score([2, 2, 2, 2])).toBe(40));
  it('S-16: 4×5 = 100', () => expect(score([5, 5, 5, 5])).toBe(100));
  it('S-17: 4×6 = 120', () => expect(score([6, 6, 6, 6])).toBe(120));
});

// ─── Suite 1.4 — Five of a Kind ──────────────────────────────────────────────
describe('Five of a Kind', () => {
  it('S-18: 5×1 = 1000', () => expect(score([1, 1, 1, 1, 1])).toBe(1000));
  it('S-19: 5×2 = 200',  () => expect(score([2, 2, 2, 2, 2])).toBe(200));
  it('S-20: 5×5 = 500',  () => expect(score([5, 5, 5, 5, 5])).toBe(500));
  it('S-21: 5×6 = 600',  () => expect(score([6, 6, 6, 6, 6])).toBe(600));
});

// ─── Suite 1.5 — Straights ───────────────────────────────────────────────────
describe('Straights', () => {
  it('S-22: small straight [1,2,3,4,5] = 125',          () => expect(score([1, 2, 3, 4, 5])).toBe(125));
  it('S-23: small straight reversed [5,4,3,2,1] = 125', () => expect(score([5, 4, 3, 2, 1])).toBe(125));
  it('S-24: large straight [2,3,4,5,6] = 250',          () => expect(score([2, 3, 4, 5, 6])).toBe(250));
  it('S-25: large straight reversed [6,5,4,3,2] = 250', () => expect(score([6, 5, 4, 3, 2])).toBe(250));
});

// ─── Suite 1.6 — Combinations ────────────────────────────────────────────────
describe('Combinations', () => {
  it('S-26: 3×1 + single 5 = 105',      () => expect(score([1, 1, 1, 5])).toBe(105));
  it('S-27: 3×5 + single 1 = 60',       () => expect(score([5, 5, 5, 1])).toBe(60));
  it('S-28: 3×6 + 1 + 5 = 75',          () => expect(score([6, 6, 6, 1, 5])).toBe(75));
  it('S-29: 4×1 + single 5 = 205',      () => expect(score([1, 1, 1, 1, 5])).toBe(205));
  it('S-30: 3×2 + 1 + 5 = 35',          () => expect(score([2, 2, 2, 1, 5])).toBe(35));
  it('S-31: 4×3 + single 1 = 70',       () => expect(score([3, 3, 3, 3, 1])).toBe(70));
});

// ─── Suite 1.7 — Zero rolls ───────────────────────────────────────────────────
describe('Zero rolls (busts)', () => {
  it('S-32: [2,3,4,6,6] = 0',  () => expect(score([2, 3, 4, 6, 6])).toBe(0));
  it('S-33: [2,2,3,4,6] = 0',  () => expect(score([2, 2, 3, 4, 6])).toBe(0));
  it('S-34: [3,4,6,6,6] = 60', () => expect(score([3, 4, 6, 6, 6])).toBe(60));
});

// ─── Suite 1.8 — isZeroRoll ──────────────────────────────────────────────────
describe('isZeroRoll', () => {
  it('S-35: [2,3,4,6,6] → true',  () => expect(isZeroRoll([2, 3, 4, 6, 6])).toBe(true));
  it('S-36: [1,2,3,4,5] → false', () => expect(isZeroRoll([1, 2, 3, 4, 5])).toBe(false));
  it('S-37: [5,3,4,6,2] → false', () => expect(isZeroRoll([5, 3, 4, 6, 2])).toBe(false));
});

// ─── Suite 1.9 — Edge cases ───────────────────────────────────────────────────
describe('Edge cases', () => {
  it('S-38: empty array = 0',    () => expect(score([])).toBe(0));
  it('S-39: single die [1] = 10', () => expect(score([1])).toBe(10));
  it('S-40: 5×2 = 200',          () => expect(score([2, 2, 2, 2, 2])).toBe(200));
});
