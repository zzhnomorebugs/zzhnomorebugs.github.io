#!/usr/bin/env python3
"""Switch research pages between published and unpublished states.

``private`` means that Jekyll does not publish the pages. It does not make
source files in a public GitHub repository private or restrict asset access.
Only the front matter's ``published`` value is changed.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile


class VisibilityError(Exception):
    """A user-facing validation or Git error."""


@dataclass(frozen=True)
class ProjectPage:
    path: Path
    original: bytes
    lines: tuple[bytes, ...]
    header_end: int
    published_line: int | None
    published: bool

    def render(self, public: bool) -> bytes:
        if self.published_line is not None and self.published == public:
            return self.original
        value = b"true" if public else b"false"
        lines = list(self.lines)
        if self.published_line is not None:
            index = self.published_line
            line = lines[index]
            match = re.match(rb"^(published[ \t]*:[ \t]*)(true|false)\b", line, re.I)
            assert match is not None
            lines[index] = line[: match.start(2)] + value + line[match.end(2) :]
        else:
            newline = b"\r\n" if self.lines[0].endswith(b"\r\n") else b"\n"
            lines.insert(self.header_end, b"published: " + value + newline)
        return b"".join(lines)


def read_page(path: Path) -> ProjectPage | None:
    original = path.read_bytes()
    lines = original.splitlines(keepends=True)
    if not lines or lines[0].lstrip(b"\xef\xbb\xbf").strip() != b"---":
        return None
    header_end = next(
        (i for i in range(1, len(lines)) if lines[i].strip() in (b"---", b"...")),
        None,
    )
    if header_end is None:
        return None
    header = lines[1:header_end]
    is_project = any(
        re.fullmatch(rb"research_project[ \t]*:[ \t]*true[ \t]*(?:#.*)?", line.rstrip(b"\r\n"), re.I)
        for line in header
    )
    if not is_project:
        return None

    published_lines = [
        i for i in range(1, header_end) if re.match(rb"^published[ \t]*:", lines[i])
    ]
    if len(published_lines) > 1:
        raise VisibilityError(f"Duplicate published fields: {path.name}")
    published_line = published_lines[0] if published_lines else None
    published = True
    if published_line is not None:
        match = re.fullmatch(
            rb"published[ \t]*:[ \t]*(true|false)[ \t]*(?:#.*)?",
            lines[published_line].rstrip(b"\r\n"),
            re.I,
        )
        if match is None:
            raise VisibilityError(f"Expected published: true or false in {path.name}")
        published = match.group(1).lower() == b"true"
    return ProjectPage(path, original, tuple(lines), header_end, published_line, published)


def discover_projects(root: Path) -> dict[str, list[ProjectPage]]:
    collection = root / "_research"
    if not collection.is_dir():
        raise VisibilityError(f"Research directory not found: {collection}")
    projects: dict[str, list[ProjectPage]] = {}
    for path in sorted(collection.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm", ".md", ".markdown"}:
            continue
        page = read_page(path)
        if page is None:
            continue
        slug = path.stem.removesuffix("-zh")
        projects.setdefault(slug, []).append(page)
    return projects


def git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["GIT_TERMINAL_PROMPT"] = "0"
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=root,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError as exc:
        raise VisibilityError(f"Could not run Git: {exc}") from exc
    if check and result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise VisibilityError(f"Git {args[0]} failed: {detail}")
    return result


def prepare_push(root: Path, pages: list[ProjectPage]) -> tuple[str, str]:
    git_root = Path(git(root, "rev-parse", "--show-toplevel").stdout.strip()).resolve()
    if git_root != root.resolve():
        raise VisibilityError("Run this script from the website repository, not a nested checkout.")
    branch_result = git(root, "symbolic-ref", "--quiet", "--short", "HEAD", check=False)
    branch = branch_result.stdout.strip()
    if branch_result.returncode or not branch:
        raise VisibilityError("--push requires a checked-out branch, not a detached HEAD.")
    for page in pages:
        relative = page.path.relative_to(root).as_posix()
        if git(root, "ls-files", "--error-unmatch", "--", relative, check=False).returncode:
            raise VisibilityError(f"--push requires a tracked project page: {relative}")
        if git(root, "status", "--porcelain=v1", "--untracked-files=all", "--", relative).stdout.strip():
            raise VisibilityError(
                f"Project page has uncommitted changes: {relative}. Commit or restore it before --push."
            )

    upstream = git(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}", check=False)
    if upstream.returncode:
        raise VisibilityError("--push requires an existing upstream branch. Set it up first.")
    remote = git(root, "config", "--get", f"branch.{branch}.remote").stdout.strip()
    merge_ref = git(root, "config", "--get", f"branch.{branch}.merge").stdout.strip()
    if not remote or remote == "." or not merge_ref.startswith("refs/heads/"):
        raise VisibilityError("--push requires an upstream on a configured remote branch.")
    git(root, "fetch", "--no-tags", "--", remote)
    counts = git(root, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").stdout.split()
    ahead, behind = map(int, counts)
    if ahead:
        raise VisibilityError(
            f"Current branch has {ahead} pre-existing unpushed commit(s). Push them separately first."
        )
    if behind:
        raise VisibilityError(
            f"Current branch is {behind} commit(s) behind its upstream. Update it before --push."
        )
    return remote, merge_ref


def atomic_write(path: Path, content: bytes) -> None:
    """Replace a page only after a complete temporary file has been written."""
    permissions = stat.S_IMODE(path.stat().st_mode)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(content)
            temporary.flush()
        os.chmod(temporary_path, permissions)
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except PermissionError:
                # Windows may prevent removing a temporary file with a copied
                # read-only permission after an unsuccessful replacement.
                temporary_path.chmod(stat.S_IREAD | stat.S_IWRITE)
                temporary_path.unlink()


def switch_projects(root: Path, slugs: list[str], public: bool, push: bool) -> int:
    projects = discover_projects(root)
    unknown = [slug for slug in slugs if slug not in projects]
    if unknown:
        raise VisibilityError(
            f"Unknown project(s): {', '.join(unknown)}. Use 'list' to see available slugs."
        )
    pages = [page for slug in slugs for page in projects[slug]]
    planned = [(page, page.render(public)) for page in pages]
    changed = [(page, content) for page, content in planned if content != page.original]
    remote_and_ref = prepare_push(root, pages) if push else None
    state = "public" if public else "private"
    if not changed:
        print(f"Already {state}: {', '.join(slugs)}. No files changed; no commit or push needed.")
        return 0

    # Validate every requested slug and page, and finish Git preflight, before writing.
    if any(page.path.read_bytes() != page.original for page in pages):
        raise VisibilityError("A selected page changed during validation. Retry after checking the files.")
    written: list[ProjectPage] = []
    try:
        for page, content in changed:
            atomic_write(page.path, content)
            written.append(page)
    except OSError:
        for page in written:
            atomic_write(page.path, page.original)
        raise
    print(f"Set {', '.join(slugs)} to {state} ({len(changed)} page(s)).")
    if remote_and_ref is not None:
        paths = [page.path.relative_to(root).as_posix() for page, _ in changed]
        message = f"Set research project visibility to {state}: {', '.join(slugs)}"
        # --only keeps unrelated staged files out of this commit and in the index.
        git(root, "commit", "--only", "-m", message, "--", *paths)
        remote, merge_ref = remote_and_ref
        git(root, "push", "--no-follow-tags", "--", remote, f"HEAD:{merge_ref}")
        print("Committed and pushed only the selected project pages.")
    else:
        print("Changes are local. Commit and push when ready.")
    print("private only hides the web pages; public repository source and assets remain accessible.")
    return 0


def main(argv: list[str] | None = None, *, root: Path | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Publish or hide research pages. private hides pages, not public repository source or assets.",
        epilog="Examples: list | protein-foundation private | protein-foundation,protein-control public --push",
    )
    parser.add_argument("project", help="Project slug, comma-separated slugs, or list")
    parser.add_argument("visibility", choices=("private", "public"), nargs="?")
    parser.add_argument("--push", action="store_true", help="Commit only selected clean tracked pages and push their upstream branch")
    args = parser.parse_args(argv)
    root = root.resolve() if root is not None else Path(__file__).resolve().parent.parent
    try:
        if args.project == "list":
            if args.visibility or args.push:
                parser.error("list does not accept a visibility or --push")
            for slug, pages in discover_projects(root).items():
                values = {page.published for page in pages}
                state = ("public" if True in values else "private") if len(values) == 1 else "mixed"
                filenames = ", ".join(page.path.name for page in pages)
                print(f"{slug:<28} {state:<8} {filenames}")
            print("private only hides the web pages; public repository source and assets remain accessible.")
            return 0
        if args.visibility is None:
            parser.error("a project requires private or public")
        slugs = list(dict.fromkeys(slug.strip() for slug in args.project.split(",")))
        if any(not slug for slug in slugs):
            raise VisibilityError("Project slugs must not be empty.")
        return switch_projects(root, slugs, args.visibility == "public", args.push)
    except (VisibilityError, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
