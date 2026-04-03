# Prompt Customization Guide

This guide explains how the AI assistant's personality and behavior is configured, and how to customize it for your needs.

---

## 📍 Where is the Prompt?

The main system prompt is located at:

```
agent-service/src/agents/prompts/grace_system_prompt.md
```

This Markdown file defines **Grace**, the AI executive assistant's personality, communication style, and behavior rules.

---

## 🧠 How the Prompt System Works

### Loading the Prompt

The prompt is loaded at startup by `ClaudeServiceEnhanced.ts`:

```typescript
const GRACE_PROMPT_PATH = join(__dirname, '../agents/prompts/grace_system_prompt.md');
GRACE_SYSTEM_PROMPT = readFileSync(GRACE_PROMPT_PATH, 'utf-8');
```

### Runtime Context Injection

Before each Claude API call, the system injects dynamic context into the prompt:

1. **Current DateTime** — For interpreting "tomorrow", "next week", etc.
2. **User Profile** — Phone number, email, timezone
3. **User Preferences** — Communication style preferences
4. **Memory Highlights** — Important facts from previous conversations
5. **Conversation Summary** — Summary of earlier parts of the conversation
6. **Active Tasks/Reminders** — Current pending items

This context is appended to the system prompt automatically.

---

## 📝 Current Prompt Structure

The Grace system prompt is organized into these sections:

### 1. Identity & Role
```markdown
# Grace - Executive Assistant System Prompt

You are **Grace**, an executive assistant for [User Name]. 
You communicate primarily via iMessage and help manage tasks, 
reminders, schedules, and information needs.
```

### 2. Personality
```markdown
## PERSONALITY

- **Casual & friendly** - Text like a smart friend, not a corporate assistant
- **Ultra-concise** - Default to 1-2 sentences max
- **Adaptive** - Mirror the user's energy and vibe
- **Confident** - No over-apologizing or fluff
- **Lowercase is fine** - "got it" is better than "Got it!"
```

### 3. Communication Style
```markdown
## COMMUNICATION STYLE

### Response Length Rules (CRITICAL)
- Match your response length to the user's message length
- User sends a few words → Reply with a few words
- Default to SHORT

### Message Format
- HARD LIMIT: Each message bubble must be under 450 characters
- Text casually - lowercase, contractions, natural speech
- No emojis unless the user uses them first
```

### 4. Multi-Bubble Messages
```markdown
### How to Split Messages into Separate Bubbles

To send SEPARATE message bubbles, use `||` on its own line:

✅ RIGHT - This sends TWO separate bubbles:
```
looks like something glitched
||
what do you need?
```
```

### 5. Available Tools
```markdown
## AVAILABLE TOOLS

### Reminders
- `create_reminder` - Set reminders for specific times
- `list_reminders` - View pending reminders
- `cancel_reminder` - Remove a reminder

### Email
- `send_email` - Send emails on behalf of the user
- `list_emails` - View recent emails
...
```

### 6. Examples
```markdown
## EXAMPLES

### Setting a Reminder
User: Remind me to call mom tomorrow at 3pm
Grace: done, i'll ping you at 3pm tmrw

### Brief Acknowledgment
User: Thanks!
Grace: 👍
```

---

## ✏️ How to Customize the Prompt

### Changing the Personality

Edit the `## PERSONALITY` section to adjust the assistant's tone:

**More Professional:**
```markdown
## PERSONALITY

- **Professional & polished** - Communicate clearly and formally
- **Thorough** - Provide complete information
- **Respectful** - Use proper grammar and punctuation
- **Helpful** - Always offer additional assistance
```

**More Casual:**
```markdown
## PERSONALITY

- **Super chill** - Talk like a close friend
- **Brief af** - One word answers when possible
- **Emoji-friendly** - Use emojis liberally 😊
- **Slang OK** - "gonna", "wanna", "ngl" are fine
```

### Changing the Name

Replace "Grace" throughout the prompt:

```markdown
# Alex - Personal Assistant System Prompt

You are **Alex**, a personal assistant...
```

### Adjusting Response Length

Modify the `### Response Length Rules` section:

**Longer responses:**
```markdown
### Response Length Rules
- Provide detailed, helpful responses
- Include context and explanations
- 2-3 sentences minimum for most responses
```

**Shorter responses:**
```markdown
### Response Length Rules
- Maximum 1 sentence per response
- Single word acknowledgments preferred
- Never explain unless asked
```

### Adding Custom Instructions

Add a new section for specific behaviors:

```markdown
## CUSTOM RULES

- Always greet the user by name if known
- End conversations with "Talk soon!"
- When discussing money, always use USD
- Never discuss politics or religion
```

### Changing the Message Bubble Delimiter

The `||` delimiter splits messages into separate bubbles. You can change this:

```typescript
// In MessageRouter.ts, find the split logic:
const bubbles = response.split('||');

// Change to a different delimiter:
const bubbles = response.split('---');
```

Then update the prompt to reflect the new delimiter.

---

## 🔧 Advanced Customization

### Adding New Tool Documentation

When you add a new tool, document it in the prompt:

```markdown
## AVAILABLE TOOLS

### Your New Tool Category
- `your_tool_name` - Description of what it does
```

### Context Window Management

The prompt mentions context handling. Key settings in `.env`:

```env
# When to start summarizing old messages
ANTHROPIC_SUMMARY_TRIGGER_TOKENS=5500

# Total context budget
ANTHROPIC_CONTEXT_WINDOW_TOKENS=7000

# Max tokens for each response
ANTHROPIC_RESPONSE_MAX_TOKENS=600
```

### Disabling Features

To disable certain behaviors, add explicit instructions:

```markdown
## DISABLED FEATURES

- Do NOT use web search
- Do NOT send emails without explicit confirmation
- Do NOT set reminders for times before 8am or after 10pm
```

---

## 🧪 Testing Your Changes

After modifying the prompt:

1. **Restart the agent:**
   ```bash
   # If running in dev mode, it auto-reloads
   # Otherwise:
   npm run build && npm start
   ```

2. **Test with sample messages:**
   ```bash
   curl -X POST http://localhost:3000/api/inject-message \
     -H "Content-Type: application/json" \
     -d '{"text":"hey","phoneNumber":"+15551234567"}'
   ```

3. **Check the logs** for the full prompt being sent to Claude

4. **Iterate** based on responses

---

## 📁 Related Files

| File | Purpose |
|------|---------|
| `agents/prompts/grace_system_prompt.md` | Main personality prompt |
| `services/ClaudeServiceEnhanced.ts` | Loads and uses the prompt |
| `services/ContextService.ts` | Builds runtime context |
| `services/MessageRouter.ts` | Orchestrates message handling |
| `config/index.ts` | Token limits and settings |

---

## 💡 Tips

1. **Keep it concise** — Long prompts use more tokens and cost more
2. **Use examples** — Claude learns well from examples
3. **Be explicit** — Don't assume Claude will infer rules
4. **Test edge cases** — Try unusual inputs after changes
5. **Version control** — Commit prompt changes with descriptive messages

---

## 🔗 Resources

- [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Claude System Prompts Best Practices](https://docs.anthropic.com/claude/docs/system-prompts)
- [TEXTMYAGENT GitHub](https://github.com/ever-just/bluebubbles-ai-agent)

---

<p align="center">
  <em>Created by <a href="https://weldonmakori.com">Weldon Makori</a></em>
</p>
