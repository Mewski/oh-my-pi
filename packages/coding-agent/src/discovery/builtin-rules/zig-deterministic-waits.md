---
description: "In Zig tests, prefer deterministic time or readiness signals to guessed wall-clock sleeps"
astCondition:
  - "std.Thread.sleep"
  - "std.time.sleep"
  - "std.Io.sleep"
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

Review a standard-library sleep in its actual context. In a unit test, a fixed sleep used to guess that a worker, timeout, or debounce has finished adds real latency and hides races. Prefer the operation's completion/readiness signal, a condition variable or channel with a predicate, or an already-supported injected clock/`Io` implementation that can advance deterministically. Keep synchronization correct: observe the predicate under its required synchronization rather than replacing a sleep with an unsynchronized busy loop. For timeout arithmetic, pass explicit timestamps through the existing seam instead of waiting for the wall clock.

Zig embeds `test` blocks in ordinary `.zig` modules, so a `*_test.zig`-only scope would miss most tests. This rule therefore conservatively reviews the concrete standard-library sleep references in all edited/written Zig source, then applies the no-guessed-waits guidance only when inspecting test behavior. A match in production code is not a request to delete its timing behavior. It deliberately does not match an arbitrary method named `sleep`, and does not claim to recognize every alias or prove that a call is inside a test.

Production rate limiting, pacing, retry backoff, and scheduler behavior can require real waits. A timeout or watchdog raced against an independently awaited completion is a safety bound, not a guessed synchronization delay; preserve that bound and its cancellation/cleanup contract. Integration tests explicitly measuring real clock, scheduler, or platform timing behavior can also require waits. Do not replace timing semantics with an immediate no-op, remove a timeout that prevents a test from hanging, add a new clock framework or dependency, or recommend JavaScript fake timers for Zig. Follow the project's conventions when explaining why real timing is required.

`std.Thread.sleep`, `std.time.sleep`, and `std.Io.sleep` are version-dependent review spellings, not a migration sequence or a claim that they coexist. Use the API and supported injection facilities from the project's pinned Zig standard library; an available `Io` value is not automatically a virtual clock.

Adapted from the bundled `ts-no-test-timers` deterministic-waits principle. Official reference: [Zig 0.16.0 tests](https://ziglang.org/documentation/0.16.0/#Zig-Test) and the project's versioned [standard-library reference](https://ziglang.org/documentation/0.16.0/std/).
