# dsh-ponytail

[ponytail](https://github.com/DietrichGebert/ponytail)（最懒资深工程师模式）的 DSH 插件：
**宿主半**把三个 ponytail 技能注册进技能注册表，**浏览器半**在对话输入栏放一个
「懒散等级」下拉，选中档位就把 `/ponytail lite|full|ultra` 钉进草稿。

技能与控件在**同一个包**里，一次安装两半都到位 —— 这是它与
`dsh-ponytail-skills`（只带技能）+ `dsh-ponytail-intensity`（只带控件、且不接通）
两个包分开装的关键差别。

## 随包技能

| 技能 | 用途 |
| --- | --- |
| `ponytail` | 核心模式：YAGNI → 复用 → 标准库 → 原生能力 → 一行 → 最小代码。支持 `lite` / `full` / `ultra` 三档 |
| `ponytail-review` | 只针对过度工程的代码评审：一行一条「删什么、用什么替代」，末尾给 `net: -N lines possible.` |
| `ponytail-audit` | 整仓库版过度工程审计，按「能砍最多」排序 |

## 安装

```sh
# GitHub（推荐；<commit> 换成你推上去的提交号可锁版本）
dsh plugin --profile <profile> add github:SHUNJIANBAO/dsh-ponytail

# 本地开发 / 离线
dsh plugin --profile <profile> add /abs/path/to/dsh-ponytail
```

官方桌面客户端也可以：侧栏 **插件 → 添加插件**，粘包名、`github:` 地址或本地绝对路径。
装完需要重启 profile（桌面端重启客户端）才会合成新的 bundle 层。

## 用法

「懒散等级」下拉在输入栏工具行、模型选择器左侧、`追问` 按钮右侧。

| 档位 | 行为 |
| --- | --- |
| 关闭（默认） | 不动草稿，ponytail 不启用 |
| 轻量 / 标准 / 极简 | 把 `/ponytail lite\|full\|ultra` 钉在草稿最前面 |

行为契约（有意如此，不是 bug）：

- **默认关闭**。下拉显示什么，草稿里就真有什么 —— 不会在你没选过的情况下替你打开 ponytail。
- **档位按会话持久**（`localStorage`，键 `dsh-ponytail:<sessionId>`）。
- **发送后自动重钉**：发送会把草稿清空，插件随即把当前档位重新钉回输入框（档位是持久模式）。
  想彻底停用就选「关闭」。
- **手动删掉 token 后，当前这条不再自动补**，等草稿再次被清空才重钉 —— 插件不会在你打字时抢草稿。
- **草稿里的 token 是权威**：你手动把档位词改成 `lite`，下拉会跟着显示「轻量」，
  发送后也按 `lite` 重钉。
- **从不替你发送**。插件只依赖 `slots`，不声明任何 remote 服务。

为什么是「写进草稿」而不是「后台注入」：技能不是命令，`/ponytail` 走不了命令通道；
用户级技能唯一的入口是宿主对「已认领用户消息里空白边界的 `/name` token」的手势扫描。
把 token 放进草稿是唯一不依赖宿主内部 API、换 DSH 版本也不容易坏的做法，
而且你在输入框里看得见、可以改。

## 验收

```sh
node test/offline-regression.mjs   # 49 条断言：草稿 token 全状态机 + 宿主半技能解析
```

装好后在客户端里确认：

1. 新会话里下拉显示「关闭」，输入框是空的。
2. 选「极简」→ 输入框出现 `/ponytail ultra `；随便打一句编码需求并发送 → 模型按 ultra 风格回答。
3. 发送后输入框自动变回 `/ponytail ultra `。
4. 选「关闭」→ token 被摘掉；再发送一次，输入框保持空。
5. 技能目录里能看到 `ponytail` / `ponytail-review` / `ponytail-audit`。

## 回滚

```sh
dsh plugin --profile <profile> remove dsh-ponytail
```

或手工：从 profile 的 `package.json` 里删掉 `dependencies` 与 `dsh.profile.bundles` 两处
的 `dsh-ponytail`，删掉 `node_modules/dsh-ponytail`，重启。

## 结构

```
dsh-ponytail/
├── package.json          # dsh.bundle.patch + dsh.client + exports["./client"]
├── cordis.patch.yml      # bundle patch：插入一行，同时挂载宿主半与浏览器半
├── lib/
│   ├── index.js          # 宿主半：注册技能提供方 dsh-ponytail-mode（rank 550）
│   ├── client.js         # 浏览器半：懒散等级下拉 → 草稿 token
│   ├── frontmatter.js    # 零依赖 SKILL.md frontmatter 解析器
│   └── provider.js       # 技能提供方工厂
├── skills/               # 三个技能正文（逐字照搬上游）
└── test/                 # 离线回归
```

零 npm 运行时依赖，不声明 `@deepseek-ai/*` peerDependencies —— 换机器、离线、镜像没同步
都不会卡在装依赖这一步。

## 许可

MIT。技能正文版权归上游：© DietrichGebert
（[ponytail](https://github.com/DietrichGebert/ponytail)）、© gongyijie85
（[DSH 移植](https://github.com/gongyijie85/dsh-ponytail)）。宿主半、浏览器半与打包 © SHUNJIANBAO。
完整声明见 [LICENSE](LICENSE)。
