---
description: "Review trivial Zig return wrappers for a meaningful contract before adding indirection"
condition: '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\bfn[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*\([^{}\n]*\)[ \t]+[^{}\n]+\{[ \t\r\n]*return[ \t]+(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^;{}"''\n])+;[ \t\r\n]*\}'
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

Review a function whose entire body is one return expression. If it only renames an obvious expression and adds no durable contract or meaningful reuse, keep the expression at the call site instead of forcing readers to jump through a wrapper. For example, a private, single-use `fn double(n: u32) u32 { return n * 2; }` usually adds less clarity than the expression itself. Check all uses before inlining; preserve evaluation order and how many times arguments are evaluated.

Small size is not itself a defect. Keep functions that name a domain invariant or non-obvious formula, centralize behavior reused meaningfully, implement a public interface, supply a required callback ABI or vtable function, or provide an intentional test seam. Zig does not require a trait system to justify a required interface callback. Public accessors and callback adapters can be correct even when the body is one line. Do not inline them merely to silence this review.

Comptime type factories and generic helpers remain idiomatic Zig: `fn List(comptime T: type) type` and `anytype` helpers may need a function boundary for type computation or specialization. Do not flatten those abstractions or introduce allocation or type erasure. For public functions returning an ordinary concrete aggregate, prefer an existing meaningful named return type over an anonymous structural contract when that improves the API; do not force a name onto every generated type or generic result. Zig function signatures require return types: never apply TypeScript advice to omit a compiler-required return type.

The trigger conservatively recognizes simple named functions with a single return expression, not every small function or anonymous aggregate/type-factory body. It cannot decide whether a public or domain contract is valuable; the exceptions above are part of the rule.

Adapted from the bundled `ts-no-tiny-functions` and the named-public-contract aspect of `ts-no-return-type`. Official references: [Zig 0.16.0 functions](https://ziglang.org/documentation/0.16.0/#Functions) and [comptime](https://ziglang.org/documentation/0.16.0/#comptime).
