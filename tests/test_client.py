"""Independent public client checks; all data is synthetic."""

import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ClientTests(unittest.TestCase):
    def test_language_keys_and_placeholders(self):
        en, ru = [
            json.loads((ROOT / f"client/locales/{language}.json").read_bytes())
            for language in ["en", "ru"]
        ]
        self.assertEqual(en.keys(), ru.keys())
        for key in en:
            self.assertEqual(
                set(re.findall(r"\{([a-z_]+)\}", en[key])),
                set(re.findall(r"\{([a-z_]+)\}", ru[key])),
                key,
            )

    def test_build_copies_client_without_core_or_token(self):
        spec = importlib.util.spec_from_file_location(
            "build_client", ROOT / "scripts/build_client.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "client"
            files = module.build(ROOT, output)
            self.assertEqual(len(files), 3)
            html = (output / "release_ui.html").read_text(encoding="utf8")
            self.assertIn("__TOKEN__", html)
            self.assertNotIn("innerHTML", (output / "release_ui.js").read_text(encoding="utf8"))

    def test_contract_separates_presence_and_attribution(self):
        schema = json.loads((ROOT / "contracts/release-v1/result.schema.json").read_bytes())
        account = schema["$defs"]["Account"]
        self.assertEqual(account["properties"]["subject_attribution"]["const"], "UNPROVEN")
        self.assertEqual(account["properties"]["presence_status"]["const"], "FOUND")
        self.assertGreaterEqual(account["properties"]["evidence_ids"]["minItems"], 1)
        self.assertEqual(schema["$defs"]["AccountPage"]["properties"]["items"]["maxItems"], 50)

    def test_client_can_be_rebuilt_without_removing_other_files(self):
        spec = importlib.util.spec_from_file_location(
            "build_client", ROOT / "scripts/build_client.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "client"
            first = module.build(ROOT, output)
            (output / "keep.txt").write_text("keep")
            (output / "release_ui.js").write_text("previous generated asset")
            self.assertEqual(module.build(ROOT, output), first)
            self.assertEqual((output / "keep.txt").read_text(), "keep")

    def test_document_links_resolve(self):
        for path in [ROOT / "README.md", *ROOT.glob("docs/**/*.md")]:
            for link in re.findall(r"\]\(([^)]+)\)", path.read_text(encoding="utf8")):
                if "://" not in link and not link.startswith("#"):
                    self.assertTrue((path.parent / link.split("#")[0]).is_file(), (path, link))


if __name__ == "__main__":
    unittest.main()
