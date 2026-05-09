import chalk from 'chalk';
import stringWidth from 'string-width';
import { boxLine } from './box';
import type { Provider } from './types';
import { resolveProviderModels } from './types';

const TAG_COL = 18;

export function listProviders(providers: Provider[]): void {
  const lines: string[] = [];

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    lines.push('  ' + chalk.bold(p.name));

    const models = resolveProviderModels(p);
    for (let j = 0; j < models.length; j++) {
      const isLast = j === models.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const tag = buildTag(models[j], p);
      lines.push('    ' + prefix + ' ' + models[j] + tag);
    }

    if (i < providers.length - 1) lines.push('');
  }

  let maxContentWidth = 0;
  for (const line of lines) {
    maxContentWidth = Math.max(maxContentWidth, stringWidth(line));
  }

  const title = chalk.bold('Providers');
  const innerWidth = Math.max(maxContentWidth, stringWidth(title) + 4);

  const titleBar = '─ ' + title + ' ';
  const rightPad = Math.max(0, innerWidth + 2 - stringWidth(titleBar));

  console.log();
  console.log(chalk.cyan('╭' + titleBar + '─'.repeat(rightPad) + '╮'));
  console.log(boxLine('', innerWidth, chalk.cyan));
  for (const line of lines) {
    console.log(boxLine(line, innerWidth, chalk.cyan));
  }
  console.log(boxLine('', innerWidth, chalk.cyan));
  console.log(chalk.cyan('╰' + '─'.repeat(innerWidth + 2) + '╯'));
  console.log();
}

function buildTag(model: string, provider: Provider): string {
  const tags: string[] = [];
  if (provider.agent_cli === 'codex') tags.push(chalk.magenta('[codex]'));
  if (model === provider.default_model) tags.push(chalk.green('[default]'));
  if (model === provider.default_small_model && model !== provider.default_model) {
    tags.push(chalk.yellow('[small]'));
  }
  if (tags.length === 0) return '';
  const pad = ' '.repeat(Math.max(0, TAG_COL - stringWidth(model)));
  return pad + tags.join(' ');
}
