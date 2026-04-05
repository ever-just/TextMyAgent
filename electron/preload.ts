import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // Window controls
  showWindow: () => ipcRenderer.invoke('show-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // Secure storage
  getSecureValue: (key: string) => ipcRenderer.invoke('secure-storage:get', key),
  setSecureValue: (key: string, value: string) =>
    ipcRenderer.invoke('secure-storage:set', key, value),
  isConfigured: () => ipcRenderer.invoke('secure-storage:is-configured'),

  // Permissions
  checkPermission: (permission: string) =>
    ipcRenderer.invoke('permissions:check', permission),
  requestPermission: (permission: string) =>
    ipcRenderer.invoke('permissions:request', permission),

  // Event listeners
  onBackendPort: (callback: (port: number) => void) => {
    ipcRenderer.on('backend-port', (_event, port) => callback(port));
  },
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on('navigate', (_event, path) => callback(path));
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', () => callback());
  },

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getAppInfo: () => Promise<{
        version: string;
        name: string;
        isPackaged: boolean;
        platform: string;
        arch: string;
        backendPort: number | null;
      }>;
      getSystemTheme: () => Promise<'dark' | 'light'>;
      getUserDataPath: () => Promise<string>;
      showWindow: () => Promise<void>;
      quitApp: () => Promise<void>;
      getSecureValue: (key: string) => Promise<string | null>;
      setSecureValue: (key: string, value: string) => Promise<boolean>;
      isConfigured: () => Promise<boolean>;
      checkPermission: (permission: string) => Promise<boolean>;
      requestPermission: (permission: string) => Promise<boolean>;
      onBackendPort: (callback: (port: number) => void) => void;
      onNavigate: (callback: (path: string) => void) => void;
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      checkForUpdates: () => Promise<void>;
      installUpdate: () => Promise<void>;
    };
  }
}
