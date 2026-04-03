# Dashboard Implementation Plan: Agent Command Center

## Overview
A locally-running web dashboard that serves as the central command center for the BlueBubbles AI Agent (Grace). Built with **Next.js 14** (App Router) + **React** + **Blueprint.js** (Palantir's data-dense UI toolkit) for a powerful, desktop-optimized admin interface.

---

## Features Summary

| Feature | Description |
|---------|-------------|
| **A. Activity Monitor** | Real-time agent activity, logs, and message processing |
| **B. Configuration Panel** | Tweak agent settings (model, tokens, behavior) |
| **C. Service Control** | Start/stop agent + backend services (PostgreSQL, Redis, BlueBubbles) |
| **D. Usage & Costs** | Token usage tracking, cost estimation for Anthropic API |
| **E. Users & Contacts** | View who's messaging the agent, conversation history |
| **F. Contacts Integration** | Import contacts from macOS Contacts app |
| **G. Outbound Messaging** | Initiate conversations with contacts or phone numbers |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)                       │
│                    localhost:3001                            │
├─────────────────────────────────────────────────────────────┤
│  React Frontend (Blueprint.js)                              │
│  - Activity Feed (WebSocket)                                │
│  - Config Editor                                            │
│  - Service Status Panel                                     │
│  - Usage Charts                                             │
│  - User List                                                │
│  - Contacts Browser                                         │
│  - Outbound Composer                                        │
├─────────────────────────────────────────────────────────────┤
│  Next.js API Routes (Backend)                               │
│  - /api/agent/* (start, stop, status, logs)                 │
│  - /api/config/* (read, update settings)                    │
│  - /api/services/* (postgres, redis, bluebubbles status)    │
│  - /api/usage/* (token usage, cost estimates)               │
│  - /api/users/* (list users, conversations)                 │
│  - /api/contacts/* (import from macOS)                      │
│  - /api/messages/* (send outbound)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent Service (Express)                    │
│                   localhost:3000                             │
│  - Existing webhooks, message processing                    │
│  - Health endpoint: GET /health                             │
│  - New dashboard endpoints (to be added)                    │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌──────────┐       ┌──────────┐       ┌──────────────┐
    │ PostgreSQL│       │  Redis   │       │ BlueBubbles  │
    │  :5432    │       │  :6379   │       │   :1234      │
    └──────────┘       └──────────┘       └──────────────┘
```

---

## Tech Stack

### Frontend
- **Next.js 14** (App Router) - React framework with server components
- **Blueprint.js** (@blueprintjs/core) - Palantir's React UI toolkit for data-dense desktop apps
  - `@blueprintjs/core` - Core styles & components (buttons, cards, forms, dialogs)
  - `@blueprintjs/icons` - 500+ icons optimized for UI
  - `@blueprintjs/table` - Scalable spreadsheet-like table (perfect for users/contacts)
  - `@blueprintjs/select` - Select components (contact picker, model selector)
  - `@blueprintjs/datetime` - Date/time pickers (for usage date ranges)
- **Recharts** - Charts for usage visualization
- **Socket.io-client** - Real-time activity feed

### Backend (Dashboard API)
- **Next.js API Routes** - Server-side endpoints
- **PM2 Programmatic API** - Process management for agent service
- **node-mac-contacts** - macOS Contacts integration (native module)
- **TypeORM** - Direct database queries (shared with agent-service)

### Why Blueprint.js?
Blueprint is specifically designed for **complex, data-dense desktop applications** - exactly what this dashboard needs. Key advantages:
- Built for internal tools and admin panels
- Excellent table component for user lists and contacts
- Dark theme built-in (matches developer tooling aesthetic)
- Form controls optimized for configuration panels
- Tree and menu components for navigation
- Not mobile-first - optimized for desktop use cases

---

## Detailed Feature Implementation

### A. Activity Monitor

**Purpose:** Real-time view of agent activity, logs, and message processing.

**Data Sources:**
- `@/agent-service/src/index.ts:522` - Main server with Socket.io already configured
- `@/agent-service/src/services/MessageRouter.ts` - Message processing logs
- `@/agent-service/src/database/entities/Message.ts` - Message history

**Implementation:**
1. Add WebSocket event emissions in `MessageRouter.ts` for:
   - `agent:message:received` - When message comes in
   - `agent:message:processing` - When AI is thinking
   - `agent:message:sent` - When response is sent
   - `agent:tool:used` - When a tool is executed

2. Dashboard connects via Socket.io to `localhost:3000`

3. UI Components:
   - **Activity Feed** - Scrolling list of recent events
   - **Message Log** - Detailed view of message exchanges
   - **Tool Execution Log** - What tools were called and results

**New Agent Service Endpoints:**
```typescript
// GET /api/dashboard/activity - Recent activity (last 100 events)
// GET /api/dashboard/logs - Paginated logs
// WebSocket: 'dashboard:activity' channel
```

---

### B. Configuration Panel & Agent Tuning

**Purpose:** Modify agent settings without editing .env files, with clear feedback on how changes affect agent behavior.

**Data Sources:**
- `@/agent-service/src/config/index.ts:1-121` - All config options loaded at startup
- `@/agent-service/.env.example:1-56` - Environment variables
- `@/agent-service/src/agents/prompts/grace_system_prompt.md` - Agent personality/behavior

**Current Config Architecture (Important):**
The config is loaded **once at startup** via `dotenv.config()`. Changes to `.env` require a restart. The dashboard should:
1. Edit `.env` file directly
2. Trigger agent restart via PM2
3. Show "pending restart" indicator for changes

**Configurable Settings with Agent Impact:**

| Category | Settings | How It Affects Agent |
|----------|----------|---------------------|
| **Anthropic Model** | `claude-3-5-haiku-latest`, `claude-3-5-sonnet-latest` | Haiku = faster/cheaper, Sonnet = smarter/costlier |
| **Temperature** | 0.0 - 1.0 (default: 0.7) | Lower = more deterministic, Higher = more creative |
| **Response Max Tokens** | 350 default | Limits response length - affects verbosity |
| **Context Window Tokens** | 6000 default | How much history sent to Claude |
| **Summary Trigger Tokens** | 4000 default | When to summarize old messages |
| **Web Search** | Enable/disable, max uses | Whether agent can search the web |
| **Typing Indicators** | Enable/disable | Show "typing..." in iMessage |
| **Max Tool Iterations** | 8 default | How many tools agent can chain |
| **Execution Timeout** | 90s default | Max time for tool execution |

**Implementation:**

1. **Config API Endpoints (agent-service):**
```typescript
GET  /api/dashboard/config              // Get current config (sanitized)
PUT  /api/dashboard/config              // Update .env file
POST /api/dashboard/config/validate     // Validate before applying
POST /api/dashboard/config/restart      // Restart agent to apply changes
GET  /api/dashboard/config/pending      // Check if restart needed
```

2. **Config File Writer:**
```typescript
// Write to .env file safely
async function updateEnvFile(updates: Record<string, string>) {
  const envPath = path.join(__dirname, '../../.env');
  const existing = dotenv.parse(fs.readFileSync(envPath));
  const merged = { ...existing, ...updates };
  const content = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  fs.writeFileSync(envPath, content);
}
```

3. **Dashboard UI (Blueprint.js):**
   - `FormGroup` + `InputGroup` for text/number fields
   - `Switch` for boolean toggles
   - `HTMLSelect` for model selection
   - `Slider` for temperature (0-1)
   - `Callout` showing "Restart required" warning
   - `Button` with intent="primary" for "Apply & Restart"

**Tuning Presets (Quick Profiles):**
| Preset | Model | Temp | Max Tokens | Description |
|--------|-------|------|------------|-------------|
| **Economy** | Haiku | 0.5 | 250 | Fast, cheap, concise |
| **Balanced** | Haiku | 0.7 | 350 | Default settings |
| **Quality** | Sonnet | 0.7 | 500 | Smarter, more detailed |
| **Creative** | Sonnet | 0.9 | 600 | More varied responses |

**Security:** Never expose `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY`, `SESSION_SECRET` in responses. Show masked versions like `sk-ant-...xxxx`.

---

### B2. Logs & Debugging Area

**Purpose:** Real-time log viewing, filtering, and debugging for troubleshooting agent issues.

**Data Sources:**
- `@/agent-service/src/utils/logger.ts` - Winston logger with JSON/simple formats
- Console output from agent process
- `@/agent-service/src/services/MessageRouter.ts` - Message processing logs
- `@/agent-service/src/services/AnthropicRequestManager.ts` - API call logs

**Current Logging Architecture:**
```typescript
// Winston transports:
// 1. Console (level from config.logging.level)
// 2. File: error.log (errors only)
// 3. File: combined.log (all levels)
// Levels: error, warn, info, debug
```

**Implementation:**

1. **Log Streaming API:**
```typescript
// Real-time log streaming via WebSocket
io.on('connection', (socket) => {
  // Subscribe to log events
  socket.on('dashboard:logs:subscribe', (filters) => {
    // Stream logs matching filters
  });
});

// REST endpoint for historical logs
GET /api/dashboard/logs?level=error&since=2024-01-01&limit=100
GET /api/dashboard/logs/search?q=BlueBubbles&level=warn
```

2. **Log Ring Buffer (In-Memory):**
```typescript
// Keep last 1000 logs in memory for dashboard
class LogBuffer {
  private logs: LogEntry[] = [];
  private maxSize = 1000;
  
  add(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxSize) this.logs.shift();
    // Emit to WebSocket subscribers
    io.emit('dashboard:log', entry);
  }
  
  query(filters: LogFilters): LogEntry[] {
    return this.logs.filter(/* apply filters */);
  }
}
```

3. **Winston Transport for Dashboard:**
```typescript
// Custom transport to feed dashboard
class DashboardTransport extends Transport {
  log(info: any, callback: () => void) {
    logBuffer.add({
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      metadata: info.metadata,
      source: this.detectSource(info)
    });
    callback();
  }
}
```

4. **Dashboard UI (Blueprint.js):**
```typescript
// Log viewer components
<Card>
  <H4>Logs</H4>
  
  {/* Filters */}
  <ControlGroup>
    <HTMLSelect options={['all', 'error', 'warn', 'info', 'debug']} />
    <InputGroup placeholder="Search logs..." leftIcon="search" />
    <DateRangeInput /> {/* from @blueprintjs/datetime */}
    <Button icon="refresh" text="Clear" />
  </ControlGroup>
  
  {/* Log table with virtualization for performance */}
  <Table numRows={logs.length}>
    <Column name="Time" cellRenderer={renderTime} />
    <Column name="Level" cellRenderer={renderLevelTag} />
    <Column name="Message" cellRenderer={renderMessage} />
    <Column name="Source" cellRenderer={renderSource} />
  </Table>
