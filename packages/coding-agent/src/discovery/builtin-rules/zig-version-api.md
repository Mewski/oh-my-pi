---
description: "Check the project's pinned Zig version before choosing build and standard-library APIs"
condition: '(?m)^[ \t]*\.minimum_zig_version[ \t]*=[ \t]*"'
astCondition:
  - "std.Build"
  - "*std.Build"
  - "*const std.Build"
  - "std.ArrayList"
  - "std.Io"
  - "std.io"
  - "std.heap.GeneralPurposeAllocator"
  - "std.heap.DebugAllocator"
  - "std.heap.SafeAllocator"
  - "std.fmt.allocPrint"
  - "std.zon.parse"
scope: "tool:edit(*.zig), tool:write(*.zig), tool:edit(build.zig.zon), tool:write(build.zig.zon)"
interruptMode: never
---

Before introducing or changing a version-sensitive Zig build/stdlib API, establish the project's supported compiler version from its toolchain pin, CI, and existing build files. Check `zig version` for the compiler actually being used. A `build.zig.zon` `minimum_zig_version` is a lower bound, not an exact toolchain pin or proof of compatibility with every newer release.

Use the standard library shipped with that compiler (`zig std` or its `lib/std` source), matching versioned language documentation, and the project's existing conventions. Do not combine examples from different Zig releases or master. If multiple compiler versions are supported, preserve that contract rather than silently raising the minimum.

Version context: the linked Zig 0.17.0 release notes illustrate changes to the build system, ArrayList, allocation formatting, and ZON parsing; older pinned projects remain valid. This is a prompt to check compatibility, NOT an instruction to migrate to 0.17.0, replace every older API, or add version-detection machinery. Keep an older API when it is correct for the supported compiler; only migrate when the project is deliberately upgrading.

Official references: [versioned 0.16.0 documentation](https://ziglang.org/documentation/0.16.0/), [versioned 0.17.0 documentation](https://ziglang.org/documentation/0.17.0/), [0.17.0 release notes](https://ziglang.org/download/0.17.0/release-notes.html), and [release index](https://ziglang.org/download/index.json). Substitute the project's actual version in documentation URLs.
