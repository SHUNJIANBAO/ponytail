// dsh-ponytail 离线回归：浏览器半（懒散等级下拉 → 草稿 token）与宿主半（技能提供方）。
//
// 跑法：node test/offline-regression.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createChecker, createSlotsCore, declareComposerSeats, loadClientPlugin, makeSlots, mount, registerSkillProviderFake } from "./harness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientFile = path.join(here, "..", "lib", "client.js");
const hostFile = path.join(here, "..", "lib", "index.js");

const plugin = loadClientPlugin(clientFile);
const { check, report } = createChecker();

const LEVEL_ORDER = ["off", "lite", "full", "ultra"];

/** 每个夹具用独立 sessionId：localStorage 桩在同一进程内是共享的，
 *  复用同一个 id 会让上一个用例选的档位泄漏到下一个。 */
let sessionSeq = 0;

/** 造一个可交互的夹具：真实槽位注册 + 草稿状态机。 */
function mountControl() {
  const core = createSlotsCore();
  declareComposerSeats(core);
  // 官方/其它插件已占的格子：验证我们不冲突、且 order 排序正确
  core.register({ name: "conversation.input.right", id: "dsh-grill-me", order: -200 }, "GRILL");

  let promptCalls = 0;
  const ctx = {
    slots: makeSlots(core),
    // 故意提供 remote.session：即便可用，本插件也绝不能调用它
    remote: { session: { prompt: async () => { promptCalls += 1; return { ok: true }; } } },
  };
  plugin.apply(ctx);

  const component = core.entries("conversation.input.right")
    .find((entry) => entry.options.id === "dsh-ponytail")?.component;

  sessionSeq += 1;
  const sessionId = "session-" + sessionSeq;
  let draft = "";
  const actions = { setDraft: (text) => { draft = text; } };
  const props = () => ({
    sessionId,
    locked: false,
    useInput: () => draft,
    inputActions: actions,
  });

  let fixture = mount(plugin.react, component, props());
  const trigger = () => fixture.element.children[0];
  const menu = () => fixture.element.children[1];
  const option = (value) => menu().children[1][LEVEL_ORDER.indexOf(value)];

  return {
    core,
    component,
    get draft() { return draft; },
    get promptCalls() { return promptCalls; },
    get shown() {
      // 触发器上的档位文案（createElement 桩把文本子节点放进 children 数组）
      return trigger().children[1].children[0];
    },
    get on() { return String(trigger().props.className).includes("is-on"); },
    get open() { return trigger().props["aria-expanded"] === true; },
    clickTrigger() { trigger().props.onClick(); fixture.setProps({}); },
    pick(value) { this.clickTrigger(); option(value).props.onClick(); fixture.setProps({}); },
    setDraftExternally(text) { draft = text; fixture.setProps({}); },
    /** 只重渲染若干轮（不改变任何状态），用来观察插件会不会"过一会自己动草稿"。 */
    render() { fixture.setProps({}); },
    /** 模拟宿主 commit-draft：发送成功后整体清空草稿。 */
    simulateSend() { draft = ""; fixture.setProps({}); },
    /** 模拟宿主把带 token 的旧草稿回填。 */
    simulateHostRestore(text) { draft = text; fixture.setProps({}); },
    remount() { fixture = mount(plugin.react, component, props()); },
    props,
  };
}

// ── 1. 依赖面：只依赖 slots，不可能代替用户发送 ──
{
  console.log("\n1. 依赖面");
  check("inject 恰为 ['slots']（不依赖任何 remote 服务）", JSON.stringify(plugin.inject) === JSON.stringify(["slots"]));
  check("导出 apply 是函数", typeof plugin.apply === "function");
}

// ── 2. 落座与排序 ──
{
  console.log("\n2. 落座 conversation.input.right");
  const f = mountControl();
  const ids = f.core.entries("conversation.input.right").map((entry) => entry.options.id);
  check("本插件已登记（id = dsh-ponytail）", ids.includes("dsh-ponytail"));
  check("追问按钮仍在（list 槽位不互相顶掉）", ids.includes("dsh-grill-me"));
  check("order -100 排在追问按钮 -200 之后", ids.indexOf("dsh-ponytail") > ids.indexOf("dsh-grill-me"));
}

// ── 3. 默认关闭：不在用户没选过的情况下写草稿 ──
{
  console.log("\n3. 默认档位 = 关闭");
  const f = mountControl();
  check("初始草稿为空（挂载时不注入 token）", f.draft === "");
  check("触发器显示关闭态", f.on === false && f.shown === "关闭");
}

