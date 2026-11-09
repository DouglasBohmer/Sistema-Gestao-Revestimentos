import { test } from "node:test";
import assert from "node:assert/strict";
import { pisoStatus, statusTextColor, STATUS_LABELS } from "./piso-status.ts";
test("mantém cinco status sem inferir fora de linha por estoque zero", () => {
  assert.equal(Object.keys(STATUS_LABELS).length, 5);
  assert.equal(
    pisoStatus({ codigoRede: "1", statusAreaCentral: "PADRAO", estoqueM2: 0 }),
    "PADRAO",
  );
  assert.equal(
    pisoStatus({ codigoRede: "1", statusAreaCentral: "ACABAR", estoqueM2: 1 }),
    "ACABAR",
  );
  assert.equal(
    pisoStatus({ codigoRede: "1", statusAreaCentral: "NEGOCIACAO" }),
    "NEGOCIACAO",
  );
  assert.equal(
    pisoStatus({ codigoRede: "1", statusAreaCentral: "NAO_ENCONTRADO" }),
    "FORA_DE_LINHA",
  );
  assert.equal(
    pisoStatus({ codigoRede: "1", statusAreaCentral: "Fora de linha" }),
    "FORA_DE_LINHA",
  );
  assert.equal(pisoStatus({ codigoRede: null }), "PRODUTO_LOCAL");
  assert.equal(pisoStatus({ codigoRede: "1" }), "NAO_CONSULTADO");
  assert.equal(
    pisoStatus({ codigoRede: "1", statusAreaCentral: "NOVO_STATUS" }),
    "NOVO_STATUS",
  );
});
test("texto contrasta com cor de fundo selecionada", () => {
  assert.equal(statusTextColor("#ffffff"), "#000000");
  assert.equal(statusTextColor("#000000"), "#ffffff");
});
