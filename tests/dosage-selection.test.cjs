const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, { exports, ...globals, require(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (!name.startsWith(".")) return require(name);
      const base = path.resolve(path.dirname(file), name);
      const resolved = [base, `${base}.ts`, `${base}.tsx`]
        .find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!resolved) throw Error(`Missing dependency: ${name}`);
      return load(resolved);
    } }, { filename: file });
    return exports;
  }
  return load;
}

test("API dosage values resolve to the merged and injection labels without enabling unsupported generation", async () => {
  const load = loader({ "../api/document.api": { getOptions: async () => ({
    supported_dosage_forms: ["tablet", "capsule", "cream_ointment", "injection", "powder", "oral_liquid"],
    supported_doc_types: ["bmr"],
  }) } });
  const { loadDocumentSelectorContext } = load("src/features/new-document/services/documentSelector.service.ts");
  const context = await loadDocumentSelectorContext({}, "default");
  const forms = context.config.dosageForms;
  assert.equal(forms.find(f => f.backendValue === "cream_ointment").label, "Cream/Ointment");
  assert.equal(forms.find(f => f.backendValue === "injection").label, "Injection");
  assert.equal(forms.find(f => f.backendValue === "cream_ointment").available, false);
  assert.equal(forms.find(f => f.backendValue === "injection").available, false);
  assert.equal(forms.find(f => f.backendValue === "tablet").available, true);
  assert.equal(forms.some(f => ["cream", "ointment"].includes(f.backendValue)), false);
});

test("saved Cream and Ointment selections restore the merged master-data category", () => {
  for (const previous of ["cream", "ointment", "cream_ointment"]) {
    const load = loader({}, { window: { localStorage: {
      getItem: () => JSON.stringify({ dosageFormId: previous, documentTypeId: "bmr" }),
      setItem: () => {},
    } } });
    const { useSetupStore, getSelectedTypeMeta } = load("src/features/master-data-setup/state/setupStore.ts");
    assert.equal(useSetupStore.getState().dosageFormId, "cream-ointment");
    const meta = getSelectedTypeMeta(previous, "bmr");
    assert.equal(meta.dosageBackend, "cream_ointment");
    assert.equal(meta.dosageLabel, "Cream/Ointment");
    assert.notEqual(meta.dosageBackend, "injection");
  }
});
