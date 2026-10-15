import { describe, expect, it } from "bun:test";
import { buildRuleFromMarkdown, createSourceMeta } from "@oh-my-pi/pi-coding-agent/discovery/helpers";
import { TtsrManager, type TtsrMatchContext } from "@oh-my-pi/pi-coding-agent/export/ttsr";
import checkedBoundaries from "../../src/discovery/builtin-rules/zig-checked-boundaries.md" with { type: "text" };
import cleanupGuards from "../../src/discovery/builtin-rules/zig-cleanup-guards.md" with { type: "text" };
import errorContract from "../../src/discovery/builtin-rules/zig-error-contract.md" with { type: "text" };

const SOURCES = {
	"zig-checked-boundaries": checkedBoundaries,
	"zig-cleanup-guards": cleanupGuards,
	"zig-error-contract": errorContract,
};
type RuleName = keyof typeof SOURCES;
const ZIG_WRITE: TtsrMatchContext = { source: "tool", toolName: "write", filePaths: ["src/main.zig"] };

function managerFor(...names: RuleName[]): TtsrManager {
	const manager = new TtsrManager();
	for (const name of names.length > 0 ? names : (Object.keys(SOURCES) as RuleName[])) {
		const path = `builtin://${name}.md`;
		const source = createSourceMeta("builtin-defaults", path, "user");
		const rule = buildRuleFromMarkdown(name, SOURCES[name], path, source);
		expect(manager.addRule(rule), name).toBe(true);
	}
	return manager;
}

async function match(manager: TtsrManager, source: string, context = ZIG_WRITE): Promise<string[]> {
	manager.resetBuffer();
	const regexMatches = manager.checkSnapshot(source, context);
	const astMatches = await manager.checkAstSnapshot(source, context);
	return [...new Set([...regexMatches, ...astMatches].map(rule => rule.name))].sort();
}

