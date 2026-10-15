---
description: "Prefer Zig range or slice iteration to a simple index-only while loop when semantics are identical"
condition: '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\bwhile[ \t]*\([ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*<[ \t]*(?:[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*|[0-9]+)[ \t]*\)[ \t]*:[ \t]*\([ \t]*\1[ \t]*\+=[ \t]*1[ \t]*\)'
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

For a simple index-only `while (i < end) : (i += 1)`, prefer `for (start..end) |i|` when the range is valid and the behavior is identical. If the index is only used to access a slice, direct `for (items) |item|` iteration is usually clearer; use `for (items, 0..) |item, i|` when both are needed. Pointer captures may be appropriate when intentionally mutating elements; preserve whether the old loop accesses a value or its storage.

For example, `var i: usize = 0; while (i < items.len) : (i += 1) { consume(items[i]); }` can become `for (items) |item| { consume(item); }` when neither the index nor slice length is changed or needed afterward. A stable, valid interval can similarly use `for (start..end) |i| { consume(i); }`.

Before converting, inspect the initializer, body, bounds, captures, and all exits. Keep `while` when the body changes the index or bound, appends/reslices the collection, reevaluates a dynamic bound each iteration, searches for a sentinel, uses a non-unit step, or otherwise has stateful control. A plain bound variable can still change through a call or alias; the spelling alone does not prove stability. Keep it when the final index is used after the loop or its integer type matters. In particular, a signed index or one wider than `usize` is not automatically equivalent to a Zig range capture.

Do not assume `start <= end`: a `while` with `start > end` can be empty, whereas a descending range is not the same operation. Preserve overflow/trapping or explicit wrapping arithmetic, unsigned endpoint behavior, labeled `break`/`continue` targets, continue-expression effects, and loop `else` behavior. Do not remove these semantics or insert a guard merely to force a range conversion. If equivalence is uncertain, keep the explicit loop.

The trigger is intentionally limited to a simple less-than condition and matching `index += 1` continue expression with an identifier, field, or integer bound. It excludes call-valued bounds, descending/stepped/wrapping loops, and different index variables. It is a contextual review, not proof that the body leaves the index and bound unchanged.

Adapted from the bundled `go-range-int` readability principle, not Go's version or integer-range syntax. Official reference: [Zig 0.16.0 for](https://ziglang.org/documentation/0.16.0/#for) and [while](https://ziglang.org/documentation/0.16.0/#while).
