import Anthropic from '@anthropic-ai/sdk';
import { SecureStorage } from '../../utils/secure-storage';
import { log } from '../routes/dashboard';
import { getDatabase, recordApiUsage } from '../database';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

export class ClaudeService {
  private client: Anthropic | null = null;
  private model = 'claude-sonnet-4-20250514';
  private maxTokens = 1024;
  private temperature = 0.7;
  private initialized = false;

  constructor() {
    // Don't initialize in constructor - wait for Electron app to be ready
  }

  private initClient(): void {
    if (this.initialized) return;
    this.initialized = true;
    
    try {
      const apiKey = SecureStorage.getAnthropicApiKey();
      if (apiKey) {
        this.client = new Anthropic({ apiKey });
        log('info', 'Claude client initialized');
      }
    } catch (error: any) {
      // Electron app may not be ready yet
      this.initialized = false;
      console.log('[ClaudeService] Deferred initialization:', error.message);
    }
  }

  refreshClient(): void {
    this.initialized = false;
    this.client = null;
    this.initClient();
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: Message[] = [],
    systemPrompt?: string
  ): Promise<ClaudeResponse | null> {
    if (!this.client) {
      this.initClient();
      if (!this.client) {
        log('error', 'Claude client not configured');
        return null;
      }
    }

    try {
      // Build messages array
      const messages: Anthropic.MessageParam[] = [
        ...conversationHistory.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: userMessage },
      ];

      // Default system prompt for the AI agent
      const defaultSystemPrompt = `You are Grace, a helpful and friendly AI assistant communicating via iMessage. 
You help users with their questions and tasks in a conversational, natural way.

Guidelines:
- Be concise but helpful - this is a text message conversation
- Use a warm, friendly tone
- If you don't know something, say so honestly
- Don't use excessive formatting - keep responses readable on a phone
- Remember context from the conversation when relevant`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemPrompt || defaultSystemPrompt,
        messages,
      });

      const textContent = response.content.find((c) => c.type === 'text');
      const content = textContent?.type === 'text' ? textContent.text : '';

      // Record API usage
      recordApiUsage(response.usage.input_tokens, response.usage.output_tokens);

      log('info', 'Claude response generated', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      });

      return {
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason || 'end_turn',
      };
    } catch (error: any) {
      log('error', 'Claude API error', { error: error.message });

      // Handle specific error types
      if (error.status === 401) {
        log('error', 'Invalid Anthropic API key');
      } else if (error.status === 429) {
        log('warn', 'Rate limited by Anthropic API');
      }

      return null;
    }
  }

  setModel(model: string): void {
    this.model = model;
  }

  setMaxTokens(tokens: number): void {
    this.maxTokens = tokens;
  }

  setTemperature(temp: number): void {
    this.temperature = temp;
  }
}

// Singleton instance
export const claudeService = new ClaudeService();
