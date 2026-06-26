---
title: "扩散模型中的 Context-Query 动力学：从掩码性质到生成式构造"
layout: research
collection: research
permalink: /zh/research/context-query-dynamics/
lang_switch_url: /research/context-query-dynamics/
lang: zh-CN
order: 1
published: true
read_time: true
date: 2026-06-23
tags: [diffusion, imputation, context-query, AI4Science]
tldr: "核心问题是：context-query 掩码需要满足什么性质，扩散模型才能从不完整观测中学习。第一项工作刻画了这一要求：每个可恢复维度都必须以严格正概率进入 query 集，否则去噪器在该维度不可识别；同时给出已知掩码族下的第一种构造，即分布保持划分与集成推理。第二项工作进一步回答如何生成这样的掩码：当掩码拓扑复杂或未知时，可学习生成式掩码先验，并按构造采样满足性质的 context-query 划分。"
excerpt: "围绕 context-query 扩散的一条研究叙事：先刻画有效掩码划分应满足的性质，再用学习到的掩码先验为复杂缺失模式生成有效划分。"
papers:
  - incomplet-data
  - ocean-imputation-mask
---

{% include toc %}

## 概述

### 核心问题

Context-query 掩码需要满足什么性质，扩散模型才能从不完整观测中学习？

许多科学数据集并非随机缺失若干条目，而是通过传感器、卫星、探针或仿真，只揭示底层场的结构化子区域。困难在于，标准监督模型需要「不完整输入—完整目标」配对，而在此设定下训练阶段从未出现完整目标。

Context-query 思路在每条部分观测内部构造监督：从已观测区域中，将一部分隐藏为 **query** 目标，另一部分作为 **context** 输入。这能把不完整数据转化为自监督，但前提是划分具有正确的统计性质：每个不在 context 中、但由观测过程可恢复的维度，都必须以严格正概率出现在 query 中。

因此，这条研究线并不是一组掩码划分算法的列表，而是从 “性质要求” 到 “构造机制” 的递进：先说明什么样的 context-query split 是有效的，再说明如何在更复杂的观测拓扑下自动生成这样的 split。

本页的两项工作构成同一条主线。第一项工作回答：有效的 context-query 掩码必须满足什么性质，并在掩码族已知时给出第一种构造。第二项工作回答：当掩码拓扑复杂或未知时，如何从学习到的掩码先验中生成满足这些性质的划分。

<nav class="research-jump-nav" aria-label="章节导航">
  <a href="#技术路线图">路线图</a>
  <a href="#2-context-query-骨干与掩码性质">性质要求</a>
  <a href="#first-construction">第一种构造</a>
  <a href="#general-construction">一般构造</a>
  <a href="#5-总结">总结</a>
</nav>

## 技术路线图

<pre class="mermaid">
flowchart TB
  subgraph backbone["Context-Query 骨干"]
    obs["部分观测与掩码 M"]
    split["将 M 划分为 context 与 query"]
    train["在 context 上训练并在 query 上计算损失"]
    obs --> split
    split --> train
  end

  subgraph req["掩码性质要求"]
    pos["严格 query 正性"]
    ident["可识别的去噪目标"]
    pos --> ident
  end

  subgraph first["第一种构造"]
    part1["分布保持划分"]
    ens["集成推理"]
    part1 --> ens
  end

  subgraph general["一般构造"]
    bfn["在掩码先验上预训练 BFN"]
    inter["两次独立掩码的交集作为 context"]
    guide["观测对齐引导"]
    bfn --> inter
    inter --> guide
  end

  train --> req
  req --> first
  req --> general
  first --> output["有效的 context-query 监督"]
  general --> output
</pre>

上图将学习骨干、掩码性质要求与两种构造方式分开。分布保持划分是掩码族已知时的第一种构造；生成式掩码先验划分则是面向复杂或未知拓扑的一般构造。

<div class="research-pillars">
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">性质要求 · Query 正性</span>

给定部分观测 \\(u_{\text{obs}} = M \odot u_0\\)，有效划分必须让每个可恢复的非 context 维度以正概率出现在 \\(M_{\text{qry}}\\) 中，否则该处去噪目标不可识别。
</div>
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">第一种构造 · 已知掩码族</span>

