import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { AppDataSource } from '../src/database/connection';
import { ApiUsage } from '../src/database/entities/ApiUsage';

// Anthropic pricing per million tokens
const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'claude-3-5-haiku-20241022': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
  'claude-3-5-haiku-latest': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
  'claude-3-5-sonnet-20241022': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-5-sonnet-latest': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-5-sonnet-20240620': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-opus-20240229': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-3-sonnet-20240229': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-haiku-20240307': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'default': { inputPerMillion: 1.00, outputPerMillion: 5.00 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

interface LogEntry {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  description?: string;
  durationMs?: number;
}

async function parseLogFile(filePath: string): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return entries;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"Anthropic request completed"')) {
      try {
        const json = JSON.parse(line);
        if (json.inputTokens && json.outputTokens && json.timestamp) {
          entries.push({
            timestamp: json.timestamp,
            inputTokens: json.inputTokens,
            outputTokens: json.outputTokens,
            description: json.description,
            durationMs: json.durationMs,
          });
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
  }

  return entries;
}

async function importUsageHistory() {
  console.log('Initializing database connection...');
  await AppDataSource.initialize();
  
  const usageRepo = AppDataSource.getRepository(ApiUsage);
  
  // Check existing count
  const existingCount = await usageRepo.count();
  console.log(`Existing usage records: ${existingCount}`);

  // Log files to parse
  const logDir = path.join(__dirname, '..');
  const logFiles = [
    path.join(logDir, 'agent.log'),
    path.join(logDir, 'logs/agent-service.log'),
    path.join(logDir, 'agent_debug.log'),
    path.join(logDir, 'agent_debug_v2.log'),
    path.join(logDir, 'agent_debug_v3.log'),
    path.join(logDir, 'agent_output.log'),
  ];

  const allEntries: LogEntry[] = [];
  const seenTimestamps = new Set<string>();

  for (const logFile of logFiles) {
    console.log(`Parsing ${logFile}...`);
    const entries = await parseLogFile(logFile);
    
    // Deduplicate by timestamp
    for (const entry of entries) {
      const key = `${entry.timestamp}-${entry.inputTokens}-${entry.outputTokens}`;
      if (!seenTimestamps.has(key)) {
        seenTimestamps.add(key);
        allEntries.push(entry);
      }
    }
  }

  console.log(`Found ${allEntries.length} unique usage entries in logs`);

  if (allEntries.length === 0) {
    console.log('No entries to import');
    await AppDataSource.destroy();
    return;
  }

  // Default model (most likely used)
  const defaultModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

  let imported = 0;
  let skipped = 0;

  for (const entry of allEntries) {
    // Parse timestamp (format: "2025-12-28 19:49:35")
    const createdAt = new Date(entry.timestamp.replace(' ', 'T') + 'Z');
    
    // Check if already exists (within 1 second)
    const existing = await usageRepo
      .createQueryBuilder('usage')
      .where('usage.created_at BETWEEN :start AND :end', {
        start: new Date(createdAt.getTime() - 1000),
        end: new Date(createdAt.getTime() + 1000),
      })
      .andWhere('usage.input_tokens = :inputTokens', { inputTokens: entry.inputTokens })
      .andWhere('usage.output_tokens = :outputTokens', { outputTokens: entry.outputTokens })
      .getOne();

    if (existing) {
      skipped++;
      continue;
    }

    const costUsd = calculateCost(defaultModel, entry.inputTokens, entry.outputTokens);

    const usage = usageRepo.create({
      model: defaultModel,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      costUsd,
      description: entry.description || 'Historical import',
      success: true,
      durationMs: entry.durationMs,
      createdAt,
    });

    await usageRepo.save(usage);
    imported++;
  }

  console.log(`Imported: ${imported}, Skipped (duplicates): ${skipped}`);

  // Show summary
  const totalCount = await usageRepo.count();
  const stats = await usageRepo
    .createQueryBuilder('usage')
    .select('SUM(usage.input_tokens)', 'inputTokens')
    .addSelect('SUM(usage.output_tokens)', 'outputTokens')
    .addSelect('SUM(usage.cost_usd)', 'costUsd')
    .getRawOne();

  console.log('\n=== Usage Summary ===');
  console.log(`Total records: ${totalCount}`);
  console.log(`Total input tokens: ${parseInt(stats?.inputTokens || '0').toLocaleString()}`);
  console.log(`Total output tokens: ${parseInt(stats?.outputTokens || '0').toLocaleString()}`);
  console.log(`Total cost: $${parseFloat(stats?.costUsd || '0').toFixed(4)}`);

  await AppDataSource.destroy();
  console.log('\nDone!');
}

importUsageHistory().catch(console.error);
