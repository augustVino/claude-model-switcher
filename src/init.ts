import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import chalk from 'chalk';
import { readConfig, ConfigError } from './config';

const CONFIG_TEMPLATE = `[
    {
        "name": "example-provider",
        "base_url": "https://your-api-endpoint/anthropic",
        "api_key_env": "EXAMPLE_API_KEY",
        "default_model": "model-name",
        "agent_cli": "cc"
    }
]
`;

export async function initConfig(configPath: string): Promise<void> {
  const dir = dirname(configPath);

  if (!existsSync(configPath)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');
    process.stdout.write(`${chalk.green('✓')} Config initialized: ${chalk.cyan(configPath)}\n`);
    process.exit(0);
  }

  try {
    readConfig(configPath);
  } catch (e) {
    if (e instanceof ConfigError) {
      process.stderr.write(`${chalk.red('✗')} ${chalk.red(`Existing config appears invalid: ${e.message}`)}\n`);
      process.stderr.write(chalk.dim('  Please fix or remove the file before running @init again.\n'));
    } else {
      process.stderr.write(`${chalk.red('✗')} Config exists but could not be validated.\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`${chalk.green('✓')} Config file already exists: ${chalk.cyan(configPath)}\n`);
  process.exit(0);
}
