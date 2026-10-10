---
name: ponytail-lite
description: ponytail 轻量档（lite）。只在用户显式输入 /ponytail-lite 时使用；规则正文与 ponytail 技能完全相同，强度固定在 lite。
disable-model-invocation: true
---

# ponytail — lite 档

这个技能由 `/ponytail-lite` 触发。它交付的指令正文是 `ponytail` 技能的完整规则，
外加一行「本次强度：lite」的前导——正文由插件在加载时拼接，本文件只是入口占位。

规则本身见同目录的 `../ponytail/SKILL.md`。
