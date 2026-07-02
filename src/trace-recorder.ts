import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SENSITIVE_HEADERS = new Set([
  'x-api-key',
  'authorization',
  'anthropic-auth-token',
  'api-key',
  'x-anthropic-api-key',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'anthropic-organization-id',
]);

export interface SessionMeta {
  sessionId: string;
  provider: string;
  model: string;
  startTime: string;
  cwd: string;
}

export interface TraceRecord {
  turn: number;
  timestamp: string;
  durationMs: number;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
    sse: boolean;
    /** true 表示响应流中途出错，body 仅为出错前收到的部分（调试用标记） */
    incomplete?: boolean;
  };
}

/** 打码敏感 header（key 保留，值替换为 ***） */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? '***' : v;
  }
  return out;
}

export class Recorder {
  private filePath: string;
  private turn = 0;
  private closed = false;

  constructor(filePath: string, meta: SessionMeta) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, JSON.stringify({ type: 'session_meta', ...meta }) + '\n', 'utf8');
  }

  /** 是否已记录至少一次真实请求（turn>0）。构造时写入的 session_meta 不计。 */
  get hasRecorded(): boolean {
    return this.turn > 0;
  }

  writeRequest(record: Omit<TraceRecord, 'turn'>): void {
    if (this.closed) return;
    this.turn += 1;
    const full: TraceRecord = {
      turn: this.turn,
      timestamp: record.timestamp,
      durationMs: record.durationMs,
      request: {
        method: record.request.method,
        path: record.request.path,
        headers: redactHeaders(record.request.headers),
        body: record.request.body,
      },
      response: {
        status: record.response.status,
        headers: redactHeaders(record.response.headers),
        body: record.response.body,
        sse: record.response.sse,
        incomplete: record.response.incomplete,
      },
    };
    appendFileSync(this.filePath, JSON.stringify({ type: 'request', ...full }) + '\n', 'utf8');
  }

  /** 仅标记关闭，拒绝后续写入（无外部资源需释放）。 */
  close(): void {
    this.closed = true;
  }
}
