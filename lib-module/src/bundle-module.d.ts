import { YamlJsonExtension } from './extension.js';
import type { ExtensionModuleMetadata, ScratchApi } from './runtime-api.js';
export type { TurboWarpExtension, ScratchTranslate, ScratchApi, ExtensionModuleMetadata } from './runtime-api.js';
/** Static contract: importing this entry never creates or registers an extension. */
export declare const bundleModuleMetadata: ExtensionModuleMetadata;
/** The caller supplies the member host and owns registration and lifetime. */
export declare function createExtension(scratch: ScratchApi): YamlJsonExtension;
