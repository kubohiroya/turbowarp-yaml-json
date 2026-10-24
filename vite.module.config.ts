import {defineConfig} from 'vite';
import metadata from './package.json' with {type: 'json'};

const externalPackages = Object.keys(metadata.dependencies);

/** Keep runtime dependencies external; inline only the existing pure editor helpers. */
export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'lib-module/src',
    target: 'es2020',
    minify: false,
    lib: {entry: 'src/bundle-module.ts', formats: ['es'], fileName: () => 'bundle-module.js'},
    rollupOptions: {
      external: (id) => externalPackages.some((name) => id === name || id.startsWith(name + '/'))
    }
  },
  plugins: [
    {
      name: 'bundle-module-boundary',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          const forbidden = Object.keys(output.modules).find(
            (id) =>
              /\/node_modules\/(?:.*\/)?(?:yaml|ajv|ajv-formats|react|react-dom|@rjsf\/[^/]+)(?:\/|$)/u.test(
                id
              ) ||
              /\/turbowarp-extension-data-editor\/dist\/(?:schema-engine|schema-compose|schema-view|source-editor|fixed-input-editor)\.js$/u.test(
                id
              )
          );
          if (forbidden)
            this.error(
              'Integrated entry inlines a runtime dependency or editor engine: ' + forbidden
            );
          output.code = output.code.replace(/^[\t ]*\/\/#(?:end)?region[^\r\n]*(?:\r?\n|$)/gm, '');
        }
      }
    }
  ]
});
