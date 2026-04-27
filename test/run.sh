#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER="$SCRIPT_DIR/../bin/claude.sh"
FIXTURES="$SCRIPT_DIR/fixtures"
PASS=0
FAIL=0
CURRENT=""

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }

assert_exit() {
  local expected=$1 actual=$2
  if [[ "$actual" -ne "$expected" ]]; then
    red "  ✗ $CURRENT: expected exit $expected, got $actual"
    FAIL=$((FAIL + 1))
    return
  fi
  PASS=$((PASS + 1))
  green "  ✓ $CURRENT"
}

assert_output() {
  local needle=$1 output=$2
  if echo "$output" | grep -Fq -- "$needle"; then
    PASS=$((PASS + 1))
    green "  ✓ $CURRENT"
  else
    red "  ✗ $CURRENT: expected '$needle' in output"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_output() {
  local needle=$1 output=$2
  if echo "$output" | grep -Fq -- "$needle"; then
    red "  ✗ $CURRENT: did not expect '$needle' in output"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
    green "  ✓ $CURRENT"
  fi
}

setup() {
  unset TEST_KEY LP_KEY MISSING_KEY ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN \
    ANTHROPIC_MODEL ANTHROPIC_SMALL_FAST_MODEL ANTHROPIC_REASONING_MODEL \
    ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL \
    ANTHROPIC_DEFAULT_HAIKU_MODEL ANTHROPIC_API_KEY 2>/dev/null || true
  TEST_DIR=$(mktemp -d)
  export XDG_CONFIG_HOME="$TEST_DIR/config"
  mkdir -p "$XDG_CONFIG_HOME/claude-model-switcher"
}

teardown() {
  unset TEST_KEY LP_KEY MISSING_KEY 2>/dev/null || true
  unset XDG_CONFIG_HOME
  rm -rf "$TEST_DIR"
}

run_wrapper() {
  # 通过 PATH 注入 fake claude，使 wrapper exec 到测试替身而非真正的 claude
  output=$(PATH="$FIXTURES:$PATH" "$WRAPPER" "$@" 2>&1) && rc=0 || rc=$?
}

write_config() {
  cat > "$XDG_CONFIG_HOME/claude-model-switcher/providers.json"
}

# --- Config validation tests ---

test_config_not_found() {
  CURRENT="config_not_found"
  setup
  run_wrapper @zhipu
  assert_exit 1 "$rc"
  assert_output "Config not found" "$output"
  teardown
}

test_config_empty_array() {
  CURRENT="config_empty_array"
  setup
  write_config <<'EOF'
[]
EOF
  run_wrapper
  assert_exit 1 "$rc"
  assert_output "No providers configured" "$output"
  teardown
}

test_config_invalid_json() {
  CURRENT="config_invalid_json"
  setup
  write_config <<'EOF'
not json
EOF
  run_wrapper @zhipu
  assert_exit 1 "$rc"
  assert_not_output "SyntaxError" "$output"
  teardown
}

# --- Argument parsing tests ---

test_parse_at_provider() {
  CURRENT="parse_at_provider"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper @zhipu
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_MODEL=glm-4" "$output"
  assert_output "ANTHROPIC_BASE_URL=https://z.ai/api" "$output"
  unset TEST_KEY
  teardown
}

test_parse_at_provider_model() {
  CURRENT="parse_at_provider_model"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper @zhipu:glm-5x1
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_MODEL=glm-5x1" "$output"
  unset TEST_KEY
  teardown
}

test_default_provider() {
  CURRENT="default_provider"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper -p "hello"
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_MODEL=glm-4" "$output"
  unset TEST_KEY
  teardown
}

test_unknown_provider() {
  CURRENT="unknown_provider"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  run_wrapper @unknown
  assert_exit 1 "$rc"
  assert_output "Unknown provider" "$output"
  teardown
}

test_invalid_provider_name() {
  CURRENT="invalid_provider_name"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  run_wrapper "@zhipu space"
  assert_exit 1 "$rc"
  assert_output "Invalid provider name" "$output"
  teardown
}

test_multiple_at_args_uses_first() {
  CURRENT="multiple_at_args_uses_first"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"},{"name":"lp","base_url":"http://internal/api","api_key_env":"LP_KEY","default_model":"qwen3"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper @zhipu @lp
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_BASE_URL=https://z.ai/api" "$output"
  assert_not_output "http://internal/api" "$output"
  unset TEST_KEY
  teardown
}

test_args_stripping() {
  CURRENT="args_stripping"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper @zhipu -p "hello" -r abc123
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_MODEL=glm-4" "$output"
  unset TEST_KEY
  teardown
}

test_config_not_found
test_config_empty_array
test_config_invalid_json

test_parse_at_provider
test_parse_at_provider_model
test_default_provider
test_unknown_provider
test_invalid_provider_name
test_multiple_at_args_uses_first
test_args_stripping

# --- Error path tests ---

test_no_default_model_error() {
  CURRENT="no_default_model_error"
  setup
  write_config <<'EOF'
[{"name":"lp","base_url":"http://internal/api","api_key_env":"LP_KEY"}]
EOF
  export LP_KEY="some-key"
  run_wrapper @lp
  assert_exit 1 "$rc"
  assert_output "no default model" "$output"
  unset LP_KEY
  teardown
}

test_no_default_model_with_explicit_model_ok() {
  CURRENT="no_default_model_with_explicit_model_ok"
  setup
  write_config <<'EOF'
[{"name":"lp","base_url":"http://internal/api","api_key_env":"LP_KEY"}]
EOF
  export LP_KEY="some-key"
  run_wrapper @lp:qwen3
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_MODEL=qwen3" "$output"
  unset LP_KEY
  teardown
}

test_missing_api_key() {
  CURRENT="missing_api_key"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"MISSING_KEY","default_model":"glm-4"}]
