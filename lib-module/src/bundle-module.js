import Ajv from "ajv";
import { parse, printParseErrorCode } from "jsonc-parser";
import { LineCounter, isAlias, isMap, isScalar, isSeq, parseDocument } from "yaml";
var extensionConfig = {
	id: "kubohiroyayamljson",
	slug: "turbowarp-yaml-json",
	name: "TurboWarp YAML/JSON",
	description: "Safely parse or build YAML and JSON data with immutable reporter blocks.",
	author: "Hiroya Kubo",
	license: "MPL-2.0",
	unsandboxed: false,
	docsURI: "https://kubohiroya.github.io/turbowarp-yaml-json/",
	blockIconURI: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3QgeD0iNiIgeT0iOCIgd2lkdGg9IjM2IiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzJGNjM4NiIvPjxwYXRoIGQ9Ik0xMyAzMFYxOGw1IDcgNS03djEyTTMwIDE4djEyTTI2IDMwaDgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4="
};
var numberToken = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;
var invalidNumber = Object.freeze({
	kind: "invalid",
	code: "fixed-number-input-invalid"
});
/**
* Parse a NEW numeric draft according to NP-finite-new-input-v1.
* Never apply this to opening/no-op raw values or use it as an owner validator.
* Keep the validated token so negative zero, precision and exponent spelling survive.
*/
function parseFixedNumberInput(input) {
	if (typeof input === "number") {
		if (!Number.isFinite(input)) return invalidNumber;
		return Object.freeze({
			kind: "valid",
			token: Object.is(input, -0) ? "-0" : String(input),
			value: input
		});
	}
	if (typeof input !== "string") return invalidNumber;
	const token = input.trim();
	if (!numberToken.test(token)) return invalidNumber;
	const value = Number(token);
	return Number.isFinite(value) ? Object.freeze({
		kind: "valid",
		token,
		value
	}) : invalidNumber;
}
var block_editor_fixed_inputs_schema_default = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://kubohiroya.github.io/turbowarp-yaml-json/schemas/block-editor-fixed-inputs.schema.json",
	$defs: {
		"number": {
			"type": "object",
			"properties": { "VALUE": { "type": "number" } },
			"required": ["VALUE"],
			"additionalProperties": true
		},
		"parseText": {
			"type": "object",
			"properties": { "FORMAT": {
				"type": "string",
				"enum": [
					"auto",
					"YAML",
					"JSON"
				]
			} },
			"required": ["FORMAT"],
			"additionalProperties": true
		}
	}
};
var repository$1 = "turbowarp-yaml-json";
/** The owner JSON document is canonical; this selects a primitive field fragment. */
function fixedInputBundle(opcode, argument) {
	const source = {
		repository: repository$1,
		path: "schemas/block-editor-fixed-inputs.schema.json",
		symbol: `#/$defs/${opcode}/properties/${argument}`
	};
	const blocks = block_editor_fixed_inputs_schema_default.$defs;
	return {
		identity: {
			ownerId: repository$1,
			contractId: opcode,
			revision: "fixed-inputs-v1",
			variantId: argument
		},
		dialect: "2020-12",
		root: {
			retrievalUri: block_editor_fixed_inputs_schema_default.$id,
			document: blocks[opcode].properties[argument],
			artifact: {
				role: "canonical-schema",
				source
			}
		},
		resources: [],
		provenance: {
			canonicalSources: [source, {
				repository: repository$1,
				path: "src/extension.ts",
				symbol: opcode
			}],
			generatedFiles: [],
			referenceSchemas: [],
			generationSources: []
		}
	};
}
var extensionId = "kubohiroyayamljson";
var repository = "turbowarp-yaml-json";
var fields = [{
	"opcode": "number",
	"argument": "VALUE",
	"control": "number",
	"choices": [],
	"normalization": "identity",
	"shape": "math_number.NUM",
	"maxBytes": false
}, {
	"opcode": "parseText",
	"argument": "FORMAT",
	"control": "enum",
	"choices": [
		"auto",
		"YAML",
		"JSON"
	],
	"normalization": "parse-format",
	"shape": "direct-field-dropdown",
	"maxBytes": false
}];
function literalString(value) {
	if (typeof value !== "string") throw new TypeError("Expected a string literal.");
	return value;
}
/** Legacy nonempty finite aliases are projections; opening never creates a write. */
function existingFixedNumber(value) {
	if (typeof value !== "string" && typeof value !== "number" || typeof value === "string" && value.trim() === "") throw new TypeError("Unavailable numeric projection.");
	const number = Number(value);
	if (!Number.isFinite(number)) throw new TypeError("Unavailable numeric projection.");
	return number;
}
function normalizeChoice(field, raw) {
	if (field.normalization === "lowercase") return raw.toLowerCase();
	if (field.normalization === "method") return raw.trim().toUpperCase();
	if (field.normalization === "trim") return raw.trim();
	if (field.normalization === "parse-format") {
		const lower = raw.trim().toLowerCase();
		return lower === "json" ? "JSON" : lower === "yaml" ? "YAML" : lower === "auto" ? "auto" : raw;
	}
	return raw;
}
function binding(field) {
	return {
		argument: field.argument,
		schemaBundle: fixedInputBundle(field.opcode, field.argument),
		control: {
			kind: field.control,
			...field.control === "enum" ? { choices: field.choices.map((value) => ({ value })) } : {}
		},
		read(value) {
			return field.control === "number" ? existingFixedNumber(value) : normalizeChoice(field, literalString(value));
		},
		encode(value) {
			if (field.control === "number") {
				const parsed = parseFixedNumberInput(value);
				if (parsed.kind !== "valid") throw new TypeError("Invalid new numeric input.");
				return parsed.token;
			}
			const raw = literalString(value), normalized = normalizeChoice(field, raw);
			if (!field.choices.includes(normalized)) throw new TypeError("Unsupported fixed choice.");
			return field.shape === "menu-shadow" || field.shape === "direct-field-dropdown" ? normalized : raw;
		},
		validateCandidate(value) {
			try {
				if (field.control === "number") {
					const number = existingFixedNumber(value);
					if (field.maxBytes && (!Number.isSafeInteger(Math.trunc(number)) || Math.trunc(number) < 1)) return [{ message: "Invalid named body size." }];
					return [];
				}
				return field.choices.includes(normalizeChoice(field, literalString(value))) ? [] : [{ message: "Unsupported fixed choice." }];
			} catch {
				return [{ message: "Invalid fixed input." }];
			}
		}
	};
}
var fixedInputEditors = [...new Set(fields.map((f) => f.opcode))].map((opcode) => ({
	apiVersion: 1,
	extensionId,
	editorId: `${opcode}-fixed-inputs`,
	opcodes: [`${extensionId}_${opcode}`],
	contractId: `${repository}/${opcode}`,
	contractRevision: "fixed-inputs-v1",
	bindings: fields.filter((field) => field.opcode === opcode).map(binding),
	validationContext: () => ({
		consumerId: repository,
		nowMs: 0,
		settings: null
	})
}));
/** Registration follows the advertised opcode membership and the optional host capability. */
function fixedInputRegistration(scratch) {
	const host = scratch ?? {};
	let active;
	let membership = "";
	const removers = [];
	let stopped = false;
	const clear = () => {
		host.vm?.runtime?.off?.("RUNTIME_DISPOSED", shutdown);
		for (const remove of removers.splice(0).reverse()) remove();
		active = void 0;
		membership = "";
	};
	const shutdown = () => {
		stopped = true;
		clear();
	};
	return {
		ensure(visibleOpcodes) {
			const api = host.gui?.blockEditors;
			const definitions = fixedInputEditors.filter((definition) => definition.opcodes.every((opcode) => visibleOpcodes.includes(opcode)));
			const key = definitions.map((definition) => definition.editorId).join(",");
			if (stopped || api === active && membership === key) return;
			clear();
			if (api?.apiVersion !== 1 || typeof api.registerFixedInputEditor !== "function" || !definitions.length) return;
			try {
				for (const definition of definitions) {
					const remove = api.registerFixedInputEditor.call(api, definition);
					if (typeof remove !== "function") throw new TypeError("Invalid fixed input cleanup.");
					removers.push(remove);
				}
				active = api;
				membership = key;
				host.vm?.runtime?.on?.("RUNTIME_DISPOSED", shutdown);
			} catch (error) {
				clear();
				throw error;
			}
		},
		dispose: shutdown
	};
}
var block_definitions_default = {
	extensionName: "TurboWarp YAML/JSON",
	menus: { "parseFormat": {
		"acceptReporters": false,
		"items": [
			"auto",
			"YAML",
			"JSON"
		]
	} },
	blocks: [
		{
			"opcode": "string",
			"blockType": "REPORTER",
			"text": "string [VALUE]",
			"description": "Creates a string value.",
			"arguments": { "VALUE": {
				"type": "STRING",
				"defaultValue": "sensor"
			} }
		},
		{
			"opcode": "number",
			"blockType": "REPORTER",
			"text": "number [VALUE]",
			"description": "Creates a finite number value.",
			"arguments": { "VALUE": {
				"type": "NUMBER",
				"defaultValue": 21
			} }
		},
		{
			"opcode": "boolean",
			"blockType": "REPORTER",
			"text": "boolean [VALUE]",
			"description": "Creates a boolean value.",
			"arguments": { "VALUE": {
				"type": "BOOLEAN",
				"defaultValue": true
			} }
		},
		{
			"opcode": "nullValue",
			"blockType": "REPORTER",
			"text": "null",
			"description": "Creates a null value.",
			"arguments": {}
		},
		{
			"opcode": "pair",
			"blockType": "REPORTER",
			"text": "pair key [KEY] value [VALUE]",
			"description": "Creates a map key/value pair.",
			"arguments": {
				"KEY": {
					"type": "STRING",
					"defaultValue": "temperature"
				},
				"VALUE": {
					"type": "STRING",
					"defaultValue": "21"
				}
			}
		},
		{
			"opcode": "map",
			"blockType": "REPORTER",
			"text": "map [ENTRIES]",
			"description": "Creates an object/map from pair fragments.",
			"arguments": { "ENTRIES": {
				"type": "STRING",
				"defaultValue": ""
			} }
		},
		{
			"opcode": "sequence",
			"blockType": "REPORTER",
			"text": "sequence [ITEMS]",
			"description": "Creates an array/sequence from item fragments.",
			"arguments": { "ITEMS": {
				"type": "STRING",
				"defaultValue": ""
			} }
		},
		{
			"opcode": "concat",
			"blockType": "REPORTER",
			"text": "[LEFT] followed by [RIGHT]",
			"description": "Combines fragments without mutating either input.",
			"arguments": {
				"LEFT": {
					"type": "STRING",
					"defaultValue": ""
				},
				"RIGHT": {
					"type": "STRING",
					"defaultValue": ""
				}
			}
		},
		{
			"opcode": "renderYaml",
			"blockType": "REPORTER",
			"text": "render YAML [FRAGMENT]",
			"description": "Renders a fragment to YAML text.",
			"arguments": { "FRAGMENT": {
				"type": "STRING",
				"defaultValue": ""
			} }
		},
		{
			"opcode": "renderJson",
			"blockType": "REPORTER",
			"text": "render JSON [FRAGMENT]",
			"description": "Renders a fragment to formatted JSON text.",
			"arguments": { "FRAGMENT": {
				"type": "STRING",
				"defaultValue": ""
			} }
		},
		{
			"opcode": "validateSchema",
			"blockType": "REPORTER",
			"text": "validate JSON Schema [SCHEMA] data [FRAGMENT]",
			"description": "Returns JSON Schema validation details for the built data.",
			"arguments": {
				"SCHEMA": {
					"type": "STRING",
					"defaultValue": "{\"type\":\"object\",\"required\":[\"temperature\"]}"
				},
				"FRAGMENT": {
					"type": "STRING",
					"defaultValue": ""
				}
			}
		},
		{
			"opcode": "isValidSchema",
			"blockType": "BOOLEAN",
			"text": "JSON Schema [SCHEMA] accepts data [FRAGMENT]?",
			"description": "Reports whether the built data passes JSON Schema validation.",
			"arguments": {
				"SCHEMA": {
					"type": "STRING",
					"defaultValue": "{\"type\":\"object\",\"required\":[\"temperature\"]}"
				},
				"FRAGMENT": {
					"type": "STRING",
					"defaultValue": ""
				}
			}
		},
		{
			"opcode": "parseText",
			"blockType": "REPORTER",
			"text": "parse [TEXT] as [FORMAT]",
			"description": "Safely parses the provided YAML or JSON text into a fragment.",
			"arguments": {
				"TEXT": {
					"type": "STRING",
					"defaultValue": "name: sensor"
				},
				"FORMAT": {
					"type": "STRING",
					"defaultValue": "auto",
					"menu": "parseFormat"
				}
			}
		},
		{
			"opcode": "lastParseSucceeded",
			"blockType": "BOOLEAN",
			"text": "last parse succeeded?",
			"description": "Reports whether the most recent parse operation succeeded.",
			"arguments": {}
		},
		{
			"opcode": "lastParseFormat",
			"blockType": "REPORTER",
			"text": "last parse format",
			"description": "Reports the format selected by the most recent parse operation.",
			"arguments": {}
		},
		{
			"opcode": "lastParseDiagnostic",
			"blockType": "REPORTER",
			"text": "last parse diagnostic",
			"description": "Reports the code, location, and message for the most recent parse failure.",
			"arguments": {}
		},
		{
			"opcode": "lastParseLine",
			"blockType": "REPORTER",
			"text": "last parse error line",
			"description": "Reports the one-based line of the most recent parse failure, or zero when unavailable.",
			"arguments": {}
		},
		{
			"opcode": "lastParseColumn",
			"blockType": "REPORTER",
			"text": "last parse error column",
			"description": "Reports the one-based column of the most recent parse failure, or zero when unavailable.",
			"arguments": {}
		}
	]
};
var PARSE_LIMITS = {
	maxInputBytes: 262144,
	maxDepth: 64,
	maxNodes: 5e4,
	maxAliases: 0
};
var empty = { kind: "empty" };
var SIMPLE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/u;
var ajv = new Ajv({
	allErrors: true,
	strict: false
});
function stringValue(value) {
	return {
		kind: "scalar",
		value
	};
}
function numberValue(value) {
	return {
		kind: "scalar",
		value: Number.isFinite(value) ? value : 0
	};
}
function booleanValue(value) {
	return {
		kind: "scalar",
		value
	};
}
function nullValue() {
	return {
		kind: "scalar",
		value: null
	};
}
function pair(key, value) {
	return {
		kind: "pair",
		key,
		value: normalizeContent(value)
	};
}
function map(entries) {
	return {
		kind: "map",
		entries: normalizeEntries(entries)
	};
}
function sequence(items) {
	return {
		kind: "sequence",
		items: normalizeItems(items)
	};
}
function concat(left, right) {
	const children = [...flattenConcat(left), ...flattenConcat(right)].filter((child) => child.kind !== "empty");
	if (children.length === 0) return empty;
	if (children.length === 1) return children[0] ?? empty;
	return {
		kind: "concat",
		children
	};
}
function renderYaml(fragment) {
	return renderYamlValue(toValue(fragment), 0);
}
function renderJson(fragment) {
	return `${JSON.stringify(toValue(fragment), null, 2)}\n`;
}
function toValue(fragment) {
	switch (fragment.kind) {
		case "empty": return null;
		case "scalar": return fragment.value;
		case "pair": return { [fragment.key]: toValue(fragment.value) };
		case "map": return Object.fromEntries(fragment.entries.map((entry) => [entry.key, toValue(entry.value)]));
		case "sequence": return fragment.items.map(toValue);
		case "concat": return mergeTopLevelValues(fragment.children);
	}
}
function validateWithJsonSchema(schemaJson, fragment) {
	let schema;
	try {
		schema = JSON.parse(schemaJson);
	} catch (error) {
		return {
			valid: false,
			errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]
		};
	}
	try {
		const validate = ajv.compile(schema);
		if (validate(toValue(fragment))) return {
			valid: true,
			errors: []
		};
		return {
			valid: false,
			errors: formatAjvErrors(validate.errors ?? [])
		};
	} catch (error) {
		return {
			valid: false,
			errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]
		};
	}
}
function parseData(source, format = "auto") {
	const selectedFormat = resolveFormat(source, format);
	const inputDiagnostic = validateInputSize(source);
	if (inputDiagnostic !== null) return failure(selectedFormat, inputDiagnostic);
	return selectedFormat === "json" ? parseJson(source) : parseYaml(source);
}
function formatValidationResult(result) {
	return result.valid ? "valid" : result.errors.join("\n");
}
function normalizeContent(content) {
	return typeof content === "string" ? stringValue(content) : content;
}
function normalizeEntries(entries) {
	const fragment = normalizeContent(entries);
	if (fragment.kind === "empty") return [];
	if (fragment.kind === "map") return fragment.entries;
	const children = flattenConcat(fragment);
	if (children.every((child) => child.kind === "pair")) return children;
	throw new TypeError("Map entries must be pair fragments.");
}
function normalizeItems(items) {
	const fragment = normalizeContent(items);
	if (fragment.kind === "empty") return [];
	if (fragment.kind === "concat") return fragment.children;
	return [fragment];
}
function flattenConcat(fragment) {
	if (fragment.kind === "concat") return fragment.children.flatMap(flattenConcat);
	return [fragment];
}
function mergeTopLevelValues(children) {
	const values = children.filter((child) => child.kind !== "empty").map(toValue);
	if (values.length === 0) return null;
	if (values.every(isPlainObject)) return Object.assign({}, ...values);
	return values;
}
function renderYamlValue(value, indent) {
	if (isPlainObject(value)) {
		const entries = Object.entries(value);
		if (entries.length === 0) return `${spaces(indent)}{}`;
		return entries.map(([key, entryValue]) => renderValuePair(key, entryValue, indent)).join("\n");
	}
	if (isDataArray(value)) {
		if (value.length === 0) return `${spaces(indent)}[]`;
		return value.map((item) => renderSequenceItem(item, indent)).join("\n");
	}
	return `${spaces(indent)}${renderScalar(value)}`;
}
function renderValuePair(key, value, indent) {
	const prefix = `${spaces(indent)}${renderKey(key)}:`;
	if (!isPlainObject(value) && !isDataArray(value)) return `${prefix} ${renderScalar(value)}`;
	return `${prefix}\n${renderYamlValue(value, indent + 2)}`;
}
function renderSequenceItem(item, indent) {
	const prefix = `${spaces(indent)}-`;
	if (!isPlainObject(item) && !isDataArray(item)) return `${prefix} ${renderScalar(item)}`;
	return `${prefix}\n${renderYamlValue(item, indent + 2)}`;
}
function renderKey(key) {
	return SIMPLE_KEY_PATTERN.test(key) ? key : JSON.stringify(key);
}
function renderScalar(value) {
	if (value === null) return "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	return JSON.stringify(value);
}
function formatAjvErrors(errors) {
	if (errors.length === 0) return ["JSON Schema validation failed."];
	return errors.map((error) => {
		return `${error.instancePath.length > 0 ? error.instancePath : "$"} ${error.message ?? "is invalid"}`;
	});
}
function formatErrorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function parseJson(source) {
	const errors = [];
	const value = parse(source, errors, {
		allowEmptyContent: false,
		allowTrailingComma: false,
		disallowComments: true
	});
	const syntaxError = errors[0];
	if (syntaxError !== void 0) return failure("json", {
		code: "INVALID_JSON",
		message: printParseErrorCode(syntaxError.error),
		...positionAt(source, syntaxError.offset)
	});
	try {
		return {
			success: true,
			format: "json",
			fragment: fragmentFromUnknown(value, { nodes: 0 }, 0),
			diagnostic: null
		};
	} catch (error) {
		if (error instanceof ParseLimitError) return failure("json", error.diagnostic);
		return failure("json", {
			code: "INVALID_JSON_VALUE",
			message: formatErrorMessage(error),
			line: 0,
			column: 0
		});
	}
}
function parseYaml(source) {
	const lineCounter = new LineCounter();
	const document = parseDocument(source, {
		lineCounter,
		prettyErrors: false,
		schema: "core",
		uniqueKeys: true
	});
	const error = document.errors[0];
	if (error !== void 0) {
		const offset = error.pos[0];
		return failure("yaml", {
			code: error.code,
			message: error.message,
			...yamlPosition(lineCounter, offset)
		});
	}
	const warning = document.warnings[0];
	if (warning !== void 0) return failure("yaml", {
		code: warning.code,
		message: warning.message,
		...yamlPosition(lineCounter, warning.pos[0])
	});
	try {
		return {
			success: true,
			format: "yaml",
			fragment: fragmentFromYamlNode(document.contents, { nodes: 0 }, 0, lineCounter),
			diagnostic: null
		};
	} catch (caught) {
		if (caught instanceof ParseLimitError) return failure("yaml", caught.diagnostic);
		return failure("yaml", {
			code: "INVALID_YAML_VALUE",
			message: formatErrorMessage(caught),
			line: 0,
			column: 0
		});
	}
}
function fragmentFromUnknown(value, budget, depth) {
	consumeBudget(budget, depth);
	if (value === null || typeof value === "string" || typeof value === "boolean") return {
		kind: "scalar",
		value
	};
	if (typeof value === "number" && Number.isFinite(value)) return {
		kind: "scalar",
		value
	};
	if (Array.isArray(value)) return {
		kind: "sequence",
		items: value.map((item) => fragmentFromUnknown(item, budget, depth + 1))
	};
	if (typeof value === "object") return {
		kind: "map",
		entries: Object.entries(value).map(([key, item]) => ({
			kind: "pair",
			key,
			value: fragmentFromUnknown(item, budget, depth + 1)
		}))
	};
	throw new TypeError("Parsed data contains an unsupported value.");
}
function fragmentFromYamlNode(node, budget, depth, lineCounter) {
	consumeBudget(budget, depth, nodePosition(node, lineCounter));
	if (node === null) return nullValue();
	if (isAlias(node)) throw new ParseLimitError({
		code: "YAML_ALIAS_NOT_ALLOWED",
		message: `YAML aliases are disabled (maximum ${PARSE_LIMITS.maxAliases}).`,
		...nodePosition(node, lineCounter)
	});
	if (isScalar(node)) {
		const value = node.value;
		if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return {
			kind: "scalar",
			value
		};
		throw new TypeError("Parsed YAML contains an unsupported scalar value.");
	}
	if (isSeq(node)) return {
		kind: "sequence",
		items: node.items.map((item) => fragmentFromYamlNode(item, budget, depth + 1, lineCounter))
	};
	if (isMap(node)) return {
		kind: "map",
		entries: node.items.map((item) => yamlPairToFragment(item, budget, depth, lineCounter))
	};
	throw new TypeError("Parsed YAML contains an unsupported node type.");
}
function yamlPairToFragment(item, budget, depth, lineCounter) {
	if (!isScalar(item.key) || typeof item.key.value !== "string") throw new ParseLimitError({
		code: "YAML_NON_STRING_KEY",
		message: "YAML map keys must be strings.",
		...nodePosition(item.key, lineCounter)
	});
	return {
		kind: "pair",
		key: item.key.value,
		value: fragmentFromYamlNode(item.value, budget, depth + 1, lineCounter)
	};
}
function consumeBudget(budget, depth, position = {
	line: 0,
	column: 0
}) {
	if (depth > PARSE_LIMITS.maxDepth) throw new ParseLimitError({
		code: "MAX_DEPTH_EXCEEDED",
		message: `Parsed data exceeds the maximum nesting depth of ${PARSE_LIMITS.maxDepth}.`,
		...position
	});
	budget.nodes += 1;
	if (budget.nodes > PARSE_LIMITS.maxNodes) throw new ParseLimitError({
		code: "MAX_NODES_EXCEEDED",
		message: `Parsed data exceeds the maximum node count of ${PARSE_LIMITS.maxNodes}.`,
		...position
	});
}
function validateInputSize(source) {
	const bytes = new TextEncoder().encode(source).byteLength;
	if (bytes <= PARSE_LIMITS.maxInputBytes) return null;
	return {
		code: "MAX_INPUT_BYTES_EXCEEDED",
		message: `Input is ${bytes} bytes; the maximum is ${PARSE_LIMITS.maxInputBytes} bytes.`,
		line: 0,
		column: 0
	};
}
function resolveFormat(source, format) {
	if (format === "json" || format === "yaml") return format;
	const errors = [];
	parse(source, errors, {
		allowEmptyContent: false,
		allowTrailingComma: false,
		disallowComments: true
	});
	return errors.length === 0 ? "json" : "yaml";
}
function failure(format, diagnostic) {
	return {
		success: false,
		format,
		fragment: null,
		diagnostic
	};
}
function positionAt(source, offset) {
	const lines = source.slice(0, Math.max(0, offset)).split("\n");
	return {
		line: lines.length,
		column: (lines.at(-1)?.length ?? 0) + 1
	};
}
function nodePosition(node, lineCounter) {
	if (typeof node !== "object" || node === null || !("range" in node)) return {
		line: 0,
		column: 0
	};
	const range = node.range;
	const offset = Array.isArray(range) && typeof range[0] === "number" ? range[0] : void 0;
	return offset === void 0 ? {
		line: 0,
		column: 0
	} : yamlPosition(lineCounter, offset);
}
function yamlPosition(lineCounter, offset) {
	const { line, col } = lineCounter.linePos(offset);
	return {
		line,
		column: col
	};
}
var ParseLimitError = class extends Error {
	constructor(diagnostic) {
		super(diagnostic.message);
		this.diagnostic = diagnostic;
		this.name = "ParseLimitError";
	}
};
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !isDataArray(value);
}
function isDataArray(value) {
	return Array.isArray(value);
}
function spaces(count) {
	return " ".repeat(count);
}
var SERIALIZED_PREFIX = "turbowarp-yaml-json:v1:";
var blockDefinitions = block_definitions_default.blocks;
var menuDefinitions = block_definitions_default.menus;
var YamlJsonExtension = class {
	constructor(scratch) {
		this.scratch = scratch;
		this.lastParse = {
			success: false,
			format: "",
			diagnostic: null
		};
		this.fixedInputs = fixedInputRegistration(scratch);
	}
	dispose() {
		this.fixedInputs.dispose();
	}
	getInfo() {
		this.fixedInputs.ensure(blockDefinitions.map((block) => `${extensionConfig.id}_${block.opcode}`));
		return {
			id: extensionConfig.id,
			name: this.scratch.translate(block_definitions_default.extensionName),
			docsURI: extensionConfig.docsURI,
			blockIconURI: extensionConfig.blockIconURI,
			blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
			menus: Object.fromEntries(Object.entries(menuDefinitions).map(([id, menu]) => [id, {
				acceptReporters: menu.acceptReporters,
				items: menu.items.map((item) => this.scratch.translate(item))
			}]))
		};
	}
	string(args) {
		return encode(stringValue(this.scratch.Cast.toString(args.VALUE)));
	}
	number(args) {
		return encode(numberValue(this.scratch.Cast.toNumber(args.VALUE)));
	}
	boolean(args) {
		return encode(booleanValue(this.scratch.Cast.toBoolean(args.VALUE)));
	}
	nullValue() {
		return encode(nullValue());
	}
	pair(args) {
		return encode(pair(this.scratch.Cast.toString(args.KEY), decodeOrString(this.scratch, args.VALUE)));
	}
	map(args) {
		return encode(map(decodeOrString(this.scratch, args.ENTRIES, true)));
	}
	sequence(args) {
		return encode(sequence(decodeOrString(this.scratch, args.ITEMS, true)));
	}
	concat(args) {
		return encode(concat(decodeOrString(this.scratch, args.LEFT, true), decodeOrString(this.scratch, args.RIGHT, true)));
	}
	renderYaml(args) {
		return renderYaml(decodeOrString(this.scratch, args.FRAGMENT, true));
	}
	renderJson(args) {
		return renderJson(decodeOrString(this.scratch, args.FRAGMENT, true));
	}
	validateSchema(args) {
		return formatValidationResult(validateWithJsonSchema(this.scratch.Cast.toString(args.SCHEMA), decodeOrString(this.scratch, args.FRAGMENT, true)));
	}
	isValidSchema(args) {
		return validateWithJsonSchema(this.scratch.Cast.toString(args.SCHEMA), decodeOrString(this.scratch, args.FRAGMENT, true)).valid;
	}
	parseText(args) {
		const result = parseData(this.scratch.Cast.toString(args.TEXT), normalizeParseFormat(this.scratch.Cast.toString(args.FORMAT)));
		this.lastParse = {
			success: result.success,
			format: result.format,
			diagnostic: result.diagnostic
		};
		return result.success ? encode(result.fragment) : "";
	}
	lastParseSucceeded() {
		return this.lastParse.success;
	}
	lastParseFormat() {
		return this.lastParse.format;
	}
	lastParseDiagnostic() {
		const diagnostic = this.lastParse.diagnostic;
		if (diagnostic === null) return "";
		const location = diagnostic.line > 0 ? ` at line ${diagnostic.line}, column ${diagnostic.column}` : "";
		return `[${diagnostic.code}]${location}: ${diagnostic.message}`;
	}
	lastParseLine() {
		return this.lastParse.diagnostic?.line ?? 0;
	}
	lastParseColumn() {
		return this.lastParse.diagnostic?.column ?? 0;
	}
	toScratchBlock(block) {
		return {
			opcode: block.opcode,
			blockType: this.scratch.BlockType[block.blockType],
			text: this.scratch.translate(block.text),
			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
				type: this.scratch.ArgumentType[argument.type],
				defaultValue: argument.defaultValue,
				...argument.menu === void 0 ? {} : { menu: argument.menu }
			}]))
		};
	}
};
function normalizeParseFormat(value) {
	const normalized = value.trim().toLowerCase();
	if (normalized === "json" || normalized === "yaml") return normalized;
	return "auto";
}
function encode(fragment) {
	return `${SERIALIZED_PREFIX}${JSON.stringify(fragment)}`;
}
function decodeOrString(scratch, value, blankAsEmpty = false) {
	const raw = scratch.Cast.toString(value);
	if (blankAsEmpty && raw.length === 0) return { kind: "empty" };
	if (!raw.startsWith(SERIALIZED_PREFIX)) return stringValue(raw);
	return parseFragment(raw.slice(23));
}
function parseFragment(json) {
	const parsed = JSON.parse(json);
	if (!isFragment(parsed)) throw new TypeError("Invalid serialized YAML/JSON fragment.");
	return parsed;
}
function isFragment(value) {
	if (typeof value !== "object" || value === null) return false;
	const record = value;
	if (record.kind === "empty") return true;
	if (record.kind === "scalar") return isScalarValue(record.value);
	if (record.kind === "pair") return typeof record.key === "string" && isFragment(record.value);
	if (record.kind === "map") return Array.isArray(record.entries) && record.entries.every(isPairFragment);
	if (record.kind === "sequence") return Array.isArray(record.items) && record.items.every(isFragment);
	if (record.kind === "concat") return Array.isArray(record.children) && record.children.every(isFragment);
	return false;
}
function isPairFragment(value) {
	return isFragment(value) && value.kind === "pair";
}
function isScalarValue(value) {
	return value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
}
/** Static contract: importing this entry never creates or registers an extension. */
var bundleModuleMetadata = Object.freeze({
	formatVersion: 1,
	id: extensionConfig.id,
	unsandboxed: extensionConfig.unsandboxed ? "required" : "not-needed"
});
/** The caller supplies the member host and owns registration and lifetime. */
function createExtension(scratch) {
	return new YamlJsonExtension(scratch);
}
export { bundleModuleMetadata, createExtension };
