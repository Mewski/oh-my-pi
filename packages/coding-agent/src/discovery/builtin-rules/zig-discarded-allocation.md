---
description: "Review discarded Zig allocator results for lost ownership and cleanup"
condition: '(?m)^(?:"(?:\\[^\n]|[^"\\\n])*"|''(?:\\[^\n]|[^''\\\n])*''|[^/"''\\\n]|/(?!/))*?\b_[ \t]*=[ \t]*(?:try[ \t]+)?[A-Za-z_][A-Za-z0-9_.]*[ \t]*\.[ \t]*(?:alloc|allocSentinel|create|dupe|dupeZ|realloc|reallocSentinel)[ \t]*\('
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

An allocation-like result is being discarded. Confirm that this is actually an allocator operation, then identify who owns the returned memory and how long it must remain live. Discarding the only handle from an individually freed allocator usually loses the ability to clean it up. Do not allocate merely to discard the result if the operation is unnecessary.

For memory used locally, keep the result and pair it with `defer allocator.free(slice)` or `defer allocator.destroy(ptr)` as appropriate. For a result transferred to the caller or an owning container, make that ownership explicit, use `errdefer` to release it on later failures before transfer, and let the eventual owner release it on success. Do not add an unconditional defer that frees a returned result before its caller can use it. Check the pinned compiler's contract for `realloc`: preserve the original allocation on failure and keep the returned handle on success.

This is not a blanket requirement to free every allocation individually. An arena, region, or custom allocator may own allocations collectively and reclaim them through its documented `deinit` or reset contract; verify that the owning scope performs that cleanup and that no pointers escape past it. Tests of whole-allocator teardown can intentionally discard handles to verify bulk reclamation. Do not insert individual frees that defeat the behavior under test. A deliberately process-lifetime allocation or an allocator failure test may also justify discarding the result. Keep these cases when the lifetime and intent are established. An unrelated method named `create`/`alloc` is not automatically a memory leak.

Official references: [Zig 0.16.0 lifetime and ownership](https://ziglang.org/documentation/0.16.0/#Lifetime-and-Ownership), [choosing an allocator, including arenas](https://ziglang.org/documentation/0.16.0/#Choosing-an-Allocator), and [errdefer](https://ziglang.org/documentation/0.16.0/#errdefer). Use allocator APIs from the project's supported compiler version.
