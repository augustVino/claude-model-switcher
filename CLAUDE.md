# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**claude-model-switcher** (`@vinoorg/claude-model-switcher`) 是一个轻量级 CLI 工具，通过 `@<provider>` 语法快速切换 Claude Code 的 AI 模型服务商。用户运行 `ccs @zhipu` 即可使用智谱 GLM 模型，环境变量在子进程内隔离。

## Commands

```bash
# 安装依赖
bun install

# 运行全部测试
bun test

# 运行单个测试文件
bun test test/provider.test.ts

# 类型检查
bun run check          # 等价于 tsc --noEmit

# 本地调试（直接运行 bin）
bun run ./bin/ccs.ts @list
```

## Architecture

入口: `bin/ccs.ts` → `src/index.ts:main()`

主流程（`main()`）:
1. `src/args.ts` — 解析 CLI 参数，提取 `@provider:model`、`@list`、`@help`、`@init` 和其余参数
2. `@init` → `src/init.ts:initConfig()` — 在配置路径下写入模板文件，或对已有配置做校验
3. `src/config.ts` — 读取并校验 `providers.json` 配置（支持 XDG/macOS/Windows 路径），`ConfigError` 自定义错误类
4. `src/list.ts` — 处理 `@list` 命令，树形展示所有已配置 provider 及其模型
5. `src/provider.ts` — 校验 provider name、查找配置、解析 model / smallModel
6. `src/index.ts` — 设置 `ANTHROPIC_*` 环境变量，`spawn` 真正的 `claude` 进程；`@help` 触发 `printHelp()` 输出带 ASCII 框的中文帮助

关键类型定义在 `src/types.ts`：`Provider`、`ParsedArgs`、`ResolvedConfig`、`resolveProviderModels`。

### 环境变量设置逻辑

```
ANTHROPIC_BASE_URL       ← provider.base_url
ANTHROPIC_AUTH_TOKEN     ← provider.api_key_env 对应的环境变量值
ANTHROPIC_MODEL          ← 指定模型 或 default_model
ANTHROPIC_SMALL_FAST_MODEL ← 指定模型 或 default_small_model（回退到 default_model）
ANTHROPIC_REASONING_MODEL ← 同 ANTHROPIC_MODEL
ANTHROPIC_DEFAULT_OPUS_MODEL ← 同 ANTHROPIC_MODEL
ANTHROPIC_DEFAULT_SONNET_MODEL ← 同 ANTHROPIC_MODEL
ANTHROPIC_DEFAULT_HAIKU_MODEL ← 同 ANTHROPIC_SMALL_FAST_MODEL
```

同时删除 `ANTHROPIC_API_KEY`，避免与 `ANTHROPIC_AUTH_TOKEN` 冲突。

## Configuration

配置文件路径: `${XDG_CONFIG_HOME:-$HOME/.config}/claude-model-switcher/providers.json`

## Testing

测试使用 `bun:test`。所有测试文件在 `test/` 目录下。测试通过 `setupTmpDir()` / `writeConfig()`  helpers 创建临时目录和配置文件，使用 `spyOn` 拦截 `process.exit` 和 `spawn`。

## Key Constraints

- 运行时依赖 Bun（>= 1.0），不依赖 Node.js 运行时
- Provider name 仅允许 `[a-zA-Z0-9_-]`，`list` 是保留字
- `default_small_model` 仅影响 `ANTHROPIC_SMALL_FAST_MODEL` 和 `ANTHROPIC_DEFAULT_HAIKU_MODEL`