// ── 4. 选档位 → 把 /ponytail <档位> 钉进草稿 ──
{
  console.log("\n4. 选档位写入 token");
  const f = mountControl();
  f.pick("ultra");
  check("草稿被钉上 /ponytail ultra", f.draft === "/ponytail-ultra ");
  check("触发器变为开启态且显示极简", f.on === true && f.shown === "极简");
  check("选档位没有发送任何消息", f.promptCalls === 0);

  f.pick("lite");
  check("改档位会改写 token（不是叠加）", f.draft === "/ponytail-lite ");
  check("草稿里只有一个 /ponytail", (f.draft.match(/\/ponytail/g) || []).length === 1);
}

// ── 5. 已有正文时 token 拼在正文之前，且不破坏正文 ──
{
  console.log("\n5. 已有正文时注入位置正确");
  const f = mountControl();
  f.setDraftExternally("帮我看看这段 C# 哪里过度设计了");
  f.pick("full");
  check("token 在正文之前（宿主只认空白边界 token）", f.draft === "/ponytail-full 帮我看看这段 C# 哪里过度设计了");

  f.pick("ultra");
  check("换档位后正文原样保留", f.draft === "/ponytail-ultra 帮我看看这段 C# 哪里过度设计了");
}

// ── 6. 选「关闭」摘掉 token，保留正文 ──
{
  console.log("\n6. 关闭档位");
  const f = mountControl();
  f.setDraftExternally("正文");
  f.pick("full");
  check("先开启", f.draft === "/ponytail-full 正文");
  f.pick("off");
  check("关闭后只剩用户正文", f.draft === "正文");
  check("触发器回到关闭态", f.on === false && f.shown === "关闭");
  f.pick("off");
  check("已关闭时再选关闭是幂等的", f.draft === "正文");
}

// ── 7. 发送后自动重钉当前档位（档位是持久模式） ──
{
  console.log("\n7. 发送后自动重钉");
  const f = mountControl();
  f.pick("ultra");
  f.setDraftExternally("/ponytail-ultra 正文");
  f.simulateSend();
  check("发送清空草稿后重新钉回 /ponytail ultra", f.draft === "/ponytail-ultra ");
  check("重钉后仍为开启态", f.on === true);

  f.remount();
  check("输入框重挂载后不会重复叠加 token", f.draft === "/ponytail-ultra ");
  check("重挂载后仍是开启态", f.on === true);
}

// ── 8. 关闭状态下发送 → 不重钉 ──
{
  console.log("\n8. 关闭状态下发送不重钉");
  const f = mountControl();
  f.pick("off");
  f.setDraftExternally("正文");
  f.simulateSend();
  check("发送后草稿仍为空", f.draft === "");
  f.remount();
  check("重挂载后草稿仍为空（没有自愈式补 token）", f.draft === "");
}

// ── 9. 用户手动改 token：下拉跟着走，不被旧值覆盖 ──
{
  console.log("\n9. 手动改 token 时下拉跟随");
  const f = mountControl();
  f.pick("full");
  f.setDraftExternally("/ponytail-lite 正文");
  check("下拉显示用户手动写的档位", f.shown === "轻量");
  f.simulateSend();
  check("发送后按用户手写的档位重钉", f.draft === "/ponytail-lite ");
  check("下拉仍显示轻量", f.shown === "轻量");
}

// ── 10. 手动删掉 token 后打字：插件不抢草稿 ──
{
  console.log("\n10. 手动删 token 后不抢草稿");
  const f = mountControl();
  f.pick("full");
  f.setDraftExternally("正文");
  check("用户删掉 token 后下拉回落到存储档位（标准）", f.shown === "标准");
  f.setDraftExternally("正文继续打字");
  check("打字过程中草稿不被改写", f.draft === "正文继续打字");
}

// ── 11. 宿主回填旧草稿不打架 ──
{
  console.log("\n11. 宿主回填旧草稿");
  const f = mountControl();
  f.pick("ultra");
  f.setDraftExternally("/ponytail-ultra 正文");
  f.simulateSend();
  f.simulateHostRestore("/ponytail-ultra 正文");
  check("回填后草稿就是回填内容（插件不二次改写）", f.draft === "/ponytail-ultra 正文");
  check("回填后仍为开启态", f.on === true);
}

