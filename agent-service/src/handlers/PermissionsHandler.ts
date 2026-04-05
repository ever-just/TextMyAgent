import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logInfo, logError, logDebug } from '../utils/logger';

const execAsync = promisify(exec);

export interface PermissionStatus {
  id: string;
  name: string;
  description: string;
  status: 'granted' | 'denied' | 'not_determined' | 'unknown' | 'not_applicable';
  settingsUrl?: string;
  instructions?: string[];
}

export interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'error' | 'not_installed';
  version?: string;
  instructions?: string[];
}

export interface ApiKeyStatus {
  id: string;
  name: string;
  description: string;
  required: boolean;
  configured: boolean;
  masked?: string;
  docsUrl?: string;
}

// Check macOS Contacts permission
async function checkContactsPermission(): Promise<PermissionStatus> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const macContacts = require('node-mac-contacts') as { getAuthStatus: () => string };
    const authStatus = macContacts.getAuthStatus();
    
    let status: PermissionStatus['status'] = 'unknown';
    if (authStatus === 'Authorized') status = 'granted';
    else if (authStatus === 'Denied') status = 'denied';
    else if (authStatus === 'Not Determined') status = 'not_determined';
    else if (authStatus === 'Restricted') status = 'denied';
    
    return {
      id: 'contacts',
      name: 'Contacts Access',
      description: 'Required to import and search your macOS contacts',
      status,
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
      instructions: [
        'Open System Settings',
        'Go to Privacy & Security > Contacts',
        'Enable access for Terminal or your IDE',
      ],
    };
  } catch (error) {
    return {
      id: 'contacts',
      name: 'Contacts Access',
      description: 'Required to import and search your macOS contacts',
      status: 'unknown',
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
    };
  }
}

// Check macOS Automation permission (for AppleScript)
async function checkAutomationPermission(): Promise<PermissionStatus> {
  try {
    // Try to run a simple AppleScript to check automation access
    await execAsync('osascript -e \'tell application "System Events" to return name of first process\'');
    return {
      id: 'automation',
      name: 'Automation Access',
      description: 'Required for AppleScript automation (reminders, calendar, etc.)',
      status: 'granted',
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
    };
  } catch (error) {
    return {
      id: 'automation',
      name: 'Automation Access',
      description: 'Required for AppleScript automation (reminders, calendar, etc.)',
      status: 'denied',
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
      instructions: [
        'Open System Settings',
        'Go to Privacy & Security > Automation',
        'Enable access for Terminal or your IDE',
      ],
    };
  }
}

// Check macOS Accessibility permission
async function checkAccessibilityPermission(): Promise<PermissionStatus> {
  try {
    const { stdout } = await execAsync('osascript -e \'tell application "System Events" to keystroke ""\'');
    return {
      id: 'accessibility',
      name: 'Accessibility Access',
      description: 'Required for keyboard automation and UI scripting',
      status: 'granted',
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    };
  } catch (error) {
    // This might fail even with permission, so we check differently
    return {
      id: 'accessibility',
      name: 'Accessibility Access',
      description: 'Required for keyboard automation and UI scripting (optional)',
      status: 'unknown',
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      instructions: [
        'Open System Settings',
        'Go to Privacy & Security > Accessibility',
        'Enable access for Terminal or your IDE',
      ],
    };
  }
}

// Check Full Disk Access
async function checkFullDiskAccess(): Promise<PermissionStatus> {
  try {
    // Try to read a protected file
    await execAsync('ls ~/Library/Mail 2>/dev/null');
    return {
      id: 'full_disk_access',
      name: 'Full Disk Access',
      description: 'Required for accessing protected files and databases',
      status: 'granted',
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
    };
  } catch (error) {
    return {
      id: 'full_disk_access',
      name: 'Full Disk Access',
      description: 'Required for accessing protected files and databases (optional)',
      status: 'unknown',
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
      instructions: [
        'Open System Settings',
        'Go to Privacy & Security > Full Disk Access',
        'Enable access for Terminal or your IDE',
      ],
    };
  }
}

// Check Docker status
async function checkDockerStatus(): Promise<ServiceStatus> {
  try {
    const { stdout } = await execAsync('docker --version');
    const version = stdout.trim();
    
    // Check if Docker daemon is running
    try {
      await execAsync('docker ps');
      return {
        id: 'docker',
        name: 'Docker',
        description: 'Required for PostgreSQL and Redis containers',
        status: 'running',
        version,
      };
    } catch {
      return {
        id: 'docker',
        name: 'Docker',
        description: 'Required for PostgreSQL and Redis containers',
        status: 'stopped',
        version,
        instructions: ['Open Docker Desktop to start the Docker daemon'],
      };
    }
  } catch {
    return {
      id: 'docker',
      name: 'Docker',
      description: 'Required for PostgreSQL and Redis containers',
      status: 'not_installed',
      instructions: ['Install Docker Desktop from https://docker.com'],
    };
  }
}

