import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { getConfigPath } from './config';
import chalk from 'chalk';

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const PKG_NAME = '@vinoorg/claude-model-switcher';
const VERSION_RE = /^\d+\.\d+\.\d+$/;

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

export function getCachePath(): string {
  return join(dirname(getConfigPath()), '.update-cache.json');
}

export function readCache(): UpdateCache | null {
  const path = getCachePath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return null;
  }
}

export function writeCache(cache: UpdateCache): void {
  const path = getCachePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache), 'utf8');
}

export function semverGt(a: string, b: string): boolean {
  if (!VERSION_RE.test(a) || !VERSION_RE.test(b)) return false;
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

function spawnBackgroundCheck(): void {
  const cmd = [
    `LATEST=$(npm view ${PKG_NAME} version 2>/dev/null)`,
    `if [ -n "$LATEST" ]; then`,
    `  mkdir -p "$(dirname "$CACHE_PATH")"`,
    `  printf '{"lastCheck":%s,"latestVersion":"%s"}' "$(date +%s000)" "$LATEST" > "$CACHE_PATH"`,
    `fi`
  ].join(' ');

  const child = spawn('sh', ['-c', cmd], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CACHE_PATH: getCachePath() }
  });
  child.unref();
}

export function checkUpdateNotification(currentVersion: string): void {
  const cache = readCache();

  if (cache && semverGt(cache.latestVersion, currentVersion)) {
    console.log(chalk.yellow(`\u{1F4E6} 新版本 ${cache.latestVersion} 可用，运行 ccs @update 更新`));
  }

  const shouldCheck = !cache || (Date.now() - cache.lastCheck) > CHECK_INTERVAL_MS;
  if (shouldCheck) {
    spawnBackgroundCheck();
  }
}