// ── 12. 缺 props 的兜底：渲染与点击都不崩 ──
{
  console.log("\n12. props 缺失兜底");
  const core = createSlotsCore();
  declareComposerSeats(core);
  plugin.apply({ slots: makeSlots(core) });
  const component = core.entries("conversation.input.right")[0].component;

  let threw = null;
  try { plugin.react.__mount(component, { sessionId: undefined, locked: false }); } catch (error) { threw = error; }
  check("无 sessionId / 无 inputActions 渲染不抛错", threw === null);

  const element = plugin.react.__mount(component, { sessionId: "s2", locked: false });
  check("缺 inputActions 时触发器仍渲染", element.children[0] !== undefined);
  let clickThrew = null;
  try {
    element.children[0].props.onClick();
    const menu = plugin.react.__mount(component, { sessionId: "s2", locked: false, useInput: () => "" }).children[1];
    if (menu) menu.children[1][3].props.onClick();
  } catch (error) { clickThrew = error; }
  check("缺 inputActions 时点击不抛错（静默降级）", clickThrew === null);
}

// ── 13. 槽位未声明：静默失败，不拖垮启动 ──
{
  console.log("\n13. 槽位未声明");
  const core = createSlotsCore();
  let threw = null;
  try { plugin.apply({ slots: makeSlots(core) }); } catch (error) { threw = error; }
  check("apply 未抛错（最坏只是下拉不出现）", threw === null);
}

// ── 14. 宿主半：技能提供方 ──
{
  console.log("\n14. 宿主半技能提供方");
  const host = await import(pathToFileURL(hostFile).href);
  check("导出 name = dsh-ponytail", host.name === "dsh-ponytail");
  check("inject = ['skills']", JSON.stringify(host.inject) === JSON.stringify(["skills"]));

  let provider = null;
  let threw = null;
  try {
    host.apply({ skills: { registerProvider: registerSkillProviderFake((instance) => { provider = instance; }) } });
  } catch (error) { threw = error; }
  check("apply 未抛错且已注册提供方", threw === null && provider !== null);
  check("提供方名与 npm 上的 dsh-ponytail-skills 不撞车", provider.name === "dsh-ponytail-mode");

  const candidates = await provider.list({});
  const names = candidates.map((candidate) => candidate.name).sort();
  check("列出六个技能（3 个功能技能 + 3 个档位技能）",
    JSON.stringify(names) === JSON.stringify([
      "ponytail", "ponytail-audit", "ponytail-full", "ponytail-lite", "ponytail-review", "ponytail-ultra",
    ]));
  check("每个候选都有非空描述", candidates.every((candidate) => candidate.description.length > 20));
  check("候选不带正文（列举不读正文）", candidates.every((candidate) => candidate.content === undefined));
  check("provider 字段与提供方名一致", candidates.every((candidate) => candidate.provider === "dsh-ponytail-mode"));

  const definition = await provider.get(candidates.find((candidate) => candidate.name === "ponytail"), {});
  check("get 返回完整正文", typeof definition.content === "string" && definition.content.includes("The ladder"));
  check("resourceBase 指向技能目录", definition.resourceBase.kind === "directory" && definition.resourceBase.path.endsWith("ponytail"));
  check("折叠块标量 description 解析正确（多行折成一行）",
    definition.description.includes("Forces the laziest solution that actually works"));
  check("上游 argument-hint 作为元数据透传（DSH 本身不解析它）", definition.metadata["argument-hint"] === "[lite|full|ultra]");

  // ── 档位技能：整串变蓝靠的就是「整串是一个技能名」 ──
  const levelCandidates = new Map(candidates.map((candidate) => [candidate.name, candidate]));
  for (const [skillName, level] of [["ponytail-lite", "lite"], ["ponytail-full", "full"], ["ponytail-ultra", "ultra"]]) {
    const candidate = levelCandidates.get(skillName);
    check(`${skillName} 已注册且用户可调用`, candidate !== undefined && candidate.invocation.userInvocable === true);
    check(`${skillName} 不对模型开放（不进技能目录）`, candidate.invocation.modelInvocable === false);
    const levelDefinition = await provider.get(candidate, {});
    check(`${skillName} 与候选同名（注册表要求）`, levelDefinition.name === skillName);
    check(`${skillName} 正文含档位前导`, levelDefinition.content.startsWith(`> **本次强度：${level}**`));
    check(`${skillName} 正文就是 ponytail 的完整正文（单一来源）`,
      levelDefinition.content.endsWith(definition.content));
    check(`${skillName} 描述来自自己的 SKILL.md`, levelDefinition.description.includes(level));
  }

  const missing = await provider.get({ path: path.join(here, "..", "skills", "nope", "SKILL.md") }, {});
  check("不存在的技能返回 undefined 而不是抛错", missing === undefined);
}

