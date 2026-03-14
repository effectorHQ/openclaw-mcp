#!/usr/bin/env node

/**
 * openclaw-mcp CLI
 *
 * Compile → Host → Execute pipeline for effector skills.
 *
 * Commands:
 *   compile <dir>     Compile effector.toml + SKILL.md → MCP tool JSON
 *   serve <dir>       Start an MCP server (JSON-RPC 2.0 over stdin/stdout)
 *   convert <file>    Convert a single SKILL.md to MCP JSON (legacy)
 *   validate <dir>    Validate all SKILL.md files for MCP compatibility
 */

import { createServer } from '../src/server.js';
import { parseSkillFromFile } from '../src/parser.js';
import { skillToMCPTool, validateSkillForMCP } from '../src/converter.js';
import { compileSkill, compileDirectory } from '../src/compiler.js';
import fs from 'fs/promises';
import path from 'path';

const args = process.argv.slice(2);

async function main() {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    const pkgPath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'compile':
        await handleCompile(args.slice(1));
        break;
      case 'serve':
        await handleServe(args.slice(1));
        break;
      case 'convert':
        await handleConvert(args.slice(1));
        break;
      case 'validate':
        await handleValidate(args.slice(1));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * compile <path> [--output FILE]
 *
 * Compile a skill directory (effector.toml + SKILL.md) or a directory
 * of skills into MCP tool JSON.
 */
async function handleCompile(args) {
  const targetPath = args[0];
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

  if (!targetPath) {
    console.error('Error: compile requires a path argument');
    console.error('Usage: skill-mcp compile <path> [--output FILE]');
    process.exit(1);
  }

  const resolved = path.resolve(targetPath);
  const stat = await fs.stat(resolved);

  let result;
  if (stat.isDirectory()) {
    // Check if this directory IS a skill (has effector.toml or SKILL.md)
    const hasToml = await fileExists(path.join(resolved, 'effector.toml'));
    const hasSkill = await fileExists(path.join(resolved, 'SKILL.md'));

    if (hasToml || hasSkill) {
      // Single skill directory
      result = await compileSkill(resolved);
    } else {
      // Directory of skills
      result = await compileDirectory(resolved);
    }
  } else {
    // Single file
    result = await compileSkill(resolved);
  }

  const output = JSON.stringify(result, null, 2);

  if (outputPath) {
    await fs.writeFile(outputPath, output, 'utf-8');
    console.error(`Compiled: ${targetPath} → ${outputPath}`);
  } else {
    console.log(output);
  }
}

/**
 * serve <directory>
 *
 * Start an MCP server hosting skills from the specified directory.
 * Listens on stdin/stdout (MCP standard JSON-RPC 2.0).
 */
async function handleServe(args) {
  const directory = args[0];

  if (!directory) {
    console.error('Error: serve requires a directory argument');
    console.error('Usage: skill-mcp serve <directory>');
    process.exit(1);
  }

  const resolved = path.resolve(directory);
  console.error(`[skill-mcp] Starting MCP server for skills in: ${resolved}`);

  const server = await createServer(resolved);
  await server.start();
}

/**
 * convert <path-to-skill.md> [--output FILE]
 *
 * Convert a single SKILL.md file to MCP JSON schema and output as JSON.
 * (Legacy command — prefer `compile` which also reads effector.toml)
 */
async function handleConvert(args) {
  const skillPath = args[0];
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

  if (!skillPath) {
    console.error('Error: convert requires a file path argument');
    console.error('Usage: skill-mcp convert <path-to-skill.md> [--output FILE]');
    process.exit(1);
  }

  const resolved = path.resolve(skillPath);
  const skill = await parseSkillFromFile(resolved);
  const mcpTool = skillToMCPTool(skill);
  const output = JSON.stringify(mcpTool, null, 2);

  if (outputPath) {
    await fs.writeFile(outputPath, output, 'utf-8');
    console.error(`Converted: ${skillPath} → ${outputPath}`);
  } else {
    console.log(output);
  }
}

/**
 * validate <directory>
 *
 * Validate all SKILL.md files in a directory for MCP compatibility.
 */
async function handleValidate(args) {
  const directory = args[0];

  if (!directory) {
    console.error('Error: validate requires a directory argument');
    console.error('Usage: skill-mcp validate <directory>');
    process.exit(1);
  }

  const resolved = path.resolve(directory);
  const entries = await fs.readdir(resolved, { withFileTypes: true, recursive: true });
  const mdFiles = [];

  // Collect all .md files (excluding README)
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md' && entry.name !== 'README.zh.md') {
      const dir = entry.parentPath || entry.path || resolved;
      mdFiles.push(path.join(dir, entry.name));
    }
  }

  if (mdFiles.length === 0) {
    console.error(`No .md files found in ${directory}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const allWarnings = [];

  for (const filePath of mdFiles) {
    const relative = path.relative(resolved, filePath);
    try {
      const skill = await parseSkillFromFile(filePath);
      const warnings = validateSkillForMCP(skill);

      if (warnings.length === 0) {
        console.log(`  \u2713 ${relative}`);
        passed++;
      } else {
        console.log(`  \u26A0 ${relative}`);
        for (const w of warnings) {
          console.log(`    - ${w}`);
          allWarnings.push({ file: relative, warning: w });
        }
        passed++;
      }
    } catch (error) {
      console.log(`  \u2717 ${relative}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${allWarnings.length} warnings`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`
openclaw-mcp: Effector Skill → MCP bridge

Usage:
  skill-mcp <command> [options]

Commands:
  compile <path> [--output FILE]     Compile effector.toml + SKILL.md → MCP JSON
                                     (reads typed interface from effector.toml)

  serve <directory>                  Start an MCP server for skills (stdin/stdout)

  convert <path> [--output FILE]     Convert a single SKILL.md → MCP JSON (legacy)

  validate <directory>               Validate SKILL.md files for MCP compatibility

Options:
  --help, -h                         Show this help message
  --version, -v                      Show version number

Examples:
  # Compile a skill directory (reads effector.toml + SKILL.md)
  skill-mcp compile ./linear-skill/ --output linear.mcp.json

  # Compile all skills in a directory
  skill-mcp compile ./skills/

  # Start MCP server
  skill-mcp serve ./skills/

  # Convert a single SKILL.md file (no effector.toml)
  skill-mcp convert ./skills/my-skill.md

  # Validate all .md files
  skill-mcp validate ./skills/

For more information, visit: https://github.com/effectorHQ/openclaw-mcp
  `);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