以与 \\(p_{\text{mask}}(M)\\) 相同的结构模式采样 \\(M_{\text{ctx}}\\)。当观测模式已知时，这种分布保持划分能给出轻量的有效 split。
</div>
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">一般构造 · 学习掩码先验</span>

学习 \\(p(M)\\)，令 \\(M_{\text{ctx}} = M_1 \odot M_2\\)（两次独立掩码），并将样本引导到当前观测附近。有效划分由模型生成，而不是手工设计。
</div>
</div>

## 1. 问题设定

完整数据 \\(u_0 \\in \\mathbb{R}^d \\sim p_{\\text{data}}\\)，二值观测掩码 \\(M \\in \\{0,1\\}^d \\sim p_{\\text{mask}}(M)\\)，且 \\(p_{\\text{mask}}(M \\mid u_0) = p_{\\text{mask}}(M)\\)。训练阶段仅可获得

$$
u_{\text{obs}} = M \odot u_0
$$

**训练中从未出现完整样本**。目标：学习 \\(p_\\phi(u_0 \\mid u_{\\text{obs}}, M)\\)。

直观上，\\(M\\) 标明哪些坐标可见，\\(1-M\\) 标记最终要重建的区域。挑战不仅是填补特定缺失区域，而是从每条样本以不同结构化方式被审查的数据集中，学习完整场的条件分布。

<figure class="research-figure">
  <a href="/images/research/context-query-dynamics/mask-topologies.png" class="image-popup">
    <img src="/images/research/context-query-dynamics/mask-topologies.png" alt="海洋与卫星数据中结构化不完整观测掩码示例">
  </a>
  <figcaption class="research-figure__caption">
    图 1. 真实不完整观测往往具有结构化空间拓扑，如区域海洋覆盖或卫星轨迹模式，而非独立随机缺失像素。
  </figcaption>
</figure>

## 2. Context-Query 骨干与掩码性质

骨干将每条部分观测视为一个小型自监督任务。模型不直接重建从未观测的条目，而是先重建「已观测但被故意从输入中隐藏」的条目。这样既提供有效训练目标，又使测试时任务与插补对齐。

### 层次化掩码

将 \\(u_{\\text{obs}}\\) 视为「在其支撑内完整」，再划分为 context 掩码 \\(M_{\\text{ctx}} \\subseteq M\\)（模型输入）与 query 掩码 \\(M_{\\text{qry}} \\subseteq M\\)（损失区域）。带噪状态为

$$
u_{\text{obs},t} = M \odot (\alpha_t u_{\text{obs}} + \sigma_t \epsilon),
$$

训练 \\(u_\\phi\\) 仅依据 context 预测干净数据：

$$
\mathcal{L}(t, u_{\text{obs}}, M_{\text{ctx}}, M_{\text{qry}}) = \big\| M_{\text{qry}} \odot \big( u_\phi(t,\, M_{\text{ctx}} \odot u_{\text{obs},t},\, M_{\text{ctx}}) - u_{\text{obs}} \big) \big\|^2
$$

> 模型只看到 \\(M_{\\text{ctx}}\\) 与掩码输入——它必须推断被遮蔽区域，而非记忆。

### 核心结论

主要保证很直接：模型只能学到有时出现在 query 集中的维度。若某坐标在固定 context 下始终不参与损失，目标函数不会驱使去噪器在该处正确。

最小化损失后，对每个维度 \\(i\\) 有

$$
\big(u_\phi(t, M_{\text{ctx}} \odot u_{\text{obs},t}, M_{\text{ctx}})\big)_i = \begin{cases}
\mathbb{E}\!\left[(u_0)_i \mid M_{\text{ctx}} \odot u_{\text{obs},t},\, M_{\text{ctx}}\right], & P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) > 0 \\[4pt]
\text{任意}, & P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) = 0
\end{cases}
$$

若所有可能的 \\(M_{\\text{qry}}\\) 的并集覆盖全部维度，则

$$
u_\phi = \mathbb{E}[u_0 \mid M_{\text{ctx}} \odot u_{\text{obs},t}, M_{\text{ctx}}].
$$

> 维度 \\(i\\) 的期望平方梯度与参数更新频率均与 \\(p_i := P((M_{\\text{qry}})\_i = 1 \\mid M_{\\text{ctx}})\\) 同阶——零 query 维度根本得不到梯度。

### 设计原则

整个框架归结为一项要求（外加平衡条件）：

