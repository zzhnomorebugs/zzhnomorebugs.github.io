"""Exercise visibility changes and isolated Git publishing in temporary repos."""

from __future__ import annotations

import os
import contextlib
import importlib.util
import io
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "project_visibility.py"


class ProjectVisibilityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="project-visibility-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "website"
        (self.root / "scripts").mkdir(parents=True)
        (self.root / "_research").mkdir()
        shutil.copy2(SCRIPT, self.root / "scripts" / SCRIPT.name)
        self.pages = [self.root / "_research" / name for name in ("protein.html", "protein-zh.html")]
        self.initial = (
            "---\r\ntitle: 蛋白质\r\nresearch_project: true # project\r\n"
            "published : true  # keep this comment\r\n---\r\n"
            "<p>published: true must remain in the body.</p>\r\n"
        ).encode("utf-8")
        for page in self.pages:
            page.write_bytes(self.initial)

    def command(self, *args, ok=True):
        environment = os.environ.copy()
        environment.update({"GIT_TERMINAL_PROMPT": "0", "GIT_AUTHOR_NAME": "Visibility Test", "GIT_AUTHOR_EMAIL": "visibility@example.invalid", "GIT_COMMITTER_NAME": "Visibility Test", "GIT_COMMITTER_EMAIL": "visibility@example.invalid"})
        result = subprocess.run(
            [sys.executable, str(self.root / "scripts" / SCRIPT.name), *args],
            cwd=self.root,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if ok:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def git(self, *args, cwd=None):
        environment = os.environ.copy()
        environment.update({"GIT_AUTHOR_NAME": "Visibility Test", "GIT_AUTHOR_EMAIL": "visibility@example.invalid", "GIT_COMMITTER_NAME": "Visibility Test", "GIT_COMMITTER_EMAIL": "visibility@example.invalid"})
        result = subprocess.run(
            ["git", "-c", "commit.gpgsign=false", *args],
            cwd=cwd or self.root,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout.strip()

    def setup_repository(self):
        self.git("init", "--initial-branch=main")
        self.git("config", "core.autocrlf", "false")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.hooksPath", str(self.base / "no-hooks"))
        (self.root / "other.txt").write_text("original\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "initial")
        self.remote = self.base / "remote.git"
        self.git("init", "--bare", str(self.remote))
        self.git("remote", "add", "origin", str(self.remote))
        self.git("push", "--set-upstream", "origin", "main")

    def test_list_and_bilingual_switch_preserve_bytes(self):
        self.assertIn("protein", self.command("list").stdout)
        self.assertIn("public", self.command("list").stdout)
        self.command("protein", "private")
        expected = self.initial.replace(b"published : true", b"published : false", 1)
        for page in self.pages:
            self.assertEqual(page.read_bytes(), expected)
        self.assertIn("private", self.command("list").stdout)
        self.command("protein", "public")
        for page in self.pages:
            self.assertEqual(page.read_bytes(), self.initial)

    def test_noop_does_not_rewrite_files(self):
        before = [(page.read_bytes(), page.stat().st_mtime_ns) for page in self.pages]
        result = self.command("protein", "public")
        self.assertIn("No files changed", result.stdout)
        self.assertEqual(before, [(page.read_bytes(), page.stat().st_mtime_ns) for page in self.pages])

    def test_invalid_slug_in_batch_changes_nothing(self):
        self.command("protein,does-not-exist", "private", ok=False)
        for page in self.pages:
            self.assertEqual(page.read_bytes(), self.initial)

    def test_multi_project_switch(self):
        other = self.root / "_research" / "other.md"
        other.write_bytes(self.initial)
        self.command("protein,other", "private")
        for page in [*self.pages, other]:
            self.assertIn(b"published : false", page.read_bytes())

    def test_missing_published_field_is_inserted_without_body_changes(self):
        without_field = self.initial.replace(b"published : true  # keep this comment\r\n", b"")
        self.pages[0].write_bytes(without_field)
        self.command("protein", "private")
        expected = without_field.replace(b"---\r\n<p>", b"published: false\r\n---\r\n<p>", 1)
        self.assertEqual(self.pages[0].read_bytes(), expected)

    def test_bom_and_lf_are_preserved(self):
        original = b"\xef\xbb\xbf" + self.initial.replace(b"\r\n", b"\n")
        self.pages[0].write_bytes(original)
        self.command("protein", "private")
        self.assertEqual(self.pages[0].read_bytes(), original.replace(b"published : true", b"published : false", 1))

    def load_module(self):
        name = "project_visibility_under_test"
        spec = importlib.util.spec_from_file_location(name, SCRIPT)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        self.addCleanup(sys.modules.pop, name, None)
        spec.loader.exec_module(module)
        return module

    def test_partial_temporary_write_restores_both_pages_without_temp_files(self):
        module = self.load_module()
        make_temporary = module.tempfile.NamedTemporaryFile
        calls = 0

        def fail_on_second_write(*args, **kwargs):
            nonlocal calls
            temporary = make_temporary(*args, **kwargs)
            calls += 1
            if calls == 2:
                write = temporary.write

                def partial_write_then_fail(content):
                    write(content[:7])
                    raise OSError("Simulated disk failure during the second page write")

                temporary.write = partial_write_then_fail
            return temporary

        with mock.patch.object(module.tempfile, "NamedTemporaryFile", side_effect=fail_on_second_write):
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(module.main(["protein", "private"], root=self.root), 1)
        for page in self.pages:
            self.assertEqual(page.read_bytes(), self.initial)
        self.assertEqual(list((self.root / "_research").glob("*.tmp")), [])

    def test_external_edit_during_push_preflight_is_not_overwritten(self):
        module = self.load_module()
        changed = self.initial + b"external edit\r\n"

        def change_page_during_preflight(root, pages):
            self.pages[1].write_bytes(changed)
            return "origin", "refs/heads/main"

        with mock.patch.object(module, "prepare_push", side_effect=change_page_during_preflight):
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(module.main(["protein", "private", "--push"], root=self.root), 1)
        self.assertEqual(self.pages[0].read_bytes(), self.initial)
        self.assertEqual(self.pages[1].read_bytes(), changed)

    @unittest.skipUnless(shutil.which("git"), "Git is needed for isolated publish tests")
    def test_push_commits_only_selected_pages_and_preserves_staging(self):
        self.setup_repository()
        (self.root / "other.txt").write_text("staged work\n", encoding="utf-8")
        self.git("add", "other.txt")
        untracked = self.root / "untracked.txt"
        untracked.write_text("leave me alone\n", encoding="utf-8")
        staged_before = self.git("diff", "--cached")
        self.command("protein", "private", "--push")
        names = self.git("show", "--format=", "--name-only", "HEAD").splitlines()
        self.assertEqual(set(names), {"_research/protein.html", "_research/protein-zh.html"})
        self.assertEqual(self.git("diff", "--cached"), staged_before)
        self.assertEqual(untracked.read_text(encoding="utf-8"), "leave me alone\n")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.git("rev-parse", "refs/heads/main", cwd=self.remote))
        self.assertIn("?? untracked.txt", self.git("status", "--short"))
        head_before = self.git("rev-parse", "HEAD")
        self.command("protein", "private", "--push")
        self.assertEqual(self.git("rev-parse", "HEAD"), head_before)

    @unittest.skipUnless(shutil.which("git"), "Git is needed for isolated publish tests")
    def test_push_rejects_dirty_target_before_changing_any_page(self):
        self.setup_repository()
        dirty = self.initial + b"local edit\r\n"
        self.pages[0].write_bytes(dirty)
        result = self.command("protein", "private", "--push", ok=False)
        self.assertIn("uncommitted changes", result.stderr)
        self.assertEqual(self.pages[0].read_bytes(), dirty)
        self.assertEqual(self.pages[1].read_bytes(), self.initial)

    @unittest.skipUnless(shutil.which("git"), "Git is needed for isolated publish tests")
    def test_push_does_not_follow_unpushed_tags_from_user_configuration(self):
        self.setup_repository()
        self.git("config", "push.followTags", "true")
        self.git("tag", "-a", "local-only", "-m", "Do not publish this tag")
        self.command("protein", "private", "--push")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.git("rev-parse", "refs/heads/main", cwd=self.remote))
        self.assertEqual(self.git("for-each-ref", "--format=%(refname)", "refs/tags", cwd=self.remote), "")
        self.assertEqual(self.git("for-each-ref", "--format=%(refname)", "refs/tags"), "refs/tags/local-only")

    @unittest.skipUnless(shutil.which("git"), "Git is needed for isolated publish tests")
    def test_push_rejects_preexisting_unpushed_commits(self):
        self.setup_repository()
        (self.root / "other.txt").write_text("unpublished commit\n", encoding="utf-8")
        self.git("add", "other.txt")
        self.git("commit", "-m", "not authorized for this push")
        result = self.command("protein", "private", "--push", ok=False)
        self.assertIn("pre-existing unpushed", result.stderr)
        for page in self.pages:
            self.assertEqual(page.read_bytes(), self.initial)

    @unittest.skipUnless(shutil.which("git"), "Git is needed for isolated publish tests")
    def test_push_rejects_untracked_page_but_local_switch_allows_it(self):
        self.setup_repository()
        page = self.root / "_research" / "new.html"
        page.write_bytes(self.initial)
        self.command("new", "private", "--push", ok=False)
        self.assertEqual(page.read_bytes(), self.initial)
        self.command("new", "private")
        self.assertIn(b"published : false", page.read_bytes())

    @unittest.skipUnless(shutil.which("git"), "Git is needed for isolated publish tests")
    def test_push_rejects_missing_upstream(self):
        self.git("init", "--initial-branch=main")
        self.git("config", "core.autocrlf", "false")
        self.git("add", ".")
        self.git("commit", "-m", "initial")
        self.command("protein", "private", "--push", ok=False)
        for page in self.pages:
            self.assertEqual(page.read_bytes(), self.initial)


if __name__ == "__main__":
    unittest.main()
