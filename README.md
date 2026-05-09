# Claude Model Switcher

If this tool helps you, consider giving it a ⭐ on [GitHub](https://github.com/augustVino/claude-model-switcher) — it means a lot!

**[中文文档](README_CN.md)**

A lightweight CLI that lets you switch AI model providers in [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with a simple `@provider` syntax.

**Each terminal session runs independently** — open multiple terminals and use different providers or models simultaneously, with zero conflict.

## Quick Start

```bash
ccs @zhipu              # Use Zhipu GLM
ccs @zhipu:glm-4.6      # Specify model
ccs                      # Default provider
```

## Installation

```bash
npm install -g @vinoorg/claude-model-switcher
```

**Requirements:** [Bun](https://bun.sh/) >= 1.0, [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed

## Configuration

### 1. Create provider config

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

### 2. Set API keys

```bash
# ~/.zshrc or ~/.bashrc
export ZHIPU_API_KEY="your-key-here"
export LP_API_KEY="your-key-here"
```

### 3. Apply changes

```bash
source ~/.zshrc  # or source ~/.bashrc
```

> **Note:** `ccs` transparently passes all arguments to the native `claude` CLI. Your existing Claude Code commands and flags work exactly as before — `ccs` only sets model-related environment variables.

## Usage

```bash
ccs                          # Default provider
ccs @zhipu                   # Specific provider, default model
ccs @zhipu:glm-4.6           # Provider + model
ccs @list                    # List all providers & models
ccs @init                    # Init or validate config
ccs @update                  # Update to latest version
ccs @help                    # Show help

# Works with all native Claude Code flags
ccs @zhipu -r sessionID
ccs @lp -p "Describe this project"
```

## Status Bar Companion

Display the current provider, model, and context usage in your Claude Code status bar with **[ccs-statusline](https://github.com/augustVino/ccs-statusline)**:

```
[v2.1.119]  ➜ my-project (main) @zhipu:glm-4.6  Ctx:45.2k/200k (22.6%)
```

## Config Reference

| Field               | Required | Description                                                                                    |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| name                | Yes      | Provider identifier for `@name`. Only `[a-zA-Z0-9_-]`. Reserved: `list`, `help`, `init`, `update` |
| base_url            | Yes      | Anthropic-compatible API endpoint                                                              |
| api_key_env         | Yes      | Environment variable name holding the API key                                                  |
| default_model       | No       | Model used when not specified                                                                  |
| default_small_model | No       | Lightweight model (falls back to `default_model`)                                              |
| models              | No       | Available model list (`string[]`). Defaults to showing `default_model` + `default_small_model` |

**Rules:**

- Without `@provider`, the first entry is used as default
- If `default_model` is not set, model must be specified explicitly (`ccs @lp:some-model`)
- `default_small_model` only affects `ANTHROPIC_SMALL_FAST_MODEL` and `ANTHROPIC_DEFAULT_HAIKU_MODEL`

**Adding a new provider** — just append to the config array and export the API key:

```json
{
  "name": "kimi",
  "base_url": "https://api.kimi.com/anthropic",
  "api_key_env": "KIMI_API_KEY",
  "default_model": "kimi-latest"
}
```

No code changes needed.

## License

MIT
