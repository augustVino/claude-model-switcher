import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { readdirSync, unlinkSync } from 'node:fs';
import { getConfigPath } from './config';

export interface CleanResult {
  kept: string[];
  removed: string[];
}

/** 生成 session-id：<yyyymmddHHMMSS>-<provider>-<8hex> */
export function generateSessionId(provider: string, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const hex = randomBytes(4).toString('hex');
  return `${ts}-${provider}-${hex}`;
}

/** traces 目录 = dirname(getConfigPath()) + '/traces' */
export function getTracesDir(): string {
  return join(dirname(getConfigPath()), 'traces');
}

/** session-id → 完整文件路径 */
export function buildTracePath(tracesDir: string, sessionId: string): string {
  return join(tracesDir, `${sessionId}.jsonl`);
}

/** 列出所有 session-id，按字典序升序（旧→新）。ENOENT 返回 []，其他错误抛出 */
export function listSessions(tracesDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(tracesDir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  return entries
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.slice(0, -'.jsonl'.length))
    .sort();
}

/** 最新 session-id（字典序最大） */
export function latestSession(tracesDir: string): string | null {
  const sessions = listSessions(tracesDir);
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}

/** 清理：保留最近 keep 个（最新），删最老的。removed 仅含实际删除成功的 id */
export function cleanSessions(tracesDir: string, keep: number): CleanResult {
  const sessions = listSessions(tracesDir);
  if (sessions.length <= keep) {
    return { kept: sessions, removed: [] };
  }
  const removeCount = sessions.length - keep;
  const candidates = sessions.slice(0, removeCount);
  const kept = sessions.slice(removeCount);
  const removed: string[] = [];
  for (const sid of candidates) {
    try {
      unlinkSync(buildTracePath(tracesDir, sid));
      removed.push(sid);
    } catch {
      // 删除失败不计入 removed
    }
  }
  return { kept, removed };
}
