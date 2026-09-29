"""Packaging regression tests. No Foundry installation or external dependencies."""
from contextlib import redirect_stdout
from hashlib import sha256
from importlib.util import module_from_spec, spec_from_file_location
from io import StringIO
from pathlib import Path
import json
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location("csm_package", ROOT / "tools/package.py")
PACKAGE = module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE)


class PackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix="csm-package-")
        cls.output = Path(cls.temporary.name) / "module.zip"
        with redirect_stdout(StringIO()):
            cls.digest = PACKAGE.build(cls.output)
        cls.archive = zipfile.ZipFile(cls.output)

    @classmethod
    def tearDownClass(cls):
        cls.archive.close()
        cls.temporary.cleanup()

    def test_manifest_identity_and_version_match(self):
        source = json.loads((ROOT / "module.json").read_text(encoding="utf-8"))
        self.assertEqual(json.loads(self.archive.read("chris-sound-module/module.json")), source)
        self.assertNotIn("verified", source["compatibility"])

    def test_all_runtime_and_document_bytes_match(self):
        expected = {
            f"chris-sound-module/{path.relative_to(ROOT).as_posix()}": path
            for path in PACKAGE.package_files()
        }
        self.assertEqual(set(self.archive.namelist()), set(expected))
        for name, path in expected.items():
            with self.subTest(path=name):
                self.assertEqual(self.archive.read(name), path.read_bytes())

    def test_no_development_files_or_historical_notes_are_shipped(self):
        for name in self.archive.namelist():
            with self.subTest(path=name):
                self.assertFalse(any(part in name.split("/") for part in ("tests", "tools", "archive", ".github", "node_modules")))
                self.assertNotIn("..", name.split("/"))

    def test_checksum_matches_and_uses_lf(self):
        self.assertEqual(sha256(self.output.read_bytes()).hexdigest(), self.digest)
        self.assertEqual(self.output.with_suffix(".zip.sha256").read_bytes(), f"{self.digest}  module.zip\n".encode())

    def test_repeated_build_is_byte_identical(self):
        other = self.output.with_name("repeat.zip")
        with redirect_stdout(StringIO()):
            PACKAGE.build(other)
        self.assertEqual(self.output.read_bytes(), other.read_bytes())

    def test_metadata_and_integrity_are_stable(self):
        self.assertIsNone(self.archive.testzip())
        for info in self.archive.infolist():
            self.assertEqual(info.date_time, (2026, 9, 29, 0, 0, 0))
            self.assertEqual(info.create_system, 3)
            self.assertEqual(info.external_attr >> 16, 0o100644)

    def test_missing_required_document_fails(self):
        empty = Path(self.temporary.name) / "empty"
        empty.mkdir()
        with self.assertRaises(ValueError):
            PACKAGE.package_files(empty)


if __name__ == "__main__":
    unittest.main()
