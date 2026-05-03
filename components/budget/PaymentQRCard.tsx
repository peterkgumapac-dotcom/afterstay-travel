import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Path } from 'react-native-svg';

interface PaymentQRCardProps {
  qrData: string;
  holderName: string;
  bankName: string;
  refCode?: string;
}

// AfterStay logo mark — small constellation glyph for QR center
function LogoMark() {
  return (
    <View style={S.logoMarkWrap}>
      <View style={S.logoMarkInner}>
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Circle cx={14} cy={14} r={12} fill="#fff" />
          <Circle cx={14} cy={14} r={10} fill="none" stroke="#d8ab7a" strokeWidth={1.5} />
          <Path
            d="M14 7l1.5 3.5L19 12l-3.5 1.5L14 17l-1.5-3.5L9 12l3.5-1.5z"
            fill="#d8ab7a"
          />
          <Circle cx={14} cy={8} r={1} fill="#d8ab7a" />
          <Circle cx={20} cy={14} r={0.8} fill="#d8ab7a" opacity={0.6} />
          <Circle cx={14} cy={20} r={0.8} fill="#d8ab7a" opacity={0.6} />
          <Circle cx={8} cy={14} r={0.8} fill="#d8ab7a" opacity={0.6} />
        </Svg>
      </View>
    </View>
  );
}

function generateRefCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function PaymentQRCard({
  qrData,
  holderName,
  bankName,
  refCode,
}: PaymentQRCardProps) {
  const monogram = holderName.charAt(0).toUpperCase();
  const ref = useMemo(() => refCode ?? generateRefCode(), [refCode]);
  const bankLabel = bankName.toUpperCase();

  return (
    <View style={S.card}>
      {/* Accent inset border */}
      <View style={S.cardInner}>
        {/* Header */}
        <View style={S.header}>
          <View style={S.brandRow}>
            <Text style={S.brandText}>after<Text style={S.brandDot}>·</Text>stay</Text>
          </View>
          {/* GROUP PAY stamp */}
          <View style={S.stamp}>
            <Text style={S.stampText}>GROUP PAY</Text>
          </View>
        </View>

        {/* Identity */}
        <View style={S.identityRow}>
          <View style={S.monogram}>
            <Text style={S.monogramText}>{monogram}</Text>
          </View>
          <View style={S.identityInfo}>
            <Text style={S.eyebrow}>ACCOUNT HOLDER</Text>
            <Text style={S.holderName}>{holderName}</Text>
            <View style={S.bankChip}>
              <Text style={S.bankText}>{bankLabel}</Text>
            </View>
          </View>
        </View>

        {/* QR Area */}
        <View style={S.qrArea}>
          <QRCode
            value={qrData}
            size={180}
            backgroundColor="#fff"
            color="#1a1612"
            ecl="M"
            logo={undefined}
          />
          <LogoMark />
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <View>
            <Text style={S.footerLabel}>Scan to pay</Text>
            <Text style={S.footerHelper}>
              Routed to {bankName} · any banking app
            </Text>
          </View>
          <Text style={S.refCode}>AS · {ref}</Text>
        </View>
      </View>
    </View>
  );
}

const PAPER = '#fef4f0';
const ACCENT = '#d8ab7a';
const INK = '#1a1612';
const INK2 = '#6b6156';

const S = StyleSheet.create({
  card: {
    backgroundColor: PAPER,
    borderRadius: 28,
    padding: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  cardInner: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    color: INK,
    letterSpacing: -0.3,
  },
  brandDot: { color: ACCENT },
  stamp: {
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    transform: [{ rotate: '-3deg' }],
  },
  stampText: {
    fontSize: 8,
    fontWeight: '800',
    color: PAPER,
    letterSpacing: 1.2,
  },

  // Identity
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  monogram: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontSize: 20,
    fontWeight: '700',
    color: PAPER,
  },
  identityInfo: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: INK2,
  },
  holderName: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.3,
  },
  bankChip: {
    alignSelf: 'flex-start',
    backgroundColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  bankText: {
    fontSize: 8,
    fontWeight: '700',
    color: PAPER,
    letterSpacing: 1,
  },

  // QR
  qrArea: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoMarkWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkInner: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 2,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: INK,
  },
  footerHelper: {
    fontSize: 9,
    color: INK2,
    marginTop: 1,
  },
  refCode: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    color: INK2,
    letterSpacing: 0.5,
  },
});
