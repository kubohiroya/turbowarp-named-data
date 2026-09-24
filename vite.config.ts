import {defineConfig} from 'vite';
import {extensionManifestPlugin} from '@kubohiroya/turbowarp-extension-manifest';
import {turboWarpExtension} from '@kubohiroya/vite-plugin-turbowarp-extension';
import definitions from './src/block-definitions.json' with {type: 'json'};
import {extensionConfig} from './src/config.js';
import {serializeRuntimeServices} from './src/runtime-services.js';

export default defineConfig({
  plugins: [
    turboWarpExtension({
      id: extensionConfig.id,
      name: extensionConfig.name,
      description: extensionConfig.description,
      author: extensionConfig.author,
      license: extensionConfig.license,
      fileName: `${extensionConfig.slug}.js`
    }),
    extensionManifestPlugin({
      id: extensionConfig.id,
      definitions
    }),
    {
      name: 'named-data-runtime-services',
      apply: 'build',
      enforce: 'post',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'runtime-services.json',
          source: serializeRuntimeServices(definitions)
        });
      }
    }
  ]
});
