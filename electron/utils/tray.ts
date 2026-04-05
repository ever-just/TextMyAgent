import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): Tray {
  // Use template image for macOS (automatically adapts to menu bar color)
  const iconName =
    process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';

  const iconPath = path.join(__dirname, '../../resources/icons', iconName);

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: 16, height: 16 });
  } catch {
    // Fallback: create a simple colored icon if file doesn't exist
    console.warn('[Tray] Icon not found, using fallback');
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('TextMyAgent');

  // Update context menu
  updateTrayMenu(mainWindow);

  // Click behavior
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Right-click shows menu (default on Windows/Linux)
  tray.on('right-click', () => {
    tray?.popUpContextMenu();
  });

  return tray;
}

export function updateTrayMenu(mainWindow: BrowserWindow | null): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show TextMyAgent',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', '/settings');
      },
    },
    {
      label: 'Check for Updates',
      click: () => {
        mainWindow?.webContents.send('check-updates');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function setTrayStatus(
  status: 'connected' | 'disconnected' | 'error'
): void {
  if (!tray) return;

  const statusIcons: Record<string, string> = {
    connected: 'tray-icon-green.png',
    disconnected: 'tray-icon-gray.png',
    error: 'tray-icon-red.png',
  };

  const iconPath = path.join(
    __dirname,
    '../../resources/icons',
    statusIcons[status]
  );

  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray.setImage(icon);
  } catch {
    console.warn(`[Tray] Status icon not found: ${status}`);
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
