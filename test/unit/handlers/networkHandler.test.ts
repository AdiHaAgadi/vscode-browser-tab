import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock vscode ───────────────────────────────────────────────────────────────

const mockGet = vi.fn().mockReturnValue(true); // networkInspector enabled by default
vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: mockGet }) },
}));

const { handleNetworkRequest, handleNetworkResponse } = await import('../../../src/utils/handlers/networkHandler');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChannel() {
  return { appendLine: vi.fn() };
}

// ── handleNetworkRequest ──────────────────────────────────────────────────────

describe('handleNetworkRequest', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGet.mockReturnValue(true); });

  it('appends a ▶ request line to the channel', () => {
    const ch = makeChannel();
    handleNetworkRequest({ method: 'GET', url: '/api/data' }, ch as any);
    expect(ch.appendLine).toHaveBeenCalledOnce();
    expect(ch.appendLine.mock.calls[0][0]).toMatch(/▶ GET \/api\/data/);
  });

  it('defaults method to GET when missing', () => {
    const ch = makeChannel();
    handleNetworkRequest({ url: '/x' }, ch as any);
    expect(ch.appendLine.mock.calls[0][0]).toMatch(/▶ GET \/x/);
  });

  it('does nothing when networkInspector is disabled', () => {
    mockGet.mockReturnValue(false);
    const ch = makeChannel();
    handleNetworkRequest({ method: 'POST', url: '/y' }, ch as any);
    expect(ch.appendLine).not.toHaveBeenCalled();
  });
});

// ── handleNetworkResponse ─────────────────────────────────────────────────────

describe('handleNetworkResponse', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGet.mockReturnValue(true); });

  it('uses ✓ icon for 2xx responses', () => {
    const ch = makeChannel();
    handleNetworkResponse({ status: 200, statusText: 'OK', url: '/a' }, ch as any);
    expect(ch.appendLine.mock.calls[0][0]).toMatch(/✓ 200 OK/);
  });

  it('uses ✗ icon for 4xx responses', () => {
    const ch = makeChannel();
    handleNetworkResponse({ status: 404, statusText: 'Not Found', url: '/b' }, ch as any);
    expect(ch.appendLine.mock.calls[0][0]).toMatch(/✗ 404 Not Found/);
  });

  it('uses ✗ icon for 5xx responses', () => {
    const ch = makeChannel();
    handleNetworkResponse({ status: 500, statusText: 'Internal Server Error', url: '/c' }, ch as any);
    expect(ch.appendLine.mock.calls[0][0]).toMatch(/✗ 500/);
  });

  it('uses ○ icon for 3xx responses', () => {
    const ch = makeChannel();
    handleNetworkResponse({ status: 302, statusText: 'Found', url: '/d' }, ch as any);
    expect(ch.appendLine.mock.calls[0][0]).toMatch(/○ 302/);
  });

  it('shows FAILED message for status 0 (CORS / aborted)', () => {
    const ch = makeChannel();
    handleNetworkResponse({ status: 0, statusText: 'Network error', url: '/e' }, ch as any);
    const line: string = ch.appendLine.mock.calls[0][0];
    expect(line).toMatch(/✗/);
    expect(line).toMatch(/FAILED \(aborted\/CORS\/network error\)/);
    expect(line).toMatch(/\/e/);
  });

  it('includes the URL with a ← arrow', () => {
    const ch = makeChannel();
    handleNetworkResponse({ status: 200, statusText: 'OK', url: '/api/users' }, ch as any);
    expect(ch.appendLine.mock.calls[0][0]).toMatch(/← \/api\/users/);
  });

  it('does nothing when networkInspector is disabled', () => {
    mockGet.mockReturnValue(false);
    const ch = makeChannel();
    handleNetworkResponse({ status: 200, statusText: 'OK', url: '/f' }, ch as any);
    expect(ch.appendLine).not.toHaveBeenCalled();
  });
});
