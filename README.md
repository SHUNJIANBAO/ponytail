# ponytail

[ponytail](https://github.com/DietrichGebert/ponytail)（最懒资深工程师模式）的 DSH 技能包：

**纯技能包**：直接包含 ponytail / ponytail-review / ponytail-audit 三个技能，无宿主半。

## 随包技能

| 技能 | 用途 | 对模型开放 |
| --- | --- | --- |
| `ponytail` | 核心模式：YAGNI → 复用 → 标准库 → 原生能力 → 一行 → 最小代码。强度固定 full | ✅ |
| `ponytail-review` | 只针对过度工程的代码评审：一行一条「删什么、用什么替代」，末尾给 `net: -N lines possible.` | ✅ |
| `ponytail-audit` | 整仓库版过度工程审计，按「能砍最多」排序 | ✅ |

## 自动触发机制

不是 hook，是**提示词层面的软触发**——和 `dsh-unity-csharp-habits` 完全同一套机制：

1. DSH 会话开始时读取每个技能的 `name` + `description`；  
2. `dsh-tool-skill` 对每条 description **硬截 500 字符**；  
3. **改长 = 静默失效**：description 超过 500 字符将被截断，截断后的尾巴里会包含「非编码任务不要用」这类排除条件，但不会报错。  

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

dsh plugin --profile <profile> add github:SHUNJIANBAO/ponytail

# 本地开发 / 离线
dsh plugin --profile <profile> add /abs/path/to/ponytail
```

官方桌面客户端也可以：侧栏 **插件 → 添加插件**，粘包名、`github:` 地址或本地绝对路径。  
装完需要重启 profile（桌面端重启客户端）才会合成新的 bundle 层 —— 技能目录是**会话开始时**  
注入的，所以还必须在重启后**开一个新会话**才看得到新描述。

## 验收

```sh
# description 必须 ≤500 字符（技能目录的硬上限），退出码 1 = 超了
node -e 'const fs=require("fs");const t=fs.readFileSync("skills/ponytail/SKILL.md","utf8");const m=t.match(/---\r?\n([\s\S]*?)\r?\n---/);const d=m[1].match(/description:([\s\S]*?)(?:\r?\n[a-zA-Z-]+:|$)/)[1].replace(/^\s*[>|][-+]?\s*/,"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join(" ").replace(/\s+/g," ").trim();console.log("normalized length =",d.length);process.exit(d.length>500?1:0)'
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