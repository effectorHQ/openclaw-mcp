# openclaw-mcp

[![npm version](https://img.shields.io/npm/v/@effectorhq/skill-mcp.svg)](https://www.npmjs.com/package/@effectorhq/skill-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/effectorHQ/openclaw-mcp/ci.yml?branch=main)](https://github.com/effectorHQ/openclaw-mcp/actions)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache-2.0-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[English](README.md)

## 概述

**openclaw-mcp** 是 OpenClaw 的 SKILL.md 格式与 [Model Context Protocol](https://modelcontextprotocol.io/)（MCP）之间的桥接，使得 OpenClaw 技能可以与任何支持 MCP 的智能体运行时配合使用。

### 功能

将 SKILL.md 技能定义转换为 MCP 兼容的工具定义。您的 OpenClaw 技能立即可用于：

- **Claude**（Claude Desktop、API）
- **Cursor** IDE
- **Windsurf** IDE
- **任何支持 MCP 的智能体运行时**

### 为什么重要

- **跨生态可迁移性**：在 OpenClaw 中构建一次，在支持 MCP 的任何地方部署
- **无需代码更改**：现有的 SKILL.md 文件无需修改即可使用
- **可组合的技能**：将 OpenClaw 技能与来自其他来源的 MCP 工具结合
- **标准化的互操作性**：MCP 是 AI 工具集成的行业标准

## 快速开始

### 安装

```bash
npm install -D @effectorhq/skill-mcp
```

### 启动 MCP 服务器

```bash
npx @effectorhq/skill-mcp serve ./skills/
```

服务器在标准输入/输出上监听（MCP 标准），将 `./skills/` 中的所有 SKILL.md 文件公开为 MCP 工具。

### 在 Claude Desktop 中使用

编辑 `~/.claude/desktop/config.json`（macOS/Linux）或 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

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

重启 Claude Desktop。您的 OpenClaw 技能现在可用作工具。

## 架构

```
┌─────────────────────┐
│   SKILL.md 文件     │
│ （YAML 前置 +       │
│   markdown 正文）   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  skill-mcp 解析器   │
│  （YAML → JSON）    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  MCP 转换器         │
│ （模式映射）        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ MCP 服务器（stdio） │
│  （JSON-RPC 2.0）   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   MCP 客户端        │
│ • Claude            │
│ • Cursor            │
│ • Windsurf          │
│ • 等等              │
└─────────────────────┘
```

## CLI 使用

### 启动服务器

启动托管您的技能的 MCP 服务器：

```bash
skill-mcp serve <directory> [--port 3000]
```

### 转换

将单个 SKILL.md 转换为 MCP JSON 模式：

```bash
skill-mcp convert <path-to-skill.md> [--output output.json]
```

### 验证

验证 SKILL.md 文件的 MCP 兼容性：

```bash
skill-mcp validate <directory>
```

### 帮助

```bash
skill-mcp --help
```

## 编程 API

### `parseSkill(filePath)`

将 SKILL.md 文件解析为技能对象。

```javascript
import { parseSkill } from '@effectorhq/skill-mcp';

const skill = await parseSkill('./skills/my-skill.md');
console.log(skill.frontmatter.name);
```

### `convertToMCPTool(skill)`

将解析的技能转换为 MCP 工具模式。

```javascript
import { convertToMCPTool, parseSkill } from '@effectorhq/skill-mcp';

const skill = await parseSkill('./skills/my-skill.md');
const mcpTool = convertToMCPTool(skill);
console.log(mcpTool);
// { name: '...', description: '...', inputSchema: { type: 'object', ... } }
```

### `createMCPServer(skillsDirectory)`

创建并返回 JSON-RPC 2.0 MCP 服务器。

```javascript
import { createMCPServer } from '@effectorhq/skill-mcp';

const server = createMCPServer('./skills');
await server.start();
```

## 文件结构

- `bin/skill-mcp.js` — CLI 入口点
- `src/index.js` — 主模块导出
- `src/parser.js` — SKILL.md 解析器（YAML 前置）
- `src/converter.js` — SKILL.md → MCP 工具转换器
- `src/server.js` — JSON-RPC 2.0 MCP 服务器
- `tests/` — 测试套件（Node.js 内置测试运行器）
- `docs/` — 架构和映射文档

## 开发

```bash
npm test
npm run lint
npm run build
```

## 贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

This project is currently licensed under the Apache 2.0 License 。
