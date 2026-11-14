import { test } from "node:test";
import assert from "node:assert/strict";

test("opções mostram gravação/leitura e renovam acesso no clique sem expor arquivo", async () => {
  const before = {
    chrome: globalThis.chrome,
    document: globalThis.document,
    window: globalThis.window,
    indexedDB: globalThis.indexedDB,
  };
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        textContent: "",
        handlers: {},
        addEventListener(event, callback) {
          this.handlers[event] = callback;
        },
      });
    return elements.get(id);
  };
  let selected,
    changed,
    permission = "granted",
    inClick = false;
  const activity = {};
  const handle = {
    name: "arquivo-privado.txt",
    queryPermission: async () => permission,
    requestPermission: async (options) => {
      assert.deepEqual(options, { mode: "readwrite" });
      permission = "granted";
      return permission;
    },
    getFile: async () => ({ size: 0, text: async () => "" }),
  };
  globalThis.document = { getElementById: element };
  globalThis.window = {
    showOpenFilePicker: () => {
      assert.equal(inClick, true);
      return Promise.resolve([handle]);
    },
  };
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({ ...activity }),
        remove: async (keys) => {
          for (const key of keys) delete activity[key];
        },
      },
      onChanged: {
        addListener: (callback) => {
          changed = callback;
        },
      },
    },
  };
  globalThis.indexedDB = {
    open() {
      const request = {
        result: {
          close() {},
          transaction() {
            const tx = {
              objectStore: () => ({
                get: () => finish(selected),
                put: (value) => {
                  selected = value;
                  return finish();
                },
                delete: () => {
                  selected = undefined;
                  return finish();
                },
              }),
            };
            function finish(result) {
              const operation = { result };
              queueMicrotask(() => {
                operation.onsuccess();
                tx.oncomplete();
              });
              return operation;
            }
            return tx;
          },
        },
      };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  try {
    await import(`./options.js?test=${Date.now()}`);
    await flush();
    assert.match(
      element("last-write").textContent,
      /Nenhuma gravação confirmada/,
    );
    inClick = true;
    element("select").handlers.click();
    inClick = false;
    await flush();
    assert.match(element("status").textContent, /sessão ainda não foi salva/);
    assert.match(
      element("selection").textContent,
      /leitura e escrita autorizadas/,
    );
    await element("check").handlers.click();
    assert.match(element("status").textContent, /arquivo está vazio/);
    permission = "prompt";
    // Não há await/IndexedDB antes do prompt: ativação precisa ser a do clique.
    handle.requestPermission = () => {
      assert.equal(inClick, true);
      permission = "granted";
      return Promise.resolve(permission);
    };
    inClick = true;
    const renewal = element("permission").handlers.click();
    inClick = false;
    await renewal;
    assert.match(element("status").textContent, /Permissão renovada/);
    activity["redeasso.fileActivity.write"] = {
      code: "FILE_SAVED",
      at: new Date().toISOString(),
    };
    changed({}, "local");
    await flush();
    assert.match(element("last-write").textContent, /Sessão salva/);
    activity["redeasso.fileActivity.read"] = {
      code: "FILE_REJECTED",
      at: new Date().toISOString(),
    };
    changed({}, "local");
    await flush();
    assert.match(element("last-read").textContent, /servidor recusou/);
    assert.equal(
      [...elements.values()].some((node) =>
        node.textContent.includes(handle.name),
      ),
      false,
    );
    await element("forget").handlers.click();
    assert.equal(selected, undefined);
    assert.match(
      element("last-write").textContent,
      /Nenhuma gravação confirmada/,
    );
  } finally {
    Object.assign(globalThis, before);
  }
});
