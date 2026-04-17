export interface GCalEvent {
  title: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  attendeeEmails?: string[];
}

const formatGCalDate = (iso: string): string => {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

export const buildGoogleCalendarURL = (event: GCalEvent): string => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGCalDate(event.startISO)}/${formatGCalDate(event.endISO)}`,
  });

  if (event.description) params.append('details', event.description);
  if (event.location) params.append('location', event.location);
  if (event.attendeeEmails && event.attendeeEmails.length > 0) {
    params.append('add', event.attendeeEmails.join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
