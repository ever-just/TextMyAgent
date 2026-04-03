---
layout: default
title: Setup Guide
description: Complete step-by-step installation guide for TEXTMYAGENT
---

# Complete Setup Guide

This guide walks you through setting up TEXTMYAGENT from scratch.

---

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **macOS** (required for iMessage access)
- [ ] **iMessage signed in** on your Mac
- [ ] **Node.js 18+** — [Download](https://nodejs.org/)
- [ ] **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop/)
- [ ] **Anthropic API key** — [Get one](https://console.anthropic.com/)
- [ ] **BlueBubbles Server** — [Download](https://bluebubbles.app/)

---

## Step 1: Install BlueBubbles Server

BlueBubbles is the bridge between iMessage and TEXTMYAGENT.

1. **Download** BlueBubbles Server from [bluebubbles.app](https://bluebubbles.app/)

2. **Install** the app and open it

3. **Grant permissions** when prompted:
   - **Full Disk Access**: System Preferences → Security & Privacy → Privacy → Full Disk Access
   - **Accessibility**: System Preferences → Security & Privacy → Privacy → Accessibility

4. **Complete the setup wizard**:
   - Sign in with your Apple ID if prompted
   - Choose a server password (you'll need this later)
   - Note your server URL (usually `http://localhost:1234`)

5. **Enable Private API** (recommended):
   - Go to Settings → Private API
   - Follow the instructions to enable
   - This enables read receipts and typing indicators

6. **Verify it's working**:
   - You should see "Server Running" in the app
   - Test by sending yourself a message

---

## Step 2: Clone the Repository

```bash
# Clone the repo
git clone https://github.com/ever-just/bluebubbles-ai-agent.git

# Navigate to the project
cd bluebubbles-ai-agent
```

---

## Step 3: Install Dependencies

```bash
# Go to the agent service directory
cd agent-service

# Install Node.js dependencies
npm install
```

This installs all required packages including:
- Express (web server)
- Anthropic SDK (Claude AI)
- TypeORM (database)
- Bull (job queues)
- Socket.io (real-time communication)

---

## Step 4: Start Docker Services

TEXTMYAGENT requires PostgreSQL and Redis:

```bash
# Start the containers
docker-compose up -d

# Verify they're running
docker ps
```

You should see:
```
CONTAINER ID   IMAGE              STATUS         PORTS                    NAMES
xxxxxxxxxxxx   postgres:15        Up X minutes   0.0.0.0:5432->5432/tcp   agent-postgres
xxxxxxxxxxxx   redis:7-alpine     Up X minutes   0.0.0.0:6379->6379/tcp   agent-redis
```

---

## Step 5: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Open in your editor
nano .env  # or code .env, vim .env, etc.
```

### Required Variables

```env
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE

# BlueBubbles Connection
BLUEBUBBLES_URL=http://localhost:1234
BLUEBUBBLES_PASSWORD=your-bluebubbles-password

# Database (default Docker setup)
DATABASE_URL=postgres://postgres:password@localhost:5432/agent_db

# Redis (default Docker setup)
REDIS_URL=redis://localhost:6379

# Security Keys (see Step 6)
ENCRYPTION_KEY=your-32-character-key
SESSION_SECRET=your-session-secret
```

### Optional Variables

```env
# Claude Model (default: claude-3-5-haiku-latest)
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# Response Settings
ANTHROPIC_RESPONSE_MAX_TOKENS=600
ANTHROPIC_TEMPERATURE=0.7

# Web Search (enabled by default)
ANTHROPIC_ENABLE_WEB_SEARCH=true

# Email Integration
AGENTMAIL_API_KEY=am_your-key
AGENTMAIL_ENABLED=true

# Dual-Agent System
ENABLE_DUAL_AGENT=true
```

---

## Step 6: Generate Security Keys

Run these commands to generate secure random keys:

```bash
# Generate ENCRYPTION_KEY (32 characters hex)
openssl rand -hex 16
# Output example: 9aeb904c919f06a622daf9a281cb7cbd

# Generate SESSION_SECRET (base64)
openssl rand -base64 32
# Output example: 75cv3ZoXgeI3Gt+ZGt47XjIcr2icDlDBpK9Z6oal8oM=
```

Copy these values into your `.env` file.

---

## Step 7: Start the Agent

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Expected Output

```
{"level":"info","message":"Database connected","timestamp":"..."}
{"level":"info","message":"Redis connected","timestamp":"..."}
{"level":"info","message":"Connected to BlueBubbles server","timestamp":"..."}
{"level":"info","message":"🚀 Server running on port 3000","timestamp":"..."}
{"level":"info","message":"📝 Environment: development","timestamp":"..."}
{"level":"info","message":"🔗 BlueBubbles URL: http://localhost:1234","timestamp":"..."}
```

---

## Step 8: Verify Everything Works

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

---

## Step 9: Configure BlueBubbles Webhooks

1. Open **BlueBubbles Server**

2. Go to **Settings** → **API & Webhooks**

3. Click **Add Webhook**

4. Configure:
   - **URL**: `http://localhost:3000/webhook/messages`
   - **Events**: Check "New Message"

5. **Save** the webhook

6. **Test** by clicking "Send Test" (optional)

---

## Step 10: Test It!

Send a text message to your Mac's phone number from another device (or use another Apple ID).

You should see:
1. The message appear in BlueBubbles
2. Logs in your terminal showing processing
3. A response sent back via iMessage

### Quick Test (without another device)

```bash
curl -X POST http://localhost:3000/api/inject-message \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello Grace!","phoneNumber":"+15551234567"}'
```

---

## 🔧 Troubleshooting

### "Database connection refused"

```bash
# Check Docker containers
docker ps

# Restart if needed
docker-compose down
docker-compose up -d
```

### "BlueBubbles not connected"

1. Verify BlueBubbles Server is running
2. Check the URL in `.env` matches BlueBubbles
3. Verify the password is correct
4. Ensure BlueBubbles has Full Disk Access

### "Anthropic API error"

1. Verify your API key is correct (starts with `sk-ant-`)
2. Check you have API credits at [console.anthropic.com](https://console.anthropic.com)
3. Ensure the model name is valid

### "Messages not being received"

1. Check BlueBubbles webhook is configured
2. Verify webhook URL is `http://localhost:3000/webhook/messages`
3. Check agent logs for errors
4. Ensure the agent is running

### "Port 3000 already in use"

```bash
# Find what's using the port
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

---

## 📁 Project Structure

```
bluebubbles-ai-agent/
├── agent-service/           # Main application
│   ├── src/                 # TypeScript source
│   │   ├── agents/          # AI agent logic
│   │   │   └── prompts/     # System prompts
│   │   ├── services/        # Business logic
│   │   ├── tools/           # AI tools
│   │   └── index.ts         # Entry point
│   ├── dist/                # Compiled JS
│   ├── .env                 # Your config (not in git)
│   ├── .env.example         # Example config
│   └── docker-compose.yml   # Docker services
├── docs/                    # Documentation
└── README.md                # Overview
```

---

## 🔒 Security Notes

1. **Never commit `.env`** — It's gitignored
2. **Rotate keys regularly** — API keys, passwords
3. **Firewall in production** — Restrict database/Redis access
4. **Use HTTPS** — For production deployments

---

## Next Steps

- [Customize the AI Personality](PROMPT_CUSTOMIZATION.md)
- [Configure Email Integration](MIGRATION-GUIDE.md#email-setup)
- [Set Up Automation Triggers](MIGRATION-GUIDE.md#triggers)

---

<p align="center">
  <em>Created by <a href="https://weldonmakori.com">Weldon Makori</a></em>
</p>
