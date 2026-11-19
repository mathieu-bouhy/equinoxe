import { describe, expect, test } from 'bun:test';
import { gimiAllocationRecommendations } from '../src/components/AllocationRecommendations';

describe('Gimi analytic allocation recommendations', () => {
  test('covers the requested accounting classes', () => {
    expect(gimiAllocationRecommendations.map((group) => group.code)).toEqual(['60', '61', '62', '64', '74']);
  });

  test('uses revenue only as a fallback, never as the primary allocation key', () => {
    const rows = gimiAllocationRecommendations.flatMap((group) => group.rows);
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.some((row) => /chiffre d.affaires|\bca\b/i.test(row.primary))).toBe(false);
    expect(rows.some((row) => row.alternatives.some((option) => /chiffre d.affaires|\bca\b/i.test(option)))).toBe(true);
  });

  test('documents alternatives and a destination for every cost category', () => {
    const rows = gimiAllocationRecommendations.flatMap((group) => group.rows);
    for (const row of rows) {
      expect(row.alternatives.length).toBeGreaterThan(0);
      expect(row.destination.length).toBeGreaterThan(0);
      expect(row.rationale.length).toBeGreaterThan(0);
    }
  });

  test('includes the critical operational drivers', () => {
    const text = JSON.stringify(gimiAllocationRecommendations).toLowerCase();
    for (const driver of ['véhicule', 'surface', 'utilisateur', 'intervention', 'chantier', 'employé']) {
      expect(text).toContain(driver);
    }
  });
});
