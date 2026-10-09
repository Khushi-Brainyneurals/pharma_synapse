const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

// Compile the actual source with the installed TypeScript; no extra test dependency.
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, structuredClone, ...globals, require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(file), name);
      const resolved = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!resolved) throw Error(`Missing test dependency: ${name}`);
      return load(resolved);
    } }, { filename: file });
    return exports;
  }
  return load;
}
const plain = value => JSON.parse(JSON.stringify(value));
const source = 'src/features/stages/model/stageRepeats.ts';
const reference = {
  layers: ['Layer A', 'Layer B'], stages: [
    { key: 'dispensing_rm', label: 'Dispensing' },
    { key: 'granulation', label: 'Granulation' },
    { key: 'compression', label: 'Compression' },
    { key: 'coating', label: 'Coating' },
  ],
};

test('layer rename keeps the key and its saved values', () => {
  const { repeatFor, setUnitValue } = loader()(source);
  let values = { dispensing_rm: { layer_config: [{ key: 'Layer A', name: 'Active layer' }] } };
  const repeat = repeatFor('granulation', reference, values);
  assert.equal(repeat.slots[0].key, 'Layer A');
  assert.equal(repeat.slots[0].name, 'Active layer');
  values = setUnitValue(values, 'granulation', repeat.valueKey, 'Layer A', 'lot_size', '3');
  values.dispensing_rm.layer_config[0].name = 'Renamed again';
  assert.equal(repeatFor('granulation', reference, values).slots[0].name, 'Renamed again');
  assert.equal(values.granulation.per_layer['Layer A'].lot_size, '3');
  assert.equal(values.granulation.per_layer['Active layer'], undefined);
});

test('single-layer choice disables repetition and fallback layer identities stay stable', () => {
  const { repeatFor } = loader()(source);
  assert.equal(repeatFor('granulation', reference, { dispensing_rm: { layers: 'Single layer' } }), null);
  const repeat = repeatFor('granulation', { ...reference, layers: [] }, { dispensing_rm: { layers: 'Bi-layer' } });
  assert.deepEqual(plain(repeat.slots.map(slot => slot.key)), ['Layer 1', 'Layer 2']);
});

test('coating passes follow dispensing order, not label or object order', () => {
  const { repeatFor } = loader()(source);
  const repeat = repeatFor('coating', reference, {
    dispensing_coating: { coating_types: ['Seal', 'Film'], coating_config: [{ key: 'Film', name: 'Final pass' }] },
    coating: { per_type: { Ghost: { temp: { min: '999' } } } },
  });
  assert.equal(repeat.valueKey, 'per_type');
  assert.deepEqual(plain(repeat.slots.map(slot => [slot.key, slot.name])), [['Seal', 'Seal'], ['Film', 'Final pass']]);
  assert.equal(repeatFor('coating', reference, { dispensing_coating: { coating_types: [] } }), null);
});

test('copying a unit preserves the source and creates independent nested values', () => {
  const { copyUnitValues } = loader()(source);
  const original = { granulation: { per_layer: {
    A: { temp: { min: '20', max: '25' }, __param_meta: { temp: { mode: 'limit' } } },
    B: { lot_size: '1' },
  } } };
  const next = copyUnitValues(original, 'granulation', 'per_layer', 'A', 'B');
  next.granulation.per_layer.B.temp.min = '22';
  assert.equal(original.granulation.per_layer.A.temp.min, '20');
  assert.equal(next.granulation.per_layer.A.temp.min, '20');
  assert.equal(original.granulation.per_layer.B.lot_size, '1');
});

test('condition copying offers earlier recorded limits, including distinct layers', () => {
  const { conditionSourcesFor } = loader()(source);
  const values = {
    dispensing_rm: { temp: { min: '20' }, rh: { min: '30' }, __param_meta: { rh: { enabled: false } } },
    granulation: { per_layer: { 'Layer A': { temp: { min: '21' } }, 'Layer B': { temp: { min: '22' }, dp: { max: '4' }, __param_meta: { dp: { mode: 'record' } } } } },
    compression: { temp: { min: '23' } }, coating: { temp: { min: '99' } },
  };
  const result = conditionSourcesFor('compression', reference, values, ['dispensing_rm', 'granulation', 'compression', 'coating']);
  assert.deepEqual(plain(result.temp.map(item => item.value.min)), ['20', '21', '22']);
  assert.equal(result.rh, undefined);
  assert.equal(result.dp, undefined);
});

function storageHarness() {
  const values = new Map();
  const load = loader({}, { window: { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) } } });
  return { values, storage: load('src/features/auth/storage/resumeLocation.ts') };
}

