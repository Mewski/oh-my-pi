---
description: "Do not use logical length or element count as an ownership guard for Zig cleanup"
condition:
  - '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\bif[ \t]*\([ \t]*(?<slice>[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.len[ \t]*(?:>[ \t]*0|!=[ \t]*0)[ \t]*\)[ \t\r\n]*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\.free[ \t]*\([ \t]*\k<slice>[ \t]*\)[ \t]*;(?![ \t\r\n]*else\b)'
  - '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\bif[ \t]*\([ \t]*(?<slice>[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.len[ \t]*(?:>[ \t]*0|!=[ \t]*0)[ \t]*\)[ \t\r\n]*\{[ \t\r\n]*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\.free[ \t]*\([ \t]*\k<slice>[ \t]*\)[ \t]*;[ \t\r\n]*\}(?![ \t\r\n]*else\b)'
  - '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\bif[ \t]*\([ \t]*(?<list>[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.(?:items\.len|count[ \t]*\([ \t]*\))[ \t]*(?:>[ \t]*0|!=[ \t]*0)[ \t]*\)[ \t\r\n]*\k<list>\.deinit[ \t]*\([ \t]*(?:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)?[ \t]*\)[ \t]*;(?![ \t\r\n]*else\b)'
  - '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\bif[ \t]*\([ \t]*(?<list>[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.(?:items\.len|count[ \t]*\([ \t]*\))[ \t]*(?:>[ \t]*0|!=[ \t]*0)[ \t]*\)[ \t\r\n]*\{[ \t\r\n]*\k<list>\.deinit[ \t]*\([ \t]*(?:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)?[ \t]*\)[ \t]*;[ \t\r\n]*\}(?![ \t\r\n]*else\b)'
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

Review cleanup guarded only by the cleaned-up value's logical length or element count. For a valid allocator-owned slice, `allocator.free(slice)` accepts an empty slice; a length check is not needed to make that cleanup safe. A container with zero items or entries can still retain allocated capacity, so skipping its `deinit` based on `items.len` or `count()` can leak resources.

Tie cleanup to ownership and lifetime, normally with `defer` after successful acquisition/initialization and `errdefer` while ownership transfers only on success:

```zig
const bytes = try allocator.alloc(u8, size);
defer allocator.free(bytes);

var list: std.ArrayList(u8) = .empty;
defer list.deinit(allocator);
```

Use the container API appropriate to the project's compiler and container type; some `deinit` methods store the allocator and take no argument. Do not introduce a version migration as part of removing a redundant guard.

Keep real ownership, optional-value, and initialization guards. An arbitrary borrowed slice must not be freed merely because it is empty, and an uninitialized or already-deinitialized container must not be deinitialized. If an existing length check encodes an ownership convention, establish that ownership explicitly before changing cleanup; do not blindly remove it. Preserve branches with additional work or an `else` path, and preserve any required element-level destruction separately from container-storage cleanup.

The trigger deliberately covers simple same-value length/count guards whose body is only `free` or `deinit`; it is not a general ownership analysis or a ban on null/optional checks.

Official references: [Zig 0.16.0 defer](https://ziglang.org/documentation/0.16.0/#defer), [errdefer](https://ziglang.org/documentation/0.16.0/#errdefer), and [the versioned standard library](https://ziglang.org/documentation/0.16.0/std/). Check the matching compiler's `mem.Allocator.free` and the actual container's `deinit` contract.
