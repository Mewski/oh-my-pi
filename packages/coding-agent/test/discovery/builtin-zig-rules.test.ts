import { describe, expect, it } from "bun:test";
import { getCapability } from "@oh-my-pi/pi-coding-agent/capability";
import { BUILTIN_DEFAULTS_PROVIDER_ID, type Rule, ruleCapability } from "@oh-my-pi/pi-coding-agent/capability/rule";
import type { LoadContext } from "@oh-my-pi/pi-coding-agent/capability/types";
import "@oh-my-pi/pi-coding-agent/discovery";
import { TtsrManager, type TtsrMatchContext } from "@oh-my-pi/pi-coding-agent/export/ttsr";

const ZIG_WRITE: TtsrMatchContext = { source: "tool", toolName: "write", filePaths: ["src/main.zig"] };

async function zigManager(names?: string[]): Promise<TtsrManager> {
	const provider = getCapability(ruleCapability.id)?.providers.find(p => p.id === BUILTIN_DEFAULTS_PROVIDER_ID);
	if (!provider) throw new Error("builtin-defaults provider missing");
	const ctx: LoadContext = { cwd: "/tmp", home: "/tmp/home", repoRoot: null };
	const result = await (provider.load as (ctx: LoadContext) => Promise<{ items: Rule[] }>)(ctx);
	const manager = new TtsrManager();
	const selected = names ?? [
		"zig-catch-unreachable",
		"zig-discarded-allocation",
		"zig-return-undefined",
		"zig-version-api",
	];
	for (const name of selected) {
		const rule = result.items.find(r => r.name === name);
		if (!rule) throw new Error(`${name} rule missing`);
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

describe("bundled Zig rule matching", () => {
	it("reviews version-sensitive build and stdlib references, including APIs valid on older pins", async () => {
		const manager = await zigManager(["zig-version-api"]);
		for (const source of [
			"pub fn build(b: *std.Build) void { _ = b; }",
			"fn inspect(b: *const std.Build) void { _ = b; }",
			"const Build = std.Build;",
			"const List = std.ArrayList(u8);",
			"const Io = std.Io;",
			"const stdout = std.io.getStdOut();",
			"var gpa = std.heap.GeneralPurposeAllocator(.{}){};",
			"var gpa = std.heap.DebugAllocator(.{}){};",
			"const Allocator = std.heap.SafeAllocator;",
			'const text = try std.fmt.allocPrint(allocator, "{d}", .{42});',
			"const parse = std.zon.parse;",
		]) {
			for (const toolName of ["write", "edit"]) {
				expect(await match(manager, source, { ...ZIG_WRITE, toolName }), source).toEqual(["zig-version-api"]);
			}
		}
		expect(await match(manager, "const same = std.mem.eql(u8, left, right);")).toEqual([]);
	});

	it("reviews the minimum version only in a Zig package manifest, not unrelated ZON data", async () => {
		const manager = await zigManager(["zig-version-api"]);
		const manifest = '.{\n    .minimum_zig_version = "0.14.0",\n}';
		for (const toolName of ["edit", "write"]) {
			expect(
				await match(manager, manifest, { source: "tool", toolName, filePaths: ["project/build.zig.zon"] }),
			).toEqual(["zig-version-api"]);
		}
		for (const path of ["data.zon", "data.zig.zon", "build.zig.zon.md"]) {
			expect(await match(manager, manifest, { ...ZIG_WRITE, filePaths: [path] }), path).toEqual([]);
		}
		expect(
			await match(manager, '.{ .name = .example, .version = "1.0.0" }', {
				...ZIG_WRITE,
				filePaths: ["build.zig.zon"],
			}),
		).toEqual([]);
	});

	it("reviews catch unreachable without treating an invariant literal as automatically wrong", async () => {
		const manager = await zigManager(["zig-catch-unreachable"]);
		for (const source of [
			"const bytes = allocator.alloc(u8, count) catch unreachable;",
			"const n = 1;\nconst file = openFile(path) catch unreachable;\n",
			'const n = parseU64("1234", 10) catch unreachable;',
			"const n = parse() catch\tunreachable;",
		]) {
			expect(await match(manager, source), source).toEqual(["zig-catch-unreachable"]);
		}
		for (const source of [
			"const bytes = try allocator.alloc(u8, count);",
			"const value = parse(input) catch |err| return err;",
			"const value = parse(input) catch return error.InvalidInput;",
			"const value = parse(input) catch 0;",
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
		manager.resetBuffer();
		expect(manager.checkDelta("const value = parse() catch unre", ZIG_WRITE)).toEqual([]);
		expect(manager.checkDelta("achable;", ZIG_WRITE).map(rule => rule.name)).toEqual(["zig-catch-unreachable"]);
	});

	it("reviews discarded allocation handles, not retained or transferred ownership", async () => {
		const manager = await zigManager(["zig-discarded-allocation"]);
		for (const source of [
			"_ = try allocator.alloc(u8, 32);",
			"_ = allocator.create(Node) catch return error.OutOfMemory;",
			'_ = try self.allocator.dupe(u8, "hello");',
			"_ = try gpa.realloc(buffer, 64);",
			"fn f() !void { _ = try allocator.allocSentinel(u8, 8, 0); }",
		]) {
			expect(await match(manager, source), source).toEqual(["zig-discarded-allocation"]);
		}
		for (const source of [
			"const bytes = try allocator.alloc(u8, 32);\ndefer allocator.free(bytes);",
			"return try allocator.dupe(u8, input);",
			"const node = try allocator.create(Node);\nerrdefer allocator.destroy(node);\ntry setup(node);\nreturn node;",
			"var arena = std.heap.ArenaAllocator.init(parent);\ndefer arena.deinit();\nconst allocator = arena.allocator();\nconst bytes = try allocator.alloc(u8, 32);\nuse(bytes);",
			"const bytes = input[0..length];",
			"_ = try service.allocateTask();",
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
	});

	it("reviews direct undefined returns, not fully initialized output buffers", async () => {
		const manager = await zigManager(["zig-return-undefined"]);
		for (const source of ["fn value() u32 { return undefined; }", "fn value() ?u32 {\n    return undefined;\n}"]) {
			expect(await match(manager, source), source).toEqual(["zig-return-undefined"]);
		}
		for (const source of [
			"fn value() u32 { return 0; }",
			"fn value() ?u32 { return null; }",
			"fn value() !u32 { return error.Unavailable; }",
			"fn buffer() [64]u8 { var bytes: [64]u8 = undefined; @memset(&bytes, 0); return bytes; }",
			"fn read(reader: anytype) !void { var bytes: [64]u8 = undefined; const n = try reader.read(&bytes); consume(bytes[0..n]); }",
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
	});

	it("ignores rule-like source inside Zig comments and string literals", async () => {
		const manager = await zigManager();
		for (const source of [
			"// std.ArrayList(u8); _ = try allocator.alloc(u8, 8) catch unreachable; return undefined;",
			"/// std.Build; _ = try allocator.create(Node) catch unreachable; return undefined;",
			"//! std.Io; _ = try allocator.alloc(u8, 8) catch unreachable; return undefined;",
			"const n = 1; // std.ArrayList(u8); _ = try allocator.alloc(u8, 8) catch unreachable; return undefined;",
			'const text = "std.ArrayList(u8); _ = try allocator.alloc(u8, 8) catch unreachable; return undefined;";',
			'const text = "escaped quote: \\" catch unreachable; return undefined;";',
			`const quote = '"'; const text = "catch unreachable; _ = try allocator.alloc(u8, 8);";`,
			"const text =\n    \\\\std.ArrayList(u8); _ = try allocator.alloc(u8, 8) catch unreachable; return undefined;\n;",
		]) {
			expect(await match(manager, source), source).toEqual([]);
		}
		const manifestContext = { ...ZIG_WRITE, filePaths: ["build.zig.zon"] };
		for (const source of [
			'// .minimum_zig_version = "0.17.0",',
			'.{ .text = ".minimum_zig_version = \\\"0.17.0\\\"" }',
		]) {
			expect(await match(manager, source, manifestContext), source).toEqual([]);
		}
	});

	it("excludes prose, reasoning, other tools, and non-Zig source paths", async () => {
		const manager = await zigManager();
		const source =
			"const List = std.ArrayList(u8);\n_ = try allocator.alloc(u8, 8) catch unreachable;\nfn value() u32 { return undefined; }";
		for (const context of [
			{ source: "text" },
			{ source: "thinking" },
			{ source: "tool", toolName: "bash", filePaths: ["main.zig"] },
			{ source: "tool", toolName: "read", filePaths: ["main.zig"] },
			{ source: "tool", toolName: "write", filePaths: ["main.rs"] },
			{ source: "tool", toolName: "edit", filePaths: ["notes.md"] },
			{ source: "tool", toolName: "write", filePaths: ["data.zon"] },
		] satisfies TtsrMatchContext[]) {
			expect(await match(manager, source, context), JSON.stringify(context)).toEqual([]);
		}
	});
});
