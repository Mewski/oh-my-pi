import { describe, expect, it } from "bun:test";
import { buildRuleFromMarkdown, createSourceMeta } from "@oh-my-pi/pi-coding-agent/discovery/helpers";
import { TtsrManager, type TtsrMatchContext } from "@oh-my-pi/pi-coding-agent/export/ttsr";
import deterministicWaits from "../../src/discovery/builtin-rules/zig-deterministic-waits.md" with { type: "text" };
import noDeprecatedLeftovers from "../../src/discovery/builtin-rules/zig-no-deprecated-leftovers.md" with { type: "text" };
import noTinyFunctions from "../../src/discovery/builtin-rules/zig-no-tiny-functions.md" with { type: "text" };
import rangeLoops from "../../src/discovery/builtin-rules/zig-range-loops.md" with { type: "text" };
import staticLookups from "../../src/discovery/builtin-rules/zig-static-lookups.md" with { type: "text" };

const sources = {
	"zig-no-deprecated-leftovers": noDeprecatedLeftovers,
	"zig-no-tiny-functions": noTinyFunctions,
	"zig-deterministic-waits": deterministicWaits,
	"zig-static-lookups": staticLookups,
	"zig-range-loops": rangeLoops,
};
type RuleName = keyof typeof sources;
const ZIG_WRITE: TtsrMatchContext = { source: "tool", toolName: "write", filePaths: ["src/module.zig"] };

function managerFor(...names: RuleName[]): TtsrManager {
	const manager = new TtsrManager();
	for (const name of names) {
		const path = `builtin-rules/${name}.md`;
		const rule = buildRuleFromMarkdown(name, sources[name], path, createSourceMeta("test", path, "project"));
		expect(manager.addRule(rule), name).toBe(true);
	}
	return manager;
}

async function matches(manager: TtsrManager, source: string, context = ZIG_WRITE): Promise<string[]> {
	manager.resetBuffer();
	const regex = manager.checkSnapshot(source, context);
	const ast = await manager.checkAstSnapshot(source, context);
	return [...new Set([...regex, ...ast].map(rule => rule.name))].sort();
}

