import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { resolveProvider, ProviderError } from '../src/provider';
import type { Provider, ParsedArgs } from '../src/types';

const mockProviders: Provider[] = [
  {
    name: 'zhipu',
    base_url: 'https://z.ai/api',
    api_key_env: 'TEST_KEY',
    default_model: 'glm-4'
  },
  {
    name: 'lp',
    base_url: 'http://internal/api',
    api_key_env: 'LP_KEY',
    default_model: 'qwen3'
  }
];

beforeEach(() => {
  process.env.TEST_KEY = 'test-api-key';
  process.env.LP_KEY = 'lp-key';
});

afterEach(() => {
  delete process.env.TEST_KEY;
  delete process.env.LP_KEY;
});

describe('resolveProvider', () => {
  it('resolves by explicit provider name', () => {
    const args: ParsedArgs = { provider: 'zhipu', model: '', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    const cfg = resolveProvider(mockProviders, args);
    expect(cfg.base_url).toBe('https://z.ai/api');
    expect(cfg.model).toBe('glm-4');
    expect(cfg.smallModel).toBe('glm-4');
  });

  it('uses first provider when no name given (empty string)', () => {
    const args: ParsedArgs = { provider: '', model: '', rest: ['-p', 'hi'], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    const cfg = resolveProvider(mockProviders, args);
    expect(cfg.base_url).toBe('https://z.ai/api');
    expect(cfg.model).toBe('glm-4');
  });

  it('uses explicit model override', () => {
    const args: ParsedArgs = { provider: 'zhipu', model: 'glm-5x1', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    const cfg = resolveProvider(mockProviders, args);
    expect(cfg.model).toBe('glm-5x1');
    expect(cfg.smallModel).toBe('glm-5x1');
  });

  it('throws ProviderError for unknown provider', () => {
    const args: ParsedArgs = { provider: 'unknown', model: '', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    expect(() => resolveProvider(mockProviders, args)).toThrow(ProviderError);
  });

  it('throws ProviderError for invalid provider name chars', () => {
    const args: ParsedArgs = { provider: 'bad name!', model: '', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    expect(() => resolveProvider(mockProviders, args)).toThrow(ProviderError);
  });

  it('throws ProviderError when API key env var is not set', () => {
    delete process.env.TEST_KEY;
    const args: ParsedArgs = { provider: 'zhipu', model: '', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    expect(() => resolveProvider(mockProviders, args)).toThrow(ProviderError);
  });

  it('throws ProviderError when provider has no default model and none specified', () => {
    const noModelProviders: Provider[] = [
      { name: 'lp', base_url: 'http://a', api_key_env: 'LP_KEY' }
    ];
    process.env.LP_KEY = 'key';
    const args: ParsedArgs = { provider: 'lp', model: '', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    expect(() => resolveProvider(noModelProviders, args)).toThrow(ProviderError);
  });

  it('uses default_small_model when set', () => {
    const providers: Provider[] = [
      {
        name: 'zhipu',
        base_url: 'https://z.ai/api',
        api_key_env: 'TEST_KEY',
        default_model: 'glm-4',
        default_small_model: 'glm-4-air'
      }
    ];
    const args: ParsedArgs = { provider: 'zhipu', model: '', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    const cfg = resolveProvider(providers, args);
    expect(cfg.model).toBe('glm-4');
    expect(cfg.smallModel).toBe('glm-4-air');
  });

  it('falls back smallModel to model when default_small_model absent', () => {
    const args: ParsedArgs = { provider: 'zhipu', model: '', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    const cfg = resolveProvider(mockProviders, args);
    expect(cfg.smallModel).toBe('glm-4'); // same as default_model
  });

  it('works with explicit model when no default_model configured', () => {
    const noDefault: Provider[] = [
      { name: 'lp', base_url: 'http://a', api_key_env: 'LP_KEY' }
    ];
    process.env.LP_KEY = 'key';
    const args: ParsedArgs = { provider: 'lp', model: 'qwen3', rest: [], isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false };
    const cfg = resolveProvider(noDefault, args);
    expect(cfg.model).toBe('qwen3');
    expect(cfg.smallModel).toBe('qwen3');
  });

  const FULL_ARGS: Omit<ParsedArgs, 'provider' | 'model' | 'rest'> = {
    isListCommand: false, isHelpCommand: false, isInitCommand: false, isUpdateCommand: false,
  };

  it('returns agent_cli "cc" when set on provider', () => {
    const providers: Provider[] = [
      { name: 'zp', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4', agent_cli: 'cc' }
    ];
    const args: ParsedArgs = { provider: 'zp', model: '', rest: [], ...FULL_ARGS };
    const cfg = resolveProvider(providers, args);
    expect(cfg.agent_cli).toBe('cc');
  });

  it('returns agent_cli "codex" when set on provider', () => {
    const providers: Provider[] = [
      { name: 'zp-codex', base_url: 'https://z.ai/api/v1', api_key_env: 'TEST_KEY', default_model: 'glm-4', agent_cli: 'codex' }
    ];
    const args: ParsedArgs = { provider: 'zp-codex', model: '', rest: [], ...FULL_ARGS };
    const cfg = resolveProvider(providers, args);
    expect(cfg.agent_cli).toBe('codex');
  });

  it('defaults agent_cli to "cc" when not set', () => {
    const args: ParsedArgs = { provider: 'zhipu', model: '', rest: [], ...FULL_ARGS };
    const cfg = resolveProvider(mockProviders, args);
    expect(cfg.agent_cli).toBe('cc');
  });

  it('returns wireApi when set on provider', () => {
    const providers: Provider[] = [
      { name: 'zp-codex', base_url: 'https://z.ai/api/v1', api_key_env: 'TEST_KEY', default_model: 'glm-4', agent_cli: 'codex', wire_api: 'chat' }
    ];
    const args: ParsedArgs = { provider: 'zp-codex', model: '', rest: [], ...FULL_ARGS };
    const cfg = resolveProvider(providers, args);
    expect(cfg.wireApi).toBe('chat');
  });

  it('defaults wireApi to empty string when not set', () => {
    const providers: Provider[] = [
      { name: 'zp-codex', base_url: 'https://z.ai/api/v1', api_key_env: 'TEST_KEY', default_model: 'glm-4', agent_cli: 'codex' }
    ];
    const args: ParsedArgs = { provider: 'zp-codex', model: '', rest: [], ...FULL_ARGS };
    const cfg = resolveProvider(providers, args);
    expect(cfg.wireApi).toBe('');
  });
});
