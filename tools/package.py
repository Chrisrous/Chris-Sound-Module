"""Build a manual-install RC ZIP without development files. Python 3, no dependencies."""
from pathlib import Path
from hashlib import sha256
import argparse
import json
import zipfile


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / "module.json").read_text(encoding="utf-8"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=root / "dist" / f"chris-sound-module-{manifest['version']}.zip")
    output = parser.parse_args().output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    files = [root / name for name in ("module.json", "LICENSE", "README.md")]
    for directory in ("scripts", "templates", "css", "lang", "docs"):
        files.extend(path for path in (root / directory).rglob("*") if path.is_file())
    for path in files:
        if not path.is_file():
            raise FileNotFoundError(f"Missing package asset: {path}")
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            info = zipfile.ZipInfo(f"{manifest['id']}/{path.relative_to(root).as_posix()}", (2026, 9, 28, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity check failed")
        if json.loads(archive.read(f"{manifest['id']}/module.json")) != manifest:
            raise RuntimeError("Packaged manifest does not match source")
    checksum = sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(f"{checksum}  {output.name}\n", encoding="utf-8")
    print(f"Built {output} ({len(files)} files); SHA-256 {checksum}")


if __name__ == "__main__":
    main()
