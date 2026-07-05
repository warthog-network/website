export type FeaturePointIconName =
  | "fromScratch"
  | "modernCode"
  | "openSource"
  | "efficient"
  | "fast"
  | "intelligent"
  | "repelFarms"
  | "gamers"
  | "democratized"
  | "userProtection"
  | "uniqueFeature"
  | "hardenedSafety"
  | "researchBacked"
  | "hybridLiquidity"
  | "noMev"
  | "inBrowser"
  | "persistence"
  | "p2pSupport";

const BRAND = "#FDB913";

export const featurePointIcons: Record<FeaturePointIconName, string> = {
  fromScratch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v18M3 12h18" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="${BRAND}" stroke-width="1.8"/></svg>`,
  modernCode: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6.5l-3 11" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  openSource: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="2.3" stroke="${BRAND}" stroke-width="1.8"/><circle cx="17.5" cy="6.5" r="2.3" stroke="${BRAND}" stroke-width="1.8"/><circle cx="12" cy="17.5" r="2.3" stroke="${BRAND}" stroke-width="1.8"/><path d="M8.4 8.2 10.6 15M15.6 8.2 13.4 15M8.7 7.8h6.6" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  efficient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 14h3l2 5 4-14 2 6h5" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  fast: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 2 5 13h6l-1 9 9-12h-6l1-8Z" fill="${BRAND}"/></svg>`,
  intelligent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 18h5" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M10 21h4" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 14.5c-1.7-1.6-2.5-3.4-2.5-5.2a5 5 0 1 1 10 0c0 1.8-.8 3.6-2.5 5.2" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  repelFarms: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 12 12 6.5 18.5 12" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="7" y="12" width="10" height="8" rx=".8" stroke="${BRAND}" stroke-width="1.8"/><path d="M10.5 15.5v4.5M13.5 15.5v4.5" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M5 5.5 19 18.5" stroke="${BRAND}" stroke-width="2" stroke-linecap="round"/></svg>`,
  gamers: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5.5" y="14.5" width="13" height="5.5" rx="2.75" stroke="${BRAND}" stroke-width="1.8"/><path d="M12 14.5V8.5" stroke="${BRAND}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="6" r="2.8" stroke="${BRAND}" stroke-width="1.8"/><circle cx="16" cy="16.5" r="1.4" fill="${BRAND}"/></svg>`,
  democratized: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20.5 9 15.5h6l-3 5Z" stroke="${BRAND}" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 15.5h14" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M6 15.5V14" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><circle cx="6" cy="11.5" r="2.8" stroke="${BRAND}" stroke-width="1.8"/><path d="M18 15.5V14" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><circle cx="18" cy="11.5" r="2.8" stroke="${BRAND}" stroke-width="1.8"/></svg>`,
  userProtection: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 4 6.5V12c0 4.2 3.4 7.4 8 9 4.6-1.6 8-4.8 8-9V6.5L12 3Z" stroke="${BRAND}" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.5 12.2 11 13.7 14.8 9.8" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  uniqueFeature: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5 13.6 8.6 18.9 8.6 14.6 11.7 16.2 16.8 12 13.7 7.8 16.8 9.4 11.7 5.1 8.6 10.4 8.6 12 3.5Z" fill="${BRAND}"/></svg>`,
  hardenedSafety: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2" stroke="${BRAND}" stroke-width="1.8"/><path d="M8.5 10V8a3.5 3.5 0 1 1 7 0v2" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="14.5" r="1.3" fill="${BRAND}"/><path d="M12 15.8V17" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  researchBacked: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4h8l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="${BRAND}" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 4v4h4M8.5 11h7M8.5 14.5h7M8.5 18h5" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  hybridLiquidity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 6.5v11" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M5.5 8.5h4.5M5.5 11.5h6M5.5 14.5h3.5M5.5 17.5h5" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M14.5 18c0-5 2.2-8.5 5.5-9.5 3.3 1 5.5 4.5 5.5 9.5" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M11.5 12h2.5" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  noMev: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="${BRAND}" d="M5 13.2h14V10.3C19 6.4 16 3.8 12 3.8S5 6.4 5 10.3v2.9Z"/><circle cx="9" cy="7.6" r=".9" fill="${BRAND}"/><circle cx="12" cy="6.7" r=".9" fill="${BRAND}"/><circle cx="15" cy="7.6" r=".9" fill="${BRAND}"/><path fill="${BRAND}" d="M4.5 13.6h15v2.7H4.5Z"/><path fill="${BRAND}" d="M4.5 16.3h15v4.1a1.2 1.2 0 0 1-1.2 1.2H5.7a1.2 1.2 0 0 1-1.2-1.2v-4.1Z"/><path d="M5 5.5 19 18.5" stroke="${BRAND}" stroke-width="2" stroke-linecap="round"/></svg>`,
  inBrowser: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" stroke="${BRAND}" stroke-width="1.8"/><path d="M3.5 9h17" stroke="${BRAND}" stroke-width="1.8"/><circle cx="6.3" cy="7" r=".8" fill="${BRAND}"/><circle cx="8.6" cy="7" r=".8" fill="${BRAND}"/></svg>`,
  persistence: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="12" cy="6.5" rx="7" ry="2.5" stroke="${BRAND}" stroke-width="1.8"/><path d="M5 6.5V16.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6.5" stroke="${BRAND}" stroke-width="1.8"/><path d="M5 11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" stroke="${BRAND}" stroke-width="1.8"/></svg>`,
  p2pSupport: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="7" cy="12" r="2.8" stroke="${BRAND}" stroke-width="1.8"/><circle cx="17" cy="12" r="2.8" stroke="${BRAND}" stroke-width="1.8"/><path d="M9.8 11.2 14.2 10M9.8 12.8 14.2 14" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/><path d="M12 9.2V7M12 16.8V19" stroke="${BRAND}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};