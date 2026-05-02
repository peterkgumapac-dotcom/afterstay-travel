const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function decodeBase64(value: string): string {
  if (typeof globalThis.atob === 'function') return globalThis.atob(value);

  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of value.replace(/[\r\n\s]/g, '')) {
    if (char === '=') break;
    const index = BASE64_CHARS.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

export function encodeBase64(binary: string): string {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);

  let output = '';

  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i) & 0xff;
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) & 0xff : undefined;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) & 0xff : undefined;
    const triplet = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);

    output += BASE64_CHARS[(triplet >> 18) & 0x3f];
    output += BASE64_CHARS[(triplet >> 12) & 0x3f];
    output += b == null ? '=' : BASE64_CHARS[(triplet >> 6) & 0x3f];
    output += c == null ? '=' : BASE64_CHARS[triplet & 0x3f];
  }

  return output;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = decodeBase64(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return encodeBase64(binary);
}
