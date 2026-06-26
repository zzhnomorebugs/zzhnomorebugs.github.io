---
title: "平移不变连续扩散视角下的贝叶斯流网络"
layout: research
collection: research
permalink: /zh/research/bayesian-flow-networks/
lang_switch_url: /research/bayesian-flow-networks/
lang: zh-CN
order: 2
published: true
read_time: true
date: 2026-06-25
tags: [diffusion, BFN, discrete-generation, generative-modeling]
tldr: "BFN 扩散的是连续分布参数，而非原始数据。在离散分支中，scaled-logit 提升将 one-hot 目标嵌入欧氏空间上的高斯前向过程，softmax 消除平移冗余，Tweedie 将类别预测器映射为 score 场，用于 ODE/SDE 采样与梯度引导。"
excerpt: "离散 BFN 作为平移冗余连续扩散的简明技术笔记，涵盖 scaled-logit 嵌入、单纯形几何、数据匹配训练与基于 Tweedie 的 score 采样。"
papers:
  - ocean-imputation-mask
---

{% include toc %}

## 概述

对贝叶斯流网络（BFN）的离散分支，生成可写为在连续分布参数上的扩散，而非离散符号本身。关键步骤是经 scaled-logit 提升将类别标签映射到欧氏状态，再经高斯腐蚀与基于 score 的反向动力学。这在采样接口上与连续扩散一致，同时通过 softmax 解码保留类别语义。

本笔记有意限定于离散 scaled-logit 表述，不试图重推原始 BFN 论文中完整的发送方–接收方贝叶斯消息传递视角。

<pre class="mermaid">
flowchart LR
  classLabel["离散类别 c"] --> lift["提升 x0 = K ec"]
  lift --> forward["前向高斯腐蚀"]
  forward --> predictor["预测类别概率"]
  predictor --> tweedie["经 Tweedie 得 score"]
  tweedie --> reverse["反向 ODE 或 SDE"]
  reverse --> decode["解码为类别样本"]
</pre>

## 1. 参数空间上的扩散

BFN 使用连续参数状态 \\(x_t\\) 表示对离散变量的信念，而非对离散变量本身扩散。在高斯前向族下，

$$
x_t = \alpha_t x_0 + \sigma_t \epsilon, \qquad \epsilon \sim \mathcal{N}(0, I),
$$

边缘 \\(p_t(x_t)\\) 是欧氏空间上的连续密度，故 \\(\\nabla_{x_t}\\log p_t(x_t)\\) 是标准 score 场。

## 2. 经 scaled logits 的离散提升

对 \\(c \in \{1,\dots,K\}\\)，定义

$$
x_0 = K e_c,
$$

其中 \\(e_c\\) 为 one-hot 基向量。随尺度增大，\\(\\mathrm{softmax}(K e_c)\\) 趋近 \\(e_c\\)，将类别生成转化为连续目标 \\(x_0\\) 上的回归。有限 \\(K\\) 下这是受控近似，而非精确恒等。

## 3. 平移冗余与单纯形几何

类别语义取决于 \\(\\mathrm{softmax}(x)\\)，而非绝对 logits。因此 \\(x\\) 与 \\(x + b\\mathbf{1}\\) 编码相同类概率，在 logit 空间引入一维冗余。

架构上将 \\(\\mathrm{softmax}(x_t)\\) 送入预测器，在表示层面消除该冗余，且不损失与 \\(p(c \mid x_t)\\) 相关的信息。在此参数化下，沿全一向量方向的 score 分量不可辨识，可视为规范自由度。

## 4. 离散数据匹配训练

该分支的标准目标为加权数据匹配：

$$
\mathcal{L}_{\mathrm{DM}} = \mathbb{E}_{t,c,\epsilon}\big[w(t)\,\big\|\hat{e}_\theta\!\big(t,\mathrm{softmax}(x_t)\big)-e_c\big\|^2\big].
$$

此处 \\(\\hat{e}_\theta\\) 预测类概率目标（等价于 \\(x_0/K\\)），而非 \\(\\epsilon\\)。调度项 \\(w(t), \alpha_t, \sigma_t\\) 应一致选取。

## 5. 经 Tweedie 的 score 与反向采样

在 \\(x_t \mid x_0 \sim \mathcal{N}(\alpha_t x_0,\sigma_t^2 I)\\) 下，Tweedie 给出

$$
\nabla_{x_t}\log p_t(x_t) = \frac{\alpha_t \,\mathbb{E}[x_0 \mid x_t]-x_t}{\sigma_t^2}.
$$

用 \\(\\mathbb{E}[x_0 \mid x_t] \approx K\,\hat{e}_\theta(t,\mathrm{softmax}(x_t))\\) 得

$$
\nabla_{x_t}\log p_t(x_t)=\frac{\alpha_t K\,\hat{e}_\theta(t,\mathrm{softmax}(x_t))-x_t}{\sigma_t^2}.
$$

这直接支持概率流 ODE 或 SDE 反向积分，控制面与连续 score 模型相同。

## 6. 潜空间梯度引导

因采样状态连续，可通过在 \\(x_t\\) 空间添加梯度项注入引导，例如来自条件损失 \\(\\mathcal{L}_{\mathrm{guide}}(x_t, y)\\)。这是 context-query 设定中观测对齐掩码引导所用的机制：引导作用于 logits，解码仍为类别。

## 7. 二值掩码的因子分解

对 \\(M \in \{0,1\}^d\\)，一种实用视角是 \\(d\\) 个耦合二值子问题（每点 \\(K=2\\)），联合潜状态在 \\(\\mathbb{R}^{2d}\\) 或等价逐点 logits 中。空间依赖由 \\(\\mathrm{softmax}(x_t)\\) 上的网络架构捕获，而非推理时假设输出独立。

## 8. 范围与注意

- 本笔记针对离散 scaled-logit BFN；连续数据 BFN 通常在高斯后验参数上表述，与原始数据 VP 扩散并不相同。
- \\(\\mathrm{softmax}(K e_c)\approx e_c\\) 的近似质量依赖有限 \\(K\\)。
- 训练以数据匹配形式陈述，反向采样使用由 Tweedie 导出的 score 动力学。

## 相关链接

- Context-query 学习中的应用级集成：[Context-Query 动力学](/zh/research/context-query-dynamics/)。
- 原始 BFN 参考：[Graves et al., Bayesian Flow Networks (arXiv:2308.07037)](https://arxiv.org/abs/2308.07037)。
- 经 SDE 统一 BFN 与扩散：[Xue et al., Unifying Bayesian Flow Networks and Diffusion Models through Stochastic Differential Equations (arXiv:2404.15766)](https://arxiv.org/abs/2404.15766)。