test('resume is isolated by user and document, and clearing one preserves others', () => {
  const { storage: s } = storageHarness();
  s.saveDocumentLocation('alice', 'one', '/documents/one/preview');
  s.saveDocumentLocation('alice', 'two', '/documents/two/stages');
  s.saveDocumentLocation('bob', 'one', '/documents/one/inputs');
  assert.equal(s.getDocumentLocation('alice', 'one', 'preview'), '/documents/one/preview');
  s.clearDocumentLocation('alice', 'one');
  assert.equal(s.getDocumentLocation('alice', 'one', 'preview'), null);
  assert.equal(s.getDocumentLocation('alice', 'two', 'stages'), '/documents/two/stages');
  assert.equal(s.getDocumentLocation('bob', 'one', 'inputs'), '/documents/one/inputs');
});

test('resume cannot jump ahead, go backwards, cross documents or leave the application', () => {
  const { storage: s } = storageHarness();
  s.saveDocumentLocation('alice', 'one', '/documents/one/generate');
  assert.equal(s.getDocumentLocation('alice', 'one', 'inputs'), null);
  s.saveDocumentLocation('alice', 'one', '/documents/one/inputs');
  assert.equal(s.getDocumentLocation('alice', 'one', 'stages'), null);
  s.saveDocumentLocation('alice', 'two', '/documents/one/inputs');
  s.saveDocumentLocation('alice', 'two', 'https://example.org/');
  assert.equal(s.getDocumentLocation('alice', 'two', 'inputs'), null);
  s.saveDocumentLocation('alice', 'one', '/documents/one/stage-input?stage=Granulation');
  assert.equal(s.getDocumentLocation('alice', 'one', 'stages'), '/documents/one/stage-input?stage=Granulation');
});

test('login always opens the dashboard', () => {
  const { getPostLoginPath } = loader()('src/app/routing/postLoginPath.ts');
  for (const role of ['preparer', 'reviewer_qa', 'reviewer_pr', 'approver', 'admin', 'superadmin']) assert.equal(getPostLoginPath(role), '/');
});

test('only Reviewer QA can edit company standard info', () => {
  const { canEditCompanyInfo } = loader()('src/features/company/access.ts');
  assert.equal(canEditCompanyInfo('reviewer_qa'), true);
  for (const role of ['preparer', 'reviewer_pr', 'approver', 'admin', 'superadmin', null, undefined]) {
    assert.equal(canEditCompanyInfo(role), false);
  }
});

test('generation progress and generated PDF use authenticated BFF endpoints', async () => {
  const calls = [];
  const httpClient = { get: async (...args) => { calls.push(args); return { data: { status: 'running' } }; } };
  const api = loader({ '../../../shared/api/httpClient': { httpClient } })('src/features/generate/api/generate.api.ts');
  await api.getGenerateProgress('doc/1');
  await api.getDocumentPdf('doc/1');
  assert.equal(calls[0][0], '/api/bmr/documents/doc%2F1/generate/progress');
  assert.equal(calls[1][0], '/api/bmr/documents/doc%2F1/document.pdf');
  assert.equal(calls[1][1].responseType, 'blob');
});

test('core inputs use source-slot endpoints and append only backend-advertised file fields', async () => {
  const calls = [];
  class TestFormData {
    constructor() { this.parts = []; }
    append(...args) { this.parts.push(args); }
  }
  const httpClient = {
    get: async (...args) => {
      calls.push(['get', ...args]);
      return { data: { document_id: 'doc/1', slots: [], multipart_fields: [] } };
    },
    put: async (...args) => {
      calls.push(['put', ...args]);
      return { data: { document_id: 'doc/1', status: 'core_inputs_set' } };
    },
  };
  const api = loader(
    { '../../../shared/api/httpClient': { httpClient } },
    { FormData: TestFormData },
  )('src/features/new-document/api/documents.api.ts');

  await api.getSourceSlots('doc/1');
  await api.setCoreInputs({
    documentId: 'doc/1',
    sourceFiles: { mpc: { name: 'mpc.pdf' }, pp: { name: 'pp.pdf' }, mfc: { name: 'mfc.pdf' }, other_doc_1: null },
    multipartFields: ['mpc', 'pp', 'other_doc_1'],
    batchSize: 1000,
    batchType: 'commercial',
    commercialMode: 'validation',
    headerFooterSize: 0.5,
    footerSize: 0.5,
    footerTemplateNo: 'F-QA-014',
    addressId: 1,
    user: 'alice',
  });

  assert.equal(calls[0][1], '/api/documents/doc%2F1/source-slots');
  assert.equal(calls[1][1], '/api/documents/doc%2F1/core-inputs');
  const fileFields = calls[1][2].parts
    .filter(([, value]) => value && typeof value === 'object')
    .map(([field]) => field);
  assert.deepEqual(fileFields, ['mpc', 'pp']);
  const submittedFields = calls[1][2].parts.map(([field]) => field);
  assert.ok(submittedFields.includes('header_size'));
  assert.ok(submittedFields.includes('address_id'));
  assert.ok(!submittedFields.includes('header_footer_size'));
});