// Check PostgreSQL container
async function checkPostgresStatus(): Promise<ServiceStatus> {
  try {
    const { stdout } = await execAsync('docker ps --filter "name=agent-postgres" --format "{{.Status}}"');
    if (stdout.includes('Up')) {
      return {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'Database for storing messages, users, and agent data',
        status: 'running',
      };
    }
    return {
      id: 'postgres',
      name: 'PostgreSQL',
      description: 'Database for storing messages, users, and agent data',
      status: 'stopped',
      instructions: ['Run: docker start agent-postgres'],
    };
  } catch {
    return {
      id: 'postgres',
      name: 'PostgreSQL',
      description: 'Database for storing messages, users, and agent data',
      status: 'not_installed',
      instructions: ['Run the setup script to create the PostgreSQL container'],
    };
  }
}

// Check Redis container
async function checkRedisStatus(): Promise<ServiceStatus> {
  try {
    const { stdout } = await execAsync('docker ps --filter "name=bluebubbles-redis" --format "{{.Status}}"');
    if (stdout.includes('Up')) {
      return {
        id: 'redis',
        name: 'Redis',
        description: 'Cache and queue for background jobs',
        status: 'running',
      };
    }
    return {
      id: 'redis',
      name: 'Redis',
      description: 'Cache and queue for background jobs',
      status: 'stopped',
      instructions: ['Run: docker start bluebubbles-redis'],
    };
  } catch {
    return {
      id: 'redis',
      name: 'Redis',
      description: 'Cache and queue for background jobs',
      status: 'not_installed',
      instructions: ['Run the setup script to create the Redis container'],
    };
  }
}

// Check BlueBubbles Server
async function checkBlueBubblesStatus(): Promise<ServiceStatus> {
  try {
    const bbUrl = process.env.BLUEBUBBLES_URL || 'http://localhost:1234';
    const response = await fetch(`${bbUrl}/api/v1/server/info`, {
      headers: {
        'Authorization': process.env.BLUEBUBBLES_PASSWORD || '',
      },
    });
    
    if (response.ok) {
      const data = await response.json() as { data?: { server_version?: string } };
      return {
        id: 'bluebubbles',
        name: 'BlueBubbles Server',
        description: 'Required for sending and receiving iMessages',
        status: 'running',
        version: data.data?.server_version,
      };
    }
    return {
      id: 'bluebubbles',
      name: 'BlueBubbles Server',
      description: 'Required for sending and receiving iMessages',
      status: 'stopped',
      instructions: ['Start BlueBubbles Server on your Mac'],
    };
  } catch {
    return {
      id: 'bluebubbles',
      name: 'BlueBubbles Server',
      description: 'Required for sending and receiving iMessages',
      status: 'stopped',
      instructions: [
        'Download BlueBubbles from https://bluebubbles.app',
        'Install and configure BlueBubbles Server',
        'Ensure it is running on the configured URL',
      ],
    };
  }
}

