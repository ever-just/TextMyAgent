import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';
import { log } from '../routes/dashboard';

const execAsync = promisify(exec);

export interface PermissionStatus {
  id: string;
  name: string;
  description: string;
  status: 'granted' | 'denied' | 'not_determined' | 'unknown';
  required: boolean;
  settingsUrl: string;
  instructions: string[];
}

export interface PermissionsCheckResult {
  allGranted: boolean;
  requiredGranted: boolean;
  permissions: PermissionStatus[];
}

class PermissionServiceClass {
  private static instance: PermissionServiceClass;

  private constructor() {}

  static getInstance(): PermissionServiceClass {
    if (!PermissionServiceClass.instance) {
      PermissionServiceClass.instance = new PermissionServiceClass();
    }
    return PermissionServiceClass.instance;
  }

  /**
   * Check all required permissions for the app to function
   */
  async checkAllPermissions(): Promise<PermissionsCheckResult> {
    const permissions: PermissionStatus[] = [];

    // Check Full Disk Access (required for iMessage database)
    const fullDiskAccess = await this.checkFullDiskAccess();
    permissions.push(fullDiskAccess);

    // Check Automation/AppleEvents (required for sending messages)
    const automation = await this.checkAutomationPermission();
    permissions.push(automation);

    // Check Contacts (optional but recommended)
    const contacts = await this.checkContactsPermission();
    permissions.push(contacts);

    const allGranted = permissions.every(p => p.status === 'granted');
    const requiredGranted = permissions
      .filter(p => p.required)
      .every(p => p.status === 'granted');

    return {
      allGranted,
      requiredGranted,
      permissions,
    };
  }

  /**
   * Check Full Disk Access by attempting to read the iMessage database
   */
  async checkFullDiskAccess(): Promise<PermissionStatus> {
    const iMessageDbPath = path.join(os.homedir(), 'Library/Messages/chat.db');
    let status: 'granted' | 'denied' | 'not_determined' | 'unknown' = 'unknown';

    try {
      // Try to open the file for reading
      const fd = fs.openSync(iMessageDbPath, 'r');
      fs.closeSync(fd);
      status = 'granted';
      log('info', 'Full Disk Access check: granted');
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        status = 'denied';
        log('warn', 'Full Disk Access check: denied', { error: error.code });
      } else if (error.code === 'ENOENT') {
        // File doesn't exist - Messages app may not be set up
        status = 'unknown';
        log('warn', 'Full Disk Access check: iMessage database not found');
      } else {
        status = 'unknown';
        log('error', 'Full Disk Access check: unknown error', { error: error.message });
      }
    }

