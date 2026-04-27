#!/usr/bin/env bash
set -euo pipefail

# 配置文件路径（遵循 XDG 规范）
CONF="${XDG_CONFIG_HOME:-$HOME/.config}/claude-model-switcher/providers.json"

# 检查配置文件是否存在
if [[ ! -f "$CONF" ]]; then
  echo "Error: Config not found: $CONF"
  echo "Create a JSON array with provider objects. See README for format."
  exit 1
fi

# 从命令行参数中提取 @provider[:model]，剩余参数原样保留
provider=""
model=""
args=()

for arg in "$@"; do
  if [[ "$arg" == @* && -z "$provider" ]]; then
    raw="${arg#@}"
    # @list 特殊命令：列出所有已配置的 provider
    if [[ "$raw" == "list" ]]; then
      echo "Available providers:"
      CONF="$CONF" node -e '
        const ps = JSON.parse(require("fs").readFileSync(process.env.CONF,"utf8"));
        ps.forEach(p => {
          let line = "  @" + p.name;
          if (p.default_model) line += " (default: " + p.default_model + ")";
          console.log(line);
        });
      ' 2>/dev/null || true
      exit 0
    fi
    # 按 : 分割 provider 和 model（: 不与模型名中的 - 冲突）
    provider="${raw%%:*}"
    model="${raw#*:}"
    [[ "$model" == "$raw" ]] && model=""
  else
    args+=("$arg")
  fi
done

# 无 @provider 时，使用配置文件中第一个 provider 作为默认
if [[ -z "$provider" ]]; then
  provider=$(CONF="$CONF" node -e '
    const ps = JSON.parse(require("fs").readFileSync(process.env.CONF,"utf8"));
    if (ps.length === 0) process.exit(1);
    process.stdout.write(ps[0].name);
  ' 2>/dev/null || true)
  if [[ -z "$provider" ]]; then
    echo "Error: No providers configured in $CONF"
    exit 1
  fi
fi

# 校验 provider name 仅允许字母、数字、下划线、连字符
if [[ ! "$provider" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "Error: Invalid provider name '$provider'. Only [a-zA-Z0-9_-] allowed."
  exit 1
fi

# 通过 process.env 传参给 node 避免命令注入
read -r base_url key_env default_model default_small < <(
  CONF="$CONF" PROVIDER="$provider" node -e '
    const ps = JSON.parse(require("fs").readFileSync(process.env.CONF,"utf8"));
    const p = ps.find(x => x.name === process.env.PROVIDER);
    if (!p) process.exit(1);
    process.stdout.write(
      (p.base_url || "") + "\t" +
      (p.api_key_env || "") + "\t" +
      (p.default_model || "") + "\t" +
      (p.default_small_model || "")
    );
  ' 2>/dev/null || true
) || true

if [[ -z "$base_url" ]]; then
  echo "Error: Unknown provider '@$provider'"
  echo "Available:"
  CONF="$CONF" node -e '
    const ps = JSON.parse(require("fs").readFileSync(process.env.CONF,"utf8"));
    ps.forEach(p => console.log("  @" + p.name));
  ' 2>/dev/null || true
  exit 1
fi

# 在 API key 校验之前检查 --model 冲突（确保警告总能输出）
for a in "${args[@]+"${args[@]}"}"; do
  if [[ "$a" == "--model" || "$a" == "--model="* ]]; then
    echo "Warning: --model flag conflicts with @$provider. The --model value will override the provider setting." >&2
    break
  fi
done

# 检查 API Key 是否已设置
api_key="${!key_env:-}"
if [[ -z "$api_key" ]]; then
  echo "Error: API key not set. Export $key_env in your shell config."
  exit 1
fi

# 设置 Anthropic 兼容环境变量，清除原始 API Key 避免冲突
unset ANTHROPIC_API_KEY
export ANTHROPIC_BASE_URL="$base_url"
export ANTHROPIC_AUTH_TOKEN="$api_key"

# 解析模型：显式指定 > default_model > default_small_model 回退
if [[ -n "$model" ]]; then
  resolved_model="$model"
  resolved_small="$model"
elif [[ -n "$default_model" ]]; then
  resolved_model="$default_model"
  resolved_small="${default_small:-$default_model}"
else
  echo "Error: Provider '@$provider' has no default model. Specify one: claude @$provider:<model>"
  exit 1
fi

export ANTHROPIC_MODEL="$resolved_model"
export ANTHROPIC_SMALL_FAST_MODEL="$resolved_small"
export ANTHROPIC_REASONING_MODEL="$resolved_model"
export ANTHROPIC_DEFAULT_OPUS_MODEL="$resolved_model"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$resolved_model"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$resolved_small"

# 查找真正的 claude 二进制（跳过自身，避免循环调用）
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
SELF_SCRIPT="$(basename "$0")"
REAL_CLAUDE=""

while IFS= read -r p; do
  [[ "$p" == "$SELF_DIR/$SELF_SCRIPT" ]] && continue
  [[ -x "$p" ]] && REAL_CLAUDE="$p" && break
done < <(type -aP claude 2>/dev/null || true)

if [[ -z "$REAL_CLAUDE" ]]; then
  echo "Error: claude binary not found in PATH (excluding this wrapper)"
  exit 1
fi

# exec 替换当前进程，环境变量固化在子进程中
exec "$REAL_CLAUDE" "${args[@]+"${args[@]}"}"
