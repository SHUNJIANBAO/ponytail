/**
 * dsh-ponytail 宿主半：把包内 `skills/` 下的 ponytail 技能注册到 `ctx.skills`。
 *
 * 浏览器半（输入栏「懒散等级」下拉）在 `lib/client.js`，由 dsh-client-modules
 * 按包名挂到同一行 Loader 行上，两半共享一个 bundle patch 行。
 *
 * 提供方名刻意不叫 `dsh-ponytail`：npm 上的 `dsh-ponytail-skills` 用的正是那个
 * 名字，同名会在同一层里撞车（"a skill provider named X is already registered"）。
 *
 * @module dsh-ponytail
 */
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

/**
 * 注册技能提供方。
 *
 * @param ctx - Cordis 插件上下文（已注入 `skills`）。
 */
export function apply(ctx) {
  try {
    const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url))
    ctx.skills.registerProvider(
      createSkillProvider({ name: PROVIDER_NAME, rank: RANK, source: 'custom', skillsRoot }),
    )
  } catch (error) {
    // apply 抛错会把这一行变成 failed。技能装不上可以接受，宿主起不来不行。
    console.warn('[dsh-ponytail] 技能提供方注册失败：', error)
  }
}
