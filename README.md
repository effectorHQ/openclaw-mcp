# openclaw-mcp

[![npm version](https://img.shields.io/npm/v/@effectorhq/skill-mcp.svg)](https://www.npmjs.com/package/@effectorhq/skill-mcp)
[![Status: Beta](https://img.shields.io/badge/status-beta-yellow)](https://github.com/effectorHQ/REPO-TIERS.md)
[![CI](https://github.com/effectorHQ/openclaw-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/effectorHQ/openclaw-mcp/actions/workflows/test.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[中文文档](README.zh.md)

## Overview

**openclaw-mcp** bridges the effector SKILL.md format to the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP), enabling effector skills to work with any MCP-compatible agent runtime.

### What It Does

Converts SKILL.md skill definitions into MCP-compatible tool definitions. Your OpenClaw skills instantly become available to:

- **Claude** (Claude Desktop, API)
- **Cursor** IDE
- **Windsurf** IDE
- **Any MCP-supporting agent runtime**

### Why It Matters

- **Cross-Ecosystem Portability**: Build once in OpenClaw, deploy everywhere MCP is supported
- **No Code Changes**: Your existing SKILL.md files work without modification
- **Composable Skills**: Combine OpenClaw skills with MCP tools from other sources
- **Standardized Interoperability**: MCP is the industry standard for AI tool integration

## Install

```bash
npm install @effectorhq/skill-mcp
```

You can also use the CLI directly without installing globally:

```bash
npx @effectorhq/skill-mcp ./skills
npx @effectorhq/skill-mcp --stdio
```

See the published package on npm: **https://www.npmjs.com/package/@effectorhq/skill-mcp**

## Quick Start

### Start MCP Server

```bash
npx @effectorhq/skill-mcp serve ./skills/
```

The server listens on stdin/stdout (MCP standard) and exposes all SKILL.md files in `./skills/` as MCP tools.

### In Claude Desktop

Add to `~/.claude/desktop/config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "openclaw": {
      "command": "node",
      "args": ["[path-to-node-modules]/@effectorhq/skill-mcp/bin/skill-mcp.js", "serve", "./skills"]
    }
  }
}
```

Restart Claude Desktop. Your OpenClaw skills are now available as tools.

## Architecture

```
┌─────────────────────┐
│   SKILL.md Files    │
│  (frontmatter +     │
│   markdown body)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  skill-mcp Parser   │
│  (YAML → JSON)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  MCP Converter      │
│  (schema mapping)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  MCP Server (stdio) │
│  (JSON-RPC 2.0)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  MCP Clients        │
│  • Claude           │
│  • Cursor           │
│  • Windsurf         │
│  • etc.             │
└─────────────────────┘
```

## CLI Usage

### Serve

Start an MCP server hosting your skills:

```bash
skill-mcp serve <directory> [--port 3000]
```

### Convert

Convert a single SKILL.md to MCP JSON schema:

```bash
skill-mcp convert <path-to-skill.md> [--output output.json]
```

### Validate

Validate SKILL.md files for MCP compatibility:

```bash
skill-mcp validate <directory>
```

### Help

```bash
skill-mcp --help
```

## Programmatic API

### `parseSkill(filePath)`

Parses a SKILL.md file into a skill object.

```javascript
import { parseSkill } from '@effectorhq/skill-mcp';

const skill = await parseSkill('./skills/my-skill.md');
console.log(skill.frontmatter.name);
```

### `convertToMCPTool(skill)`

Converts a parsed skill to MCP tool schema.

```javascript
import { convertToMCPTool, parseSkill } from '@effectorhq/skill-mcp';

const skill = await parseSkill('./skills/my-skill.md');
const mcpTool = convertToMCPTool(skill);
console.log(mcpTool);
// { name: '...', description: '...', inputSchema: { type: 'object', ... } }
```

### `createMCPServer(skillsDirectory)`

Creates and returns a JSON-RPC 2.0 MCP server.

```javascript
import { createMCPServer } from '@effectorhq/skill-mcp';

const server = createMCPServer('./skills');
await server.start();
```

## File Structure

- `bin/skill-mcp.js` — CLI entry point
- `src/index.js` — Main module exports
- `src/parser.js` — SKILL.md parser (YAML frontmatter)
- `src/converter.js` — SKILL.md → MCP tool converter
- `src/server.js` — JSON-RPC 2.0 MCP server
- `tests/` — Test suite (Node.js built-in test runner)
- `docs/` — Architecture and mapping documentation

## Development

```bash
npm test
npm run lint
npm run build
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is currently licensed under the [Apache License, Version 2.0](LICENSE.md) 。