$$
P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) > 0 \quad \forall\, i:\ (M_{\text{ctx}})_i = 0, \qquad P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) \approx P((M_{\text{qry}})_j = 1 \mid M_{\text{ctx}})
$$

这就是组织后续两种构造的性质要求：若掩码族已知，可直接设计分布保持划分；若掩码拓扑复杂或未知，则需要从学习到的掩码先验中生成有效划分。

<div class="research-work-section" markdown="1">

## 3. 第一种构造 - 分布保持划分 {#first-construction}

第一种构造适用于观测掩码具有已知结构的情形，如独立像素 dropout、规则传感器模式或块状遮挡。此时目标不是再学习一个掩码生成器，而是构造一个 context 掩码，使其分布保持原始观测过程的结构族。

这项工作的作用有两层：一是刻画有效 context-query 掩码必须满足的性质；二是在掩码族已知时，说明这些性质可以通过轻量的手工划分实现。

<figure class="research-figure">
  <a href="/images/research/context-query-dynamics/context-query-selection.png" class="image-popup">
    <img src="/images/research/context-query-dynamics/context-query-selection.png" alt="像素级与块级 context-query 划分策略对比">
  </a>
  <figcaption class="research-figure__caption">
    图 2. Context-query 选择须尊重掩码分布：像素级划分可能产生零 query 区域，块级划分在块状观测下保持 query 概率为正。
  </figcaption>
</figure>

### 划分

由全概率公式分解 query 概率：

$$
P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) = \sum_{M} P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}, M)\, P(M \mid M_{\text{ctx}})
$$

由于 \\(M_{\\text{ctx}} \\subseteq M\\)，以与 \\(p_{\\text{mask}}(M)\\) **相同的结构模式**采样 \\(M_{\\text{ctx}}\\)（独立像素 → 独立丢弃像素；块状结构 → 丢弃整块），使多个 \\(M\\) 与给定 \\(M_{\\text{ctx}}\\) 相容，两因子可同时为正 → 每个已观测维度的正性成立。

> Context 过少 → 信息缺口大、方差高、收敛慢；过多 → \\(p_i\\) 极小、更新稀少。中等比例最优。

### 用多个有效 context 推理

训练时去噪器只看到 context 子集；推理时则有完整观测支撑 \\(M\\)。集成让模型回答多个略有不同的 context 问题并平均答案，在不改变已训练骨干的前提下利用额外观测。

推理存在训练/测试不匹配：模型给出 \\(\\mathbb{E}[u_0 \\mid M_{\\text{ctx}} \\odot u_{\\text{obs},t}, M_{\\text{ctx}}]\\)，而推理目标是 \\(\\mathbb{E}[u_0 \\mid u_{\\text{obs},t}, M]\\)。通过对 context 掩码集成来桥接。

**单步采样。** 施加极小噪声 \\(u_\\delta = \\alpha_\\delta u_{\\text{obs}} + \\sigma_\\delta \\epsilon\\)，\\(0 < \\delta \\ll 1\\)（使 \\(M \\odot u_\\delta \\approx u_{\\text{obs}}\\)），再对 \\(K\\) 个 context 掩码取平均：

$$
\hat\mu_K = \frac{1}{K} \sum_{k=1}^{K} u_\phi\!\left(\delta,\, M_{\text{ctx}}^{(k)} \odot u_{\text{obs},\delta},\, M_{\text{ctx}}^{(k)}\right) \approx \mathbb{E}[u_0 \mid u_{\text{obs}}, M]
$$

**为何有效。** 设 \\(u_\\phi(t, \\text{ctx}) = \\mathbb{E}[u_0 \\mid \\text{ctx}] + b(\\text{ctx}) + \\epsilon_{\\text{bias}}(\\text{ctx})\\)，\\(\\hat\\mu_K = \\frac{1}{K} \\sum_k u_\\phi(t, \\text{ctx}^{(k)})\\)：

$$
\mathbb{E}\big[\|\hat\mu_K - \mathbb{E}[u_0 \mid \text{obs}]\|^2\big] = \big\|\underbrace{\mathbb{E}[\mathbb{E}[u_0 \mid \text{ctx}]] - \mathbb{E}[u_0 \mid \text{obs}]}_{\text{信息缺口}} + \underbrace{\mathbb{E}[b(\text{ctx})]}_{\text{模型偏差}}\big\|^2 + \frac{1}{K}\big(\underbrace{\mathrm{Var}[\mathbb{E}[u_0 \mid \text{ctx}]]}_{\text{数据方差}} + \underbrace{\mathrm{Var}[b(\text{ctx})] + \mathrm{Var}[\epsilon_{\text{bias}}]}_{\text{模型方差}}\big)
$$

