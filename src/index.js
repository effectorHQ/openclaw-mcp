/**
 * openclaw-mcp main module
 *
 * Exports the core API for converting OpenClaw SKILL.md files to MCP tools.
 *
 * Architecture (compile → host → execute):
 *   compile:  effector.toml + SKILL.md → MCP tool schema (JSON)
 *   host:     Expose compiled tools as MCP server (stdin/stdout JSON-RPC 2.0)
 *   execute:  "instruction passthrough" — tools/call returns SKILL.md body
 *             for the LLM to follow, rather than executing in a sandbox.
 */

import { parseSkillFromFile, parseSkillFromString } from './parser.js';
import { skillToMCPTool, skillsToMCPTools, validateSkillForMCP, normalizeToolName } from './converter.js';
import { createServer, startServer } from './server.js';
import { compileSkill, compileDirectory, parseEffectorToml } from './compiler.js';

/**
 * Parse a SKILL.md file and extract its structure.
 *
 * @param {string} filePath - Absolute path to the SKILL.md file
 * @returns {Promise<{frontmatter: Object, body: string, path: string}>}
 */
export async function parseSkill(filePath) {
  return parseSkillFromFile(filePath);
}

/**
 * Convert a parsed SKILL.md object to an MCP tool definition.
 *
 * @param {Object} skill - A parsed skill object from parseSkill()
 * @returns {Object} MCP tool definition
 */
export function convertToMCPTool(skill) {
  return skillToMCPTool(skill);
}

/**
 * Create and start an MCP server hosting skills from a directory.
 *
 * @param {string} skillsDirectory - Path to directory containing SKILL.md files
 * @returns {Promise<Object>} Server instance with start() method
 */
export async function createMCPServer(skillsDirectory) {
  return createServer(skillsDirectory);
}

// Re-export everything for programmatic use
export {
  // Parser
  parseSkillFromFile,
  parseSkillFromString,
  // Converter
  skillToMCPTool,
  skillsToMCPTools,
  validateSkillForMCP,
  normalizeToolName,
  // Server
  createServer,
  startServer,
  // Compiler
  compileSkill,
  compileDirectory,
  parseEffectorToml,
};