    return {
      id: 'full_disk_access',
      name: 'Full Disk Access',
      description: 'Required to read your iMessage history and respond to messages',
      status,
      required: true,
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
      instructions: [
        'Open System Settings',
        'Go to Privacy & Security',
        'Click on Full Disk Access',
        'Click the + button',
        'Navigate to Applications and select TextMyAgent',
        'Toggle TextMyAgent ON',
        'Restart TextMyAgent for changes to take effect',
      ],
    };
  }

  /**
   * Check Automation permission by attempting to send an AppleScript command
   */
  async checkAutomationPermission(): Promise<PermissionStatus> {
    let status: 'granted' | 'denied' | 'not_determined' | 'unknown' = 'unknown';

    try {
      // Try a simple AppleScript that checks if Messages is running
      // This should trigger the automation permission prompt if not granted
      await execAsync(`osascript -e 'tell application "System Events" to return name of first process whose frontmost is true'`);
      status = 'granted';
      log('info', 'Automation permission check: granted');
    } catch (error: any) {
      if (error.message.includes('not allowed') || error.message.includes('denied')) {
        status = 'denied';
        log('warn', 'Automation permission check: denied');
      } else {
        // Could be granted but command failed for other reasons
        status = 'unknown';
        log('warn', 'Automation permission check: unknown', { error: error.message });
      }
    }

    return {
      id: 'automation',
      name: 'Automation',
      description: 'Required to send messages through the Messages app',
      status,
      required: true,
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
      instructions: [
        'Open System Settings',
        'Go to Privacy & Security',
        'Click on Automation',
        'Find TextMyAgent in the list',
        'Enable "Messages" under TextMyAgent',
        'If TextMyAgent is not listed, try sending a test message first',
      ],
    };
  }

  /**
   * Check Contacts permission
   */
  async checkContactsPermission(): Promise<PermissionStatus> {
    let status: 'granted' | 'denied' | 'not_determined' | 'unknown' = 'unknown';

    try {
      const macContacts = require('node-mac-contacts');
      const authStatus = macContacts.getAuthStatus();
      
      if (authStatus === 'Authorized' || authStatus === 'authorized') {
        status = 'granted';
      } else if (authStatus === 'Denied' || authStatus === 'denied') {
        status = 'denied';
      } else if (authStatus === 'Not Determined' || authStatus === 'notDetermined') {
        status = 'not_determined';
      } else {
        status = 'unknown';
      }
      
      log('info', 'Contacts permission check', { authStatus, status });
    } catch (error: any) {
      log('warn', 'Contacts permission check failed', { error: error.message });
      status = 'unknown';
    }

    return {
      id: 'contacts',
      name: 'Contacts',
      description: 'Allows identifying message senders by their contact names',
      status,
      required: false,
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
      instructions: [
        'Open System Settings',
        'Go to Privacy & Security',
        'Click on Contacts',
        'Find TextMyAgent in the list',
        'Toggle TextMyAgent ON',
      ],
    };
  }

  /**
   * Request Contacts permission (triggers system prompt)
   */
  async requestContactsPermission(): Promise<boolean> {
    try {
      const macContacts = require('node-mac-contacts');
      const authStatus = macContacts.getAuthStatus();
      
      if (authStatus === 'Authorized' || authStatus === 'authorized') {
        return true;
      }
      
      if (authStatus === 'Not Determined' || authStatus === 'notDetermined') {
        // This triggers the system permission prompt
        const result = macContacts.requestAccess();
        log('info', 'Contacts permission requested', { result });
        return result;
      }
      
      // Already denied - user needs to go to settings
      return false;
    } catch (error: any) {
      log('error', 'Failed to request Contacts permission', { error: error.message });
      return false;
    }
  }

  /**
   * Request Automation permission by triggering an AppleScript
   */
  async requestAutomationPermission(): Promise<boolean> {
    try {
      // This will trigger the automation permission prompt for Messages
      await execAsync(`osascript -e 'tell application "Messages" to return name'`);
      log('info', 'Automation permission requested for Messages');
      return true;
    } catch (error: any) {
      log('warn', 'Automation permission request failed', { error: error.message });
      return false;
    }
  }

  /**
   * Open System Settings to the specified privacy pane
   */
  async openSystemSettings(settingsUrl: string): Promise<void> {
    try {
      await shell.openExternal(settingsUrl);
      log('info', 'Opened System Settings', { url: settingsUrl });
    } catch (error: any) {
      log('error', 'Failed to open System Settings', { error: error.message });
    }
  }

  /**
   * Open Full Disk Access settings
   */
  async openFullDiskAccessSettings(): Promise<void> {
    await this.openSystemSettings('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  }

  /**
   * Open Automation settings
   */
  async openAutomationSettings(): Promise<void> {
    await this.openSystemSettings('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation');
  }

  /**
   * Open Contacts settings
   */
  async openContactsSettings(): Promise<void> {
    await this.openSystemSettings('x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts');
  }

  /**
   * Check if this is the first launch (no permissions have been set up)
   */
  async isFirstLaunch(): Promise<boolean> {
    const result = await this.checkAllPermissions();
    // Consider it first launch if Full Disk Access is not granted
    return result.permissions.find(p => p.id === 'full_disk_access')?.status !== 'granted';
  }

  /**
   * Get a summary of missing required permissions
   */
  async getMissingRequiredPermissions(): Promise<PermissionStatus[]> {
    const result = await this.checkAllPermissions();
    return result.permissions.filter(p => p.required && p.status !== 'granted');
  }
}

export const permissionService = PermissionServiceClass.getInstance();