test('saved core inputs are loaded from the dedicated Step 3 prefill endpoint', async () => {
  const calls = [];
  const saved = {
    document_id: 'doc/1',
    batch_size: 100000,
    batch_type: 'exhibit',
    commercial_mode: '',
    header_size: 1,
    footer_size: 0.5,
    footer_template_no: 'F_QA',
    address_id: 1,
    address: 'Demo Test Address',
    core_input_files: { mfc: 'mfc.pdf', pp: 'pp.pdf' },
  };
  const httpClient = {
    get: async (...args) => {
      calls.push(args);
      return { data: saved };
    },
  };
  const api = loader(
    {
      axios: { default: { isAxiosError: () => false }, isAxiosError: () => false },
      '../../../shared/api/httpClient': { httpClient },
    },
  )('src/features/new-document/api/documents.api.ts');

  assert.equal(await api.getCoreInputs('doc/1'), saved);
  assert.equal(calls[0][0], '/api/documents/doc%2F1/core-inputs');
});

test('editing metadata does not re-upload files already stored by the backend', async () => {
  let submitted;
  class TestFormData {
    constructor() { this.parts = []; }
    append(...args) { this.parts.push(args); }
  }
  const httpClient = {
    put: async (_url, body) => {
      submitted = body;
      return { data: { document_id: 'doc-1', status: 'core_inputs_set' } };
    },
  };
  const api = loader(
    { '../../../shared/api/httpClient': { httpClient } },
    { FormData: TestFormData },
  )('src/features/new-document/api/documents.api.ts');

  await api.setCoreInputs({
    documentId: 'doc-1',
    sourceFiles: {},
    multipartFields: ['mfc', 'pp', 'other_doc_1'],
    batchSize: 120000,
    batchType: 'exhibit',
    headerFooterSize: 1,
    footerSize: 0.5,
    footerTemplateNo: 'F_QA',
    addressId: 1,
  });

  assert.deepEqual(
    submitted.parts.filter(([, value]) => value && typeof value === 'object'),
    [],
  );
});

test('format preview loads the backend PDF and preserves its filename', async () => {
  const calls = [];
  const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
  const httpClient = {
    get: async (...args) => {
      calls.push(args);
      return {
        data: pdf,
        headers: {
          'content-disposition': 'attachment; filename="format_preview_doc-1.pdf"',
          'content-type': 'application/pdf',
        },
      };
    },
  };
  const api = loader(
    { '../../../shared/api/httpClient': { httpClient } },
  )('src/features/preview/api/preview.api.ts');

  const result = await api.getFormatPreview('doc/1');
  assert.equal(calls[0][0], '/api/documents/doc%2F1/format-preview');
  assert.equal(calls[0][1].responseType, 'blob');
  assert.match(calls[0][1].headers.Accept, /application\/pdf/);
  assert.equal(result.blob, pdf);
  assert.equal(result.filename, 'format_preview_doc-1.pdf');
  assert.equal(result.format, 'pdf');
});

test('format preview identifies a DOCX response for the Word renderer', async () => {
  const docx = new Blob(
    [Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14])],
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  );
  const httpClient = {
    get: async () => ({
      data: docx,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': 'attachment; filename="format_preview_doc-1.docx"',
      },
    }),
  };
  const api = loader(
    { '../../../shared/api/httpClient': { httpClient } },
    { Blob },
  )('src/features/preview/api/preview.api.ts');

  const result = await api.getFormatPreview('doc-1');
  assert.equal(result.blob, docx);
  assert.equal(result.format, 'docx');
  assert.equal(result.filename, 'format_preview_doc-1.docx');
});

test('format preview rejects an unsupported response before rendering', async () => {
  const httpClient = {
    get: async () => ({
      data: new Blob(['not a document'], { type: 'application/json' }),
      headers: { 'content-type': 'application/json' },
    }),
  };
  const api = loader(
    { '../../../shared/api/httpClient': { httpClient } },
    { Blob },
  )('src/features/preview/api/preview.api.ts');

  await assert.rejects(() => api.getFormatPreview('doc-1'), /unsupported or corrupted/);
});

