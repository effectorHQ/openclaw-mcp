/**
 * MCP Server Implementation
 *
 * A JSON-RPC 2.0 server that listens on stdin/stdout and exposes
 * effector skills as MCP tools.
 *
 * This is the "host" step in the compile → host → execute pipeline.
 *
 * Execution model: "instruction passthrough"
 * When tools/call is invoked, the server returns the SKILL.md body
 * as text content. The MCP client (Claude, Cursor, etc.) reads these
 * instructions and executes them — the server does NOT execute skills
 * in a sandbox. This is deliberate: skills are agent instructions,
 * not programs.
 */

import fs from 'fs/promises';
import path from 'path';
import { compileSkill, compileDirectory } from './compiler.js';

/**
 * Create an MCP server for hosting skills.
 *
 * @param {string} skillsDirectory - Path to directory containing skill folders or .md files
 * @returns {Promise<Object>} Server instance
 */
export async function createServer(skillsDirectory) {
  // Validate directory exists
  try {
    await fs.access(skillsDirectory);
  } catch {
    throw new Error(`Skills directory not found: ${skillsDirectory}`);
  }

  const server = {
    skillsDirectory,
    tools: [],
    toolMap: new Map(), // tool name → compiled tool definition

    /**
     * Load and compile all skills from the directory.
     */
    async loadSkills() {
      this.tools = [];
      this.toolMap.clear();

      try {
        // Check if the directory itself is a single skill
        const hasToml = await fileExists(path.join(this.skillsDirectory, 'effector.toml'));
        const hasSkill = await fileExists(path.join(this.skillsDirectory, 'SKILL.md'));

        let compiled;
        if (hasToml || hasSkill) {
          // The directory IS a skill — compile it directly
          const tool = await compileSkill(this.skillsDirectory);
          compiled = [tool];
        } else {
          // The directory contains skills in subdirectories
          compiled = await compileDirectory(this.skillsDirectory);
        }

        for (const tool of compiled) {
          this.tools.push(tool);
          this.toolMap.set(tool.name, tool);
        }
      } catch (error) {
        console.error(`[MCP] Error loading skills: ${error.message}`);
      }

      return this.tools;
    },

    /**
     * Get the list of available tools (MCP-facing, without internal fields).
     */
    getTools() {
      return this.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    },

    /**
     * Start the MCP server on stdin/stdout.
     */
    async start() {
      console.error('[MCP Server] Starting...');

      await this.loadSkills();
      console.error(`[MCP Server] Loaded ${this.tools.length} tools`);

      const readline = await import('node:readline');
      const rl = readline.createInterface({ input: process.stdin });

      rl.on('line', (line) => {
        try {
          const request = JSON.parse(line);
          const response = this.handleRequest(request);
          if (response && request.id !== undefined) {
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        } catch (err) {
          const errResponse = {
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error: ' + err.message },
            id: null,
          };
          process.stdout.write(JSON.stringify(errResponse) + '\n');
        }
      });

      rl.on('close', () => {
        console.error('[MCP Server] stdin closed, shutting down');
        process.exit(0);
      });

      console.error('[MCP Server] JSON-RPC 2.0 server listening on stdin/stdout');
      await new Promise(() => {}); // Keep alive
    },

    /**
     * Handle a JSON-RPC 2.0 request.
     */
    handleRequest(request) {
      const { id, method, params } = request;

      try {
        switch (method) {
          case 'initialize':
            return {
              jsonrpc: '2.0',
              id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: { listChanged: false },
                },
                serverInfo: {
                  name: 'openclaw-mcp',
                  version: '0.1.0',
                },
              },
            };

          case 'tools/list':
            return {
              jsonrpc: '2.0',
              id,
              result: {
                tools: this.getTools(),
              },
            };

          case 'tools/call': {
            const { name: toolName, arguments: toolArgs } = params || {};
            const tool = this.toolMap.get(toolName);

            if (!tool) {
              return {
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32602,
                  message: `Unknown tool: ${toolName}. Available: ${this.tools.map(t => t.name).join(', ')}`,
                },
              };
            }

            // Instruction passthrough execution:
            // Return the SKILL.md body as text content.
            // The MCP client (an LLM) reads and follows these instructions.
            const skillContent = tool._skillContent ||
              `Skill "${toolName}" loaded. No SKILL.md body available.`;

            // Build response with metadata about execution model
            const content = [
              {
                type: 'text',
                text: skillContent,
              },
            ];

            // If the tool has typed interface info, include it
            if (tool._interface) {
              content.push({
                type: 'text',
                text: `\n---\n[effector.interface] input=${tool._interface.input || 'any'} output=${tool._interface.output || 'any'} context=${JSON.stringify(tool._interface.context || [])}`,
              });
            }

            return {
              jsonrpc: '2.0',
              id,
              result: { content },
            };
          }

          case 'notifications/initialized':
            // Client acknowledgment — no response needed
            return null;

          case 'notifications/shutdown':
            console.error('[MCP Server] Shutdown requested');
            process.exit(0);

          default:
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Method not found: ${method}`,
              },
            };
        }
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: `Internal error: ${error.message}`,
          },
        };
      }
    },

    /**
     * Send a JSON-RPC response to stdout.
     */
    sendResponse(response) {
      process.stdout.write(JSON.stringify(response) + '\n');
    },
  };

  return server;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Start an MCP server and listen on stdin.
 *
 * @param {string} skillsDirectory - Directory containing skill files
 */
export async function startServer(skillsDirectory) {
  const server = await createServer(skillsDirectory);
  await server.start();
}
