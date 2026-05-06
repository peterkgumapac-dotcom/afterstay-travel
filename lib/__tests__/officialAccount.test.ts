import type { FeedPost } from '../types';

jest.mock('../config', () => ({
  CONFIG: { OFFICIAL_AFTERSTAY_USER_ID: '' },
}));

import { CONFIG } from '../config';
import {
  isOfficialAfterStayIdentity,
  isOfficialAfterStayPost,
  isTravelPulsePost,
  OFFICIAL_AFTERSTAY_HANDLE,
} from '../officialAccount';

const OFFICIAL_UUID = 'bfbc190a-22d5-48d9-9347-c023f12a23ba';
const OTHER_UUID = '00000000-0000-0000-0000-000000000001';

function setOfficialId(id: string): void {
  // Re-assign on the mocked CONFIG so each test controls the env without
  // restarting the module.
  (CONFIG as { OFFICIAL_AFTERSTAY_USER_ID: string }).OFFICIAL_AFTERSTAY_USER_ID = id;
}

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 'post-1',
    userId: 'someone',
    type: 'photo',
    layoutType: 'single',
    media: [],
    caption: '',
    createdAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  } as unknown as FeedPost;
}

describe('officialAccount — env-driven gate', () => {
  afterEach(() => setOfficialId(''));

  describe('isOfficialAfterStayIdentity', () => {
    it('returns false when env is unset, even with matching handle/name/badges', () => {
      setOfficialId('');
      expect(
        isOfficialAfterStayIdentity({
          userId: OFFICIAL_UUID,
          handle: OFFICIAL_AFTERSTAY_HANDLE,
          fullName: 'AfterStay',
          badges: ['Official'],
        }),
      ).toBe(false);
    });

    it('returns true only when userId matches the configured official id', () => {
      setOfficialId(OFFICIAL_UUID);
      expect(isOfficialAfterStayIdentity({ userId: OFFICIAL_UUID })).toBe(true);
    });

    it('rejects impersonation by handle/name/badges without userId match', () => {
      setOfficialId(OFFICIAL_UUID);
      expect(
        isOfficialAfterStayIdentity({
          userId: OTHER_UUID,
          handle: 'afterstay',
          fullName: 'AfterStay',
          badges: ['official', 'Official'],
        }),
      ).toBe(false);
    });

    it('returns false when userId is null/undefined', () => {
      setOfficialId(OFFICIAL_UUID);
      expect(isOfficialAfterStayIdentity({ userId: null })).toBe(false);
      expect(isOfficialAfterStayIdentity({ userId: undefined })).toBe(false);
      expect(isOfficialAfterStayIdentity({})).toBe(false);
    });
  });

  describe('isOfficialAfterStayPost', () => {
    it('returns false when env is unset', () => {
      setOfficialId('');
      expect(isOfficialAfterStayPost(makePost({ userId: OFFICIAL_UUID }))).toBe(false);
    });

    it('returns true when post.userId matches configured id', () => {
      setOfficialId(OFFICIAL_UUID);
      expect(isOfficialAfterStayPost(makePost({ userId: OFFICIAL_UUID }))).toBe(true);
    });

    it('ignores metadata-claimed official flags from non-official user ids', () => {
      setOfficialId(OFFICIAL_UUID);
      const spoof = makePost({
        userId: OTHER_UUID,
        userName: 'AfterStay',
        metadata: { official: true, publisher: 'afterstay', profileBadges: ['Official'] },
      });
      expect(isOfficialAfterStayPost(spoof)).toBe(false);
    });
  });

  describe('isTravelPulsePost', () => {
    it('detects travel_pulse via metadata.postType', () => {
      expect(isTravelPulsePost(makePost({ metadata: { postType: 'travel_pulse' } }))).toBe(true);
    });

    it('detects travel_pulse via metadata.contentType', () => {
      expect(isTravelPulsePost(makePost({ metadata: { contentType: 'travel_pulse' } }))).toBe(true);
    });

    it('detects travel_pulse via metadata.series', () => {
      expect(isTravelPulsePost(makePost({ metadata: { series: 'travel_pulse' } }))).toBe(true);
    });

    it('returns false for unrelated posts', () => {
      expect(isTravelPulsePost(makePost({ metadata: { postType: 'trip_highlight' } }))).toBe(false);
      expect(isTravelPulsePost(makePost({ metadata: {} }))).toBe(false);
    });

    it('does not require the verified gate — pulse classification is independent of identity', () => {
      setOfficialId('');
      expect(isTravelPulsePost(makePost({ metadata: { postType: 'travel_pulse' } }))).toBe(true);
    });
  });
});
