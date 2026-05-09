import { describe, expect, it, beforeEach } from 'bun:test';
import { readConfig, ConfigError } from '../src/config';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setupTmpDir, writeConfig } from './helpers';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await setupTmpDir();
});

describe('readConfig', () => {
  it('throws ConfigError with "not found" when file missing', async () => {
    const path = join(tmpDir, 'claude-model-switcher', 'providers.json');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('Config not found');
    }
  });

  it('throws ConfigError when content is not valid JSON', async () => {
    const path = join(tmpDir, 'providers.json');
    await writeFile(path, 'not json');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('Failed to parse config');
    }
  });

  it('throws ConfigError when JSON is empty array', async () => {
    const path = join(tmpDir, 'providers.json');
    await writeFile(path, '[]');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('No providers configured');
    }
  });

  it('throws ConfigError when provider missing required field', async () => {
    const path = join(tmpDir, 'providers.json');
    await writeFile(path, '[{"name":"test"}]');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('missing required field');
    }
  });

  it('throws ConfigError when provider name is reserved "list"', async () => {
    const path = join(tmpDir, 'providers.json');
    await writeFile(path, '[{"name":"list","base_url":"http://a","api_key_env":"K"}]');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('"list" is reserved');
    }
  });

  it('throws ConfigError when provider name is reserved "help"', async () => {
    const path = join(tmpDir, 'providers.json');
    await writeFile(path, '[{"name":"help","base_url":"http://a","api_key_env":"K"}]');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('"help" is reserved');
    }
  });

  it('throws ConfigError when provider name is reserved "init"', async () => {
    const path = join(tmpDir, 'providers.json');
    await writeFile(path, '[{"name":"init","base_url":"http://a","api_key_env":"K"}]');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('"init" is reserved');
    }
  });

  it('throws ConfigError when provider name is reserved "update"', async () => {
    const path = join(tmpDir, 'providers.json');
    await writeFile(path, '[{"name":"update","base_url":"http://a","api_key_env":"K"}]');
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('"update" is reserved');
    }
  });

  it('returns parsed providers for valid config', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu',
      base_url: 'https://z.ai/api',
      api_key_env: 'TEST_KEY',
      default_model: 'glm-4'
    }]));
    const providers = readConfig(join(tmpDir, 'claude-model-switcher', 'providers.json'));
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe('zhipu');
    expect(providers[0].default_model).toBe('glm-4');
  });

  it('accepts optional fields: default_small_model and models', async () => {
    await writeConfig(JSON.stringify([{
      name: 'p',
      base_url: 'http://a',
      api_key_env: 'K',
      default_model: 'm1',
      default_small_model: 'm2',
      models: ['m1', 'm2', 'm3']
    }]));
    const result = readConfig(join(tmpDir, 'claude-model-switcher', 'providers.json'));
    expect(result[0].default_small_model).toBe('m2');
    expect(result[0].models).toEqual(['m1', 'm2', 'm3']);
  });

  it('throws ConfigError for invalid agent_cli value', async () => {
    const path = await writeConfig(JSON.stringify([{
      name: 'p', base_url: 'http://a', api_key_env: 'K', agent_cli: 'invalid'
    }]));
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('agent_cli');
    }
  });

  it('accepts valid agent_cli values "cc" and "codex"', async () => {
    const path = await writeConfig(JSON.stringify([
      { name: 'a', base_url: 'http://a', api_key_env: 'K', agent_cli: 'cc' },
      { name: 'b', base_url: 'http://b', api_key_env: 'K', agent_cli: 'codex' }
    ]));
    const result = readConfig(path);
    expect(result[0].agent_cli).toBe('cc');
    expect(result[1].agent_cli).toBe('codex');
  });

  it('accepts config without agent_cli (defaults to cc)', async () => {
    const path = await writeConfig(JSON.stringify([{
      name: 'p', base_url: 'http://a', api_key_env: 'K'
    }]));
    const result = readConfig(path);
    expect(result[0].agent_cli).toBeUndefined();
  });

  it('throws ConfigError for duplicate (name, agent_cli) combination', async () => {
    const path = await writeConfig(JSON.stringify([
      { name: 'zp', base_url: 'http://a', api_key_env: 'K', agent_cli: 'cc' },
      { name: 'zp', base_url: 'http://b', api_key_env: 'K', agent_cli: 'cc' }
    ]));
    expect(() => readConfig(path)).toThrow(ConfigError);
    try { readConfig(path); } catch (e) {
      expect((e as ConfigError).message).toContain('Duplicate');
    }
  });

  it('allows same name with different agent_cli values', async () => {
    const path = await writeConfig(JSON.stringify([
      { name: 'zp', base_url: 'http://a', api_key_env: 'K', agent_cli: 'cc' },
      { name: 'zp', base_url: 'http://b', api_key_env: 'K', agent_cli: 'codex' }
    ]));
    const result = readConfig(path);
    expect(result).toHaveLength(2);
  });
});
