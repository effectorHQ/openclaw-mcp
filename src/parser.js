/**
 * SKILL.md Parser
 *
 * Delegates to @effectorhq/core for YAML frontmatter parsing.
 * Preserves the openclaw-mcp API surface for backward compatibility.
 */

import fs from 'fs/promises';
import { parseSkillFile, parseYaml } from '../../effector-core/src/skill-parser.js';

/**
 * Parse a SKILL.md file from disk.
 *
 * @param {string} filePath - Absolute path to SKILL.md file
 * @returns {Promise<Object>} { frontmatter, body, path }
 */
export async function parseSkillFromFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return parseSkillFromString(content, filePath);
}

/**
 * Parse SKILL.md content from a string.
 *
 * @param {string} content - SKILL.md file content
 * @param {string} [filePath] - Optional path for reference
 * @returns {Object} { frontmatter, body, path }
 */
export function parseSkillFromString(content, filePath = '<string>') {
  const result = parseSkillFile(content);
  return {
    frontmatter: result.parsed || {},
    body: result.body || '',
    path: filePath,
  };
}

/**
 * Parse YAML frontmatter from a string.
 * Wrapper around core parseSkillFile for backward compatibility.
 *
 * @param {string} content - File content with frontmatter
 * @returns {Object} { frontmatter, body }
 */
function parseFrontmatter(content) {
  const result = parseSkillFile(content);
  return {
    frontmatter: result.parsed || {},
    body: result.body || content,
  };
}

/**
 * Simple YAML parser — delegates to core.
 *
 * @param {string} yamlContent - YAML string
 * @returns {Object} Parsed YAML as JavaScript object
 */
function parseYAML(yamlContent) {
  return parseYaml(yamlContent);
}

/**
 * Parse a YAML value, handling different types.
 *
 * @param {string} value - The value string
 * @returns {*} Parsed value
 */
function parseValue(value) {
  if (value === 'null' || value === '') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!isNaN(value) && value !== '') return Number(value);
  return value;
}

export { parseFrontmatter, parseYAML, parseValue };
