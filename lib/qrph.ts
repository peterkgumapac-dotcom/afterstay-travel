/**
 * QRPh / EMVCo TLV parser and encoder for Philippine payment QR codes.
 * Supports GCash, Maya, BPI, UnionBank, and all InstaPay/QRPh participants.
 */

// Known Philippine bank/wallet SWIFT codes → display names
const SWIFT_MAP: Record<string, string> = {
  GXCHPHM2XXX: 'GCash',
  PAABORPH: 'Maya',
  BOPIPHMMXXX: 'BPI',
  UBPHPHMMXXX: 'UnionBank',
  MABORPH: 'Metrobank',
  ABORPH: 'BDO',
  LBPHPHMM: 'LandBank',
  RCBCPHMM: 'RCBC',
  CHBKPHCE: 'ChinaBank',
  PHSBPHMM: 'PSBank',
  AUBKPHMM: 'AUB',
  ABORPHMM: 'BDO',
  SETCPHMM: 'Security Bank',
  EWBKPHMM: 'EastWest',
  CABORPH: 'CTBC',
  // MariBank / Sea Group — add when SWIFT is confirmed
};

export interface QRPhData {
  /** Raw EMVCo payload string */
  raw: string;
  /** Account holder / merchant name (tag 59) */
  name: string;
  /** Bank or wallet display name (resolved from SWIFT code) */
  bank: string;
  /** SWIFT/BIC code */
  swift: string;
  /** Account number or mobile number */
  account: string;
  /** Optional pre-filled amount (tag 54) */
  amount?: string;
  /** City (tag 60) */
  city: string;
  /** Currency code — always 608 for PHP */
  currency: string;
  /** Static (11) or dynamic (12) */
  initMethod: string;
}

// ── TLV Parser ────────────────────────────────────────────────────────

function parseTLV(data: string): Map<string, string> {
  const tags = new Map<string, string>();
  let i = 0;
  while (i + 4 <= data.length) {
    const tag = data.substring(i, i + 2);
    const len = parseInt(data.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > data.length) break;
    const value = data.substring(i + 4, i + 4 + len);
    tags.set(tag, value);
    i += 4 + len;
  }
  return tags;
}

/**
 * Parse a raw EMVCo QR payload string into structured QRPh data.
 * Returns null if the string doesn't look like a valid QRPh payload.
 */
export function parseQRPh(raw: string): QRPhData | null {
  const trimmed = raw.trim();

  // Must start with "000201" (tag 00 = "01")
  if (!trimmed.startsWith('0002')) return null;

  const tags = parseTLV(trimmed);

  // Find merchant account info — tags 26-51, look for com.p2pqrpay or ph.ppmi.p2m
  let merchantValue = '';
  for (let t = 26; t <= 51; t++) {
    const key = t.toString().padStart(2, '0');
    const val = tags.get(key);
    if (val && (val.includes('com.p2pqrpay') || val.includes('ph.ppmi.p2m'))) {
      merchantValue = val;
      break;
    }
  }

  if (!merchantValue) return null;

  const subTags = parseTLV(merchantValue);
  const swift = subTags.get('01') ?? '';
  const account = subTags.get('03') ?? subTags.get('02') ?? subTags.get('05') ?? '';
  const bank = SWIFT_MAP[swift] ?? swift.replace(/XXX$/, '') ?? 'Bank';

  return {
    raw: trimmed,
    name: tags.get('59') ?? 'Account Holder',
    bank,
    swift,
    account,
    amount: tags.get('54') ?? undefined,
    city: tags.get('60') ?? '',
    currency: tags.get('53') ?? '608',
    initMethod: tags.get('01') ?? '11',
  };
}

// ── TLV Encoder ───────────────────────────────────────────────────────

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, '0')}${value}`;
}

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
}

/**
 * Encode QRPh data back into a valid EMVCo payload string.
 */
export function encodeQRPh(data: QRPhData): string {
  // Build merchant account info (tag 26-51)
  const guid = 'com.p2pqrpay';
  let merchantInner = tlv('00', guid) + tlv('01', data.swift);
  if (data.account) merchantInner += tlv('03', data.account);

  let payload = '';
  payload += tlv('00', '01'); // format indicator
  payload += tlv('01', data.initMethod); // static/dynamic
  payload += tlv('28', merchantInner); // merchant account info
  payload += tlv('52', '0000'); // MCC (P2P)
  payload += tlv('53', '608'); // PHP
  if (data.amount) payload += tlv('54', data.amount);
  payload += tlv('58', 'PH'); // country
  payload += tlv('59', data.name); // name
  payload += tlv('60', data.city || 'Philippines'); // city

  // CRC
  const withCrcTag = payload + '6304';
  const checksum = crc16(withCrcTag);
  payload += tlv('63', checksum);

  return payload;
}

/**
 * Check if a string looks like a QRPh/EMVCo payload.
 */
export function isQRPhPayload(data: string): boolean {
  return data.trim().startsWith('0002') && data.length > 50;
}