</Card>
```

**Log Level Color Coding (Blueprint Tags):**
| Level | Blueprint Intent | Color |
|-------|-----------------|-------|
| error | `danger` | Red |
| warn | `warning` | Orange |
| info | `primary` | Blue |
| debug | `none` | Gray |

**Quick Debug Actions:**
- **"Show last error"** - Jump to most recent error
- **"Filter by chat"** - Show logs for specific conversation
- **"Export logs"** - Download as JSON/CSV
- **"Clear & restart"** - Clear logs and restart agent

**Debug Panels:**
| Panel | Shows |
|-------|-------|
| **Message Flow** | Incoming → Processing → Claude → Response |
| **Tool Execution** | Which tools called, params, results |
| **API Calls** | Anthropic requests, tokens, latency |
| **WebSocket Events** | BlueBubbles connection status |

---

### C. Service Control (Start/Stop Agent)

**Purpose:** Control agent and backend services without terminal commands.

**Services to Manage:**
1. **Agent Service** (Node.js process)
2. **PostgreSQL** (database)
3. **Redis** (queue/cache)
4. **BlueBubbles Server** (external, status check only)
5. **Docker containers** (optional, if using containerized services)

**Implementation:**

#### Option 1: PM2 Programmatic API (Recommended)
```typescript
import pm2 from 'pm2';

