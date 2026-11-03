import {readFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import {encodeReference} from '@kubohiroya/turbowarp-document-source';
import {createYamlSourceBlockView, readYamlSourceBlockView} from '../src/yaml-source-view.js';
import {createYamlBlockRuntime} from '../src/runtime.js';

describe('YAML views use the document source contract without a document store', () => {
  it('preserves source bytes and contract references through a block view', () => {
    const source='# retained\r\nmessage: "hello" # inline\r\n';
    const reference={providerId:'owner',documentId:'main'};
    const view=createYamlSourceBlockView({source,reference,rootId:'root',rootOpcode:'owner_source',sourceRevision:'1'});
    expect(JSON.stringify(view.blocks)).toContain(encodeReference(reference));
    expect(readYamlSourceBlockView({...view,sourceRevision:'1'}).source).toBe(source);
  });

  it('keeps the companion runtime explicitly default OFF', () => {
    expect(createYamlBlockRuntime({BlockType:{HAT:'hat'}}).getInfo().blocks).toEqual([]);
    const runtime=createYamlBlockRuntime({BlockType:{HAT:'hat'}},{enabled:true});
    expect(runtime.getInfo().blocks).not.toEqual([]);
  });

  it('has no dependency on document-data, including development and peer dependencies', async () => {
    const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')) as Record<string, Record<string,string>>;
    for(const kind of ['dependencies','devDependencies','peerDependencies','optionalDependencies'])
      expect(Object.keys(manifest[kind]??{})).not.toContain('@kubohiroya/turbowarp-document-data');
  });
});
