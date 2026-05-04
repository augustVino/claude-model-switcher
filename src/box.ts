import chalk from 'chalk';
import stringWidth from 'string-width';

export function padDisplayWidth(str: string, targetWidth: number): string {
  const current = stringWidth(str);
  if (current >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - current);
}

export function boxLine(content: string, innerWidth: number, border = chalk.dim): string {
  return border('│ ') + padDisplayWidth(content, innerWidth) + border(' │');
}