// Start agent
pm2.connect((err) => {
  pm2.start({
    script: 'dist/index.js',
    name: 'bluebubbles-agent',
    cwd: '/path/to/agent-service'
  }, callback);
});

// Stop agent
pm2.stop('bluebubbles-agent', callback);

// Get status
pm2.describe('bluebubbles-agent', (err, processDescription) => {
  // processDescription[0].pm2_env.status -> 'online' | 'stopped'
  // processDescription[0].monit.memory -> bytes used
  // processDescription[0].monit.cpu -> CPU %
});
```

#### Option 2: Child Process (Simpler, no PM2 dependency)
```typescript
import { spawn, exec } from 'child_process';

// Start
const agent = spawn('npm', ['run', 'dev'], { cwd: agentServicePath, detached: true });

// Stop
exec('pkill -f "ts-node src/index.ts"');
```

**Dashboard Endpoints:**
```typescript
GET  /api/services/status     // Status of all services
POST /api/services/agent/start
POST /api/services/agent/stop
POST /api/services/agent/restart
```

---

### C2. Enhanced Service Monitoring

#### PostgreSQL Monitoring

**Health Check & Stats:**
```typescript
// Using TypeORM's existing connection
import { AppDataSource } from './database/connection';

async function getPostgresStats() {
  // Basic health
  const isConnected = AppDataSource.isInitialized;
  
  // Active connections
  const activeConnections = await AppDataSource.query(`
    SELECT count(*) as count FROM pg_stat_activity 
    WHERE datname = current_database()
  `);
  
  // Database size
  const dbSize = await AppDataSource.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);
  
  // Slow queries (if pg_stat_statements enabled)
  const slowQueries = await AppDataSource.query(`
    SELECT query, calls, mean_exec_time 
    FROM pg_stat_statements 
    ORDER BY mean_exec_time DESC LIMIT 5
  `);
  
  // Table row counts
  const tableCounts = await AppDataSource.query(`
    SELECT relname as table, n_live_tup as rows 
    FROM pg_stat_user_tables ORDER BY n_live_tup DESC
  `);
  
  return { isConnected, activeConnections, dbSize, slowQueries, tableCounts };
}
```

**Dashboard Display:**
| Metric | Source | Display |
|--------|--------|---------|
| Connection Status | `AppDataSource.isInitialized` | Green/Red indicator |
| Active Connections | `pg_stat_activity` | Number badge |
| Database Size | `pg_database_size()` | "245 MB" |
| Table Stats | `pg_stat_user_tables` | Table with row counts |

---

#### Redis Monitoring

**Health Check & Stats:**
```typescript
import { createClient } from 'redis';

