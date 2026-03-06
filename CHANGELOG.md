# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-05

### Added

- Initial alpha release of openclaw-mcp
- SKILL.md to MCP tool converter
- CLI interface with `serve`, `convert`, and `validate` commands
- MCP server implementation (JSON-RPC 2.0 over stdio)
- Programmatic API: `parseSkill()`, `convertToMCPTool()`, `createMCPServer()`
- YAML frontmatter parser for SKILL.md files
- Input schema generation from SKILL.md `requires.env` fields
- Support for Node.js 18+
- Comprehensive documentation (English and Chinese)
- Test suite using Node.js built-in test runner
- Architecture documentation with SKILL.md to MCP mapping guide

### Known Limitations

- Initial version focuses on core conversion functionality
- Tool execution is not yet implemented (schema/interface only)
- Advanced SKILL.md features (scheduling, custom metadata) require additional development
- Error handling and validation are in early stages

[0.1.0]: https://github.com/effectorHQ/openclaw-mcp/releases/tag/v0.1.0
