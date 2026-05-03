import type { GroupMember, Trip } from '@/lib/types';

export function canManageTripMembers(
  trip: Trip | null | undefined,
  members: GroupMember[],
  userId?: string | null,
): boolean {
  if (!trip || !userId) return false;
  if (trip.userId === userId) return true;
  return members.some((member) => member.userId === userId && member.role === 'Primary');
}
