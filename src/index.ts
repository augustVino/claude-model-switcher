import chalk from 'chalk';
import stringWidth from 'string-width';
import { readFileSync } from 'node:fs';
import { padDisplayWidth, boxLine } from './box';
import { fileURLToPath } from 'node:url';

import { getConfigPath, readConfig, ConfigError } from './config';
import { parseArgs } from './args';
import { resolveProvider } from './provider';
import { listProviders } from './list';
import type { Provider, ResolvedConfig } from './types';
import { dirname, join } from 'node:path';
import { spawn, type SpawnOptions } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { checkUpdateNotification, readCache, semverGt, PKG_NAME } from './update-checker';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
})();

export async function main(
  argv: string[],
  spawnFn: typeof spawn = spawn
): Promise<void> {
  const args = parseArgs(argv);

  if (!args.isUpdateCommand) {
    checkUpdateNotification(version);
  }

  if (args.isHelpCommand) {
    printHelp();
    process.exit(0);
  }

  if (args.isInitCommand) {
    const { initConfig } = await import('./init');
    const confPath = getConfigPath();
    await initConfig(confPath);
    return;
  }

  if (args.isUpdateCommand) {
    const cache = readCache();
    if (cache && !semverGt(cache.latestVersion, version)) {
      console.log(chalk.green(`已是最新版本 (${version})`));
      process.exit(0);
    }

    const isBun = !!process.versions.bun;
    const cmd = isBun ? 'bun' : 'npm';
    const child = spawnFn(cmd, ['install', '-g', `${PKG_NAME}@latest`], { stdio: 'inherit', ...(process.platform === 'win32' ? { shell: true } : {}) }) as ChildProcess;
    child.on('error', (err: Error) => {
      process.stderr.write(chalk.red(`Error: ${err.message}\n`));
      process.exit(1);
    });
    child.on('close', (code: number | null) => {
      process.exit(code ?? 1);
    });
    return;
  }

  const confPath = getConfigPath();

  let providers: Provider[];
  try {
    providers = readConfig(confPath);
  } catch (e) {
    if (e instanceof ConfigError) {
      printConfigNotFoundHint(confPath, e);
    } else {
      process.stderr.write(chalk.red(`Error: ${(e as Error).message}\n`));
    }
    process.exit(1);
  }

  if (args.isListCommand) {
    listProviders(providers);
    process.exit(0);
  }

  for (const a of args.rest) {
    if (a === '--model' || a.startsWith('--model=')) {
      process.stderr.write(
        chalk.yellow('Warning:') + ` --model flag conflicts with @${args.provider}. The --model value will override the provider setting.\n`
      );
      break;
    }
  }

  let config: ResolvedConfig;
  try {
    config = resolveProvider(providers, args);
  } catch (e) {
    process.stderr.write(chalk.red('Error: ') + colorizeError((e as Error).message) + '\n');
    process.exit(1);
  }

  const spawnOptions: SpawnOptions = { stdio: 'inherit' };
  if (process.platform === 'win32') {
    spawnOptions.shell = true;
  }

  let child: ChildProcess;

  if (config.agent_cli === 'codex') {
    const ccsFlags: string[] = [
      '-c', 'model_provider="_ccs"',
      '-c', `model="${config.model}"`,
      '-c', `model_providers._ccs.name="_ccs"`,
      '-c', `model_providers._ccs.base_url="${config.base_url}"`,
      '-c', `model_providers._ccs.env_key="${config.apiKeyEnv}"`,
    ];
    if (config.wireApi) {
      ccsFlags.push('-c', `model_providers._ccs.wire_api="${config.wireApi}"`);
    }
    child = spawnFn('codex', [...args.rest, ...ccsFlags], spawnOptions) as ChildProcess;
    child.on('error', (err: Error) => {
      process.stderr.write(chalk.red(`Error: Failed to launch codex: ${err.message}\n`));
      process.stderr.write(chalk.dim('  Is codex installed? npm install -g @openai/codex\n'));
      process.exit(1);
    });
  } else {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_BASE_URL = config.base_url;
    process.env.ANTHROPIC_AUTH_TOKEN = config.apiKey;
    process.env.ANTHROPIC_MODEL = config.model;
    process.env.ANTHROPIC_SMALL_FAST_MODEL = config.smallModel;
    process.env.ANTHROPIC_REASONING_MODEL = config.model;
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.model;
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.model;
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.smallModel;

    child = spawnFn('claude', args.rest, spawnOptions) as ChildProcess;
    child.on('error', (err: Error) => {
      process.stderr.write(chalk.red(`Error: Failed to launch claude: ${err.message}\n`));
      process.exit(1);
    });
  }

  child.on('close', (code: number | null) => {
    process.exit(code ?? 1);
  });
}

function colorizeError(message: string): string {
  const idx = message.indexOf('Available:\n');
  if (idx === -1) {
    return chalk.red(message);
  }
  const header = message.slice(0, idx);
  const list = message.slice(idx + 'Available:\n'.length);
  const items = list.split('\n').map(line => {
    if (line.trim().startsWith('@')) return chalk.cyan(line);
    return line;
  });
  return chalk.red(header) + chalk.dim('Available:\n') + items.join('\n');
}

