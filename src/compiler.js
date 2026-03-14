/**
 * Effector Compiler
 *
 * Compiles an effector skill directory (effector.toml + SKILL.md) into
 * an MCP tool schema. This is the "compile" step in the
 * compile → host → execute pipeline.
 *
 * Input: skill directory containing effector.toml and/or SKILL.md
 * Output: MCP tool definition (JSON)
 *
 * Priority: effector.toml is the typed manifest (name, description,
 * interface, permissions). SKILL.md provides the instruction body
 * and any frontmatter-only fields not in effector.toml.
 */

import fs from 'fs/promises';
import path from 'path';
import { parseSkillFromFile } from './parser.js';
import { skillToMCPTool, normalizeToolName } from './converter.js';

/**
 * Compile a skill directory into an MCP tool definition.
 *
 * Reads effector.toml (if present) for typed interface metadata,
 * and SKILL.md for the instruction body. Merges both into a single
 * MCP tool schema.
 *
 * @param {string} skillDir - Path to skill directory (or direct SKILL.md path)
 * @returns {Promise<Object>} Compiled MCP tool definition
 */
export async function compileSkill(skillDir) {
  const stat = await fs.stat(skillDir);
  const dir = stat.isDirectory() ? skillDir : path.dirname(skillDir);

  let tomlData = null;
  let skillData = null;

  // Try reading effector.toml
  const tomlPath = path.join(dir, 'effector.toml');
  try {
    const tomlContent = await fs.readFile(tomlPath, 'utf-8');
    tomlData = parseEffectorToml(tomlContent);
  } catch {
    // No effector.toml — that's fine
  }

  // Try reading SKILL.md
  const skillPath = stat.isFile() ? skillDir : path.join(dir, 'SKILL.md');
  try {
    skillData = await parseSkillFromFile(skillPath);
  } catch {
    // No SKILL.md — check if we have effector.toml at least
    if (!tomlData) {
      throw new Error(`No effector.toml or SKILL.md found in ${dir}`);
    }
  }

  // Merge: effector.toml takes precedence for typed fields
  if (tomlData && skillData) {
    return mergeTomlAndSkill(tomlData, skillData, dir);
  }

  if (tomlData) {
    return compileFromToml(tomlData, dir);
  }

  // SKILL.md only — use existing converter
  return compileFromSkill(skillData);
}

/**
 * Compile multiple skills from a directory.
 *
 * Scans for subdirectories with effector.toml or SKILL.md,
 * and also scans for loose .md files.
 *
 * @param {string} searchDir - Directory to scan
 * @returns {Promise<Array<Object>>} Array of compiled MCP tool definitions
 */