// ── 15. 每次选择都不发送消息 ──
{
  console.log("\n15. 全程不发送");
  const f = mountControl();
  f.pick("lite");
  f.pick("full");
  f.pick("ultra");
  f.pick("off");
  f.simulateSend();
  check("四轮选择 + 一次发送后仍无任何 remote 调用", f.promptCalls === 0);
}

// ── 16. 回归：草稿里只有 token 时，「关闭」必须真的关得掉 ──
// 曾经的 bug：choose("off") 摘掉 token → 草稿变空 → 重钉 effect 读到 lastTokenRef
// 里还记着的 "full"，立刻把 /ponytail full 又写回去，表现是"点关闭毫无反应"。
{
  console.log("\n16. 回归：token 独占草稿时关闭");
  const f = mountControl();
  f.pick("full");
  check("先开启，草稿里只有 token", f.draft === "/ponytail-full ");
  check("下拉显示标准", f.shown === "标准");

  f.pick("off");
  check("选关闭后草稿被清空", f.draft === "");
  check("选关闭后下拉显示关闭", f.shown === "关闭" && f.on === false);
  check("没有被重钉逻辑写回去", f.draft === "");

  f.render();
  check("多渲染几轮后草稿仍为空", f.draft === "");
  f.remount();
  check("重挂载后草稿仍为空", f.draft === "");
  check("重挂载后下拉仍显示关闭", f.shown === "关闭");

  f.pick("ultra");
  check("关闭后仍能重新开启", f.draft === "/ponytail-ultra " && f.shown === "极简");
}

// ── 17. 回归：手动把只有 token 的草稿删光 = 关闭 ──
{
  console.log("\n17. 回归：手动删光 token 视为关闭");
  const f = mountControl();
  f.pick("lite");
  check("先开启", f.draft === "/ponytail-lite ");
  f.setDraftExternally("");
  check("手动删光后草稿保持为空（不重钉）", f.draft === "");
  check("下拉跟着变成关闭", f.shown === "关闭");
  f.remount();
  check("重挂载后仍为空", f.draft === "");
}

// ── 18. 边界：只把 token 本身发出去 → 不重钉 ──
{
  console.log("\n18. 边界：只发 token 本身");
  const f = mountControl();
  f.pick("full");
  f.simulateSend();
  check("草稿保持为空", f.draft === "");
  check("下拉显示关闭", f.shown === "关闭");
}

// ── 19. 对照：带正文的草稿发送后仍然重钉（别把持久模式一起修没了）──
{
  console.log("\n19. 对照：带正文发送后仍重钉");
  const f = mountControl();
  f.pick("ultra");
  f.setDraftExternally("/ponytail-ultra 帮我看看这段");
  f.simulateSend();
  check("带正文发送后按档位重钉", f.draft === "/ponytail-ultra ");
  check("下拉仍显示极简", f.shown === "极简");
}

