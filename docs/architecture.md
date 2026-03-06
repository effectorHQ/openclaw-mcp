# Architecture: SKILL.md to MCP Conversion

This document describes how openclaw-mcp converts OpenClaw SKILL.md files into Model Context Protocol (MCP) tool definitions.

## Overview

```
SKILL.md (OpenClaw Format)
        │
        ▼
    Parser (YAML frontmatter)
        │
        ▼
  Converter (Schema mapping)
        │
        ▼
  MCP Tool (JSON Schema)
        │
        ▼
 MCP Server (JSON-RPC 2.0)
        │
        ▼
MCP Clients (Claude, Cursor, etc.)
```

## SKILL.md Format

A SKILL.md file has two parts:

### 1. YAML Frontmatter

Between `---` delimiters, defining metadata:

```yaml
---
name: EmailSender
description: Send emails via SMTP
version: 1.0.0
author: effectorHQ
requires:
  env:
    - SMTP_HOST
    - SMTP_PORT
    - EMAIL_USER
    - EMAIL_PASSWORD
---
```

Supported fields:
- `name` (required): Identifier for the skill
- `description` (recommended): What the skill does
- `version`: Semantic version
- `author`: Creator/maintainer
- `requires.env`: List of required environment variables

### 2. Markdown Body

Documentation and implementation details:

```markdown
# Email Sender

Sends emails via SMTP...

## Parameters

- `recipient`: Email address to send to
- `subject`: Email subject
- `body`: Email body content

## Returns

Success message or error details.
```

## MCP Tool Format

An MCP tool definition is a JSON object with:

```json
{
  "name": "email_sender",
  "description": "Send emails via SMTP",
  "inputSchema": {
    "type": "object",
    "properties": {
      "SMTP_HOST": {
        "type": "string",
        "description": "Environment variable: SMTP_HOST"
      },
      "SMTP_PORT": {
        "type": "string",
        "description": "Environment variable: SMTP_PORT"
      },
      "EMAIL_USER": {
        "type": "string",
        "description": "Environment variable: EMAIL_USER"
      },
      "EMAIL_PASSWORD": {
        "type": "string",
        "description": "Environment variable: EMAIL_PASSWORD"
      }
    },
    "required": ["SMTP_HOST", "SMTP_PORT", "EMAIL_USER", "EMAIL_PASSWORD"]
  },
  "_metadata": {
    "version": "1.0.0",
    "author": "effectorHQ",
    "skillPath": "./skills/email-sender.md"
  }
}
```

## Conversion Mapping

### Field Mapping

| SKILL.md | MCP Tool | Notes |
|----------|----------|-------|
| `name` | `name` | Normalized to lowercase with underscores |
| `description` | `description` | Defaults to "No description provided" |
| `requires.env[]` | `inputSchema.properties` | Each env var becomes a string property |
| `requires.env[]` | `inputSchema.required` | All env vars marked as required |
| `version` | `_metadata.version` | Preserved in metadata |
| `author` | `_metadata.author` | Preserved in metadata |
| File path | `_metadata.skillPath` | For reference |
| `body` (markdown) | Not included | Available in skill object, not in MCP tool |

### Name Normalization

Tool names are normalized for MCP compatibility:

1. Convert to lowercase: `EmailSender` → `email_sender`
2. Replace spaces: `My Cool Skill` → `my_cool_skill`
3. Remove special chars: `Email@Sender!` → `email_sender`
4. Collapse underscores: `Email__Sender` → `email_sender`
5. Prefix numbers: `3POMailer` → `skill_3po_mailer`

### Environment Variables

Each `requires.env` entry becomes a required string input parameter:

```yaml
requires:
  env:
    - API_KEY
    - DEBUG_MODE
```

Converts to:

```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "API_KEY": {
        "type": "string",
        "description": "Environment variable: API_KEY"
      },
      "DEBUG_MODE": {
        "type": "string",
        "description": "Environment variable: DEBUG_MODE"
      }
    },
    "required": ["API_KEY", "DEBUG_MODE"]
  }
}
```

All environment variables are strings in the MCP schema. Numeric or boolean values should be passed as strings and parsed by the skill implementation.

## What Gets Preserved

✓ Skill name (normalized)
✓ Description
✓ Environment variable requirements
✓ Version and author metadata

## What Gets Lost

✗ Markdown body (documentation)
✗ Other `requires` fields (files, permissions, etc.)
✗ Custom metadata fields
✗ Scheduling information (if present)

Future versions may support additional SKILL.md fields through extended MCP metadata.

## Parser Implementation

The parser (`src/parser.js`) extracts SKILL.md structure:

1. Split content at `---` delimiters
2. Parse YAML frontmatter (custom parser, no external deps)
3. Extract markdown body
4. Return structured object: `{ frontmatter, body, path }`

### YAML Parsing

Supports:
- Simple key-value pairs: `name: MySkill`
- Numbers and booleans: `version: 1.0.0`, `debug: true`
- Nested objects: `requires:\n  env:\n    - VAR`
- Arrays: `env: [VAR1, VAR2]`

Does not require external YAML libraries (zero dependencies).

## Converter Implementation

The converter (`src/converter.js`) transforms skills to MCP tools:

1. Validate `name` field (required)
2. Extract `description` (or use default)
3. Build `inputSchema` from `requires.env`
4. Normalize tool name
5. Preserve metadata
6. Return MCP tool object

### Validation

`validateSkillForMCP()` checks:
- ✓ Name field exists
- ✓ Description field exists
- ⚠ Unsupported `requires` fields

Warnings help identify skills that may not convert cleanly.

## Server Implementation

The MCP server (`src/server.js`) exposes tools:

1. Load all `.md` files from directory
2. Parse each as SKILL.md
3. Convert to MCP tools
4. Implement JSON-RPC 2.0 handlers:
   - `initialize`: Server capabilities
   - `tools/list`: Return available tools
   - `tools/call`: Execute tool (future)

Communicates with MCP clients over JSON-RPC 2.0 (stdin/stdout).

## Example Flow

### Input: SKILL.md

```markdown
---
name: GreetingBot
description: A simple greeting skill
version: 1.0.0
author: Demo
requires:
  env:
    - GREETING_MESSAGE
---

# Greeting Bot

Greets the user with a custom message.
```

### Processing

1. **Parse**: Extract `{ frontmatter: { name: 'GreetingBot', ... }, body: '# Greeting Bot\n...', path: '...' }`

2. **Validate**: Check name exists, warn about missing description (if any)

3. **Convert**: Build MCP tool:
   ```json
   {
     "name": "greeting_bot",
     "description": "A simple greeting skill",
     "inputSchema": {
       "type": "object",
       "properties": {
         "GREETING_MESSAGE": {
           "type": "string",
           "description": "Environment variable: GREETING_MESSAGE"
         }
       },
       "required": ["GREETING_MESSAGE"]
     },
     "_metadata": {
       "version": "1.0.0",
       "author": "Demo",
       "skillPath": "./skills/greeting-bot.md"
     }
   }
   ```

4. **Serve**: Expose via MCP server's `tools/list` endpoint

5. **Consume**: Claude, Cursor, or other MCP clients can call `greeting_bot` with `GREETING_MESSAGE` parameter

## Extensibility

Future enhancements could include:

- **Additional requires fields**: `files`, `permissions`, `api_keys` → Extended inputSchema properties
- **Custom metadata**: Preserve arbitrary YAML fields in `_metadata`
- **Tool execution**: Implement `tools/call` to actually run skill commands
- **Caching**: Cache parsed skills for performance
- **Validation rules**: Custom validation schemas per organization
- **Version tracking**: Support multiple versions of same skill
