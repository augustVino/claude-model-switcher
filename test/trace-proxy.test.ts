import { describe, expect, it, beforeEach, afterAll } from 'bun:test';
import { setupTmpDir } from './helpers';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { startTraceProxy } from '../src/trace-proxy';
import { Recorder } from '../src/trace-recorder';

let tmpDir: string;

// mock upstream：返回 SSE 明文流
const upstream = Bun.serve({
  port: 0,
  async fetch() {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('data: {"type":"message_start"}\n\n'));
        controller.enqueue(enc.encode('data: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n'));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  },
});

// mock upstream：返回 gzip 压缩响应（验证响应头剥离）
const upstreamGzip = Bun.serve({
  port: 0,
  async fetch() {
    const gz = Bun.gzipSync(new TextEncoder().encode('data: {"gz":"yes"}\n\n'));
    return new Response(gz, {
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'content-encoding': 'gzip', 'content-length': String(gz.length) },
    });
  },
});

// mock upstream：长 SSE 流（2000 × ~1KB ≈ 2MB），验证透传不截断、记录端截断
const upstreamLong = Bun.serve({
  port: 0,
  async fetch() {
    const chunk = new TextEncoder().encode('data: ' + 'x'.repeat(1010) + '\n\n');
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < 2000) { controller.enqueue(chunk); i++; }
        else controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  },
});

afterAll(() => { upstream.stop(true); upstreamGzip.stop(true); upstreamLong.stop(true); });
beforeEach(async () => { tmpDir = await setupTmpDir(); });

function newRecorder(name: string): Recorder {
  return new Recorder(join(tmpDir, name), {
    sessionId: 's', provider: 'zhipu', model: 'glm', startTime: 't', cwd: '/',
  });
}

describe('startTraceProxy', () => {
  it('transparently streams SSE and records (await stop, no sleep)', async () => {
    const recorder = newRecorder('a.jsonl');
    const proxy = startTraceProxy({ upstreamBaseUrl: `http://127.0.0.1:${upstream.port}`, recorder });

    const res = await fetch(`http://127.0.0.1:${proxy.port}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
      body: JSON.stringify({ model: 'glm', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('message_start');
    // 响应头必须已剥离 content-encoding/content-length（否则 res.text() 会 ZlibError，本断言不可达）
    expect(res.headers.get('content-encoding')).toBeNull();

    await proxy.stop(); // 等 in-flight recorder 写入完成
    recorder.close();

    const lines = readFileSync(join(tmpDir, 'a.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(lines).toHaveLength(2);
    const rec = lines[1];
    expect(rec.type).toBe('request');
    expect(rec.request.path).toBe('/v1/messages');
    expect(rec.request.headers['x-api-key']).toBe('***');
    expect(rec.request.body.model).toBe('glm');
    expect(rec.response.sse).toBe(true);
    expect(rec.response.body).toContain('message_start');
    expect(rec.response.status).toBe(200);
  });

  it('strips gzip content-encoding so caller decodes plaintext OK', async () => {
    const recorder = newRecorder('gz.jsonl');
    const proxy = startTraceProxy({ upstreamBaseUrl: `http://127.0.0.1:${upstreamGzip.port}`, recorder });

    const res = await fetch(`http://127.0.0.1:${proxy.port}/`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(res.headers.get('content-encoding')).toBeNull();
    const text = await res.text(); // 若未剥离 content-encoding，这里会 ZlibError
    expect(text).toContain('"gz":"yes"');

    await proxy.stop();
    recorder.close();
  });

  it('returns 502 and records error when upstream unreachable', async () => {
    const recorder = newRecorder('b.jsonl');
    const proxy = startTraceProxy({ upstreamBaseUrl: 'http://127.0.0.1:1', recorder });

    const res = await fetch(`http://127.0.0.1:${proxy.port}/v1/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(res.status).toBe(502);
    await proxy.stop(); // 无 in-flight，立即返回；502 记录为同步写
    recorder.close();

    const lines = readFileSync(join(tmpDir, 'b.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(lines[1].response.status).toBe(502);
  });

  it('marks response incomplete when upstream stream errors mid-way', async () => {
    const recorder = newRecorder('err.jsonl');
    // 通过 fetchImpl 注入控制 proxy 读取的流（HTTP 边界会把流错误吞成 EOF，故在此直接注入，
    // 忠实模拟 Bun.fetch 在真实中途断连时 surface 给消费端的 read 拒绝）
    let pulled = false;
    const mockFetch = (() => {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!pulled) {
            pulled = true;
            controller.enqueue(new TextEncoder().encode('data: {"type":"message_start"}\n\n'));
            return;
          }
          return Promise.reject(new Error('upstream stream broke'));
        },
      });
      return Promise.resolve(new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }));
    }) as unknown as typeof fetch;

    const proxy = startTraceProxy({
      upstreamBaseUrl: 'http://upstream.invalid',
      recorder,
      fetchImpl: mockFetch,
    });

    const res = await fetch(`http://127.0.0.1:${proxy.port}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'glm', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const text = await res.text();
    // 透明透传：客户端仍能收到出错前的那一块
    expect(text).toContain('message_start');

    await proxy.stop();
    recorder.close();

    const lines = readFileSync(join(tmpDir, 'err.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const rec = lines[1];
    expect(rec.response.incomplete).toBe(true);
    expect(rec.response.body).toContain('message_start'); // 出错前已收到的部分
  });

  it('caps recorded body at ~1MB but passes the full stream through to the client', async () => {
    const recorder = newRecorder('long.jsonl');
    const proxy = startTraceProxy({ upstreamBaseUrl: `http://127.0.0.1:${upstreamLong.port}`, recorder });

    const res = await fetch(`http://127.0.0.1:${proxy.port}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'glm', messages: [{ role: 'user', content: 'hi' }] }),
    });
    const buf = await res.arrayBuffer();
    // 透传永不截断：客户端收到完整 ~2MB
    expect(buf.byteLength).toBeGreaterThan(1_500_000);

    await proxy.stop();
    recorder.close();

    const lines = readFileSync(join(tmpDir, 'long.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const rec = lines[1];
    expect(rec.response.truncated).toBe(true);
    // 记录端被截断到 ≤ ~1MB
    const bodyLen = typeof rec.response.body === 'string' ? rec.response.body.length : 0;
    expect(bodyLen).toBeLessThanOrEqual(1_100_000);
  });
});