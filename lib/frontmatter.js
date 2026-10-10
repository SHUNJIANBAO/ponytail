/**
 * 极简 SKILL.md frontmatter 解析器：零依赖，只实现 DSH 技能发现用到的 YAML 子集。
 *
 * 为什么不用 `yaml` 包：插件要能从 GitHub 装到一台全新的机器上，多一个 npm
 * 运行时依赖就多一个装不上的理由（离线、镜像没同步、pnpm 拦构建脚本）。技能
 * frontmatter 只有 name / description / whenToUse / disable-model-invocation
 * 这几个键，外加 `description: >` / `|` 两种块标量，手写解析足够且没有版本漂移。
 *
 * 支持：
 *   - 普通标量、单引号/双引号标量
 *   - 块标量 `|` `|-` `|+`（字面，保留换行）与 `>` `>-` `>+`（折叠，单换行变空格）
 *   - 块内空行、注释行、任意缩进
 * 不支持（也用不到）：嵌套映射、序列、锚点、多文档。
 *
 * @param text - SKILL.md 全文。
 * @returns `{ data, body }`；没有合法 frontmatter 时返回 undefined。
 */
export function parseFrontmatter(text) {
  if (typeof text !== 'string') return undefined
  const lines = text.split(/\r?\n/)
  if (lines[0] !== '---') return undefined
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      end = i
      break
    }
  }
  if (end === -1) return undefined

  const data = {}
  let i = 1
  while (i < end) {
    const line = lines[i]
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i += 1
      continue
    }
    const match = /^([A-Za-z][A-Za-z0-9_-]*):(.*)$/.exec(line)
    if (match === null) {
      i += 1
      continue
    }
    const key = match[1]
    const rest = match[2].trim()
    const block = /^([|>])([+-]?)(\d*)$/.exec(rest)
    if (block === null) {
      data[key] = unquote(rest)
      i += 1
      continue
    }
    const collected = []
    i += 1
    while (i < end && (lines[i].trim() === '' || /^[ \t]/.test(lines[i]))) {
      collected.push(lines[i])
      i += 1
    }
    while (collected.length > 0 && collected[collected.length - 1].trim() === '') collected.pop()
    data[key] = renderBlock(collected, block[1], block[2])
  }

  return { data, body: lines.slice(end + 1).join('\n').replace(/^\n+/, '') }
}

/**
 * 渲染块标量：先剥掉公共缩进，再按字面/折叠语义拼接，最后按 chomping 指示符收尾。
 *
 * @param lines - 块标量覆盖的原始行（已去掉尾部空行）。
 * @param style - `|` 字面，`>` 折叠。
 * @param chomp - `''` 默认 clip（保留一个换行）、`-` strip（不留）、`+` keep（全留）。
 * @returns 解析出的字符串。
 */
function renderBlock(lines, style, chomp) {
  const nonEmpty = lines.filter((line) => line.trim() !== '')
  if (nonEmpty.length === 0) return ''
  const indent = Math.min(...nonEmpty.map((line) => line.length - line.trimStart().length))
  const content = lines.map((line) => line.slice(indent))

  let out
  if (style === '|') {
    out = content.join('\n')
  } else {
    out = ''
    let previousBlank = false
    for (const line of content) {
      if (line.trim() === '') {
        out += '\n'
        previousBlank = true
        continue
      }
      if (out !== '' && !previousBlank) out += ' '
      out += line.trim()
      previousBlank = false
    }
  }

  if (chomp === '-') return out.replace(/\n+$/, '')
  if (chomp === '+') return out
  return `${out.replace(/\n+$/, '')}\n`
}

/**
 * 去掉成对的单/双引号；其余原样返回。
 *
 * @param value - 标量原文。
 * @returns 去引号后的值。
 */
function unquote(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1)
  }
  return value
}
