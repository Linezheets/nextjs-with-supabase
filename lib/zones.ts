// ─────────────────────────────────────────────────────────────────────────────
// THEME ZONES — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
// The platform has exactly two visual zones:
//
//   DARK  = pure marketing. White-on-black with gold accents, the dark SiteNavbar
//           and the support ChatWidget.  Routes: '/', /about, /contact, /pricing/*,
//           /marketplace/*, /integrations/*, and the PUBLIC fashion-events browse
//           (/fashionevents and /fashionevents/[id]).
//
//   LIGHT = the app. Everything from login onward: auth (/login, /register, /mfa,
//           /forgot-password, /auth/*, /onboard, /pending-approval, /join), /legal,
//           /terms, /checkout, /inquiries/*, the whole /dashboard/* (buyer dash +
//           Brand Studio), and the OPERATIONAL event tools
//           (/fashionevents/manage, /admin, /scan).
//
// Public merchant storefronts (/store/[slug], /brand/[slug]) are merchant-themed —
// they paint their own colours and belong to NEITHER zone, so they fall through to
// the LIGHT default for chrome (no marketing navbar, white overscroll).
//
// HOW IT IS ENFORCED
//   • app/layout.tsx ships an inline <head> script that runs `isDarkZone` logic
//     BEFORE first paint, adding `.dark` to <html> for the dark zone (flash-free).
//   • components/ZoneSync.tsx re-applies it on client-side navigation.
//   • app/globals.css colours html / html.dark and drives <body> from shadcn
//     tokens, so a page physically cannot leak the wrong background.
//
// ⚠️  The inline script in app/layout.tsx DUPLICATES the rules below (a raw <script>
//     string can't import this module). If you change a rule here, update it there.
// ─────────────────────────────────────────────────────────────────────────────

/** Top-level marketing segments that render dark. */
const DARK_PREFIX = /^\/(about|contact|pricing|marketplace|integrations)(\/|$)/;

/** Operational event tools that are LIGHT even though they live under /fashionevents. */
const EVENTS_OPS = /^\/fashionevents\/(manage|admin|scan)(\/|$)/;

/** True when `pathname` should render in the DARK marketing zone. */
export function isDarkZone(pathname: string | null | undefined): boolean {
  const p = pathname || '/';
  if (p === '/') return true;
  if (p === '/fashionevents' || p.startsWith('/fashionevents/')) {
    return !EVENTS_OPS.test(p); // public browse = dark, ops tools = light
  }
  return DARK_PREFIX.test(p);
}

/**
 * True when the marketing chrome (dark SiteNavbar, support ChatWidget, dark footer)
 * should render. Currently identical to the dark zone, kept separate so chrome and
 * surface can diverge later without hunting down call sites.
 */
export function isMarketingChrome(pathname: string | null | undefined): boolean {
  return isDarkZone(pathname);
}
