import { Router, Request, Response } from 'express';
import { getDatabase, getSetting, setSetting } from '../database';
import { SecureStorage } from '../../utils/secure-storage';
import { agentService } from '../services/AgentService';
import { iMessageService } from '../services/iMessageService';
import { claudeService } from '../services/ClaudeService';

// Lazy import electron to avoid initialization issues
const getElectronApp = () => {
  try {
    return require('electron').app;
  } catch {
    return null;
  }
};

const router = Router();

// In-memory log buffer
interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

class LogBuffer {
  private logs: LogEntry[] = [];
  private maxSize = 500;

  add(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxSize) {
      this.logs.shift();
    }
  }

  query(filters: { level?: string; search?: string; limit?: number }): LogEntry[] {
    let result = [...this.logs];

    if (filters.level && filters.level !== 'all') {
      result = result.filter((log) => log.level === filters.level);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.metadata || {}).toLowerCase().includes(searchLower)
      );
    }

    result.reverse();

    if (filters.limit) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }
}

export const logBuffer = new LogBuffer();

// Log helper
export function log(
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  metadata?: Record<string, any>
) {
  const entry: LogEntry = { timestamp: new Date().toISOString(), level, message, metadata };
  logBuffer.add(entry);
  console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
  
  // Broadcast to SSE subscribers (delayed import to avoid circular dependency)
  setTimeout(() => {
    try {
      const subscribers = (global as any).__logSubscribers as Set<Response> | undefined;
      if (subscribers && subscribers.size > 0) {
        const msg = `data: ${JSON.stringify(entry)}\n\n`;
        subscribers.forEach((client) => {
          try {
            client.write(msg);
          } catch {
            subscribers.delete(client);
          }
        });
      }
    } catch {}
  }, 0);
}

// --- Status ---
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    // Check iMessage access
    const imessageStatus = await iMessageService.checkPermissions();

    const electronApp = getElectronApp();
    res.json({
      agent: {
        status: 'online',
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed,
        version: electronApp?.getVersion() || '1.6.0',
        isPackaged: electronApp?.isPackaged || false,
      },
      database: {
        status: db ? 'online' : 'offline',
        type: 'sqlite',
      },
      redis: {
        status: 'n/a', // Not used in desktop mode
        note: 'Desktop uses in-memory scheduling',
      },
      imessage: {
        status: imessageStatus.hasAccess ? 'online' : 'offline',
        configured: imessageStatus.hasAccess,
        error: imessageStatus.error,
      },
      configured: SecureStorage.hasAnthropicKey() && imessageStatus.hasAccess,
    });
  } catch (error) {
    log('error', 'Status check failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// --- Configuration ---
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    // Get settings from SQLite
    const getSettingValue = (key: string, defaultValue: any) => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      if (!row) return defaultValue;
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    };

    const imessageStatus = await iMessageService.checkPermissions();
    
    res.json({
      anthropic: {
        model: getSettingValue('anthropic.model', 'claude-3-5-haiku-latest'),
        temperature: getSettingValue('anthropic.temperature', 0.7),
        responseMaxTokens: getSettingValue('anthropic.responseMaxTokens', 350),
        contextWindowTokens: getSettingValue('anthropic.contextWindowTokens', 7000),
        enableWebSearch: getSettingValue('anthropic.enableWebSearch', true),
        hasApiKey: !!SecureStorage.getAnthropicApiKey(),
      },
      imessage: {
        configured: imessageStatus.hasAccess,
        sendEnabled: getSettingValue('imessage.sendEnabled', true),
        error: imessageStatus.error,
      },
      app: {
        version: getElectronApp()?.getVersion() || '1.6.0',
        platform: process.platform,
        arch: process.arch,
      },
    });
  } catch (error) {
    log('error', 'Get config failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get config' });
  }
});

