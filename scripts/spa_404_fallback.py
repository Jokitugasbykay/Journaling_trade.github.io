#!/usr/bin/env python3
"""Build GitHub Pages route documents from the canonical HTML source."""
import argparse
from pathlib import Path

ROUTES = (
    "home", "journal", "statistics", "calculator", "economic-news",
    "economic-news/calendar", "economic-news/social", "profile", "login", "pro",
    "analytics", "heatmap", "strategies", "risk", "reviews", "reports", "ai",
    "ai/behaviour", "ai/market", "ai/journal", "ai/chat", "global-news",
)


def build(output, source=Path("index.html")):
    output = Path(output).resolve()
    source = Path(source).resolve()
    if output == source.parent:
        raise ValueError("Build into a separate output directory, not the source tree")
    content = source.read_bytes()
    for route in ("", *ROUTES):
        destination = output / route / "index.html"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    (output / "404.html").write_bytes(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="_site")
    args = parser.parse_args()
    build(args.output)
