import { buildWishlistRow } from '@/lib/wishlist';

describe('wishlist saved ideas helpers', () => {
  it('builds a place-level saved idea row with source references', () => {
    const row = buildWishlistRow('user-1', {
      name: 'Sunny Side Cafe',
      category: 'Eat',
      googlePlaceId: 'place-123',
      photoUrl: 'https://example.com/cafe.jpg',
      rating: 4.7,
      totalRatings: 120,
      latitude: 11.967,
      longitude: 121.924,
      address: 'Boracay',
      destination: 'Boracay',
      notes: 'Try breakfast',
      sourcePostId: 'post-1',
      sourceTripId: 'trip-1',
    });

    expect(row).toEqual({
      user_id: 'user-1',
      name: 'Sunny Side Cafe',
      category: 'Eat',
      google_place_id: 'place-123',
      photo_url: 'https://example.com/cafe.jpg',
      rating: 4.7,
      total_ratings: 120,
      latitude: 11.967,
      longitude: 121.924,
      address: 'Boracay',
      destination: 'Boracay',
      notes: 'Try breakfast',
      source_post_id: 'post-1',
      source_trip_id: 'trip-1',
    });
  });

  it('uses destination as the required display name fallback', () => {
    const row = buildWishlistRow('user-1', {
      name: '',
      destination: 'Cebu',
    });

    expect(row.name).toBe('Cebu');
  });
});
