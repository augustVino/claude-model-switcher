# Claude Model Switcher

一个轻量级 npm 全局包，让你在 Claude Code CLI 中通过 `@<provider>` 语法快速切换不同 AI 模型。

## 它解决什么问题

Claude Code 默认只能使用 Anthropic 的模型。但很多场景下我们需要使用其他兼容 Anthropic API 的模型服务商（如智谱 GLM、公司内部模型等），并且经常需要同时开启多个终端窗口，分别连接不同的模型并行工作。

目前的做法是每次手动 export 环境变量，或者写多个 alias / shell 函数——既繁琐又容易出错。

Claude Model Switcher 让这一切变成一条命令：

```bash
claude @zhipu              # 用智谱 GLM
claude @lp:qwen3-plus      # 用公司内部指定模型
claude                      # 用默认 provider（配置文件第一个）
```

## 安装

```bash
npm install -g git+ssh://git@github.com:user/claude-model-switcher.git
```

## 前提条件

- macOS / Linux
- Claude Code CLI 已安装在 **npm 全局 bin 之外的路径**（如 `~/.local/bin/claude`）
- Node.js >= 18（解析 JSON 配置时调用 node，开销极小）

> **PATH 要求：** 安装后 npm 全局 bin 目录中的 `claude` 会指向 wrapper。wrapper 通过 `type -aP claude` 查找真正的 claude 二进制（跳过自身）。如果真正的 claude 和 wrapper 在同一个目录下，wrapper 无法区分，会报错退出。

## 配置

### 1. 创建 provider 配置文件

```bash
mkdir -p ~/.config/claude-model-switcher
cat > ~/.config/claude-model-switcher/providers.json << 'EOF'
[
  {
    "name": "zhipu",
    "base_url": "https://open.bigmodel.cn/api/anthropic",
    "api_key_env": "ZHIPU_API_KEY",
    "default_model": "glm-4.6",
    "default_small_model": "glm-4.5-air"
  },
  {
    "name": "lp",
    "base_url": "http://internal.company.com/api/anthropic",
    "api_key_env": "LP_API_KEY"
  }
]
EOF
```

### 2. 在 shell 配置中设置 API Key

```bash
# ~/.zshrc 或 ~/.bashrc
export ZHIPU_API_KEY="your-key-here"
export LP_API_KEY="your-key-here"
```

### 3. 生效

```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

## 用法

```bash
# 使用默认 provider（配置文件第一个）
claude

# 指定 provider（使用其默认模型）
claude @zhipu

# 指定 provider + 模型
claude @zhipu:glm-4.6
claude @lp:qwen3-plus

# 列出所有已配置的 provider
claude @list

# 配合 Claude Code 官方参数使用（@ 参数位置灵活）
claude @zhipu -r sessionID
claude @lp -p "介绍一下这个项目"
claude -r sessionID @zhipu
claude @zhipu:glm-4.6 -p "hello"
```

## 配置文件格式

文件路径：`${XDG_CONFIG_HOME:-$HOME/.config}/claude-model-switcher/providers.json`

```json
[
  {
    "name": "zhipu",
    "base_url": "https://open.bigmodel.cn/api/anthropic",
    "api_key_env": "ZHIPU_API_KEY",
    "default_model": "glm-4.6",
    "default_small_model": "glm-4.5-air"
  }
]
```

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | provider 标识，用于 `@name`，仅允许 `[a-zA-Z0-9_-]` |
| base_url | 是 | Anthropic 兼容 API 端点 |
| api_key_env | 是 | 存放 API Key 的环境变量名 |
| default_model | 否 | 不指定模型时的默认模型 |
| default_small_model | 否 | 轻量模型（留空则同 default_model） |

**规则：**

- 无 `@` 参数时，使用数组中第一个 provider 作为默认
- 若 provider 未配置 `default_model`，则调用时必须指定模型（`@lp:some-model`）
- `default_small_model` 仅影响 `ANTHROPIC_SMALL_FAST_MODEL` 和 `ANTHROPIC_DEFAULT_HAIKU_MODEL`，其余环境变量使用 `default_model`

## 新增 Provider

只需在配置文件数组中添加一个对象，并 export 对应的 API Key：

```json
{
  "name": "kimi",
  "base_url": "https://api.kimi.com/anthropic",
  "api_key_env": "KIMI_API_KEY",
  "default_model": "kimi-latest"
}
```

无需修改任何代码。

## 隔离性

每个终端进程拥有独立的环境变量空间。wrapper 通过 `exec` 替换自身为真正的 claude 进程，环境变量固化在进程内。多个终端窗口分别运行不同 provider 互不干扰。

## 工作原理

```
用户输入: claude @zhipu:glm-4.6 -r abc123
         │
         ▼
  claude.sh (npm 全局 bin)
         │
         ├─ 1. 检查配置文件是否存在
         ├─ 2. 从参数中提取 @zhipu:glm-4.6 → provider=zhipu, model=glm-4.6
         ├─ 3. 若无 @provider，取配置文件第一个 provider 作为默认
         ├─ 4. 校验 provider name 合法性（仅允许字母数字下划线连字符）
         ├─ 5. 从配置文件查找 provider，读取 base_url、api_key_env、模型信息
         ├─ 6. 检查 --model 参数冲突（有则输出警告）
         ├─ 7. 检查 API Key 环境变量是否已设置
         ├─ 8. 设置 ANTHROPIC_* 环境变量（同时清除 ANTHROPIC_API_KEY）
         ├─ 9. 通过 type -aP claude 查找真正的 claude 二进制（跳过自身）
         └─ 10. exec 真正的 claude，传入剩余参数 -r abc123
         │
         ▼
  真正的 claude CLI（使用智谱后端运行）
```

### 设置的环境变量

| 环境变量 | 值来源 |
|----------|--------|
| `ANTHROPIC_BASE_URL` | provider 的 `base_url` |
| `ANTHROPIC_AUTH_TOKEN` | `api_key_env` 指向的环境变量值 |
| `ANTHROPIC_MODEL` | 显式指定的模型 或 `default_model` |
| `ANTHROPIC_SMALL_FAST_MODEL` | 显式指定的模型 或 `default_small_model`（回退到 `default_model`） |
| `ANTHROPIC_REASONING_MODEL` | 同 `ANTHROPIC_MODEL` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | 同 `ANTHROPIC_MODEL` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | 同 `ANTHROPIC_MODEL` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 同 `ANTHROPIC_SMALL_FAST_MODEL` |

同时会清除 `ANTHROPIC_API_KEY`，避免与 `ANTHROPIC_AUTH_TOKEN` 冲突。

## 许可证

MIT
