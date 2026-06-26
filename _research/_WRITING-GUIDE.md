---
title: "研究笔记写作指南"
layout: research
collection: research
permalink: /research/writing-guide/
order: 99
published: false
read_time: true
tags: [meta, guide]
tldr: "本文件说明 Research Notes 框架的用法、front matter 字段、排版约定与常见坑。新建课题笔记时请复制 `_template.md`。"
excerpt: "Research Notes 框架写作指南与注意事项。"
---

{% include toc %}

本文档面向**作者本人**，说明如何在 `_research/` 下撰写课题技术深读。本站已配置 `research` collection、`research` 布局、MathJax 与右侧目录（TOC）。

> **预览本文布局：** 将 front matter 中 `published: false` 改为 `published: true`，本地 `bundle exec jekyll serve` 后访问 `/research/writing-guide/`。写完记得改回 `false`，或删除本文件。

---

## 1. 新建一篇笔记的流程

1. 复制 `_research/_template.md` 为 `_research/your-topic-slug.md`
2. 填写 front matter（见下一节）
3. 正文以 `{% raw %}{% include toc %}{% endraw %}` 开头
4. 按推荐章节结构写作
5. 设 `published: true` 后构建站点
6. 在 `_data/navigation.yml` 中已有 **Research / 研究笔记** 入口，无需额外配置

**permalink 建议：** `/research/ocean-mask/` 这类短 slug，与论文 permalink 区分开。

**排序：** 用 `order` 控制索引页与文内「上一篇 / 下一篇」顺序（数字越小越靠前）。

---

## 2. Front Matter 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 课题标题，显示在页面顶部与索引卡片 |
| `layout` | 是 | 固定写 `research`（collection 默认值已设，可省略） |
| `collection` | 是 | 固定写 `research` |
| `permalink` | 是 | 独立 URL，如 `/research/ocean-mask/` |
| `order` | 是 | 整数，控制列表与翻页顺序 |
| `published` | 是 | `true` 才会出现在 `/research/` 索引；草稿用 `false` |
| `read_time` | 建议 | `true` 显示预估阅读时长 |
| `date` | 建议 | 最后更新日期，显示在文首 |
| `tags` | 建议 | 标签数组，如 `[diffusion, imputation]` |
| `tldr` | 建议 | 3–5 句摘要，渲染为文首 blockquote（不要用 `excerpt` 代替） |
| `tldr_zh` | 可选 | 中文版 TL;DR |
| `excerpt` | 建议 | 索引页卡片摘要（1–3 句，比 tldr 可稍长） |
| `excerpt_zh` | 可选 | 中文索引摘要 |
| `papers` | 建议 | 关联 `_publications/` 文件名 slug 列表，如 `[ocean-imputation-mask]`，页脚自动链到论文 |
| `paperurl` / `githuburl` / `slidesurl` | 可选 | 额外直链（无对应 publication 文件时用） |
| `lang` | 可选 | 中文正文写 `zh-CN`，并配 `lang_switch_url` 指向英文版 |
| `lang_switch_url` | 可选 | 中英互链，与站点其他页面一致 |

**注意：**

- `excerpt` 会进入 Jekyll 的 `page.excerpt`，**不要**在正文开头重复粘贴 excerpt 内容
- `tldr` 面向「已打开文章」的读者；`excerpt` 面向「只看索引」的读者
- `papers` 里的 slug 需与 `_publications/xxx.md` 的 `xxx` 部分匹配（与 `_data/experience.yml` 中 `publication` 字段规则相同）

---

## 3. 正文结构与标题层级

### 3.1 必须：正文第一行插入 TOC

{% raw %}
```liquid
{% include toc %}
```
{% endraw %}

该 include 会在正文右侧生成 **On This Page**  sticky 目录。目录**仅抓取正文中的 `##` / `###` 标题**，因此：

- **用 `##` 作为一级章节**（Problem、Method、Experiments 等）
- **用 `###` / `####` 作子节**，不要跳级（不要 `##` 后直接 `####`）
- **不要用 `#` 作为正文章节**（页面标题已是 H1）
- 标题文字保持稳定，改标题会导致锚点链接失效

