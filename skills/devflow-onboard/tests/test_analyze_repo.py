import json
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from analyze_repo import analyze, parse_github_url  # noqa: E402


class AnalyzeRepoTests(unittest.TestCase):
    def test_parse_github_urls(self):
        self.assertEqual(parse_github_url("https://github.com/acme/demo.git"), {"owner": "acme", "repo": "demo"})
        self.assertEqual(parse_github_url("git@github.com:acme/demo"), {"owner": "acme", "repo": "demo"})
        with self.assertRaises(ValueError):
            parse_github_url("https://example.com/acme/demo")

    def test_detects_npm_project_and_existing_workflows(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text(json.dumps({"engines": {"node": ">=22"}, "scripts": {"lint": "eslint .", "test": "vitest", "build": "tsc"}}), encoding="utf-8")
            (root / "package-lock.json").write_text("{}", encoding="utf-8")
            (root / ".nvmrc").write_text("22\n", encoding="utf-8")
            (root / ".github" / "workflows").mkdir(parents=True)
            (root / ".github" / "workflows" / "ci.yml").write_text("name: CI\n", encoding="utf-8")
            (root / "devflow.yaml").write_text("project:\n  name: demo\n", encoding="utf-8")
            result = analyze(root, "https://github.com/acme/demo")
            self.assertEqual(result["github"], {"owner": "acme", "repo": "demo"})
            self.assertEqual(result["package_manager"], "npm")
            self.assertEqual(result["runtime"]["node"], "22")
            self.assertEqual(result["commands"]["install"], "npm ci")
            self.assertIn("test", result["commands"])
            self.assertEqual(result["existing"]["workflows"], [".github/workflows/ci.yml"])
            self.assertTrue(result["existing"]["devflow_config"])

    def test_detects_pnpm_and_unknown_runtime_warning(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text(json.dumps({"scripts": {"typecheck": "tsc --noEmit"}}), encoding="utf-8")
            (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n", encoding="utf-8")
            result = analyze(root)
            self.assertEqual(result["package_manager"], "pnpm")
            self.assertEqual(result["commands"]["install"], "pnpm install --frozen-lockfile")
            self.assertTrue(any("版本" in warning for warning in result["warnings"]))

    def test_non_node_projects_are_reported_without_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "pyproject.toml").write_text("[project]\nname = 'demo'\n", encoding="utf-8")
            result = analyze(root)
            self.assertEqual(result["languages"], ["python"])
            self.assertFalse(result["supported_by_node_template"])
            self.assertEqual(result["commands"], {})


if __name__ == "__main__":
    unittest.main()