export async function compileDirectory(searchDir) {
  const results = [];
  const entries = await fs.readdir(searchDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(searchDir, entry.name);

    if (entry.isDirectory()) {
      // Check if subdirectory is a skill (has effector.toml or SKILL.md)
      const hasToml = await fileExists(path.join(fullPath, 'effector.toml'));
      const hasSkill = await fileExists(path.join(fullPath, 'SKILL.md'));

      if (hasToml || hasSkill) {
        try {
          const tool = await compileSkill(fullPath);
          results.push(tool);
        } catch (err) {
          console.error(`[compile] Error compiling ${entry.name}: ${err.message}`);
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      // Loose .md files — try parsing as SKILL.md
      try {
        const skill = await parseSkillFromFile(fullPath);
        if (skill.frontmatter.name) {
          const tool = compileFromSkill(skill);
          results.push(tool);
        }
      } catch (err) {
        console.error(`[compile] Error compiling ${entry.name}: ${err.message}`);
      }
    }
  }

  return results;
}

/**
 * Merge effector.toml data with SKILL.md data into MCP tool.
 */
function mergeTomlAndSkill(toml, skill, dir) {
  const name = toml.name || skill.frontmatter.name;
  if (!name) {
    throw new Error(`Skill in ${dir} has no name in effector.toml or SKILL.md`);
  }

  const description = toml.description || skill.frontmatter.description || 'No description provided';

  // Build inputSchema from effector.toml interface + SKILL.md env vars
  const inputSchema = buildInputSchema(toml, skill);

  const tool = {
    name: normalizeToolName(name),
    description,
    inputSchema,
  };

  // Metadata from both sources
  tool._metadata = {
    version: toml.version || skill.frontmatter.version,
    type: toml.type || 'skill',
    skillPath: skill.path,
    tomlPath: path.join(dir, 'effector.toml'),
  };

  // Typed interface from effector.toml
  if (toml.interface) {
    tool._interface = {
      input: toml.interface.input || null,
      output: toml.interface.output || null,
      context: toml.interface.context || [],
    };
  }

  // Permissions from effector.toml
  if (toml.permissions) {
    tool._permissions = toml.permissions;
  }

  // Store skill body for instruction passthrough execution
  tool._skillContent = skill.body;

  return tool;
}

/**
 * Compile from effector.toml only (no SKILL.md).
 */
function compileFromToml(toml, dir) {
  if (!toml.name) {
    throw new Error(`effector.toml in ${dir} has no name`);
  }

  const tool = {
    name: normalizeToolName(toml.name),
    description: toml.description || 'No description provided',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  };

  // Add env vars from permissions as input properties
  if (toml.permissions?.envRead) {
    for (const envVar of toml.permissions.envRead) {
      tool.inputSchema.properties[envVar] = {
        type: 'string',
        description: `Environment variable: ${envVar}`,
      };
    }
    if (toml.permissions.envRead.length > 0) {
      tool.inputSchema.required = toml.permissions.envRead;
    }
  }

  tool._metadata = {
    version: toml.version,
    type: toml.type || 'skill',
    tomlPath: path.join(dir, 'effector.toml'),
  };

  if (toml.interface) {
    tool._interface = {
      input: toml.interface.input || null,
      output: toml.interface.output || null,
      context: toml.interface.context || [],
    };
  }

  if (toml.permissions) {
    tool._permissions = toml.permissions;
  }

  return tool;
}

/**
 * Compile from SKILL.md only (no effector.toml).
 */
function compileFromSkill(skill) {
  const tool = skillToMCPTool(skill);
  tool._skillContent = skill.body;
  return tool;
}

/**
 * Build inputSchema by merging effector.toml interface info with SKILL.md env vars.
 */
function buildInputSchema(toml, skill) {
  const schema = {
    type: 'object',
    properties: {},
  };

  // Env vars from SKILL.md frontmatter (safely handles array or object)
  const rawEnv = skill.frontmatter?.requires?.env ||
    skill.frontmatter?.metadata?.openclaw?.requires?.env ||
    [];
  const envVars = toStringArray(rawEnv);

  // Env vars from effector.toml permissions
  const tomlEnvVars = toml.permissions?.envRead || [];

  // Merge both sources (deduplicate)
  const allEnvVars = [...new Set([...envVars, ...tomlEnvVars])];

  for (const envVar of allEnvVars) {
    schema.properties[envVar] = {
      type: 'string',
      description: `Environment variable: ${envVar}`,
    };
  }

  if (allEnvVars.length > 0) {
    schema.required = allEnvVars;
  }

  return schema;
}

/**
 * Parse effector.toml content (minimal regex-based parser).
 * Delegates to @effectorhq/core when available, falls back to local parsing.
 */
function parseEffectorToml(content) {
  const result = {};

  // Extract simple key-value pairs from [effector] section
  const extractValue = (key) => {
    const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*"(.+?)"`, 'm'));
    return match ? match[1] : null;
  };

  const extractBool = (key) => {
    const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)`, 'm'));
    return match ? match[1] === 'true' : null;
  };

  const extractArray = (key) => {
    const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*?)\\]`, 'm'));
    if (!match) return [];
    return match[1]
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  };

  result.name = extractValue('name');
  result.version = extractValue('version');
  result.type = extractValue('type');
  result.description = extractValue('description');

  // [effector.interface]
  if (content.includes('[effector.interface]')) {
    result.interface = {
      input: extractValue('input'),
      output: extractValue('output'),
      context: extractArray('context'),
    };
  }

  // [effector.permissions]
  if (content.includes('[effector.permissions]')) {
    result.permissions = {
      network: extractBool('network'),
      subprocess: extractBool('subprocess'),
      envRead: extractArray('env-read'),
      envWrite: extractArray('env-write'),
      filesystem: extractArray('filesystem'),
    };
  }

  return result;
}

/**
 * Safely convert a value to a string array.
 * Handles: arrays, objects (use keys), strings, undefined/null.
 */
function toStringArray(val) {
  if (Array.isArray(val)) return val.filter(v => v && typeof v === 'string');
  if (val && typeof val === 'object') return Object.keys(val).filter(Boolean);
  if (typeof val === 'string') return [val];
  return [];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export { parseEffectorToml };
