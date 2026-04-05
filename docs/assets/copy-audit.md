# Copy Audit: better-auth vs TEXTMYAGENT

## better-auth Copy Patterns

### Hero
- **Headline**: "The most comprehensive authentication framework"
- **Pattern**: Bold claim, no fluff, states what it is
- **CTA**: "Get Started" + "Sign In"

### Feature Cards (numbered 01-09)
| # | Title | Description Pattern |
|---|-------|---------------------|
| 01 | Framework Agnostic | "Works with your stack." + list of frameworks |
| 02 | Email & Password | "Built-in credential auth." + what's included |
| 03 | Social Sign-on | "40+ social providers." + examples |
| 04 | Organizations | "Multi-tenancy built in." + features |
| 05 | Enterprise | "SSO, SAML & SCIM." + B2B features |
| 06 | Plugins | "50+ and growing." + examples |
| 07 | Agent Auth | "Auth for AI agents." + technical features |
| 08 | Infrastructure | "Security & observability." + what it does |
| 09 | Dashboard | "User management." + capabilities |

**Pattern**: Short punchy title + one-line description + feature list or visual

### Tone
- Technical but accessible
- Confident, not boastful
- No emojis
- Uses "you/your" frequently
- Short sentences
- Code examples inline

---

## Current TEXTMYAGENT Copy

### Hero
- **Headline**: "Text your agent"
- **Subhead**: "Imagine having a brilliant executive assistant who's always available — via the Messages app you already use. No apps. No logins. Just text."
- **Issue**: Too long, too soft

### Features (current)
| Icon | Title | Description |
|------|-------|-------------|
| R | Smart Reminders | "Remind me to call mom tomorrow at 3pm" — natural language, reliable delivery. |
| E | Email Integration | Send, read, and reply to emails via text. Your assistant has its own email address. |
| A | Automation Triggers | "Every morning at 9am, send me a summary." Recurring tasks, handled. |
| S | Web Search | Real-time search for weather, news, facts. Always current information. |
| M | Memory | Remembers your preferences and past conversations. Gets smarter over time. |
| P | Self-Hosted | Runs on your Mac. Your data stays on your hardware. Full control. |

**Issues**: 
- Random letter icons (not numbered)
- Descriptions are okay but inconsistent length
- Missing the "what it enables" angle

---

## New Copy Draft

### Hero
**Headline**: "The open-source iMessage AI agent"
**Subhead**: "Your assistant lives in Messages. Set reminders, send emails, search the web — all via text."
**Install**: `git clone https://github.com/ever-just/TextMyAgent && npm start`
**CTAs**: [Text Demo] [Get Started] [GitHub]

### Features (numbered, better-auth style)

| # | Title | Short | Description |
|---|-------|-------|-------------|
| 01 | iMessage Native | Lives in Messages. | No app to install. Text your Mac's number and your AI responds. Works with any iPhone, iPad, or Mac. |
| 02 | Smart Reminders | Natural language scheduling. | "Remind me to call mom at 3pm" — parsed, scheduled, delivered. Supports recurring and one-time. |
| 03 | Email Integration | Send and read via text. | Your agent has its own inbox. Forward emails, draft replies, send messages — all through iMessage. |
| 04 | Automation Triggers | Recurring tasks, handled. | "Every morning at 9am, send me a summary." Set it once, runs forever. Cron-like power, chat-like setup. |
| 05 | Persistent Memory | Remembers everything. | Preferences, past conversations, context. Your AI gets smarter the more you use it. |
| 06 | Self-Hosted | Your Mac, your data. | Runs locally on macOS. Nothing leaves your hardware unless you want it to. Full control, full privacy. |

### Quick Start Section
**Headline**: "Get started in 5 minutes"
**Subhead**: "Clone, configure, run. Or let AI do it for you."

### Comparisons Section
**Headline**: "How we compare"
**Subhead**: "Honest takes on alternatives."

(Keep existing comparison content but tighten prose)

### Footer
"Built by Weldon Makori · Open source on GitHub · v1.4.0"

---

## Tone Guidelines for New Site

1. **Be direct** — State what it does, not what it could do
2. **Be technical** — Users are developers or power users
3. **Be honest** — Acknowledge limitations (macOS only, requires setup)
4. **Be brief** — One sentence per concept
5. **No emojis** — Clean, professional
6. **Show code** — Terminal commands, config snippets
7. **Use numbers** — "5 minutes", "6 features", "01, 02, 03"
