const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadCompanyApi(httpClient, globals = {}) {
  const file = path.join(root, "src/features/company/api/company.api.ts");
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    ...globals,
    require(name) {
      if (name === "../../../shared/api/httpClient") return { httpClient };
      return require(name);
    },
  }, { filename: file });
  return exports;
}

const response = {
  company_name: "Test Pharma Pvt. Ltd. q",
  logo_path: "/home/ubuntu/pharma/data/uploads/company/logo.png",
  font_name: "Arial",
  font_size: 10,
  line_spacing: 1.5,
  addresses: [{ address_id: 1, address: "Demo Test Address" }],
  updated_at: "2026-10-09T11:49:14.248738",
  is_complete: true,
  missing: [],
  approval_status: "approved",
};

test("company info maps the first backend address and derives logo availability", async () => {
  const httpClient = { get: async () => ({ data: response }) };
  const api = loadCompanyApi(httpClient);
  const company = await api.getCompanyInfo();

  assert.equal(company.address, "Demo Test Address");
  assert.equal(company.addresses[0].address_id, 1);
  assert.equal(company.has_logo, true);
  assert.equal(company.logo_path, response.logo_path);
  assert.equal(company.is_effective, true);
});

test("company logo is fetched as an authenticated-client blob and converted to an object URL", async () => {
  const calls = [];
  const blob = { binary: true };
  const httpClient = {
    get: async (...args) => {
      calls.push(args);
      return { data: blob };
    },
  };
  const api = loadCompanyApi(httpClient, {
    window: { URL: { createObjectURL: (value) => value === blob ? "blob:company-logo" : null } },
  });

  assert.equal(await api.fetchLogoObjectUrl(), "blob:company-logo");
  assert.equal(calls[0][0], "/api/company-info/logo");
  assert.equal(calls[0][1].responseType, "blob");
});
