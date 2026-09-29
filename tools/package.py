"""Build and verify an installable candidate. Python standard library only."""
from pathlib import Path
from hashlib import sha256
import argparse
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DIRS = ("scripts", "templates", "css", "lang")
DOCUMENTS = ("README.md", "LICENSE", "CHANGELOG.md", "docs/USER_GUIDE.md",
             "docs/USER_GUIDE_DE.md", "docs/API.md", "docs/TESTING.md", "SECURITY.md")


def package_files(root: Path = ROOT) -> list[Path]:
    paths = [root / "module.json", *(root / name for name in DOCUMENTS)]
    for directory in RUNTIME_DIRS:
        paths.extend(path for path in (root / directory).rglob("*") if path.is_file())
    for path in paths:
        if not path.is_file() or path.is_symlink() or root.resolve() not in path.resolve().parents:
            raise ValueError(f"Missing or unsafe package asset: {path}")
    return sorted(paths)


def build(output: Path, root: Path = ROOT) -> str:
    manifest = json.loads((root / "module.json").read_text(encoding="utf-8"))
    if manifest["id"] != "chris-sound-module" or not re.fullmatch(r"[0-9A-Za-z.+-]+", manifest["version"]):
        raise ValueError("Unexpected module identity/version")
    output.parent.mkdir(parents=True, exist_ok=True)
    sources = package_files(root)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sources:
            name = f"{manifest['id']}/{path.relative_to(root).as_posix()}"
            info = zipfile.ZipInfo(name, (2026, 9, 29, 0, 0, 0))
            info.create_system = 3  # Fixed Unix metadata, also on Windows runners.
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity failure")
        expected = {f"{manifest['id']}/{path.relative_to(root).as_posix()}": path for path in sources}
        if set(archive.namelist()) != set(expected):
            raise RuntimeError("Unexpected package contents")
        for name, path in expected.items():
            if archive.read(name) != path.read_bytes():
                raise RuntimeError(f"Packaged file differs: {name}")
    digest = sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(f"{digest}  {output.name}\n", encoding="utf-8", newline="\n")
    print(f"Built {output} ({len(sources)} files). SHA-256: {digest}")
    return digest


def main() -> None:
    manifest = json.loads((ROOT / "module.json").read_text(encoding="utf-8"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / f"chris-sound-module-{manifest['version']}.zip")
    build(parser.parse_args().output.resolve())


if __name__ == "__main__":
    main()
