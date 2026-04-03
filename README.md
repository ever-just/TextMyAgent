# TEXTMYAGENT

<p align="center">
  <strong>Your AI Executive Assistant, Available via iMessage</strong>
</p>

<p align="center">
  <em>Talk to an AI assistant over iMessage without opening a browser or installing a new app.</em>
</p>

---

## 👨‍💻 Created By

**[Weldon Makori](https://weldonmakori.com)** — Founder & Developer

TEXTMYAGENT is a passion project built to bring AI assistance to where conversations already happen: your Messages app.

---

## 🎯 What is TEXTMYAGENT?

TEXTMYAGENT transforms everyday texting into an interface for a Claude-powered executive assistant named **Grace**. The service listens for inbound iMessage/SMS traffic through [BlueBubbles](https://bluebubbles.app), enriches conversations with long-term memory, and replies in real time while managing usage, rate limits, and context budgets.

**Think of it as having a smart, always-available assistant in your pocket—accessible through the Messages app you already use every day.**

### Why BlueBubbles-First?

| Advantage | Description |
|-----------|-------------|
| 💬 **Native iMessage** | Users stay inside Messages with zero installs. No SMS short codes or clunky web chats. |
| 🧠 **Deep Integration** | Access to delivery receipts, read states, attachments, reactions, and typing indicators. |
| 🛡️ **Self-Hosted** | Everything runs on your hardware—no vendor lock-in, full credential control. |
| 🔒 **Privacy First** | Your conversations never leave your infrastructure. |

---

## ✨ Key Features & Capabilities

### 🤖 AI-Powered Conversations

- **Anthropic Claude Integration** — Powered by Claude 3.5 Sonnet/Haiku for intelligent, context-aware responses
- **Conversation Memory** — Multi-layer memory system (working/session/long-term) with automatic summarization
- **Natural Language Understanding** — Understands casual text, handles typos, interprets intent
- **Web Search** — Real-time web search for current events, weather, news, and facts
- **Adaptive Personality** — Mirrors your communication style—casual, professional, or anywhere in between

### ⏰ Reminders & Scheduling

- **Natural Language Reminders** — "Remind me to call mom tomorrow at 3pm" → Done
- **Reliable Delivery** — Bull queue-backed scheduling ensures reminders fire on time
- **Multiple Channels** — Deliver via iMessage, email, or both

### 📧 Email Integration (via AgentMail)

- **Send Emails** — "Send an email to john@example.com about the meeting"
- **Read Inbox** — "Check my emails" or "Any new messages?"
- **Reply to Emails** — "Reply to that email saying I'll be there"
- **Dedicated Agent Email** — Each user gets a unique agent email address

### 🔄 Triggers & Automation

- **Scheduled Tasks** — Create recurring or one-time automated actions
- **Execution Agents** — Spawn specialized agents for specific tasks
- **Flexible Scheduling** — "Every morning at 9am", "Every 2 hours", "Next Monday at 3pm"

### 🛠️ Extensible Tool System

Built-in tools that the AI can use autonomously:

| Tool | Description |
|------|-------------|
| `create_reminder` | Set reminders for specific times |
| `list_reminders` | View pending reminders |
| `cancel_reminder` | Remove a reminder |
| `create_trigger` | Schedule recurring automated tasks |
| `list_triggers` | View scheduled triggers |
| `update_trigger` | Modify or pause a trigger |
| `delete_trigger` | Remove a trigger |
| `send_email` | Send emails on behalf of the user |
| `list_emails` | View recent emails in inbox |
| `read_email` | Read full content of an email |
| `reply_email` | Reply to an existing email |
| `get_agent_email` | Get the agent's email address |

---

## 💬 Real-World Examples

Here are actual examples of what Grace can do, based on real usage:

### Setting Reminders
```
You: Remind me to call mom tomorrow at 3pm
Grace: done, i'll ping you at 3pm tmrw
```

### Checking Weather
```
You: weather?
Grace: 72° sunny in austin rn
```

### Sending Emails
```
You: Send an email to weldonmakori@outlook.com saying hi
Grace: sent! emailed weldonmakori@outlook.com with your message
```

### Scheduling Automated Tasks
```
You: Every morning at 9am, send me a summary of my day
Grace: done, trigger set for 9am daily
```

### Quick Acknowledgments
```
You: thanks
Grace: 👍
```

### Casual Conversation
```
You: hey
Grace: hey

You: what's up
Grace: not much, what do you need?
```

### Multi-Bubble Responses
```
You: What's on my calendar today?
Grace: 10am design sync
       2pm investor call
       nothing else scheduled
```

### Web Search
```
You: What's the latest news about AI?
Grace: [searches web and provides current information]
```

---

## 🏗️ Architecture Overview

```
TEXTMYAGENT/
├── agent-service/                 # Node/TypeScript core application
│   ├── src/
│   │   ├── agents/               # Dual-agent system (Interaction + Execution)
│   │   │   ├── prompts/          # Grace system prompt & personality
│   │   │   ├── InteractionAgent  # Handles user conversations
│   │   │   └── ExecutionAgent    # Handles tool execution
│   │   ├── config/               # Runtime configuration
│   │   ├── database/             # TypeORM entities & migrations
│   │   │   ├── entities/         # User, Reminder, Trigger, Message
│   │   │   └── connection.ts     # Database connection management
│   │   ├── handlers/             # Message preprocessing pipeline
│   │   ├── integrations/         # BlueBubbles client, AgentMail
│   │   ├── services/             # Core business logic
│   │   │   ├── MessageRouter     # Message orchestration
│   │   │   ├── ClaudeServiceEnhanced  # Claude API with tools
│   │   │   ├── ReminderService   # Reminder scheduling
│   │   │   ├── TriggerService    # Automation triggers
│   │   │   └── ContextService    # User context & memory
│   │   ├── tools/                # Tool registry & implementations
│   │   └── utils/                # Logging, metrics, helpers
│   └── docker-compose.yml        # Local dev dependencies
├── bluebubbles-server/           # BlueBubbles server (reference)
├── docs/                         # Documentation
│   ├── guides/                   # Setup & migration guides
│   ├── operations/               # Runbooks & deployment
│   └── notes/                    # Research & planning
└── README.md                     # You are here
```

### Core Services

| Service | Responsibility |
|---------|----------------|
| **MessageRouter** | Cleans inbound messages, assembles context, coordinates Claude calls, dispatches replies |
| **ClaudeServiceEnhanced** | Wraps Anthropic Claude with streaming, tool loops, and request management |
| **AnthropicRequestManager** | Enforces rate limits, retry/backoff, notifies admins on quota exhaustion |
| **ConversationSummarizer** | Compresses history when token usage approaches thresholds |
| **ReminderService** | Natural language parsing + Bull queue for reliable reminder delivery |
| **TriggerService** | Manages scheduled automation triggers |
| **ContextService** | Loads user profiles, preferences, and memory highlights |

---

## 🚀 Getting Started

### Prerequisites

- **macOS** host with iMessage signed in (required by BlueBubbles)
- **Node.js 18+**
- **Docker Desktop** (for Postgres & Redis)
- **Anthropic API key** with Claude access
- **BlueBubbles Server** running and configured

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/ever-just/bluebubbles-ai-agent.git
cd bluebubbles-ai-agent/agent-service

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configure Environment

Edit `.env` with your credentials:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
BLUEBUBBLES_URL=http://localhost:1234
BLUEBUBBLES_PASSWORD=your-password
DATABASE_URL=postgres://postgres:password@localhost:5432/agent_db
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=your-32-char-key
SESSION_SECRET=your-session-secret

# Optional - Email Integration
AGENTMAIL_API_KEY=am_...
AGENTMAIL_ENABLED=true

# Optional - Model Configuration
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_RESPONSE_MAX_TOKENS=600
ANTHROPIC_ENABLE_WEB_SEARCH=true
```

### Start the Service

```bash
# Start database and Redis
docker-compose up -d

# Development mode (with hot reload)
npm run dev

# Production mode
npm run build && npm start
```

### Verify It's Working

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected",
    "bluebubbles": "connected"
  }
}
```

---

## ⚙️ Configuration Reference

### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging verbosity | `info` |

### Anthropic (Claude AI)

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `ANTHROPIC_MODEL` | Model to use | `claude-3-5-haiku-latest` |
| `ANTHROPIC_RESPONSE_MAX_TOKENS` | Max response tokens | `350` |
| `ANTHROPIC_TEMPERATURE` | Response creativity | `0.7` |
| `ANTHROPIC_ENABLE_WEB_SEARCH` | Enable web search | `true` |
| `ANTHROPIC_ENABLE_WEB_FETCH` | Enable web fetch (beta) | `false` |
| `ANTHROPIC_SUMMARY_TRIGGER_TOKENS` | When to summarize | `5500` |
| `ANTHROPIC_CONTEXT_WINDOW_TOKENS` | Context budget | `7000` |

### BlueBubbles

| Variable | Description | Default |
|----------|-------------|---------|
| `BLUEBUBBLES_URL` | Server URL | Required |
| `BLUEBUBBLES_PASSWORD` | Server password | Required |
| `BLUEBUBBLES_SEND_ENABLED` | Allow sending messages | `true` |
| `BLUEBUBBLES_MARK_CHATS_READ` | Auto-mark as read | `true` |

### Email (AgentMail)

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTMAIL_API_KEY` | AgentMail API key | — |
| `AGENTMAIL_ENABLED` | Enable email features | `false` |
| `AGENTMAIL_DEFAULT_DOMAIN` | Email domain | `agentmail.to` |

### Dual-Agent System

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_DUAL_AGENT` | Enable dual-agent mode | `false` |
| `AGENT_EXECUTION_TIMEOUT_SECONDS` | Tool execution timeout | `90` |
| `AGENT_MAX_TOOL_ITERATIONS` | Max tool calls per turn | `8` |

---

## 🔐 Security Best Practices

1. **Never commit `.env`** — It's gitignored by default
2. **Rotate credentials regularly** — Claude API keys, BlueBubbles password
3. **Restrict database access** — Use managed services or firewall rules in production
4. **Enable rate limiting** — Protect public endpoints from abuse
5. **Use HTTPS** — Encrypt traffic in production deployments

---

## 📊 Observability & Monitoring

### Structured Logging

All logs include metadata for debugging and cost tracking:

```json
{
  "level": "info",
  "message": "Claude response received",
  "timestamp": "2026-04-03T20:15:00.000Z",
  "tokensUsed": 245,
  "model": "claude-sonnet-4-5-20250929",
  "toolsUsed": ["create_reminder"]
}
```

### Health Checks

- `GET /health` — Service health with dependency status
- Database, Redis, and BlueBubbles connectivity monitored
- Graceful degradation when services are unavailable

### Admin Alerts

- Rate limit exhaustion notifications via iMessage
- Critical error escalation to admin phones
- Retry-after handling respects Anthropic headers

---

## 🗺️ Roadmap

- [ ] **WhatsApp/Telegram/Slack** — Additional messaging channels
- [ ] **RAG/Vector Search** — Knowledge retrieval for richer answers
- [ ] **Multi-Tenant** — Per-user memories, billing, access controls
- [ ] **Analytics Dashboard** — Usage visualization, latency tracking
- [ ] **Voice Messages** — Transcription and voice response support
- [ ] **Calendar Integration** — Google/Apple Calendar sync
- [ ] **Image Understanding** — Vision capabilities for photo analysis

---

## 📚 Documentation

| Directory | Contents |
|-----------|----------|
| `docs/guides/` | Setup guides, migrations, checklists |
| `docs/operations/` | Runbooks, deployment notes |
| `docs/templates/` | Status/report templates |
| `docs/notes/` | Research plans, findings |

---

## 🙌 Credits & Acknowledgments

### Creator
- **[Weldon Makori](https://weldonmakori.com)** — Project creator and lead developer

### Technologies
- **[BlueBubbles](https://bluebubbles.app/)** — macOS-to-messaging bridge
- **[Anthropic Claude](https://www.anthropic.com/)** — Conversational AI intelligence
- **[AgentMail](https://agentmail.to/)** — Email infrastructure for AI agents
- **[TypeORM](https://typeorm.io/)** — Database ORM
- **[Bull](https://github.com/OptimalBits/bull)** — Redis-based job queue
- **[chrono-node](https://github.com/wanasit/chrono)** — Natural language date parsing

### Inspiration
Built for founders and operators who want a dependable AI teammate that fits existing communication workflows—no new apps, no context switching, just text.

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 📋 Changelog

### [Unreleased]
- Fixed Apple Cocoa timestamp conversion for test message injection
- Improved backlog protection for message processing

### [1.4.0] - April 2026
- Added dual-agent system (Interaction + Execution agents)
- Implemented AgentMail email integration
- Added trigger/automation system for scheduled tasks
- Enhanced web search capabilities

### [1.3.0] - March 2026
- Event-driven typing indicators
- Duplicate message prevention cache
- Improved conversation summarization
- Private API read receipt support

### [1.2.0] - February 2026
- Tool registry system with extensible tools
- Reminder service with natural language parsing
- Context service for user memory/preferences
- Rate limiting and request management

### [1.1.0] - January 2026
- BlueBubbles webhook integration
- Claude 3.5 Sonnet/Haiku support
- Basic conversation history
- Health monitoring endpoints

### [1.0.0] - December 2025
- Initial release
- Basic iMessage ↔ Claude integration
- PostgreSQL + Redis infrastructure
- Express server with WebSocket support

---

<p align="center">
  <strong>TEXTMYAGENT</strong><br>
  <em>Your AI assistant, one text away.</em>
</p>

<p align="center">
  <a href="https://github.com/ever-just/bluebubbles-ai-agent">GitHub</a> •
  <a href="https://weldonmakori.com">Creator</a>
</p>
