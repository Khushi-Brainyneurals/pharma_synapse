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
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (!name.startsWith(".")) return require(name);

        const base = path.resolve(path.dirname(file), name);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find(
          (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
        );
        if (!resolved) throw new Error(`Missing test dependency: ${name}`);
        return load(resolved);
      },
    }, { filename: file });

    return exports;
  }

  return load;
}

class TestAxiosHeaders {
  constructor(values = {}) {
    this.values = { ...values };
  }

  delete(name) {
    delete this.values[name];
  }

  get(name) {
    const key = Object.keys(this.values).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase(),
    );
    return key ? this.values[key] : undefined;
  }

  set(name, value) {
    this.values[name] = value;
  }
}

function authHarness({ refreshResponse, refreshError, refreshToken = "refresh-1" } = {}) {
  const calls = { refresh: [], retries: [] };
  let responseRejected;
  let requestFulfilled;
  let storedSession = {
    accessToken: "access-old",
    refreshToken,
    user: { id: "alice", username: "alice", role: "preparer" },
  };

  const state = {
    ...storedSession,
    isAuthenticated: true,
    setSession(session) {
      storedSession = session;
      Object.assign(state, session, { isAuthenticated: true });
    },
    clearSession() {
      storedSession = null;
      Object.assign(state, {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    },
  };

  function createClient(kind) {
    const client = async (config) => {
      calls.retries.push(config);
      return { data: { ok: true }, config };
    };
    client.interceptors = {
      request: {
        use(fulfilled) {
          if (kind === "http") requestFulfilled = fulfilled;
        },
      },
      response: {
        use(_fulfilled, rejected) {
          if (kind === "http") responseRejected = rejected;
        },
      },
    };
    client.post = async (url, body) => {
      calls.refresh.push({ url, body });
      if (refreshError) throw refreshError;
      return {
        data: refreshResponse ?? {
          access_token: "access-new",
          refresh_token: null,
        },
      };
    };
    return client;
  }

  let created = 0;
  const axios = {
    AxiosHeaders: TestAxiosHeaders,
    create() {
      created += 1;
      return createClient(created === 1 ? "http" : "refresh");
    },
    isAxiosError(error) {
      return error?.isAxiosError === true;
    },
  };

  const { httpClient } = loader({
    axios,
    "../../features/auth/state/auth.store": {
      useAuthStore: { getState: () => state },
    },
    "../../features/auth/storage/auth.storage": {
      getPersistedSession: () => storedSession,
      getStoredRefreshToken: () => storedSession?.refreshToken ?? null,
    },
    "../config/env": { env: { apiBaseUrl: "https://example.test" } },
  }, {
    FormData: class TestFormData {},
  })("src/shared/api/httpClient.ts");

  function unauthorized(url = "/api/documents", overrides = {}) {
    const config = {
      url,
      headers: new TestAxiosHeaders({ Authorization: "Bearer access-old" }),
      ...overrides,
    };
    return { response: { status: 401 }, config };
  }

  return {
    calls,
    httpClient,
    requestFulfilled: (...args) => requestFulfilled(...args),
    responseRejected: (...args) => responseRejected(...args),
    state,
    unauthorized,
  };
}

test("login keeps both tokens and the backend address in the session", async () => {
  const httpClient = {
    post: async () => ({
      data: {
        access_token: "access-1",
        refresh_token: "refresh-1",
        address_id: 7,
        address: "Demo Test Address",
      },
    }),
  };
  const { login } = loader({
    "../../../shared/api/httpClient": { httpClient },
    "../../../shared/config/env": { env: { useMockApi: false } },
  })("src/features/auth/api/auth.api.ts");

  const session = await login({
    username: "alice",
    password: "secret",
    role: "preparer",
  });

  assert.equal(session.accessToken, "access-1");
  assert.equal(session.refreshToken, "refresh-1");
  assert.equal(session.user.addressId, 7);
  assert.equal(session.user.address, "Demo Test Address");
});

test("concurrent 401 responses share one refresh and keep a null refresh token", async () => {
  const harness = authHarness();
  const results = await Promise.all([
    harness.responseRejected(harness.unauthorized("/api/a")),
    harness.responseRejected(harness.unauthorized("/api/b")),
    harness.responseRejected(harness.unauthorized("/api/c")),
  ]);

  assert.equal(harness.calls.refresh.length, 1);
  assert.equal(harness.calls.refresh[0].url, "/refresh");
  assert.equal(harness.calls.refresh[0].body.refresh_token, "refresh-1");
  assert.equal(harness.calls.retries.length, 3);
  assert.equal(harness.state.accessToken, "access-new");
  assert.equal(harness.state.refreshToken, "refresh-1");
  assert.ok(results.every((result) => result.data.ok));
  assert.ok(
    harness.calls.retries.every(
      (config) => config.headers.get("Authorization") === "Bearer access-new",
    ),
  );
});

test("a rotated refresh token replaces the stored token", async () => {
  const harness = authHarness({
    refreshResponse: {
      access_token: "access-new",
      refresh_token: "refresh-2",
    },
  });

  await harness.responseRejected(harness.unauthorized());

  assert.equal(harness.state.accessToken, "access-new");
  assert.equal(harness.state.refreshToken, "refresh-2");
});

test("a late 401 sent with the old token reuses the refreshed access token", async () => {
  const harness = authHarness();

  await harness.responseRejected(harness.unauthorized("/api/first"));
  await harness.responseRejected(harness.unauthorized("/api/late"));

  assert.equal(harness.calls.refresh.length, 1);
  assert.equal(harness.calls.retries.length, 2);
  assert.equal(
    harness.calls.retries[1].headers.get("Authorization"),
    "Bearer access-new",
  );
});

test("an invalid refresh token clears the session", async () => {
  const harness = authHarness({
    refreshError: { isAxiosError: true, response: { status: 401 } },
  });

  await assert.rejects(
    harness.responseRejected(harness.unauthorized()),
    (error) => error.response.status === 401,
  );
  assert.equal(harness.state.isAuthenticated, false);
  assert.equal(harness.state.accessToken, null);
  assert.equal(harness.state.refreshToken, null);
});

test("a missing refresh token clears the session without calling refresh", async () => {
  const harness = authHarness({ refreshToken: null });

  await assert.rejects(harness.responseRejected(harness.unauthorized()));
  assert.equal(harness.calls.refresh.length, 0);
  assert.equal(harness.state.isAuthenticated, false);
});

test("temporary refresh server errors do not destroy the stored session", async () => {
  const harness = authHarness({
    refreshError: { isAxiosError: true, response: { status: 503 } },
  });

  await assert.rejects(harness.responseRejected(harness.unauthorized()));
  assert.equal(harness.state.isAuthenticated, true);
  assert.equal(harness.state.refreshToken, "refresh-1");
});

test("login, refresh, logout, anonymous, and already retried 401s never refresh", async () => {
  const harness = authHarness();
  const errors = [
    harness.unauthorized("/login"),
    harness.unauthorized("/refresh"),
    harness.unauthorized("/logout"),
    harness.unauthorized("/api/already-retried", { _retry: true }),
    harness.unauthorized("/api/anonymous", { headers: new TestAxiosHeaders() }),
  ];

  for (const error of errors) {
    await assert.rejects(harness.responseRejected(error));
  }

  assert.equal(harness.calls.refresh.length, 0);
  assert.equal(harness.calls.retries.length, 0);
  assert.equal(harness.state.isAuthenticated, true);
});

test("the request interceptor continues to send only the access token as bearer", () => {
  const harness = authHarness();
  const config = { headers: new TestAxiosHeaders() };

  harness.requestFulfilled(config);

  assert.equal(config.headers.Authorization, "Bearer access-old");
  assert.doesNotMatch(config.headers.Authorization, /refresh-1/);
});
