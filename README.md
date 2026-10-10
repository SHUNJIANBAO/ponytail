# dsh-ponytail

[ponytail](https://github.com/DietrichGebert/ponytail)（最懒资深工程师模式）的 DSH 插件：
**宿主半**把三个 ponytail 技能注册进技能注册表，**浏览器半**在对话输入栏放一个
「懒散等级」下拉，选中档位就把 `/ponytail lite|full|ultra` 钉进草稿。

技能与控件在**同一个包**里，一次安装两半都到位 —— 这是它与
`dsh-ponytail-skills`（只带技能）+ `dsh-ponytail-intensity`（只带控件、且不接通）
两个包分开装的关键差别。

## 随包技能

| 技能 | 用途 | 对模型开放 |
| --- | --- | --- |
| `ponytail` | 核心模式：YAGNI → 复用 → 标准库 → 原生能力 → 一行 → 最小代码。支持 `lite` / `full` / `ultra` 三档 | ✅ |
| `ponytail-review` | 只针对过度工程的代码评审：一行一条「删什么、用什么替代」，末尾给 `net: -N lines possible.` | ✅ |
| `ponytail-audit` | 整仓库版过度工程审计，按「能砍最多」排序 | ✅ |
| `ponytail-lite` / `ponytail-full` / `ponytail-ultra` | 三个档位入口，正文 = `ponytail` 的完整规则 + 一行档位声明 | ❌ `disable-model-invocation` |

后三个是**下拉框真正钉的那个 token**，见下节。

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

| 档位 | 钉进草稿的 token |
| --- | --- |
| 关闭（默认） | 不动草稿，ponytail 不启用 |
| 轻量 | `/ponytail-lite` |
| 标准 | `/ponytail-full` |
| 极简 | `/ponytail-ultra` |

### 为什么是 `/ponytail-lite` 而不是 `/ponytail lite`

输入框的 `/` 高亮（lexicon）**只认「`/` + 已注册技能名」**，而 DSH 没有任何
「技能参数」概念 —— 上游 ponytail 写的 `argument-hint: "[lite|full|ultra]"` 在整个
app.asar 里**零命中**，DSH 从不解析它。所以 `/ponytail lite` 只会把 `/ponytail`
染蓝，` lite` 永远是普通文字。

要整串被识别，整串就必须是一个技能名 → 于是注册了三个档位技能，
下拉框钉 `/ponytail-lite`：**整串变蓝、整串被注入**，档位由技能正文开头的
「本次强度」声明写明，不再依赖模型去解读一个残留的词。

三个档位技能标了 `disable-model-invocation: true`：**不进模型技能目录**（零目录
token 开销），只出现在 `/` 菜单和手势扫描里 —— 这正是这类技能唯一的入口。
它们的正文不在仓库里复制三份：宿主半用一层装饰器把 `ponytail` 的正文读出来拼上
档位前导，**正文单一来源**，改 `skills/ponytail/SKILL.md` 三档一起变。

上游写法 `/ponytail lite`（以及裸 `/ponytail`，视为 `full`）**仍然识别**，
只是下拉框不再写它 —— 旧草稿不会"显示关闭但实际开着"。

行为契约（有意如此，不是 bug）：

- **默认关闭**。下拉显示什么，草稿里就真有什么 —— 不会在你没选过的情况下替你打开 ponytail。
- **档位按会话持久**（`localStorage`，键 `dsh-ponytail:<sessionId>`）。
- **发送后自动重钉**：发送会把草稿清空，插件随即把当前档位重新钉回输入框（档位是持久模式）。
- **两种方式都能关掉**：
  - 下拉里选「关闭」→ 摘掉 token，且**不会被重钉逻辑写回来**；
  - 把只有 token 的草稿删光 → 同样视为关闭（下拉会跟着变「关闭」）。
- **手动删掉 token 但正文还在**时，当前这条不再自动补；发送后按记忆的档位重钉 ——
  插件不会在你打字时抢草稿。
- **草稿里的 token 是权威**：你手动把 token 改成 `/ponytail-lite`，下拉会跟着显示「轻量」，
  发送后也按 `lite` 重钉。
- **从不替你发送**。插件只依赖 `slots`，不声明任何 remote 服务。

为什么是「写进草稿」而不是「后台注入」：技能不是命令，`/ponytail` 走不了命令通道；
用户级技能唯一的入口是宿主对「已认领用户消息里空白边界的 `/name` token」的手势扫描。
把 token 放进草稿是唯一不依赖宿主内部 API、换 DSH 版本也不容易坏的做法，
而且你在输入框里看得见、可以改。

## 验收

```sh
node test/offline-regression.mjs   # 95 条断言：草稿 token 全状态机 + 档位技能 + 宿主半技能解析
```

装好后在客户端里确认：

1. 新会话里下拉显示「关闭」，输入框是空的。
2. 选「极简」→ 输入框出现 `/ponytail-ultra `，**整串都是蓝色**（不是只有 `/ponytail` 蓝）；
   随便打一句编码需求并发送 → 模型按 ultra 风格回答。
3. 发送后输入框自动变回 `/ponytail-ultra `。
4. 选「关闭」→ token 被摘掉，**且不会再自己回来**；再发送一次，输入框保持空。
5. 技能目录里能看到 `ponytail` / `ponytail-review` / `ponytail-audit`
   （三个档位技能**不该**出现在模型技能目录里 —— 它们是 `disable-model-invocation`，
   只在 `/` 菜单里可见）；`/ponytail-ultra` 真的让模型进入了对应档位
   （不是只有文字在草稿里）。
6. 展开的下拉窗口是**不透明**的 —— Windows 主题给 `--dsw-specific-menu` 的值是
   45% 半透明（`#43454a73`，macOS 才被覆写成 94%），本插件用「实色底 +
   半透明层渐变叠加」合成成完全不透明。

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
│   │                     #   并把三个档位技能的正文拼上档位前导（正文单一来源）
│   ├── client.js         # 浏览器半：懒散等级下拉 → 草稿 token
│   ├── frontmatter.js    # 零依赖 SKILL.md frontmatter 解析器
│   └── provider.js       # 技能提供方工厂
├── skills/
│   ├── ponytail/         # 核心规则正文（逐字照搬上游）
│   ├── ponytail-review/  # ┐
│   ├── ponytail-audit/   # ┘ 逐字照搬上游
│   ├── ponytail-lite/    # ┐
│   ├── ponytail-full/    # │ 档位入口：只有 frontmatter 有意义，
│   └── ponytail-ultra/   # ┘ 正文由 lib/index.js 从 ponytail/ 拼接
└── test/                 # 离线回归（95 条断言）
```

零 npm 运行时依赖，不声明 `@deepseek-ai/*` peerDependencies —— 换机器、离线、镜像没同步
都不会卡在装依赖这一步。

## 许可

MIT。技能正文版权归上游：© DietrichGebert
（[ponytail](https://github.com/DietrichGebert/ponytail)）、© gongyijie85
（[DSH 移植](https://github.com/gongyijie85/dsh-ponytail)）。宿主半、浏览器半与打包 © SHUNJIANBAO。
完整声明见 [LICENSE](LICENSE)。