async function getRedisStats() {
  const client = createClient({ url: config.redis.url });
  await client.connect();
  
  // INFO command returns comprehensive stats
  const info = await client.info();
  
  // Parse key sections
  const parsed = parseRedisInfo(info);
  
  return {
    connected: client.isOpen,
    version: parsed.redis_version,
    uptime: parsed.uptime_in_seconds,
    connectedClients: parsed.connected_clients,
    usedMemory: parsed.used_memory_human,      // "1.5M"
    usedMemoryPeak: parsed.used_memory_peak_human,
    totalKeys: parsed.db0?.keys || 0,
    opsPerSec: parsed.instantaneous_ops_per_sec,
    hitRate: calculateHitRate(parsed),  // hits / (hits + misses)
  };
}

function parseRedisInfo(info: string): Record<string, any> {
  const result: Record<string, any> = {};
  for (const line of info.split('\n')) {
    if (line.includes(':')) {
      const [key, value] = line.split(':');
      result[key.trim()] = value.trim();
    }
  }
  return result;
}
```

**Dashboard Display:**
| Metric | Command | Display |
|--------|---------|---------|
| Status | `client.isOpen` | Green/Red |
| Memory | `INFO memory` | "1.5 MB / 8 GB" |
| Keys | `INFO keyspace` | "245 keys" |
| Ops/sec | `INFO stats` | Sparkline chart |
| Hit Rate | `INFO stats` | "98.5%" |

---

#### BlueBubbles Server Monitoring

**API Endpoints (from BlueBubbles docs):**
```typescript
const BB_BASE = config.bluebubbles.url;
const password = config.bluebubbles.password;

async function getBlueBubblesStatus() {
  // Server info
  const serverInfo = await axios.get(
    `${BB_BASE}/api/v1/server/info?password=${password}`
  );
  
  // Check Private API status
  const privateApiEnabled = serverInfo.data?.data?.private_api?.enabled;
  
  // Recent chats activity
  const recentChats = await axios.get(
    `${BB_BASE}/api/v1/chat?password=${password}&limit=5`
  );
  
  return {
    connected: true,
    version: serverInfo.data?.data?.server_version,
    osVersion: serverInfo.data?.data?.os_version,
    privateApiEnabled,
    privateApiConnected: serverInfo.data?.data?.private_api?.connected,
    proxyService: serverInfo.data?.data?.proxy_service,  // ngrok, cloudflare, etc.
    recentChatsCount: recentChats.data?.data?.length || 0,
  };
}
```

**BlueBubbles Webhook Events (for real-time updates):**
| Event | Description |
|-------|-------------|
| `new-message` | Incoming message |
| `updated-message` | Read receipt, delivery status |
| `typing-indicator` | Someone typing |
| `chat-read-status-changed` | Chat marked read |
| `server-update` | Server version changed |

**Dashboard Display:**
| Metric | Source | Display |
|--------|--------|---------|
| Connection | Socket.io status | Green/Red |
| Server Version | `/server/info` | "v1.9.5" |
| Private API | `/server/info` | Enabled/Disabled badge |
| macOS Version | `/server/info` | "14.2" |
| Recent Activity | Chat count | "12 active chats" |

---

#### Docker Container Monitoring (Optional)

**Using node-docker-api:**
```typescript
import { Docker } from 'node-docker-api';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function getDockerStatus() {
  // List containers
  const containers = await docker.container.list({ all: true });
  
  return containers.map(c => ({
    id: c.id.substring(0, 12),
    name: c.data.Names[0].replace('/', ''),
    image: c.data.Image,
    status: c.data.State,  // 'running', 'exited', etc.
    ports: c.data.Ports,
    created: c.data.Created,
  }));
}

