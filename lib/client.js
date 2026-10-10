window.__ModuleLoader__.load({
  id: "dsh-ponytail",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    /* 只依赖 slots：本插件通过槽位标准 props 的 inputActions 改草稿，
     * 不调用任何 remote 服务，因此不可能替用户发送消息。 */
    const inject = ["slots"];

    /* 视觉完全复刻官方 ModelSelect（样式取自 ui-model-selection 的 CSS 模块，
     * 类名前缀换成自己的 dpi- —— 宿主的 hash 类名每次构建都会变，绝不能引用）。 */
    if (typeof document !== "undefined" && !document.getElementById("dsh-ponytail-style")) {
      const style = document.createElement("style");
      style.id = "dsh-ponytail-style";
      style.textContent = [
        ".dpi-root{min-width:0;position:relative}",
        ".dpi-trigger{min-width:0;max-width:min(360px,45cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;display:flex}",
        ".dpi-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
        ".dpi-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}",
        ".dpi-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
        ".dpi-trigger.is-off{color:var(--dsw-alias-label-dimmed)}",
        ".dpi-trigger.is-on{color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary)}",
        ".dpi-trigger.is-on:hover:not(:disabled){filter:brightness(.97);background:var(--dsw-alias-state-warn-tertiary)}",
        ".dpi-triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
        ".dpi-triggerValue{color:var(--dsw-alias-label-caption);font-weight:500;flex:none}",
        ".dpi-trigger.is-on .dpi-triggerValue{color:inherit}",
        ".dpi-chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s;display:flex}",
        ".dpi-chevronOpen{transform:rotate(180deg)}",
        /* 菜单背景必须不透明。--dsw-specific-menu 在 Windows 暗色下是 #43454a73
         * （45% 不透明），macOS 才被主题覆写成 #303136f0 —— 直接拿它当 background，
         * 展开窗口就会透出后面的输入栏。做法：实色底 + 把半透明的菜单色用渐变
         * 叠上去，既保持主题色调又完全不透。--dsw-alias-bg-base 在明暗两套主题里
         * 都是实色（bluish-00 / bluish-950），且跟随主题自动切换。 */
        ".dpi-menu{z-index:20;border:1px solid var(--dsw-alias-border-inverted);background-color:var(--dsw-alias-bg-base,#1b1c1f);background-image:linear-gradient(var(--dsw-specific-menu,#303136),var(--dsw-specific-menu,#303136));width:max-content;min-width:200px;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 8px);right:0;overflow:hidden}",
        ".dpi-option{border:none;background:0 0;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:7px 8px;border-radius:8px;color:inherit;font:inherit;font-size:13px;line-height:20px;text-align:left;outline:none}",
        ".dpi-option:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
        ".dpi-option:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}",
        ".dpi-option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
        ".dpi-optionCopy{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dpi-check{flex:none;color:var(--dsw-alias-label-primary);display:flex;font-size:14px;line-height:1}",
        ".dpi-label{color:var(--dsw-alias-label-caption);padding:6px 8px 2px;font-size:12px;line-height:18px}",
      ].join("\n");
      document.head.appendChild(style);
    }

    const chevron = (className) => react.createElement("svg", {
      className,
      width: 14, height: 14, viewBox: "0 0 14 14", fill: "none",
      "aria-hidden": true,
    }, react.createElement("path", {
      d: "M3.5 5.25 7 8.75l3.5-3.5", stroke: "currentColor",
      strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round",
    }));
    const check = react.createElement("svg", {
      width: 16, height: 16, viewBox: "0 0 16 16", fill: "none",
      "aria-hidden": true,
    }, react.createElement("path", {
      d: "M3.5 8.5 6.5 11.5 12.5 4.5", stroke: "currentColor",
      strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
    }));

    const OPTIONS = [
      { value: "off", label: "关闭" },
      { value: "lite", label: "轻量" },
      { value: "full", label: "标准" },
      { value: "ultra", label: "极简" },
    ];
    const LEVELS = OPTIONS.map((option) => option.value);
    const isLevel = (value) => LEVELS.indexOf(value) !== -1;

    /* ── 与 ponytail 技能的接口：草稿里的手势 token ──────────────────────
     *
     * 技能不是命令，`remote.commands.execute(sessionId, "/ponytail")` 走不通。
     * 用户级技能唯一的入口是宿主的手势监听器：它扫描「已认领的用户消息」里
     * 以空白为界的 `/name` token，命中就把该技能的 <skill_content> 注入该步。
     *
     * 写哪种形式有讲究：输入框的 `/` 高亮（lexicon）只认「`/` + 已注册技能名」，
     * 而 DSH 没有任何「技能参数」概念 —— `/ponytail lite` 只会把 `/ponytail`
     * 染蓝，` lite` 永远是普通文字。所以主形式是 **`/ponytail-lite`**：整串就是
     * 一个已注册的技能名，整串变蓝、整串被注入，档位由技能正文的前导行声明。
     *
     * 旧形式 `/ponytail lite` 仍然识别（兼容旧草稿和上游写法），只是下拉框不再写它。
     *
     * token 必须被空白边界包住才会被识别 —— 而且**可以出现在消息的任意位置**，
     * 不是只能在开头。所以这里一律用「任意位置的空白边界匹配」，绝不锚定 `^`：
     * 追问按钮会把 `/grill-me` 前插到草稿最前面，锚定 `^` 就会看不见自己后面那个
     * token（表现：切档位时摘不掉旧的，草稿里堆出两个 ponytail token，
     * 宿主把两个技能都注入 → 多个档位同时生效）。
     */
    const TOKEN_ANY_RE = /(^|[ \t\r\n])\/(?:ponytail-(lite|full|ultra)|ponytail(?:[ \t]+(lite|full|ultra))?)(?=$|[ \t\r\n])/;
    const BARE_LEVEL = "full";

    /** 在草稿任意位置找 token；找不到返回 null。 */
    function findToken(text) {
      const match = TOKEN_ANY_RE.exec(text);
      if (match === null) return null;
      return { level: match[2] || match[3] || BARE_LEVEL };
    }

    /** 草稿里是否已有 token；有则返回它代表的档位（裸 `/ponytail` 视为 full）。 */
    function matchToken(text) {
      const found = findToken(text);
      return found === null ? null : found.level;
    }

    /** 档位对应的 token 文本：整串是一个已注册的技能名，所以整串会被染蓝。 */
    function tokenFor(level) {
      return "/ponytail-" + level;
    }

    /** 摘掉草稿里任意位置的 token，保留用户正文（含别人的 token）。
     *  判定与 matchToken 共用同一个正则，避免"显示关闭但摘不掉"的不一致。 */
    function stripToken(text) {
      if (findToken(text) === null) return text;
      return text.replace(TOKEN_ANY_RE, "").replace(/^[ \t]+/, "");
    }

    /** 原地换掉 token：保留它所在的位置（以及 `/grill-me` 的 token 和用户排序）。 */
    function replaceToken(text, token) {
      return text.replace(TOKEN_ANY_RE, (_match, lead) => lead + token);
    }

    /** 空白边界的 `/name` 手势 token（任意名字），用来判断"草稿里还有没有正文"。 */
    const GESTURE_WORD_RE = /(^|[ \t\r\n])\/[a-z0-9][a-z0-9-]*(?=$|[ \t\r\n])/g;

    /** 草稿是否**只有手势 token**、没有任何正文。
     *  用于区分"用户手动把 token 删光了"（应当视为关闭）与"发送把草稿清空了"
     *  （应当按档位重钉）。别的插件的手势 token（如 `/grill-me`）也是 token，
     *  不算正文 —— 否则草稿是 `/grill-me /ponytail-ultra ` 时会被误判成"发了一条消息"。 */
    function hasOnlyGestureTokens(text) {
      return stripToken(text).replace(GESTURE_WORD_RE, " ").trim() === "";
    }

    /* 档位持久化：每会话一份。默认「关闭」—— 下拉显示什么，草稿里就真有什么，
     * 不会在用户没选过的情况下替他把 ponytail 打开。 */
    const storageKey = (sessionId) => "dsh-ponytail:" + sessionId;
    const loadLevel = (sessionId) => {
      try {
        const value = window.localStorage.getItem(storageKey(sessionId));
        return isLevel(value) ? value : "off";
      } catch (_error) {
        return "off";
      }
    };
    const saveLevel = (sessionId, level) => {
      try { window.localStorage.setItem(storageKey(sessionId), level); } catch (_error) { /* 隐私模式：静默降级为组件内状态 */ }
    };

    /**
     * 在 list 槽位 conversation.input.right 上落座。
     * order:-100 让本控件排在「追问」按钮（order:-200）之后、模型选择器之前。
     * 任何失败就地吞掉：apply / effect 抛错 = entry failed = 桌面端启动失败。
     */
    function seatControl(ctx, component) {
      try {
        const dispose = ctx.slots.register(
          { name: "conversation.input.right", id: "dsh-ponytail", order: -100, label: "懒散等级" },
          component
        );
        return typeof dispose === "function" ? dispose : () => {};
      } catch (error) {
        console.warn("[dsh-ponytail] 懒散等级下拉落座失败：", error);
        return () => {};
      }
    }

    /** 组件工厂：把 ctx 收进闭包，注册出去的只是组件本身。 */
    function makeControl(ctx) {
      return function PonytailLevelSelect(props) {
        const sessionId = props.sessionId;
        const locked = props.locked === true;

        /* 槽位标准 props：useInput 给当前草稿，inputActions.setDraft 整段改写草稿。 */
        const draft = typeof props.useInput === "function"
          ? (props.useInput((state) => (state ? state.draft : "")) || "")
          : "";
        const actions = props.inputActions;
        const canEditDraft = actions !== undefined && typeof actions.setDraft === "function";

        const [level, setLevel] = react.useState(() => loadLevel(sessionId));
        const [open, setOpen] = react.useState(false);
        const rootRef = react.useRef(null);

        react.useEffect(() => { saveLevel(sessionId, level); }, [sessionId, level]);

        /* 记住「上一份非空草稿」带的 token：发送清空后按它重钉，这样用户手动
         * 把档位词改成 lite 也会被沿用，而不是被下拉里的旧值覆盖。 */
        const lastTokenRef = react.useRef(null);
        const previousDraftRef = react.useRef(draft);
        react.useEffect(() => {
          if (draft !== "") lastTokenRef.current = matchToken(draft);
        }, [draft]);

        /* 草稿被清空后把当前档位重新钉回去（档位是持久模式，发送不该把它关掉）。
         *
         * 但有两种清空**必须不重钉**，否则会表现成"关不掉"：
         *   1. 用户刚在下拉里选了「关闭」—— 那条路径自己会清 lastTokenRef；
         *   2. 上一份草稿里只有手势 token、没有正文 —— 说明是用户手动把 token 删了，
         *      而不是发了一条消息。这种情况一并视为关闭，保证
         *      「下拉显示什么，草稿里就真有什么」。
         *      注意"只有 token"要连同**别的插件的手势 token** 一起看：草稿是
         *      `/grill-me /ponytail-ultra ` 时同样是"没有正文"，不能因为多了
         *      `/grill-me` 就误判成"用户发了一条消息"。 */
        react.useEffect(() => {
          const previous = previousDraftRef.current;
          previousDraftRef.current = draft;
          if (!sessionId || !canEditDraft) return;
          if (draft !== "" || previous === "") return;
          if (matchToken(previous) !== null && hasOnlyGestureTokens(previous)) {
            lastTokenRef.current = null;
            setLevel("off");
            return;
          }
          const next = lastTokenRef.current || level;
          if (next === "off") return;
          actions.setDraft(tokenFor(next) + " ");
          if (next !== level) setLevel(next);
        }, [sessionId, draft, level, canEditDraft]);

        // 外点关闭，与官方菜单一致。
        react.useEffect(() => {
          if (!open) return undefined;
          const onDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
          };
          document.addEventListener("mousedown", onDown);
          return () => document.removeEventListener("mousedown", onDown);
        }, [open]);

        /* 下拉显示的口径 = 草稿里真实存在的 token 优先，其次是存下来的档位。
         * 用户手动把 token 打回草稿时，下拉会跟着亮，不会出现"显示关闭但实际开着"。 */
        const shown = matchToken(draft) || level;
        const current = OPTIONS.filter((option) => option.value === shown)[0] || OPTIONS[0];
        const isOn = shown !== "off";

        const choose = (value) => {
          setOpen(false);
          if (!sessionId) return;
          setLevel(value);
          if (value === "off") {
            /* 显式关闭要把"记住的 token"一起清掉：草稿被摘空之后重钉逻辑会读它，
             * 不清就会拿上一次的档位把 /ponytail <档位> 又写回去 —— 点关闭没反应。 */
            lastTokenRef.current = null;
            if (canEditDraft && matchToken(draft) !== null) actions.setDraft(stripToken(draft));
            return;
          }
          if (!canEditDraft) return;
          /* 已经有 token 就**原地替换**：草稿里可能还有 `/grill-me`（追问按钮前插的），
           * 前插新 token 会把旧的留在后面 —— 两个 ponytail token 都会被宿主注入，
           * 表现成"多个档位同时生效"。没有 token 时才钉到最前面。 */
          if (matchToken(draft) !== null) {
            actions.setDraft(replaceToken(draft, tokenFor(value)));
            return;
          }
          actions.setDraft(draft === "" ? tokenFor(value) + " " : tokenFor(value) + " " + draft);
        };

        const title = isOn
          ? "懒散等级：" + current.label + "（发送时会带上 /ponytail " + shown + "）"
          : "懒散等级：关闭（不启用 ponytail）";

        return react.createElement("div", { ref: rootRef, className: "dpi-root" },
          react.createElement("button", {
            type: "button",
            className: "dpi-trigger" + (isOn ? " is-on" : " is-off"),
            "aria-haspopup": "menu",
            "aria-expanded": open,
            title,
            disabled: locked || !sessionId,
            onClick: () => setOpen((value) => !value),
          },
            react.createElement("span", { className: "dpi-triggerLabel" }, "懒散等级"),
            react.createElement("span", { className: "dpi-triggerValue" }, current.label),
            react.createElement("span", { className: "dpi-chevron" + (open ? " dpi-chevronOpen" : "") }, chevron())
          ),
          open && react.createElement("div", { className: "dpi-menu", role: "menu", "aria-label": "懒散等级" },
            react.createElement("div", { className: "dpi-label" }, "ponytail 强度"),
            OPTIONS.map((option) => react.createElement("button", {
              key: option.value,
              type: "button",
              role: "menuitemradio",
              "aria-checked": shown === option.value,
              className: "dpi-option",
              onClick: () => choose(option.value),
            },
              react.createElement("span", { className: "dpi-optionCopy" }, option.label),
              react.createElement("span", { className: "dpi-check" }, shown === option.value ? check : null)
            ))
          )
        );
      };
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.input.right", () => seatControl(ctx, makeControl(ctx)));
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
