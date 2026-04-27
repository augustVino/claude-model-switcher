import { getConfigPath, readConfig, ConfigError } from './config';
import { parseArgs } from './args';
import { resolveProvider } from './provider';
import { listProviders } from './list';
import type { Provider, ResolvedConfig } from './types';
import { dirname } from 'node:path';
import { spawn, type SpawnOptions } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export async function main(
  argv: string[],
  spawnFn: typeof spawn = spawn
): Promise<void> {
  const confPath = getConfigPath();

  let providers: Provider[];
  try {
    providers = readConfig(confPath);
  } catch (e) {
    if (e instanceof ConfigError) {
      printConfigNotFoundHint(confPath, e);
    } else {
      process.stderr.write(`Error: ${(e as Error).message}\n`);
    }
    process.exit(1);
  }

  const args = parseArgs(argv);

  if (args.isListCommand) {
    listProviders(providers);
    process.exit(0);
  }

  for (const a of args.rest) {
    if (a === '--model' || a.startsWith('--model=')) {
      process.stderr.write(
        `Warning: --model flag conflicts with @${args.provider}. The --model value will override the provider setting.\n`
      );
      break;
    }
  }

  let config: ResolvedConfig;
  try {
    config = resolveProvider(providers, args);
  } catch (e) {
    process.stderr.write(`Error: ${(e as Error).message}\n`);
    process.exit(1);
  }

  delete process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_BASE_URL = config.base_url;
  process.env.ANTHROPIC_AUTH_TOKEN = config.apiKey;
  process.env.ANTHROPIC_MODEL = config.model;
  process.env.ANTHROPIC_SMALL_FAST_MODEL = config.smallModel;
  process.env.ANTHROPIC_REASONING_MODEL = config.model;
  process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.model;
  process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.model;
  process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.smallModel;

  const spawnOptions: SpawnOptions = { stdio: 'inherit' };
  if (process.platform === 'win32') {
    spawnOptions.shell = true;
  }

  const child = spawnFn('claude', args.rest, spawnOptions) as ChildProcess;
  child.on('error', (err: Error) => {
    process.stderr.write(`Error: Failed to launch claude: ${err.message}\n`);
    process.exit(1);
  });
  child.on('close', (code: number | null) => {
    process.exit(code ?? 1);
  });
}

function printConfigNotFoundHint(confPath: string, err: Error): void {
  process.stderr.write(`Error: ${err.message}\n\n`);
  process.stderr.write('Quick setup:\n\n');
  process.stderr.write(`  mkdir -p '${dirname(confPath)}'\n`);
  process.stderr.write(`  cat > '${confPath}' << 'EOF'\n`);
  process.stderr.write('  [\n');
  process.stderr.write('    {\n');
  process.stderr.write('      "name": "my-provider",\n');
  process.stderr.write('      "base_url": "https://your-api-endpoint/anthropic",\n');
  process.stderr.write('      "api_key_env": "MY_API_KEY",\n');
  process.stderr.write('      "default_model": "model-name"\n');
  process.stderr.write('    }\n');
  process.stderr.write('  ]\n');
  process.stderr.write('  EOF\n\n');
  process.stderr.write('  export MY_API_KEY="your-api-key"\n');
}
