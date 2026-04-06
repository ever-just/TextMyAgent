# BlueBubbles AI Agent (Legacy)

> ⚠️ **This is the legacy SaaS version.** For the new desktop app, see [textmyagent-desktop](https://github.com/ever-just/textmyagent-desktop).

## Overview

This repository contains the original BlueBubbles-based AI agent service. It was designed as a cloud-hosted SaaS that connects to BlueBubbles Server for iMessage integration.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  BlueBubbles    │────▶│  Agent Service   │────▶│  Claude API     │
│  Server (Mac)   │◀────│  (Node.js)       │◀────│  (Anthropic)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                      │
         │                      ▼
         │              ┌──────────────────┐
         │              │  PostgreSQL      │
         │              │  + Redis         │
         │              └──────────────────┘
         ▼
┌─────────────────┐
│  Messages.app   │
│  (on Mac)       │
└─────────────────┘
```

## Components

| Directory | Description |
|-----------|-------------|
| `agent-service/` | Node.js backend service |
| `bluebubbles-server/` | BlueBubbles server (reference) |
| `bluebubbles-app/` | BlueBubbles client (reference) |
| `docs/` | Documentation website |

## Key Differences from Desktop Version

| Feature | Legacy (SaaS) | Desktop |
|---------|---------------|---------|
| Hosting | Cloud server | Local Mac |
| iMessage | Via BlueBubbles API | Direct database access |
| Database | PostgreSQL + Redis | SQLite |
| Setup | Complex (server + client) | Simple (one app) |
| Privacy | Data on server | Data stays local |

## Status

This version is **archived**. Active development has moved to [textmyagent-desktop](https://github.com/ever-just/textmyagent-desktop).

## Version History

- **v1.5.0** - Final SaaS release with API usage tracking
- **v1.4.x** - Dashboard enhancements
- **v1.3.x** - Tool support and context management
- **v1.2.x** - Conversation summarization
- **v1.1.x** - Initial BlueBubbles integration
- **v1.0.x** - Initial release
