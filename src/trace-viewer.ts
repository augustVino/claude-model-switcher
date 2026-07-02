import { existsSync } from 'node:fs';
import { buildTracePath, latestSession, cleanSessions } from './trace-session';
import { openInEditor } from './editor';

export interface ViewerOptions {
  exitImpl?: (code?: number) => never;
}

/** 处理 `ccs @trace [rest...]` */
export function viewTrace(rest: string[], tracesDir: string, opts: ViewerOptions = {}): void {
  const exitFn = opts.exitImpl ?? ((code?: number) => process.exit(code ?? 1));
  const arg = rest[0];

  if (arg === 'clean') {
    handleClean(rest, tracesDir, exitFn);
    return;
  }

  let target: string;
  if (!arg) {
    if (!existsSync(tracesDir)) {
      process.stderr.write('No traces directory yet. Run a provider with trace enabled first.\n');
      exitFn(1);
    }
    target = tracesDir;
  } else if (arg === 'latest') {
    const sid = latestSession(tracesDir);
    if (!sid) {
      process.stderr.write('No trace sessions yet. Run a provider with trace enabled first.\n');
      exitFn(1);
      return;
    }
    target = buildTracePath(tracesDir, sid);
  } else {
    const path = buildTracePath(tracesDir, arg);
    if (!existsSync(path)) {
      process.stderr.write(`No trace session '${arg}'. Run 'ccs @trace' to open the traces dir.\n`);
      exitFn(1);
    }
    target = path;
  }

  openInEditor(target, { exitImpl: exitFn });
}

function handleClean(rest: string[], tracesDir: string, exitFn: (code?: number) => never): void {
  const hasAll = rest.includes('--all');
  const keepIdx = rest.indexOf('--keep');
  const hasKeep = keepIdx !== -1 && rest[keepIdx + 1] !== undefined;
  if (hasAll && hasKeep) {
    process.stderr.write('Error: --all and --keep conflict. Choose one.\n');
    exitFn(1);
  }
  let keep = 50;
  if (hasAll) {
    keep = 0;
  } else if (hasKeep) {
    const n = parseInt(rest[keepIdx + 1], 10);
    keep = Number.isNaN(n) ? 50 : Math.max(0, n);
  }
  const result = cleanSessions(tracesDir, keep);
  process.stderr.write(`Kept ${result.kept.length} session(s), removed ${result.removed.length}.\n`);
  exitFn(0);
}
