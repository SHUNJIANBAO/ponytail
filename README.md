# dsh-ponytail

[ponytail](https://github.com/DietrichGebert/ponytail)（最懒资深工程师模式）的 DSH 技能包：
**宿主半**把三个 ponytail 技能注册进技能注册表，模型在**任何编码任务**动手前自动加载
`ponytail`，默认 full 档。没有浏览器半，输入栏里不需要任何控件。

## 随包技能

| 技能 | 用途 | 对模型开放 |
| --- | --- | --- |
| `ponytail` | 核心模式：YAGNI → 复用 → 标准库 → 原生能力 → 一行 → 最小代码。强度固定 full | ✅ |
| `ponytail-review` | 只针对过度工程的代码评审：一行一条「删什么、用什么替代」，末尾给 `net: -N lines possible.` | ✅ |
| `ponytail-audit` | 整仓库版过度工程审计，按「能砍最多」排序 | ✅ |

## 「自动调用」是怎么实现的

不是 hook，是**提示词层面的软触发**——和 `dsh-unity-csharp-habits` 完全同一套机制：

1. 会话开始时，宿主把技能目录（每个技能只渲染 `name` + `description`）注入上下文；
   模型据此决定要不要调 `skill` 工具。所以**技能能不能被自动调用，全看 description**。
2. `dsh-tool-skill` 对每条 description **硬截 500 字符**
   （`catalogDescriptionMaxLength` 默认 500，超出部分截成 `...`）。
   因此 `skills/ponytail/SKILL.md` 的 description 必须短，且把
   「任何编码任务必须先调用本 skill」放在**第一句**。
3. **改长 = 静默失效**：description 一旦超过 500 字符，被切掉的尾巴里会包含
   「非编码任务不要用」这类排除条件，而截断本身没有任何报错。改完跑一次下面那条自检。

行为契约（有意如此，不是 bug）：

- **默认生效**：任何编码任务（写、改、重构、修 bug、评审、设计、选依赖）动手前都应加载。
- **强度固定 full**：没有档位了。要更轻/更狠，直接在需求里说。
- **退出**：正文支持 `stop ponytail` / `normal mode`。
- **软触发会漏**：模型偶尔会跳过加载（与 `dsh-unity-csharp-habits` 同级）。
  要更硬的保证，得写进 `~/.dsh/AGENTS.md` 或做原生 hook —— 本包不做。
- **非编码任务不触发**：闲聊、翻译、写文案、总结不在范围内。

## 安装

```sh
# GitHub（推荐；<commit> 换成你推上去的提交号可锁版本）
dsh plugin --profile <profile> add github:SHUNJIANBAO/dsh-ponytail

# 本地开发 / 离线
dsh plugin --profile <profile> add /abs/path/to/dsh-ponytail
```

官方桌面客户端也可以：侧栏 **插件 → 添加插件**，粘包名、`github:` 地址或本地绝对路径。
装完需要重启 profile（桌面端重启客户端）才会合成新的 bundle 层 —— 技能目录是**会话开始时**
注入的，所以还必须在重启后**开一个新会话**才看得到新描述。

## 验收

```sh
# description 必须 ≤500 字符（技能目录的硬上限），退出码 1 = 超了
node -e 'const fs=require("fs");const t=fs.readFileSync("skills/ponytail/SKILL.md","utf8");const m=t.match(/^---\r?\n([\s\S]*?)\r?\n---/);const d=m[1].match(/description:([\s\S]*?)(?:\r?\n[a-zA-Z-]+:|$)/)[1].replace(/^\s*[>|][-+]?\s*/,"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join(" ").replace(/\s+/g," ").trim();console.log("normalized length =",d.length);process.exit(d.length>500?1:0)'
```

重启客户端、开新会话后确认：

1. 技能目录里 `ponytail` 的描述是**新文案且结尾不是 `...`**（没被截断），
   第一句就是「REQUIRED for any coding task」。
2. `/` 菜单里**没有** `ponytail-lite` / `ponytail-full` / `ponytail-ultra`。
3. 输入栏里**没有**「懒散等级」下拉。
4. 随便给一个真实编码需求：模型在动手前自动调用 `skill ponytail`，并按 full 执行
   （不是只有描述出现在目录里）。

## 回滚

```sh
dsh plugin --profile <profile> remove dsh-ponytail
```

或手工：从 profile 的 `package.json` 里删掉 `dependencies` 与 `dsh.profile.bundles` 两处
的 `dsh-ponytail`，删掉 `node_modules/dsh-ponytail`，重启。

## 与 1.x 的差别

1.x 带一个浏览器半（输入栏「懒散等级」下拉）和三个档位技能
`ponytail-lite` / `ponytail-full` / `ponytail-ultra`（下拉钉 `/ponytail-<档位>` token，
由宿主的手势扫描注入）。现在这些全部删除：

- 等级 UI 不再需要 —— 技能改成默认自动加载，默认就是 full；
- 档位技能存在的唯一理由是给下拉当 token 目标，UI 删了它们就没有入口；
- 强度要变，直接说；要停，说 `normal mode`。

`argument-hint` 也一并删了：DSH 从不解析它（上游写的 `[lite|full|ultra]` 在整个
app.asar 里零命中）。

## 结构

```
dsh-ponytail/
├── package.json          # dsh.bundle.patch + exports
├── cordis.patch.yml      # bundle patch：插入一行，挂载宿主半
├── lib/
│   ├── index.js          # 宿主半：注册技能提供方 dsh-ponytail-mode（rank 550）
│   ├── frontmatter.js    # 零依赖 SKILL.md frontmatter 解析器
│   └── provider.js       # 技能提供方工厂
└── skills/
    ├── ponytail/         # 核心规则正文（逐字照搬上游；仅 description 与档位段有改动）
    ├── ponytail-review/  # ┐
    └── ponytail-audit/   # ┘ 逐字照搬上游
```

零 npm 运行时依赖，不声明 `@deepseek-ai/*` peerDependencies —— 换机器、离线、镜像没同步
都不会卡在装依赖这一步。

## 许可

MIT。技能正文版权归上游：© DietrichGebert
（[ponytail](https://github.com/DietrichGebert/ponytail)）、© gongyijie85
（[DSH 移植](https://github.com/gongyijie85/dsh-ponytail)）。宿主半与打包 © SHUNJIANBAO。
完整声明见 [LICENSE](LICENSE)。
