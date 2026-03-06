#!/usr/bin/env node

/**
 * openclaw-mcp CLI
 *
 * Converts OpenClaw SKILL.md files to MCP (Model Context Protocol) tool definitions
 * and provides a JSON-RPC 2.0 server for MCP-compatible clients.
 */

import { createServer } from '../src/server.js';
import { parseSkill, convertToMCPTool } from '../src/index.js';
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
    const pkg = JSON.parse(await fs.readFile('./package.json', 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  try {
    switch (command) {
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
 * serve <directory> [--port PORT]
 *
 * Start an MCP server hosting SKILL.md files from the specified directory.
 * Listens on stdin/stdout (MCP standard JSON-RPC 2.0).
 */
async function handleServe(args) {
  const directory = args[0];

  if (!directory) {
    console.error('Error: serve requires a directory argument');
    console.error('Usage: skill-mcp serve <directory> [--port PORT]');
    process.exit(1);
  }

  // TODO: Parse optional --port argument
  // const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : undefined;

  console.error(`[skill-mcp] Starting MCP server for skills in: ${directory}`);

  // TODO: Implement server startup
  // const server = createServer(directory);
  // await server.start();

  console.error('[skill-mcp] TODO: Server implementation not yet complete');
  process.exit(1);
}

/**
 * convert <path-to-skill.md> [--output FILE]
 *
 * Convert a single SKILL.md file to MCP JSON schema and output as JSON.
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

  // TODO: Implement conversion
  // const skill = await parseSkill(skillPath);
  // const mcpTool = convertToMCPTool(skill);
  // const output = JSON.stringify(mcpTool, null, 2);
  // if (outputPath) {
  //   await fs.writeFile(outputPath, output, 'utf-8');
  //   console.log(`Converted: ${skillPath} → ${outputPath}`);
  // } else {
  //   console.log(output);
  // }

  console.error('[skill-mcp] TODO: Conversion implementation not yet complete');
  process.exit(1);
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

  // TODO: Implement validation
  // - Read all .md files in directory
  // - Parse each as SKILL.md
  // - Attempt conversion to MCP tool schema
  // - Report any errors or warnings

  console.error('[skill-mcp] TODO: Validation implementation not yet complete');
  process.exit(1);
}

function printHelp() {
  console.log(`
openclaw-mcp: SKILL.md → Model Context Protocol (MCP) bridge

Usage:
  skill-mcp <command> [options]

Commands:
  serve <directory>                 Start an MCP server for SKILL.md files
                                    in the specified directory

  convert <path> [--output FILE]    Convert a SKILL.md file to MCP JSON schema

  validate <directory>              Validate SKILL.md files for MCP compatibility

Options:
  --help, -h                        Show this help message
  --version, -v                     Show version number

Examples:
  # Start MCP server
  skill-mcp serve ./skills/

  # Convert a single file
  skill-mcp convert ./skills/my-skill.md --output mcp-tool.json

  # Validate all files in directory
  skill-mcp validate ./skills/

For more information, visit: https://github.com/effectorHQ/openclaw-mcp
  `);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
