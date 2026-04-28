import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readConfig, ConfigError } from './config';

const CONFIG_TEMPLATE = `[
    {
        "name": "example-provider",
        "base_url": "https://your-api-endpoint/anthropic",
        "api_key_env": "EXAMPLE_API_KEY",
        "default_model": "model-name"
    }
]
`;

export async function initConfig(configPath: string): Promise<void> {
  const dir = dirname(configPath);

  if (!existsSync(configPath)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');
    process.stdout.write(`✓ Config initialized: ${configPath}\n`);
    process.exit(0);
  }

  // File exists — validate
  try {
    readConfig(configPath);
  } catch (e) {
    if (e instanceof ConfigError) {
      process.stderr.write(`! Existing config appears invalid: ${e.message}\n`);
      process.stderr.write(`  Please fix or remove the file before running @init again.\n`);
    } else {
      process.stderr.write(`! Config exists but could not be validated.\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`✓ Config file already exists: ${configPath}\n`);
  process.exit(0);
}