describe("portable Zig boundary, error-contract, and cleanup guidance", () => {
	it("reviews representation casts, including legitimate casts, without treating @as as unsafe", async () => {
		const manager = managerFor("zig-checked-boundaries");
		for (const source of [
			"const node: *Node = @ptrCast(raw);",
			"const aligned: *align(8) u8 = @alignCast(raw);",
			"const mutable = @constCast(bytes);",
			"const tag: Tag = @enumFromInt(raw_tag);",
			"const device: *volatile u32 = @ptrFromInt(device_address);",
			"const address = @intFromPtr(pointer);",
			"const bits: u32 = @bitCast(value);",
			"const low: u8 = @truncate(word);",
			"const pointer: *Node = @ptrCast\n    (raw);",
		]) {
			expect(await match(manager, source), source).toEqual(["zig-checked-boundaries"]);
		}
		for (const source of [
			"const n = @as(u32, 42);",
			"const widened: u64 = narrow;",
			"const n = try std.fmt.parseInt(u32, text, 10);",
			"const name = ptrCastHelper(raw);",
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
	});

	it("reviews explicit anyerror types, not generic APIs or inferred and concrete error sets", async () => {
		const manager = managerFor("zig-error-contract");
		for (const source of [
			"fn read() anyerror!u8 { return source.readByte(); }",
			"const Callback = *const fn (*anyopaque) anyerror!void;",
			"const Result = anyerror![]u8;",
			"const Failure = anyerror;",
		]) {
			expect(await match(manager, source), source).toEqual(["zig-error-contract"]);
		}
		for (const source of [
			"fn read() !u8 { return source.readByte(); }",
			"const ReadError = error{ InvalidInput, Unavailable }; fn read() ReadError!u8 { return 0; }",
			"fn consume(value: anytype) void { _ = value; }",
			"fn callback(context: *anyopaque) void { _ = context; }",
			"fn identity(comptime T: type, value: T) T { return value; }",
			"const anyerror_name = 1;",
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
	});

	it("matches same-value cleanup guarded only by logical length or count", async () => {
		const manager = managerFor("zig-cleanup-guards");
		for (const source of [
			"if (bytes.len > 0) allocator.free(bytes);",
			"if (bytes.len != 0) { allocator.free(bytes); }",
			"if (self.bytes.len > 0) self.allocator.free(self.bytes);",
			"if (bytes.len > 0) {\n    allocator.free(bytes);\n}",
			"if (list.items.len != 0) list.deinit(allocator);",
			"if (list.items.len > 0) { list.deinit(); }",
			"if (map.count() != 0) map.deinit();",
			"if (self.map.count() > 0) { self.map.deinit(self.allocator); }",
			"if (map.count ( ) != 0)\n    map.deinit(allocator);",
		]) {
			expect(await match(manager, source), source).toEqual(["zig-cleanup-guards"]);
		}
	});

	it("preserves ownership/init guards, different-value cleanup, and branches with extra work", async () => {
		const manager = managerFor("zig-cleanup-guards");
		for (const source of [
			"if (owned) allocator.free(bytes);",
			"if (maybe_bytes) |bytes| allocator.free(bytes);",
			"if (initialized) list.deinit(allocator);",
			"if (bytes.len > 0) { consume(bytes); allocator.free(bytes); }",
			"if (bytes.len > 0) { allocator.free(bytes); bytes = &.{}; }",
			"if (list.items.len != 0) { list.deinit(allocator); notify(); }",
			"if (bytes.len > 0) allocator.free(bytes); else notify();",
			"if (map.count() != 0) { map.deinit(); } else notify();",
			"if (other.len > 0) allocator.free(bytes);",
			"if (other.items.len != 0) list.deinit(allocator);",
			"if (map.count() != 0) other.deinit();",
			"if (bytes.len > 0) consume(bytes);",
			"defer allocator.free(bytes);",
			"defer list.deinit(allocator);",
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
	});

	it("ignores comments, normal/escaped strings, multiline strings, and quoted identifiers", async () => {
		const manager = managerFor();
		for (const source of [
			"// @ptrCast(raw); anyerror!void; if (bytes.len > 0) allocator.free(bytes);",
			"/// @enumFromInt(tag); anyerror!void; if (map.count() != 0) map.deinit();",
			"//! @constCast(bytes); anyerror; if (list.items.len != 0) list.deinit(allocator);",
			"const n = 1; // @alignCast(raw); anyerror; if (bytes.len > 0) allocator.free(bytes);",
			'const text = "@ptrCast(raw); anyerror!void; if (bytes.len > 0) allocator.free(bytes);";',
			'const text = "escaped quote: \\" @bitCast(value); anyerror; if (map.count() != 0) map.deinit();";',
			`const quote = '"'; const text = "@truncate(n); anyerror; if (bytes.len > 0) allocator.free(bytes);";`,
			"const text =\n    \\\\@ptrFromInt(n); anyerror; if (list.items.len != 0) list.deinit();\n;",
			'const @"anyerror" = "@ptrCast(raw)";',
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
	});

	it("still matches real code following quoted text on the same line", async () => {
		const manager = managerFor();
		for (const [source, name] of [
			['const text = "anyerror"; const pointer: *Node = @ptrCast(raw);', "zig-checked-boundaries"],
			['const text = "@ptrCast(raw)"; const Result = anyerror!void;', "zig-error-contract"],
			['const text = "anyerror"; if (bytes.len > 0) allocator.free(bytes);', "zig-cleanup-guards"],
		] as const) {
			expect(await match(manager, source), source).toEqual([name]);
		}
	});

	it("limits all three adapters to Zig edit/write source", async () => {
		const manager = managerFor();
		const source =
			"const pointer: *Node = @ptrCast(raw);\nconst Result = anyerror!void;\nif (bytes.len > 0) allocator.free(bytes);";
		for (const toolName of ["edit", "write"]) {
			expect(await match(manager, source, { ...ZIG_WRITE, toolName })).toEqual(Object.keys(SOURCES).sort());
		}
		for (const context of [
			{ source: "text" },
			{ source: "thinking" },
			{ source: "tool", toolName: "bash", filePaths: ["main.zig"] },
			{ source: "tool", toolName: "read", filePaths: ["main.zig"] },
			{ source: "tool", toolName: "write", filePaths: ["main.ts"] },
			{ source: "tool", toolName: "edit", filePaths: ["notes.md"] },
			{ source: "tool", toolName: "write", filePaths: ["build.zig.zon"] },
			{ source: "tool", toolName: "write", filePaths: ["main.zig.md"] },
		] satisfies TtsrMatchContext[]) {
			expect(await match(manager, source, context), JSON.stringify(context)).toEqual([]);
		}
	});
});
