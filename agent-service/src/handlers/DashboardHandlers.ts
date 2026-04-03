import { Request, Response } from 'express';
import { AppDataSource } from '../database/connection';
import { User } from '../database/entities/User';
import { Conversation } from '../database/entities/Conversation';
import { Message } from '../database/entities/Message';
import { config } from '../config';
import { logInfo, logError
 } from '../utils/logger';
import { BlueBubblesClient } from '../integrations/BlueBubblesClient';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// In-memory log buffer for dashboard
interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  metadata?: Record<string, any>;
  source?: string;
}

class LogBuffer {
  private logs: LogEntry[] = [];
  private maxSize = 1000;

  add(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxSize) {
      this.logs.shift();
    }
  }

  query(filters: { level?: string; search?: string; limit?: number }): LogEntry[] {
    let result = [...this.logs];

    if (filters.level && filters.level !== 'all') {
      result = result.filter(log => log.level === filters.level);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.metadata || {}).toLowerCase().includes(searchLower)
      );
    }

    result.reverse(); // Most recent first

    if (filters.limit) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  clear() {
    this.logs = [];
  }
}

export const logBuffer = new LogBuffer();

// Add some sample logs for testing
logBuffer.add({ timestamp: new Date().toISOString(), level: 'info', message: 'Dashboard API initialized', source: 'DashboardHandlers' });

