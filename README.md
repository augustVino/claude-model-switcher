# Claude Model Switcher

一个轻量级 npm 全局包，让你在 Claude Code CLI 中通过 `@<provider>` 语法快速切换不同 AI 模型。

## 它解决什么问题

Claude Code 默认只能使用 Anthropic 的模型。但很多场景下我们需要使用其他兼容 Anthropic API 的模型服务商（如智谱 GLM、公司内部模型等），并且经常需要同时开启多个终端窗口，分别连接不同的模型并行工作。

目前的做法是每次手动 export 环境变量，或者写多个 alias / shell 函数——既繁琐又容易出错。

Claude Model Switcher 让这一切变成一条命令：

```bash
ccs @zhipu              # 用智谱 GLM
ccs @lp:qwen3-plus      # 用公司内部指定模型
ccs                      # 用默认 provider（配置文件第一个）
```

## 安装

```bash
npm install -g git+ssh://git@github.com:user/claude-model-switcher.git
```

> **注意：** 本工具运行时依赖 [Bun](https://bun.sh/)（>= 1.0），安装前请确保已安装 Bun。

## 前提条件

- macOS / Linux / Windows
- Claude Code CLI 已安装
- Bun >= 1.0

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
    // "models": ["model-1", "model-2"]  // 可选：显式声明可用模型列表
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
ccs

# 指定 provider（使用其默认模型）
ccs @zhipu

# 指定 provider + 模型
ccs @zhipu:glm-4.6
ccs @lp:qwen3-plus

# 列出所有已配置的 provider 及其可用模型（树形展示）
ccs @list

# 配合 Claude Code 官方参数使用（@ 参数位置灵活）
ccs @zhipu -r sessionID
ccs @lp -p "介绍一下这个项目"
ccs -r sessionID @zhipu
ccs @zhipu:glm-4.6 -p "hello"

# @list 输出示例
# Providers:
#
#   zhipu
#     ├─ glm-4.6        [default]
#     ├─ glm-4.5-air    [small]
#     └─ glm-4-plus
#
#   lp
#     └─ qwen3-plus     [default]
```

## 配置文件格式

文件路径：

- macOS/Linux: `${XDG_CONFIG_HOME:-$HOME/.config}/claude-model-switcher/providers.json`
- Windows: `%APPDATA%\claude-model-switcher\providers.json`

```json
[
  {
    "name": "zhipu",
    "base_url": "https://open.bigmodel.cn/api/anthropic",
    "api_key_env": "ZHIPU_API_KEY",
    "default_model": "glm-4.6",
    "default_small_model": "glm-4.5-air"
    // "models": ["model-1", "model-2"]  // 可选：显式声明可用模型列表
  }
]
```

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | provider 标识，用于 `@name`，仅允许 `[a-zA-Z0-9_-]`，不可为 `list`（保留字） |
| base_url | 是 | Anthropic 兼容 API 端点 |
| api_key_env | 是 | 存放 API Key 的环境变量名 |
| default_model | 否 | 不指定模型时的默认模型 |
| default_small_model | 否 | 轻量模型（留空则同 default_model） |
| models | 否 | 可用模型列表（string[]）。不配置时回退显示 default_model + default_small_model |

**规则：**

- 无 `@` 参数时，使用数组中第一个 provider 作为默认
- 若 provider 未配置 `default_model`，则调用时必须指定模型（`ccs @lp:some-model`）
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

每个终端进程拥有独立的环境变量空间。`ccs` 通过 `spawn` 启动真正的 claude 进程，环境变量固化在子进程内。多个终端窗口分别运行不同 provider 互不干扰。

## 工作原理

```
用户输入: ccs @zhipu:glm-4.6 -r abc123
         │
         ▼
  ccs (npm 全局 bin，Bun wrapper)
         │
         ├─ 1. 读取并解析配置文件
         ├─ 2. 从参数中提取 @zhipu:glm-4.6 → provider=zhipu, model=glm-4.6
         ├─ 3. 若无 @provider，取配置文件第一个 provider 作为默认
         ├─ 4. 校验 provider name 合法性（仅允许字母数字下划线连字符）
         ├─ 5. 从配置文件查找 provider，读取 base_url、api_key_env、模型信息
         ├─ 6. 检查 --model 参数冲突（有则输出警告）
         ├─ 7. 检查 API Key 环境变量是否已设置
         ├─ 8. 设置 ANTHROPIC_* 环境变量（同时清除 ANTHROPIC_API_KEY）
         └─ 9. spawn 真正的 claude，传入剩余参数 -r abc123
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
