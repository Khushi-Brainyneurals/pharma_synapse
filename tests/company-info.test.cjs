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
  header_size: 1,
  footer_size: 0.5,
  footer_template_nos: {
    bmr: "BMR-01",
    bpr: "",
    pvp_manufacturing: "PVP-M-01",
    pvp_packing: "",
    pvr_manufacturing: "",
    pvr_packing: "PVR-P-01",
    cpv_manufacturing: "CPV-M-01",
    cpv_packing: "CPV-P-01",
  },
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
  assert.equal(company.header_size, 1);
  assert.equal(company.footer_size, 0.5);
  assert.equal(company.footer_template_nos.bmr, "BMR-01");
  assert.equal(company.footer_template_nos.cpv_manufacturing, "CPV-M-01");
  assert.equal(company.footer_template_nos.cpv_packing, "CPV-P-01");
  assert.equal(company.is_effective, true);
});

test("company info update sends the new formatting and address contract unchanged", async () => {
  const calls = [];
  const httpClient = {
    put: async (...args) => {
      calls.push(args);
      return { data: response };
    },
  };
  const api = loadCompanyApi(httpClient);
  const payload = {
    company_name: "Test Pharma Pvt. Ltd. q",
    font_name: "Arial",
    font_size: 10,
    line_spacing: 1.5,
    header_size: 1,
    footer_size: 0.5,
    footer_template_nos: response.footer_template_nos,
    addresses: ["Demo Test Address"],
    user: "qa-user",
  };

  await api.updateCompanyInfo(payload);

  assert.equal(calls[0][0], "/api/company-info");
  assert.deepEqual(calls[0][1], payload);
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
