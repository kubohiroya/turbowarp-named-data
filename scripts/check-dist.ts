import {access, readdir, readFile} from 'node:fs/promises';

await access('dist/named-data.js');
await access('dist/composition.js');
await access('dist/extension-manifest.json');
await access('dist/types/composition.d.ts');

const files = (await readdir('dist')).sort();
const expected = ['composition.js', 'extension-manifest.json', 'named-data.js', 'types'];
if (JSON.stringify(files) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected dist contents: ${files.join(', ')}`);
}

const bundle = await readFile('dist/named-data.js', 'utf8');
if (!bundle.includes('@kubohiroya/turbowarp-named-data/registry/2.0')) {
  throw new Error('Generated bundle does not contain the versioned registry contract.');
}
const composition = await readFile('dist/composition.js', 'utf8');
for (const exportName of [
  'installNamedDataRegistry',
  'getNamedDataRegistry',
  'NamedDataRegistry',
  'NAMED_DATA_CONTRACT_VERSION'
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
  runtimeServices?: Array<{defaultEnabled?: boolean}>;
};
if (manifest.id !== 'kubohiroyanameddata' || manifest.runtimeServices?.[0]?.defaultEnabled !== false) {
  throw new Error('Generated manifest does not describe the disabled-by-default Named Data service.');
}

process.stdout.write('Generated dist files are aligned.\n');
