#!/usr/bin/env python3
"""Stage the owner's Phase 4 handoff and a small, reproducible local reference mirror.

No package installs, app code changes, API credentials, Git commits or pushes.
Run only after switching to the intended Phase 4 foundation branch.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import stat
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PHASE4 = ROOT / "design" / "phase4"
WORK = PHASE4 / "workspace"
MANIFEST = PHASE4 / "manifests" / "reference-sources.json"
MAX_UNPACKED_BYTES = 110 * 1024 * 1024
MAX_VIDEO_BYTES = 45 * 1024 * 1024


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def assert_branch(name: str) -> None:
    run = subprocess.run(
        ["git", "-C", str(ROOT), "branch", "--show-current"],
        capture_output=True, text=True, check=True
    )
    actual = run.stdout.strip()
    if actual != name:
        raise RuntimeError(f"Expected branch {name!r}; found {actual!r}. Do not prepare main.")


def validated_zip(archive: Path, expected_sha: str) -> None:
    if digest(archive) != expected_sha:
        raise RuntimeError("Archive SHA-256 mismatch. Refusing to copy or unpack unverified bytes.")
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise RuntimeError("ZIP integrity test failed")
        total = 0
        for item in z.infolist():
            filename = item.filename.replace("\\", "/")
            relative = Path(filename)
            if (not filename or filename.startswith("/")
                    or ".." in relative.parts
                    or ":" in relative.parts[0]):
                raise RuntimeError(f"Unsafe archive entry: {filename!r}")
            if stat.S_IFMT(item.external_attr >> 16) == stat.S_IFLNK:
                raise RuntimeError(f"Symlink entry rejected: {filename!r}")
            total += item.file_size
            if total > MAX_UNPACKED_BYTES:
                raise RuntimeError("Archive exceeds conservative expanded-size limit")


def stage_archive(source: Path | None, target: Path, expected_sha: str) -> Path:
    if source is None:
        options = [
            target,
            Path.home() / "Downloads" / target.name,
            Path.home() / "Desktop" / target.name,
        ]
        source = next((p for p in options if p.is_file()), None)
    if source is None or not source.is_file():
        raise FileNotFoundError(
            f"Missing handoff ZIP. Download it from the ChatGPT conversation and "
            f"pass --archive /path/to/{target.name}."
        )
    validated_zip(source, expected_sha)
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
    validated_zip(target, expected_sha)
    return target


def extract_archive(archive: Path, dest: Path, expected_sha: str) -> None:
    stamp = dest.parent / ".source_archive_sha256"
    if stamp.exists() and stamp.read_text().strip() == expected_sha and dest.is_dir():
        return
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            path = dest / entry.filename.replace("\\", "/")
            if entry.is_dir():
                path.mkdir(parents=True, exist_ok=True)
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            with z.open(entry, "r") as src, path.open("wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
    stamp.write_text(expected_sha + "\n")
    # The nested REA zip is intentionally NOT extracted to save disk space.


def download_bounded(url: str, target: Path, limit: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + ".partial")
    request = urllib.request.Request(
        url, headers={"User-Agent": "Studigo-Phase4-Reference-Hydration/1.0"}
    )
    total = 0
    try:
        with urllib.request.urlopen(request, timeout=35) as response, temp.open("wb") as out:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise RuntimeError(f"Reference exceeds size limit: {url}")
                out.write(chunk)
        temp.replace(target)
    finally:
        if temp.exists():
            temp.unlink()


def main() -> int:
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--archive", type=Path, help="User-downloaded original handoff ZIP")
    args.add_argument("--offline", action="store_true", help="Skip external Coucou/REA downloads")
    args.add_argument("--videos", action="store_true", help="Download 3 optional concept MP4s (extra storage)")
    args.add_argument("--refresh", action="store_true", help="Re-fetch already present network references")
    parsed = args.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert_branch(manifest["branch"])
    target = ROOT / manifest["archive"]["repository_path"]
    staged = stage_archive(parsed.archive, target, manifest["archive"]["sha256"])

    (WORK / "context").mkdir(parents=True, exist_ok=True)
    (WORK / "references").mkdir(parents=True, exist_ok=True)
    (WORK / "rig-prototypes").mkdir(parents=True, exist_ok=True)
    (WORK / "evidence").mkdir(parents=True, exist_ok=True)
    extract_archive(staged, WORK / "context" / "unpacked", manifest["archive"]["sha256"])

    results: list[dict] = []
    errors: list[str] = []
    for key, project in manifest["repos"].items():
        for relative in project["files"]:
            out = WORK / "references" / key / relative
            out.parent.mkdir(parents=True, exist_ok=True)
            if key == "studigo":
                src = ROOT / relative
                if not src.is_file():
                    errors.append(f"Missing local source: {relative}")
                    continue
                shutil.copy2(src, out)
                status = "copied from local working branch"
            elif parsed.offline:
                status = "available previously" if out.is_file() else "offline / not fetched"
            elif out.is_file() and not parsed.refresh:
                status = "cached"
            else:
                remote = urllib.parse.quote(relative, safe="/")
                url = f"https://raw.githubusercontent.com/{project['repository']}/{project['revision']}/{remote}"
                try:
                    download_bounded(url, out, 6 * 1024 * 1024)
                    status = "downloaded from pinned commit"
                except (OSError, RuntimeError, urllib.error.URLError) as exc:
                    errors.append(f"{key}/{relative}: {exc}")
                    status = "failed"
            results.append({
                "project": key, "path": relative, "status": status,
                "sha256": digest(out) if out.is_file() else None,
                "revision": project["revision"],
            })

    media_dir = WORK / "references" / "approved-concept-videos"
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / "URLS.json").write_text(
        json.dumps(manifest["approved_videos"], indent=2) + "\n", encoding="utf-8"
    )
    if parsed.videos:
        if parsed.offline:
            errors.append("Cannot download videos with --offline")
        else:
            for video in manifest["approved_videos"]:
                out = media_dir / video["filename"]
                if out.is_file() and not parsed.refresh:
                    continue
                try:
                    download_bounded(video["url"], out, MAX_VIDEO_BYTES)
                except (OSError, RuntimeError, urllib.error.URLError) as exc:
                    errors.append(f"video/{video['id']}: {exc}")

    report = {
        "at_utc": datetime.now(timezone.utc).isoformat(),
        "branch": manifest["branch"], "archive_path": str(staged.relative_to(ROOT)),
        "archive_sha256": digest(staged), "entries": results, "errors": errors,
        "notes": [
            "References are read-only. Do not copy Coucou's Mochi art or creative assets.",
            "No app source was changed. Neither the ZIP nor references are executed.",
            "The inner REA evidence ZIP remains compressed to save storage."
        ],
    }
    (WORK / "evidence" / "reference-hydration.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Archive staged: {staged.relative_to(ROOT)}")
    print(f"Local workspace: {WORK.relative_to(ROOT)}")
    print(f"References inventoried: {len(results)}; errors: {len(errors)}")
    print("Next: inspect evidence/reference-hydration.json, commit ONLY the verified ZIP and tracked starter files.")
    for msg in errors:
        print("INCOMPLETE:", msg, file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(2)
