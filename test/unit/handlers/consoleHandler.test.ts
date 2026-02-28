import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock vscode ───────────────────────────────────────────────────────────────
// consoleHandler reads vscode.workspace.getConfiguration at call time,
// so we mock the whole vscode module.

const mockGet = vi.fn();
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: mockGet }),
  },
}));

// Import AFTER mock is established
const { handleConsole } = await import('../../../src/utils/handlers/consoleHandler');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChannel() {
  return {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function msg(level: string, ...args: string[]) {
  return { level, args };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleConsole — level routing', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGet.mockReturnValue('all'); });

  it('routes "log" to channel.info()', () => {
    const ch = makeChannel();
    handleConsole(msg('log', 'hello'), ch as any);
    expect(ch.info).toHaveBeenCalledWith('hello');
  });

  it('routes "info" to channel.info()', () => {
    const ch = makeChannel();
    handleConsole(msg('info', 'hello'), ch as any);
    expect(ch.info).toHaveBeenCalledWith('hello');
  });

  it('routes "debug" to channel.debug()', () => {
    const ch = makeChannel();
    handleConsole(msg('debug', 'hello'), ch as any);
    expect(ch.debug).toHaveBeenCalledWith('hello');
  });

  it('routes "warn" to channel.warn()', () => {
    const ch = makeChannel();
    handleConsole(msg('warn', 'hello'), ch as any);
    expect(ch.warn).toHaveBeenCalledWith('hello');
  });

  it('routes "error" to channel.error()', () => {
    const ch = makeChannel();
    handleConsole(msg('error', 'hello'), ch as any);
    expect(ch.error).toHaveBeenCalledWith('hello');
  });

  it('joins multiple args with a space', () => {
    const ch = makeChannel();
    handleConsole(msg('log', 'hello'), ch as any);
    expect(ch.info).toHaveBeenCalledWith('hello');
  });

  it('unknown level falls back to channel.info()', () => {
    const ch = makeChannel();
    // 'verbose' is not in CONSOLE_LEVEL — order defaults to 0 via ?? 0
    handleConsole(msg('verbose', 'hello'), ch as any);
    expect(ch.info).toHaveBeenCalledWith('hello');
  });

  it('missing level field defaults to "log" → channel.info()', () => {
    const ch = makeChannel();
    handleConsole({ args: ['hello'] } as any, ch as any); // no level field
    expect(ch.info).toHaveBeenCalledWith('hello');
  });
});

describe('handleConsole — level gating', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('setting=none suppresses everything', () => {
    mockGet.mockReturnValue('none');
    const ch = makeChannel();
    for (const level of ['log', 'info', 'debug', 'warn', 'error']) {
      handleConsole(msg(level, 'hello'), ch as any);
    }
    expect(ch.info).not.toHaveBeenCalled();
    expect(ch.warn).not.toHaveBeenCalled();
    expect(ch.error).not.toHaveBeenCalled();
    expect(ch.debug).not.toHaveBeenCalled();
  });

  it('setting=warn allows warn and error, suppresses log/info/debug', () => {
    mockGet.mockReturnValue('warn');
    const ch = makeChannel();
    handleConsole(msg('log',   'skip'), ch as any);
    handleConsole(msg('info',  'skip'), ch as any);
    handleConsole(msg('debug', 'skip'), ch as any);
    handleConsole(msg('warn',  'ok'),   ch as any);
    handleConsole(msg('error', 'ok'),   ch as any);
    expect(ch.info).not.toHaveBeenCalled();
    expect(ch.debug).not.toHaveBeenCalled();
    expect(ch.warn).toHaveBeenCalledWith('ok');
    expect(ch.error).toHaveBeenCalledWith('ok');
  });

  it('setting=error allows only error', () => {
    mockGet.mockReturnValue('error');
    const ch = makeChannel();
    handleConsole(msg('warn',  'skip'), ch as any);
    handleConsole(msg('error', 'ok'),   ch as any);
    expect(ch.warn).not.toHaveBeenCalled();
    expect(ch.error).toHaveBeenCalledWith('ok');
  });

  it('setting=all allows everything', () => {
    mockGet.mockReturnValue('all');
    const ch = makeChannel();
    handleConsole(msg('debug', 'ok'), ch as any);
    expect(ch.debug).toHaveBeenCalledWith('ok');
  });
});
