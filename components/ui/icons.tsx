import type { ReactNode } from 'react'

/**
 * Единый набор иконок (обводка 1.75, viewBox 24).
 * Один компонент <Icon name="…" /> вместо копипасты SVG по всем страницам.
 */

const PATHS: Record<string, ReactNode> = {
  dashboard: <><path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-4V14h-7v7.5h-4A1.5 1.5 0 0 1 3 20z" /></>,
  analytics: <><path d="M18 20V9" /><path d="M12 20V4" /><path d="M6 20v-6" /></>,
  restaurants: <><path d="M3 3h18v3.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M4.5 9.5V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5" /><path d="M10 21v-5h4v5" /></>,
  branches: <><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  qrcodes: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 17v4" /></>,
  users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.6" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.85" /><path d="M16.5 3.6a4 4 0 0 1 0 7.5" /></>,
  telegram: <><path d="M21.6 3.3 2.9 10.4c-.9.35-.88 1.63.03 1.95l4.6 1.6 1.75 5.2c.27.8 1.32.98 1.84.32l2.36-2.98 4.66 3.42c.66.48 1.6.12 1.77-.68l3.06-14.5c.19-.9-.7-1.65-1.37-1.4z" /><path d="m8 13.5 9.5-6.6-6.9 7.6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 6.7 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 12.9H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 6.7l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10.25 3H10a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.18l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 10.25V10a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  logout: <><path d="M9.5 21H5.5A2 2 0 0 1 3.5 19V5a2 2 0 0 1 2-2h4" /><path d="m16 16.5 4.5-4.5L16 7.5" /><path d="M20.5 12h-11" /></>,
  bell: <><path d="M18.5 8.5a6.5 6.5 0 1 0-13 0c0 6.5-2.5 8-2.5 8h18s-2.5-1.5-2.5-8" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  menu: <><path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h11" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4-4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5l-4 1 1-4z" /></>,
  trash: <><path d="M3.5 6h17" /><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" /><path d="M18.5 6.5 17.7 19a2 2 0 0 1-2 1.9h-7.4a2 2 0 0 1-2-1.9L5.5 6.5" /><path d="M10 11v5M14 11v5" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5.5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v1" /></>,
  check: <><path d="m4.5 12.5 5 5 10-11" /></>,
  download: <><path d="M12 3v13" /><path d="m7 11.5 5 5 5-5" /><path d="M4 20.5h16" /></>,
  refresh: <><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.5 4v5h-5" /></>,
  eye: <><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.2 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.2" /><path d="M6.3 6.4A17.4 17.4 0 0 0 2 12s3.8 7 10 7a9.6 9.6 0 0 0 4.5-1.1" /><path d="m3 3 18 18" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <><path d="M21 13.2A9 9 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2z" /></>,
  chevronRight: <><path d="m9 5 7 7-7 7" /></>,
  chevronDown: <><path d="m5 9 7 7 7-7" /></>,
  chevronLeft: <><path d="m15 5-7 7 7 7" /></>,
  arrowUp: <><path d="M12 20V5" /><path d="m5.5 11.5 6.5-6.5 6.5 6.5" /></>,
  arrowDown: <><path d="M12 4v15" /><path d="m5.5 12.5 6.5 6.5 6.5-6.5" /></>,
  filter: <><path d="M4 5h16l-6.2 7.4V19l-3.6 2v-8.6z" /></>,
  print: <><path d="M6.5 9V3.5h11V9" /><rect x="3.5" y="9" width="17" height="7.5" rx="2" /><path d="M6.5 14.5h11V21h-11z" /></>,
  share: <><circle cx="18" cy="5.5" r="2.8" /><circle cx="6" cy="12" r="2.8" /><circle cx="18" cy="18.5" r="2.8" /><path d="m8.4 10.7 7.2-3.9M8.4 13.3l7.2 3.9" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  lock: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M7.8 10.5V7.2a4.2 4.2 0 0 1 8.4 0v3.3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8v.4" /></>,
  alert: <><path d="M10.3 3.7 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 16.8v.4" /></>,
  sparkles: <><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z" /></>,
  nfc: <><path d="M6.5 8.2a6 6 0 0 1 11 0" /><path d="M3.5 5.6a9.6 9.6 0 0 1 17 0" /><path d="M9.6 10.9a2.8 2.8 0 0 1 4.8 0" /><path d="M12 14v6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  zap: <><path d="M13.5 2 4 13.5h7L10.5 22 20 10.5h-7z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" /></>,
  device: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.6" /><path d="M11 18.6h2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M8 21v-7h8v7M8 3v5h6" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.8 12.2 8.7-8.7M17 6l2.5 2.5M14.5 8.5 17 11" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  home: <><path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
}

export type IconName = keyof typeof PATHS

export function Icon({
  name, size = 17, strokeWidth = 1.75, className, style,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/** Логотип BirTapCard — волна NFC */
export function Logo({ size = 38 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.29,
        background: 'linear-gradient(135deg, var(--mint), var(--mint-2))',
        display: 'grid', placeItems: 'center', position: 'relative',
        flexShrink: 0,
        boxShadow: '0 6px 18px -6px var(--mint-glow)',
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none"
        stroke="#04121C" strokeWidth="2.3" strokeLinecap="round">
        <path d="M6.5 8.2a6 6 0 0 1 11 0" />
        <path d="M3.5 5.6a9.6 9.6 0 0 1 17 0" />
        <path d="M12 12.5v5" />
        <circle cx="12" cy="20" r="1.1" fill="#04121C" stroke="none" />
      </svg>
    </div>
  )
}
