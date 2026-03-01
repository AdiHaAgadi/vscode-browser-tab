# Browser Tab

<p align="center">
  <img src="media/icon.png" width="128" alt="Browser Tab Icon" />
</p>

<p align="center">
  <strong>An embedded browser panel right inside VS Code. Stop switching windows and start previewing your workspace instantly!</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=AdiHaAgadi.vscode-browser-tab"><img src="https://img.shields.io/visual-studio-marketplace/v/AdiHaAgadi.vscode-browser-tab.svg?label=VS%20Marketplace" alt="Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=AdiHaAgadi.vscode-browser-tab"><img src="https://img.shields.io/visual-studio-marketplace/i/AdiHaAgadi.vscode-browser-tab.svg" alt="Installs"></a>
  <a href="https://github.com/AdiHaAgadi/vscode-browser-tab/actions/workflows/ci.yml"><img src="https://github.com/AdiHaAgadi/vscode-browser-tab/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <img src="https://img.shields.io/badge/Coverage-91%25-success.svg" alt="Test Coverage">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License">
</p>

## ✨ Key Features

- 🌐 **Embedded Browser**: Open a full-featured web browser directly inside a VS Code webview panel.
- ⚡ **HMR Aware Auto-Reload**: Automatically reloads the browser tab when a workspace file is saved. Skips full-page reloads for file types natively handled by Hot Module Replacement (Vite, Webpack, etc.), keeping your application state intact.
- 🔍 **Inspect Elements**: Native integration allowing you to click an element in the browser panel and jump straight to its source code in your editor.
- 🛠 **Integrated DevTools (Console & Network)**: View `console.log` and `fetch`/`XHR` network requests in VS Code without opening an external browser's DevTools.
  - *How to use*: Press `Ctrl+Shift+U` (or `Cmd+Shift+U` on macOS) to open the Output panel, then select **"Browser Tab — Console"** or **"Browser Tab — Network"** from the dropdown menu.
- 🔗 **Terminal Link Interception**: Clicking a `localhost` URL in your VS Code terminal automatically opens it in the Browser Tab instead of your system browser.

---

## ⌨️ Commands

Access these via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command Title | ID | Default Keybinding |
| :--- | :--- | :--- |
| **Open Browser Tab** | `vscode-browser-tab.open` | `Ctrl+Shift+B` / `Cmd+Shift+B` |
| **Open URL in Browser Tab** | `vscode-browser-tab.navigate` | `Ctrl+Shift+L` / `Cmd+Shift+L` |

---

## ⚙️ Extension Settings

Customize the extension's behavior through `settings.json` or the VS Code Settings UI:

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vscode-browser-tab.defaultUrl` | `string` | `http://localhost:3000` | The default URL opened when the browser tab is launched. |
| `vscode-browser-tab.autoReload` | `boolean` | `true` | Reloads the browser when a workspace file is saved. |
| `vscode-browser-tab.hmrAware` | `boolean` | `true` | Skips auto-reload for `.js, .ts, .css, .vue, .svelte` files so HMR can handle them. |
| `vscode-browser-tab.consoleOutput` | `string` | `"all"` | Minimum log level to mirror to the output channel (`all`, `warn`, `error`, `none`). |
| `vscode-browser-tab.networkInspector` | `boolean` | `true` | Log `fetch` and `XHR` requests from the active page to the Network output channel. |
| `vscode-browser-tab.terminalLinks` | `boolean` | `true` | If enabled, terminal URLs open in the extension instead of the system browser. |

---

## 🛡️ Security & Privacy

This extension is built with robust isolation to ensure your host machine remains secure:

- **Localhost Proxy Binding**: The internal development proxy only binds to `127.0.0.1`, meaning other devices on your local network cannot use your machine as an open proxy.
- **SSRF Mitigation**: The proxy explicitly refuses to route non-localhost URLs (e.g., `https://example.com`), mitigating Server-Side Request Forgery vulnerabilities.
- **Restricted Resource Roots**: The webview panel utilizes strict `localResourceRoots`, ensuring scripts loaded inside the browser tab cannot read arbitrary files from your hard drive via the extension context.

---

## 🧪 Testing & Reliability

Browser Tab is built for enterprise reliability:

- **Continuous Integration**: 100% automated testing pipeline running on GitHub Actions across **Ubuntu Linux, macOS, and Windows**.
- **Coverage**: Maintains **>90% code coverage** through a combination of fast `vitest` unit tests and rigorous `Mocha`/Electron integration tests running inside a real VS Code extension host.

---

## Release Notes

For a full history of changes, see the [CHANGELOG.md](CHANGELOG.md).