test('stage schema defaults are merged under saved values and refs are resolved', () => {
  const schemaTools = loader()('src/features/stage-input/model/schemaForm.ts');
  const schema = {
    type: 'object',
    $defs: {
      Param: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'temperature | relative_humidity | differential_pressure' },
          enabled: { type: 'boolean', default: true },
          mode: { type: 'string', default: 'record_only' },
        },
        required: ['name'],
      },
    },
    properties: {
      parameters: { type: 'array', items: { $ref: '#/$defs/Param' } },
      lot_size: { type: 'string', default: '1' },
    },
  };
  const defaults = schemaTools.buildSchemaDefaults(schema);
  const merged = schemaTools.mergeSchemaValues(defaults, {
    parameters: [{ name: 'temperature', enabled: false }],
    lot_size: '3',
  }, schema);
  assert.deepEqual(plain(merged), {
    parameters: [{ name: 'temperature', enabled: false, mode: 'record_only' }],
    lot_size: '3',
  });
  const seeded = schemaTools.seedSchemaParameterRows(schema, defaults);
  assert.deepEqual(plain(seeded.parameters.map(row => row.name)), ['temperature', 'relative_humidity', 'differential_pressure']);
  assert.ok(seeded.parameters.every(row => row.enabled === true && row.mode === 'record_only'));
});

test('dispensing raw material requires one comma-separated lot size per document layer', () => {
  const schemaTools = loader()('src/features/stage-input/model/schemaForm.ts');
  const schema = {
    type: 'object',
    properties: { lot_size: { type: 'string', title: 'Lot size' } },
    required: ['lot_size'],
  };
  const context = {
    stageKey: 'dispensing_rm',
    layers: ['Immediate release', 'Sustained release', 'Barrier layer'],
  };

  assert.deepEqual(
    plain(schemaTools.validateSchema(schema, { lot_size: '10,,30' }, context)),
    ['Lot size for Sustained release is required.'],
  );
  assert.deepEqual(
    plain(schemaTools.validateSchema(schema, { lot_size: '10,20,30' }, context)),
    [],
  );
});

test('granulation schema initializes and scopes parameters and assets per document layer', () => {
  const schemaTools = loader()('src/features/stage-input/model/schemaForm.ts');
  const schema = {
    type: 'object',
    $defs: {
      Param: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'temperature | relative_humidity' },
          enabled: { type: 'boolean', default: true },
          mode: { type: 'string', default: 'record_only' },
        },
      },
      Layer: {
        type: 'object',
        properties: {
          layer: { type: 'string' },
          parameters: { type: 'array', items: { $ref: '#/$defs/Param' } },
          equipment_list: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, processing_step: { type: 'string' }, cpp_values: { type: 'object', additionalProperties: { type: 'string' } } } } },
          instrument_list: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } },
        },
      },
    },
    properties: { layers: { type: 'array', items: { $ref: '#/$defs/Layer' } } },
  };
  const values = schemaTools.initializeStageSchemaValues(schema, schemaTools.buildSchemaDefaults(schema), {
    layers: ['Active layer', 'Sustained layer'],
  });
  assert.equal(values.layers.length, 2);
  assert.deepEqual(plain(values.layers.map(layer => layer.layer)), ['Active layer', 'Sustained layer']);
  assert.deepEqual(plain(values.layers[0].parameters.map(row => row.name)), ['temperature', 'relative_humidity']);
  assert.equal(schemaTools.schemaHasAssetInputs(schema), true);
  assert.deepEqual(
    plain(schemaTools.collectStageAssetScopes(schema, values).map(scope => [scope.key, scope.label, scope.path])),
    [['layer:0', 'Active layer', ['layers', 0]], ['layer:1', 'Sustained layer', ['layers', 1]]],
  );
});

test('stage parameter policy removes reusable-schema rows unsupported by the selected stage', () => {
  const schemaTools = loader()('src/features/stage-input/model/schemaForm.ts');
  const schema = {
    type: 'object',
    $defs: {
      Param: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'temperature | relative_humidity | differential_pressure | holding_period | yield' },
          enabled: { type: 'boolean', default: true },
          mode: { type: 'string', default: 'record_only' },
        },
      },
    },
    properties: { parameters: { type: 'array', items: { $ref: '#/$defs/Param' } } },
  };
  const dispensing = schemaTools.initializeStageSchemaValues(
    schema,
    schemaTools.buildSchemaDefaults(schema),
    { stageKey: 'dispensing_rm' },
  );
  assert.deepEqual(plain(dispensing.parameters.map(row => row.name)), [
    'temperature', 'relative_humidity', 'differential_pressure',
  ]);

  const staleValues = {
    parameters: [
      ...dispensing.parameters,
      { name: 'holding_period', enabled: true, mode: 'record_only' },
      { name: 'yield', enabled: true, mode: 'limit' },
    ],
  };
  const payload = schemaTools.sanitizeStageValues('dispensing_rm', schema, staleValues);
  assert.deepEqual(plain(payload.parameters.map(row => row.name)), [
    'temperature', 'relative_humidity', 'differential_pressure',
  ]);

  const compression = schemaTools.initializeStageSchemaValues(
    schema,
    schemaTools.buildSchemaDefaults(schema),
    { stageKey: 'compression' },
  );
  assert.deepEqual(plain(compression.parameters.map(row => row.name)), [
    'temperature', 'relative_humidity', 'differential_pressure', 'holding_period', 'yield',
  ]);
});

