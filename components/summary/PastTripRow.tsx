import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/constants/ThemeContext'
import { radius, spacing } from '@/constants/theme'
import type { Trip } from '@/lib/types'
import { formatDatePHT, formatCurrency } from '@/lib/utils'

interface PastTripRowProps {
  trip: Trip
}

function countryFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '\uD83C\uDF0D'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

export default function PastTripRow({ trip }: PastTripRowProps) {
  const { colors } = useTheme()
  const styles = getStyles(colors)

  const flag = countryFlag(trip.countryCode)
  const nights = trip.totalNights ?? trip.nights ?? 0
  const dateRange =
    trip.startDate && trip.endDate
      ? `${formatDatePHT(trip.startDate)} \u2013 ${formatDatePHT(trip.endDate)}`
      : trip.startDate
        ? formatDatePHT(trip.startDate)
        : ''

  return (
    <View style={styles.row}>
      <Text style={styles.flag}>{flag}</Text>
      <View style={styles.info}>
        <Text style={styles.destination} numberOfLines={1}>
          {trip.destination || trip.name}
        </Text>
        {dateRange ? <Text style={styles.dates}>{dateRange}</Text> : null}
      </View>
      <View style={styles.meta}>
        {nights > 0 && (
          <Text style={styles.nights}>
            {nights}n
          </Text>
        )}
        {trip.totalSpent != null && trip.totalSpent > 0 && (
          <Text style={styles.cost}>
            {formatCurrency(trip.totalSpent, trip.costCurrency ?? 'PHP')}
          </Text>
        )}
      </View>
    </View>
  )
}

type ThemeColors = ReturnType<typeof useTheme>['colors']

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    flag: {
      fontSize: 24,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    destination: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    dates: {
      color: colors.text3,
      fontSize: 12,
    },
    meta: {
      alignItems: 'flex-end',
      gap: 2,
    },
    nights: {
      color: colors.text2,
      fontSize: 13,
      fontWeight: '600',
    },
    cost: {
      color: colors.text3,
      fontSize: 11,
      fontFamily: 'SpaceMono',
    },
  })
