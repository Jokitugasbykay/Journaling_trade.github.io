import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("routes", ROOT / "scripts/spa_404_fallback.py")
routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routes)


class Routes(unittest.TestCase):
    def test_all_routes_use_canonical_html(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            routes.build(output, ROOT / "index.html")
            expected = (ROOT / "index.html").read_bytes()
            for route in ("", *routes.ROUTES):
                self.assertEqual((output / route / "index.html").read_bytes(), expected)
            self.assertEqual((output / "404.html").read_bytes(), expected)

    def test_reject_source_directory(self):
        with self.assertRaises(ValueError):
            routes.build(ROOT, ROOT / "index.html")
