import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from build_site import ASSET_DIRS, DATA_FILES, build
from spa_404_fallback import ROUTES


class SiteBuild(unittest.TestCase):
    def fixture(self, directory):
        source = Path(directory) / "source"
        source.mkdir()
        (source / "index.html").write_text("<html>canonical fixture</html>")
        for name in DATA_FILES:
            (source / name).write_text("{}")
        (source / "services/pro_api").mkdir(parents=True)
        (source / "services/pro_api/regions.json").write_text("{}")
        for name in ASSET_DIRS:
            (source / name).mkdir()
            (source / name / "fixture.txt").write_text(name)
        (source / "js/check.test.cjs").write_text("private test fixture")
        (source / ".env").write_text("PRIVATE_FIXTURE_ONLY=unused")
        return source

    def test_complete_build_and_repeat(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.fixture(directory)
            output = build(source=source)
            for route in ("", *ROUTES):
                self.assertEqual((output / route / "index.html").read_bytes(), (source / "index.html").read_bytes())
            self.assertEqual((output / "404.html").read_bytes(), (source / "index.html").read_bytes())
            for name in ASSET_DIRS:
                self.assertTrue((output / name / "fixture.txt").is_file())
            self.assertFalse((output / ".env").exists())
            self.assertFalse((output / "services").exists())
            self.assertFalse((output / "js/check.test.cjs").exists())
            (source / "index.html").write_text("<html>updated fixture</html>")
            build(source=source)
            self.assertEqual((output / "pro/index.html").read_text(), "<html>updated fixture</html>")

    def test_source_and_assets_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.fixture(directory)
            for output in (source, source.parent, source / "js"):
                with self.assertRaises(ValueError):
                    build(output, source)

    def test_missing_input_does_not_create_partial_output(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.fixture(directory)
            (source / "bi.json").unlink()
            with self.assertRaises(FileNotFoundError):
                build(source=source)
            self.assertFalse((source / "_site").exists())

    def test_route_html_does_not_exist_in_sources(self):
        self.assertTrue((ROOT / "index.html").is_file())
        for route in ROUTES:
            self.assertFalse((ROOT / route / "index.html").exists(), route)
        self.assertFalse((ROOT / "404.html").exists())
