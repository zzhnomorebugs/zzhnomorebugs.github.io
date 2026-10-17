# 研究项目的显示与隐藏

这里的 `private` 表示网站不生成项目页面，也不在项目列表展示；`public` 表示正常生成并展示。二者对应页面 front matter 的 `published: false` / `true`。

这不是密码保护。当前 GitHub 仓库是公开的，页面源码、提交历史及图片仍可公开查看。网站隐藏与 GitHub 仓库权限是两件事。

## 最简单的自然语言指令

直接告诉 Codex：

- “把 protein-foundation 设为 private 并推送。”
- “把蛋白质序列生成项目设为 public 并推送。”
- “把 protein-foundation 和 protein-control 都设为 private 并推送。”

仓库的 `AGENTS.md` 已记录约定，后续处理会使用同一工具同步更新中英文页面。

## 一条本地命令

在仓库根目录执行，使用 Python 3，无需安装额外依赖。

```powershell
# 查看各项目的本地状态
python scripts/project_visibility.py list

# 只修改本地状态
python scripts/project_visibility.py protein-foundation private
python scripts/project_visibility.py protein-foundation public

# 修改、仅提交该项目页面，并推送当前分支
python scripts/project_visibility.py protein-foundation public --push
python scripts/project_visibility.py protein-foundation private --push

# 同时切换多个项目
python scripts/project_visibility.py protein-foundation,protein-control private --push
```

项目 slug 来自 `_research/` 中的文件名。例如 `protein-control.html` 和 `protein-control-zh.html` 同属 `protein-control`，一条指令会同时更新两种语言。

`--push` 适合已经纳入 Git 的页面：目标页面应没有尚未提交的内容改动，当前分支应已配置上游，且没有先前尚未推送的提交。工具只提交本次选定的项目页面，保留其他已暂存和未暂存的工作；不会强制推送或附带推送标签。若提交成功而推送失败，本地提交会保留；解决连接或分支问题后，使用 `git push` 推送这个提交。此时不要重复执行工具的 `--push`，因为它会检测到已有未推送提交并拒绝继续。

纯本地命令不会提交或推送。`list` 显示当前工作目录中的状态，不能用来判断 GitHub Pages 是否已经部署完成。

## 发布检查

推送会进入网站原有的 GitHub Pages 发布流程。可先构建检查：

```powershell
bundle exec jekyll build
```

隐藏后应确认目标 HTML 不再生成，且中文、英文项目列表均无对应入口。正常构建不要加 `--unpublished`；这个开关仅用于本地预览未发布内容。

如果需要在 GitHub 网页上操作，也可以编辑对应文件的 `published` 并提交。多语言项目需要同步修改全部语言文件，使用本地工具更不容易遗漏。
