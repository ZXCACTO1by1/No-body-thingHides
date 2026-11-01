"""Build the three client assets consumed by the matching official core."""

import hashlib
import json
from pathlib import Path


def build(root: Path, output: Path) -> dict:
    if output.is_symlink() or output.is_junction():
        raise ValueError("Client output must be a regular directory")
    output.mkdir(parents=True, exist_ok=True)
    files = {}
    for input_name, output_name in [
        ("index.html", "release_ui.html"),
        ("style.css", "release_ui.css"),
        ("app.js", "release_ui.js"),
    ]:
        content = (root / "client" / input_name).read_bytes()
        if (output / output_name).is_symlink() or (output / output_name).is_junction():
            raise ValueError("Client output contains linked assets")
        (output / output_name).write_bytes(content)
        files[output_name] = hashlib.sha256(content).hexdigest()
    if (output / "client-manifest.json").is_symlink():
        raise ValueError("Client manifest must be a regular file")
    (output / "client-manifest.json").write_text(
        json.dumps(files, indent=2) + "\n", encoding="utf8"
    )
    return files


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    print(json.dumps(build(root, root / "dist/client"), indent=2))
