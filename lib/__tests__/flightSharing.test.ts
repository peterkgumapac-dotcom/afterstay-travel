import { getPrimaryBookerFlights } from '../flightSharing';
import type { Flight } from '../types';

const baseFlight = {
  id: 'flight-1',
  direction: 'Outbound' as const,
  flightNumber: '5J 911',
  airline: 'Cebu Pacific',
  from: 'MNL',
  to: 'MPH',
  departTime: '2026-05-31T11:30:00+08:00',
  arriveTime: '2026-05-31T12:40:00+08:00',
};

describe('getPrimaryBookerFlights', () => {
  it('does not offer passenger-specific flights as organizer shared flights', () => {
    const flights: Flight[] = [
      baseFlight,
      {
        ...baseFlight,
        id: 'flight-2',
        flightNumber: 'PR 2045',
        airline: 'Philippine Airlines',
        passenger: 'Robert',
      },
    ];

    expect(getPrimaryBookerFlights(flights)).toEqual([baseFlight]);
  });

  it('offers primary booker scanned flights even when passenger text is present', () => {
    const primaryFlight: Flight = {
      ...baseFlight,
      passenger: 'Peter Gumapac',
    };

    expect(getPrimaryBookerFlights([primaryFlight], 'Peter')).toEqual([primaryFlight]);
  });
});
