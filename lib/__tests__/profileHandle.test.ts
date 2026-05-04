import {
  isValidProfileHandle,
  normalizeProfileHandle,
} from '../profileHandle';

describe('profileHandle', () => {
  it('normalizes handles into the canonical searchable form', () => {
    expect(normalizeProfileHandle('@DiesMyling')).toBe('diesmyling');
    expect(normalizeProfileHandle('  @Peter KG!!  ')).toBe('peterkg');
    expect(normalizeProfileHandle('a'.repeat(30))).toHaveLength(20);
  });

  it('validates the database handle format', () => {
    expect(isValidProfileHandle('diesmyling')).toBe(true);
    expect(isValidProfileHandle('@diesmyling')).toBe(true);
    expect(isValidProfileHandle('di')).toBe(false);
    expect(isValidProfileHandle('1diesmyling')).toBe(false);
  });
});