// Check API key configuration
function checkApiKeys(): ApiKeyStatus[] {
  const keys: ApiKeyStatus[] = [
    {
      id: 'anthropic',
      name: 'Anthropic API Key',
      description: 'Required for Claude AI responses',
      required: true,
      configured: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_api_key_here',
      masked: process.env.ANTHROPIC_API_KEY ? `sk-...${process.env.ANTHROPIC_API_KEY.slice(-4)}` : undefined,
      docsUrl: 'https://console.anthropic.com/settings/keys',
    },
    {
      id: 'bluebubbles_password',
      name: 'BlueBubbles Password',
      description: 'Required to authenticate with BlueBubbles Server',
      required: true,
      configured: !!process.env.BLUEBUBBLES_PASSWORD && process.env.BLUEBUBBLES_PASSWORD !== 'your_bluebubbles_password',
      masked: process.env.BLUEBUBBLES_PASSWORD ? '••••••••' : undefined,
      docsUrl: 'https://docs.bluebubbles.app',
    },
    {
      id: 'bluebubbles_url',
      name: 'BlueBubbles URL',
      description: 'URL where BlueBubbles Server is running',
      required: true,
      configured: !!process.env.BLUEBUBBLES_URL,
      masked: process.env.BLUEBUBBLES_URL,
      docsUrl: 'https://docs.bluebubbles.app',
    },
    {
      id: 'google_client_id',
      name: 'Google Client ID',
      description: 'Required for Gmail and Calendar integration',
      required: false,
      configured: !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id',
      masked: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.slice(0, 20)}...` : undefined,
      docsUrl: 'https://console.cloud.google.com/apis/credentials',
    },
    {
      id: 'google_client_secret',
      name: 'Google Client Secret',
      description: 'Required for Gmail and Calendar integration',
      required: false,
      configured: !!process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret',
      masked: process.env.GOOGLE_CLIENT_SECRET ? '••••••••' : undefined,
      docsUrl: 'https://console.cloud.google.com/apis/credentials',
    },
    {
      id: 'openai',
      name: 'OpenAI API Key',
      description: 'Optional: For Whisper audio transcription',
      required: false,
      configured: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key_here',
      masked: process.env.OPENAI_API_KEY ? `sk-...${process.env.OPENAI_API_KEY.slice(-4)}` : undefined,
      docsUrl: 'https://platform.openai.com/api-keys',
    },
    {
      id: 'agentmail',
      name: 'AgentMail API Key',
      description: 'Optional: For AI email capabilities',
      required: false,
      configured: !!process.env.AGENTMAIL_API_KEY && process.env.AGENTMAIL_API_KEY !== 'your_agentmail_api_key',
      masked: process.env.AGENTMAIL_API_KEY ? `am_...${process.env.AGENTMAIL_API_KEY.slice(-4)}` : undefined,
      docsUrl: 'https://console.agentmail.to',
    },
  ];
  
  return keys;
}

// Main handler to get all permissions and status
export async function getPermissionsStatus(req: Request, res: Response): Promise<void> {
  try {
    logDebug('Checking permissions and services status...');
    
    // Check all permissions in parallel
    const [contacts, automation, accessibility, fullDiskAccess] = await Promise.all([
      checkContactsPermission(),
      checkAutomationPermission(),
      checkAccessibilityPermission(),
      checkFullDiskAccess(),
    ]);
    
    // Check all services in parallel
    const [docker, postgres, redis, bluebubbles] = await Promise.all([
      checkDockerStatus(),
      checkPostgresStatus(),
      checkRedisStatus(),
      checkBlueBubblesStatus(),
    ]);
    
    // Check API keys
    const apiKeys = checkApiKeys();
    
    res.json({
      permissions: [contacts, automation, accessibility, fullDiskAccess],
      services: [docker, postgres, redis, bluebubbles],
      apiKeys,
    });
  } catch (error) {
    logError('Failed to get permissions status', error);
    res.status(500).json({ error: 'Failed to get permissions status' });
  }
}

// Open a specific settings panel
export async function openSettings(req: Request, res: Response): Promise<void> {
  try {
    const { settingsUrl } = req.body;
    
    if (!settingsUrl) {
      res.status(400).json({ error: 'settingsUrl is required' });
      return;
    }
    
    // Validate it's a valid macOS settings URL
    if (!settingsUrl.startsWith('x-apple.systempreferences:')) {
      res.status(400).json({ error: 'Invalid settings URL' });
      return;
    }
    
    await execAsync(`open "${settingsUrl}"`);
    res.json({ success: true });
  } catch (error) {
    logError('Failed to open settings', error);
    res.status(500).json({ error: 'Failed to open settings' });
  }
}

// Update an API key in the .env file
export async function updateApiKey(req: Request, res: Response): Promise<void> {
  try {
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
      res.status(400).json({ error: 'key and value are required' });
      return;
    }
    
    // Validate key name
    const validKeys = [
      'ANTHROPIC_API_KEY',
      'BLUEBUBBLES_URL',
      'BLUEBUBBLES_PASSWORD',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'OPENAI_API_KEY',
      'AGENTMAIL_API_KEY',
    ];
    
    if (!validKeys.includes(key)) {
      res.status(400).json({ error: 'Invalid key name' });
      return;
    }
    
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.join(__dirname, '../../.env');
    
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {
      // .env doesn't exist, create it
      envContent = '';
    }
    
    // Update or add the key
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // Update process.env for immediate effect
    process.env[key] = value;
    
    logInfo(`Updated API key: ${key}`);
    res.json({ success: true, message: 'API key updated. Restart the agent service for full effect.' });
  } catch (error) {
    logError('Failed to update API key', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
}