$$
\lim_{K \to \infty} \mathbb{E}\big[\|\hat\mu_K - \mathbb{E}[u_0 \mid \text{obs}]\|^2\big] = \big\|\mathbb{E}[\mathbb{E}[u_0 \mid \text{ctx}]] - \mathbb{E}[u_0 \mid \text{obs}] + \mathbb{E}[b(\text{ctx})]\big\|^2
$$

> 平均消去所有方差项；残余误差仅为信息缺口与系统偏差。

**多步采样。** 当后验非近确定性时，将每步去噪的去噪器替换为两个集成估计的加权组合：

$$
\hat u_\phi(t, u_t, u_{\text{obs}}, M) \approx \omega_t\, \mathbb{E}[u_0 \mid u_t] + (1 - \omega_t)\, \mathbb{E}[u_0 \mid u_{\text{obs}}, M]
$$

其中 \\(\\omega_t\\) 单调递增 \\(0 \\to 1\\)。两个条件期望用对称蒙特卡洛集成估计：

$$
\mathbb{E}[u_0 \mid u_t] \approx \frac{1}{K} \sum_{k=1}^{K} u_\phi\!\left(t,\, M_{\text{rnd}}^{(k)} \odot u_t,\, M_{\text{rnd}}^{(k)}\right), \qquad \mathbb{E}[u_0 \mid u_{\text{obs}}, M] \approx \frac{1}{K} \sum_{k=1}^{K} u_\phi\!\left(\delta,\, M_{\text{ctx}}^{(k)} \odot u_{\text{obs},\delta},\, M_{\text{ctx}}^{(k)}\right)
$$

其中 \\(M_{\text{rnd}}^{(k)}\\) 为服从与 \\(M_{\\text{ctx}}\\) 相同边缘分布的随机掩码（不必 \\(\\subseteq M\\)），\\(M_{\\text{ctx}}^{(k)} \\subseteq M\\)。采样遵循 RePaint 式方案：在未观测条目上用模型估计噪声，在已观测条目上由已知干净值直接计算，再经

$$
\epsilon_{\text{full}} = M \odot \epsilon_{\text{obs}} + (1 - M) \odot \epsilon_{\text{unobs}},
$$

合并后推进扩散 ODE——全程保持观测一致。

<figure class="research-figure">
  <a href="/images/research/context-query-dynamics/block-reconstruction-comparison.png" class="image-popup">
    <img src="/images/research/context-query-dynamics/block-reconstruction-comparison.png" alt="Navier-Stokes 块状重建：真值、本方法与 MissDiff 对比">
  </a>
  <figcaption class="research-figure__caption">
    图 3. 块状缺失下，分布感知的 context-query 训练比块内部监督不足的基线更好地保持演化物理场。
  </figcaption>
</figure>

</div>

<div class="research-work-section" markdown="1">

## 4. 一般构造 - 生成式掩码先验划分 {#general-construction}

一般构造面向更难的情形：掩码几何过于复杂，难以用少量手写规则指定。上一节得到的性质要求并没有改变：每个可恢复坐标仍需保持 query 正性。改变的是构造 split 的方式。

不再手工决定合法 context 划分的外观，而是先学习观测掩码分布，再从该先验中采样满足性质的划分。

### 从性质要求到掩码采样器

分布保持规则须针对每种观测模式手工设计（像素 dropout、块遮挡等），引入模式相关超参，且难以在复杂真实空间依赖下普遍保证正性。目标是构造一种对任意空间拓扑均有效的机制：学习掩码分布，采样候选 context 结构，并按构造保持同一个正性要求。

### 交集免费获得正性

用生成先验建模真实掩码分布 \\(p(M)\\)；抽取两个独立同分布掩码 \\(M_1, M_2 \\sim p(M)\\) 并令

$$
M_{\text{ctx}} = M_1 \odot M_2, \qquad M_{\text{qry}} = M_1 \odot (1 - M_{\text{ctx}})
$$

