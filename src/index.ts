import {extensionConfig} from './config.js';
import {createExtension} from './bundle-module.js';

if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) {
  throw new Error(`${extensionConfig.name} must run unsandboxed.`);
}

Scratch.extensions.register(createExtension(Scratch));