### 3.2 推荐章节骨架（可按课题裁剪）

```markdown
## 技术路线图
## 1. 问题定义
## 2. 背景与动机
## 3. 方法
### 3.1 ...
### 3.2 ...
## 4. 关键设计选择与消融
## 5. 实现细节
## 6. 实验与分析
## 7. 总结与开放问题
```

「技术路线图」一节建议放**一张 pipeline 图** + 2–3 句说明各阶段输入输出关系；后文按阶段或按模块展开，保持图文呼应。

### 3.3 人称与语气

研究笔记正文（含 `tldr`、`excerpt`、图注）统一使用**第三人称**或被动语态，避免作者视角的第一人称：

- 英文：不用 `I frame`、`we design`、`our method` 等；改为 `the problem is framed as`、`the context mask is designed`、`the proposed method`
- 中文：不用「我将…」「我们仅观测」「由我们设计」等；改为「该问题可建模为」「训练阶段仅可获得」「由显式设计的规则」

`papers` 关联的论文摘要（`_publications/`）仍可用论文惯用的 `We propose` 体例，与本笔记文风区分。

---

## 4. 数学公式（MathJax）

站点已在 `_includes/head/custom.html` 加载 MathJax 3。

| 类型 | 写法 | 示例 |
|------|------|------|
| 行内 | `\\( ... \\)` | `\\( \\mathcal{L}(\\theta) \\)` |
| 独立行 | `$$ ... $$` | 见下 |

**行内公式示例：**

```
\\(u_{\\text{obs}} = M \\odot u_0\\)
```

**独立行公式示例：**

```
$$
\mathcal{L} = \mathbb{E}_{t, \mathbf{x}_0, \boldsymbol{\epsilon}}
\left[ \lVert \boldsymbol{\epsilon} - \boldsymbol{\epsilon}_\theta(\mathbf{x}_t, t) \rVert^2 \right]
$$
```

**常见坑（Kramdown + MathJax）：**

1. **行内与独立行转义规则不同：**
   - 行内 `\\( ... \\)`：LaTeX 命令用双反斜杠，如 `\\odot`、`\\mid`
   - 独立行 `$$ ... $$`：LaTeX 命令用单反斜杠，如 `\odot`、`\mid`、`\sum`
2. **行内公式里的 `_` 可能触发斜体：** 若出现 `_i = 1 \mid M_` 这类跨命令下划线，对「裸露」下划线写 `\_i`（如 `(M_{\\text{qry}})\_i`）
3. **文本型下标用 `\\text{}`：** 如 `ctx`、`qry`、`obs` 写作 `M_{\\text{ctx}}`、`u_{\\text{obs}}`（独立行 `$$` 内用单反斜杠 `\text`）；复合下标如 `u_{\\text{obs},t}`
4. **独立行换行：** `\\[4pt]` 在 `$$` 块内保留双反斜杠
5. **`{}` 在部分语境下被 Liquid 解析：** 若构建报错，可对整段公式使用 `{% raw %}...{% endraw %}` 包裹
6. **多行对齐：** 可用 `\begin{aligned}...\end{aligned}` 放在 `$$` 块内
7. **公式过多时：** 关键推导放正文，次要推导放附录小节 `## Appendix`

---

## 5. 图片与示意图

**路径：** 放在 `images/research/your-topic/`，正文引用：

```markdown
![架构总览](/images/research/ocean-mask/pipeline.png)
```

**带说明的图（推荐）：**

```html
<figure class="research-figure">
  <img src="/images/research/ocean-mask/pipeline.png" alt="技术路线：从掩码先验到条件生成">
  <figcaption class="research-figure__caption">
    Figure 1. 三阶段 pipeline：掩码先验预训练 → 样本特定划分 → 条件场生成。
  </figcaption>
</figure>
```

**注意：**

