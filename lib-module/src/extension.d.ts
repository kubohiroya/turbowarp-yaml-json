import type { ScratchApi, TurboWarpExtension } from './runtime-api.js';
export declare class YamlJsonExtension implements TurboWarpExtension {
    private readonly scratch;
    private readonly fixedInputs;
    constructor(scratch: ScratchApi);
    private lastParse;
    dispose(): void;
    getInfo(): Record<string, unknown>;
    string(args: {
        VALUE: unknown;
    }): string;
    number(args: {
        VALUE: unknown;
    }): string;
    boolean(args: {
        VALUE: unknown;
    }): string;
    nullValue(): string;
    pair(args: {
        KEY: unknown;
        VALUE: unknown;
    }): string;
    map(args: {
        ENTRIES: unknown;
    }): string;
    sequence(args: {
        ITEMS: unknown;
    }): string;
    concat(args: {
        LEFT: unknown;
        RIGHT: unknown;
    }): string;
    renderYaml(args: {
        FRAGMENT: unknown;
    }): string;
    renderJson(args: {
        FRAGMENT: unknown;
    }): string;
    validateSchema(args: {
        SCHEMA: unknown;
        FRAGMENT: unknown;
    }): string;
    isValidSchema(args: {
        SCHEMA: unknown;
        FRAGMENT: unknown;
    }): boolean;
    parseText(args: {
        TEXT: unknown;
        FORMAT: unknown;
    }): string;
    lastParseSucceeded(): boolean;
    lastParseFormat(): string;
    lastParseDiagnostic(): string;
    lastParseLine(): number;
    lastParseColumn(): number;
    private toScratchBlock;
}
