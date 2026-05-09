# Claude Model Switcher

如果这个工具对你有帮助，欢迎到 [GitHub](https://github.com/augustVino/claude-model-switcher) 给个 ⭐，这对开发者很重要！

**[English](README.md)**

一个轻量级 CLI 工具，让你在 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 中通过 `@<provider>` 语法快速切换不同 AI 模型服务商。

**每个终端会话独立运行**——同时打开多个终端窗口，使用不同的 provider 或模型，互不干扰。

## 快速上手

```bash
ccs @zhipu              # 使用智谱 GLM
ccs @zhipu:glm-4.6      # 指定模型
ccs                      # 使用默认 provider
```

## 安装

```bash
npm install -g @vinoorg/claude-model-switcher
```

**前提条件：** [Bun](https://bun.sh/) >= 1.0、[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安装

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
    "base_url": "http://your-company.com/api/anthropic",
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

> **说明：** `ccs` 透明传递所有参数给原生 `claude` CLI，不会对 Claude Code 原生的命令参数产生任何影响——`ccs` 仅设置模型相关的环境变量。

## 用法

```bash
ccs                          # 使用默认 provider
ccs @zhipu                   # 指定 provider，使用默认模型
ccs @zhipu:glm-4.6           # 指定 provider + 模型
ccs @list                    # 列出所有 provider 及模型
ccs @init                    # 初始化或校验配置
ccs @update                  # 更新到最新版本
ccs @help                    # 显示帮助信息

# 配合 Claude Code 官方参数使用
ccs @zhipu -r sessionID
ccs @lp -p "介绍一下这个项目"
```

## 配套状态栏

搭配 **[ccs-statusline](https://github.com/augustVino/ccs-statusline)** 可以在 Claude Code 状态栏中实时显示当前 Provider、模型及上下文用量：

```
[v2.1.119]  ➜ my-project (main) @zhipu:glm-4.6  Ctx:45.2k/200k (22.6%)
```

## 配置参考

| 字段                | 必填 | 说明                                                                                         |
| ------------------- | ---- | -------------------------------------------------------------------------------------------- |
| name                | 是   | provider 标识，用于 `@name`，仅允许 `[a-zA-Z0-9_-]`，不可为 `list`、`help`、`init`、`update`（保留字） |
| base_url            | 是   | Anthropic 兼容 API 端点                                                                      |
| api_key_env         | 是   | 存放 API Key 的环境变量名                                                                    |
| default_model       | 否   | 不指定模型时的默认模型                                                                       |
| default_small_model | 否   | 轻量模型（留空则同 default_model）                                                           |
| models              | 否   | 可用模型列表（`string[]`）。不配置时回退显示 default_model + default_small_model             |

**规则：**

- 无 `@` 参数时，使用数组中第一个 provider 作为默认
- 若 provider 未配置 `default_model`，则调用时必须指定模型（`ccs @lp:some-model`）
- `default_small_model` 仅影响 `ANTHROPIC_SMALL_FAST_MODEL` 和 `ANTHROPIC_DEFAULT_HAIKU_MODEL`

**新增 Provider** — 只需在配置文件数组中追加一个对象，并 export 对应的 API Key：

```json
{
  "name": "kimi",
  "base_url": "https://api.kimi.com/anthropic",
  "api_key_env": "KIMI_API_KEY",
  "default_model": "kimi-latest"
}
```

无需修改任何代码。

## 许可证

MIT
