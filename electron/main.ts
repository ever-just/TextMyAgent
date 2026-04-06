import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  nativeTheme,
  powerMonitor,
  Menu,
} from 'electron';
import path from 'path';
import { startBackendServer, stopBackendServer } from './backend/server';
import { initializeDatabase, closeDatabase } from './backend/database';
import { createTray, destroyTray } from './utils/tray';
import { setupAutoUpdater } from './utils/auto-updater';

// Global references
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let backendPort: number | null = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Create main window
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,

    // macOS styling
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    vibrancy: 'under-window',
    visualEffectState: 'active',

    // Window behavior
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load content
  if (app.isPackaged) {
    // In packaged app, serve dashboard through the embedded Express server
    // This avoids file:// protocol issues with relative paths
    console.log('[Main] Loading dashboard from backend server on port:', backendPort);
    mainWindow.loadURL(`http://127.0.0.1:${backendPort || 3001}/`);
  } else {
    // In dev mode, try to connect to Next.js dev server
    // Fall back to a simple status page if not available
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      console.log('[Main] Next.js dev server not running, loading fallback');
      mainWindow?.loadURL(`http://127.0.0.1:${backendPort || 3001}/api/health`);
    });
    mainWindow.webContents.openDevTools();
  }

  // Show when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle close (minimize to tray instead)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Pass backend port to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('backend-port', backendPort);
  });
}

// App ready
app.whenReady().then(async () => {
  console.log('App ready, initializing...');

  try {
    // Request Contacts permission on startup (triggers system prompt if not determined)
    try {
      const macContacts = require('node-mac-contacts');
      const authStatus = macContacts.getAuthStatus();
      console.log('[Main] Contacts permission status:', authStatus);
      
      if (authStatus === 'Not Determined') {
        console.log('[Main] Requesting Contacts permission...');
        const granted = macContacts.requestAccess();
        console.log('[Main] Contacts permission granted:', granted);
      }
    } catch (e) {
      console.log('[Main] Could not check Contacts permission:', e);
    }

    // Initialize database
    initializeDatabase();

    // Start backend server
    backendPort = await startBackendServer({ port: 3001 });

    // Create main window
    createMainWindow();

    // Create tray icon
    if (mainWindow) {
      createTray(mainWindow);
    }

    // Setup auto-updater (only in production)
    if (app.isPackaged && mainWindow) {
      setupAutoUpdater(mainWindow);
    }

    // macOS: Handle reopen
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        mainWindow?.show();
      }
    });

    console.log('App initialization complete');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

// Quit handling
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', async (event) => {
  event.preventDefault();

  console.log('App quitting, cleaning up...');

  try {
    await stopBackendServer();
    closeDatabase();
    destroyTray();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  app.exit(0);
});

// Window all closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Power events
powerMonitor.on('suspend', () => {
  console.log('System suspending...');
});

powerMonitor.on('resume', () => {
  console.log('System resumed');
});

// IPC Handlers
ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  name: app.getName(),
  isPackaged: app.isPackaged,
  platform: process.platform,
  arch: process.arch,
  backendPort,
}));

ipcMain.handle('get-system-theme', () =>
  nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
);

ipcMain.handle('show-window', () => {
  mainWindow?.show();
  mainWindow?.focus();
});

ipcMain.handle('quit-app', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('get-user-data-path', () => app.getPath('userData'));
