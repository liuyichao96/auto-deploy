#!/usr/bin/env python3
"""Read-only project discovery for the devflow-onboard skill.

The analyzer deliberately does not execute project commands. It only reads
well-known manifests and asks git for branch metadata, then emits JSON that a
Codex skill can turn into a reviewable onboarding plan.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any


GITHUB_RE = re.compile(
    r"^(?:https?://github\.com/|git@github\.com:)(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?/?$"
)
IGNORED_DIRS = {".git", "node_modules", ".venv", "venv", "vendor", "dist", "build", "coverage"}


def parse_github_url(value: str) -> dict[str, str]:
    match = GITHUB_RE.match(value.strip())
    if not match:
        raise ValueError("不是受支持的 GitHub 仓库地址")
    return {"owner": match.group("owner"), "repo": match.group("repo")}


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return ""


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(read_text(path))
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def git_value(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode:
        return None
    value = result.stdout.strip()
    return value or None


def project_files(root: Path) -> set[str]:
    files: set[str] = set()
    for path in root.rglob("*"):
        if not path.is_file() or any(part in IGNORED_DIRS for part in path.relative_to(root).parts):
            continue
        files.add(path.relative_to(root).as_posix())
    return files


def detect_language(files: set[str]) -> list[str]:
    markers = {
        "node": {"package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"},
        "python": {"pyproject.toml", "requirements.txt", "Pipfile", "poetry.lock"},
        "go": {"go.mod", "go.sum"},
        "rust": {"Cargo.toml", "Cargo.lock"},
        "java": {"pom.xml", "build.gradle", "build.gradle.kts"},
        "dotnet": {"global.json"},
    }
    detected = [language for language, names in markers.items() if files & names or any(path.endswith(".csproj") for path in files) and language == "dotnet"]
    return detected or ["unknown"]


def detect_package_manager(files: set[str]) -> str | None:
    for filename, manager in (
        ("pnpm-lock.yaml", "pnpm"),
        ("yarn.lock", "yarn"),
        ("bun.lockb", "bun"),
        ("bun.lock", "bun"),
        ("package-lock.json", "npm"),
        ("package.json", "npm"),
    ):
        if filename in files:
            return manager
    return None


def detect_node(root: Path, files: set[str]) -> dict[str, Any]:
    package = load_json(root / "package.json") if "package.json" in files else {}
    scripts = package.get("scripts", {})
    scripts = scripts if isinstance(scripts, dict) else {}
    engines = package.get("engines", {})
    engines = engines if isinstance(engines, dict) else {}
    node_version = None
    if isinstance(engines.get("node"), str):
        node_version = engines["node"]
    for marker in (".nvmrc", ".node-version"):
        if marker in files and read_text(root / marker).strip():
            node_version = read_text(root / marker).strip().splitlines()[0]
            break
    if ".tool-versions" in files:
        node_version = next(
            (
                line.split()[1]
                for line in read_text(root / ".tool-versions").splitlines()
                if line.startswith("nodejs ") and len(line.split()) > 1
            ),
            node_version,
        )
    manager = detect_package_manager(files)
    install = {"npm": "npm ci" if "package-lock.json" in files else "npm install", "pnpm": "pnpm install --frozen-lockfile", "yarn": "yarn install --immutable", "bun": "bun install --frozen-lockfile"}.get(manager or "")
    commands = {name: f"{manager} run {name}" for name in ("lint", "typecheck", "test", "build") if name in scripts and manager}
    return {"package_manager": manager, "node_version": node_version, "scripts": sorted(scripts), "commands": {"install": install, **commands}}


def analyze(root: Path, url: str | None = None) -> dict[str, Any]:
    root = root.resolve()
    files = project_files(root)
    languages = detect_language(files)
    default_branch = git_value(root, "symbolic-ref", "--short", "refs/remotes/origin/HEAD") or git_value(root, "branch", "--show-current")
    if default_branch and default_branch.startswith("origin/"):
        default_branch = default_branch.removeprefix("origin/")
    result: dict[str, Any] = {
        "path": str(root),
        "github": parse_github_url(url) if url else None,
        "default_branch": default_branch,
        "languages": languages,
        "supported_by_node_template": "node" in languages,
        "package_manager": detect_package_manager(files),
        "runtime": {},
        "commands": {},
        "existing": {
            "devflow_config": "devflow.yaml" in files,
            "agents": "AGENTS.md" in files,
            "workflows": sorted(path for path in files if path.startswith(".github/workflows/") and path.endswith((".yml", ".yaml"))),
        },
        "warnings": [],
    }
    if "node" in languages:
        node = detect_node(root, files)
        result["package_manager"] = node["package_manager"]
        result["runtime"] = {"node": node["node_version"]}
        result["commands"] = node["commands"]
        if not node["node_version"]:
            result["warnings"].append("未检测到 Node.js 版本，将需要确认默认版本")
    else:
        result["warnings"].append("当前 Skill 只对可安全推断命令的项目生成模板，其他技术栈需要人工确认")
    if result["existing"]["devflow_config"]:
        result["warnings"].append("已存在 devflow.yaml，接入时必须保留用户配置并生成差异")
    if result["existing"]["workflows"]:
        result["warnings"].append("已存在 GitHub Actions，接入时必须避免重复工作流")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--url", help="可选的 GitHub 仓库 URL")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    args = parser.parse_args()
    try:
        result = analyze(args.path, args.url)
    except ValueError as error:
        parser.error(str(error))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else "\n".join(f"{key}: {value}" for key, value in result.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