// ── 20. 回归：展开菜单必须不透明 ──
// --dsw-specific-menu 在 Windows 暗色下是 #43454a73（45% 不透明），macOS 才被主题
// 覆写成 #303136f0。直接拿它当 background，菜单会透出后面的输入栏。
// 要求：实色底 + 把半透明菜单色用渐变叠上去。
{
  console.log("\n20. 回归：菜单背景不透明");
  const css = plugin.__styleText();
  const menuRule = (css.match(/\.dpi-menu\{[^}]*\}/) || [""])[0];
  check("找到 .dpi-menu 规则", menuRule.length > 0);
  check("有实色底 background-color", /background-color:var\(--dsw-alias-bg-base/.test(menuRule));
  check("半透明菜单色以渐变层叠上去", /background-image:linear-gradient\(var\(--dsw-specific-menu/.test(menuRule));
  check("没有任何声明把菜单底色直接设成半透明 token",
    !/[;{]background(?:-color)?:var\(--dsw-specific-menu\)/.test(menuRule));
}

// ── 21. 兼容：旧的 /ponytail <档位> 写法仍然识别 ──
// 上游 ponytail 的写法是 `/ponytail lite|full|ultra`，但输入框的 `/` 高亮只认
// 「/ + 已注册技能名」，那种写法只有 `/ponytail` 会变蓝。主形式改成 `/ponytail-lite`
// 之后，旧草稿里的旧写法仍要能识别，否则升级后草稿会"显示关闭但实际开着"。
{
  console.log("\n21. 兼容旧 token 写法");
  const f = mountControl();
  f.setDraftExternally("/ponytail ultra 正文");
  check("旧写法仍被识别为开启态（极简）", f.shown === "极简" && f.on === true);
  f.simulateSend();
  check("发送后按旧写法里的档位重钉，并改用新形式", f.draft === "/ponytail-ultra ");
  check("下拉仍显示极简", f.shown === "极简");
}

// ── 22. 新形式 token 的边界判定 ──
{
  console.log("\n22. 新形式 token 的边界");
  const f = mountControl();
  f.setDraftExternally("/ponytail-lite 正文");
  check("/ponytail-lite 被识别为轻量", f.shown === "轻量" && f.on === true);
  f.setDraftExternally("/ponytail-litex 正文");
  check("/ponytail-litex 不被误认（长 token 不能退化成 /ponytail）", f.shown === "关闭");
  f.setDraftExternally("/ponytail-full");
  check("token 后没有空格也算（行尾终止）", f.shown === "标准");
  f.setDraftExternally("/ponytail-ultra\n正文");
  check("token 后接换行也算终止", f.shown === "极简");
}

// ── 23. 与「追问」按钮共存：token 在草稿任意位置都要认得 ──
// 复现过的 bug：先选档位 → 点追问（把 /grill-me 前插到草稿最前面）→ 再切档位。
// token 处理锚定 `^` 的话，切档位时找不到、也摘不掉旧的 ponytail token，
// 新 token 被前插、旧的留在后面 —— 草稿里堆出两个，宿主把两个技能都注入，
// 表现成「多个档位同时生效」。
{
  console.log("\n23. 与追问按钮共存（token 不在开头）");
  const f = mountControl();
  f.pick("ultra");
  check("先选极简", f.draft === "/ponytail-ultra ");
  f.setDraftExternally("/grill-me " + f.draft); // 追问按钮 withToken() 前插
  check("追问前插后，下拉仍认出极简", f.shown === "极简" && f.on === true);

  f.pick("lite");
  check("切轻量后 ponytail token 只有一个", (f.draft.match(/\/ponytail-/g) || []).length === 1);
  check("切轻量是原地替换，没把旧 token 留在后面", f.draft === "/grill-me /ponytail-lite ");
  check("追问的 token 没被动过", (f.draft.match(/\/grill-me/g) || []).length === 1);
  check("下拉跟着变成轻量", f.shown === "轻量");

  f.pick("off");
  // 摘掉中间那个 token 后，它自己的尾分隔符会留下：`/grill-me ` —— 这正是
  // 追问按钮单独开启时草稿的形态（`${GRILL_TOKEN} `），所以就是期望值。
  check("关闭只摘 ponytail token，保留 /grill-me", f.draft === "/grill-me ");
  check("关闭后下拉显示关闭", f.shown === "关闭" && f.on === false);
  check("关闭没有把 /grill-me 也删掉", (f.draft.match(/\/grill-me/g) || []).length === 1);

  const g = mountControl();
  g.setDraftExternally("/grill-me 帮我看看这段 C#");
  g.pick("ultra");
  check("没有 token 时钉在最前面", g.draft === "/ponytail-ultra /grill-me 帮我看看这段 C#");
  g.pick("full");
  check("有 token 时原地替换（位置不变）", g.draft === "/ponytail-full /grill-me 帮我看看这段 C#");
  check("正文一个字没动", g.draft.endsWith("帮我看看这段 C#"));
}

// ── 24. 与追问共存时的重钉与"删光即关闭" ──
{
  console.log("\n24. 共存时的重钉与关闭");
  const f = mountControl();
  f.pick("ultra");
  f.setDraftExternally("/grill-me /ponytail-ultra 正文");
  f.simulateSend();
  check("发送后按档位重钉", f.draft === "/ponytail-ultra ");

  const g = mountControl();
  g.pick("ultra");
  g.setDraftExternally("/grill-me /ponytail-ultra ");
  g.setDraftExternally("");
  check("用户删光（草稿里只剩手势 token、没正文）视为关闭", g.shown === "关闭" && g.on === false);
  check("关闭后不重钉", g.draft === "");

  const h = mountControl();
  h.pick("lite");
  h.setDraftExternally("/grill-me /ponytail-lite 正文还在");
  h.setDraftExternally("");
  check("有正文时发送仍按档位重钉", h.draft === "/ponytail-lite ");
}

report();
