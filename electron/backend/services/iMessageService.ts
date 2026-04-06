import { EventEmitter } from 'events';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { log } from '../routes/dashboard';

const execAsync = promisify(exec);

// iMessage database path
const IMESSAGE_DB_PATH = path.join(os.homedir(), 'Library/Messages/chat.db');

// Date conversion: macOS uses 2001-01-01 as epoch
const APPLE_EPOCH = new Date('2001-01-01T00:00:00Z').getTime();

function appleTimeToDate(appleTime: number): Date {
  // Apple stores time in nanoseconds since 2001-01-01
  return new Date(APPLE_EPOCH + appleTime / 1000000);
}

function dateToAppleTime(date: Date): number {
  return (date.getTime() - APPLE_EPOCH) * 1000000;
}

export interface IMessage {
  guid: string;
  text: string;
  isFromMe: boolean;
  dateCreated: Date;
  handleId: string;
  chatGuid: string;
  service: string;
}

export interface IChat {
  guid: string;
  chatIdentifier: string;
  displayName: string | null;
  participants: string[];
  lastMessageDate: Date | null;
}

export class IMessageServiceClass extends EventEmitter {
  private db: DatabaseType | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastMessageRowId: number = 0;
  private isRunning = false;
  private dbCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  async initialize(): Promise<boolean> {
    try {
      // Check if database exists
      if (!fs.existsSync(IMESSAGE_DB_PATH)) {
        log('error', 'iMessage database not found. Is Messages app configured?');
        return false;
      }

      // Open read-only connection to iMessage database
      this.db = new Database(IMESSAGE_DB_PATH, { readonly: true });
      
      // Get the latest message ROWID to start polling from
      const latest = this.db.prepare('SELECT MAX(ROWID) as maxId FROM message').get() as { maxId: number };
      this.lastMessageRowId = latest?.maxId || 0;

      log('info', 'iMessage database connected', { lastRowId: this.lastMessageRowId });
      return true;
    } catch (error: any) {
      log('error', 'Failed to connect to iMessage database', { error: error.message });
      
      if (error.message.includes('SQLITE_CANTOPEN')) {
        log('error', 'Full Disk Access required. Please grant access in System Settings > Privacy & Security > Full Disk Access');
      }
      
      return false;
    }
  }

  async startPolling(intervalMs = 2000): Promise<void> {
    if (this.isRunning) return;

    const initialized = await this.initialize();
    if (!initialized) {
      this.emit('error', new Error('Failed to initialize iMessage database'));
      return;
    }

    this.isRunning = true;
    log('info', 'Started iMessage polling');
    this.emit('connected');

    this.pollInterval = setInterval(async () => {
      await this.pollNewMessages();
    }, intervalMs);

    // Initial poll
    await this.pollNewMessages();
  }

  async stopPolling(): Promise<void> {
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    log('info', 'Stopped iMessage polling');
    this.emit('disconnected');
  }

  private async pollNewMessages(): Promise<void> {
    if (!this.db || !this.isRunning) return;

    try {
      // Query for new messages since last poll
      const messages = this.db.prepare(`
        SELECT 
          m.ROWID,
          m.guid,
          m.text,
          m.is_from_me,
          m.date,
          m.service,
          h.id as handle_id,
          c.guid as chat_guid,
          c.chat_identifier
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE m.ROWID > ?
        ORDER BY m.ROWID ASC
        LIMIT 50
      `).all(this.lastMessageRowId) as any[];

      for (const row of messages) {
        // Update last seen ROWID
        if (row.ROWID > this.lastMessageRowId) {
          this.lastMessageRowId = row.ROWID;
        }

        // Only process incoming messages with text
        if (row.is_from_me === 0 && row.text && row.chat_guid) {
          const message: IMessage = {
            guid: row.guid,
            text: row.text,
            isFromMe: false,
            dateCreated: appleTimeToDate(row.date),
            handleId: row.handle_id || row.chat_identifier,
            chatGuid: row.chat_guid,
            service: row.service || 'iMessage',
          };

          log('info', 'New iMessage received', {
            from: message.handleId,
            preview: message.text.substring(0, 50),
          });

          this.emit('message', message);
        }
      }
    } catch (error: any) {
      log('error', 'Failed to poll messages', { error: error.message });
      this.emit('error', error);
    }
  }

