#!/usr/bin/env python3
"""Assemble the static website from one HTML source; Python API runs separately."""
import argparse
from pathlib import Path
import shutil

from spa_404_fallback import build as build_routes

ROOT = Path(__file__).resolve().parents[1]
DATA_FILES = ("berita.json", "kalender.json", "bi.json", "fomc.json", "regional-sources.json", ".nojekyll")
ASSET_DIRS = ("css", "js", "assets", "news")


def build(output=None, source=ROOT):
    source = Path(source).resolve()
    output = Path(output).resolve() if output else source / "_site"
    if output == source or output in source.parents:
        raise ValueError("Output must not overwrite the source directory or its parents")
    if source in output.parents and output.relative_to(source).parts[0] not in ("_site", "scratch"):
        raise ValueError("Use _site or scratch for a build inside the repository")
    required = [source / "index.html", source / "services/pro_api/regions.json"]
    required += [source / file for file in DATA_FILES]
    required += [source / name for name in ASSET_DIRS]
    for path in required:
        if not path.exists():
            raise FileNotFoundError(f"Missing website input: {path}")
    output.mkdir(parents=True, exist_ok=True)
    build_routes(output, source / "index.html")
    for file in DATA_FILES:
        shutil.copy2(source / file, output / file)
    shutil.copy2(source / "services/pro_api/regions.json", output / "news-regions.json")
    for name in ASSET_DIRS:
        shutil.copytree(source / name, output / name, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns("*.test.cjs", "__pycache__"))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="Output directory (default: _site)")
    args = parser.parse_args()
    print(f"Website built: {build(args.output)}")
