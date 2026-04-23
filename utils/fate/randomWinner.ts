function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }
  return Math.random();
}

export function pickWinner(names: string[]): string {
  if (names.length === 0) throw new Error('Cannot pick from empty list');
  const index = Math.floor(secureRandom() * names.length);
  return names[index];
}

export function pickTwoWinners(names: string[]): [string, string] {
  if (names.length < 2) throw new Error('Need at least 2 names for duo');
  const first = pickWinner(names);
  const remaining = names.filter((n) => n !== first);
  const second = pickWinner(remaining);
  return [first, second];
}
