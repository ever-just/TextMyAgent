import { safeStorage, app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

interface SecureData {
  [key: string]: string;
}

const STORAGE_FILE = 'secure-data.enc';

function getStoragePath(): string {
  return path.join(app.getPath('userData'), STORAGE_FILE);
}

function loadSecureData(): SecureData {
  const storagePath = getStoragePath();

  if (!fs.existsSync(storagePath)) {
    return {};
  }

  try {
    const encryptedBuffer = fs.readFileSync(storagePath);

    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[SecureStorage] Encryption not available, data may be compromised');
      return JSON.parse(encryptedBuffer.toString());
    }

    const decrypted = safeStorage.decryptString(encryptedBuffer);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[SecureStorage] Failed to load secure data:', error);
    return {};
  }
}

function saveSecureData(data: SecureData): void {
  const storagePath = getStoragePath();
  const jsonString = JSON.stringify(data);

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(jsonString);
      fs.writeFileSync(storagePath, encrypted);
    } else {
      console.warn('[SecureStorage] Encryption not available, storing plaintext');
      fs.writeFileSync(storagePath, jsonString);
    }
  } catch (error) {
    console.error('[SecureStorage] Failed to save secure data:', error);
    throw error;
  }
}

// Public API
export function getSecureValue(key: string): string | null {
  const data = loadSecureData();
  return data[key] ?? null;
}

export function setSecureValue(key: string, value: string): void {
  const data = loadSecureData();
  data[key] = value;
  saveSecureData(data);
}

export function deleteSecureValue(key: string): void {
  const data = loadSecureData();
  delete data[key];
  saveSecureData(data);
}

export function hasSecureValue(key: string): boolean {
  const data = loadSecureData();
  return key in data;
}

// Convenience functions
export const SecureStorage = {
  getAnthropicApiKey: () => getSecureValue('ANTHROPIC_API_KEY'),
  setAnthropicApiKey: (key: string) => setSecureValue('ANTHROPIC_API_KEY', key),
  hasAnthropicKey: () => hasSecureValue('ANTHROPIC_API_KEY'),

  // Check if API key is configured (iMessage access is checked separately via iMessageService)
  isConfigured: () => {
    return hasSecureValue('ANTHROPIC_API_KEY');
  },

  clearAll: () => {
    const storagePath = getStoragePath();
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
  },
};

// Setup IPC handlers for secure storage
export function setupSecureStorageIPC(): void {
  ipcMain.handle('secure-storage:get', (_event, key: string) => {
    // Don't expose raw API keys to renderer
    // Instead, return whether they're configured
    switch (key) {
      case 'ANTHROPIC_API_KEY':
        return SecureStorage.getAnthropicApiKey() ? '••••••••' : null;
      default:
        return null;
    }
  });

  ipcMain.handle('secure-storage:set', (_event, key: string, value: string) => {
    switch (key) {
      case 'ANTHROPIC_API_KEY':
        SecureStorage.setAnthropicApiKey(value);
        return true;
      default:
        return false;
    }
  });

  ipcMain.handle('secure-storage:is-configured', () => {
    return SecureStorage.isConfigured();
  });
}
