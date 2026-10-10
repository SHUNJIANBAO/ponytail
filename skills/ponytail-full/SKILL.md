---
name: ponytail-full
description: ponytail 标准档（full，上游默认）。只在用户显式输入 /ponytail-full 时使用；规则正文与 ponytail 技能完全相同，强度固定在 full。
disable-model-invocation: true
---

# ponytail — full 档

这个技能由 `/ponytail-full` 触发。它交付的指令正文是 `ponytail` 技能的完整规则，
外加一行「本次强度：full」的前导——正文由插件在加载时拼接，本文件只是入口占位。

规则本身见同目录的 `../ponytail/SKILL.md`。