router.put('/config', async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // Update settings in SQLite
    for (const [key, value] of Object.entries(updates)) {
      setSetting(key, JSON.stringify(value));
    }

    log('info', 'Configuration updated', { keys: Object.keys(updates) });
    res.json({ success: true });
  } catch (error) {
    log('error', 'Update config failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// --- Logs ---
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { level, search, limit } = req.query;
    const logs = logBuffer.query({
      level: level as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : 100,
    });
    res.json({ logs });
  } catch (error) {
    log('error', 'Get logs failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// --- Log Stream (SSE) ---
const logSubscribers: Set<Response> = new Set();
(global as any).__logSubscribers = logSubscribers;

router.get('/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
  
  logSubscribers.add(res);
  log('info', 'Log stream client connected', { clients: logSubscribers.size });
  
  req.on('close', () => {
    logSubscribers.delete(res);
    log('info', 'Log stream client disconnected', { clients: logSubscribers.size });
  });
});

// Broadcast log to all subscribers
export function broadcastLog(entry: LogEntry) {
  const message = `data: ${JSON.stringify(entry)}\n\n`;
  logSubscribers.forEach((client) => {
    try {
      client.write(message);
    } catch {
      logSubscribers.delete(client);
    }
  });
}

// --- Users ---
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const users = db
      .prepare(
        `
      SELECT 
        u.id,
        u.handle,
        u.display_name as displayName,
        u.is_blocked as isBlocked,
        u.created_at as createdAt,
        (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) as conversationCount,
        (SELECT MAX(m.created_at) FROM messages m 
         JOIN conversations c ON m.conversation_id = c.id 
         WHERE c.user_id = u.id) as lastMessageAt
      FROM users u
      ORDER BY lastMessageAt DESC NULLS LAST
      LIMIT 100
    `
      )
      .all();

    res.json({ users });
  } catch (error) {
    log('error', 'Get users failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// --- Usage ---
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { period = 'day' } = req.query;

    let dateFormat: string;
    switch (period) {
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'week':
        dateFormat = '%Y-%W';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const usage = db
      .prepare(
        `
      SELECT 
        strftime('${dateFormat}', date) as period,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(total_tokens) as totalTokens,
        SUM(request_count) as requestCount
      FROM api_usage
      GROUP BY strftime('${dateFormat}', date)
      ORDER BY period DESC
      LIMIT 30
    `
      )
      .all();

    // Get totals
    const totals = db
      .prepare(
        `
      SELECT 
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(total_tokens) as totalTokens,
        SUM(request_count) as requestCount
      FROM api_usage
    `
      )
      .get() as any;

    res.json({
      usage,
      totals: totals || { inputTokens: 0, outputTokens: 0, totalTokens: 0, requestCount: 0 },
    });
  } catch (error) {
    log('error', 'Get usage failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

// --- Messages ---
router.get('/messages/all', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { limit = 50, offset = 0 } = req.query;

    const messages = db
      .prepare(
        `
      SELECT 
        m.id,
        m.role,
        m.content,
        m.created_at as createdAt,
        c.id as conversationId,
        u.handle as userHandle,
        u.display_name as userDisplayName
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON c.user_id = u.id
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(parseInt(limit as string, 10), parseInt(offset as string, 10));

    res.json({ messages });
  } catch (error) {
    log('error', 'Get messages failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.get('/users/:userId/messages', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const messages = db
      .prepare(
        `
      SELECT 
        m.id,
        m.role,
        m.content,
        m.created_at as createdAt,
        c.id as conversationId
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `
      )
      .all(userId, parseInt(limit as string, 10));

    res.json({ messages });
  } catch (error) {
    log('error', 'Get user messages failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get user messages' });
  }
});

// --- Permissions (macOS specific) ---
router.get('/permissions', async (_req: Request, res: Response) => {
  try {
    const { permissionService } = await import('../services/PermissionService');
    const permissionsResult = await permissionService.checkAllPermissions();

    res.json({
      allGranted: permissionsResult.allGranted,
      requiredGranted: permissionsResult.requiredGranted,
      permissions: permissionsResult.permissions.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        required: p.required,
        settingsUrl: p.settingsUrl,
        instructions: p.instructions,
      })),
      services: [
        {
          id: 'imessage',
          name: 'iMessage',
          description: 'Native macOS Messages integration',
          status: permissionsResult.permissions.find(p => p.id === 'full_disk_access')?.status === 'granted' ? 'running' : 'stopped',
          version: 'Native',
        },
        {
          id: 'database',
          name: 'SQLite Database',
          description: 'Local data storage',
          status: 'running',
        },
      ],
      apiKeys: [
        {
          id: 'anthropic',
          name: 'Anthropic API Key',
          description: 'Required for Claude AI responses',
          required: true,
          configured: !!SecureStorage.getAnthropicApiKey(),
          masked: SecureStorage.getAnthropicApiKey() ? 'sk-ant-••••••••' : undefined,
          docsUrl: 'https://console.anthropic.com/settings/keys',
        },
      ],
    });
  } catch (error) {
    log('error', 'Get permissions failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

// --- Settings API Key ---
router.post('/settings/api-key', async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    
    if (key === 'ANTHROPIC_API_KEY') {
      SecureStorage.setAnthropicApiKey(value);
      log('info', 'Anthropic API key updated');
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Unknown key' });
    }
  } catch (error) {
    log('error', 'Save API key failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// --- Settings Open (macOS) ---
router.post('/settings/open', async (req: Request, res: Response) => {
  try {
    const { settingsUrl } = req.body;
    if (settingsUrl) {
      const { exec } = require('child_process');
      exec(`open "${settingsUrl}"`);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'settingsUrl required' });
    }
  } catch (error) {
    log('error', 'Open settings failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to open settings' });
  }
});

// --- Contacts ---
router.post('/contacts/import', async (_req: Request, res: Response) => {
  try {
    // Try to use node-mac-contacts if available
    let contacts: any[] = [];
    try {
      const macContacts = require('node-mac-contacts');
      const authStatus = macContacts.getAuthStatus();
      
      if (authStatus === 'Authorized') {
        contacts = macContacts.getAllContacts() || [];
        res.json(contacts.map((c: any) => ({
          id: c.identifier || String(Math.random()),
          firstName: c.givenName || '',
          lastName: c.familyName || '',
          phoneNumbers: c.phoneNumbers || [],
          emailAddresses: c.emailAddresses || [],
          organization: c.organizationName,
        })));
      } else {
        res.json({ authStatus, error: 'Contacts permission not granted' });
      }
    } catch (e: any) {
      log('warn', 'node-mac-contacts not available', { error: e.message });
      res.json({ error: 'Contacts import not available', contacts: [] });
    }
  } catch (error) {
    log('error', 'Import contacts failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

router.post('/contacts/open-settings', async (_req: Request, res: Response) => {
  try {
    const { permissionService } = await import('../services/PermissionService');
    await permissionService.openContactsSettings();
    res.json({ success: true });
  } catch (error) {
    log('error', 'Open contacts settings failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to open settings' });
  }
});

// Request Contacts permission (triggers system prompt)
router.post('/contacts/request-permission', async (_req: Request, res: Response) => {
  try {
    const { permissionService } = await import('../services/PermissionService');
    const granted = await permissionService.requestContactsPermission();
    const status = await permissionService.checkContactsPermission();
    res.json({ 
      success: granted, 
      status: status.status,
      needsSettings: status.status === 'denied'
    });
  } catch (error: any) {
    log('error', 'Request contacts permission failed', { error: error.message });
    res.status(500).json({ error: 'Failed to request permission' });
  }
});

// Request Automation permission (triggers system prompt)
router.post('/permissions/request-automation', async (_req: Request, res: Response) => {
  try {
    const { permissionService } = await import('../services/PermissionService');
    const granted = await permissionService.requestAutomationPermission();
    const status = await permissionService.checkAutomationPermission();
    res.json({ 
      success: granted, 
      status: status.status,
      needsSettings: status.status === 'denied'
    });
  } catch (error: any) {
    log('error', 'Request automation permission failed', { error: error.message });
    res.status(500).json({ error: 'Failed to request permission' });
  }
});

// Open specific permission settings
router.post('/permissions/open-settings', async (req: Request, res: Response) => {
  try {
    const { permissionId } = req.body;
    const { permissionService } = await import('../services/PermissionService');
    
    switch (permissionId) {
      case 'full_disk_access':
        await permissionService.openFullDiskAccessSettings();
        break;
      case 'automation':
        await permissionService.openAutomationSettings();
        break;
      case 'contacts':
        await permissionService.openContactsSettings();
        break;
      default:
        return res.status(400).json({ error: 'Unknown permission ID' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    log('error', 'Open permission settings failed', { error: error.message });
    res.status(500).json({ error: 'Failed to open settings' });
  }
});

// Check if first launch / needs onboarding
router.get('/permissions/needs-setup', async (_req: Request, res: Response) => {
  try {
    const { permissionService } = await import('../services/PermissionService');
    const isFirstLaunch = await permissionService.isFirstLaunch();
    const missingPermissions = await permissionService.getMissingRequiredPermissions();
    
    res.json({
      needsSetup: isFirstLaunch || missingPermissions.length > 0,
      isFirstLaunch,
      missingPermissions: missingPermissions.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        instructions: p.instructions,
      })),
    });
  } catch (error: any) {
    log('error', 'Check permissions setup failed', { error: error.message });
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});

// --- Setup/Onboarding ---
router.get('/setup/status', async (_req: Request, res: Response) => {
  try {
    const { permissionService } = await import('../services/PermissionService');
    const hasApiKey = SecureStorage.hasAnthropicKey();
    const permissionsResult = await permissionService.checkAllPermissions();
    const fullDiskAccess = permissionsResult.permissions.find(p => p.id === 'full_disk_access');
    const automation = permissionsResult.permissions.find(p => p.id === 'automation');
    const contacts = permissionsResult.permissions.find(p => p.id === 'contacts');
    
    const isConfigured = hasApiKey && permissionsResult.requiredGranted;

    res.json({
      isConfigured,
      steps: {
        apiKey: hasApiKey,
        fullDiskAccess: fullDiskAccess?.status === 'granted',
        automation: automation?.status === 'granted',
        contacts: contacts?.status === 'granted',
      },
      permissions: {
        allGranted: permissionsResult.allGranted,
        requiredGranted: permissionsResult.requiredGranted,
        details: permissionsResult.permissions,
      },
      needsSetup: !isConfigured,
    });
  } catch (error) {
    log('error', 'Get setup status failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get setup status' });
  }
});

router.post('/setup/credentials', async (req: Request, res: Response) => {
  try {
    const { anthropicApiKey } = req.body;

    if (anthropicApiKey) {
      SecureStorage.setAnthropicApiKey(anthropicApiKey);
      log('info', 'Anthropic API key saved');
    }

    // Check full configuration status (API key + iMessage access)
    const imessageStatus = await iMessageService.checkPermissions();
    const isFullyConfigured = SecureStorage.hasAnthropicKey() && imessageStatus.hasAccess;

    res.json({
      success: true,
      isConfigured: isFullyConfigured,
      details: {
        apiKey: SecureStorage.hasAnthropicKey(),
        imessage: imessageStatus.hasAccess,
      },
    });
  } catch (error) {
    log('error', 'Save credentials failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

// Test iMessage access (replaces BlueBubbles test)
router.post('/setup/test-imessage', async (_req: Request, res: Response) => {
  try {
    const permissions = await iMessageService.checkPermissions();
    
    if (permissions.hasAccess) {
      res.json({ success: true, message: 'iMessage access granted' });
    } else {
      res.json({ success: false, error: permissions.error });
    }
  } catch (error: any) {
    log('warn', 'iMessage test failed', { error: error.message });
    res.json({ success: false, error: error.message });
  }
});

router.post('/setup/test-anthropic', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    const testKey = apiKey || SecureStorage.getAnthropicApiKey();

    if (!testKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    // Simple validation - check if key format is correct
    if (!testKey.startsWith('sk-ant-')) {
      return res.json({ success: false, error: 'Invalid API key format' });
    }

    // Could do a real API test here, but for now just validate format
    res.json({ success: true });
  } catch (error: any) {
    log('warn', 'Anthropic test failed', { error: error.message });
    res.json({ success: false, error: error.message });
  }
});

// --- Agent Control ---
router.get('/agent/status', async (_req: Request, res: Response) => {
  try {
    const status = agentService.getStatus();
    res.json(status);
  } catch (error: any) {
    log('error', 'Get agent status failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

router.post('/agent/start', async (_req: Request, res: Response) => {
  try {
    // Refresh Claude client with latest API key
    claudeService.refreshClient();
    
    const started = await agentService.start();
    if (started) {
      log('info', 'Agent started via dashboard');
      res.json({ success: true, message: 'Agent started' });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Failed to start agent. Check that Anthropic API key is configured and Full Disk Access is granted.' 
      });
    }
  } catch (error: any) {
    log('error', 'Start agent failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/stop', async (_req: Request, res: Response) => {
  try {
    await agentService.stop();
    log('info', 'Agent stopped via dashboard');
    res.json({ success: true, message: 'Agent stopped' });
  } catch (error: any) {
    log('error', 'Stop agent failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/agent/restart', async (_req: Request, res: Response) => {
  try {
    await agentService.stop();
    claudeService.refreshClient();
    const started = await agentService.start();
    if (started) {
      log('info', 'Agent restarted via dashboard');
      res.json({ success: true, message: 'Agent restarted' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to restart agent' });
    }
  } catch (error: any) {
    log('error', 'Restart agent failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// --- Send Message (manual from dashboard) ---
router.post('/messages/send', async (req: Request, res: Response) => {
  try {
    const { chatGuid, message } = req.body;
    
    if (!chatGuid || !message) {
      return res.status(400).json({ error: 'chatGuid and message required' });
    }
    
    const sent = await iMessageService.sendMessage(chatGuid, message);
    if (sent) {
      log('info', 'Manual message sent', { chatGuid, preview: message.substring(0, 50) });
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  } catch (error: any) {
    log('error', 'Send message failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
