import { EventEmitter } from 'events';
import { blueBubblesClient, BBMessage } from './BlueBubblesClient';
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
    blueBubblesClient.on('message', async (message: BBMessage) => {
      await this.handleIncomingMessage(message);
    });

    blueBubblesClient.on('connected', (info) => {
      log('info', 'Agent connected to BlueBubbles', { version: info.server_version });
      this.emit('status', { connected: true, info });
    });

    blueBubblesClient.on('disconnected', () => {
      log('info', 'Agent disconnected from BlueBubbles');
      this.emit('status', { connected: false });
    });

    blueBubblesClient.on('error', (error) => {
      log('error', 'BlueBubbles error', { error: error.message });
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

    // Start BlueBubbles polling
    await blueBubblesClient.startPolling(2000);

    this.isRunning = true;
    log('info', 'AI agent started successfully');
    this.emit('started');

    return true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    log('info', 'Stopping AI agent...');
    await blueBubblesClient.stopPolling();
    this.isRunning = false;
    this.emit('stopped');
    log('info', 'AI agent stopped');
  }

  private async handleIncomingMessage(message: BBMessage): Promise<void> {
    const chatGuid = message.chats?.[0]?.guid;
    const userHandle = message.handle?.address;

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

        // Load recent history from BlueBubbles
        const history = await blueBubblesClient.getConversationHistory(chatGuid, 10);
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

      // Send typing indicator
      await blueBubblesClient.sendTypingIndicator(chatGuid, true);

      // Generate AI response
      const response = await claudeService.generateResponse(
        message.text,
        context.messages.slice(0, -1) // Exclude the current message (it's passed separately)
      );

      // Stop typing indicator
      await blueBubblesClient.sendTypingIndicator(chatGuid, false);

      if (response && response.content) {
        // Send the response
        const sent = await blueBubblesClient.sendMessage(chatGuid, response.content);

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

      // Mark chat as read
      await blueBubblesClient.markChatRead(chatGuid);
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

      // Get or create user
      let user = db
        .prepare('SELECT id FROM users WHERE handle = ?')
        .get(userHandle) as { id: number } | undefined;

      if (!user) {
        const result = db
          .prepare('INSERT INTO users (handle, display_name) VALUES (?, ?)')
          .run(userHandle, userHandle);
        user = { id: result.lastInsertRowid as number };
      }

      // Get or create conversation
      let conversation = db
        .prepare('SELECT id FROM conversations WHERE chat_guid = ?')
        .get(chatGuid) as { id: number } | undefined;

      if (!conversation) {
        const result = db
          .prepare('INSERT INTO conversations (user_id, chat_guid) VALUES (?, ?)')
          .run(user.id, chatGuid);
        conversation = { id: result.lastInsertRowid as number };
      }

      // Save user message
      db.prepare(
        'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
      ).run(conversation.id, 'user', userMessage);

      // Save assistant response
      db.prepare(
        'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
      ).run(conversation.id, 'assistant', assistantResponse);
    } catch (error: any) {
      log('error', 'Failed to save message to database', { error: error.message });
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
      isConnected: blueBubblesClient.isConnected(),
      activeConversations: this.conversations.size,
      processingCount: this.processingQueue.size,
    };
  }

  // Manual message send (from dashboard)
  async sendManualMessage(chatGuid: string, text: string): Promise<boolean> {
    return blueBubblesClient.sendMessage(chatGuid, text);
  }
}

// Singleton instance
export const agentService = new AgentService();
