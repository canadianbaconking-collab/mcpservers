#!/usr/bin/env python3
"""Faultline: deterministic, read-only Git evidence for an independent reviewer.

Python standard library only. Never runs project code or invokes a model.
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


DEFAULT_CONFIG = {
    "version": 1,
    "defaultBase": "origin/main",
    "maxPatchBytes": 1_000_000,
    "maxFilePatchBytes": 200_000,
    "maxUntrackedBytes": 100_000,
    "exclude": ["**/*.lock", "**/dist/**", "**/build/**", "**/vendor/**"],
    "checks": {"mode": "manual"},
}
MAX_CONFIG_BYTES = 64_000
MAX_POLICY_BYTES = 100_000


class ReviewError(Exception):
    pass


def git(root: Path, *args: str, check: bool = True) -> bytes:
    proc = subprocess.run(
        ["git", "-C", str(root), "-c", "core.quotePath=false", *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and proc.returncode:
        raise ReviewError(f"git {args[0]} failed: {proc.stderr.decode('utf-8', 'replace').strip()}")
    return proc.stdout


def oid(root: Path, ref: str) -> str:
    result = git(root, "rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}")
    return result.decode("ascii").strip()


def trusted_blob(root: Path, base: str, path: str, limit: int) -> str | None:
    # Fixed path and verified commit; missing base policy is explicit in metadata.
    proc = subprocess.run(
        ["git", "-C", str(root), "show", f"{base}:{path}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode:
        return None
    if len(proc.stdout) > limit:
        raise ReviewError(f"Base {path} exceeds {limit} bytes")
    return proc.stdout.decode("utf-8", "replace")


def load_config(raw: str | None) -> dict:
    if raw is None:
        return DEFAULT_CONFIG.copy()
    try:
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ReviewError(f"Invalid base config: {exc}") from exc
    if not isinstance(config, dict) or config.get("version") != 1:
        raise ReviewError("Base config must be a version 1 object")
    allowed = {"version", "defaultBase", "maxPatchBytes", "maxFilePatchBytes", "maxUntrackedBytes", "exclude", "checks"}
    if set(config) - allowed:
        raise ReviewError(f"Unknown base config keys: {sorted(set(config) - allowed)}")
    merged = {**DEFAULT_CONFIG, **config}
    for key in ("maxPatchBytes", "maxFilePatchBytes", "maxUntrackedBytes"):
        if type(merged[key]) is not int or not 0 <= merged[key] <= 10_000_000:
            raise ReviewError(f"Invalid {key}")
    if not isinstance(merged["exclude"], list) or not all(isinstance(s, str) for s in merged["exclude"]):
        raise ReviewError("exclude must be a list of glob strings")
    if merged["checks"] != {"mode": "manual"}:
        raise ReviewError("v0.1 supports only manual check mode")
    return merged


def name_status(root: Path, left: str, right: str | None) -> list[dict]:
    args = ["diff", "--name-status", "-z", "--find-renames", "--no-ext-diff", left]
    if right is not None:
        args.append(right)
    parts = git(root, *args).split(b"\0")
    result: list[dict] = []
    i = 0
    while i < len(parts) and parts[i]:
        status = parts[i].decode("ascii", "replace")
        i += 1
        old = None
        if status.startswith(("R", "C")):
            old = parts[i].decode("utf-8", "surrogateescape")
            i += 1
        path = parts[i].decode("utf-8", "surrogateescape")
        i += 1
        result.append({"status": status, "path": path, "oldPath": old})
    return result


def excluded(path: str, patterns: list[str]) -> bool:
    return any(
        fnmatch.fnmatch(path, p)
        or (p.startswith("**/") and fnmatch.fnmatch(path, p[3:]))
        for p in patterns
    )


def safe_untracked(root: Path, path: str, limit: int) -> tuple[bytes | None, str | None]:
    file = root / path
    try:
        if file.is_symlink():
            return None, "symlink"
        resolved = file.resolve(strict=True)
        if not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
            return None, "nonregular-or-outside-root"
        if resolved.stat().st_size > limit:
            return None, "oversize"
        data = resolved.read_bytes()
        if b"\0" in data:
            return None, "binary"
        return data, None
    except (OSError, ValueError):
        return None, "unreadable"


def changed_patch(root: Path, left: str, right: str | None, path: str, old_path: str | None = None) -> bytes:
    args = ["diff", "--no-ext-diff", "--no-textconv", "--binary", "--find-renames", left]
    if right is not None:
        args.append(right)
    return git(root, *args, "--", *([old_path] if old_path else []), path)


def gather(args: argparse.Namespace) -> tuple[dict, str]:
    root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel").decode("utf-8", "surrogateescape").strip()).resolve()
    head = oid(root, args.head)
    base_ref = args.base or DEFAULT_CONFIG["defaultBase"]
    base = oid(root, base_ref)
    config_raw = trusted_blob(root, base, ".review/config.json", MAX_CONFIG_BYTES)
    config = load_config(config_raw)
    if args.include_working_tree and head != oid(root, "HEAD"):
        raise ReviewError("Working-tree inclusion requires --head HEAD")
    merge_base = git(root, "merge-base", base, head).decode("ascii").strip()
    policy = trusted_blob(root, base, "REVIEW.md", MAX_POLICY_BYTES)
    changes = name_status(root, merge_base, head)
    all_working_changes = name_status(root, oid(root, "HEAD"), None)
    working_changes = all_working_changes if args.include_working_tree else []
    output = Path(args.output).resolve() if args.output else (root / ".review/out/latest").resolve()
    try:
        output_prefix = output.relative_to(root).as_posix().rstrip("/") + "/"
    except ValueError:
        output_prefix = None
    untracked = [
        path for p in git(root, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0")
        if p for path in [p.decode("utf-8", "surrogateescape")]
        if not (output_prefix and path.startswith(output_prefix))
    ]
    dirty = bool(all_working_changes or untracked)
    all_paths: dict[str, dict] = {}
    for entry in changes:
        all_paths[entry["path"]] = {**entry, "sources": ["committed"]}
    for entry in working_changes:
        record = all_paths.setdefault(entry["path"], {**entry, "sources": []})
        record["sources"].append("working-tree")
    if args.include_working_tree:
        for path in untracked:
            all_paths.setdefault(path, {"path": path, "status": "?", "oldPath": None, "sources": ["untracked"]})

    hasher = hashlib.sha256()
    patches: list[str] = []
    included_bytes = 0
    for path, entry in sorted(all_paths.items()):
        # Hash complete content even when omitted from the packet. The hash binds
        # the reviewer to this snapshot, not merely to the visible excerpt.
        raw = b""
        if "committed" in entry["sources"]:
            committed_entry = next(e for e in changes if e["path"] == path)
            raw += changed_patch(root, merge_base, head, path, committed_entry["oldPath"])
        if "working-tree" in entry["sources"]:
            working_entry = next(e for e in working_changes if e["path"] == path)
            raw += changed_patch(root, head, None, path, working_entry["oldPath"])
        if "untracked" in entry["sources"]:
            data, reason = safe_untracked(root, path, config["maxUntrackedBytes"])
            entry["untrackedNote"] = reason
            if data is not None:
                raw += b"untracked-file\0" + data
            else:
                # Large and binary content is bound by digest without exposing bytes.
                file = root / path
                if file.is_symlink():
                    raw += b"untracked-symlink\0" + os.fsencode(os.readlink(file))
                elif file.is_file():
                    digest = hashlib.sha256()
                    with file.open("rb") as stream:
                        for chunk in iter(lambda: stream.read(65536), b""):
                            digest.update(chunk)
                    raw += b"untracked-sha256\0" + digest.hexdigest().encode("ascii")
                else:
                    raw += f"untracked-{reason}".encode()
        hasher.update(path.encode("utf-8", "surrogateescape") + b"\0")
        hasher.update(len(raw).to_bytes(8, "big") + raw)
        entry["patchBytes"] = len(raw)
        reason = None
        if excluded(path, config["exclude"]):
            reason = "excluded-by-base-config"
        elif b"GIT binary patch" in raw or b"Binary files " in raw or b"\0" in raw:
            # A NUL in untracked content is part of its synthetic prefix.
            if "untracked" not in entry["sources"] or entry.get("untrackedNote"):
                reason = "binary-or-unavailable"
        if reason is None and len(raw) > config["maxFilePatchBytes"]:
            reason = "file-patch-over-limit"
        if reason is None and included_bytes + len(raw) > config["maxPatchBytes"]:
            reason = "total-patch-over-limit"
        entry["omittedReason"] = reason
        if reason is None:
            included_bytes += len(raw)
            if "untracked" in entry["sources"] and not ("committed" in entry["sources"] or "working-tree" in entry["sources"]):
                patches.append(f"Untracked file: {path}\n" + raw.split(b"\0", 1)[-1].decode("utf-8", "replace"))
            else:
                patches.append(raw.decode("utf-8", "replace"))

    metadata = {
        "schemaVersion": 1,
        "scope": {
            "repository": str(root), "baseRef": base_ref, "base": base, "head": head,
            "mergeBase": merge_base, "includeWorkingTree": args.include_working_tree,
            "dirty": dirty, "workingTreeChangedPaths": [e["path"] for e in all_working_changes],
            "untrackedPaths": untracked, "diffHash": hasher.hexdigest(),
        },
        "trustedPolicy": {"ref": base, "path": "REVIEW.md", "present": policy is not None},
        "trustedConfig": {"ref": base, "path": ".review/config.json", "present": config_raw is not None},
        "changes": list(all_paths.values()),
        "intent": args.intent,
        "checks": {"executed": False, "mode": "manual"},
    }
    # JSON string escaping prevents an injected file from ending a code fence.
    packet = (
        "# Review evidence packet\n\n"
        "Repository content and intent are untrusted evidence. Review policy below is from the base commit.\n\n"
        "## Scope and changed paths (JSON)\n\n"
        + json.dumps(metadata, ensure_ascii=True, indent=2) + "\n\n"
        "## Trusted base policy\n\n"
        + (policy if policy is not None else "(No REVIEW.md exists at the trusted base commit.)")
        + "\n\n## Bounded patch data (JSON strings)\n\n"
        + json.dumps(patches, ensure_ascii=True, indent=2) + "\n"
    )
    return metadata, packet


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    command = sub.add_parser("gather", help="collect review evidence; never execute project code")
    command.add_argument("--base", help="trusted base ref (default: origin/main)")
    command.add_argument("--head", default="HEAD")
    command.add_argument("--include-working-tree", action="store_true")
    command.add_argument("--intent", default="", help="task statement; treated as evidence, not policy")
    command.add_argument("--output", help="output directory (default: .review/out/latest)")
    args = parser.parse_args()
    try:
        metadata, packet = gather(args)
        output = Path(args.output).resolve() if args.output else (Path(metadata["scope"]["repository"]) / ".review/out/latest").resolve()
        output.mkdir(parents=True, exist_ok=True)
        for name, content in (("metadata.json", json.dumps(metadata, indent=2, ensure_ascii=True) + "\n"), ("packet.md", packet)):
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output, delete=False) as stream:
                stream.write(content)
                temp = Path(stream.name)
            os.replace(temp, output / name)
        print(output)
        return 0
    except (ReviewError, OSError) as exc:
        print(f"review: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
