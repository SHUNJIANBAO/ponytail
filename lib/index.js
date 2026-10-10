/**
 * dsh-ponytail 宿主半：把包内 `skills/` 下的 ponytail 技能注册到 `ctx.skills`。
 *
 * 浏览器半（输入栏「懒散等级」下拉）在 `lib/client.js`，由 dsh-client-modules
 * 按包名挂到同一行 Loader 行上，两半共享一个 bundle patch 行。
 *
 * 提供方名刻意不叫 `dsh-ponytail`：npm 上的 `dsh-ponytail-skills` 用的正是那个
 * 名字，同名会在同一层里撞车（"a skill provider named X is already registered"）。
 *
 * ## 为什么有「档位技能」
 *
 * 输入框的 `/` 高亮只认「`/` + 已注册技能名」——lexicon 就是 `skill.name` 列表，
 * 而 DSH 没有任何「技能参数」概念（上游 ponytail 的 `argument-hint` 在整个
 * app.asar 里零命中）。所以 `/ponytail lite` 只会把 `/ponytail` 染蓝，` lite`
 * 永远是普通文字。要整串被识别，整串就必须是一个技能名 → `ponytail-lite`。
 *
 * 三个档位技能都标了 `disable-model-invocation: true`，因此**不进模型技能目录**
 * （零目录 token 开销），只出现在 `/` 菜单里和手势扫描里 —— 这正是
 * disable-model-invocation 技能唯一的入口。
 *
 * 它们的正文不在仓库里复制三份：下面用一层装饰器把 `ponytail` 技能的正文读出来，
 * 前面拼一行档位声明。**正文单一来源**，改 ponytail 的 SKILL.md 三档一起变。
 *
 * @module dsh-ponytail
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSkillProvider } from './provider.js'

/** 插件名 = 包名，与 bundle patch 里的行名一致。 */
export const name = 'dsh-ponytail'

/** 本插件需要技能注册表。 */
export const inject = ['skills']

/** 技能注册表里的提供方名，必须与本层其它提供方不同。 */
const PROVIDER_NAME = 'dsh-ponytail-mode'

/**
 * 技能优先级，数值越小越优先。
 * 550 高于随包 bundled 根（600），低于用户本地 `~/.dsh/skills`（400）——
 * 用户自己放的技能应当能盖住插件自带的同名技能。
 */
const RANK = 550

/** 档位技能名 → 强度。浏览器半的 `tokenFor()` 钉的就是这些名字。 */
const LEVEL_SKILLS = new Map([
  ['ponytail-lite', 'lite'],
  ['ponytail-full', 'full'],
  ['ponytail-ultra', 'ultra'],
])

/** 三个档位技能共用的正文来源。 */
const BASE_SKILL = 'ponytail'

/**
 * 注册技能提供方。
 *
 * @param ctx - Cordis 插件上下文（已注入 `skills`）。
 */
export function apply(ctx) {
  try {
    const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url))
    const base = createSkillProvider({ name: PROVIDER_NAME, rank: RANK, source: 'custom', skillsRoot })
    // registerProvider 收的是工厂函数（(control) => SkillProvider），不是 provider 对象。
    ctx.skills.registerProvider((control) => {
      const provider = base(control)
      return {
        name: provider.name,
        list: (options) => provider.list(options),
        get: (candidate, options) => loadDefinition(provider, skillsRoot, candidate, options),
      }
    })
  } catch (error) {
    // apply 抛错会把这一行变成 failed。技能装不上可以接受，宿主起不来不行。
    console.warn('[dsh-ponytail] 技能提供方注册失败：', error)
  }
}

/**
 * 加载一个技能的完整定义；档位技能复用 `ponytail` 的正文并拼上档位前导。
 *
 * @param provider - 基础提供方（读 skills/ 目录）。
 * @param skillsRoot - 技能根目录的绝对路径。
 * @param candidate - `list()` 返回的候选项。
 * @param options - 注册表传入的查询选项。
 * @returns 技能定义；正文读不到时返回 undefined。
 */
async function loadDefinition(provider, skillsRoot, candidate, options) {
  const level = LEVEL_SKILLS.get(candidate?.name)
  if (level === undefined) return provider.get(candidate, options)

  const baseDirectory = join(skillsRoot, BASE_SKILL)
  const baseDefinition = await provider.get(
    { name: BASE_SKILL, path: join(baseDirectory, 'SKILL.md'), locator: baseDirectory },
    options,
  )
  if (baseDefinition === undefined) return undefined

  return {
    ...baseDefinition,
    // 注册表要求返回的定义与候选项同名。
    name: candidate.name,
    description: candidate.description ?? baseDefinition.description,
    invocation: candidate.invocation ?? baseDefinition.invocation,
    // 预览打开的是这个档位技能自己的入口文件（里面指向真正的规则正文）。
    path: candidate.path ?? baseDefinition.path,
    resourceBase: { kind: 'directory', path: candidate.locator ?? baseDirectory },
    content: levelPreamble(level) + baseDefinition.content,
  }
}

/**
 * 档位前导：明确告诉模型这次是哪个强度，覆盖正文里的默认 full。
 *
 * @param level - `lite` / `full` / `ultra`。
 * @returns 拼在 ponytail 正文之前的 markdown 片段。
 */
function levelPreamble(level) {
  return [
    `> **本次强度：${level}** —— 由 \`/ponytail-${level}\` 显式指定，覆盖正文里的默认 full。`,
    `> 下面就是 ponytail 的完整规则，请按 ${level} 档执行。`,
    '',
    '',
  ].join('\n')
}
