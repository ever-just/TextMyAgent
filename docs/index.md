---
layout: default
title: TEXTMYAGENT
description: Your AI Executive Assistant, Available via iMessage
---

# TEXTMYAGENT

<p align="center">
  <strong>Your AI Executive Assistant, Available via iMessage</strong><br>
  <em>Talk to an AI assistant over iMessage without opening a browser or installing a new app.</em>
</p>

---

## 👨‍💻 Created By

**[Weldon Makori](https://weldonmakori.com)** — Founder & Developer

---

## 🎯 What is TEXTMYAGENT?

TEXTMYAGENT transforms everyday texting into an interface for a Claude-powered executive assistant named **Grace**. The service listens for inbound iMessage/SMS traffic through [BlueBubbles](https://bluebubbles.app), enriches conversations with long-term memory, and replies in real time.

**Think of it as having a smart, always-available assistant in your pocket—accessible through the Messages app you already use every day.**

---

## ✨ Key Features

### 🤖 AI-Powered Conversations
- Powered by **Anthropic Claude** for intelligent, context-aware responses
- Multi-layer memory system with automatic summarization
- Real-time web search for current events and information
- Adaptive personality that mirrors your communication style

### ⏰ Reminders & Scheduling
- Natural language reminders: *"Remind me to call mom tomorrow at 3pm"*
- Reliable Bull queue-backed scheduling
- Delivery via iMessage or email

### 📧 Email Integration
- Send, read, and reply to emails via text
- Dedicated agent email address
- Powered by AgentMail

### 🔄 Automation & Triggers
- Schedule recurring or one-time automated tasks
- Flexible scheduling with natural language

---

## 💬 Example Conversations

```
You: Remind me to call mom tomorrow at 3pm
Grace: done, i'll ping you at 3pm tmrw
```

```
You: weather?
Grace: 72° sunny in austin rn
```

```
You: Send an email to john@example.com about the meeting
Grace: sent! emailed john@example.com with your message
```

```
You: thanks
Grace: 👍
```

---

## 🛠️ Built-in Tools

| Tool | Description |
|------|-------------|
| `create_reminder` | Set reminders for specific times |
| `list_reminders` | View pending reminders |
| `cancel_reminder` | Remove a reminder |
| `create_trigger` | Schedule recurring automated tasks |
| `send_email` | Send emails on behalf of the user |
| `list_emails` | View recent emails in inbox |
| `read_email` | Read full content of an email |
| `reply_email` | Reply to an existing email |

---

## 🚀 Quick Start

### Prerequisites
- macOS with iMessage signed in
- Node.js 18+
- Docker Desktop
- Anthropic API key
- BlueBubbles Server

### Installation

```bash
# Clone the repository
git clone https://github.com/ever-just/bluebubbles-ai-agent.git
cd bluebubbles-ai-agent/agent-service

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start services
docker-compose up -d
npm run dev
```

### Verify Installation

```bash
curl http://localhost:3000/health
```

---

## 📚 Documentation

- [**Setup Guide**](guides/SETUP.md) — Complete installation instructions
- [**Prompt Customization**](guides/PROMPT_CUSTOMIZATION.md) — Customize the AI personality
- [**Migration Guide**](guides/MIGRATION-GUIDE.md) — Upgrading between versions
- [**Architecture**](architecture/) — System design and components

---

## 🔗 Links

- [GitHub Repository](https://github.com/ever-just/bluebubbles-ai-agent)
- [Latest Release](https://github.com/ever-just/bluebubbles-ai-agent/releases/latest)
- [BlueBubbles](https://bluebubbles.app/)
- [Anthropic Claude](https://www.anthropic.com/)

---

## 📋 Changelog

### v1.4.0 (April 2026)
- Email integration via AgentMail
- Triggers & automation system
- Dual-agent architecture
- Enhanced web search

### v1.3.0 (March 2026)
- Event-driven typing indicators
- Duplicate message prevention
- Private API read receipts

### v1.2.0 (February 2026)
- Tool registry system
- Reminder service
- Context service

### v1.1.0 (January 2026)
- BlueBubbles webhooks
- Claude 3.5 support

### v1.0.0 (December 2025)
- Initial release

---

<p align="center">
  <strong>TEXTMYAGENT</strong><br>
  <em>Your AI assistant, one text away.</em><br><br>
  Created by <a href="https://weldonmakori.com">Weldon Makori</a>
</p>
