# Electron Desktop App

This directory contains the Electron main process code for the TextMyAgent desktop application.

## Development

### Prerequisites

- Node.js 18+
- npm
- BlueBubbles Server running on macOS

### Running in Development

**Important:** Due to IDE terminal limitations, you should run Electron from a **system terminal** (Terminal.app, iTerm2) rather than an IDE-embedded terminal.

```bash
# From project root
npm run dev:electron
```

If you encounter `TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')`, this is caused by the `ELECTRON_RUN_AS_NODE` environment variable being set (common in IDE terminals like VS Code, Cursor, Windsurf).

**Fix:** Run from a system terminal, or manually unset the variable:

```bash
env -u ELECTRON_RUN_AS_NODE npm run dev:electron
```

### Running with Dashboard

To run both the Next.js dashboard and Electron together:

```bash
# Terminal 1: Start Next.js dev server
cd dashboard && npm run dev

# Terminal 2: Start Electron (from system terminal)
npm run dev:electron
```

Or use the combined command (requires system terminal):

```bash
npm run dev
```

## Architecture

```
electron/
├── main.ts              # Main process entry point
├── preload.ts           # Preload script (IPC bridge)
├── backend/
│   ├── server.ts        # Embedded Express server
│   ├── database.ts      # SQLite database (better-sqlite3)
│   └── routes/
│       └── dashboard.ts # Dashboard API routes
├── utils/
│   ├── tray.ts          # System tray integration
│   ├── auto-updater.ts  # Auto-update (electron-updater)
│   └── secure-storage.ts # Encrypted credential storage
└── tsconfig.json        # TypeScript config
```

## Building

```bash
# Build TypeScript
npm run build:electron

# Create unpacked app (for testing)
npm run pack

# Create distributable DMG
npm run dist:mac
```

## Key Features

- **Embedded Backend**: Express server runs inside Electron, no external server needed
- **SQLite Database**: All data stored locally using better-sqlite3
- **Secure Storage**: API keys encrypted using macOS Keychain via safeStorage
- **System Tray**: Minimize to tray, quick access menu
- **Auto-Update**: Automatic updates via GitHub Releases

## Troubleshooting

### `app` is undefined

This happens when `ELECTRON_RUN_AS_NODE=1` is set. Run from a system terminal or use:

```bash
env -u ELECTRON_RUN_AS_NODE npx electron .
```

### SIGTRAP on launch

This can occur when running from certain terminal environments. Try:

1. Run from Terminal.app or iTerm2
2. Clear quarantine attributes: `xattr -cr node_modules/electron`
3. Reinstall Electron: `rm -rf node_modules/electron && npm install`

### Window doesn't load

In development, the app tries to connect to `http://localhost:3000` (Next.js dev server). Make sure to start the dashboard first:

```bash
cd dashboard && npm run dev
```
