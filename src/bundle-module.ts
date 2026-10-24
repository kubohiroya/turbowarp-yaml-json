import {extensionConfig} from './config.js';
import {YamlJsonExtension} from './extension.js';
import type {ExtensionModuleMetadata, ScratchApi} from './runtime-api.js';

export type {
  TurboWarpExtension,
  ScratchTranslate,
  ScratchApi,
  ExtensionModuleMetadata
} from './runtime-api.js';

/** Static contract: importing this entry never creates or registers an extension. */
export const bundleModuleMetadata: ExtensionModuleMetadata = Object.freeze({
  formatVersion: 1,
  id: extensionConfig.id,
  unsandboxed: extensionConfig.unsandboxed ? 'required' : 'not-needed'
});

/** The caller supplies the member host and owns registration and lifetime. */
export function createExtension(scratch: ScratchApi): YamlJsonExtension {
  return new YamlJsonExtension(scratch);
}
