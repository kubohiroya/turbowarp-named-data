import {access, readdir, readFile} from 'node:fs/promises';

await access('dist/named-data.js');
await access('dist/composition.js');
await access('dist/extension-manifest.json');
await access('dist/types/composition.d.ts');

const files = (await readdir('dist')).sort();
const expected = ['composition.js', 'extension-manifest.json', 'named-data.js', 'runtime-services.json', 'types'];
if (JSON.stringify(files) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected dist contents: ${files.join(', ')}`);
}

const bundle = await readFile('dist/named-data.js', 'utf8');
if (!bundle.includes('@kubohiroya/turbowarp-named-data/registry')) {
  throw new Error('Generated bundle does not contain the shared registry key.');
}
const composition = await readFile('dist/composition.js', 'utf8');
for (const exportName of [
  'installNamedDataRegistry',
  'getNamedDataRegistry',
  'NamedDataRegistry',
  'NAMED_DATA_REGISTRY_SYMBOL_KEY'
]) {
  if (!composition.includes(exportName)) {
    throw new Error(`Composition bundle does not export ${exportName}.`);
  }
}
const compositionTypes = await readFile('dist/types/composition.d.ts', 'utf8');
if (!compositionTypes.includes("from './contract.js'")) {
  throw new Error('Composition declaration does not expose the canonical contract types.');
}
const manifest = JSON.parse(await readFile('dist/extension-manifest.json', 'utf8')) as {
  id?: string;
  runtimeServices?: unknown;
};
if (manifest.id !== 'kubohiroyanameddata') {
  throw new Error('Generated manifest does not describe this extension.');
}
// The runtime services moved out of the API manifest, which now describes the block API alone.
if (manifest.runtimeServices !== undefined) {
  throw new Error('Generated manifest must not carry runtime services.');
}
const services = JSON.parse(await readFile('dist/runtime-services.json', 'utf8')) as {
  formatVersion?: number;
  runtimeServices?: Array<{defaultEnabled?: boolean}>;
};
if (services.formatVersion !== 1 || services.runtimeServices?.[0]?.defaultEnabled !== false) {
  throw new Error('Generated runtime services do not describe the disabled-by-default Named Data service.');
}

process.stdout.write('Generated dist files are aligned.\n');
