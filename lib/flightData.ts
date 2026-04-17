export const FLIGHTS = {
  outbound: {
    airline: 'Cebu Pacific',
    number: '5J 911',
    ref: 'VN3HTQ',
    date: 'Monday, April 20, 2026',
    dateShort: 'Apr 20',
    depart: {
      code: 'MNL',
      city: 'Manila',
      airport: 'Ninoy Aquino International',
      time: '11:30 AM',
      timeISO: '2026-04-20T11:30:00+08:00',
    },
    arrive: {
      code: 'MPH',
      city: 'Malay',
      airport: 'Godofredo P. Ramos',
      time: '12:40 PM',
      timeISO: '2026-04-20T12:40:00+08:00',
    },
    duration: '1h 10m',
  },
  return: {
    airline: 'Philippines AirAsia',
    number: 'Z2 214',
    ref: 'J8FF4V',
    date: 'Monday, April 27, 2026',
    dateShort: 'Apr 27',
    depart: {
      code: 'MPH',
      city: 'Malay',
      airport: 'Godofredo P. Ramos',
      time: '9:15 AM',
      timeISO: '2026-04-27T09:15:00+08:00',
    },
    arrive: {
      code: 'MNL',
      city: 'Manila',
      airport: 'Ninoy Aquino International',
      time: '10:15 AM',
      timeISO: '2026-04-27T10:15:00+08:00',
    },
    duration: '1h 0m',
  },
} as const;

export const DEPARTURE_TIMELINE = {
  checkOutHotel: {
    time: '6:45 AM',
    label: 'Leave Canyon Hotels',
    note: 'Trike to Cagban Jetty',
  },
  trike: {
    duration: '~10 min',
    note: 'Trike/van from hotel to Cagban Jetty',
  },
  boat: {
    duration: '~15-20 min',
    note: 'Boat from Cagban Jetty to Caticlan Jetty',
  },
  trikeToAirport: {
    duration: '~5-10 min',
    note: 'Trike from Caticlan Jetty to Caticlan Airport (MPH)',
  },
  arriveAirport: {
    time: '7:15 AM',
    label: 'Arrive at MPH Airport',
    note: '2 hours before departure (domestic buffer)',
  },
  flight: {
    time: '9:15 AM',
    label: 'Fly MPH → MNL',
    note: 'Philippines AirAsia Z2 214',
  },
} as const;

export const ARRIVAL_TIMELINE = {
  flight: {
    time: '11:30 AM',
    label: 'Depart Manila (MNL)',
    note: 'Cebu Pacific 5J 911',
  },
  land: {
    time: '12:40 PM',
    label: 'Land at Malay (MPH)',
    note: 'Godofredo P. Ramos Airport',
  },
  trikeToJetty: {
    duration: '~5-10 min',
    note: 'Trike from airport to Caticlan Jetty',
  },
  boat: {
    duration: '~15-20 min',
    note: 'Boat from Caticlan Jetty to Cagban Jetty',
  },
  trike: {
    duration: '~10 min',
    note: 'Trike from Cagban Jetty to Canyon Hotels',
  },
  arriveHotel: {
    time: '1:45 PM',
    label: 'Arrive at Canyon Hotels & Resorts Boracay',
    note: 'Check-in from 3:00 PM — request early check-in if possible',
  },
} as const;
