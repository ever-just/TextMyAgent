import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { SecureStorage } from '../../utils/secure-storage';
import { log } from '../routes/dashboard';

export interface BBMessage {
  guid: string;
  text: string;
  handle: {
    address: string;
    service: string;
  };
  isFromMe: boolean;
  dateCreated: number;
  chats: Array<{
    guid: string;
    chatIdentifier: string;
  }>;
  attachments?: Array<{
    guid: string;
    mimeType: string;
    transferName: string;
  }>;
}

export interface BBServerInfo {
  os_version: string;
  server_version: string;
  private_api: boolean;
  helper_connected: boolean;
  proxy_service: string;
}

export class BlueBubblesClient extends EventEmitter {
  private api: AxiosInstance | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastMessageDate: number = Date.now();
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    super();
  }

  private getCredentials() {
    const url = SecureStorage.getBlueBubblesUrl();
    const password = SecureStorage.getBlueBubblesPassword();
    return { url, password };
  }

  async connect(): Promise<boolean> {
    const { url, password } = this.getCredentials();

    if (!url || !password) {
      log('error', 'BlueBubbles credentials not configured');
      this.emit('error', new Error('BlueBubbles credentials not configured'));
      return false;
    }

    try {
      this.api = axios.create({
        baseURL: url,
        timeout: 30000,
        params: { password },
      });

      // Test connection
      const info = await this.getServerInfo();
      if (info) {
        log('info', 'Connected to BlueBubbles server', {
          version: info.server_version,
          privateApi: info.private_api,
        });
        this.emit('connected', info);
        this.reconnectAttempts = 0;
        return true;
      }

      return false;
    } catch (error: any) {
      log('error', 'Failed to connect to BlueBubbles', { error: error.message });
      this.emit('error', error);
      return false;
    }
  }

  async getServerInfo(): Promise<BBServerInfo | null> {
    if (!this.api) return null;

    try {
      const response = await this.api.get('/api/v1/server/info');
      return response.data.data;
    } catch (error) {
      return null;
    }
  }

  async startPolling(intervalMs = 2000): Promise<void> {
    if (this.isRunning) return;

    const connected = await this.connect();
    if (!connected) {
      // Try to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        log('warn', `BlueBubbles reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        setTimeout(() => this.startPolling(intervalMs), 5000);
      }
      return;
    }

    this.isRunning = true;
    this.lastMessageDate = Date.now();
    log('info', 'Started BlueBubbles message polling');

    this.pollInterval = setInterval(async () => {
      await this.pollMessages();
    }, intervalMs);

    // Initial poll
    await this.pollMessages();
  }

  async stopPolling(): Promise<void> {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    log('info', 'Stopped BlueBubbles message polling');
    this.emit('disconnected');
  }

  private async pollMessages(): Promise<void> {
    if (!this.api || !this.isRunning) return;

    try {
      const response = await this.api.get('/api/v1/message', {
        params: {
          after: this.lastMessageDate,
          limit: 50,
          sort: 'ASC',
          with: ['chat', 'handle', 'attachment'],
        },
      });

      const messages: BBMessage[] = response.data.data || [];

      for (const message of messages) {
        // Update last message date
        if (message.dateCreated > this.lastMessageDate) {
          this.lastMessageDate = message.dateCreated;
        }

        // Only process incoming messages (not from me)
        if (!message.isFromMe && message.text) {
          log('info', 'Received message', {
            from: message.handle?.address,
            preview: message.text.substring(0, 50),
          });
          this.emit('message', message);
        }
      }
    } catch (error: any) {
      log('error', 'Failed to poll messages', { error: error.message });
      this.emit('error', error);

      // Try to reconnect on error
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        await this.connect();
      }
    }
  }

  async sendMessage(chatGuid: string, text: string): Promise<boolean> {
    if (!this.api) {
      log('error', 'Cannot send message: not connected');
      return false;
    }

    try {
      const response = await this.api.post('/api/v1/message/text', {
        chatGuid,
        message: text,
        method: 'private-api', // Use private API if available
      });

      if (response.data.status === 200) {
        log('info', 'Message sent successfully', {
          chatGuid,
          preview: text.substring(0, 50),
        });
        return true;
      }

      log('warn', 'Message send returned non-200', { status: response.data.status });
      return false;
    } catch (error: any) {
      log('error', 'Failed to send message', { error: error.message, chatGuid });
      return false;
    }
  }

  async sendTypingIndicator(chatGuid: string, isTyping: boolean): Promise<void> {
    if (!this.api) return;

    try {
      await this.api.post('/api/v1/chat/typing', {
        chatGuid,
        isTyping,
      });
    } catch (error) {
      // Typing indicators are best-effort, don't log errors
    }
  }

  async markChatRead(chatGuid: string): Promise<void> {
    if (!this.api) return;

    try {
      await this.api.post('/api/v1/chat/read', {
        chatGuid,
      });
    } catch (error) {
      // Best effort
    }
  }

  async getConversationHistory(chatGuid: string, limit = 50): Promise<BBMessage[]> {
    if (!this.api) return [];

    try {
      const response = await this.api.get('/api/v1/message', {
        params: {
          chatGuid,
          limit,
          sort: 'DESC',
          with: ['handle'],
        },
      });

      return (response.data.data || []).reverse();
    } catch (error: any) {
      log('error', 'Failed to get conversation history', { error: error.message });
      return [];
    }
  }

  isConnected(): boolean {
    return this.isRunning && this.api !== null;
  }
}

// Singleton instance
export const blueBubblesClient = new BlueBubblesClient();