describe("bundled Zig readable-style rules", () => {
	it("reviews explicit deprecated documentation rather than banning ordinary aliases", async () => {
		const name = "zig-no-deprecated-leftovers";
		const manager = managerFor(name);
		for (const source of [
			"/// Deprecated: use loadSettings.\npub const loadConfig = loadSettings;",
			"    /// @deprecated Use open instead.\n    pub const oldOpen = open;",
			"//! Deprecated module; migrate to settings.\npub const Config = Settings;",
			"/// This compatibility entry is deprecated during the documented public migration window.\npub const old = current;",
		]) {
			expect(await matches(manager, source), source).toEqual([name]);
		}
		for (const source of [
			"pub const Allocator = std.mem.Allocator;",
			"/// Loads settings from disk.\npub const loadSettings = settings.load;",
			"// Deprecated code was removed in the preceding change.\npub const current = load;",
			'const text = "/// @deprecated Use newName";',
			"const text =\n    \\\\/// Deprecated: use newName\n;",
			'const selected = if (@hasDecl(std, "Io")) modern else legacy;',
		]) {
			expect(await matches(manager, source), source).toEqual([]);
		}
	});

	it("reviews simple return wrappers while leaving multi-step and type-construction bodies alone", async () => {
		const name = "zig-no-tiny-functions";
		const manager = managerFor(name);
		for (const source of [
			"fn double(n: u32) u32 { return n * 2; }",
			"fn name(user: User) []const u8 {\n    return user.profile.name;\n}",
			"fn forward(value: Value) !Value { return try service(value); }",
			// Public/domain contracts and generic return-type factories are contextual exceptions,
			// not something the syntactic trigger can reject automatically.
			"pub fn raw(self: Id) u32 { return self.value; }",
			"fn Scalar(comptime T: type) type { return T; }",
		]) {
			expect(await matches(manager, source), source).toEqual([name]);
		}
		for (const source of [
			"fn parse(text: []const u8) !Value { const parsed = try decode(text); return validate(parsed); }",
			"fn Container(comptime T: type) type { return struct { value: T }; }",
			"fn notify(ctx: *anyopaque) callconv(.c) void { dispatch(ctx); }",
			"const doubled = n * 2;",
		]) {
			expect(await matches(manager, source), source).toEqual([]);
		}
	});

	it("finds standard sleep references in embedded tests without assuming all Zig files are tests", async () => {
		const name = "zig-deterministic-waits";
		const manager = managerFor(name);
		for (const source of [
			'test "worker completes" { std.Thread.sleep(1_000_000); }',
			'test "worker completes" { std.time.sleep(1_000_000); }',
			'test "worker completes" { try std.Io.sleep(io, duration, .awake); }',
			// Production pacing is intentionally reviewed, not declared invalid.
			"fn pace() void { std.Thread.sleep(delay); }",
		]) {
			for (const path of ["src/module.zig", "test/timing_test.zig"]) {
				expect(await matches(manager, source, { ...ZIG_WRITE, filePaths: [path] }), source).toEqual([name]);
			}
		}
		for (const source of [
			'test "worker completes" { try worker.wait(); }',
			'test "timeout" { clock.advance(duration); }',
			'test "ready" { while (!ready) condition.wait(&mutex); }',
			"fn pace(io: anytype) !void { try io.sleep(duration); }",
		]) {
			expect(await matches(manager, source), source).toEqual([]);
		}
	});

	it("reviews runtime hash-map families but not existing static or enum-indexed lookups", async () => {
		const name = "zig-static-lookups";
		const manager = managerFor(name);
		for (const source of [
			"var map = std.StringHashMap(u8).init(allocator);",
			"var map: std.StringHashMapUnmanaged(u8) = .empty;",
			"var map = std.AutoHashMap(u32, Value).init(allocator);",
			"var map: std.AutoHashMapUnmanaged(u32, Value) = .empty;",
			"const Map = std.HashMap(Key, Value, Context, 80);",
			"const Map = std.HashMapUnmanaged(Key, Value, Context, 80);",
			// Dynamic keys remain legitimate: this is a contextual static-table review.
			"var seen = std.StringHashMap(void).init(allocator); for (args) |arg| { try seen.put(arg, {}); }",
		]) {
			expect(await matches(manager, source), source).toEqual([name]);
		}
		for (const source of [
			'const formats = std.StaticStringMap(Format).initComptime(.{ .{ "text", .text }, .{ "json", .json } });',
			'const names = [_][]const u8{ "text", "json" }; const name = names[@intFromEnum(kind)];',
			'const labels = .{ .text = "Text", .json = "JSON" };',
			"const Map = project.HashMap(Key, Value);",
		]) {
			expect(await matches(manager, source), source).toEqual([]);
		}
	});

	it("recognizes matching unit-step index loops, not descending, dynamic-call, or mismatched loops", async () => {
		const name = "zig-range-loops";
		const manager = managerFor(name);
		for (const source of [
			"var i: usize = 0; while (i < n) : (i += 1) { consume(i); }",
			"while (index < items.len) : (index += 1) { consume(items[index]); }",
			"while (i < 10) : (i += 1) { consume(i); }",
			// These require keeping while after body/use review; the trigger cannot prove equivalence.
			"while (i < n) : (i += 1) { if (skip()) i += 1; }",
			"while (i < n) : (i += 1) { n = refresh(); }",
		]) {
			expect(await matches(manager, source), source).toEqual([name]);
		}
		for (const source of [
			"for (0..n) |i| { consume(i); }",
			"for (items) |item| { consume(item); }",
			"while (i < end()) : (i += 1) { consume(i); }",
			"while (i <= n) : (i += 1) { consume(i); }",
			"while (i < n) : (i += 2) { consume(i); }",
			"while (i > 0) : (i -= 1) { consume(i); }",
			"while (i < n) : (j += 1) { consume(i); }",
			"while (i < n) : (i +%= 1) { consume(i); }",
			"while (items[i] != 0) : (i += 1) { consume(i); }",
		]) {
			expect(await matches(manager, source), source).toEqual([]);
		}
	});

	it("ignores code-looking comments, strings, characters, and multiline-string contents", async () => {
		const manager = managerFor(...(Object.keys(sources) as RuleName[]));
		const code =
			"fn wrap(n: u32) u32 { return n * 2; } while (i < n) : (i += 1) {} std.Thread.sleep(1); std.StringHashMap(u8);";
		for (const source of [
			`// ${code}`,
			`/// Example: ${code}`,
			`//! Example: ${code}`,
			`const value = 1; // ${code}`,
			`const text = "${code}";`,
			`const text = "escaped quote: \\" ${code}";`,
			`const quote = '"'; const text = "${code}";`,
			`const text =\n    \\\\${code}\n;`,
		]) {
			expect(await matches(manager, source), source).toEqual([]);
		}
		// Lexical skipping must not swallow genuine code after a preceding string/character.
		expect(await matches(managerFor("zig-range-loops"), "const quote = '\"'; while (i < n) : (i += 1) {}")).toEqual([
			"zig-range-loops",
		]);
		expect(
			await matches(
				managerFor("zig-no-tiny-functions"),
				'const text = "fn fake() u8 { return 0; }"; fn real() u8 { return 1; }',
			),
		).toEqual(["zig-no-tiny-functions"]);
	});

	it("limits all five rules to Zig edit/write tool contexts", async () => {
		const snippets: Record<RuleName, string> = {
			"zig-no-deprecated-leftovers": "/// Deprecated: use current.\npub const old = current;",
			"zig-no-tiny-functions": "fn double(n: u32) u32 { return n * 2; }",
			"zig-deterministic-waits": "std.Thread.sleep(1);",
			"zig-static-lookups": "const Map = std.StringHashMap(u8);",
			"zig-range-loops": "while (i < n) : (i += 1) {}",
		};
		for (const name of Object.keys(sources) as RuleName[]) {
			const manager = managerFor(name);
			for (const toolName of ["edit", "write"]) {
				expect(await matches(manager, snippets[name], { ...ZIG_WRITE, toolName }), name).toEqual([name]);
			}
			for (const context of [
				{ ...ZIG_WRITE, toolName: "read" },
				{ ...ZIG_WRITE, toolName: "bash" },
				{ ...ZIG_WRITE, filePaths: ["src/module.ts"] },
				{ ...ZIG_WRITE, filePaths: ["src/module.zig.md"] },
				{ ...ZIG_WRITE, filePaths: ["build.zig.zon"] },
				{ ...ZIG_WRITE, source: "text" as const },
				{ ...ZIG_WRITE, source: "thinking" as const },
			]) {
				expect(await matches(manager, snippets[name], context), `${name}: ${JSON.stringify(context)}`).toEqual([]);
			}
		}
	});
});