**定理（经交集的严格正性）：** 对任意合法 \\(M_{\\text{ctx}} = m\\) 与任意 \\(m_i = 0\\) 的 \\(i\\)，

$$
P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}} = m) > 0.
$$

这消除所有启发式设计——但现需对离散 \\(p(M)\\) 采样。

### 用 BFN 建模 p(M)

需要一种对高维离散掩码先验 \\(p(M)\\) 的模型，且采样时支持潜空间梯度干预。BFN 通过将二值类别提升到连续 logits、用离散数据匹配训练、并在高斯前向动力学下经 Tweedie 导出 score 采样，恰好提供该桥梁。

具体实现采用标准离散 BFN 配方（scaled-logit 提升、\\(\mathcal{L}_{\mathrm{DM}}\\) 与概率流采样）：

$$
\nabla_{x_t}\log p_t(x_t)\propto \alpha_t K \hat{e}_{\theta} - x_t.
$$

完整数学处理见专文：[平移不变连续扩散视角下的贝叶斯流网络](/zh/research/bayesian-flow-networks/)。

### 观测对齐条件化

纯从掩码先验采样可能生成结构合理但与当前观测对齐不佳的 context。引导项将生成掩码拉向实际可见区域，同时保留足够随机性以维持 query 覆盖为正。

无条件交集可能与真实 \\(M\\) 重叠过少 → context 过稀。通过分类器引导将生成锚定到实际观测：

**随机锚点。** \\(y_i = \\mathbf{1}[r_i < \\rho] \\cdot M_i\\)，\\(r_i \\sim \\mathrm{Uniform}(0,1)\\)——随机保留观测点比例 \\(\\rho\\) 注入多样性（完全锚定会坍缩为单一确定性掩码）。

**全局归一化引导损失。**

$$
\mathcal{L}_{\text{guidance}}(x_t, y) = -\frac{1}{d} \sum_{i=1}^d \big[ y_i \log \hat e_i + (1 - y_i) \log(1 - \hat e_i) \big]
$$

全局归一化在不同稀疏度下稳定梯度。

**潜空间干预。**

$$
x_{t_{i+1}} \leftarrow x_{t_{i+1}}^{\text{base}} - w_g \nabla_{x_{t_i}} \mathcal{L}_{\text{guidance}}(x_{t_i}, y)
$$

**定理（引导下正性保持）：** 在比例引导交集约束下，对任意已观测维度 \\(i\\)（\\(M_i = 1\\)），\\(P((M_{\\text{qry}})_i = 1 \\mid C_k) > 0\\)——条件化不破坏保证。

### 训练

与骨干相同的 context-query 目标，配合生成的划分：

$$
M_{\text{ctx}} = \hat M \odot M, \quad M_{\text{qry}} = M \odot (1 - M_{\text{ctx}}), \qquad \mathcal{L} = \mathbb{E}\big[\| M_{\text{qry}} \odot (u_\phi(M_{\text{ctx}} \odot u_{\text{obs}}, M_{\text{ctx}}) - u_{\text{obs}}) \|^2 \big]
$$

</div>

## 5. 总结

两项工作围绕同一信息：不完整观测能用于学习完整动力学，但前提是 context-query split 满足正确的掩码性质。第一项工作识别这一性质，并在已知观测模式下给出第一种构造。第二项工作把同一个性质转化为生成式构造问题，使复杂或未知掩码拓扑下也能得到有效 split。

<div class="research-comparison-table" markdown="1">

| 角色 | 回答的问题 | 机制 |
|:-----|:---------|:-----|
| 掩码性质要求 | 什么样的 context-query split 是有效的？ | 严格 query 正性与可识别去噪目标 |
| 第一种构造 | 掩码族已知时，如何构造有效 split？ | 分布保持划分与集成推理 |
| 一般构造 | 拓扑复杂或未知时，如何生成有效 split？ | 生成式掩码先验、交集划分与观测对齐引导 |

</div>

两种构造互补而非竞争。分布保持划分轻量，在 \\(p_{\\text{mask}}(M)\\) 结构已知或可解析时无需额外生成模型；生成式掩码先验划分则适用于掩码结构复杂或未知的情形，按构造对任意拓扑保证正性。

更广义地看，这条研究线可以概括为：先刻画有效 context-query 掩码必须保证什么，再构造能在越来越真实的观测过程中生成这类掩码的机制。
