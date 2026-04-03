# Agent Behavior Audit - January 31, 2026

**Audit Date**: January 31, 2026 4:55 PM CST  
**Status**: 🔍 REVIEW ONLY - NO CHANGES MADE  
**Agent Version**: Commit `b56e416` (restored stable version)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Conversation Sequence Analysis](#2-conversation-sequence-analysis)
3. [Issues Identified](#3-issues-identified)
4. [Prompt Analysis](#4-prompt-analysis)
5. [Tool Calling Analysis](#5-tool-calling-analysis)
6. [Cross-Reference with Harmony Audit](#6-cross-reference-with-harmony-audit)
7. [Recommendations](#7-recommendations)

---

## 1. Executive Summary

After restoring the agent to commit `b56e416` (Dec 26, 2025), live testing revealed the following:

### ✅ Working Correctly
- Email functionality (`send_email` tool)
- Multiple conversation handling (two users simultaneously)
- Tapback reactions ("Liked 'Yea'" sent correctly)
- Read receipts and typing indicators
- Database connectivity (TypeORM on port 5432)
- 12 tools registered and available

### ⚠️ Issues Identified
| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | Agent claims it can't make calls, then offers to call | 🔴 HIGH | Logic/Consistency |
| 2 | Agent identity confusion ("I work for Weldon, he's the one you're talking to") | 🔴 HIGH | Identity/Context |
| 3 | Phone call capability mismatch | 🟡 MEDIUM | Tool/Prompt Alignment |
| 4 | Response too long for simple "Am I ugly" question | 🟡 MEDIUM | Response Length |
| 5 | "working on it" acknowledgment timing | 🟢 LOW | UX Polish |

---

## 2. Conversation Sequence Analysis

### Timeline of Events (Jan 31, 2026 4:46-4:48 PM)

```
TIME        USER                    AGENT RESPONSE                              ANALYSIS
─────────────────────────────────────────────────────────────────────────────────────────
16:46:33    "Who are you"           "I'm Grace, your executive assistant!       ✅ Correct identity
                                     I help you with tasks like reminders,
                                     scheduling, calls, and looking things up."
                                     
16:46:43    (continued)             "I was just about to help you call your     ⚠️ ISSUE: Claims can make calls
                                     mom - want me to continue with that?"
                                     
16:46:53    "Yea"                   [Liked "Yea"] + "working on it"             ✅ Correct tapback + ack

16:47:04    (response)              "I don't have the ability to make phone     🔴 CONTRADICTION: Just said
                                     calls, but I can set a reminder for you     it would help with calls
                                     to call her. Want me to do that?"
                                     
16:47:20    "Can you tell Weldon    "I work for Weldon, he's the one you're    🔴 IDENTITY CONFUSION:
             to call my mom"         talking to"                                 User is NOT talking to Weldon
                                     
16:47:29    (continued)             "Want me to go ahead and call your mom      🔴 CONTRADICTION AGAIN:
                                     now?"                                       Just said can't make calls
                                     
16:47:51    "Am I ugly"             "I can't see you, but I can tell you're    ⚠️ TOO LONG: 4 sentences
                                     asking a real question. No one who talks    for a simple question
                                     about pocket doors and checks in on their
                                     mom is ugly - you sound thoughtful and
                                     caring. That counts for way more.
                                     Want me to still call your mom?"
                                     
16:47:55    "Send an email"         "I can help with that! Who should I send   ✅ Correct response
                                     it to, and what would you like to say?"
                                     
16:48:19    "Weldon Makori and      "let me handle that"                       ✅ Correct acknowledgment
             just say yo"            
                                     
16:48:31    (result)                "done! sent weldon an email that just      ✅ Email sent successfully
                                     says 'yo' 😄"
```

### Parallel Conversation (+19522779595)

```
TIME        USER                    AGENT RESPONSE                              ANALYSIS
─────────────────────────────────────────────────────────────────────────────────────────
16:48:11    "Can you send email     "working on it"                            ✅ Acknowledgment
             to weldonmakori1@
             gmail.com and say hi"
             
16:48:24    (result)                "done! sent the email"                     ✅ Email sent successfully
```

---

## 3. Issues Identified

### Issue 1: Phone Call Capability Contradiction 🔴

**Evidence:**
1. Agent says: "I help you with tasks like reminders, scheduling, **calls**, and looking things up"
2. Agent says: "I was just about to help you **call your mom**"
3. Agent says: "I **don't have the ability to make phone calls**"
4. Agent says: "Want me to go ahead and **call your mom now**?"

**Root Cause Analysis:**
- The `interaction_system_prompt.md` does NOT mention phone calls as a capability
- The `grace_system_prompt.md` does NOT mention phone calls
- No `make_call` or `phone_call` tool exists in the tool registry
- Agent is hallucinating this capability

**Prompt Reference:**
- `interaction_system_prompt.md:3` - "You are Grace, an executive assistant for Weldon Makori"
- Tools listed: reminders, triggers, email, web search - NO phone calls

### Issue 2: Agent Identity Confusion 🔴

**Evidence:**
- User: "Can you tell Weldon to call my mom"
- Agent: "I work for Weldon, **he's the one you're talking to**"

**Analysis:**
- The user is talking to **Grace**, not Weldon
- Grace works FOR Weldon, but Weldon is not present in the conversation
- This is a fundamental misunderstanding of the agent's role

**Root Cause:**
- `interaction_system_prompt.md:3` says "executive assistant **for** Weldon Makori"
- Agent correctly knows it works for Weldon
- But incorrectly assumes the user is Weldon
- The prompt doesn't clarify who the user is in relation to Weldon

**Prompt Gap:**
- No explicit statement like "Users may be anyone - not just Weldon"
- No guidance on how to handle requests that involve Weldon as a third party

### Issue 3: Response Length for "Am I ugly" 🟡

**Evidence:**
- User sends 3 words: "Am I ugly"
- Agent responds with 4 sentences (174 characters)

**Prompt Reference:**
- `interaction_system_prompt.md:141-147` - "Match your response length to the user's message length"
- "User sends a few words + just chatting → Reply with a few words"
- "Under 100 characters for casual chat"

**Analysis:**
- The agent's response is thoughtful and kind
- But violates the length-matching rule
- A better response: "nah you're good" or "can't see you but you sound cool"

### Issue 4: "working on it" Acknowledgment Pattern 🟢

**Evidence:**
- Multiple instances of "working on it" sent as pre-emptive acknowledgment
- Sometimes followed by actual result, sometimes not

**Analysis:**
- This is the automatic acknowledgment system working as designed
- Per `interaction_system_prompt.md:12-23` - system sends automatic acknowledgments
- However, the phrase "working on it" may feel robotic when repeated

---

## 4. Prompt Analysis

### Identity Definition

| Prompt | Identity Statement | Issue |
|--------|-------------------|-------|
| `interaction_system_prompt.md:3` | "executive assistant for Weldon Makori, CEO of EverJust" | ✅ Clear |
| `grace_system_prompt.md:3` | "executive assistant for Weldon Makori, CEO of EverJust" | ✅ Clear |

**Gap:** Neither prompt clarifies:
- Who the users are (employees? family? anyone?)
- How to handle requests involving Weldon as a third party
- That Weldon is NOT the one texting (unless explicitly identified)

### Tool Capabilities Listed

| Tool | `interaction_system_prompt.md` | `grace_system_prompt.md` | Actual Code |
|------|-------------------------------|-------------------------|-------------|
| Reminders | ✅ Lines 31-33 | ✅ Lines 150-153 | ✅ ReminderTool.ts |
| Triggers | ✅ Lines 35 | ✅ Lines 155-159 | ✅ TriggerTool.ts |
| Email | ❌ Not mentioned | ✅ Lines 161-167 | ✅ EmailTool.ts |
| Web Search | ✅ Line 33 | ✅ Lines 170-171 | ✅ Server tool |
| Phone Calls | ❌ Not mentioned | ❌ Not mentioned | ❌ Does not exist |

**Gap:** Agent mentioned "calls" as a capability despite no tool or prompt support.

### Response Length Rules

| Rule | `interaction_system_prompt.md` | `grace_system_prompt.md` | Observed |
|------|-------------------------------|-------------------------|----------|
| Match user length | ✅ Lines 140-143 | ✅ Lines 17-20 | ⚠️ Violated |
| Under 100 chars casual | ✅ Line 146 | ✅ Line 32 | ⚠️ Violated |
| Max 3 bubbles | ✅ Line 148 | ✅ Line 86 | ✅ OK |

---

## 5. Tool Calling Analysis

### Tools Registered (from logs)

```json
{
  "toolCount": 12,
  "tools": [
    "create_reminder",
    "list_reminders", 
    "cancel_reminder",
    "create_trigger",
    "list_triggers",
    "update_trigger",
    "delete_trigger",
    "send_email",
    "list_emails",
    "read_email",
    "reply_email",
    "get_agent_email"
  ]
}
```

### Tool Usage Observed

| Time | User Request | Tool Used | Result |
|------|-------------|-----------|--------|
| 16:47:55 | "Send an email" | `send_email` | ✅ Success |
| 16:48:11 | "send email to weldonmakori1@gmail.com" | `send_email` | ✅ Success |
| 16:48:19 | "Weldon Makori and just say yo" | `send_email` | ✅ Success |

### Tool Gaps

| Capability Mentioned | Tool Exists | Status |
|---------------------|-------------|--------|
| Phone calls | ❌ No | 🔴 Agent hallucinated |
| Calendar access | ❌ No | ⚠️ Mentioned in examples but not available |

---

## 6. Cross-Reference with Harmony Audit

### From `PROMPT_CODE_HARMONY_AUDIT.md`

| Section | Status | Relevance to Current Issues |
|---------|--------|----------------------------|
| v5 (Dec 26) - Agent not responding | ✅ Fixed | Not observed |
| v6 - `||` separator visible | ✅ Fixed | Not observed |
| v7 - Echo detection | ✅ Fixed | Not observed |
| v8 - Action acknowledgments | ✅ Implemented | Working ("working on it") |
| v8 - Typing indicator | ✅ Fixed | Working |

### New Issues Not in Harmony Audit

| Issue | In Audit? | Action Needed |
|-------|-----------|---------------|
| Phone call hallucination | ❌ No | Add to prompt: "You cannot make phone calls" |
| Identity confusion | ❌ No | Clarify user identity in prompt |
| Response length violation | ⚠️ Partial | Strengthen enforcement |

---

## 7. Recommendations

### Priority 1: Fix Phone Call Hallucination 🔴

**Problem:** Agent claims it can make phone calls when it cannot.

**Solution Options:**
1. **Add explicit denial to prompt:**
   ```markdown
   ## CAPABILITIES YOU DO NOT HAVE
   - ❌ Making phone calls
   - ❌ Sending SMS (you use iMessage only)
   - ❌ Accessing calendars (not yet implemented)
   ```

2. **Add to "What NOT to Say" section:**
   ```markdown
   - "I can help you call..."
   - "Want me to call..."
   ```

### Priority 2: Fix Identity Confusion 🔴

**Problem:** Agent assumes user is Weldon when they're not.

**Solution Options:**
1. **Add user identity clarification:**
   ```markdown
   ## WHO YOU'RE TALKING TO
   
   You work for Weldon Makori, but you may be talking to ANYONE - not just Weldon.
   - If someone asks you to "tell Weldon" something, they are NOT Weldon
   - If someone asks about Weldon, treat him as a third party
   - Only assume you're talking to Weldon if they explicitly identify themselves
   ```

2. **Add context awareness:**
   ```markdown
   ## HANDLING REQUESTS ABOUT WELDON
   
   If a user asks you to contact Weldon or tell Weldon something:
   - You can send Weldon an email (via send_email)
   - You cannot call Weldon
   - You cannot text Weldon (you ARE the iMessage interface)
   ```

### Priority 3: Strengthen Response Length Rules 🟡

**Problem:** Agent gives long responses to short questions.

**Solution:**
- Add more explicit examples of short responses
- Add negative examples showing what NOT to do
- Consider adding character count guidance

### Priority 4: Vary Acknowledgment Phrases 🟢

**Problem:** "working on it" repeated multiple times feels robotic.

**Solution:**
- Review `actionAcknowledgments.ts` for variety
- Ensure random selection from acknowledgment pool
- Add more casual variations

---

## 8. Files to Review for Fixes

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `interaction_system_prompt.md` | Primary prompt | Add capabilities denial, identity clarification |
| `grace_system_prompt.md` | Fallback prompt | Mirror changes from interaction prompt |
| `actionAcknowledgments.ts` | Acknowledgment variety | Review phrase pool |
| `InteractionAgentRuntime.ts` | Tool handling | No changes needed |

---

## 9. Testing Checklist (After Fixes)

| Test Case | Expected | Status |
|-----------|----------|--------|
| User asks "can you call X" | Agent says it cannot make calls | ⏳ PENDING |
| User asks "tell Weldon X" | Agent offers to email Weldon | ⏳ PENDING |
| User sends 3-word question | Agent responds with <100 chars | ⏳ PENDING |
| Multiple acknowledgments | Different phrases used | ⏳ PENDING |
| Email requests | Successfully sent | ✅ WORKING |

---

## 10. Appendix: Raw Log Excerpts

### Email Success Logs
```
16:48:23 - Sending message "done! sent the email" to iMessage;-;+19522779595
16:48:31 - Sending message "done! sent weldon an email that just says 'yo' 😄" to iMessage;-;+19202078058
```

### Identity Confusion Log
```
16:47:27 - Sending message "I work for Weldon, he's the one you're talking to" to iMessage;-;+19202078058
```

### Phone Call Contradiction Logs
```
16:46:42 - "I help you with tasks like reminders, scheduling, calls, and looking things up"
16:47:04 - "I don't have the ability to make phone calls"
16:47:29 - "Want me to go ahead and call your mom now?"
```

---

## 11. CRITICAL: Inbound Email Replies Not Processed

**Discovered**: Jan 31, 2026 5:06 PM CST  
**Severity**: 🔴 CRITICAL

### Problem Statement

When Grace sends an outbound email (via `send_email` tool), and the recipient replies to that email, the agent does NOT respond to the reply.

### Root Causes Identified

| # | Issue | Evidence |
|---|-------|----------|
| 1 | **Webhook URL misconfigured** | `.env` shows `AGENTMAIL_WEBHOOK_URL=https://api.customagents.io/webhook/email` — points to remote server, not local agent |
| 2 | **No tunnel to localhost** | AgentMail can't reach `localhost:3000` from the internet |
| 3 | **Webhook handler only notifies** | `index.ts:323-353` only sends iMessage notification, doesn't route email to agent |
| 4 | **No email-to-agent routing** | Missing: code to process inbound email as a message for the agent to respond to |

### Evidence from Logs

**Last AgentMail webhook received:** Dec 29, 2025 17:38:19 (over a month ago)

```
{"event_type":"message.received","message":"Received AgentMail webhook","timestamp":"2025-12-29 17:38:19"}
```

**No webhooks received on Jan 31, 2026** — confirms webhook URL is not reachable.

### Current Webhook Handler Code

`@/agent-service/src/index.ts:323-353`:
```typescript
if (event === 'message.received' && data) {
  logInfo('Received email to Grace inbox', { from: data.from, subject: data.subject });
  
  // ONLY sends notification — does NOT process email
  const notificationText = `📧 New email received!\nFrom: ${data.from}\nSubject: ${data.subject}`;
  await bbClient.sendMessage(chatGuid, notificationText);
}
```

### What's Missing

1. **Tunnel setup** — Need Cloudflare tunnel or ngrok to expose `localhost:3000/webhook/email`
2. **Email-to-conversation routing** — Need to:
   - Parse inbound email
   - Find or create conversation with sender
   - Route to MessageRouter for agent processing
   - Have agent respond via `reply_email` tool

### Recommended Fix

**Phase 1: Fix Webhook Reachability**
1. Set up Cloudflare tunnel (or ngrok) to expose local webhook
2. Update `AGENTMAIL_WEBHOOK_URL` to tunnel URL
3. Verify webhooks are received in logs

**Phase 2: Implement Email Processing**
1. Modify `/webhook/email` handler to route emails to MessageRouter
2. Create email-based conversation flow
3. Have agent respond using `reply_email` tool

### Files to Modify

| File | Change |
|------|--------|
| `.env` | Update `AGENTMAIL_WEBHOOK_URL` to tunnel URL |
| `index.ts` | Enhance webhook handler to process emails |
| `MessageRouter.ts` | Add email message handling (optional) |

---

**End of Audit**

*Next Steps: Review this audit with user, then implement fixes in priority order.*
