---
description: "Complete owned Zig refactors instead of leaving deprecated aliases or compatibility wrappers"
condition: '(?im)^[ \t]*(?:///|//!)[^\n]*(?:@deprecated\b|\bdeprecated\b)'
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

An explicit deprecation doc comment is a cutover review point, not proof that the declaration should be deleted. When refactoring an API whose callers you control, migrate every owned caller, import, test, and example to the durable name, then delete the obsolete alias or forwarding wrapper in the same change. Do not add `/// Deprecated: use newName` merely to avoid finishing that migration. Ordinary `pub const Alias = Type` declarations are idiomatic Zig and are not inherently compatibility debt.

For example, after renaming `loadConfig` to `loadSettings`, update owned callers and remove both `/// Deprecated: use loadSettings` and `pub const loadConfig = loadSettings`; do not maintain two contracts without a compatibility requirement. Do not remove only the doc marker while retaining the obsolete path.

Preserve documented public API migration windows, upstream bindings that must reflect an external contract, tests of a supported transition, and compiler-version compatibility branches for every version the project still supports. Do not collapse a version-gated path just because the newest compiler no longer needs it. Name the supported consumers or migration window when keeping a shim; remove it only when that requirement actually ends.

This trigger intentionally reads `///` and `//!` deprecation documentation, unlike the code-oriented Zig rules that ignore comments. An incidental code-looking string, ordinary comment, or non-deprecation doc comment is not a trigger. Zig has no universal compiler-enforced `@deprecated` attribute: this is a documentation convention, not an instruction to invent an annotation.

Adapted from the bundled `ts-no-deprecated-leftovers` ownership/cutover principle. Official reference: [Zig 0.16.0 documentation comments](https://ziglang.org/documentation/0.16.0/#Doc-Comments). Use the project's supported compiler and public compatibility policy.
