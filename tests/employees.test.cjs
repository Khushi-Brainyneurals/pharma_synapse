const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (!name.startsWith(".")) return require(name);
        const base = path.resolve(path.dirname(file), name);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
        );
        if (!resolved) throw Error(`Missing test dependency: ${name}`);
        return load(resolved);
      },
    }, { filename: file });
    return exports;
  }
  return load;
}

test("employee APIs use the supplied contract and encode user IDs", async () => {
  const calls = [];
  const employee = {
    user_id: "demo/user",
    roles: ["preparer"],
    department: "Packaging",
    unit: "Production",
    address_id: 1,
    address: "Demo Test Address",
    status: "active",
    created_at: "2026-09-30T13:41:29.505871Z",
  };
  const httpClient = {
    get: async (...args) => { calls.push(["get", ...args]); return { data: [employee] }; },
    post: async (...args) => { calls.push(["post", ...args]); return { data: employee }; },
    patch: async (...args) => { calls.push(["patch", ...args]); return { data: { data: employee } }; },
    delete: async (...args) => { calls.push(["delete", ...args]); return { data: null }; },
  };
  const api = loader({ "../../../shared/api/httpClient": { httpClient } })(
    "src/features/employees/api/employees.api.ts",
  );

  const create = { ...employee, password: "secret" };
  delete create.address;
  delete create.created_at;
  const update = { ...create };
  delete update.password;
  await api.listEmployees();
  await api.createEmployee(create);
  await api.updateEmployee(employee.user_id, update);
  await api.deleteEmployee(employee.user_id);
  await api.changeEmployeePassword(employee.user_id, {
    old_password: "old",
    new_password: "new",
  });

  assert.equal(calls[0][1], "/employee");
  assert.equal(calls[1][1], "/employee/register");
  assert.equal(calls[2][1], "/employee/demo%2Fuser/update");
  assert.equal("password" in calls[2][2], false);
  assert.equal(calls[3][1], "/employee/demo%2Fuser/delete");
  assert.equal(calls[4][1], "/employee/demo%2Fuser/change-password");
  assert.deepEqual(calls[4][2], { old_password: "old", new_password: "new" });
});

test("employee management is limited to established admin roles", () => {
  const { canManageEmployees } = loader()("src/features/employees/access.ts");
  assert.equal(canManageEmployees("admin"), true);
  for (const role of ["superadmin", "employee", "preparer", "reviewer_qa", "reviewer_pr", "approver", null]) {
    assert.equal(canManageEmployees(role), false);
  }
});