EOF
  run_wrapper @zhipu
  assert_exit 1 "$rc"
  assert_output "API key not set" "$output"
  teardown
}

test_default_small_model_fallback() {
  CURRENT="default_small_model_fallback"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4","default_small_model":"glm-4-air"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper @zhipu
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_SMALL_FAST_MODEL=glm-4-air" "$output"
  assert_output "ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4-air" "$output"
  unset TEST_KEY
  teardown
}

test_no_small_model_uses_default() {
  CURRENT="no_small_model_uses_default"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper @zhipu
  assert_exit 0 "$rc"
  assert_output "ANTHROPIC_SMALL_FAST_MODEL=glm-4" "$output"
  assert_output "ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4" "$output"
  unset TEST_KEY
  teardown
}

test_no_default_model_error
test_no_default_model_with_explicit_model_ok
test_missing_api_key
test_default_small_model_fallback
test_no_small_model_uses_default

# --- @list command tests ---

test_list_providers() {
  CURRENT="list_providers"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"Z_KEY","default_model":"glm-4","default_small_model":"glm-4-air"},{"name":"lp","base_url":"http://internal/api","api_key_env":"L_KEY"}]
EOF
  run_wrapper @list
  assert_exit 0 "$rc"
  assert_output "@zhipu" "$output"
  assert_output "(default: glm-4)" "$output"
  assert_output "@lp" "$output"
  teardown
}

test_list_providers

# --- --model conflict warning tests ---

test_model_flag_warning() {
  CURRENT="model_flag_warning"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  export TEST_KEY="test-api-key"
  run_wrapper @zhipu --model sonnet
  assert_exit 0 "$rc"
  assert_output "--model flag conflicts" "$output"
  unset TEST_KEY
  teardown
}

test_model_flag_warning_missing_key() {
  CURRENT="model_flag_warning_missing_key"
  setup
  write_config <<'EOF'
[{"name":"zhipu","base_url":"https://z.ai/api","api_key_env":"TEST_KEY","default_model":"glm-4"}]
EOF
  run_wrapper @zhipu --model sonnet
  assert_exit 1 "$rc"
  assert_output "--model flag conflicts" "$output"
  teardown
}

test_model_flag_warning
test_model_flag_warning_missing_key

echo ""
echo "Results: $PASS assertions passed, $FAIL failed"
[[ "$FAIL" -gt 0 ]] && exit 1
exit 0