// --- Service Status ---
export async function getDashboardStatus(req: Request, res: Response) {
  try {
    const dbHealthy = AppDataSource.isInitialized;

    // Check Redis
    let redisHealthy = false;
    try {
      const Bull = require('bull');
      const queue = new Bull('health-check', {
        redis: {
          port: 6379,
          host: new URL(config.redis.url).hostname,
          password: new URL(config.redis.url).password
        }
      });
      await queue.isReady();
      await queue.close();
      redisHealthy = true;
    } catch (e) {
      redisHealthy = false;
    }

    // Check BlueBubbles
    let bbHealthy = false;
    try {
      const axios = require('axios');
      const response = await axios.get(
        `${config.bluebubbles.url}/api/v1/server/info?password=${config.bluebubbles.password}`,
        { timeout: 5000 }
      );
      bbHealthy = response.status === 200;
    } catch (e) {
      bbHealthy = false;
    }

    res.json({
      agent: {
        status: 'online',
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed,
        cpu: process.cpuUsage().user / 1000000,
      },
      database: {
        status: dbHealthy ? 'online' : 'offline',
        connections: AppDataSource.isInitialized ? 1 : 0,
      },
      redis: {
        status: redisHealthy ? 'online' : 'offline',
      },
      bluebubbles: {
        status: bbHealthy ? 'online' : 'offline',
      },
    });
  } catch (error) {
    logError('Dashboard status check failed', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
}

// --- Configuration ---
export async function getConfig(req: Request, res: Response) {
  try {
    // Return sanitized config (no secrets)
    res.json({
      anthropic: {
        model: config.anthropic.model,
        temperature: config.anthropic.temperature,
        responseMaxTokens: config.anthropic.responseMaxTokens,
        contextWindowTokens: config.anthropic.contextWindowTokens,
        summaryTriggerTokens: config.anthropic.summaryTriggerTokens,
        enableWebSearch: config.anthropic.enableWebSearch,
        webSearchMaxUses: config.anthropic.webSearchMaxUses,
      },
      messaging: {
        typingIndicators: config.messaging.typingIndicators,
        maxResponseBurst: config.messaging.maxResponseBurst,
      },
      agents: {
        enableDualAgent: config.agents.enableDualAgent,
        executionTimeoutSeconds: config.agents.executionTimeoutSeconds,
        maxToolIterations: config.agents.maxToolIterations,
      },
      bluebubbles: {
        sendEnabled: config.bluebubbles.sendEnabled,
        markChatsRead: config.bluebubbles.markChatsRead,
      },
    });
  } catch (error) {
    logError('Failed to get config', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
}

export async function updateConfig(req: Request, res: Response) {
  try {
    const updates = req.body;
    const envPath = path.join(__dirname, '../../.env');

    // Read existing .env file
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const existing = dotenv.parse(envContent);

    // Map config updates to env vars
    const envUpdates: Record<string, string> = {};

    if (updates.anthropic) {
      if (updates.anthropic.model) envUpdates['ANTHROPIC_MODEL'] = updates.anthropic.model;
      if (updates.anthropic.temperature !== undefined) envUpdates['ANTHROPIC_TEMPERATURE'] = updates.anthropic.temperature.toString();
      if (updates.anthropic.responseMaxTokens) envUpdates['ANTHROPIC_RESPONSE_MAX_TOKENS'] = updates.anthropic.responseMaxTokens.toString();
      if (updates.anthropic.contextWindowTokens) envUpdates['ANTHROPIC_CONTEXT_WINDOW_TOKENS'] = updates.anthropic.contextWindowTokens.toString();
      if (updates.anthropic.summaryTriggerTokens) envUpdates['ANTHROPIC_SUMMARY_TRIGGER_TOKENS'] = updates.anthropic.summaryTriggerTokens.toString();
      if (updates.anthropic.enableWebSearch !== undefined) envUpdates['ANTHROPIC_ENABLE_WEB_SEARCH'] = updates.anthropic.enableWebSearch.toString();
    }

    if (updates.messaging) {
      if (updates.messaging.typingIndicators !== undefined) envUpdates['TYPING_INDICATORS_ENABLED'] = updates.messaging.typingIndicators.toString();
      if (updates.messaging.maxResponseBurst) envUpdates['MAX_RESPONSE_BURST'] = updates.messaging.maxResponseBurst.toString();
    }

    if (updates.agents) {
      if (updates.agents.enableDualAgent !== undefined) envUpdates['ENABLE_DUAL_AGENT'] = updates.agents.enableDualAgent.toString();
      if (updates.agents.executionTimeoutSeconds) envUpdates['AGENT_EXECUTION_TIMEOUT_SECONDS'] = updates.agents.executionTimeoutSeconds.toString();
      if (updates.agents.maxToolIterations) envUpdates['AGENT_MAX_TOOL_ITERATIONS'] = updates.agents.maxToolIterations.toString();
    }

    if (updates.bluebubbles) {
      if (updates.bluebubbles.sendEnabled !== undefined) envUpdates['BLUEBUBBLES_SEND_ENABLED'] = updates.bluebubbles.sendEnabled.toString();
      if (updates.bluebubbles.markChatsRead !== undefined) envUpdates['BLUEBUBBLES_MARK_CHATS_READ'] = updates.bluebubbles.markChatsRead.toString();
    }

    // Merge and write
    const merged = { ...existing, ...envUpdates };
    const newContent = Object.entries(merged)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    fs.writeFileSync(envPath, newContent);

    logInfo('Configuration updated via dashboard', { updates: Object.keys(envUpdates) });
    res.json({ success: true, message: 'Configuration saved. Restart to apply.' });
  } catch (error) {
    logError('Failed to update config', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
}

// --- Logs ---
export async function getLogs(req: Request, res: Response) {
  try {
    const level = req.query.level as string | undefined;
    const search = req.query.q as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = logBuffer.query({ level, search, limit });
    res.json(logs);
  } catch (error) {
    logError('Failed to get logs', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
}

// --- Users ---
export async function getUsers(req: Request, res: Response) {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      order: { updatedAt: 'DESC' },
      take: 100,
    });

    // Get message counts
    const messageRepo = AppDataSource.getRepository(Message);
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        const messageCount = await messageRepo.count({ where: { userId: user.id } });
        const lastMessage = await messageRepo.findOne({
          where: { userId: user.id },
          order: { createdAt: 'DESC' },
        });

        return {
          id: user.id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          createdAt: user.createdAt,
          lastMessageAt: lastMessage?.createdAt,
          messageCount,
          isActive: user.isActive,
        };
      })
    );

    res.json(usersWithCounts);
  } catch (error) {
    logError('Failed to get users', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
}

// --- Usage ---
export async function getUsage(req: Request, res: Response) {
  try {
    // For now, return placeholder data
    // TODO: Implement actual usage tracking with ApiUsage entity
    res.json({
      today: {
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        costUsd: 0,
      },
      thisWeek: {
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        costUsd: 0,
      },
      thisMonth: {
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
        costUsd: 0,
      },
    });
  } catch (error) {
    logError('Failed to get usage', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
}

// --- Send Message ---
export async function sendMessage(req: Request, res: Response) {
  try {
    const { recipient, message, asAgent } = req.body;

    if (!recipient || !message) {
      return res.status(400).json({ error: 'Recipient and message are required' });
    }

    const bbClient = new BlueBubblesClient();
    await bbClient.connect();

    // Find or construct chat GUID
    let chatGuid = await bbClient.findChatGuidByHandle(recipient);
    if (!chatGuid) {
      chatGuid = `iMessage;-;${recipient}`;
    }

    if (asAgent) {
      // TODO: Route through AI for response generation
      // For now, just send directly
      await bbClient.sendMessage(chatGuid, message);
    } else {
      await bbClient.sendMessage(chatGuid, message);
    }

    logInfo('Sent outbound message via dashboard', { recipient, asAgent });
    res.json({ success: true, chatGuid });
  } catch (error) {
    logError('Failed to send message', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}
