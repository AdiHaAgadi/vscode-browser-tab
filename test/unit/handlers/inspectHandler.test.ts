import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock vscode — showQuickPick + showInformationMessage + executeCommand ──────

const mockShowQuickPick        = vi.fn();
const mockShowInformationMessage = vi.fn();
const mockExecuteCommand       = vi.fn();

vi.mock('vscode', () => ({
  window: {
    showQuickPick:          mockShowQuickPick,
    showInformationMessage: mockShowInformationMessage,
  },
  commands: { executeCommand: mockExecuteCommand },
}));

const { handleInspectElement } = await import('../../../src/utils/handlers/inspectHandler');

// ── Helpers ───────────────────────────────────────────────────────────────────

function msg(tag: string, id: string, classes: string[]) {
  return { tag, id, classes };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user picks the first item
  mockShowQuickPick.mockImplementation((items: any[]) => Promise.resolve(items[0]));
});

// ── Hash stripping ────────────────────────────────────────────────────────────

describe('handleInspectElement — class hash stripping', () => {
  it('strips __name__hash (double-underscore wrapped)', async () => {
    await handleInspectElement(msg('div', '', ['__container__fx12g3']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].term).toBe('container');
    expect(items[0].description).toBe('__container__fx12g3');
  });

  it('strips name__hash (CSS Modules)', async () => {
    await handleInspectElement(msg('div', '', ['container__2xK9b']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].term).toBe('container');
  });

  it('strips name_hash_counter (CSS Modules with counter)', async () => {
    await handleInspectElement(msg('div', '', ['container_qgp7o_1']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].term).toBe('container');
  });

  it('leaves semantic names unchanged (no digit mix)', async () => {
    await handleInspectElement(msg('div', '', ['container_primary']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].term).toBe('container_primary');
    expect(items[0].description).toBeUndefined();
  });

  it('leaves plain class names unchanged', async () => {
    await handleInspectElement(msg('div', '', ['navbar']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].term).toBe('navbar');
  });

  it('strips name--hash (double-dash variant)', async () => {
    await handleInspectElement(msg('div', '', ['button--abc1de2']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].term).toBe('button');
    expect(items[0].description).toBe('button--abc1de2');
  });
});

// ── Framework class filtering ─────────────────────────────────────────────────

describe('handleInspectElement — framework class filtering', () => {
  it('filters Angular _ngcontent- classes to bottom with warning label', async () => {
    await handleInspectElement(msg('div', '', ['myClass', '_ngcontent-xyz-c100']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    const sourceItem = items.find((i: any) => i.term === 'myClass');
    const ngItem     = items.find((i: any) => i.term === '_ngcontent-xyz-c100');
    expect(sourceItem).toBeDefined();
    expect(ngItem?.label).toMatch(/\$\(warning\)/);
    expect(ngItem?.description).toMatch(/framework-generated/);
    // Source class must come before framework class
    expect(items.indexOf(sourceItem)).toBeLessThan(items.indexOf(ngItem));
  });

  it('filters Angular ng-star-inserted', async () => {
    await handleInspectElement(msg('div', '', ['ng-star-inserted']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].description).toMatch(/framework-generated/);
  });

  it('filters cdk- classes', async () => {
    await handleInspectElement(msg('div', '', ['cdk-overlay-container']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].description).toMatch(/framework-generated/);
  });
});

// ── ID search ─────────────────────────────────────────────────────────────────

describe('handleInspectElement — ID', () => {
  it('puts ID search at the top', async () => {
    await handleInspectElement(msg('div', 'myId', ['someClass']));
    const items: any[] = mockShowQuickPick.mock.calls[0][0];
    expect(items[0].term).toBe('myId');
    expect(items[0].label).toMatch(/#myId/);
  });
});

// ── Empty element ─────────────────────────────────────────────────────────────

describe('handleInspectElement — no selectors', () => {
  it('shows an info message when there is nothing to search for', async () => {
    await handleInspectElement(msg('div', '', []));
    expect(mockShowInformationMessage).toHaveBeenCalledOnce();
    expect(mockShowQuickPick).not.toHaveBeenCalled();
  });
});

// ── Search trigger ────────────────────────────────────────────────────────────

describe('handleInspectElement — search execution', () => {
  it('calls findInFiles with the picked term', async () => {
    mockShowQuickPick.mockResolvedValue({ label: '...', term: 'container' });
    await handleInspectElement(msg('div', '', ['container__abc123']));
    expect(mockExecuteCommand).toHaveBeenCalledWith(
      'workbench.action.findInFiles',
      { query: 'container', triggerSearch: true },
    );
  });

  it('does not call findInFiles if quick-pick is cancelled', async () => {
    mockShowQuickPick.mockResolvedValue(undefined);
    await handleInspectElement(msg('div', '', ['myClass']));
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });
});
