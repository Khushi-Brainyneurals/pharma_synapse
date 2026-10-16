const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadApi(httpClient) {
  const file = path.resolve(root, "src/features/audit-trail/api/auditTrail.api.ts");
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === "../../../shared/api/httpClient") return { httpClient };
      throw Error(`Unexpected dependency: ${name}`);
    },
  }, { filename: file });
  return exports;
}

test("audit API sends every supported non-empty query parameter", async () => {
  const calls = [];
  const api = loadApi({
    get: async (...args) => {
      calls.push(args);
      return { data: [{ id: 930 }] };
    },
  });
  const signal = new AbortController().signal;
  const records = await api.getAuditLogs({
    actor_id: " demo_preparer ", actor_role: "preparer", action: "Complete",
    result: "done", entity: "document_generation", entity_id: "doc-1",
    ip_address: "127.0.0.1", session_id: 12,
    start_date: "2026-10-01T00:00:00.000+05:30",
    end_date: "2026-10-15T23:59:59.999+05:30",
  }, signal);

  assert.equal(calls[0][0], "/audit");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1].params)), {
    actor_id: "demo_preparer", actor_role: "preparer", action: "Complete",
    result: "done", entity: "document_generation", entity_id: "doc-1",
    ip_address: "127.0.0.1", session_id: 12,
    start_date: "2026-10-01T00:00:00.000+05:30",
    end_date: "2026-10-15T23:59:59.999+05:30",
  });
  assert.equal(calls[0][1].signal, signal);
  assert.equal(records[0].id, 930);
});

test("audit API omits empty values and rejects an unexpected response", async () => {
  let config;
  const api = loadApi({ get: async (_url, nextConfig) => { config = nextConfig; return { data: {} }; } });
  await assert.rejects(() => api.getAuditLogs({ actor_id: " ", session_id: Number.NaN }), /AUDIT_LIST_RESPONSE_INVALID/);
  assert.deepEqual(JSON.parse(JSON.stringify(config.params)), {});
});

test("audit API normalizes missing and malformed nullable fields safely", async () => {
  const api = loadApi({ get: async () => ({ data: [null, { id: 2, actor_id: 7, before: { nested: true } }] }) });
  const records = await api.getAuditLogs();
  assert.equal(records[0].actor_id, null);
  assert.equal(records[0].session_id, null);
  assert.equal(records[1].actor_id, "7");
  assert.deepEqual(JSON.parse(JSON.stringify(records[1].before)), { nested: true });
});

test("audit calendar dates preserve IST and include the entire end date", () => {
  const api = loadApi({});
  assert.equal(api.auditDateTime("2026-10-15", "start"), "2026-10-15T00:00:00.000+05:30");
  assert.equal(api.auditDateTime("2026-10-15", "end"), "2026-10-15T23:59:59.999+05:30");
  assert.equal(api.auditDateTime("2026-02-30", "start"), undefined);
});
