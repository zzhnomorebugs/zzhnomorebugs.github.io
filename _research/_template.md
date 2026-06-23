---
title: "Your Research Topic Title"
layout: research
collection: research
permalink: /research/your-topic-slug/
order: 1
published: false
read_time: true
date: 2026-06-23
tags: [diffusion, AI4Science]
tldr: "Replace with 3-5 sentences: problem, core idea, main result."
excerpt: "One or two sentences for the index card on /research/."
papers:
  - ocean-imputation-mask
paperurl:
githuburl:
slidesurl:
lang_switch_url: /zh/research/your-topic-slug/
---

{% include toc %}

> Delete this block after drafting. See `_WRITING-GUIDE.md` for full conventions.

## 技术路线图

<figure class="research-figure">
  <img src="/images/research/your-topic-slug/pipeline.png" alt="Pipeline overview">
  <figcaption class="research-figure__caption">
    Figure 1. Replace with a one-line caption describing each stage.
  </figcaption>
</figure>

Briefly explain how Stage 1 → Stage 2 → Stage 3 connect (inputs, outputs, and dependencies).

## 1. 问题定义

Formalize the problem: notation, input/output, objective, and constraints.

$$
\min_\theta \; \mathbb{E}\big[ \mathcal{L}(\theta) \big]
$$

## 2. 背景与动机

Why existing methods are insufficient **for this specific setting** (not a generic survey).

## 3. 方法

### 3.1 Stage / module A

Intuition → equations → pseudocode or implementation notes.

### 3.2 Stage / module B

### 3.3 Stage / module C

## 4. 关键设计选择与消融

| Design choice | Alternative | Why this one |
|:--------------|:------------|:-------------|
| Example | Baseline | Reason |

## 5. 实现细节

```python
def forward(x, mask):
    ...
```

## 6. 实验与分析

Interpret results; do not only paste numbers.

## 7. 总结与开放问题

What worked, what failed, and what to try next.
