import { readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import type { Provider } from './types';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const REQUIRED_FIELDS = ['name', 'base_url', 'api_key_env'] as const;
type RawEntry = Record<string, unknown>;

export function getConfigPath(): string {
  const fileName = 'claude-model-switcher/providers.json';
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, fileName);
  }
  if (platform() === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, fileName);
  }
  return join(homedir(), '.config', fileName);
}

export function readConfig(configPath: string): Provider[] {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (e: unknown) {
    const code = (e as Record<string, unknown>)?.code;
    if (code === 'ENOENT') {
      throw new ConfigError(`Config not found: ${configPath}`);
    }
    throw new ConfigError(`Failed to read config: ${configPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(`Failed to parse config: ${configPath}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ConfigError(`No providers configured in ${configPath}`);
  }

  const RESERVED_NAMES = new Set(['list', 'help', 'init', 'update']);
  const VALID_AGENT_CLI = new Set(['cc', 'codex']);

  const entries = parsed as RawEntry[];
  for (const p of entries) {
    if (typeof p !== 'object' || p === null) {
      throw new ConfigError(`Invalid provider entry in ${configPath}`);
    }
    for (const field of REQUIRED_FIELDS) {
      if (!p[field]) {
        throw new ConfigError(
          `Provider "${p['name'] || '(unnamed)'}" missing required field "${field}" in ${configPath}`
        );
      }
    }
    if (RESERVED_NAMES.has(p['name'] as string)) {
      throw new ConfigError(
        `Provider name "${p['name']}" is reserved (@${p['name']} is a built-in command)`
      );
    }
    if (p['agent_cli'] !== undefined && !VALID_AGENT_CLI.has(p['agent_cli'] as string)) {
      throw new ConfigError(
        `Provider "${p['name']}" has invalid agent_cli "${p['agent_cli']}". Must be "cc" or "codex".`
      );
    }
  }

  const seen = new Set<string>();
  for (const p of entries) {
    const cli = (p['agent_cli'] as string) || 'cc';
    const key = `${p['name']}::${cli}`;
    if (seen.has(key)) {
      throw new ConfigError(
        `Duplicate (name, agent_cli) combination: "@${p['name']}" with agent_cli="${cli}" in ${configPath}`
      );
    }
    seen.add(key);
  }

  return entries as unknown as Provider[];
}
