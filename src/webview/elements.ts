/// <reference lib="dom" />

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

// ── Navigation toolbar ───────────────────────────────────────────────────────
export const frame         = el<HTMLIFrameElement>('browser-frame');
export const urlInput      = el<HTMLInputElement>('url-input');
export const btnBack       = el<HTMLButtonElement>('btn-back');
export const btnForward    = el<HTMLButtonElement>('btn-forward');
export const btnRefresh    = el<HTMLButtonElement>('btn-refresh');
export const btnGo         = el<HTMLButtonElement>('btn-go');
export const btnExternal   = el<HTMLButtonElement>('btn-external');
export const btnAutoRel    = el<HTMLButtonElement>('btn-autoreload');
export const btnInspect    = el<HTMLButtonElement>('btn-inspect');
export const deviceSel     = el<HTMLSelectElement>('device-select');
export const deviceFrame   = el<HTMLDivElement>('device-frame');
export const schemeIcon    = el<HTMLSpanElement>('url-scheme-icon');
export const statusText    = el<HTMLSpanElement>('status-text');
export const urlDisplay    = el<HTMLSpanElement>('current-url-display');
export const crossBadge    = el<HTMLDivElement>('cross-origin-badge');

// ── Error overlay ────────────────────────────────────────────────────────────
export const errorOverlay  = el<HTMLDivElement>('error-overlay');
export const errorHost     = el<HTMLElement>('error-host');
export const errorUrlEl    = el<HTMLDivElement>('error-url-display');
export const errorRetry    = el<HTMLButtonElement>('error-btn-retry');
export const errorOpenExt  = el<HTMLButtonElement>('error-btn-open-ext');

// ── Blocked-embed banner ─────────────────────────────────────────────────────
export const blockedBanner  = el<HTMLDivElement>('blocked-banner');
export const blockedHostEl  = el<HTMLElement>('blocked-host');
export const blockedOpen    = el<HTMLButtonElement>('blocked-btn-open');
export const blockedDismiss = el<HTMLButtonElement>('blocked-btn-dismiss');

// ── Loading bar (created dynamically) ───────────────────────────────────────
export const loadingBar = Object.assign(document.createElement('div'), { id: 'loading-bar' });
deviceFrame.prepend(loadingBar);