- `alt` 必填，便于无障碍与 SEO
- 架构图优先 **PNG/SVG**，实验曲线可用 PNG；单图宽度建议 1200–1600px
- 正文用「Figure 1」「Figure 2」与图注一致，便于交叉引用
- 已有 `magnific-popup`：若需点击放大，可参考 publications 页的 `image-popup` 类

---

## 6. 代码块

用围栏代码块并标注语言，以获得语法高亮：

````markdown
```python
def context_query_split(mask, ce_score):
    ...
```
````

**实现细节章节建议包含：**

- 关键张量 shape（如 `B × C × H × W`）
- 训练配置（optimizer、lr、batch size）可放表格
- 与论文伪代码的差异点（工程上改了什么）

**避免：** 粘贴整文件；只保留与理解方法相关的片段。

---

## 7. 表格

Kramdown 表格示例：

```markdown
| 方法 | MSE ↓ | PSNR ↑ |
|:-----|------:|-------:|
| Baseline | 0.12 | 28.3 |
| Ours | **0.08** | **31.1** |
```

对齐行用 `|:---|`（左）、`|:---:|`（中）、`|---:|`（右）。

---

## 8. 与站点其他页面的关系

| 页面 | 本笔记应写什么 | 不应重复什么 |
|------|----------------|--------------|
| **Publications** | 推导、设计取舍、实现、踩坑 | 完整 Abstract 原文 |
| **Experience** | 可链到本笔记 | 简历式 bullet 列表 |
| **About / Highlights** | 在 highlights 加一句 + 链接 | 整篇技术细节 |

**交叉链接：**

- 笔记页脚：用 `papers: [slug]` 自动列出论文
- 论文页：可在 `excerpt` 末加「[技术笔记](/research/xxx/)」
- About 的 Recent Highlights：可对某课题加 `read_more` 链到 research 页

---

## 9. 中英文版本

与站点其他页面一致：**各写一篇文件**，用 `lang` + `lang_switch_url` 互链。

```yaml
# 英文版 _research/ocean-mask.md
lang_switch_url: /zh/research/ocean-mask/

# 中文版 _research/ocean-mask-zh.md
lang: zh-CN
permalink: /zh/research/ocean-mask/
lang_switch_url: /research/ocean-mask/
```

索引页 `/research/` 与 `/zh/research/` 分别只列出对应语言条目时，可在 front matter 加 `lang: zh-CN` 并在 `research-index.html` 中过滤——**当前实现为单语言混排**；若需分离，给每篇加 `lang` 字段后告知维护者改 index 过滤逻辑。

---

## 10. 发布前检查清单

- [ ] `published: true`
- [ ] `order` 已按想要的顺序设置
- [ ] 正文以 `{% raw %}{% include toc %}{% endraw %}` 开头
- [ ] `tldr` 与 `excerpt` 已填且互不重复
- [ ] 至少一张技术路线图
- [ ] 公式在本地构建后显示正常
- [ ] 图片路径在本地与 GitHub Pages 均可访问
- [ ] `papers` slug 能正确匹配到 `_publications/` 文件
- [ ] 上一篇 / 下一篇导航顺序符合预期
- [ ] 若含中文页，已配置 `lang_switch_url`

---

## 11. 本地预览

```bash
bundle exec jekyll serve
```

访问 `http://127.0.0.1:4000/research/` 查看索引；单篇为 `http://127.0.0.1:4000/research/your-slug/`。

修改 `_config.yml`、`_layouts/`、`_sass/` 后需**重启** Jekyll 服务。

---

## 12. 示例：最小可发布正文

见同目录 `_template.md`。复制后删除模板中的占位说明文字即可。

---

## Appendix：Liquid 与 Markdown 混用

正文中可使用 Liquid include 等标签，但注意：

- Liquid 定界符（百分号花括号、双花括号）会在 Markdown 代码块之外被 Jekyll 提前解析
- 展示 Liquid 示例时，用 raw 标签包裹整段示例
- 展示 Jekyll 变量示例时，避免在草稿里写未定义的 site 变量，除非确实需要

---

*文档版本：与 `research` collection 框架同步。如有布局问题，检查 `_layouts/research.html` 与 `_sass/layout/_research.scss`。*