test('dynamic coating passes and nested CPP maps survive schema initialization and sanitizing', () => {
  const schemaTools = loader()('src/features/stage-input/model/schemaForm.ts');
  const schema = {
    type: 'object',
    $defs: {
      Pass: {
        type: 'object',
        properties: {
          equipment_list: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                processing_step: { type: 'string' },
                cpp_values: { type: 'object', additionalProperties: { type: 'string' } },
              },
            },
          },
          weight_gain: { type: 'number' },
        },
      },
    },
    properties: {
      coat_passes: { type: 'object', additionalProperties: { $ref: '#/$defs/Pass' } },
    },
  };
  const initialized = schemaTools.initializeStageSchemaValues(schema, schemaTools.buildSchemaDefaults(schema), {
    coatingTypes: ['seal_coat', 'film_coat'],
  });
  const restored = schemaTools.initializeStageSchemaValues(schema, {
    coat_passes: {
      seal_coat: { weight_gain: '1.5', equipment_list: [] },
      obsolete_coat: { weight_gain: '9', equipment_list: [] },
    },
  }, {
    coatingTypes: ['seal_coat', 'film_coat'],
  });
  assert.deepEqual(plain(Object.keys(restored.coat_passes)), ['seal_coat', 'film_coat']);
  assert.equal(restored.coat_passes.seal_coat.weight_gain, '1.5');
  initialized.coat_passes.seal_coat = {
    weight_gain: '2.5',
    equipment_list: [{ name: 'Coater', processing_step: 'Spraying', cpp_values: { spray_rate: '40' }, ignored: true }],
  };
  const sanitized = schemaTools.sanitizeForSchema(schema, initialized);
  assert.deepEqual(plain(Object.keys(sanitized.coat_passes)), ['seal_coat', 'film_coat']);
  assert.deepEqual(plain(sanitized.coat_passes.seal_coat), {
    equipment_list: [{ name: 'Coater', processing_step: 'Spraying', cpp_values: { spray_rate: '40' } }],
    weight_gain: 2.5,
  });
  assert.deepEqual(plain(schemaTools.collectStageAssetScopes(schema, initialized).map(scope => scope.key)), ['coat:seal_coat', 'coat:film_coat']);
});

test('coating UI references provide frequency choices and an editable process-hours default', () => {
  const schemaTools = loader()('src/features/stage-input/model/schemaForm.ts');
  const schema = {
    type: 'object',
    properties: {
      in_process_checks_frequency: { type: 'string', title: 'In Process Checks Frequency' },
      coating_process_hours: { type: 'integer', title: 'Coating Process Hours', default: 4 },
    },
    required: ['in_process_checks_frequency', 'coating_process_hours'],
    x_ui_reference: {
      in_process_checks_frequency_options: ['15 min', '30 min', '60 min'],
      coating_process_hours: 6,
    },
  };
  const initialized = schemaTools.initializeStageSchemaValues(
    schema,
    schemaTools.buildSchemaDefaults(schema),
  );
  assert.equal(initialized.coating_process_hours, 6);
  assert.equal(schemaTools.initializeStageSchemaValues(schema, {
    coating_process_hours: 8,
    in_process_checks_frequency: '30 min',
  }).coating_process_hours, 8);
  assert.deepEqual(plain(schemaTools.sanitizeForSchema(schema, {
    coating_process_hours: '7',
    in_process_checks_frequency: '60 min',
  })), {
    in_process_checks_frequency: '60 min',
    coating_process_hours: 7,
  });

  const { SchemaStagePanel } = loader()('src/features/stage-input/components/SchemaStagePanel.tsx');
  const html = renderToStaticMarkup(React.createElement(SchemaStagePanel, {
    schema,
    values: initialized,
    layers: [],
    onChange() {},
  }));
  assert.match(html, /<select/);
  for (const option of ['15 min', '30 min', '60 min']) {
    assert.match(html, new RegExp(`value="${option}"`));
  }
  assert.match(html, /type="number"[^>]*value="6"/);
});

