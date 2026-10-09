const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadSource(file, mocks = {}) {
  const resolved = path.resolve(root, file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Unexpected test dependency: ${name}`);
    },
  }, { filename: resolved });

  return exports;
}

test("stage matching is safe, case-insensitive, and accepts either descriptive side", () => {
  const { filterByStage, isStageMatch } = loadSource(
    "src/features/stage-input/model/stageMatch.ts",
  );

  assert.equal(isStageMatch("Granulation", "Granulation"), true);
  assert.equal(isStageMatch(" granulation ", "GRANULATION"), true);
  assert.equal(isStageMatch("granulation-1", "Granulation"), true);
  assert.equal(isStageMatch("Dispensing", "Dispensing of Raw Material"), true);
  assert.equal(isStageMatch("Compression", "Granulation"), false);
  assert.equal(isStageMatch(null, "Granulation"), false);
  assert.equal(isStageMatch("Granulation", undefined), false);

  const granulation = { stage: "granulation-1", name: "FBP" };
  const rows = [
    granulation,
    { stage: "Compression", name: "Tablet press" },
    { stage: null, name: "Missing stage" },
    { stage: "Coating", name: "Granulation appears only in the name" },
  ];
  const result = filterByStage(rows, "Granulation");
  assert.equal(result.length, 1);
  assert.equal(result[0], granulation);
});

test("the same stage rule applies generically across all master-data stages", () => {
  const { isStageMatch } = loadSource(
    "src/features/stage-input/model/stageMatch.ts",
  );
  const stages = [
    "Dispensing",
    "Granulation",
    "Compression",
    "Coating",
    "Capsule",
    "Inspection",
    "Primary Packing",
    "Secondary Packing",
  ];

  for (const stage of stages) {
    assert.equal(isStageMatch(stage.toUpperCase(), stage), true, stage);
    assert.equal(isStageMatch(`  ${stage.toLowerCase()}-1  `, stage), true, `${stage} suffix`);
    assert.equal(isStageMatch("Unrelated stage", stage), false, `${stage} exclusion`);
  }
});

test("every CPP must be filled, including every coating-type scope", () => {
  const { areCppValuesComplete, areScopedCppValuesComplete } = loadSource(
    "src/features/stage-input/model/cppValidation.ts",
  );
  const parameters = ["Pan speed", "Spray rate"];

  assert.equal(areCppValuesComplete(parameters, {
    "Pan speed": "8",
    "Spray rate": " 40 ",
  }), true);
  assert.equal(areCppValuesComplete(parameters, {
    "Pan speed": "8",
    "Spray rate": "   ",
  }), false);
  assert.equal(areCppValuesComplete([], undefined), true);

  assert.equal(areScopedCppValuesComplete(parameters, ["coat:seal", "coat:film"], {
    "coat:seal": { "Pan speed": "8", "Spray rate": "35" },
    "coat:film": { "Pan speed": "10", "Spray rate": "40" },
  }), true);
  assert.equal(areScopedCppValuesComplete(parameters, ["coat:seal", "coat:film"], {
    "coat:seal": { "Pan speed": "8", "Spray rate": "35" },
    "coat:film": { "Pan speed": "10" },
  }), false);
});

test("master data loads both source-of-truth endpoints, caches them, and keeps full active rows", async () => {
  const calls = [];
  const equipment = {
    name_of_machine: "Fluid bed Processor (FBP)",
    machine_id_no: "GR/09",
    stage: "granulation-1",
    steps: [{ step: "Final Drying", cpp: ["LOD"] }],
    _is_active: true,
  };
  const instrument = {
    name_of_instrument: "Weighing Balance",
    instrument_id_no: "PR/03",
    stage: "Granulation",
    _is_active: true,
  };
  const httpClient = {
    get: async (url) => {
      calls.push(url);
      if (url.endsWith("/equipments")) {
        return { data: { rows: [equipment, { ...equipment, machine_id_no: "OLD", _is_active: false }] } };
      }
      return { data: { rows: [instrument, { ...instrument, instrument_id_no: "OLD", _is_active: false }] } };
    },
  };
  const api = loadSource("src/features/stage-input/api/masterData.ts", {
    "../../../shared/api/httpClient": { httpClient },
  });

  const first = await api.getMasterData();
  const second = await api.getMasterData();

  assert.deepEqual(calls.sort(), [
    "/api/master-data/equipments",
    "/api/master-data/instruments",
  ]);
  assert.equal(first.equipments.length, 1);
  assert.equal(first.instruments.length, 1);
  assert.equal(first.equipments[0].steps[0].cpp[0], "LOD");
  assert.equal(first.equipments[0].machine_id_no, "GR/09");
  assert.equal(second.equipments[0], first.equipments[0]);
  assert.deepEqual(Object.keys(first.errors), []);
});

test("one failed optional master does not discard the other and remains retryable", async () => {
  let instrumentAttempts = 0;
  const httpClient = {
    get: async (url) => {
      if (url.endsWith("/equipments")) {
        return { data: { rows: [{ stage: "Coating", _is_active: true }] } };
      }
      instrumentAttempts += 1;
      if (instrumentAttempts === 1) throw new Error("instrument unavailable");
      return { data: { rows: [{ stage: "Coating", _is_active: true }] } };
    },
  };
  const api = loadSource("src/features/stage-input/api/masterData.ts", {
    "../../../shared/api/httpClient": { httpClient },
  });

  const partial = await api.getMasterData();
  assert.equal(partial.equipments.length, 1);
  assert.equal(partial.instruments.length, 0);
  assert.match(String(partial.errors.instruments), /instrument unavailable/);

  const retried = await api.getMasterData();
  assert.equal(instrumentAttempts, 2);
  assert.equal(retried.equipments.length, 1);
  assert.equal(retried.instruments.length, 1);
  assert.deepEqual(Object.keys(retried.errors), []);
});
