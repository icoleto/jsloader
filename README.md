# JSLoader

<p align="center">
  <img src="icons/icon128.png" alt="JSLoader logo" width="128" height="128" />
</p>

JSLoader is a Chrome extension (Manifest V3) for storing and running custom JavaScript snippets per exact URL.

It is designed for power users who need lightweight page automation, DOM tweaks, and workflow shortcuts on specific websites.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Installation (Developer Mode)](#installation-developer-mode)
- [Usage](#usage)
- [Script Runtime Helpers](#script-runtime-helpers)
- [Permissions](#permissions)
- [Security Model](#security-model)
- [Development Notes](#development-notes)
- [Troubleshooting](#troubleshooting)

---

## Features

- Per-URL script management (exact URL matching).
- Enable/disable scripts individually.
- Configurable execution delay per script (useful for SPAs such as Power BI).
- Global management panel with:
  - URL-grouped script list
  - Search by script name or URL
  - Inline edit/delete/toggle actions
- Contextual popup for quick actions on the current page.
- Local storage with `chrome.storage.local` (no external backend).
- Built-in runtime helper for waiting on dynamically rendered elements.

---

## How It Works

1. JSLoader monitors tab updates.
2. When a page load completes, it finds active scripts matching that exact URL.
3. Each script is injected through `chrome.scripting.executeScript` in `world: "MAIN"`.
4. Optional per-script delay is applied before execution.
5. Scripts can use a shared helper (`waitForElement`) to handle late-rendered DOM.

---

## Project Structure

```text
jsloader/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   └── content-bridge.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── panel/
│   ├── panel.html
│   ├── panel.css
│   └── panel.js
├── editor/
│   ├── editor.html
│   ├── editor.css
│   └── editor.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the project root folder (`jsloader`).
5. (Optional) Pin **JSLoader** from the extensions menu for faster access.

After any local code change:

1. Go back to `chrome://extensions`.
2. Click **Reload** on JSLoader.

---

## Usage

### Quick flow (from current page)

1. Open the target website page.
2. Click the JSLoader toolbar icon.
3. Click **+ New** to create a script prefilled with the current URL.
4. Save and reload the page.

### Global flow (manage everything)

1. Open the popup.
2. Click **View all**.
3. Manage scripts grouped by URL:
   - Toggle on/off
   - Edit
   - Delete
   - Search

---

## Script Runtime Helpers

`waitForElement(selector, timeoutMs = 15000)` is available in user scripts.

Example:

```js
const slicer = await waitForElement('[data-testid="slicer-container"]', 20000);
slicer.click();
```

This is recommended for dynamic apps where key elements appear after initial page load.

---

## Permissions

JSLoader uses the following permissions:

- `storage` — persist scripts locally.
- `scripting` — inject script code into tabs.
- `activeTab` / `tabs` — detect current tab URL and react to tab updates.
- `host_permissions: <all_urls>` — allow matching and execution on user-targeted sites.

---

## Security Model

- Manifest V3 architecture with service worker background script.
- Extension pages restricted by CSP in `manifest.json`.
- Script data stored locally (`chrome.storage.local`).
- URL matching is exact (normalized URL, excluding hash and trailing slash).
- Execution occurs in page context (`world: "MAIN"`), enabling DOM access for automation.

> Important: user scripts run with the privileges of the visited page context. Only install scripts you trust.

---

## Development Notes

- No build step is required; this is a plain HTML/CSS/JS extension.
- Keep files ASCII-friendly where possible.
- Reload the extension after changes to test updates.

---

## Troubleshooting

### Script does not run

- Verify the script is enabled.
- Confirm the configured URL exactly matches the current page URL.
- Check DevTools Console for runtime errors.

### Script runs too early (SPA pages)

- Set a delay in seconds on the script.
- Use `waitForElement(...)` for specific DOM targets.

### Changes are not reflected

- Reload JSLoader from `chrome://extensions`.
- Refresh the target page.