test('dispensing coating parameters show coating types instead of tablet layers', () => {
  const { SchemaStagePanel } = loader()('src/features/stage-input/components/SchemaStagePanel.tsx');
  const schema = {
    type: 'object',
    properties: {
      parameters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'temperature' },
            enabled: { type: 'boolean' },
            mode: { type: 'string' },
            layer: { type: 'string' },
          },
        },
      },
    },
  };
  const html = renderToStaticMarkup(React.createElement(SchemaStagePanel, {
    schema,
    values: { parameters: [{ name: 'temperature', enabled: true, mode: 'record_only', layer: '' }] },
    layers: ['Seal coating', 'Film coating'],
    scopeLabel: 'Coating type',
    onChange() {},
  }));
  assert.match(html, /Coating types/);
  assert.match(html, /2 coating types/);
  assert.match(html, /Seal coating/);
  assert.match(html, /Film coating/);
  assert.doesNotMatch(html, />Layers</);
  assert.doesNotMatch(html, /All coating types/);
  assert.doesNotMatch(html, /All layers/);
});

test('stage params API uses combo-scoped schema, document-scoped saved values, and schema-filtered POST', async () => {
  const calls = [];
  const schema = {
    type: 'object',
    $defs: {
      Param: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'temperature | relative_humidity | differential_pressure | holding_period | yield' },
          enabled: { type: 'boolean', default: true },
          mode: { type: 'string', default: 'record_only' },
        },
      },
    },
    properties: {
      parameters: { type: 'array', items: { $ref: '#/$defs/Param' } },
      lot_size: { type: 'string', default: '1' },
      equipment_list: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, id: { type: 'string' } } } },
    },
  };
  const httpClient = {
    get: async (url, config) => {
      calls.push(['get', url, config]);
      return { data: url.endsWith('/params-schema') ? schema : { lot_size: '2', equipment_list: [] } };
    },
    post: async (...args) => { calls.push(['post', ...args]); return { data: {} }; },
  };
  const api = loader({ '../../../shared/api/httpClient': { httpClient } })('src/features/stage-input/api/stageInputs.api.ts');
  const form = await api.getStageForm('doc/1', 'dispensing_rm', 'Dispensing', 'tablet', 'bmr');
  assert.equal(calls[0][1], '/api/documents/stages/dispensing_rm/params-schema');
  assert.deepEqual(plain(calls[0][2].params), { product_type: 'tablet', doc_type: 'bmr' });
  assert.equal(calls[1][1], '/api/documents/doc%2F1/stages/dispensing_rm/params');
  assert.equal(form.values.lot_size, '2');
  assert.deepEqual(plain(form.values.parameters.map(row => row.name)), ['temperature', 'relative_humidity', 'differential_pressure']);
  await api.saveStageInputs('doc/1', 'dispensing_rm', {
    parameters: [{ name: 'temperature', enabled: true, mode: 'limit' }, { name: 'holding_period', enabled: true, mode: 'record_only' }],
    lot_size: '4',
    equipment_list: [{ name: 'Booth', id: 'E-1', obsolete: 'drop' }],
    ui_only: true,
  }, schema);
  assert.deepEqual(plain(calls.at(-1)[2]), {
    parameters: [{ name: 'temperature', enabled: true, mode: 'limit' }],
    lot_size: '4',
    equipment_list: [{ name: 'Booth', id: 'E-1' }],
  });
});

test('stage selection PUT sends the backend stage_keys contract', async () => {
  const calls = [];
  const httpClient = {
    put: async (...args) => {
      calls.push(args);
      return { data: { document_id: 'doc/1', stages: ['dispensing_rm'] } };
    },
  };
  const api = loader({ '../../../shared/api/httpClient': { httpClient } })('src/features/new-document/api/document.api.ts');
  const result = await api.setStages('doc/1', ['dispensing_rm']);
  assert.deepEqual(plain(calls), [[
    '/api/documents/doc%2F1/stages',
    { stage_keys: ['dispensing_rm'] },
  ]]);
  assert.deepEqual(plain(result), { document_id: 'doc/1', stages: ['dispensing_rm'] });
});

test('every stage key loads through the same schema and saved-params pipeline', async () => {
  const calls = [];
  const httpClient = {
    get: async (url) => {
      calls.push(url);
      if (url.endsWith('/params-schema')) {
        const field = url.includes('/granulation/') ? 'mixing_time' : 'lot_size';
        return { data: { type: 'object', properties: { [field]: { type: 'string', default: '' } } } };
      }
      return { data: {} };
    },
  };
  const api = loader({ '../../../shared/api/httpClient': { httpClient } })('src/features/stage-input/api/stageInputs.api.ts');
  const dispensing = await api.getStageForm('doc-1', 'dispensing_rm', 'Dispensing', 'tablet', 'bmr');
  const granulation = await api.getStageForm('doc-1', 'granulation', 'Granulation', 'tablet', 'bmr');
  assert.ok(dispensing.schema.properties.lot_size);
  assert.ok(granulation.schema.properties.mixing_time);
  assert.ok(calls.includes('/api/documents/stages/dispensing_rm/params-schema'));
  assert.ok(calls.includes('/api/documents/stages/granulation/params-schema'));
  assert.ok(calls.includes('/api/documents/doc-1/stages/dispensing_rm/params'));
  assert.ok(calls.includes('/api/documents/doc-1/stages/granulation/params'));
});

