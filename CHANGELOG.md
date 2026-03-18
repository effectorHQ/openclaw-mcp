# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## v0.1.1 — 2026-03-19

### Changed
- SKILL.md parsing delegated to `@effectorhq/core/skill` — no more in-repo duplicate parser
- CLI scripts updated: removed TODO markers in `lint` and `build`
- Keywords: `openclaw` → `effector`, `effectorhq`
- Description: `OpenClaw` → `Effector`
- `files` field in `package.json` now includes `LICENSE` and `README.md`

---

## v0.1.0 — 2026-03-05

### Added
- Initial alpha release of openclaw-mcp
- SKILL.md to MCP tool converter
- CLI: `serve`, `convert`, `validate`, `compile` commands
- MCP server implementation (JSON-RPC 2.0 over stdio)
- Programmatic API: `parseSkill()`, `convertToMCPTool()`, `createMCPServer()`
- Input schema generation from SKILL.md `requires.env` fields
- Support for Node.js 18+
