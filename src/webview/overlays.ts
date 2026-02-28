import * as el         from './elements';
import { stopLoading } from './ui';

// ── Connection error overlay ─────────────────────────────────────────────────

export function showErrorPage(url: string) {
  hideBlockedBanner();
  el.errorOverlay.classList.add('visible');
  try { el.errorHost.textContent = new URL(url).host; } catch { el.errorHost.textContent = url; }
  el.errorUrlEl.textContent = url;
  el.frame.style.display   = 'none';
  stopLoading();
  el.statusText.textContent = 'Connection refused';
}

export function hideErrorPage() {
  el.errorOverlay.classList.remove('visible');
  el.frame.style.display = '';
}

// ── Blocked-embed banner ─────────────────────────────────────────────────────

export function showBlockedBanner(url: string) {
  try { el.blockedHostEl.textContent = new URL(url).host; }
  catch { el.blockedHostEl.textContent = url; }
  el.blockedBanner.classList.add('visible');
}

export function hideBlockedBanner() {
  el.blockedBanner.classList.remove('visible');
}