function printConfigNotFoundHint(confPath: string, err: Error): void {
  process.stderr.write(chalk.red(`Error: ${err.message}\n\n`));
  process.stderr.write(chalk.bold('Quick setup:\n\n'));
  process.stderr.write(chalk.dim(`  mkdir -p '${dirname(confPath)}'\n`));
  process.stderr.write(chalk.dim(`  cat > '${confPath}' << 'EOF'\n`));
  process.stderr.write(chalk.dim('  [\n'));
  process.stderr.write(chalk.dim('    {\n'));
  process.stderr.write(chalk.dim(`      "name": "my-provider",\n`));
  process.stderr.write(chalk.dim(`      "base_url": "https://your-api-endpoint/anthropic",\n`));
  process.stderr.write(chalk.dim(`      "api_key_env": "MY_API_KEY",\n`));
  process.stderr.write(chalk.dim(`      "default_model": "model-name"\n`));
  process.stderr.write(chalk.dim('    }\n'));
  process.stderr.write(chalk.dim('  ]\n'));
  process.stderr.write(chalk.dim('  EOF\n\n'));
  process.stderr.write(chalk.yellow('  export MY_API_KEY="your-api-key"\n'));
}

function printHelp(): void {
  const confPath = getConfigPath();
  const BOX_INNER_WIDTH = 45;
  const JSON_BOX_INNER_WIDTH = 50;

  const titleText = chalk.bold('Claude Model Switcher') + ' ' + chalk.dim(`v${version}`);
  const titlePadding = padDisplayWidth('', BOX_INNER_WIDTH - stringWidth(titleText) - 2);

  console.log();
  console.log(chalk.cyan('╭' + '─'.repeat(BOX_INNER_WIDTH) + '╮'));
  console.log(chalk.cyan('│') + ' ' + titleText + titlePadding + chalk.cyan('│'));
  console.log(boxLine('在多个 Claude API Provider 之间快速切换', BOX_INNER_WIDTH));
  console.log(chalk.cyan('╰' + '─'.repeat(BOX_INNER_WIDTH) + '╯'));
  console.log();

  console.log('  📂 ' + chalk.bold('配置文件路径（根据当前系统自动检测）'));
  console.log('    ' + chalk.cyan(confPath));
  console.log(chalk.dim('    macOS / Linux: $XDG_CONFIG_HOME/claude-model-switcher/providers.json'));
  console.log(chalk.dim('    Windows: %APPDATA%\\claude-model-switcher\\providers.json'));
  console.log();

  console.log('  📋 ' + chalk.bold('配置文件格式 (JSON 数组)'));
  console.log(chalk.dim('  ┌' + '─'.repeat(JSON_BOX_INNER_WIDTH) + '┐'));
  console.log(boxLine('[', JSON_BOX_INNER_WIDTH));
  console.log(boxLine('  {', JSON_BOX_INNER_WIDTH));
  console.log(boxLine('    "name": "' + chalk.green('example-provider') + '",          ' + chalk.dim('← @ 引用名'), JSON_BOX_INNER_WIDTH));
  console.log(boxLine('    "base_url": "' + chalk.green('https://...') + '",             ' + chalk.dim('← API 地址'), JSON_BOX_INNER_WIDTH));
  console.log(boxLine('    "api_key_env": "' + chalk.green('EXAMPLE_API_KEY') + '",     ' + chalk.dim('← 环境变量名'), JSON_BOX_INNER_WIDTH));
  console.log(boxLine('    "default_model": "model-name",            ' + chalk.dim('← 可选'), JSON_BOX_INNER_WIDTH));
  console.log(boxLine('    "agent_cli": "' + chalk.green('cc') + '",                     ' + chalk.dim('← 可选, "cc" | "codex"'), JSON_BOX_INNER_WIDTH));
  console.log(boxLine('    "models": ["model-1", "model-2"]         ' + chalk.dim('← 可选'), JSON_BOX_INNER_WIDTH));
  console.log(boxLine('  }', JSON_BOX_INNER_WIDTH));
  console.log(boxLine(']', JSON_BOX_INNER_WIDTH));
  console.log(chalk.dim('  └' + '─'.repeat(JSON_BOX_INNER_WIDTH) + '┘'));
  console.log();

  console.log('  🔑 ' + chalk.bold('API Key 设置'));
  console.log(chalk.dim('  将你的 API Key 设置为环境变量（添加到 ~/.zshrc 或 ~/.bashrc）：'));
  console.log('    ' + chalk.yellow('export EXAMPLE_API_KEY="your-key-here"'));
  console.log();

  console.log('  🚀 ' + chalk.bold('使用示例'));
  console.log(`    ${chalk.cyan('ccs')}` + '                          使用默认 provider 的默认模型');
  console.log(`    ${chalk.cyan('ccs @zhipu')}` + '                   使用 zhipu 的默认模型');
  console.log(`    ${chalk.cyan('ccs @zhipu:glm-4.6')}` + '           使用 zhipu 的指定模型');
  console.log(`    ${chalk.cyan('ccs @zp-codex')}` + '              使用 codex provider 启动');
  console.log(`    ${chalk.cyan('ccs @list')}` + '                     列出所有已配置的 provider');
  console.log(`    ${chalk.cyan('ccs @help')}` + '                     显示本帮助信息');
  console.log(`    ${chalk.cyan('ccs @update')}` + '                  更新到最新版本');
  console.log();
}
