import { describe, it, expect } from 'vitest';
import { createCard, sm2 } from './sm2';

const NOW = new Date('2026-04-01T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe('SM-2 アルゴリズム', () => {
  it('初回正解（quality=4）でintervalが1になる', () => {
    const card = createCard();
    const result = sm2(card, 4, NOW);
    expect(result.interval).toBe(1);
    expect(result.repetition).toBe(1);
    expect(result.nextReview).toBe(NOW + 1 * DAY);
  });

  it('2回連続正解でintervalが6になる', () => {
    const card = createCard();
    const after1 = sm2(card, 4, NOW);
    const after2 = sm2(after1, 4, NOW + 1 * DAY);
    expect(after2.interval).toBe(6);
    expect(after2.repetition).toBe(2);
  });

  it('3回目以降は interval * efactor で算出される', () => {
    const card = createCard();
    const after1 = sm2(card, 4, NOW);
    const after2 = sm2(after1, 4, NOW + 1 * DAY);
    const after3 = sm2(after2, 4, NOW + 7 * DAY);
    expect(after3.interval).toBe(Math.round(6 * after2.efactor));
    expect(after3.repetition).toBe(3);
  });

  it('不正解でrepetitionとintervalがリセットされる', () => {
    const card = createCard();
    const after1 = sm2(card, 4, NOW);
    const after2 = sm2(after1, 4, NOW + 1 * DAY);
    const forgot = sm2(after2, 1, NOW + 7 * DAY);
    expect(forgot.repetition).toBe(0);
    expect(forgot.interval).toBe(0);
  });

  it('efactorが1.3を下回らない', () => {
    let card = createCard();
    for (let i = 0; i < 20; i++) {
      card = sm2(card, 0, NOW + i * DAY);
    }
    expect(card.efactor).toBeGreaterThanOrEqual(1.3);
  });

  it('初回微妙（quality=3）で3時間後に復習', () => {
    const card = createCard();
    const result = sm2(card, 3, NOW);
    expect(result.nextReview).toBe(NOW + 3 * HOUR);
    expect(result.repetition).toBe(1);
  });

  it('2回目微妙（quality=3）で2日後に復習', () => {
    const card = createCard();
    const after1 = sm2(card, 4, NOW);
    const result = sm2(after1, 3, NOW + 1 * DAY);
    expect(result.nextReview).toBe(NOW + 1 * DAY + 2 * DAY);
    expect(result.repetition).toBe(2);
  });

  it('3回目以降の微妙は通常の半分の間隔', () => {
    const card = createCard();
    const after1 = sm2(card, 4, NOW);
    const after2 = sm2(after1, 4, NOW + 1 * DAY);
    const result = sm2(after2, 3, NOW + 7 * DAY);
    const expectedInterval = Math.round(6 * after2.efactor * 0.5);
    expect(result.interval).toBe(expectedInterval);
  });
});