test('new-document choices are enabled from backend options without changing card metadata', async () => {
  const service = loader({
    '../api/document.api': {
      getOptions: async () => ({
        supported_dosage_forms: ['tablet', 'oral_liquid'],
        supported_doc_types: ['bmr', 'pvp'],
        batch_types: [],
        commercial_modes: [],
      }),
    },
  })('src/features/new-document/services/documentSelector.service.ts');
  const context = await service.loadDocumentSelectorContext({ username: 'alice', unitId: 'UNIT-1' }, 'default');
  assert.deepEqual(context.config.dosageForms.map(option => option.backendValue), ['tablet', 'oral_liquid']);
  assert.ok(context.config.dosageForms.every(option => option.available));
  assert.deepEqual(context.config.documentTypes.map(option => option.backendValue), ['bmr', 'pvp']);
  assert.equal(context.config.documentTypes[1].shortLabel, 'PVP');
});

test('already-running generation is recognized by error code for both response envelopes', () => {
  const { getApiErrorCode } = loader({ axios: { isAxiosError: error => error.isAxiosError === true } })('src/shared/api/apiError.ts');
  for (const data of [{ code: 'GENERATION_IN_PROGRESS' }, { detail: { code: 'GENERATION_IN_PROGRESS' } }]) {
    assert.equal(getApiErrorCode({ isAxiosError: true, response: { data } }), 'GENERATION_IN_PROGRESS');
  }
  assert.equal(getApiErrorCode(new Error('other error')), null);
});

test('repeated inputs render the saved slot label and value', () => {
  const { RepeatStagePanel } = loader()('src/features/stages/components/RepeatStagePanel.tsx');
  const html = renderToStaticMarkup(React.createElement(RepeatStagePanel, {
    axis: 'layer', slots: [{ key: 'Layer A', name: 'Active layer' }, { key: 'Layer B', name: 'Other layer' }],
    fields: [{ key: 'temp', type: 'range', label: 'Temperature', unit: '°C', options: [] }],
    reference, byUnit: { 'Layer A': { temp: { min: '20', max: '25' } } }, conditionSources: {},
    onUnitFieldChange() {}, onCopyUnit() {},
  }));
  assert.match(html, /Active layer/);
  assert.match(html, /value="20"/);
  assert.match(html, /value="25"/);
});

