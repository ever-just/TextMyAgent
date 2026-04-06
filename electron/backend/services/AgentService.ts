import { EventEmitter } from 'events';
import { iMessageService, IMessage } from './iMessageService';
import { claudeService, Message } from './ClaudeService';
import { log } from '../routes/dashboard';
import { getDatabase } from '../database';

interface ConversationContext {
  chatGuid: string;
  userHandle: string;
  messages: Message[];
  lastActivity: number;
}

export class AgentService extends EventEmitter {
  private isRunning = false;
  private conversations: Map<string, ConversationContext> = new Map();
  private processingQueue: Set<string> = new Set();
  private maxHistoryMessages = 20;

  constructor() {
    super();
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    iMessageService.on('message', async (message: IMessage) => {
      await this.handleIncomingMessage(message);
    });

    iMessageService.on('connected', () => {
      log('info', 'Agent connected to iMessage database');
      this.emit('status', { connected: true });
    });

    iMessageService.on('disconnected', () => {
      log('info', 'Agent disconnected from iMessage');
      this.emit('status', { connected: false });
    });

    iMessageService.on('error', (error) => {
      log('error', 'iMessage error', { error: error.message });
      this.emit('error', error);
    });
  }

  async start(): Promise<boolean> {
    if (this.isRunning) {
      log('warn', 'Agent is already running');
      return true;
    }

    log('info', 'Starting AI agent...');

    // Check if Claude is configured
    if (!claudeService.isConfigured()) {
      claudeService.refreshClient();
      if (!claudeService.isConfigured()) {
        log('error', 'Cannot start agent: Anthropic API key not configured');
        return false;
      }
    }

    // Check iMessage permissions
    const permissions = await iMessageService.checkPermissions();
    if (!permissions.hasAccess) {
      log('error', 'Cannot start agent: ' + permissions.error);
      return false;
    }

    // Start iMessage polling
    await iMessageService.startPolling(2000);

    this.isRunning = true;
    log('info', 'AI agent started successfully');
    this.emit('started');

    return true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    log('info', 'Stopping AI agent...');
    await iMessageService.stopPolling();
    this.isRunning = false;
    this.emit('stopped');
    log('info', 'AI agent stopped');
  }

  private async handleIncomingMessage(message: IMessage): Promise<void> {
    const chatGuid = message.chatGuid;
    const userHandle = message.handleId;

    if (!chatGuid || !userHandle) {
      log('warn', 'Message missing chat or handle info', { guid: message.guid });
      return;
    }

    // Prevent duplicate processing
    if (this.processingQueue.has(message.guid)) {
      return;
    }
    this.processingQueue.add(message.guid);

    try {
      log('info', 'Processing message', {
        from: userHandle,
        chatGuid,
        preview: message.text.substring(0, 50),
      });

      // Get or create conversation context
      let context = this.conversations.get(chatGuid);
      if (!context) {
        context = {
          chatGuid,
          userHandle,
          messages: [],
          lastActivity: Date.now(),
        };
        this.conversations.set(chatGuid, context);

        // Load recent history from iMessage
        const history = await iMessageService.getConversationHistory(chatGuid, 10);
        for (const msg of history) {
          if (msg.guid !== message.guid) {
            context.messages.push({
              role: msg.isFromMe ? 'assistant' : 'user',
              content: msg.text || '',
            });
          }
        }
      }

      // Add user message to context
      context.messages.push({
        role: 'user',
        content: message.text,
      });
      context.lastActivity = Date.now();

      // Trim history if too long
      if (context.messages.length > this.maxHistoryMessages) {
        context.messages = context.messages.slice(-this.maxHistoryMessages);
      }

      // Note: Typing indicators require Private API which we don't have
      // Skipping typing indicator

      // Generate AI response
      const response = await claudeService.generateResponse(
        message.text,
        context.messages.slice(0, -1) // Exclude the current message (it's passed separately)
      );

      // Typing indicator skipped

      if (response && response.content) {
        // Send the response
        const sent = await iMessageService.sendMessage(chatGuid, response.content);

        if (sent) {
          // Add assistant response to context
          context.messages.push({
            role: 'assistant',
            content: response.content,
          });

          // Save to database
          this.saveMessageToDb(chatGuid, userHandle, message.text, response.content);

          log('info', 'Response sent', {
            to: userHandle,
            preview: response.content.substring(0, 50),
            tokens: response.inputTokens + response.outputTokens,
          });

          this.emit('messageSent', {
            chatGuid,
            userHandle,
            userMessage: message.text,
            assistantResponse: response.content,
          });
        } else {
          log('error', 'Failed to send response');
        }
      } else {
        log('error', 'No response generated from Claude');
      }

      // Note: Mark as read requires Private API, skipping
    } catch (error: any) {
      log('error', 'Error processing message', { error: error.message });
      this.emit('error', error);
    } finally {
      this.processingQueue.delete(message.guid);
    }
  }

