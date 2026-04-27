import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { listProviders } from '../src/list';
import type { Provider } from '../src/types';

let output: string = '';
const origConsoleLog = console.log;

beforeEach(() => {
  output = '';
  console.log = (...args: any[]) => { output += args.join(' ') + '\n'; };
});

afterEach(() => {
  console.log = origConsoleLog;
});

function makeProvider(overrides: Partial<Provider> & { name: string; base_url: string; api_key_env: string }): Provider {
  return overrides as Provider;
}

describe('listProviders', () => {
  it('outputs header "Providers:" with blank line after', () => {
    listProviders([makeProvider({ name: 'p', base_url: 'http://a', api_key_env: 'K', default_model: 'm1' })]);
    expect(output).toContain('Providers:');
    expect(output).toMatch(/Providers:\n\n/);
  });

  it('shows provider names without @ prefix', () => {
    listProviders([
      makeProvider({ name: 'zhipu', base_url: 'https://a', api_key_env: 'K', default_model: 'glm-4' })
    ]);
    expect(output).toContain('zhipu');
    expect(output).not.toContain('@zhipu');
  });

  it('marks default_model with [default]', () => {
    listProviders([
      makeProvider({ name: 'p', base_url: 'http://a', api_key_env: 'K', default_model: 'glm-4' })
    ]);
    expect(output).toContain('[default]');
  });

  it('marks default_small_model with [small] when different from default', () => {
    listProviders([
      makeProvider({
        name: 'p', base_url: 'http://a', api_key_env: 'K',
        default_model: 'glm-4', default_small_model: 'glm-4-air'
      })
    ]);
    expect(output).toContain('[small]');
  });

  it('does not mark [small] when same as default', () => {
    listProviders([
      makeProvider({
        name: 'p', base_url: 'http://a', api_key_env: 'K',
        default_model: 'glm-4', default_small_model: 'glm-4'
      })
    ]);
    expect(output).not.toContain('[small]');
  });

  it('uses └─ for single model (no ├─)', () => {
    listProviders([
      makeProvider({ name: 'p', base_url: 'http://a', api_key_env: 'K', default_model: 'm1' })
    ]);
    expect(output).toContain('└─');
    expect(output).not.toContain('├─');
  });

  it('uses both ├─ and └─ for multiple models', () => {
    listProviders([
      makeProvider({
        name: 'p', base_url: 'http://a', api_key_env: 'K',
        default_model: 'm1', default_small_model: 'm2'
      })
    ]);
    expect(output).toContain('├─');
    expect(output).toContain('└─');
  });

  it('shows all models from models field when present', () => {
    listProviders([
      makeProvider({
        name: 'p', base_url: 'http://a', api_key_env: 'K',
        default_model: 'glm-4', models: ['glm-4', 'glm-4-plus']
      })
    ]);
    expect(output).toContain('glm-4');
    expect(output).toContain('glm-4-plus');
  });

  it('falls back to default+small when models field absent', () => {
    listProviders([
      makeProvider({
        name: 'p', base_url: 'http://a', api_key_env: 'K',
        default_model: 'm1', default_small_model: 'm2'
      })
    ]);
    expect(output).toContain('m1');
    expect(output).toContain('m2');
  });

  it('falls back to only default_model when models is empty array', () => {
    listProviders([
      makeProvider({
        name: 'p', base_url: 'http://a', api_key_env: 'K',
        default_model: 'glm-4', models: []
      })
    ]);
    expect(output).toContain('glm-4');
    const lines = output.split('\n').filter(l => l.includes('glm-4'));
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it('separates multiple providers with blank lines', () => {
    listProviders([
      makeProvider({ name: 'a', base_url: 'http://a', api_key_env: 'K', default_model: 'm1' }),
      makeProvider({ name: 'b', base_url: 'http://b', api_key_env: 'K', default_model: 'm2' })
    ]);
    expect(output).toMatch(/  a\n.*\n\n\s*  b/);
  });

  it('excludes default_model from list when models field does not include it', () => {
    listProviders([
      makeProvider({
        name: 'p', base_url: 'http://a', api_key_env: 'K',
        default_model: 'glm-4', models: ['glm-5-plus', 'glm-5-flash']
      })
    ]);
    expect(output).toContain('glm-5-plus');
    expect(output).toContain('glm-5-flash');
    expect(output).not.toContain('[default]');
  });
});
