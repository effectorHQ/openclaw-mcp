/**
 * Tests for src/server.js
 *
 * Tests the MCP server (host step) with instruction passthrough execution.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createServer } from '../src/server.js';

async function createTempSkill(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'server-test-'));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }
  return dir;
}

async function cleanup(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

test('createServer: loads skills from directory', async () => {
  const dir = await createTempSkill({
    'test-skill.md': `---
name: test-skill
description: A test skill
---
## Purpose
Test.
`,
  });

  try {
    const server = await createServer(dir);
    await server.loadSkills();
    const tools = server.getTools();

    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].name, 'test_skill');
    assert.strictEqual(tools[0].description, 'A test skill');
    // Public tools should not expose internal fields
    assert.strictEqual(tools[0]._skillContent, undefined);
    assert.strictEqual(tools[0]._metadata, undefined);
  } finally {
    await cleanup(dir);
  }
});

test('createServer: throws for missing directory', async () => {
  await assert.rejects(
    () => createServer('/nonexistent/directory/12345'),
    (err) => err.message.includes('not found')
  );
});

test('handleRequest: initialize', async () => {
  const dir = await createTempSkill({});

  try {
    const server = await createServer(dir);
    const response = server.handleRequest({
      id: 1,
      method: 'initialize',
      params: {},
    });

    assert.strictEqual(response.id, 1);
    assert.strictEqual(response.result.protocolVersion, '2024-11-05');
    assert.ok(response.result.capabilities.tools);
    assert.strictEqual(response.result.serverInfo.name, 'openclaw-mcp');
  } finally {
    await cleanup(dir);
  }
});

test('handleRequest: tools/list', async () => {
  const dir = await createTempSkill({
    'my-skill.md': `---
name: my-skill
description: My test skill
---
## Purpose
Testing.
`,
  });

  try {
    const server = await createServer(dir);
    await server.loadSkills();

    const response = server.handleRequest({
      id: 2,
      method: 'tools/list',
    });

    assert.strictEqual(response.id, 2);
    assert.strictEqual(response.result.tools.length, 1);
    assert.strictEqual(response.result.tools[0].name, 'my_skill');
  } finally {
    await cleanup(dir);
  }
});

test('handleRequest: tools/call returns skill content (instruction passthrough)', async () => {
  const dir = await createTempSkill({
    'echo-skill.md': `---
name: echo-skill
description: Echo test
---
## Purpose
This skill echoes input back to the user.

## Commands
Just repeat what the user said.
`,
  });

  try {
    const server = await createServer(dir);
    await server.loadSkills();

    const response = server.handleRequest({
      id: 3,
      method: 'tools/call',
      params: {
        name: 'echo_skill',
        arguments: {},
      },
    });

    assert.strictEqual(response.id, 3);
    assert.ok(response.result);
    assert.ok(response.result.content.length >= 1);
    assert.strictEqual(response.result.content[0].type, 'text');
    assert.ok(response.result.content[0].text.includes('echoes input'));
  } finally {
    await cleanup(dir);
  }
});

test('handleRequest: tools/call with unknown tool', async () => {
  const dir = await createTempSkill({});

  try {
    const server = await createServer(dir);
    await server.loadSkills();

    const response = server.handleRequest({
      id: 4,
      method: 'tools/call',
      params: {
        name: 'nonexistent_tool',
        arguments: {},
      },
    });

    assert.strictEqual(response.id, 4);
    assert.ok(response.error);
    assert.strictEqual(response.error.code, -32602);
    assert.ok(response.error.message.includes('Unknown tool'));
  } finally {
    await cleanup(dir);
  }
});

test('handleRequest: unknown method', async () => {
  const dir = await createTempSkill({});

  try {
    const server = await createServer(dir);
    const response = server.handleRequest({
      id: 5,
      method: 'unknown/method',
    });

    assert.strictEqual(response.id, 5);
    assert.ok(response.error);
    assert.strictEqual(response.error.code, -32601);
  } finally {
    await cleanup(dir);
  }
});

test('handleRequest: tools/call with typed interface includes interface info', async () => {
  const dir = await createTempSkill({
    'typed-skill/effector.toml': `
[effector]
name = "typed-skill"
version = "1.0.0"
type = "skill"
description = "A typed skill"

[effector.interface]
input = "CodeDiff"
output = "ReviewReport"
context = ["GitHubCredentials"]

[effector.permissions]
network = true
subprocess = false
env-read = []
env-write = []
filesystem = []
`,
    'typed-skill/SKILL.md': `---
name: typed-skill
description: A typed skill
---
## Purpose
Review code.
`,
  });

  try {
    const server = await createServer(dir);
    await server.loadSkills();

    const response = server.handleRequest({
      id: 6,
      method: 'tools/call',
      params: {
        name: 'typed_skill',
        arguments: {},
      },
    });

    assert.strictEqual(response.id, 6);
    assert.ok(response.result);
    // Should have at least 2 content blocks: body + interface info
    assert.ok(response.result.content.length >= 2);

    const interfaceBlock = response.result.content.find(c =>
      c.text.includes('[effector.interface]')
    );
    assert.ok(interfaceBlock);
    assert.ok(interfaceBlock.text.includes('CodeDiff'));
    assert.ok(interfaceBlock.text.includes('ReviewReport'));
  } finally {
    await cleanup(dir);
  }
});

test('handleRequest: notifications/initialized returns null', async () => {
  const dir = await createTempSkill({});

  try {
    const server = await createServer(dir);
    const response = server.handleRequest({
      method: 'notifications/initialized',
    });

    assert.strictEqual(response, null);
  } finally {
    await cleanup(dir);
  }
});

test('server: loads skills from subdirectories with effector.toml', async () => {
  const dir = await createTempSkill({
    'skill-a/SKILL.md': `---
name: skill-a
description: First
---
## Purpose
First.
`,
    'skill-b/effector.toml': `
[effector]
name = "skill-b"
version = "1.0.0"
type = "skill"
description = "Second (toml only)"

[effector.interface]
input = "String"
output = "JSON"
context = []

[effector.permissions]
network = false
subprocess = false
env-read = []
env-write = []
filesystem = []
`,
    'skill-b/SKILL.md': `---
name: skill-b
description: Second
---
## Purpose
Second.
`,
  });

  try {
    const server = await createServer(dir);
    await server.loadSkills();
    const tools = server.getTools();

    assert.strictEqual(tools.length, 2);
    const names = tools.map(t => t.name).sort();
    assert.deepStrictEqual(names, ['skill_a', 'skill_b']);
  } finally {
    await cleanup(dir);
  }
});
