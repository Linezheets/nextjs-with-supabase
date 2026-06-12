import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { EventsChrome } from './EventsChrome';

export const metadata: Metadata = {
  title: 'Fashion Events — Linezheets',
  description: 'Discover global fashion weeks, tradeshows, showrooms, and runway events.',
};

const AGENCY_EMAILS = ['hello@linezheets.com'];

export default async function FashionEventsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAgency = !!(user && AGENCY_EMAILS.includes(user.email || ''));

  // Public browse (/fashionevents, /[id]) renders dark; the operational tools
  // (manage/admin/scan) render light. The zone decision lives in EventsChrome
  // (lib/zones.ts), matching the <html> theme set by ZoneSync.
  return (
    <EventsChrome signedIn={!!user} isAgency={isAgency}>
      {children}
    </EventsChrome>
  );
}
