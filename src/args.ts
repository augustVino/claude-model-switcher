import type { ParsedArgs } from './types';

export function parseArgs(argv: string[]): ParsedArgs {
  let provider = '';
  let model = '';
  const rest: string[] = [];
  let isListCommand = false;
  let isHelpCommand = false;

  for (const arg of argv) {
    if (arg.startsWith('@') && !provider) {
      const raw = arg.slice(1);
      if (raw === 'list') {
        isListCommand = true;
        continue;
      }
      if (raw === 'help') {
        isHelpCommand = true;
        continue;
      }
      const colonIdx = raw.indexOf(':');
      if (colonIdx === -1) {
        provider = raw;
      } else {
        provider = raw.slice(0, colonIdx);
        model = raw.slice(colonIdx + 1);
      }
    } else {
      rest.push(arg);
    }
  }

  return { provider, model, rest, isListCommand, isHelpCommand, isInitCommand: false };
}
