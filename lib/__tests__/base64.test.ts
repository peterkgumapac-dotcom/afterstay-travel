import { base64ToBytes, bytesToBase64, decodeBase64, encodeBase64 } from '../base64';

describe('base64 helpers', () => {
  it('round-trips binary strings without native atob or btoa', () => {
    const originalAtob = globalThis.atob;
    const originalBtoa = globalThis.btoa;
    const mutableGlobal = globalThis as unknown as Record<string, unknown>;

    try {
      mutableGlobal.atob = undefined;
      mutableGlobal.btoa = undefined;

      const binary = String.fromCharCode(0, 1, 2, 127, 128, 255);
      const encoded = encodeBase64(binary);

      expect(encoded).toBe('AAECf4D/');
      expect(decodeBase64(encoded)).toBe(binary);
    } finally {
      mutableGlobal.atob = originalAtob;
      mutableGlobal.btoa = originalBtoa;
    }
  });

  it('converts base64 payloads to bytes and back', () => {
    const bytes = base64ToBytes('SGVsbG8sIEFmdGVyU3RheSE=');

    expect(Array.from(bytes)).toEqual([
      72, 101, 108, 108, 111, 44, 32, 65, 102, 116, 101, 114, 83, 116, 97, 121, 33,
    ]);
    expect(bytesToBase64(bytes)).toBe('SGVsbG8sIEFmdGVyU3RheSE=');
  });
});
