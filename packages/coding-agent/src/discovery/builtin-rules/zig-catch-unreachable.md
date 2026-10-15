---
description: "Require evidence before treating a Zig error as unreachable"
condition: '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\bcatch[ \t]+unreachable\b'
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

Review this `catch unreachable`: it asserts that the error path is impossible, not merely inconvenient. A reachable `unreachable` is illegal behavior; with runtime safety it normally panics, and without safety it is not a reliable crash policy.

For fallible allocation, I/O, parsing of external input, or other recoverable work, propagate with `try` when the function's contract permits, or handle the relevant errors explicitly with `catch`/`switch`. Preserve cleanup on every exit path with `defer` and, when ownership transfers only on success, `errdefer`. Do not replace error handling with an arbitrary success value.

`catch unreachable` IS legitimate when a concrete invariant excludes every error in the expression's error set. For example, parsing a known-valid literal can be infallible. Preserve such code when the invariant is established by the input, API contract, or preceding checks; explain the proof if it is not evident. Merely expecting allocation or I/O to succeed is not a proof. If the application deliberately terminates on failure, use its explicit fatal-error policy rather than claiming the failure cannot occur.

Official references: [Zig 0.16.0 error handling and invariant example](https://ziglang.org/documentation/0.16.0/#Error-Union-Type), [errdefer](https://ziglang.org/documentation/0.16.0/#errdefer), and [illegal behavior](https://ziglang.org/documentation/0.16.0/#Illegal-Behavior). Consult the matching documentation for the project's compiler version.
