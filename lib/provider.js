/**
 * 技能提供方工厂：把一个包内 `skills/<name>/SKILL.md` 目录树注册到 `ctx.skills`。
 *
 * 协议与官方 `@deepseek-ai/dsh-skill-filesystem` 对齐：
 *   - `list()` 只读 frontmatter，返回候选摘要（正文留到 get 时才读）
 *   - `get()` 读并解析胜出候选的 SKILL.md，返回带 `resourceBase` 的完整定义
 * 任何 IO 失败都退化成"这个技能不存在"，绝不抛给注册表（发现失败的提供方会被
 * 记录并跳过，但那会让整个技能目录标记为不完整）。
 *
 * @module dsh-skill-bundle/provider
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseFrontmatter } from './frontmatter.js'

/** 公开技能名文法，与 dsh-skill 的 SKILL_NAME 一致。 */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 造一个**提供方工厂**，直接交给 `ctx.skills.registerProvider`。
 *
 * 注意签名：`registerProvider(create: (control) => SkillProvider)` 要的是**函数**，
 * 不是 provider 对象。传对象会得到 `TypeError: create is not a function`，
 * 而 apply 里的 try/catch 会把它吞成一条 warn —— 表现就是"技能静默消失"。
 *
 * @param options - 提供方身份与技能根目录。
 * @param options.name - 提供方名（同一层内必须唯一）。
 * @param options.rank - 技能优先级，数值越小越优先。
 * @param options.source - 提示词里可见的来源桶名。
 * @param options.skillsRoot - 绝对路径，其下每个子目录含一个 SKILL.md。
 * @returns `(control) => { name, list, get }`。
 */
export function createSkillProvider({ name, rank, source, skillsRoot }) {
  return function skillProvider(control) {
    return {
      name,

      /**
       * 扫描技能目录，返回候选摘要。
       *
       * @param options - 注册表传入的查询选项。
       * @returns 按名称排序的候选数组；目录不可读时返回空数组。
       */
      async list(options) {
        const signal = options?.signal ?? control?.signal
        let entries
        try {
          entries = await readdir(skillsRoot, { withFileTypes: true })
        } catch {
          return []
        }
        const candidates = []
        for (const entry of entries) {
          if (signal?.aborted) break
          if (!entry.isDirectory()) continue
          const locator = join(skillsRoot, entry.name)
          const parsed = await readSkillFile(join(locator, 'SKILL.md'), signal)
          if (parsed === undefined) continue
          candidates.push({
            name: parsed.name,
            description: parsed.description,
            ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
            invocation: parsed.invocation,
            source,
            provider: name,
            rank,
            locator,
            path: parsed.path,
            ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
          })
        }
        return candidates.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
      },

      /**
       * 读取胜出候选的完整定义。
       *
       * @param candidate - `list()` 返回的候选项。
       * @returns 完整技能定义；正文读不到时返回 undefined。
       */
      async get(candidate, options) {
        const parsed = await readSkillFile(candidate?.path, options?.signal ?? control?.signal)
        if (parsed === undefined) return undefined
        return {
          name: parsed.name,
          description: parsed.description,
          ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
          invocation: parsed.invocation,
          source,
          provider: name,
          resourceBase: { kind: 'directory', path: candidate.locator },
          path: parsed.path,
          ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
          content: parsed.content,
        }
      },
    }
  }
}

/**
 * 读并解析一个 SKILL.md。
 *
 * @param skillFile - SKILL.md 的绝对路径。
 * @param signal - 可选取消信号。
 * @returns 解析结果；文件缺失、无 frontmatter、缺 name/description 或名字非法时返回 undefined。
 */
async function readSkillFile(skillFile, signal) {
  let text
  try {
    text = await readFile(skillFile, 'utf8')
  } catch {
    return undefined
  }
  if (signal?.aborted) return undefined

  const parsed = parseFrontmatter(text)
  if (parsed === undefined) return undefined
  const skillName = typeof parsed.data.name === 'string' ? parsed.data.name.trim() : ''
  const description = typeof parsed.data.description === 'string' ? parsed.data.description.trim() : ''
  // 名字非法或描述缺失时跳过该目录：交给注册表只会让它抛错并整层失败。
  if (skillName === '' || description === '' || !SKILL_NAME.test(skillName)) return undefined

  const metadata = { ...parsed.data }
  return {
    name: skillName,
    description,
    whenToUse: typeof parsed.data.whenToUse === 'string' ? parsed.data.whenToUse.trim() : undefined,
    invocation: invocationFrom(parsed.data),
    metadata,
    path: skillFile,
    content: parsed.body.trim(),
  }
}

/**
 * 把上游的 `disable-model-invocation: true` 映射成 DSH 的调用策略。
 *
 * @param data - 解析出的 frontmatter。
 * @returns `{ modelInvocable, userInvocable }`。
 */
function invocationFrom(data) {
  const disabled = data['disable-model-invocation'] === true || data['disable-model-invocation'] === 'true'
  return { modelInvocable: !disabled, userInvocable: true }
}
