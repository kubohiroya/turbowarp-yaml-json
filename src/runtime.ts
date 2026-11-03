import {
    createYamlBlockDefinitions,
    createYamlBlockMenus,
    yamlBlockOperations
} from './yaml-blocks.js';
export const yamlBlockRuntimeId = 'kubohiroyaembeddedyaml';
export interface YamlBlockRuntime {
    getInfo(): Record<string, unknown>;
    [operation: string]: unknown;
}
/** The project explicitly loads this inert companion; it owns no source document. */
export function createYamlBlockRuntime(
    Scratch: { BlockType: Record<string, string> },
    { enabled = (globalThis as { TW_EMBEDDED_DOCUMENT_VIEWS?: unknown }).TW_EMBEDDED_DOCUMENT_VIEWS === true }: { enabled?: boolean } = {}
): YamlBlockRuntime {
    if (!Scratch?.BlockType) throw new TypeError('The TurboWarp extension API is required.');
    const extension: YamlBlockRuntime = {
        getInfo: () => ({
            id: yamlBlockRuntimeId,
            name: 'YAML blocks',
            color1: '#9a7037',
            color2: '#805b2e',
            color3: '#674923',
            blocks: enabled === true ? createYamlBlockDefinitions() : [],
            menus: createYamlBlockMenus()
        })
    };
    for (const operation of Object.values(yamlBlockOperations)) extension[operation] = () => false;
    return extension;
}
