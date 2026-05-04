import { filterRenderableImageUrls, imageUrl, isRenderableRemoteImageUrl } from '@/lib/imageUrl';

describe('imageUrl helpers', () => {
  it('filters non-renderable and rate-limited remote image hosts', () => {
    expect(isRenderableRemoteImageUrl('https://example.com/photo.jpg')).toBe(true);
    expect(isRenderableRemoteImageUrl('https://upload.wikimedia.org/wikipedia/commons/c/cd/Boracay_White_Beach.png')).toBe(false);
    expect(isRenderableRemoteImageUrl('file:///tmp/photo.jpg')).toBe(false);
    expect(isRenderableRemoteImageUrl('')).toBe(false);
  });

  it('deduplicates renderable image URL lists', () => {
    const urls = filterRenderableImageUrls([
      'https://example.com/a.jpg',
      'https://example.com/a.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/c/cd/Boracay_White_Beach.png',
      'https://example.com/b.jpg',
    ]);

    expect(urls).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  it('returns undefined for blocked imageUrl values', () => {
    expect(imageUrl('https://upload.wikimedia.org/wikipedia/commons/c/cd/Boracay_White_Beach.png')).toBeUndefined();
  });
});