// Start/stop containers
async function startContainer(name: string) {
  const container = docker.container.get(name);
  await container.start();
}

async function stopContainer(name: string) {
  const container = docker.container.get(name);
  await container.stop();
}
```

**Relevant Containers:**
| Container | Purpose | Port |
|-----------|---------|------|
| `postgres` | Database | 5432 |
| `redis` | Cache/Queue | 6379 |
| `bluebubbles-agent` | Agent (if containerized) | 3000 |

---

**UI Components (Blueprint.js):**
```typescript
// Service status card
<Card interactive elevation={Elevation.TWO}>
  <div className="service-header">
    <Icon icon="database" size={20} />
    <H5>PostgreSQL</H5>
    <Tag intent={isConnected ? 'success' : 'danger'}>
      {isConnected ? 'Connected' : 'Disconnected'}
    </Tag>
  </div>
  
  <div className="service-stats">
    <Stat label="Connections" value={activeConnections} />
    <Stat label="Size" value={dbSize} />
    <Stat label="Uptime" value={formatUptime(uptime)} />
  </div>
  
  <ButtonGroup minimal>
    <Button icon="refresh" text="Refresh" />
    <Button icon="console" text="Query" />
  </ButtonGroup>
</Card>
```

**Service Dashboard Layout:**
```
┌─────────────────┬─────────────────┐
│  Agent Service  │   PostgreSQL    │
│  ● Running      │   ● Connected   │
│  CPU: 12%       │   Conns: 5/10   │
│  Mem: 256MB     │   Size: 245MB   │
│  [Stop] [Restart]│  [Query Console]│
├─────────────────┼─────────────────┤
│     Redis       │  BlueBubbles    │
│  ● Connected    │   ● Connected   │
│  Mem: 1.5MB     │   Private API ✓ │
│  Keys: 245      │   v1.9.5        │
│  Ops/s: 120     │   macOS 14.2    │
└─────────────────┴─────────────────┘
```

---

### D. Usage & Costs

**Purpose:** Track Anthropic API usage and estimate costs.

**Data Sources:**
- `@/agent-service/src/services/AnthropicRequestManager.ts:227-240` - Logs token usage per request
- `@/agent-service/src/services/RateLimiter.ts:1-124` - Tracks token windows

**Implementation:**

1. **Create Usage Tracking Table:**
```sql
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  model VARCHAR(50),
  input_tokens INTEGER,
  output_tokens INTEGER,
  request_type VARCHAR(50), -- 'chat', 'summary', 'tool_use'
  user_id UUID REFERENCES users(id),
  conversation_id UUID REFERENCES conversations(id),
  cost_usd DECIMAL(10, 6)
);
```

2. **Modify AnthropicRequestManager** to persist usage:
```typescript
// In logSuccess method, add:
await this.persistUsage({
  model: config.anthropic.model,
  inputTokens: usage?.inputTokens,
  outputTokens: usage?.outputTokens,
  requestType: item.tags?.[0],
  costUsd: this.calculateCost(usage)
});
```

3. **Cost Calculation (Anthropic Pricing):**
```typescript
const PRICING = {
  'claude-3-5-haiku-latest': { input: 0.001, output: 0.005 }, // per 1K tokens
  'claude-3-5-sonnet-latest': { input: 0.003, output: 0.015 },
  'claude-3-opus-latest': { input: 0.015, output: 0.075 }
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  return (inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output);
}
```

4. **Dashboard Endpoints:**
```typescript
GET /api/usage/summary       // Total usage, costs by period
GET /api/usage/daily         // Daily breakdown
GET /api/usage/by-user       // Usage per user
GET /api/usage/by-model      // Usage per model
```

5. **UI Components:**
- **Summary Cards:** Total tokens today, this week, this month
- **Cost Display:** Estimated cost in USD
- **Charts:** Line chart of daily usage, pie chart by model
- **Rate Limit Status:** Current window usage vs limits

---

### E. Users & Messaging Activity

**Purpose:** See who's messaging the agent and their conversation history.

**Data Sources:**
- `@/agent-service/src/database/entities/User.ts:1-58` - User entity
- `@/agent-service/src/database/entities/Conversation.ts:1-42` - Conversations
- `@/agent-service/src/database/entities/Message.ts` - Messages

**Dashboard Endpoints:**
```typescript
GET /api/users                      // List all users with last activity
GET /api/users/:id                  // User details
GET /api/users/:id/conversations    // User's conversations
GET /api/conversations/:id/messages // Messages in conversation
```

**UI Components:**
- **User List:** Table with phone/email, last active, message count
- **User Detail:** Click to see conversation history
- **Conversation View:** Chat-style display of messages
- **Search:** Filter users by phone/email

---

### F. Contacts Integration (macOS)

**Purpose:** Import contacts from macOS Contacts app for easy outbound messaging.

**Technology:** `node-mac-contacts` npm package

**Implementation:**

1. **Install native module:**
```bash
npm install node-mac-contacts
```

2. **Dashboard API Route:**
```typescript
// /api/contacts/import
import * as contacts from 'node-mac-contacts';

