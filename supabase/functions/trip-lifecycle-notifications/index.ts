import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Trip lifecycle notification cron.
 *
 * Designed to run every hour via Supabase cron or external scheduler.
 * Checks all Planning/Active trips and sends context-aware notifications:
 * - Trip starts tomorrow / today
 * - Last day reminder
 * - Check-in / check-out reminders
 * - Flight boarding (plane transport only)
 * - Departure prep (car/bus/ferry only)
 *
 * Dedup: skips if a notification of the same type+trip was already sent today.
 */

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)
  const currentHour = now.getUTCHours() + 8 // Convert to PHT (UTC+8)

  // Fetch active/planning trips with their members
  const { data: trips, error: tripErr } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, check_in, check_out, transport_mode, status')
    .in('status', ['Planning', 'Active'])

  if (tripErr || !trips) {
    return new Response(JSON.stringify({ error: tripErr?.message }), { status: 500 })
  }

  let sent = 0
  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  async function dispatchPushNotifications(records: any[]) {
    await Promise.all(records.map((record) => fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ type: 'INSERT', record }),
    }).catch(() => null)))
  }

  for (const trip of trips) {
    // Get members for this trip
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('trip_id', trip.id)
      .not('user_id', 'is', null)

    if (!members || members.length === 0) continue

    const userIds = members.map((m: any) => m.user_id as string)

    // Helper: check if notification already sent today for this trip+type
    async function alreadySent(type: string): Promise<boolean> {
      const { data } = await supabase
        .from('notifications')
        .select('id')
        .eq('trip_id', trip.id)
        .eq('type', type)
        .gte('created_at', today)
        .limit(1)
      return (data?.length ?? 0) > 0
    }

    // Helper: insert notification for all members
    async function notifyAll(type: string, title: string, body: string) {
      if (await alreadySent(type)) return
      const rows = userIds.map((uid: string) => ({
        user_id: uid,
        trip_id: trip.id,
        type,
        title,
        body,
        data: { type, tripId: trip.id },
        read: false,
      }))
      const { data: inserted } = await supabase.from('notifications').insert(rows).select('*')
      if (inserted?.length) await dispatchPushNotifications(inserted)
      sent += rows.length
    }

    // ── Trip starts tomorrow ──
    if (trip.start_date === tomorrow) {
      await notifyAll(
        'trip_starting',
        `${trip.destination} tomorrow!`,
        `Your trip to ${trip.destination} starts tomorrow. Time to finish packing!`,
      )

      // Departure prep for non-plane transport
      const transport = trip.transport_mode
      if (transport === 'car' || transport === 'bus' || transport === 'ferry') {
        const label = transport === 'car' ? 'road trip' : transport === 'bus' ? 'bus' : 'ferry'
        await notifyAll(
          'departure_prep',
          `${label.charAt(0).toUpperCase() + label.slice(1)} prep`,
          `Your ${label} to ${trip.destination} is tomorrow. Check your route and pack up!`,
        )
      }
    }

    // ── Trip starts today ──
    if (trip.start_date === today) {
      await notifyAll(
        'trip_starting',
        `${trip.destination} today!`,
        `Your trip to ${trip.destination} starts today. Have an amazing time!`,
      )
    }

    // ── Last day ──
    if (trip.end_date === today) {
      await notifyAll(
        'last_day',
        'Last day!',
        `Make the most of your final day in ${trip.destination}.`,
      )
    }

    // ── Check-out reminder (morning of end date) ──
    if (trip.end_date === today && currentHour >= 7 && currentHour <= 10) {
      if (trip.check_out) {
        await notifyAll(
          'check_out_reminder',
          `Check-out at ${trip.check_out}`,
          `Don't forget to check out by ${trip.check_out}. Pack everything!`,
        )
      }
    }

    // ── Check-in reminder (day of start, afternoon) ──
    if (trip.start_date === today && currentHour >= 12 && currentHour <= 15) {
      if (trip.check_in) {
        await notifyAll(
          'check_in_reminder',
          `Check-in from ${trip.check_in}`,
          `You can check in starting ${trip.check_in}. Welcome to ${trip.destination}!`,
        )
      }
    }

    // ── Flight boarding (plane transport only, 3 hours before departure) ──
    if (!trip.transport_mode || trip.transport_mode === 'plane') {
      const { data: flights } = await supabase
        .from('flights')
        .select('id, flight_number, departure_time, direction')
        .eq('trip_id', trip.id)
        .not('departure_time', 'is', null)

      if (flights) {
        for (const flight of flights) {
          const departMs = new Date(flight.departure_time).getTime()
          const hoursUntil = (departMs - now.getTime()) / 3600000
          if (hoursUntil > 0 && hoursUntil <= 3) {
            if (!(await alreadySent('flight_boarding'))) {
              const rows = userIds.map((uid: string) => ({
                user_id: uid,
                trip_id: trip.id,
                type: 'flight_boarding',
                title: `Flight ${flight.flight_number} boards soon`,
                body: `Your ${flight.direction?.toLowerCase() ?? ''} flight departs in ${Math.round(hoursUntil)} hour${Math.round(hoursUntil) !== 1 ? 's' : ''}.`,
                data: { type: 'flight_boarding', tripId: trip.id, flightId: flight.id },
                read: false,
              }))
              const { data: inserted } = await supabase.from('notifications').insert(rows).select('*')
              if (inserted?.length) await dispatchPushNotifications(inserted)
              sent += rows.length
            }
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
