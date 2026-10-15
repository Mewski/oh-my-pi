---
description: "Review explicit anyerror contracts for useful error-set precision without banning intentional type erasure"
condition: '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\banyerror\b'
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

Review whether this explicit `anyerror` accurately describes the boundary. It admits every error value and can hide a useful, narrower error contract from callers; its presence alone is not a defect.

For an internal function whose implementation determines its errors, prefer an inferred error union (`!T`) when that fits Zig's inference rules and existing project conventions. For a public API intended to promise a stable set of failures, consider a concrete named set (`pub const ReadError = error{ InvalidInput, Unavailable };`, then `ReadError!T`) or an appropriate union of existing error sets. Keep every error the implementation can actually propagate; do not hide unexpected failures with `catch unreachable`, arbitrary success values, or unchecked narrowing just to make a small set compile.

Keep `anyerror` when it is the real contract: type-erased callbacks or function pointers, dynamic dispatch across implementations with different error sets, broad forwarding interfaces, or deliberately forward-compatible public boundaries. Inferred error sets are not a universal replacement, particularly where recursive inference or function-pointer compatibility requires an explicit type. Tightening a public error set can change source compatibility and exhaustive handling; preserve the API's intended evolution contract.

`anyerror` is an error-set choice, not a reason to ban `anytype`, `anyopaque`, or generic/comptime APIs. Preserve legitimate generic and opaque-pointer abstractions; use precise types only where they express an actual guarantee rather than adding wrapper machinery.

Official reference: [Zig 0.16.0 error sets](https://ziglang.org/documentation/0.16.0/#Error-Set-Type), [error unions](https://ziglang.org/documentation/0.16.0/#Error-Union-Type), and [inferred error sets](https://ziglang.org/documentation/0.16.0/#Inferred-Error-Sets). Consult the version matching the project's compiler.
