#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// 配置文件路径（优先 XDG，Windows 回退到 %APPDATA%，其余回退到 ~/.config）
function getConfigPath() {
  const fileName = 'claude-model-switcher/providers.json';
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, fileName);
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      fileName
    );
  }
  return path.join(os.homedir(), '.config', fileName);
}

const confPath = getConfigPath();

// 解析配置文件
let providers;
try {
  providers = JSON.parse(fs.readFileSync(confPath, 'utf8'));
} catch (e) {
  if (e.code === 'ENOENT') {
    process.stderr.write(`Error: Config not found: ${confPath}\n`);
    process.stderr.write('Create a JSON array with provider objects. See README for format.\n');
  } else {
    process.stderr.write(`Error: Failed to parse config: ${confPath}\n`);
  }
  process.exit(1);
}

if (!Array.isArray(providers) || providers.length === 0) {
  process.stderr.write(`Error: No providers configured in ${confPath}\n`);
  process.exit(1);
}

// 校验每个 provider 的必填字段
const requiredFields = ['name', 'base_url', 'api_key_env'];
for (const p of providers) {
  for (const field of requiredFields) {
    if (!p[field]) {
      process.stderr.write(`Error: Provider "${p.name || '(unnamed)'}" missing required field "${field}" in ${confPath}\n`);
      process.exit(1);
    }
  }
  if (p.name === 'list') {
    process.stderr.write(`Error: Provider name "list" is reserved (@list is a built-in command)\n`);
    process.exit(1);
  }
}

// 从命令行参数中提取 @provider[:model]，剩余参数原样保留
const argv = process.argv.slice(2);
let provider = '';
let model = '';
const args = [];

for (const arg of argv) {
  if (arg.startsWith('@') && !provider) {
    const raw = arg.slice(1);
    // @list 特殊命令：列出所有已配置的 provider
    if (raw === 'list') {
      console.log('Available providers:');
      for (const p of providers) {
        let line = `  @${p.name}`;
        if (p.default_model) line += ` (default: ${p.default_model})`;
        console.log(line);
      }
      process.exit(0);
    }
    // 按 : 分割 provider 和 model（: 不与模型名中的 - 冲突）
    const colonIdx = raw.indexOf(':');
    if (colonIdx === -1) {
      provider = raw;
    } else {
      provider = raw.slice(0, colonIdx);
      model = raw.slice(colonIdx + 1);
    }
  } else {
    args.push(arg);
  }
}

// 无 @provider 时，使用配置文件中第一个 provider 作为默认
if (!provider) {
  provider = providers[0].name;
}

// 校验 provider name 仅允许字母、数字、下划线、连字符
if (!/^[a-zA-Z0-9_-]+$/.test(provider)) {
  process.stderr.write(`Error: Invalid provider name '${provider}'. Only [a-zA-Z0-9_-] allowed.\n`);
  process.exit(1);
}

// 从配置文件中查找 provider
const providerConfig = providers.find(p => p.name === provider);
if (!providerConfig) {
  process.stderr.write(`Error: Unknown provider '@${provider}'\n`);
  process.stderr.write('Available:\n');
  for (const p of providers) {
    process.stderr.write(`  @${p.name}\n`);
  }
  process.exit(1);
}

const { base_url, api_key_env, default_model, default_small_model } = providerConfig;

// 在 API key 校验之前检查 --model 冲突（确保警告总能输出）
for (const a of args) {
  if (a === '--model' || a.startsWith('--model=')) {
    process.stderr.write(`Warning: --model flag conflicts with @${provider}. The --model value will override the provider setting.\n`);
    break;
  }
}

// 检查 API Key 是否已设置
const apiKey = process.env[api_key_env] || '';
if (!apiKey) {
  process.stderr.write(`Error: API key not set. Export ${api_key_env} in your shell config.\n`);
  process.exit(1);
}

// 设置 Anthropic 兼容环境变量，清除原始 API Key 避免冲突
delete process.env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_BASE_URL = base_url;
process.env.ANTHROPIC_AUTH_TOKEN = apiKey;

// 解析模型：显式指定 > default_model > default_small_model 回退
let resolvedModel;
let resolvedSmall;

if (model) {
  resolvedModel = model;
  resolvedSmall = model;
} else if (default_model) {
  resolvedModel = default_model;
  resolvedSmall = default_small_model || default_model;
} else {
  process.stderr.write(`Error: Provider '@${provider}' has no default model. Specify one: claude @${provider}:<model>\n`);
  process.exit(1);
}

process.env.ANTHROPIC_MODEL = resolvedModel;
process.env.ANTHROPIC_SMALL_FAST_MODEL = resolvedSmall;
process.env.ANTHROPIC_REASONING_MODEL = resolvedModel;
process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = resolvedModel;
process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = resolvedModel;
process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = resolvedSmall;

// 查找真正的 claude 二进制（跳过自身所在目录，避免循环调用）
// 关键：npm 全局安装时 claude 是符号链接，需要用 realpath 做比较
const selfDir = fs.realpathSync(path.dirname(process.argv[1]));
const pathDirs = (process.env.PATH || '').split(path.delimiter);

// Windows 上读取 PATHEXT 构建候选列表，其余平台只用 claude
const candidates = process.platform === 'win32'
  ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.PS1').split(';')
      .map(ext => `claude${ext.toLowerCase()}`)
      .concat(['claude'])
  : ['claude'];

let realClaude = null;
for (const dir of pathDirs) {
  for (const name of candidates) {
    const fullPath = path.resolve(dir, name);
    try {
      fs.statSync(fullPath);
    } catch {
      continue;
    }
    // 跳过自身所在目录（用 realpath 比较，处理符号链接和大小写）
    try {
      if (fs.realpathSync(path.dirname(fullPath)) === selfDir) continue;
    } catch {
      // 损坏的符号链接或不可访问目录，跳过
      continue;
    }
    realClaude = fullPath;
    break;
  }
  if (realClaude) break;
}

if (!realClaude) {
  process.stderr.write('Error: claude binary not found in PATH (excluding this wrapper)\n');
  process.exit(1);
}

// spawn 真正的 claude，环境变量已固化在 process.env 中
// Windows 上 .cmd 文件需要 shell: true 才能执行
const spawnOptions = { stdio: 'inherit' };
if (process.platform === 'win32') {
  spawnOptions.shell = true;
}

const child = spawn(realClaude, args, spawnOptions);
child.on('error', (err) => {
  process.stderr.write(`Error: Failed to launch claude: ${err.message}\n`);
  process.exit(1);
});
child.on('close', (code) => {
  process.exit(code ?? 1);
});
