import { createYamlBlockDefinitions, createYamlBlockMenus, yamlBlockOperations } from './yaml-blocks.js';
export const yamlBlockRuntimeId = 'kubohiroyaembeddedyaml';
/** The project explicitly loads this inert companion; it owns no source document. */
export function createYamlBlockRuntime(Scratch, { enabled = globalThis.TW_EMBEDDED_DOCUMENT_VIEWS === true } = {}) {
    if (!Scratch?.BlockType)
        throw new TypeError('The TurboWarp extension API is required.');
    const extension = {
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
    for (const operation of Object.values(yamlBlockOperations))
        extension[operation] = () => false;
    return extension;
}