  private saveMessageToDb(
    chatGuid: string,
    userHandle: string,
    userMessage: string,
    assistantResponse: string
  ): void {
    try {
      const db = getDatabase();
      const crypto = require('crypto');

      // Get or create user (id is TEXT, so we need to generate a UUID)
      let user = db
        .prepare('SELECT id FROM users WHERE handle = ?')
        .get(userHandle) as { id: string } | undefined;

      if (!user) {
        const userId = crypto.randomUUID();
        log('info', 'Creating new user', { userId, handle: userHandle });
        try {
          db.prepare('INSERT INTO users (id, handle, display_name) VALUES (?, ?, ?)')
            .run(userId, userHandle, userHandle);
          user = { id: userId };
        } catch (insertError: any) {
          log('error', 'Failed to create user', { error: insertError.message });
          // Try to fetch again in case of race condition
          user = db
            .prepare('SELECT id FROM users WHERE handle = ?')
            .get(userHandle) as { id: string } | undefined;
        }
      }

      if (!user || !user.id) {
        log('error', 'Could not get or create user', { handle: userHandle });
        return;
      }

      // Get or create conversation - check by chat_guid first
      let conversation = db
        .prepare('SELECT id, user_id FROM conversations WHERE chat_guid = ?')
        .get(chatGuid) as { id: string; user_id: string } | undefined;

      if (!conversation) {
        const conversationId = crypto.randomUUID();
        log('info', 'Creating new conversation', { conversationId, chatGuid, userId: user.id });
        db.prepare('INSERT INTO conversations (id, user_id, chat_guid) VALUES (?, ?, ?)')
          .run(conversationId, user.id, chatGuid);
        conversation = { id: conversationId, user_id: user.id };
      } else if (!conversation.user_id) {
        // Fix existing conversation with missing user_id
        log('info', 'Fixing conversation with missing user_id', { conversationId: conversation.id, userId: user.id });
        db.prepare('UPDATE conversations SET user_id = ? WHERE id = ?')
          .run(user.id, conversation.id);
      }

      // Save user message
      const userMsgId = crypto.randomUUID();
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
      ).run(userMsgId, conversation.id, 'user', userMessage);

      // Save assistant response
      const assistantMsgId = crypto.randomUUID();
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
      ).run(assistantMsgId, conversation.id, 'assistant', assistantResponse);
      
      log('info', 'Messages saved to database', { conversationId: conversation.id });
    } catch (error: any) {
      log('error', 'Failed to save message to database', { error: error.message, stack: error.stack });
    }
  }

  getStatus(): {
    isRunning: boolean;
    isConnected: boolean;
    activeConversations: number;
    processingCount: number;
  } {
    return {
      isRunning: this.isRunning,
      isConnected: iMessageService.isConnected(),
      activeConversations: this.conversations.size,
      processingCount: this.processingQueue.size,
    };
  }

  // Manual message send (from dashboard)
  async sendManualMessage(chatGuid: string, text: string): Promise<boolean> {
    return iMessageService.sendMessage(chatGuid, text);
  }

  // Check iMessage permissions
  async checkPermissions(): Promise<{ hasAccess: boolean; error?: string }> {
    return iMessageService.checkPermissions();
  }
}

// Singleton instance
export const agentService = new AgentService();
