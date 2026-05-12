# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.1.0 (2026-05-12)


### Features

* add [@config](https://github.com/config) to open config file. ([bf2b33b](https://github.com/augustVino/claude-model-switcher/commit/bf2b33b2aadc51401203df70552576cb57035248))
* add [@help](https://github.com/help) command recognition to argument parser ([d19d3db](https://github.com/augustVino/claude-model-switcher/commit/d19d3db4f5ee7dcb7cd2ca09a43b66becd69e800))
* add [@help](https://github.com/help) command with colored help output ([07fb9f7](https://github.com/augustVino/claude-model-switcher/commit/07fb9f7db25aa172683d4a2aa760672fc676be99))
* add [@update](https://github.com/update) command parsing ([a02d394](https://github.com/augustVino/claude-model-switcher/commit/a02d3948b025d4d870e6ded70f99445791a222be))
* add isInitCommand field to ParsedArgs type ([67ad56a](https://github.com/augustVino/claude-model-switcher/commit/67ad56a533b9a16487395d91ab92bb453aaa72ea))
* add update-checker with cache and background check ([b80ce8c](https://github.com/augustVino/claude-model-switcher/commit/b80ce8ca87380508290b47663f7e7ad0e97d03cf))
* **args:** parse [@init](https://github.com/init) command flag ([267ab69](https://github.com/augustVino/claude-model-switcher/commit/267ab69f77dc415c3bf7135327479f2f2de3d9d0))
* **config:** reserve 'init' as provider name for [@init](https://github.com/init) command ([557f547](https://github.com/augustVino/claude-model-switcher/commit/557f54731ae4c447a94e87d251791b9f2f632edd))
* **docs:** add CLAUDE.md for project guidance and update version to 1.0.3 ([17e376e](https://github.com/augustVino/claude-model-switcher/commit/17e376e1fa1bcc8cb1d92ace2e2d3f04588212a6))
* enhance [@list](https://github.com/list) to display provider model tree ([0aece0b](https://github.com/augustVino/claude-model-switcher/commit/0aece0bd73f27b11920cc054a44fe57c689d300f))
* implement TypeScript support and enhance CLI functionality ([6ec3a2c](https://github.com/augustVino/claude-model-switcher/commit/6ec3a2cc0eec72358071aad30d497d24c3a53fb2))
* **init:** create initConfig with template write on missing config ([97efb5f](https://github.com/augustVino/claude-model-switcher/commit/97efb5f672a77aedf3033e9e31bb50eebebaa47e))
* integrate update notification and [@update](https://github.com/update) command into main ([282de22](https://github.com/augustVino/claude-model-switcher/commit/282de2222c52d1a87a0c4886aa52ff1456b2a833))
* **main:** handle [@init](https://github.com/init) command with initConfig call ([2ebf9aa](https://github.com/augustVino/claude-model-switcher/commit/2ebf9aa8f6ca1e8a36afd9e4973bfb3f26766300))
* rename CLI command from 'claude' to 'cc' ([bf46ce2](https://github.com/augustVino/claude-model-switcher/commit/bf46ce235fe1d01d5b3f1f9f17ad7a73ae954441))
* rewrite bash wrapper to Node.js for cross-platform support ([9fa6aed](https://github.com/augustVino/claude-model-switcher/commit/9fa6aed54cfbfb49997bae0d954adcb053681545))
* 优化输出展示 ([4348475](https://github.com/augustVino/claude-model-switcher/commit/434847519c8f3339a359504b5f29c55268f4384c))


### Bug Fixes

* harden update-checker security, add version pre-check, improve test assertions ([41d283e](https://github.com/augustVino/claude-model-switcher/commit/41d283e09c048ccf52d6eaed4427cbae2fd11738))
* rename command from 'cc' to 'ccs' to avoid conflict with system C compiler ([131cd05](https://github.com/augustVino/claude-model-switcher/commit/131cd05a930571194dbd7328e892ada8b92f583e))
* 撤销修改，升级版本 ([cf571b7](https://github.com/augustVino/claude-model-switcher/commit/cf571b74ac93cfdaede7b74f5bf968617b4d5af5))

### 1.0.6 (2026-05-08)


### Features

* add [@help](https://github.com/help) command recognition to argument parser ([d19d3db](https://github.com/augustVino/claude-model-switcher/commit/d19d3db4f5ee7dcb7cd2ca09a43b66becd69e800))
* add [@help](https://github.com/help) command with colored help output ([07fb9f7](https://github.com/augustVino/claude-model-switcher/commit/07fb9f7db25aa172683d4a2aa760672fc676be99))
* add isInitCommand field to ParsedArgs type ([67ad56a](https://github.com/augustVino/claude-model-switcher/commit/67ad56a533b9a16487395d91ab92bb453aaa72ea))
* **args:** parse [@init](https://github.com/init) command flag ([267ab69](https://github.com/augustVino/claude-model-switcher/commit/267ab69f77dc415c3bf7135327479f2f2de3d9d0))
* **config:** reserve 'init' as provider name for [@init](https://github.com/init) command ([557f547](https://github.com/augustVino/claude-model-switcher/commit/557f54731ae4c447a94e87d251791b9f2f632edd))
* **docs:** add CLAUDE.md for project guidance and update version to 1.0.3 ([17e376e](https://github.com/augustVino/claude-model-switcher/commit/17e376e1fa1bcc8cb1d92ace2e2d3f04588212a6))
* enhance [@list](https://github.com/list) to display provider model tree ([0aece0b](https://github.com/augustVino/claude-model-switcher/commit/0aece0bd73f27b11920cc054a44fe57c689d300f))
* implement TypeScript support and enhance CLI functionality ([6ec3a2c](https://github.com/augustVino/claude-model-switcher/commit/6ec3a2cc0eec72358071aad30d497d24c3a53fb2))
* **init:** create initConfig with template write on missing config ([97efb5f](https://github.com/augustVino/claude-model-switcher/commit/97efb5f672a77aedf3033e9e31bb50eebebaa47e))
* **main:** handle [@init](https://github.com/init) command with initConfig call ([2ebf9aa](https://github.com/augustVino/claude-model-switcher/commit/2ebf9aa8f6ca1e8a36afd9e4973bfb3f26766300))
* rename CLI command from 'claude' to 'cc' ([bf46ce2](https://github.com/augustVino/claude-model-switcher/commit/bf46ce235fe1d01d5b3f1f9f17ad7a73ae954441))
* rewrite bash wrapper to Node.js for cross-platform support ([9fa6aed](https://github.com/augustVino/claude-model-switcher/commit/9fa6aed54cfbfb49997bae0d954adcb053681545))
* 优化输出展示 ([4348475](https://github.com/augustVino/claude-model-switcher/commit/434847519c8f3339a359504b5f29c55268f4384c))


### Bug Fixes

* rename command from 'cc' to 'ccs' to avoid conflict with system C compiler ([131cd05](https://github.com/augustVino/claude-model-switcher/commit/131cd05a930571194dbd7328e892ada8b92f583e))
* 撤销修改，升级版本 ([cf571b7](https://github.com/augustVino/claude-model-switcher/commit/cf571b74ac93cfdaede7b74f5bf968617b4d5af5))
