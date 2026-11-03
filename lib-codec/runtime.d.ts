export declare const yamlBlockRuntimeId = "kubohiroyaembeddedyaml";
export interface YamlBlockRuntime {
    getInfo(): Record<string, unknown>;
    [operation: string]: unknown;
}
/** The project explicitly loads this inert companion; it owns no source document. */
export declare function createYamlBlockRuntime(Scratch: {
    BlockType: Record<string, string>;
}, { enabled }?: {
    enabled?: boolean;
}): YamlBlockRuntime;