export async function POST() {
  // Check authorization
  const authStatus = contacts.getAuthStatus();
  if (authStatus !== 'Authorized') {
    // Request access (shows system dialog)
    const result = await contacts.requestAccess();
    if (result !== 'Authorized') {
      return { error: 'Contacts access denied' };
    }
  }

  // Fetch all contacts
  const allContacts = contacts.getAllContacts(['organizationName', 'jobTitle']);
  
  // Return formatted contacts
  return allContacts.map(c => ({
    id: c.identifier,
    firstName: c.firstName,
    lastName: c.lastName,
    phoneNumbers: c.phoneNumbers,
    emailAddresses: c.emailAddresses,
    organization: c.organizationName
  }));
}
```

3. **UI Components:**
- **Import Button:** "Sync Contacts from Mac"
- **Contacts List:** Searchable table with name, phone, email
- **Contact Card:** Click to view details, quick-send button

**Note:** This requires the dashboard app to have Contacts permission in macOS System Preferences > Privacy & Security > Contacts.

---

### G. Outbound Messaging

**Purpose:** Initiate conversations with contacts or arbitrary phone numbers.

**Data Sources:**
- `@/agent-service/src/integrations/BlueBubblesClient.ts:164-182` - `sendMessage()` method
- `@/agent-service/src/integrations/BlueBubblesClient.ts:404-475` - `findChatGuidByHandle()`

**Implementation:**

1. **Agent Service Endpoint:**
```typescript
// POST /api/messages/send
interface SendMessageRequest {
  recipient: string;      // Phone number or email
  message: string;        // Message text
  asAgent?: boolean;      // If true, process through AI first
}

