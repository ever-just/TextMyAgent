import { AppDataSource } from '../database/connection';
import { ApiUsage } from '../database/entities/ApiUsage';
import { logDebug, logError, logInfo } from '../utils/logger';

// Anthropic pricing per million tokens (as of 2024/2025)
// Source: https://www.anthropic.com/pricing
const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
  'claude-3-5-haiku-latest': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
  
  // Claude 3.5 Sonnet
  'claude-3-5-sonnet-20241022': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-5-sonnet-latest': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-5-sonnet-20240620': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  
  // Claude 3 Opus
  'claude-3-opus-20240229': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-3-opus-latest': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  
  // Claude 3 Sonnet (older)
  'claude-3-sonnet-20240229': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  
  // Claude 3 Haiku (older)
  'claude-3-haiku-20240307': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  
  // Default fallback (Haiku pricing)
  'default': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
};

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  description?: string;
  userId?: string;
  conversationId?: string;
  success: boolean;
  durationMs?: number;
}

export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  requests: number;
  costUsd: number;
}

export interface UsageStats {
  today: UsageSummary;
  thisWeek: UsageSummary;
  thisMonth: UsageSummary;
  allTime: UsageSummary;
  byModel: Record<string, UsageSummary>;
}

class UsageTrackerService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Ensure database is connected
      if (!AppDataSource.isInitialized) {
        logDebug('UsageTracker: Waiting for database initialization');
        return;
      }
      
      this.initialized = true;
      logInfo('UsageTracker initialized');
    } catch (error) {
      logError('Failed to initialize UsageTracker', error);
    }
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
    
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
    
    return inputCost + outputCost;
  }

  async recordUsage(record: UsageRecord): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        logDebug('UsageTracker: Database not ready, skipping usage record');
        return;
      }

      const costUsd = this.calculateCost(record.model, record.inputTokens, record.outputTokens);
      
      const usageRepo = AppDataSource.getRepository(ApiUsage);
      const usage = usageRepo.create({
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        costUsd,
        description: record.description,
        userId: record.userId,
        conversationId: record.conversationId,
        success: record.success,
        durationMs: record.durationMs,
      });

      await usageRepo.save(usage);
      
      logDebug('API usage recorded', {
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        costUsd: costUsd.toFixed(6),
      });
    } catch (error) {
      logError('Failed to record API usage', error);
    }
  }

  async getUsageStats(): Promise<UsageStats> {
    try {
      if (!AppDataSource.isInitialized) {
        return this.emptyStats();
      }

      const usageRepo = AppDataSource.getRepository(ApiUsage);
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Query for today
      const todayStats = await this.queryPeriodStats(usageRepo, startOfDay);
      
      // Query for this week
      const weekStats = await this.queryPeriodStats(usageRepo, startOfWeek);
      
      // Query for this month
      const monthStats = await this.queryPeriodStats(usageRepo, startOfMonth);

      // Query all time
      const allTimeStats = await this.queryAllTimeStats(usageRepo);

      // Query by model (all time)
      const byModel = await this.queryByModelStats(usageRepo, new Date(0));

      return {
        today: todayStats,
        thisWeek: weekStats,
        thisMonth: monthStats,
        allTime: allTimeStats,
        byModel,
      };
    } catch (error) {
      logError('Failed to get usage stats', error);
      return this.emptyStats();
    }
  }

  private async queryPeriodStats(
    repo: ReturnType<typeof AppDataSource.getRepository<ApiUsage>>,
    since: Date
  ): Promise<UsageSummary> {
    const result = await repo
      .createQueryBuilder('usage')
      .select('SUM(usage.input_tokens)', 'inputTokens')
      .addSelect('SUM(usage.output_tokens)', 'outputTokens')
      .addSelect('COUNT(*)', 'requests')
      .addSelect('SUM(usage.cost_usd)', 'costUsd')
      .where('usage.created_at >= :since', { since })
      .andWhere('usage.success = true')
      .getRawOne();

    return {
      inputTokens: parseInt(result?.inputTokens || '0', 10),
      outputTokens: parseInt(result?.outputTokens || '0', 10),
      requests: parseInt(result?.requests || '0', 10),
      costUsd: parseFloat(result?.costUsd || '0'),
    };
  }

  private async queryByModelStats(
    repo: ReturnType<typeof AppDataSource.getRepository<ApiUsage>>,
    since: Date
  ): Promise<Record<string, UsageSummary>> {
    const results = await repo
      .createQueryBuilder('usage')
      .select('usage.model', 'model')
      .addSelect('SUM(usage.input_tokens)', 'inputTokens')
      .addSelect('SUM(usage.output_tokens)', 'outputTokens')
      .addSelect('COUNT(*)', 'requests')
      .addSelect('SUM(usage.cost_usd)', 'costUsd')
      .where('usage.created_at >= :since', { since })
      .andWhere('usage.success = true')
      .groupBy('usage.model')
      .getRawMany();

    const byModel: Record<string, UsageSummary> = {};
    for (const row of results) {
      byModel[row.model] = {
        inputTokens: parseInt(row.inputTokens || '0', 10),
        outputTokens: parseInt(row.outputTokens || '0', 10),
        requests: parseInt(row.requests || '0', 10),
        costUsd: parseFloat(row.costUsd || '0'),
      };
    }

    return byModel;
  }

  private async queryAllTimeStats(
    repo: ReturnType<typeof AppDataSource.getRepository<ApiUsage>>
  ): Promise<UsageSummary> {
    const result = await repo
      .createQueryBuilder('usage')
      .select('SUM(usage.input_tokens)', 'inputTokens')
      .addSelect('SUM(usage.output_tokens)', 'outputTokens')
      .addSelect('COUNT(*)', 'requests')
      .addSelect('SUM(usage.cost_usd)', 'costUsd')
      .where('usage.success = true')
      .getRawOne();

    return {
      inputTokens: parseInt(result?.inputTokens || '0', 10),
      outputTokens: parseInt(result?.outputTokens || '0', 10),
      requests: parseInt(result?.requests || '0', 10),
      costUsd: parseFloat(result?.costUsd || '0'),
    };
  }

  private emptyStats(): UsageStats {
    const empty: UsageSummary = { inputTokens: 0, outputTokens: 0, requests: 0, costUsd: 0 };
    return {
      today: { ...empty },
      thisWeek: { ...empty },
      thisMonth: { ...empty },
      allTime: { ...empty },
      byModel: {},
    };
  }
}

// Singleton instance
let usageTrackerInstance: UsageTrackerService | null = null;

export const getUsageTracker = (): UsageTrackerService => {
  if (!usageTrackerInstance) {
    usageTrackerInstance = new UsageTrackerService();
  }
  return usageTrackerInstance;
};

export const initializeUsageTracker = async (): Promise<void> => {
  const tracker = getUsageTracker();
  await tracker.initialize();
};
