import type { Recorder } from './trace-recorder';

// Minimal ambient shim: tsc has no @types/bun in this project, so Bun.serve is
// otherwise untyped (TS2867). Declared structurally to satisfy strict mode
// without altering runtime behavior. Keep narrow — only the surface used here.
declare const Bun: {
  serve(opts: {
    port?: number | string;
    fetch: (req: Request) => Response | Promise<Response>;
  }): { port: number; stop(immediately?: boolean): void };
};

export interface TraceProxyOptions {
  upstreamBaseUrl: string;
  recorder: Recorder;
  fetchImpl?: typeof fetch;
}

export interface TraceProxy {
  port: number;
  stop: () => Promise<void>;
}

// 记录端单请求 body 字节上限（透传不受此限）。超出后停止累积，仅标记 truncated。
// TODO v2: stream recorded body to a sidecar file instead of capping
const MAX_BODY_BYTES = 1_000_000;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// hop-by-hop（RFC 7230）+ content-length（body 读取重发后由 fetch 重算）
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-connection', 'te', 'trailer',
  'transfer-encoding', 'upgrade', 'content-length',
]);

// 响应端需剥离：Bun.fetch 已自动解压 body，保留这些头会让下游对明文再解压
const RESPONSE_STRIP = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

/** 起本地反向代理，捕获 claude → upstream 的流量（SSE 边透传边记录） */
export function startTraceProxy(opts: TraceProxyOptions): TraceProxy {
  const upstream = opts.upstreamBaseUrl.replace(/\/$/, '');
  const upstreamHost = new URL(upstream).host;
  const fetchFn = opts.fetchImpl ?? fetch;
  const recorder = opts.recorder;
  const inflight = new Set<Promise<unknown>>();

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const upstreamUrl = upstream + url.pathname + url.search;
      const hasBody = BODY_METHODS.has(req.method);
      const reqBodyText = hasBody ? await req.text() : '';
      const reqPath = url.pathname + url.search;
      const reqHeadersObj = headersToObject(req.headers);
      const reqBodyParsed = hasBody ? safeParse(reqBodyText) : null;
      const startTs = Date.now();

      // 请求转发头：剥离 hop-by-hop，改 host
      const fwd = new Headers();
      req.headers.forEach((v: string, k: string) => {
        if (!HOP_BY_HOP.has(k.toLowerCase())) fwd.set(k, v);
      });
      fwd.set('host', upstreamHost);
      fwd.set('accept-encoding', 'identity'); // 让 upstream 永不压缩，消除对 Bun.fetch 自动解压的隐式依赖（NB4 加固）

      let upstreamRes: Response;
      try {
        upstreamRes = await fetchFn(upstreamUrl, {
          method: req.method,
          headers: fwd,
          body: hasBody ? reqBodyText : undefined,
        });
      } catch (err) {
        recorder.writeRequest({
          timestamp: new Date(startTs).toISOString(),
          durationMs: Date.now() - startTs,
          request: { method: req.method, path: reqPath, headers: reqHeadersObj, body: reqBodyParsed },
          response: { status: 502, headers: {}, body: { error: (err as Error).message }, sse: false },
        });
        return new Response('Bad Gateway (ccs trace proxy)', { status: 502 });
      }

      const contentType = upstreamRes.headers.get('content-type') ?? '';
      const isSSE = contentType.includes('text/event-stream');
      const resHeadersObj = headersToObject(upstreamRes.headers);

      // 响应转发头：剥离 content-encoding/content-length/transfer-encoding
      const resFwd = new Headers();
      upstreamRes.headers.forEach((v: string, k: string) => {
        if (!RESPONSE_STRIP.has(k.toLowerCase())) resFwd.set(k, v);
      });

      // 边透传边收集（记录端有上限，透传不受限）
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let truncated = false;

      const work = (async () => {
        const reader = (upstreamRes.body ?? new ReadableStream({ start(c) { c.close(); } })).getReader();
        let incomplete = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value); // 透传永不截断
            totalBytes += value.byteLength;
            if (!truncated) {
              if (totalBytes > MAX_BODY_BYTES) {
                truncated = true; // 超上限：停止累积，但继续转发
              } else {
                chunks.push(value);
              }
            }
          }
        } catch {
          // 流中途出错：尽力透传已收到的内容，并标记 incomplete 以保留调试价值
          incomplete = true;
        } finally {
          await writer.close().catch(() => {});
          try {
            const fullText = concatToText(chunks);
            recorder.writeRequest({
              timestamp: new Date(startTs).toISOString(),
              durationMs: Date.now() - startTs,
              request: { method: req.method, path: reqPath, headers: reqHeadersObj, body: reqBodyParsed },
              response: {
                status: upstreamRes.status,
                headers: resHeadersObj,
                body: isSSE ? fullText : safeParse(fullText),
                sse: isSSE,
                incomplete,
                truncated,
              },
            });
          } catch (e) {
            process.stderr.write(`ccs trace: failed to record request: ${(e as Error).message}\n`);
          }
        }
      })();
      inflight.add(work);
      work.catch(() => {}); // 吞掉录制失败/流中断的 rejection，避免 unhandled rejection 崩溃（NB3）
      work.finally(() => inflight.delete(work));

      return new Response(readable, { status: upstreamRes.status, headers: resFwd });
    },
  });

  return {
    port: server.port,
    async stop() {
      // 等 in-flight 写入完成；硬超时兜底，防 upstream hang 导致 allSettled 永不结束（NB2 防御）
      await Promise.race([
        Promise.allSettled([...inflight]),
        new Promise<void>(r => setTimeout(r, 2000)),
      ]);
      server.stop(true);
    },
  };
}

function headersToObject(h: Headers): Record<string, string> {
  const o: Record<string, string> = {};
  // set-cookie 多值会被覆盖（只留最后）；set-cookie 已打码为 ***，丢失多值影响极小，完整聚合留待 v2。
  h.forEach((v, k) => { o[k] = v; });
  return o;
}

function concatToText(chunks: Uint8Array[]): string {
  const dec = new TextDecoder();
  let out = '';
  for (const c of chunks) out += dec.decode(c, { stream: true });
  out += dec.decode();
  return out;
}

function safeParse(text: string): unknown {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}
