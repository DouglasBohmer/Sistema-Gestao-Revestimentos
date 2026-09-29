"""Valida fotos legadas e gera a migração lazy para o Cloudflare R2.

O script não envia arquivos nem altera banco. Ele acessa cada URL original,
aceita somente imagens suportadas de até 5 MB e gera:

- o manifesto usado pelo Worker para copiar a imagem ao R2;
- a migration Flyway que troca apenas as URLs validadas pelo caminho do R2.

Uso, a partir da raiz do repositório:
    python scripts/generate_legacy_image_migration.py --force

O parâmetro --force é intencional: migrations Flyway já publicadas são imutáveis.
Use o script novamente apenas antes da primeira publicação da V7; depois disso,
qualquer nova seleção de imagens deve gerar outra migration.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from generate_legacy_product_migration import clean, consolidate, load_source  # noqa: E402


MAX_IMAGE_BYTES = 5 * 1024 * 1024
WORKERS_MANIFEST = (
    ROOT
    / "frontend-gestao-revestimento"
    / "src"
    / "generated"
    / "legacy-product-images.ts"
)
FLYWAY_MIGRATION = (
    ROOT
    / "backend-gestao-revestimento"
    / "src"
    / "main"
    / "resources"
    / "db"
    / "migration"
    / "V7__route_valid_legacy_images_to_r2.sql"
)
MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
}


@dataclass(frozen=True)
class ValidImage:
    source_url: str
    fetch_url: str
    content_type: str
    key: str


def candidates(source_url: str) -> list[str]:
    result = [source_url]
    if "://www." in source_url:
        result.append(source_url.replace("://www.", "://", 1))
    return result


def detected_content_type(_header: str | None, body: bytes) -> str | None:
    if body.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if body.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if body.startswith(b"RIFF") and body[8:12] == b"WEBP":
        return "image/webp"
    if len(body) >= 12 and body[4:8] == b"ftyp" and body[8:12] in {b"avif", b"avis"}:
        return "image/avif"
    return None


def validate(source_url: str) -> tuple[ValidImage | None, str | None]:
    last_error = "resposta inválida"
    for fetch_url in candidates(source_url):
        request = Request(
            fetch_url,
            headers={
                "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
                "User-Agent": "RedeASSO-image-migration/1.0",
            },
        )
        try:
            with urlopen(request, timeout=20) as response:
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > MAX_IMAGE_BYTES:
                    last_error = "imagem maior que 5 MB"
                    continue
                body = response.read(MAX_IMAGE_BYTES + 1)
                if not body:
                    last_error = "imagem vazia"
                    continue
                if len(body) > MAX_IMAGE_BYTES:
                    last_error = "imagem maior que 5 MB"
                    continue
                content_type = detected_content_type(
                    response.headers.get("Content-Type"), body
                )
                if content_type is None:
                    last_error = "conteúdo não é uma imagem suportada"
                    continue
                digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()
                extension = MIME_EXTENSIONS[content_type]
                return (
                    ValidImage(
                        source_url=source_url,
                        fetch_url=fetch_url,
                        content_type=content_type,
                        key=f"legacy/{digest}.{extension}",
                    ),
                    None,
                )
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
            last_error = str(error)
    return None, last_error


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def render_typescript(images: list[ValidImage]) -> str:
    entries = {
        image.key: {
            "sourceUrl": image.fetch_url,
            "contentType": image.content_type,
        }
        for image in sorted(images, key=lambda item: item.key)
    }
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    return (
        "// Gerado por scripts/generate_legacy_image_migration.py.\n"
        "// Não editar manualmente.\n"
        "export const LEGACY_PRODUCT_IMAGES = "
        + payload
        + " satisfies Record<string, { sourceUrl: string; contentType: string }>;\n"
    )


def render_sql(images: list[ValidImage]) -> str:
    values = ",\n".join(
        "    ("
        + sql_text(image.source_url)
        + ", "
        + sql_text(f"/product-images/{image.key}")
        + ")"
        for image in sorted(images, key=lambda item: item.source_url)
    )
    return f"""-- Gerado por scripts/generate_legacy_image_migration.py.
-- Somente URLs validadas como imagens suportadas são direcionadas ao R2.
-- link_foto_origem permanece inalterado para auditoria e fallback.
UPDATE pisos AS p
SET link_foto = imagens.destino
FROM (VALUES
{values}
) AS imagens(origem, destino)
WHERE p.link_foto = imagens.origem
  AND p.link_foto_origem = imagens.origem;
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="sobrescreve o manifesto e a V7 antes de sua primeira publicação",
    )
    arguments = parser.parse_args()
    if (WORKERS_MANIFEST.exists() or FLYWAY_MIGRATION.exists()) and not arguments.force:
        raise SystemExit(
            "Os arquivos gerados já existem. Use --force somente se a V7 ainda não foi publicada."
        )

    products = consolidate(load_source())
    source_urls = sorted(
        {
            url
            for product, _sources in products
            if (url := clean(product["foto"])) is not None
        }
    )
    valid: list[ValidImage] = []
    failures: dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = {executor.submit(validate, url): url for url in source_urls}
        for future in as_completed(futures):
            source_url = futures[future]
            image, error = future.result()
            if image is not None:
                valid.append(image)
            else:
                failures[source_url] = error or "falha desconhecida"

    WORKERS_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    WORKERS_MANIFEST.write_text(render_typescript(valid), encoding="utf-8", newline="\n")
    FLYWAY_MIGRATION.write_text(render_sql(valid), encoding="utf-8", newline="\n")

    valid_products = sum(
        1
        for product, _sources in products
        if clean(product["foto"]) in {image.source_url for image in valid}
    )
    print(f"URLs únicas válidas: {len(valid)}")
    print(f"Produtos direcionados ao R2: {valid_products}")
    print(f"URLs únicas mantidas no endereço original: {len(failures)}")
    for source_url, error in sorted(failures.items()):
        print(f"FALHA\t{source_url}\t{error}")


if __name__ == "__main__":
    main()
