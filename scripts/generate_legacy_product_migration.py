"""Gera a migration PostgreSQL da carga legada a partir do dump do XAMPP.

Uso, a partir da raiz do repositório:
    python scripts/generate_legacy_product_migration.py
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "BK_banco" / "calcula_piso.sql"
TARGET = (
    ROOT
    / "backend-gestao-revestimento"
    / "src"
    / "main"
    / "resources"
    / "db"
    / "migration"
    / "V6__import_legacy_products.sql"
)
COLUMNS = [
    "nome",
    "cod_asso",
    "cod_ctc",
    "largura",
    "altura",
    "rejunte",
    "pecas_cx",
    "m_cx",
    "local_uso",
    "tipo_piso",
    "pei",
    "retificado",
    "site",
    "foto",
    "ambiente",
]
CLASS_ORDER = {name: index for index, name in enumerate(("LA", "LB", "LC", "LD", "LE", "LF"), 1)}


def parse_rows(sql: str, start: int) -> tuple[list[list[str]], int]:
    rows: list[list[str]] = []
    index = start
    while index < len(sql):
        while index < len(sql) and (sql[index].isspace() or sql[index] == ","):
            index += 1
        if index >= len(sql) or sql[index] == ";":
            return rows, index
        if sql[index] != "(":
            raise ValueError(f"Esperado '(' na posição {index}")
        index += 1
        row: list[str] = []
        while True:
            while sql[index].isspace():
                index += 1
            if sql[index] != "'":
                raise ValueError(f"Esperado valor textual na posição {index}")
            index += 1
            value: list[str] = []
            while True:
                char = sql[index]
                if char == "\\" and index + 1 < len(sql):
                    value.append(sql[index + 1])
                    index += 2
                    continue
                if char == "'":
                    if index + 1 < len(sql) and sql[index + 1] == "'":
                        value.append("'")
                        index += 2
                        continue
                    index += 1
                    break
                value.append(char)
                index += 1
            row.append("".join(value))
            while sql[index].isspace():
                index += 1
            if sql[index] == ",":
                index += 1
                continue
            if sql[index] != ")":
                raise ValueError(f"Esperado ')' na posição {index}")
            index += 1
            rows.append(row)
            break
    return rows, index


def load_source() -> list[dict[str, str]]:
    sql = SOURCE.read_text(encoding="utf-8")
    marker = "INSERT INTO `piso`"
    position = 0
    parsed: list[list[str]] = []
    while True:
        statement = sql.find(marker, position)
        if statement < 0:
            break
        values = sql.index("VALUES", statement) + len("VALUES")
        batch, end = parse_rows(sql, values)
        parsed.extend(batch)
        position = end + 1
    if len(parsed) != 264 or any(len(row) != len(COLUMNS) for row in parsed):
        raise ValueError(f"Carga inesperada: {len(parsed)} linhas")
    return [dict(zip(COLUMNS, row, strict=True)) for row in parsed]


def clean(value: str) -> str | None:
    normalized = value.strip()
    return normalized or None


def classification(value: str) -> str | None:
    normalized = value.strip().upper()
    if not normalized:
        return None
    if normalized.isdigit():
        number = int(normalized)
        return ("LA", "LB", "LC", "LD", "LE")[number - 1] if 1 <= number <= 5 else None
    normalized = normalized.replace("ALTO TRÁFEGO", "LD")
    normalized = normalized.replace("LCI", "LC")
    normalized = re.sub(r"\b(?:LS|LR)\b", "LD", normalized)
    normalized = re.sub(r"\bFL\b", "LF", normalized)
    found = re.findall(r"\bL[A-F]\b", normalized)
    if not found:
        raise ValueError(f"Classificação não reconhecida: {value!r}")
    return max(found, key=CLASS_ORDER.__getitem__)


def border_finish(value: str) -> str:
    return "RETIFICADO" if value.strip().casefold().startswith("sim") else "BOLD"


def consolidate(rows: list[dict[str, str]]) -> list[tuple[dict[str, str], list[dict[str, str]]]]:
    by_asso = {code: [row for row in rows if row["cod_asso"].strip() == code] for code in ("2181381", "2178116")}
    by_ctc = {"6877": [row for row in rows if row["cod_ctc"].strip() == "6877"]}
    duplicate_ids = {id(row) for group in (*by_asso.values(), *by_ctc.values()) for row in group}
    result: list[tuple[dict[str, str], list[dict[str, str]]]] = [
        (row.copy(), [row]) for row in rows if id(row) not in duplicate_ids
    ]

    assi_2181381 = by_asso["2181381"]
    result.append((assi_2181381[1].copy(), assi_2181381))

    asso_2178116 = by_asso["2178116"]
    merged = asso_2178116[0].copy()
    merged["nome"] = "REVESTIMENTO PISO VIA APIA RT ACETINADO 32X57,5 VA32002 BR CLASS"
    merged["altura"] = "57.5"
    merged["local_uso"] = asso_2178116[1]["local_uso"]
    merged["pei"] = "LF"
    result.append((merged, asso_2178116))

    ctc_6877 = by_ctc["6877"]
    result.append((ctc_6877[1].copy(), ctc_6877))

    result.sort(key=lambda item: item[0]["nome"].strip().casefold())
    if len(result) != 261:
        raise ValueError(f"Consolidação inesperada: {len(result)} produtos")
    return result


def sql_text(value: str | None) -> str:
    return "NULL" if value is None else "'" + value.replace("'", "''") + "'"


def sql_decimal(value: str) -> str:
    return str(Decimal(value.strip().replace(",", ".")))


def render_row(product: dict[str, str], sources: list[dict[str, str]]) -> str:
    name = clean(product["nome"])
    if name is None:
        raise ValueError("Produto sem nome")
    raw = json.dumps({"fontes": sources}, ensure_ascii=False, separators=(",", ":"))
    values = [
        sql_text(name),
        sql_text(clean(product["cod_asso"])),
        sql_text(clean(product["cod_ctc"])),
        sql_decimal(product["largura"]),
        sql_decimal(product["altura"]),
        sql_decimal(product["rejunte"]),
        sql_decimal(product["pecas_cx"]),
        sql_decimal(product["m_cx"]),
        sql_text(clean(product["local_uso"])),
        sql_text(clean(product["tipo_piso"])),
        sql_text(classification(product["pei"])),
        sql_text(border_finish(product["retificado"])),
        sql_text(clean(product["site"])),
        sql_text(clean(product["foto"])),
        sql_text(clean(product["foto"])),
        sql_text(clean(product["ambiente"])),
        "0",
        "0",
        "FALSE",
        "'NAO_INFORMADO'",
        "'NAO_INFORMADO'",
        sql_text(raw) + "::jsonb",
    ]
    return "    (" + ", ".join(values) + ")"


def main() -> None:
    consolidated = consolidate(load_source())
    header = """-- Gerado por scripts/generate_legacy_product_migration.py a partir de BK_banco/calcula_piso.sql.
-- Os 264 registros originais são preservados em dados_legado; três pares confirmados
-- como duplicados são consolidados, resultando em 261 produtos.
INSERT INTO pisos (
    nome, codigo_rede, codigo_loja, largura, altura, rejunte,
    pecas_por_caixa, m2_por_caixa, local_de_uso, tipo_piso,
    classificacao_uso, acabamento_bordas, link_site, link_foto,
    link_foto_origem, link_area_central, valor, estoque_m2, ativo,
    origem_valor, origem_estoque, dados_legado
)
VALUES
"""
    body = ",\n".join(render_row(product, sources) for product, sources in consolidated)
    footer = "\nON CONFLICT DO NOTHING;\n"
    TARGET.write_text(header + body + footer, encoding="utf-8", newline="\n")
    print(f"Gerados {len(consolidated)} produtos em {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
