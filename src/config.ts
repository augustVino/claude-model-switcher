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
    if (p['name'] === 'list') {
      throw new ConfigError(
        `Provider name "list" is reserved (@list is a built-in command)`
      );
    }
    if (p['name'] === 'help') {
      throw new ConfigError(
        `Provider name "help" is reserved (@help is a built-in command)`
      );
    }
  }

  return entries as unknown as Provider[];
}
