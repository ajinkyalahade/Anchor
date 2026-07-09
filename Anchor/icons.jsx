/* Inline icons — thin stroke, calm aesthetic. Stays consistent across the app. */
const Ico = {
  home: (p) => (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" {...p}>
      <path d="M3 9.5L10 4l7 5.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1V9.5Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  focus: (p) => (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" {...p}>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="10" cy="10" r="2.2" fill="currentColor"/>
    </svg>
  ),
  games: (p) => (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" {...p}>
      <rect x="3" y="6" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 10.5h2M8 9.5v2M12.5 10h.01M14.5 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  calm: (p) => (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" {...p}>
      <path d="M4 12c0-3 2.5-5 6-5s6 2 6 5-2.5 4-6 4-6-1-6-4Z" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.5 10.5c.6.4 1.5.4 2.5 0M12 10.5c-.6.4-1.5.4-2.5 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  me: (p) => (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" {...p}>
      <circle cx="10" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M4.5 16c.8-2.8 3-4.2 5.5-4.2S14.7 13.2 15.5 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  play: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M5 3.5v9l8-4.5-8-4.5Z" fill="currentColor"/>
    </svg>
  ),
  pause: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <rect x="4" y="3" width="3" height="10" fill="currentColor" rx="0.5"/>
      <rect x="9" y="3" width="3" height="10" fill="currentColor" rx="0.5"/>
    </svg>
  ),
  plus: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  arrow: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M4 8h8M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  spark: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"
            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  leaf: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M13 3c0 5-3 9-9 10 0-5 3-9 9-10ZM4 13c2-2 4-3 6-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  book: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M3 3.5C3 3.2 3.2 3 3.5 3H8v10H3.5c-.3 0-.5-.2-.5-.5v-9ZM8 3h4.5c.3 0 .5.2.5.5v9c0 .3-.2.5-.5.5H8V3Z" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  pin: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M8 9.5V14M5 3h6l-1 4.5H6L5 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  wind: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M2 6h7a2 2 0 1 0-2-2M2 10h10a2 2 0 1 1-2 2M2 8h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  hand: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M5 8V4.5a1 1 0 1 1 2 0V8M7 8V3.5a1 1 0 1 1 2 0V8M9 8V4a1 1 0 1 1 2 0v4M11 6.5a1 1 0 1 1 2 0V11c0 2-1.5 3-3.5 3H7c-1.5 0-2.5-.5-3-2L3 9.5a1 1 0 0 1 1.7-1L5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  heart: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M8 13S2.5 9.5 2.5 6.2A2.7 2.7 0 0 1 8 5.5a2.7 2.7 0 0 1 5.5.7C13.5 9.5 8 13 8 13Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  cloud: (p) => (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" {...p}>
      <path d="M4 11h7a3 3 0 0 0 .3-6A4 4 0 0 0 4 7v.1A2.5 2.5 0 1 0 4 11Z" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
};

/* tiny abstract visuals for game cards — wireframey, monochrome */
const GameVisual = {
  echo: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g stroke="var(--games-ink)" strokeWidth="1.2" fill="none" opacity="0.9">
        <rect x="22" y="14" width="14" height="14" rx="3"/>
        <rect x="42" y="14" width="14" height="14" rx="3" fill="var(--games)" stroke="none"/>
        <rect x="62" y="14" width="14" height="14" rx="3"/>
        <rect x="82" y="14" width="14" height="14" rx="3"/>
        <rect x="22" y="32" width="14" height="14" rx="3"/>
        <rect x="42" y="32" width="14" height="14" rx="3"/>
        <rect x="62" y="32" width="14" height="14" rx="3" fill="var(--games)" stroke="none"/>
        <rect x="82" y="32" width="14" height="14" rx="3"/>
      </g>
    </svg>
  ),
  mirror: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g>
        <circle cx="46" cy="22" r="8" fill="var(--games)" opacity="0.9"/>
        <circle cx="74" cy="22" r="8" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
        <circle cx="46" cy="42" r="8" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
        <circle cx="74" cy="42" r="8" fill="var(--games)" opacity="0.9"/>
      </g>
    </svg>
  ),
  spotter: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g stroke="var(--games-ink)" strokeWidth="1.3" fill="none">
        <circle cx="34" cy="22" r="4"/>
        <circle cx="50" cy="34" r="4"/>
        <circle cx="36" cy="44" r="4"/>
      </g>
      <g stroke="var(--games-ink)" strokeWidth="1.3" fill="none">
        <circle cx="78" cy="22" r="4"/>
        <circle cx="94" cy="34" r="4" fill="var(--games)"/>
        <circle cx="80" cy="44" r="4"/>
      </g>
      <line x1="60" y1="10" x2="60" y2="50" stroke="var(--hairline-strong)" strokeWidth="1" strokeDasharray="2 3"/>
    </svg>
  ),
  lockstep: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g fill="none" strokeWidth="1.4">
        <circle cx="40" cy="30" r="11" fill="var(--games)" opacity="0.9"/>
        <circle cx="68" cy="30" r="11" stroke="var(--games-ink)"/>
        <line x1="63" y1="25" x2="73" y2="35" stroke="var(--games-ink)" strokeWidth="1.6" strokeLinecap="round"/>
        <line x1="73" y1="25" x2="63" y2="35" stroke="var(--games-ink)" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="96" cy="30" r="11" fill="var(--games)" opacity="0.9"/>
      </g>
    </svg>
  ),
  switchg: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g>
        <rect x="32" y="18" width="22" height="22" rx="4" fill="var(--games)" opacity="0.9"/>
        <path d="M58 30h10" stroke="var(--games-ink)" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M64 26l4 4-4 4" stroke="var(--games-ink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="82" cy="29" r="11" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
      </g>
    </svg>
  ),
  tracker: () => (
    <svg viewBox="0 0 120 60" width="120" height="60">
      <g fill="none" strokeWidth="1.2" stroke="var(--games-ink)">
        <path d="M20 30c10-18 30-18 40 0s30 18 40 0" />
      </g>
      <circle cx="28" cy="22" r="3.5" fill="var(--games)"/>
      <circle cx="56" cy="42" r="3.5" fill="var(--games)"/>
      <circle cx="84" cy="22" r="3.5" fill="var(--games)"/>
      <circle cx="100" cy="38" r="3.5" fill="none" stroke="var(--games-ink)" strokeWidth="1.4"/>
    </svg>
  ),
};

Object.assign(window, { Ico, GameVisual });
