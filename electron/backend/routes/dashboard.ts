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
  const entry = { timestamp: new Date().toISOString(), level, message, metadata };
  logBuffer.add(entry);
  console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
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
    // These would need native module integration for actual checks
    // For now, return placeholder status
    res.json({
      contacts: { status: 'unknown', description: 'Check System Preferences' },
      automation: { status: 'unknown', description: 'Check System Preferences' },
      accessibility: { status: 'unknown', description: 'Check System Preferences' },
      fullDiskAccess: { status: 'unknown', description: 'Check System Preferences' },
    });
  } catch (error) {
    log('error', 'Get permissions failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

// --- Setup/Onboarding ---
router.get('/setup/status', async (_req: Request, res: Response) => {
  try {
    const isConfigured = SecureStorage.isConfigured();
    const hasApiKey = !!SecureStorage.getAnthropicApiKey();
    const hasBlueBubbles =
      !!SecureStorage.getBlueBubblesUrl() && !!SecureStorage.getBlueBubblesPassword();

    res.json({
      isConfigured,
      steps: {
        apiKey: hasApiKey,
        bluebubbles: hasBlueBubbles,
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
    const { anthropicApiKey, blueBubblesUrl, blueBubblesPassword } = req.body;

    if (anthropicApiKey) {
      SecureStorage.setAnthropicApiKey(anthropicApiKey);
      log('info', 'Anthropic API key saved');
    }

    if (blueBubblesUrl) {
      SecureStorage.setBlueBubblesUrl(blueBubblesUrl);
      log('info', 'BlueBubbles URL saved');
    }

    if (blueBubblesPassword) {
      SecureStorage.setBlueBubblesPassword(blueBubblesPassword);
      log('info', 'BlueBubbles password saved');
    }

    res.json({
      success: true,
      isConfigured: SecureStorage.isConfigured(),
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
        error: 'Failed to start agent. Check that BlueBubbles and Anthropic are configured.' 
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