  async sendMessage(chatGuid: string, text: string): Promise<boolean> {
    if (!chatGuid || !text) {
      log('error', 'Cannot send message: missing chatGuid or text');
      return false;
    }

    try {
      // Escape special characters for AppleScript
      const escapedText = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');

      // Build AppleScript to send message
      const script = `
        tell application "Messages"
          set targetChat to a reference to chat id "${chatGuid}"
          send "${escapedText}" to targetChat
        end tell
      `;

      await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

      log('info', 'Message sent via AppleScript', {
        chatGuid,
        preview: text.substring(0, 50),
      });

      return true;
    } catch (error: any) {
      log('error', 'Failed to send message via AppleScript', { error: error.message });

      // Try fallback method for individual chats
      if (chatGuid.includes(';-;')) {
        return this.sendMessageFallback(chatGuid, text);
      }

      return false;
    }
  }

  private async sendMessageFallback(chatGuid: string, text: string): Promise<boolean> {
    try {
      const parts = chatGuid.split(';-;');
      const service = parts[0] || 'iMessage';
      const address = parts[1];

      if (!address) {
        log('error', 'Invalid chat GUID for fallback send');
        return false;
      }

      const escapedText = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');

      const script = `
        tell application "Messages"
          set targetService to 1st account whose service type = ${service}
          set targetBuddy to participant "${address}" of targetService
          send "${escapedText}" to targetBuddy
        end tell
      `;

      await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

      log('info', 'Message sent via fallback AppleScript', { address });
      return true;
    } catch (error: any) {
      log('error', 'Fallback send also failed', { error: error.message });
      return false;
    }
  }

  async getConversationHistory(chatGuid: string, limit = 50): Promise<IMessage[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) return [];

    try {
      const messages = this.db.prepare(`
        SELECT 
          m.guid,
          m.text,
          m.is_from_me,
          m.date,
          m.service,
          h.id as handle_id,
          c.guid as chat_guid
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE c.guid = ? AND m.text IS NOT NULL
        ORDER BY m.date DESC
        LIMIT ?
      `).all(chatGuid, limit) as any[];

      return messages.reverse().map(row => ({
        guid: row.guid,
        text: row.text || '',
        isFromMe: row.is_from_me === 1,
        dateCreated: appleTimeToDate(row.date),
        handleId: row.handle_id || '',
        chatGuid: row.chat_guid,
        service: row.service || 'iMessage',
      }));
    } catch (error: any) {
      log('error', 'Failed to get conversation history', { error: error.message });
      return [];
    }
  }

  async getChats(limit = 50): Promise<IChat[]> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) return [];

    try {
      const chats = this.db.prepare(`
        SELECT 
          c.guid,
          c.chat_identifier,
          c.display_name,
          MAX(m.date) as last_message_date
        FROM chat c
        LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
        LEFT JOIN message m ON cmj.message_id = m.ROWID
        GROUP BY c.ROWID
        ORDER BY last_message_date DESC
        LIMIT ?
      `).all(limit) as any[];

      return chats.map(row => ({
        guid: row.guid,
        chatIdentifier: row.chat_identifier,
        displayName: row.display_name,
        participants: [], // Would need additional query
        lastMessageDate: row.last_message_date ? appleTimeToDate(row.last_message_date) : null,
      }));
    } catch (error: any) {
      log('error', 'Failed to get chats', { error: error.message });
      return [];
    }
  }

  isConnected(): boolean {
    return this.isRunning && this.db !== null;
  }

  async checkPermissions(): Promise<{ hasAccess: boolean; error?: string }> {
    try {
      if (!fs.existsSync(IMESSAGE_DB_PATH)) {
        return { hasAccess: false, error: 'iMessage database not found' };
      }

      // Try to open the database
      const testDb = new Database(IMESSAGE_DB_PATH, { readonly: true });
      testDb.prepare('SELECT 1 FROM message LIMIT 1').get();
      testDb.close();

      return { hasAccess: true };
    } catch (error: any) {
      if (error.message.includes('SQLITE_CANTOPEN')) {
        return {
          hasAccess: false,
          error: 'Full Disk Access required. Grant access in System Settings > Privacy & Security > Full Disk Access',
        };
      }
      return { hasAccess: false, error: error.message };
    }
  }
}

// Singleton instance
export const iMessageService = new IMessageServiceClass();
