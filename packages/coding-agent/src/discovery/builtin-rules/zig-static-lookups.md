---
description: "Use allocation-free fixed Zig lookups when the complete key set is known at compile time"
astCondition:
  - "std.StringHashMap"
  - "std.StringHashMapUnmanaged"
  - "std.AutoHashMap"
  - "std.AutoHashMapUnmanaged"
  - "std.HashMap"
  - "std.HashMapUnmanaged"
scope: "tool:edit(*.zig), tool:write(*.zig)"
interruptMode: never
---

When reviewing a runtime hash map, first ask whether its keys really are dynamic. If all keys and values are fixed at compile time, avoid allocating and populating a runtime map solely to reconstruct that table. Prefer the project's existing `std.StaticStringMap` pattern for a fixed string-keyed table, an enum-indexed array or existing enum-array helper for a suitable enum domain, or ordinary struct fields for a fixed record. For a tiny set, a simple comparison or `switch` may already be clearest. No new dependency is needed.

For example, a fixed mapping from the strings `"text"`, `"json"`, and `"binary"` to format tags can use the supported static string-map initializer instead of inserting the same literals into a new runtime `StringHashMap` each time. A complete dense enum domain can use an array indexed by `@intFromEnum` only when the tags, bounds, and holes make that representation valid. Use existing repository conventions rather than inventing a second lookup abstraction.

Preserve dynamic maps for runtime-discovered keys, insertion/deletion, unknown cardinality, custom equality/hashing, or values whose lifecycle requires mutable runtime storage. Compile-time-known keys alone do not prove that values can be compile-time constants. A fixed key set with runtime values may fit fields or an enum-indexed array, but retain the map when those representations would change its contract or complicate ownership. Do not change key equality, iteration/order expectations, pointer stability requirements, or allocation ownership while simplifying a lookup.

The trigger identifies concrete standard-library hash-map references as review points; it cannot establish that a table is static and does not ban legitimate dynamic maps. `StaticStringMap` availability and initializer APIs vary across compiler versions. Follow the pinned compiler's stdlib and existing project code, not a blind rename from an older map API; keep a correct supported implementation if no suitable static alternative exists.

Adapted from the bundled `ts-set-map` distinction between fixed records and dynamic maps. Official reference: the project's versioned [Zig 0.16.0 standard-library reference](https://ziglang.org/documentation/0.16.0/std/) for string maps, enums, and hash maps.
