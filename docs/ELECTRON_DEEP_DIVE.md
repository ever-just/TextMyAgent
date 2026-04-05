# Electron Desktop App: Complete Deep Dive Guide

## Table of Contents
1. [Security Hardening & Fuses](#1-security-hardening--fuses)
2. [Process Architecture](#2-process-architecture)
3. [Native Modules & Universal Builds](#3-native-modules--universal-builds)
4. [Embedding Express Backend](#4-embedding-express-backend)
5. [SQLite Database Layer](#5-sqlite-database-layer)
6. [Secure Storage (API Keys)](#6-secure-storage)
7. [App Lifecycle & Window Management](#7-app-lifecycle)
8. [Menu Bar / Tray Integration](#8-tray-integration)
9. [Deep Linking](#9-deep-linking)
10. [First-Run Setup Wizard](#10-first-run-setup)
11. [Branding (Icons, DMG)](#11-branding)
12. [Code Signing & Notarization](#12-code-signing)
13. [Auto-Update System](#13-auto-update)
14. [CI/CD Pipeline](#14-cicd)
15. [Performance Optimization](#15-performance)
16. [Logging & Crash Reporting](#16-logging)
17. [Common Errors & Solutions](#17-common-errors)
18. [Implementation Checklist](#18-checklist)

---

## 1. Security Hardening & Fuses

### Electron Fuses (Package-time Security)

Fuses are "magic bits" flipped at package time. Once code-signed, the OS prevents changes.

```yaml
# electron-builder.yml
electronFuses:
  runAsNode: false                           # Disable ELECTRON_RUN_AS_NODE
  enableCookieEncryption: true               # Encrypt cookies with OS keychain
  enableNodeOptionsEnvironmentVariable: false # Disable NODE_OPTIONS
  enableNodeCliInspectArguments: false       # Disable --inspect flags
  enableEmbeddedAsarIntegrityValidation: true # Verify app.asar integrity
  onlyLoadAppFromAsar: true                  # Only load from app.asar
  grantFileProtocolExtraPrivileges: false    # Restrict file:// protocol
```

### Secure BrowserWindow Configuration

```typescript
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,      // REQUIRED: Isolate preload
    nodeIntegration: false,      // REQUIRED: No Node in renderer
    sandbox: true,               // REQUIRED: Chromium sandbox
    webviewTag: false,           // Disable <webview>
    enableWebSQL: false,
    allowRunningInsecureContent: false,
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

### IPC Sender Validation

```typescript
ipcMain.handle('sensitive-operation', async (event, data) => {
  // Validate sender is from your app's windows
  const validWindows = BrowserWindow.getAllWindows().map(w => w.webContents.id);
  if (!validWindows.includes(event.sender.id)) {
    throw new Error('Unauthorized');
  }
  // Proceed...
});
```

---

## 2. Process Architecture

```
MAIN PROCESS (Node.js, full system access)
├── Express Server (embedded)
├── SQLite Database
├── Tray Icon
├── Menu Bar
└── IPC Main handlers

    │ IPC (invoke/handle)
    ▼

PRELOAD SCRIPT (contextBridge)
└── Exposes safe APIs to renderer

    │ contextBridge
    ▼

RENDERER PROCESS (Chromium, your React app)
└── window.electronAPI.invoke('channel', data)
```

### Utility Process (for CPU-intensive tasks)

```typescript
// Main process
const worker = utilityProcess.fork(path.join(__dirname, 'worker.js'));
worker.postMessage({ task: 'heavy-computation' });
worker.on('message', (result) => console.log(result));

// worker.js
process.parentPort.on('message', (event) => {
  const result = doHeavyWork(event.data);
  process.parentPort.postMessage(result);
});
```

---

## 3. Native Modules & Universal Builds

### Rebuilding for Electron

```bash
npm install @electron/rebuild --save-dev

# package.json
"postinstall": "electron-builder install-app-deps"
```

### Universal Binary (Intel + Apple Silicon)

```yaml
# electron-builder.yml
mac:
  target:
    - target: dmg
      arch: [x64, arm64]  # Separate builds
    # OR
    - target: dmg
      arch: universal     # Single universal binary (~2x size)
```

### Unpack Native Modules from ASAR

```yaml
asarUnpack:
  - "**/*.node"
  - "**/better-sqlite3/**"
  - "**/node-mac-contacts/**"
```

---

## 4. Embedding Express Backend

```typescript
// electron/backend/server.ts
import express from 'express';
import { app as electronApp } from 'electron';

let server: any = null;

export async function startBackendServer(port = 3001): Promise<number> {
  const app = express();
  
  app.use(express.json());
  app.use(cors({ origin: 'file://' }));
  
  // Your routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: electronApp.getVersion() });
  });
  
  // Find available port
  const actualPort = await findAvailablePort(port);
  
  return new Promise((resolve) => {
    server = app.listen(actualPort, '127.0.0.1', () => {
      console.log(`Backend on port ${actualPort}`);
      resolve(actualPort);
    });
  });
}

export function stopBackendServer(): Promise<void> {
  return new Promise((resolve) => {
    server?.close(() => resolve());
  });
}
```

---

## 5. SQLite Database Layer

```typescript
// electron/backend/database.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db: Database.Database | null = null;

export function initializeDatabase(): Database.Database {
  if (db) return db;
  
  const dbPath = path.join(app.getPath('userData'), 'data.db');
  db = new Database(dbPath);
  
  // Performance optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('foreign_keys = ON');
  
  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      handle TEXT UNIQUE NOT NULL,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
```

---

## 6. Secure Storage

```typescript
// electron/backend/secure-storage.ts
import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(app.getPath('userData'), 'secure.enc');

export function setSecureValue(key: string, value: string): void {
  const data = loadData();
  data[key] = value;
  
  const json = JSON.stringify(data);
  const encrypted = safeStorage.encryptString(json);
  fs.writeFileSync(STORAGE_FILE, encrypted);
}

export function getSecureValue(key: string): string | null {
  const data = loadData();
  return data[key] ?? null;
}

function loadData(): Record<string, string> {
  if (!fs.existsSync(STORAGE_FILE)) return {};
  
  const encrypted = fs.readFileSync(STORAGE_FILE);
  const decrypted = safeStorage.decryptString(encrypted);
  return JSON.parse(decrypted);
}
```

---

## 7. App Lifecycle

```typescript
// electron/main.ts
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  initializeDatabase();
  await startBackendServer();
  createMainWindow();
  createTray();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', async () => {
  await stopBackendServer();
  closeDatabase();
});
```

---

## 8. Tray Integration

```typescript
// electron/utils/tray.ts
import { Tray, Menu, nativeImage, app } from 'electron';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): void {
  // Use Template image for macOS (auto-adapts to menu bar)
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../resources/tray-iconTemplate.png')
  ).resize({ width: 16, height: 16 });
  
  tray = new Tray(icon);
  tray.setToolTip('TextMyAgent');
  
  const menu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Settings', click: () => mainWindow.webContents.send('navigate', '/settings') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  
  tray.setContextMenu(menu);
  tray.on('click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
}
```

---

## 9. Deep Linking

```typescript
// Register protocol
app.setAsDefaultProtocolClient('textmyagent');

// macOS handler
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);  // textmyagent://settings
});

// Windows/Linux handler (via second-instance)
app.on('second-instance', (event, commandLine) => {
  const deepLink = commandLine.find(arg => arg.startsWith('textmyagent://'));
  if (deepLink) handleDeepLink(deepLink);
});
```

```yaml
# electron-builder.yml
mac:
  extendInfo:
    CFBundleURLTypes:
      - CFBundleURLName: TextMyAgent
        CFBundleURLSchemes:
          - textmyagent
```

---

## 10. First-Run Setup

```typescript
// Check first run
const isFirstRun = getSetting('setupComplete') !== 'true';

if (isFirstRun) {
  mainWindow.loadFile('setup.html');
} else {
  mainWindow.loadFile('index.html');
}

// Complete setup
ipcMain.handle('complete-setup', () => {
  setSetting('setupComplete', 'true');
  mainWindow.loadFile('index.html');
});
```

---

## 11. Branding

### Icon Requirements

| Platform | Format | Sizes |
|----------|--------|-------|
| macOS | .icns | 16-1024px (all in one) |
| Windows | .ico | 16-256px |
| Linux | .png | 512x512 |
| Tray (macOS) | Template.png | 16x16, 32x32 (@2x) |

### Generate Icons

```bash
npm install electron-icon-builder --save-dev
npx electron-icon-builder --input=icon-1024.png --output=./resources/icons
```

### DMG Background

- Size: 540x380 (1080x760 @2x)
- Format: PNG
- Show app icon on left, Applications folder link on right

---

## 12. Code Signing & Notarization

### Prerequisites
1. Apple Developer Account ($99/year)
2. Developer ID Application certificate
3. App-specific password (appleid.apple.com)

### Environment Variables
```bash
APPLE_ID=your@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
```

### Notarization Script

```javascript
// scripts/notarize.js
const { notarize } = require('@electron/notarize');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'darwin') return;
  
  await notarize({
    appPath: path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`),
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

```yaml
# electron-builder.yml
afterSign: scripts/notarize.js
```

---

## 13. Auto-Update

```typescript
// electron/utils/auto-updater.ts
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
  });
  
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });
}

ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
```

```yaml
# electron-builder.yml
publish:
  provider: github
  owner: your-username
  repo: textmyagent
```

---

## 14. CI/CD Pipeline

```yaml
# .github/workflows/build.yml
name: Build

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: macos-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: npm ci
      
      - name: Import certificates
        env:
          CERTIFICATE_P12: ${{ secrets.CERTIFICATE_P12 }}
          CERTIFICATE_PASSWORD: ${{ secrets.CERTIFICATE_PASSWORD }}
        run: |
          echo $CERTIFICATE_P12 | base64 -d > certificate.p12
          security create-keychain -p "" build.keychain
          security import certificate.p12 -k build.keychain -P "$CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple: -s -k "" build.keychain
      
      - name: Build & Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run build:mac
```

---

## 15. Performance Optimization

1. **Bundle code** - Use webpack/vite to reduce require() calls
2. **Lazy load modules** - Don't load everything at startup
3. **Use Utility Process** - Offload CPU work from main process
4. **Minimize dependencies** - Audit package sizes
5. **Enable compression** - Compress API responses

```typescript
// Lazy loading example
let heavyModule: typeof import('heavy-module') | null = null;

async function useHeavyModule() {
  if (!heavyModule) {
    heavyModule = await import('heavy-module');
  }
  return heavyModule.doWork();
}
```

---

## 16. Logging & Crash Reporting

```typescript
import log from 'electron-log';

// Configure
log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB

// Log location: ~/Library/Logs/TextMyAgent/main.log

// Crash reporter
import { crashReporter } from 'electron';

crashReporter.start({
  productName: 'TextMyAgent',
  submitURL: 'https://your-crash-server.com/submit',
  uploadToServer: true,
});
```

---

## 17. Common Errors & Solutions

### Error: `NODE_MODULE_VERSION mismatch`
```bash
npx @electron/rebuild
```

### Error: `Cannot find module 'better-sqlite3'`
```yaml
# electron-builder.yml
asarUnpack: ["**/better-sqlite3/**"]
```

### Error: `unable to build chain to self-signed root`
- Download intermediate certificate from Apple PKI
- Set trust to "Use System Defaults" (NOT "Always Trust")

### Error: `The executable does not have hardened runtime`
```yaml
mac:
  hardenedRuntime: true
  entitlements: resources/entitlements.mac.plist
```

### Error: White screen on launch
```typescript
// Use correct path in production
if (app.isPackaged) {
  mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
} else {
  mainWindow.loadURL('http://localhost:3000');
}
```

---

## 18. Implementation Checklist

### Phase 1: Setup (Day 1)
- [ ] Create `electron/` directory structure
- [ ] Install Electron, electron-builder
- [ ] Create main.ts, preload.ts
- [ ] Test basic window

### Phase 2: Database (Day 2)
- [ ] Install better-sqlite3
- [ ] Create database wrapper
- [ ] Migrate from PostgreSQL
- [ ] Test queries

### Phase 3: Backend (Day 3)
- [ ] Embed Express in main process
- [ ] Refactor routes for Electron
- [ ] Replace Redis with SQLite/memory
- [ ] Test all endpoints

### Phase 4: Frontend (Day 4)
- [ ] Configure Next.js static export
- [ ] Update API calls
- [ ] Test in Electron

### Phase 5: Branding (Day 5)
- [ ] Create 1024x1024 icon
- [ ] Generate all sizes
- [ ] Create DMG background
- [ ] Create tray icon

### Phase 6: Build (Day 6)
- [ ] Configure electron-builder.yml
- [ ] Create entitlements.plist
- [ ] Test unsigned build

### Phase 7: Signing (Day 7)
- [ ] Setup Apple Developer account
- [ ] Create certificates
- [ ] Create notarization script
- [ ] Test signed build

### Phase 8: Updates (Day 8)
- [ ] Configure electron-updater
- [ ] Setup GitHub releases
- [ ] Test update flow

### Phase 9: Polish (Days 9-10)
- [ ] First-run wizard
- [ ] Permission flows
- [ ] Error handling
- [ ] User testing

---

## Quick Commands

```bash
# Development
npm run dev

# Build unsigned (testing)
npm run build:mac -- --dir

# Build signed
npm run build:mac

# Debug build
DEBUG=electron-builder npm run build:mac

# Verify signing
codesign -dv --verbose=4 "build/mac/TextMyAgent.app"
spctl -a -vv "build/mac/TextMyAgent.app"

# Check notarization
xcrun stapler validate "build/mac/TextMyAgent.app"
```
