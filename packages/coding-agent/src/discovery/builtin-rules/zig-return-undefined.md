---
description: "Do not return undefined as an ordinary Zig success value"
astCondition: "return undefined"
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

Review a direct `return undefined`: it exports an unspecified value to the caller. `undefined` is not zero, null, an error, or a detectable sentinel. The debug fill pattern is an implementation aid, not a value on which code may rely.

If a meaningful result is required, initialize it before returning. If the operation failed or has no result, express that through the function's actual contract, such as an error union, optional, or tagged union, and update its callers accordingly. Do not fabricate a successful value just to satisfy a return type.

Do NOT ban `undefined` initialization generally or zero every buffer. It is valid for an output buffer or partially built aggregate when every subsequently read byte/field is initialized first on every relevant path; use only the initialized prefix after a short read. An intentionally uninitialized-storage API can also be valid if its contract requires the caller to initialize before reading and all callers obey it. Before changing such a return, inspect the result type, API contract, and uses: values with no meaningful runtime payload, such as `void`, do not imply an uninitialized-data bug. Preserve a justified case rather than forcing a blanket rewrite.

Official reference: [Zig 0.16.0 undefined semantics](https://ziglang.org/documentation/0.16.0/#undefined). Consult the corresponding versioned reference for the project's compiler.
