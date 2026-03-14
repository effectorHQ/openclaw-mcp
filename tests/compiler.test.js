/**
 * Tests for src/compiler.js
 *
 * Tests the effector.toml + SKILL.md → MCP compilation pipeline.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { compileSkill, compileDirectory, parseEffectorToml } from '../src/compiler.js';

// Helper to create temp directories with skill files
async function createTempSkill(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-test-'));
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

// ── parseEffectorToml ──────────────────────────────────────

test('parseEffectorToml: extracts basic fields', () => {
  const toml = `
[effector]
name          = "linear"
version       = "1.0.0"
type          = "skill"
description   = "Manage Linear issues"
`;
  const result = parseEffectorToml(toml);
  assert.strictEqual(result.name, 'linear');
  assert.strictEqual(result.version, '1.0.0');
  assert.strictEqual(result.type, 'skill');
  assert.strictEqual(result.description, 'Manage Linear issues');
});

test('parseEffectorToml: extracts interface', () => {
  const toml = `
[effector]
name = "test-skill"

[effector.interface]
input   = "String"
output  = "JSON"
context = ["GenericAPIKey", "Repository"]
`;
  const result = parseEffectorToml(toml);
  assert.ok(result.interface);
  assert.strictEqual(result.interface.input, 'String');
  assert.strictEqual(result.interface.output, 'JSON');
  assert.deepStrictEqual(result.interface.context, ['GenericAPIKey', 'Repository']);
});

test('parseEffectorToml: extracts permissions', () => {
  const toml = `
[effector]
name = "test-skill"

[effector.permissions]
network    = true
subprocess = false
env-read   = ["API_KEY", "TOKEN"]
env-write  = []
filesystem = []
`;
  const result = parseEffectorToml(toml);
  assert.ok(result.permissions);
  assert.strictEqual(result.permissions.network, true);
  assert.strictEqual(result.permissions.subprocess, false);
  assert.deepStrictEqual(result.permissions.envRead, ['API_KEY', 'TOKEN']);
  assert.deepStrictEqual(result.permissions.envWrite, []);
});

test('parseEffectorToml: handles missing sections', () => {
  const toml = `
[effector]
name = "minimal"
`;
  const result = parseEffectorToml(toml);
  assert.strictEqual(result.name, 'minimal');
  assert.strictEqual(result.interface, undefined);
  assert.strictEqual(result.permissions, undefined);
});

// ── compileSkill ───────────────────────────────────────────

test('compileSkill: compiles from SKILL.md only', async () => {
  const dir = await createTempSkill({
    'SKILL.md': `---
name: test-skill
description: A test skill
requires:
  env:
    - API_KEY
---
## Purpose
Test purpose.
`,
  });

  try {
    const tool = await compileSkill(dir);
    assert.strictEqual(tool.name, 'test_skill');
    assert.strictEqual(tool.description, 'A test skill');
    assert.ok(tool.inputSchema.properties.API_KEY);
    assert.ok(tool._skillContent.includes('Test purpose'));
  } finally {
    await cleanup(dir);
  }
});

test('compileSkill: compiles from effector.toml only', async () => {
  const dir = await createTempSkill({
    'effector.toml': `
[effector]
name = "toml-only"
version = "1.0.0"
type = "skill"
description = "A TOML-only skill"

[effector.interface]
input = "String"
output = "Markdown"
context = []

[effector.permissions]
network = false
subprocess = false
env-read = ["MY_VAR"]
env-write = []
filesystem = []
`,
  });

  try {
    const tool = await compileSkill(dir);
    assert.strictEqual(tool.name, 'toml_only');
    assert.strictEqual(tool.description, 'A TOML-only skill');
    assert.ok(tool._interface);
    assert.strictEqual(tool._interface.input, 'String');
    assert.strictEqual(tool._interface.output, 'Markdown');
    assert.ok(tool.inputSchema.properties.MY_VAR);
  } finally {
    await cleanup(dir);
  }
});

test('compileSkill: merges effector.toml + SKILL.md', async () => {
  const dir = await createTempSkill({
    'effector.toml': `
[effector]
name = "merged-skill"
version = "2.0.0"
type = "skill"
description = "Merged description"

[effector.interface]
input = "CodeDiff"
output = "ReviewReport"
context = ["GitHubCredentials"]

[effector.permissions]
network = true
subprocess = false
env-read = ["GITHUB_TOKEN"]
env-write = []
filesystem = []
`,
    'SKILL.md': `---
name: merged-skill
description: Skill.md description (lower priority)
requires:
  env:
    - GITHUB_TOKEN
    - EXTRA_VAR
---
## Purpose
Review code diffs.
`,
  });

  try {
    const tool = await compileSkill(dir);

    // effector.toml takes precedence for description
    assert.strictEqual(tool.name, 'merged_skill');
    assert.strictEqual(tool.description, 'Merged description');

    // Typed interface from effector.toml
    assert.strictEqual(tool._interface.input, 'CodeDiff');
    assert.strictEqual(tool._interface.output, 'ReviewReport');

    // Permissions from effector.toml
    assert.strictEqual(tool._permissions.network, true);

    // Env vars merged from both sources
    assert.ok(tool.inputSchema.properties.GITHUB_TOKEN);
    assert.ok(tool.inputSchema.properties.EXTRA_VAR);

    // SKILL.md body stored for passthrough
    assert.ok(tool._skillContent.includes('Review code diffs'));
  } finally {
    await cleanup(dir);
  }
});

test('compileSkill: throws if no files found', async () => {
  const dir = await createTempSkill({});

  try {
    await assert.rejects(
      () => compileSkill(dir),
      (err) => err.message.includes('No effector.toml or SKILL.md found')
    );
  } finally {
    await cleanup(dir);
  }
});

test('compileSkill: works with file path (not directory)', async () => {
  const dir = await createTempSkill({
    'SKILL.md': `---
name: file-path-test
description: Test with file path
---
## Purpose
File path test.
`,
  });

  try {
    const tool = await compileSkill(path.join(dir, 'SKILL.md'));
    assert.strictEqual(tool.name, 'file_path_test');
  } finally {
    await cleanup(dir);
  }
});

// ── compileDirectory ──────────────────────────────────────

test('compileDirectory: compiles subdirectories', async () => {
  const dir = await createTempSkill({
    'skill-a/SKILL.md': `---
name: skill-a
description: First skill
---
## Purpose
First.
`,
    'skill-b/SKILL.md': `---
name: skill-b
description: Second skill
---
## Purpose
Second.
`,
    'skill-b/effector.toml': `
[effector]
name = "skill-b"
version = "1.0.0"
type = "skill"
description = "Second skill (toml)"

[effector.interface]
input = "String"
output = "JSON"
context = []
`,
  });

  try {
    const tools = await compileDirectory(dir);
    assert.strictEqual(tools.length, 2);

    const names = tools.map(t => t.name).sort();
    assert.deepStrictEqual(names, ['skill_a', 'skill_b']);

    // skill-b should have interface from toml
    const skillB = tools.find(t => t.name === 'skill_b');
    assert.ok(skillB._interface);
    assert.strictEqual(skillB._interface.input, 'String');
  } finally {
    await cleanup(dir);
  }
});

test('compileDirectory: compiles loose .md files', async () => {
  const dir = await createTempSkill({
    'loose-skill.md': `---
name: loose-skill
description: A loose skill file
---
## Purpose
Loose.
`,
  });

  try {
    const tools = await compileDirectory(dir);
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].name, 'loose_skill');
  } finally {
    await cleanup(dir);
  }
});

test('compileDirectory: skips README.md', async () => {
  const dir = await createTempSkill({
    'README.md': '# Not a skill\nJust a readme.',
    'real-skill.md': `---
name: real-skill
description: A real skill
---
## Purpose
Real.
`,
  });

  try {
    const tools = await compileDirectory(dir);
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].name, 'real_skill');
  } finally {
    await cleanup(dir);
  }
});

// ── compileSkill with linear-skill ────────────────────────

test('compileSkill: compiles linear-skill reference implementation', async () => {
  const linearDir = path.resolve(import.meta.dirname, '../../linear-skill');

  // Skip if linear-skill not present
  try {
    await fs.access(linearDir);
  } catch {
    return; // Skip test
  }

  const tool = await compileSkill(linearDir);

  assert.strictEqual(tool.name, 'linear');
  assert.ok(tool.description.includes('Linear'));
  assert.ok(tool._interface);
  assert.strictEqual(tool._interface.input, 'String');
  assert.strictEqual(tool._interface.output, 'JSON');
  assert.deepStrictEqual(tool._interface.context, ['GenericAPIKey']);
  assert.ok(tool._permissions);
  assert.strictEqual(tool._permissions.network, true);
  assert.ok(tool._skillContent.includes('Purpose'));
  assert.ok(tool.inputSchema.properties.LINEAR_API_KEY);
});
