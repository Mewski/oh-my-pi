---
description: "Review Zig representation casts at trust boundaries; casts are not input validation"
condition: '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?@(?:ptrCast|alignCast|constCast|enumFromInt|ptrFromInt|intFromPtr|bitCast|truncate)[ \t\r\n]*\('
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

Review the invariant behind this representation or qualifier conversion. A Zig cast is not a parser or validation of externally controlled data. Validate lengths, ranges, tags, encodings, and domain constraints at the boundary using the project's existing parsing/checking conventions, then pass a precise typed value onward. Do not add a schema library just to perform these checks.

- `@ptrCast` changes the pointer's child type; it does not establish valid storage, sufficient bounds, initialization, alignment, aliasing compatibility, or a lifetime for the pointee. Preserve proven FFI and low-level uses, and make non-obvious layout/ownership assumptions clear near the conversion.
- `@alignCast` asserts alignment and can safety-check it; it does not fix a misaligned address. A safety trap is not recoverable input validation. Establish the required alignment or use a representation/access method appropriate to the actual bytes.
- `@constCast` removes a qualifier; it does not make immutable storage writable or extend its lifetime. Keep it when the underlying storage and the API contract really permit the intended access.
- `@enumFromInt` converts a tag, not an arbitrary protocol value into a validated domain value. For exhaustive enums, reject unknown external tags before conversion; for non-exhaustive enums, preserve unknown-tag handling when the protocol allows it. A valid numeric tag still does not prove other input invariants.
- `@ptrFromInt` / `@intFromPtr` do not manufacture ownership, accessible storage, or a lifetime. Preserve legitimate ABI, memory-mapped I/O, and other established low-level contracts.
- `@bitCast` reinterprets bits, and `@truncate` intentionally discards high bits. Neither proves that the result satisfies a domain constraint. Keep intentional bit-level operations when their representation and range assumptions are established.

These are review triggers, not forbidden builtins or proof that a violation occurred. Ordinary `@as` annotations/coercions are not an unsafe-cast category. Do not replace an idiomatic, justified cast with compulsory allocation, copying, a dependency, or a different API merely to avoid this reminder.

Official reference: [Zig 0.16.0 builtin functions](https://ziglang.org/documentation/0.16.0/#Builtin-Functions) and [illegal behavior](https://ziglang.org/documentation/0.16.0/#Illegal-Behavior). Consult the version matching the project's compiler.