app.post('/api/messages/send', async (req, res) => {
  const { recipient, message, asAgent } = req.body;
  
  const bbClient = new BlueBubblesClient();
  await bbClient.connect();
  
  // Find or create chat
  let chatGuid = await bbClient.findChatGuidByHandle(recipient);
  if (!chatGuid) {
    // Create new chat via BlueBubbles API
    chatGuid = `iMessage;-;${recipient}`;
  }
  
  if (asAgent) {
    // Route through AI for response generation
    await messageRouter.handleOutboundRequest(chatGuid, message);
  } else {
    // Direct send
    await bbClient.sendMessage(chatGuid, message);
  }
  
  res.json({ success: true, chatGuid });
});
```

2. **UI Components:**
- **Compose Panel:**
  - Recipient selector (from contacts or manual input)
  - Message text area
  - "Send as Grace" toggle (AI processes message)
  - Send button
- **Recent Outbound:** List of recently sent messages

---

## Project Structure

```
dashboard/
├── app/
│   ├── layout.tsx                  # Blueprint CSS imports, dark theme
│   ├── page.tsx                    # Dashboard home
│   ├── activity/
│   │   └── page.tsx                # Activity monitor
│   ├── config/
│   │   └── page.tsx                # Configuration panel
│   ├── services/
│   │   └── page.tsx                # Service control
│   ├── usage/
│   │   └── page.tsx                # Usage & costs
│   ├── users/
│   │   ├── page.tsx                # User list (Blueprint Table)
│   │   └── [id]/page.tsx           # User detail
│   ├── contacts/
│   │   └── page.tsx                # Contacts browser (Blueprint Table)
│   └── compose/
│       └── page.tsx                # Outbound messaging
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Blueprint Tree navigation
│   │   └── Header.tsx              # Blueprint Navbar
│   ├── ActivityFeed.tsx            # Blueprint Card + Tag for events
│   ├── ServiceCard.tsx             # Blueprint Card + Icon + Tag
│   ├── UsageChart.tsx              # Recharts + Blueprint Card
│   ├── UserTable.tsx               # Blueprint Table component
│   ├── ContactList.tsx             # Blueprint Table + Select
│   ├── ConfigForm.tsx              # Blueprint FormGroup + InputGroup
│   └── MessageComposer.tsx         # Blueprint TextArea + Button
├── lib/
│   ├── api.ts                      # API client
│   ├── socket.ts                   # Socket.io client
│   └── utils.ts
├── styles/
│   └── globals.scss                # Custom Blueprint overrides
├── package.json
└── next.config.js
```

### Key Blueprint Components by Feature

| Feature | Blueprint Components |
|---------|---------------------|
| **Navigation** | `Navbar`, `Tree`, `Menu`, `Tabs` |
| **Activity Feed** | `Card`, `Tag`, `Icon`, `Callout` |
| **Service Control** | `Card`, `Button`, `Icon`, `Spinner`, `Tag` |
| **Config Panel** | `FormGroup`, `InputGroup`, `Switch`, `NumericInput`, `HTMLSelect` |
| **Usage Charts** | `Card` (wrapper), Recharts for actual charts |
| **User/Contact Tables** | `Table` (from @blueprintjs/table), `Cell`, `Column` |
| **Outbound Compose** | `TextArea`, `Button`, `Suggest` (for contact autocomplete) |
| **Dialogs** | `Dialog`, `Alert`, `Drawer` |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create Next.js project with Blueprint.js
- [ ] Import Blueprint CSS, configure dark theme (`bp5-dark`)
- [ ] Set up Navbar + Tree sidebar navigation
- [ ] Implement basic service status checks (agent health endpoint)
- [ ] Create dashboard layout shell with all page routes

### Phase 2: Backend Infrastructure (Week 2)
- [ ] Add dashboard API endpoints to agent-service (`/api/dashboard/*`)
- [ ] Implement LogBuffer class with Winston transport for real-time logs
- [ ] Create WebSocket events for dashboard (`dashboard:log`, `dashboard:activity`)
- [ ] Add PM2 integration for agent start/stop/restart
- [ ] Implement config file reader/writer with validation

### Phase 3: Service Monitoring (Week 3)
- [ ] PostgreSQL monitoring (connections, size, table stats via `pg_stat_*`)
- [ ] Redis monitoring (INFO command parsing, memory, keys, ops/sec)
- [ ] BlueBubbles status checks (`/api/v1/server/info`, Private API status)
- [ ] Service control UI (start/stop buttons, status indicators)
- [ ] Real-time status updates via WebSocket

### Phase 4: Logs & Debugging (Week 4)
- [ ] Log viewer with Blueprint Table (virtualized for performance)
- [ ] Log filtering by level, source, search text, date range
- [ ] Real-time log streaming via WebSocket subscription
- [ ] Debug panels (Message Flow, Tool Execution, API Calls)
- [ ] Export logs as JSON/CSV

### Phase 5: Configuration & Tuning (Week 5)
- [ ] Configuration panel with all settings (read-only first)
- [ ] Config editing with .env file writing
- [ ] Tuning presets (Economy, Balanced, Quality, Creative)
- [ ] "Restart required" indicator and Apply & Restart flow
- [ ] API key masking for security

### Phase 6: Usage & Costs (Week 6)
- [ ] Create ApiUsage database entity
- [ ] Modify AnthropicRequestManager to persist usage
- [ ] Usage dashboard with Recharts (daily, by model, by user)
- [ ] Cost calculation and display (Anthropic pricing)
- [ ] Rate limit status visualization

### Phase 7: Users & Data (Week 7)
- [ ] User list with Blueprint Table
- [ ] Conversation viewer (chat-style display)
- [ ] User detail view with message history
- [ ] Search and filtering

### Phase 8: Advanced Features (Week 8)
- [ ] macOS Contacts integration (`node-mac-contacts`)
- [ ] Outbound messaging composer with contact autocomplete
- [ ] Docker container monitoring (optional)
- [ ] Error handling, edge cases, polish

---

## Required Changes to Agent Service

### New Endpoints to Add (`/agent-service/src/index.ts`)

```typescript
// ==================== DASHBOARD API ENDPOINTS ====================

// --- Service Status & Control ---
app.get('/api/dashboard/status', dashboardStatusHandler);           // All services status
app.get('/api/dashboard/services/postgres', getPostgresStatsHandler);
app.get('/api/dashboard/services/redis', getRedisStatsHandler);
app.get('/api/dashboard/services/bluebubbles', getBlueBubblesStatusHandler);
app.post('/api/dashboard/agent/start', startAgentHandler);
app.post('/api/dashboard/agent/stop', stopAgentHandler);
app.post('/api/dashboard/agent/restart', restartAgentHandler);

// --- Configuration ---
app.get('/api/dashboard/config', getConfigHandler);                 // Get current config (sanitized)
app.put('/api/dashboard/config', updateConfigHandler);              // Update .env file
app.post('/api/dashboard/config/validate', validateConfigHandler);  // Validate before applying
app.get('/api/dashboard/config/pending', getPendingChangesHandler); // Check if restart needed

// --- Logs & Debugging ---
app.get('/api/dashboard/logs', getLogsHandler);                     // Paginated logs
app.get('/api/dashboard/logs/search', searchLogsHandler);           // Search logs
app.get('/api/dashboard/logs/export', exportLogsHandler);           // Export as JSON/CSV
// WebSocket: 'dashboard:logs:subscribe' for real-time streaming

// --- Usage & Costs ---
app.get('/api/dashboard/usage', getUsageHandler);                   // Usage summary
app.get('/api/dashboard/usage/daily', getDailyUsageHandler);        // Daily breakdown
app.get('/api/dashboard/usage/by-model', getUsageByModelHandler);   // By model
app.get('/api/dashboard/usage/by-user', getUsageByUserHandler);     // By user

// --- Users & Conversations ---
app.get('/api/dashboard/users', getUsersHandler);                   // List users
app.get('/api/dashboard/users/:id', getUserDetailHandler);          // User detail
app.get('/api/dashboard/users/:id/conversations', getUserConversationsHandler);
app.get('/api/dashboard/conversations/:id/messages', getConversationMessagesHandler);

// --- Contacts & Outbound ---
app.post('/api/dashboard/contacts/import', importContactsHandler);  // Import from macOS
app.get('/api/dashboard/contacts', getContactsHandler);             // List imported contacts
app.post('/api/dashboard/messages/send', sendMessageHandler);       // Send outbound message
```

### New Database Entity: ApiUsage

```typescript
// /agent-service/src/database/entities/ApiUsage.ts
@Entity('api_usage')
export class ApiUsage {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn()
  timestamp!: Date;

  @Column({ type: 'varchar', length: 50 })
  model!: string;

  @Column({ name: 'input_tokens', type: 'integer' })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'integer' })
  outputTokens!: number;

  @Column({ name: 'request_type', type: 'varchar', length: 50, nullable: true })
  requestType?: string;

  @Column({ name: 'cost_usd', type: 'decimal', precision: 10, scale: 6 })
  costUsd!: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
```

### WebSocket Events for Dashboard

```typescript
// In MessageRouter.ts, emit events for dashboard
io.emit('dashboard:activity', {
  type: 'message_received',
  timestamp: Date.now(),
  data: { chatId, sender, preview: text.substring(0, 50) }
});
```

---

## Dependencies to Install

### Dashboard (new project)
```bash
npx create-next-app@latest dashboard --typescript --app
cd dashboard

# Blueprint.js packages
npm install @blueprintjs/core @blueprintjs/icons @blueprintjs/table @blueprintjs/select @blueprintjs/datetime

# Additional dependencies
npm install socket.io-client recharts
npm install node-mac-contacts  # For contacts integration
npm install sass  # Blueprint uses Sass for styling
```

### Blueprint.js Setup
```typescript
// app/layout.tsx - Import Blueprint styles
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "@blueprintjs/table/lib/css/table.css";
import "@blueprintjs/select/lib/css/blueprint-select.css";
import "@blueprintjs/datetime/lib/css/blueprint-datetime.css";

// Enable dark theme
<body className="bp5-dark">
```

### Agent Service (additions)
```bash
npm install pm2  # For programmatic process control
```

---

## Security Considerations

1. **Dashboard Access:** Add authentication (simple password or session-based)
2. **API Keys:** Never expose in config responses
3. **Local Only:** Bind dashboard to localhost only
4. **CORS:** Configure for localhost:3001 → localhost:3000

---

## Next Steps

1. **Confirm this plan** with any modifications
2. **Create the dashboard Next.js project**
3. **Implement Phase 1** foundation
4. **Iterate** through remaining phases

---

*Document created: April 2026*
*Author: Cascade AI Assistant*
