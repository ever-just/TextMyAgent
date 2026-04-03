# TEXTMYAGENT v1.4.0 Release

**Release Date:** April 3, 2026  
**Created by:** [Weldon Makori](https://weldonmakori.com)

---

## 🎉 What's New in v1.4.0

This release brings major new capabilities to TEXTMYAGENT, including email integration, automated triggers, and a dual-agent architecture for more reliable tool execution.

### ✨ New Features

- **📧 Email Integration (AgentMail)** — Send, read, and reply to emails directly via iMessage
- **🔄 Triggers & Automation** — Schedule recurring or one-time automated tasks
- **🤖 Dual-Agent System** — Separate Interaction and Execution agents for better reliability
- **🔍 Enhanced Web Search** — Real-time web search for current events, weather, and news
- **⚡ Event-Driven Typing Indicators** — More responsive typing feedback

### 🛠️ Improvements

- Duplicate message prevention cache
- Improved conversation summarization
- Private API read receipt support
- Better error handling and recovery

---

## 📋 Complete Setup Guide

Follow these steps to get TEXTMYAGENT running on your Mac.

### Prerequisites

Before you begin, make sure you have:

- [ ] **macOS** (required for iMessage access)
- [ ] **iMessage signed in** on your Mac
- [ ] **Node.js 18+** installed ([download](https://nodejs.org/))
- [ ] **Docker Desktop** installed ([download](https://www.docker.com/products/docker-desktop/))
- [ ] **Anthropic API key** ([get one](https://console.anthropic.com/))
- [ ] **BlueBubbles Server** installed and running ([download](https://bluebubbles.app/))

---

### Step 1: Install BlueBubbles Server

1. Download BlueBubbles Server from [bluebubbles.app](https://bluebubbles.app/)
2. Install and open the app
3. Complete the setup wizard:
   - Grant Full Disk Access in System Preferences → Security & Privacy → Privacy
   - Grant Accessibility access
   - Sign in with your Apple ID if prompted
4. Note your **server URL** (usually `http://localhost:1234`)
5. Set a **server password** in BlueBubbles settings
6. Enable **Private API** for full features (optional but recommended)

### Step 2: Clone the Repository

```bash
# Clone the repo
git clone https://github.com/ever-just/bluebubbles-ai-agent.git

# Navigate to the project
cd bluebubbles-ai-agent
```

### Step 3: Install Dependencies

```bash
# Go to the agent service directory
cd agent-service

# Install Node.js dependencies
npm install
```

### Step 4: Start Docker Services

```bash
# Start PostgreSQL and Redis containers
docker-compose up -d

# Verify containers are running
docker ps
```

You should see two containers running:
- `agent-postgres` (PostgreSQL database)
- `agent-redis` (Redis for job queues)

### Step 5: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Open .env in your editor
nano .env  # or use any text editor
```

Fill in the required values:

```env
# ============================================
# REQUIRED CONFIGURATION
# ============================================

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE

# BlueBubbles Connection
BLUEBUBBLES_URL=http://localhost:1234
BLUEBUBBLES_PASSWORD=your-bluebubbles-password

# Database (default Docker setup)
DATABASE_URL=postgres://postgres:password@localhost:5432/agent_db

# Redis (default Docker setup)
REDIS_URL=redis://localhost:6379

# Security Keys (generate random strings)
ENCRYPTION_KEY=generate-a-32-character-string-here
SESSION_SECRET=generate-another-random-string-here

# ============================================
# OPTIONAL CONFIGURATION
# ============================================

# Claude Model (default: claude-3-5-haiku-latest)
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# Response Settings
ANTHROPIC_RESPONSE_MAX_TOKENS=600
ANTHROPIC_TEMPERATURE=0.7

# Web Search (enabled by default)
ANTHROPIC_ENABLE_WEB_SEARCH=true

# Email Integration (optional)
AGENTMAIL_API_KEY=am_your-agentmail-key
AGENTMAIL_ENABLED=true

# Dual-Agent System (experimental)
ENABLE_DUAL_AGENT=true
```

### Step 6: Generate Security Keys

Run these commands to generate secure random keys:

```bash
# Generate ENCRYPTION_KEY (32 characters)
openssl rand -hex 16

# Generate SESSION_SECRET
openssl rand -base64 32
```

Copy the output and paste into your `.env` file.

### Step 7: Start the Agent

```bash
# Development mode (with auto-reload)
npm run dev

# OR Production mode
npm run build && npm start
```

### Step 8: Verify Everything is Working

```bash
# Check the health endpoint
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-03T20:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "bluebubbles": "connected"
  }
}
```

### Step 9: Configure BlueBubbles Webhooks

1. Open BlueBubbles Server
2. Go to **Settings** → **API & Webhooks**
3. Add a new webhook:
   - **URL:** `http://localhost:3000/webhook/messages`
   - **Events:** Select "New Message"
4. Save the webhook

### Step 10: Test It!

Send a text message to your Mac's phone number from another device. You should see:
1. The message appear in BlueBubbles
2. Logs in your terminal showing the message being processed
3. A response sent back via iMessage

---

## 🧪 Quick Test Commands

```bash
# Inject a test message (for development)
curl -X POST http://localhost:3000/api/inject-message \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello Grace!","phoneNumber":"+15551234567"}'

# Check health
curl http://localhost:3000/health

# View logs (if running in background)
tail -f logs/agent.log
```

---

## 🔧 Troubleshooting

### "Database connection refused"
```bash
# Make sure Docker containers are running
docker-compose up -d

# Check container status
docker ps
```

### "BlueBubbles not connected"
1. Verify BlueBubbles Server is running
2. Check the URL and password in `.env`
3. Ensure BlueBubbles has Full Disk Access

### "Anthropic API error"
1. Verify your API key is correct
2. Check you have API credits available
3. Ensure the model name is valid

### "Messages not being received"
1. Check BlueBubbles webhook is configured
2. Verify the webhook URL is correct
3. Check the agent logs for errors

---

## 📁 Project Structure

```
bluebubbles-ai-agent/
├── agent-service/           # Main application
│   ├── src/                 # TypeScript source code
│   ├── dist/                # Compiled JavaScript
│   ├── .env                 # Your configuration (not in git)
│   ├── .env.example         # Example configuration
│   ├── docker-compose.yml   # Docker services
│   └── package.json         # Dependencies
├── docs/                    # Documentation
├── README.md                # Project overview
└── RELEASE_NOTES.md         # This file
```

---

## 🔗 Useful Links

- **GitHub Repository:** https://github.com/ever-just/bluebubbles-ai-agent
- **BlueBubbles:** https://bluebubbles.app/
- **Anthropic Console:** https://console.anthropic.com/
- **AgentMail:** https://agentmail.to/
- **Creator:** https://weldonmakori.com

---

## 📝 Full Changelog

### [1.4.0] - April 2026
- Added dual-agent system (Interaction + Execution agents)
- Implemented AgentMail email integration
- Added trigger/automation system for scheduled tasks
- Enhanced web search capabilities
- Fixed Apple Cocoa timestamp conversion

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
  <strong>TEXTMYAGENT v1.4.0</strong><br>
  <em>Your AI assistant, one text away.</em><br><br>
  Created by <a href="https://weldonmakori.com">Weldon Makori</a>
</p>
