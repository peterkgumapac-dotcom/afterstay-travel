const AFTERSTAY_WEB_ORIGIN = 'https://afterstay.travel';

export function buildInviteWebLink(code: string): string {
  return `${AFTERSTAY_WEB_ORIGIN}/join/${encodeURIComponent(code)}`;
}

export function buildInviteAppLink(code: string): string {
  return `afterstay://join-trip?code=${encodeURIComponent(code)}`;
}

export function buildTripInviteMessage(input: {
  code: string;
  tripName: string;
  senderPrefix?: 'my' | 'our';
}): string {
  const prefix = input.senderPrefix ?? 'my';
  const webLink = buildInviteWebLink(input.code);
  return [
    `Join ${prefix} trip to ${input.tripName} on AfterStay.`,
    '',
    `Tap to join or download the app: ${webLink}`,
    '',
    `Invite code: ${input.code}`,
    '',
    'If the link does not open the app, install AfterStay and enter the invite code above.',
  ].join('\n');
}
