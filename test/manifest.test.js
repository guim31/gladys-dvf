// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENE_ACTION_KEY } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES, POSITIONS, RADII } from '../src/config.js';
import { TRIGGER_KEY, WIDGET_KEY } from '../src/monitor.js';
import { WIDGETS } from '../src/widgets.js';
import { NEXT_VINTAGE, TOULOUSE, createWorld, dvfFile, dvfRow } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

const { gladys: registered, app } = await createWorld({ connect: false });
await app.stop();
const handlerKeys = (prefix) =>
  Object.keys(registered.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const optionValues = (field) => field.options.map((option) => option.value);
const field = (list, key) => list.find((entry) => entry.key === key);

test('identity: name, image, cover, cloud transport, services, France', () => {
  assert.equal(manifest.name, 'DVF');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-dvf:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-dvf/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['services']);
  assert.deepEqual(manifest.countries, ['FR']);
  assert.equal(manifest.location, true);
});

test('Gladys 5.3.0 at least: countries and keywords (5.3.0), the houses source (5.2.0)', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), handlerKeys('action:').sort());
  for (const action of manifest.actions) {
    // GladysAssistant/Gladys#3154 and #3155: an action applies no default.
    assert.equal(action.fields, undefined, action.key);
  }
});

test('the scene action has its handler, and returns only declared outputs', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_actions), [SCENE_ACTION_KEY]);
  assert.deepEqual(handlerKeys('sceneAction:'), [SCENE_ACTION_KEY]);
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction(SCENE_ACTION_KEY, {});
  const outputs = ack.data.outputs ?? ack.data;
  const declared = field(manifest.scene_actions, SCENE_ACTION_KEY).outputs;
  for (const [key, value] of Object.entries(outputs)) {
    const output = field(declared, key);
    assert.ok(output, `${key} is declared`);
    assert.equal(typeof value, output.type, key);
  }
});

test('the scene trigger fired is declared, with exactly its keys', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers), [TRIGGER_KEY]);
  const trigger = field(manifest.scene_triggers, TRIGGER_KEY);
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.api.files[`${NEXT_VINTAGE}/${TOULOUSE}-2026`] = dvfFile([
    dvfRow({ id: '2026-1', date: '2026-02-10', price: 250000 }),
  ]);
  world.api.publish(NEXT_VINTAGE);
  await world.tick(24);
  assert.equal(world.fake.sceneEvents.length, 1);
  const [event] = world.fake.sceneEvents;
  assert.deepEqual(
    Object.keys(event.data).sort(),
    [...new Set([...keysOf(trigger.fields), ...keysOf(trigger.variables)])].sort(),
  );
  for (const variable of trigger.variables) {
    const value = event.data[variable.key];
    if (value !== null) {
      assert.equal(typeof value, variable.type, variable.key);
    }
  }
});

test('every widget has its handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
});

test('config_schema defaults and options are the ones of the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[entry.key], entry.default, entry.key);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  assert.deepEqual(optionValues(field(manifest.config_schema, 'language')), LANGUAGES);
  assert.deepEqual(optionValues(field(manifest.config_schema, 'position')), POSITIONS);
  assert.deepEqual(optionValues(field(manifest.config_schema, 'radius')), RADII);
});

test('dynamic selects: the houses in the configuration, the devices elsewhere', () => {
  const dynamic = allFields.filter((entry) => entry.source !== undefined);
  assert.deepEqual(
    dynamic.map((entry) => [entry.key, entry.source]),
    [
      ['house', 'houses'],
      ['device', 'devices'],
      ['device', 'devices'],
      ['device', 'devices'],
    ],
  );
  for (const entry of dynamic) {
    assert.equal(entry.options, undefined, entry.key);
    assert.equal(entry.default, undefined, entry.key);
    assert.notEqual(entry.required, true, entry.key);
  }
});

test('no number field (the form has no step), no secret anywhere', () => {
  assert.deepEqual(
    allFields.filter((entry) => entry.type === 'number' || entry.type === 'secret'),
    [],
  );
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('the sources section names the data and says it is not affiliated', () => {
  const about = field(manifest.config_schema, 'about');
  assert.match(about.description.en, /Not affiliated with the DGFiP nor Etalab/);
  assert.match(about.description.fr, /Non affiliée à la DGFiP ni à Etalab/);
  assert.match(about.description.en, /Alsace-Moselle and Mayotte/);
});