function findElement(element, predicate) {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function stageSaveHarness() {
  const calls = [];
  const keys = ['dispensing_rm', 'granulation', 'dispensing_coating', 'coating'];
  const values = {
    dispensing_rm: { layers: 'Bi-layer', layer_config: [{ key: 'Layer A', name: 'Active layer' }] },
    granulation: { per_layer: { 'Layer A': { lot_size: '3' } } },
    dispensing_coating: { coating_types: ['Seal', 'Film'] },
    coating: { per_type: { Seal: { temp: { min: '22' } } } },
    batch_yield: { actual_yield: { min: '97' }, batch_yield: { min: '98' } },
  };
  const options = keys.map(key => ({ key, label: key, implies: [] }));
  const forms = Object.fromEntries(keys.map(key => [key, {
    key, label: key, fields: [], values: values[key],
    schema: { type: 'object', properties: key === 'coating' ? { equipment_list: { type: 'array', items: { type: 'object', properties: {} } } } : {} },
  }]));
  const states = [options, forms, Object.fromEntries(keys.map(key => [key, { checked: true, saved: true, open: false }])), values, true, false, null, {}, {}, null];
  let stateIndex = 0;
  const mocks = {
    react: { ...React, useState: () => [states[stateIndex++], () => {}], useRef: value => ({ current: value }), useEffect() {}, useCallback: fn => fn, useMemo: fn => fn() },
    'react-router-dom': { useParams: () => ({ documentId: 'doc-1' }), useNavigate: () => route => calls.push(['navigate', route]) },
    '../../auth/state/auth.store': { useAuthStore: selector => selector({ user: { username: 'alice' } }) },
    '../../new-document/components/AppHeader': { AppHeader: () => null },
    '../../new-document/components/AppSidebar': { AppSidebar: () => null },
    '../../new-document/components/WizardHeader': { WizardHeader: () => null },
    '../../new-document/hooks/useDocument': { useDocument: () => ({ document: { stages: keys, dosage_form: 'tablet', doc_type: 'bmr', layers: [] }, isLoading: false, reload: async () => {} }) },
    '../../new-document/hooks/useStepNavigation': { useStepNavigation: () => ({ goToStep: step => calls.push(['step', step]) }) },
    '../../new-document/api/document.api': { getStages: async () => ({ stages: options, supported: true }), setStages: async (...args) => calls.push(['selection', ...args]) },
    '../../stage-input/api/stageInputs.api': { getStageForm: async (_id, key) => forms[key], saveStageInputs: async (...args) => calls.push(['save', ...args]) },
    '../../stage-input/components/SchemaStagePanel': { SchemaStagePanel: () => null },
    '../../stage-input/model/schemaForm': {
      validateSchema: () => [],
      schemaHasAssetInputs: schema => Boolean(schema?.properties?.equipment_list || schema?.properties?.instrument_list),
    },
  };
  const { SelectStagesPage } = loader(mocks)('src/features/stages/pages/SelectStagesPage.tsx');
  return { tree: SelectStagesPage(), calls, values };
}

test('final stage save posts only selected schema-backed stages without an invented stage', async () => {
  const { tree, calls, values } = stageSaveHarness();
  const button = findElement(tree, element => element.type === 'button' && React.Children.toArray(element.props.children).includes('Continue to review & generate'));
  assert.ok(button);
  button.props.onClick();
  await new Promise(setImmediate);
  const selected = calls.find(call => call[0] === 'selection')[2];
  assert.ok(!selected.includes('batch_yield'));
  const saves = calls.filter(call => call[0] === 'save');
  assert.deepEqual(saves.map(call => call[2]), ['dispensing_rm', 'granulation', 'dispensing_coating', 'coating']);
  assert.deepEqual(plain(saves.find(call => call[2] === 'granulation')[3]), values.granulation);
  assert.deepEqual(plain(saves.find(call => call[2] === 'coating')[3]), values.coating);
});

test('per-stage Continue saves only the canonical stage and navigates with its key', async () => {
  const { tree, calls } = stageSaveHarness();
  const row = findElement(tree, element => element.type?.name === 'StageRow' && element.props.stage.key === 'coating');
  assert.ok(row);
  row.props.onContinue();
  await new Promise(setImmediate);
  assert.deepEqual(calls.filter(call => call[0] === 'save').map(call => call[2]), ['coating']);
  assert.match(calls.at(-1)[1], /stage-input\?stage=coating&label=coating$/);
});

test('an already-running generation starts polling instead of showing a failure', async () => {
  let stateIndex = 0;
  const states = [null, null, false, false, false];
  const updates = [];
  const polls = [];
  let progressRequests = 0;
  const mocks = {
    react: { ...React, useState: () => { const index = stateIndex++; return [states[index], value => updates.push([index, value])]; }, useRef: value => ({ current: value }), useEffect() {}, useCallback: fn => fn },
    'react-router-dom': { useParams: () => ({ documentId: 'doc-1' }) },
    '../../../shared/api/apiError': { getApiErrorCode: error => error.code, getApiErrorMessage: () => 'GENERATION ERROR' },
    '../../../shared/document/DocumentViewer': { DocumentViewer: () => null },
    '../../auth/state/auth.store': { useAuthStore: selector => selector({ user: { username: 'alice' } }) },
    '../../new-document/components/AppHeader': { AppHeader: () => null },
    '../../new-document/components/AppSidebar': { AppSidebar: () => null },
    '../../new-document/components/WizardHeader': { WizardHeader: () => null },
    '../../new-document/hooks/useDocument': { useDocument: () => ({ document: {}, reload: async () => {} }) },
    '../../new-document/hooks/useStepNavigation': { useStepNavigation: () => ({ goToStep() {} }) },
    '../api/generate.api': {
      generateDocument: async () => { throw { code: 'GENERATION_IN_PROGRESS' }; },
      getGenerateProgress: async () => { progressRequests++; return { status: 'running', percent: 30, step: 'Building', result: null, error: null }; },
    },
  };
  const { GenerateSubmitPage } = loader(mocks, { window: { clearInterval() {}, setInterval: callback => { polls.push(callback); return polls.length; } } })('src/features/generate/pages/GenerateSubmitPage.tsx');
  const tree = GenerateSubmitPage();
  const build = findElement(tree, element => element.type?.name === 'ToolbarButton' && element.props.children === 'Build .docx');
  assert.ok(build);
  build.props.onClick();
  await new Promise(setImmediate);
  assert.equal(progressRequests, 1);
  assert.equal(polls.length, 1);
  assert.ok(!updates.some(([index, value]) => index === 1 && value));
});
