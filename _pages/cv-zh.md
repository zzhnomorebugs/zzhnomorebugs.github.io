---
layout: cv
title: "简历"
permalink: /zh/cv/
lang: zh-CN
lang_switch_url: /cv/
---

{% include base_path %}

<header class="cv-hero">
<div class="cv-identity">
<img class="cv-avatar" src="{{ base_path }}/images/Zhou_Zihan_20260306_thumb.webp" alt="周子涵" width="88" height="88">
<div><p class="cv-eyebrow">学术与研究履历 / CV</p>
<h1>周子涵 <span>Zihan Zhou</span></h1></div>
</div>
<a class="cv-download" href="{{ base_path }}/files/Zihan-Zhou-AI4Science-ZH.pdf"><span aria-hidden="true">↓</span> 下载简历 <span class="cv-filetype">PDF</span></a>
<div class="cv-tags"><span>AI+化学</span><span>分子生成</span><span>AI4Science 算法研发</span></div>
<div class="cv-summary" markdown="1">
数据科学博士研究生，专注生成模型及其在科学问题中的应用，研究涵盖单步逆合成、蛋白质序列生成与物理先验建模。在 TPAMI、ICML、NeurIPS、ICLR 等发表论文。
</div>
<div class="cv-contact" markdown="1">
13098696800 · [zihanzhou1@link.cuhk.edu.cn](mailto:zihanzhou1@link.cuhk.edu.cn) · [zzhnomorebugs.github.io](https://zzhnomorebugs.github.io/)
</div>
</header>

<div class="cv-body">

<nav class="cv-nav" aria-label="简历章节"><p>目录</p>

<a href="#education"><span>01</span>教育背景</a>

<a href="#internships"><span>02</span>研究实习</a>

<a href="#projects"><span>03</span>代表性研究项目</a>

<a href="#publications"><span>04</span>已发表论文</a>

<a href="#preprints"><span>05</span>预印本</a>

<a href="#skills"><span>06</span>技术能力</a>

</nav>

<div class="cv-content">

<section id="education" class="cv-section cv-section--education">
<h2><span>01</span>教育背景</h2>

<article class="cv-entry">
<div class="cv-entry-head"><h3>香港中文大学（深圳）</h3><span class="cv-date">2023.09 - 2027.06（预计）</span></div>
<p class="cv-role">数据科学 · 博士在读</p>

<div class="cv-entry-text" markdown="1">
导师：[于天舒](https://mypage.cuhk.edu.cn/academics/yutianshu/)教授（Tianshu Yu）
</div>
</article>

<article class="cv-entry">
<div class="cv-entry-head"><h3>香港中文大学（深圳）</h3><span class="cv-date">2019.09 - 2023.06</span></div>
<p class="cv-role">数学与应用数学 · 理学学士</p>

<div class="cv-entry-text" markdown="1">
GPA：3.513 / 4.0 · 一等荣誉学位（First Class Honors）
</div>
</article>

</section>

<section id="internships" class="cv-section cv-section--internships">
<h2><span>02</span>研究实习</h2>

<article class="cv-entry">
<div class="cv-entry-head"><h3>字节跳动</h3><span class="cv-date">2026.08 - 至今</span></div>
<p class="cv-role">AI for Science实习生-Seed</p>

<div class="cv-entry-text" markdown="1">
从事 AI4Science 方向研究。
</div>
</article>

<article class="cv-entry">
<div class="cv-entry-head"><h3>腾讯生命科学实验室</h3><span class="cv-date">2026.06 - 2026.08</span></div>
<p class="cv-role">应用研究实习生</p>

<div class="cv-entry-text" markdown="1">
**生成建模：** 承担蛋白质序列可控生成与编辑的算法实现，参与条件建模、训练及采样流程的搭建与迭代。

**评测分析：** 从目标条件满足程度、序列编辑幅度和预测结构质量等维度评估候选序列与生成方案。
</div>
</article>

<article class="cv-entry">
<div class="cv-entry-head"><h3>上海人工智能实验室</h3><span class="cv-date">2025.08 - 2026.05</span></div>
<p class="cv-role">AI4Science 研究实习生（逆合成）</p>

<div class="cv-entry-text" markdown="1">
**单步逆合成：** 负责训练、评测与实验代码库的主要开发和维护工作，搭建可复现的对照与消融实验流程。
</div>
</article>

<article class="cv-entry">
<div class="cv-entry-head"><h3>上海人工智能实验室</h3><span class="cv-date">2025.06 - 2025.12</span></div>
<p class="cv-role">AI4Science 研究实习生（蛋白质）</p>

<div class="cv-entry-text" markdown="1">
**蛋白质生成：** 参与 MSA 条件生成模型的架构设计与大规模训练，对比条件建模与采样方案，评估预测结构质量。
</div>
</article>

</section>

<section id="projects" class="cv-section cv-section--projects">
<h2><span>03</span>代表性研究项目</h2>

<article class="cv-entry cv-project">
<div class="cv-entry-head"><h3>反应中心引导的分子逆合成</h3><span class="cv-badge">ICML 2026</span></div>

<div class="cv-entry-text" markdown="1">
上海人工智能实验室 · 2025.08–2026.05

- **问题与方法：**针对由产物预测反应物的单步逆合成任务，将反应中心原子前置，引入结构归纳偏置，并结合图扩散 Transformer 与离散流匹配进行生成建模。

- **个人贡献：**从零搭建训练与评测代码库，并承担主要开发和维护工作；基于 Hydra 设计实验框架，对原子排序、模型规模和采样步数开展可复现的消融实验。

- **项目结果：**在 USPTO-50k / USPTO-Full 上分别取得 **61.2% / 51.3%** 的 Top-1 准确率；相较论文对比的既有扩散方法，训练速度达到 **6 倍**，采样步数降至 **1/25**；采用适当原子排序后，**280K** 参数模型达到未引入该偏置的 **65M** 参数基线水平。
</div>
</article>

<article class="cv-entry cv-project">
<div class="cv-entry-head"><h3>蛋白质序列生成｜MSA 建模与性质可控编辑</h3><span class="cv-badge">上海人工智能实验室 · 腾讯生命科学实验室</span></div>

<div class="cv-entry-text" markdown="1">
MSA 建模：上海人工智能实验室，2025.06–2025.12；可控编辑：腾讯，2026.06–2026.08

- **MSA 条件建模：**将 ESM-2 Transformer 重构为 DiT，基于同一 **650M 参数**架构对比 BFN 与 DFM；评估加性 profile 嵌入、Perceiver 交叉注意力及 DFM 的 profile 初始化策略。

- **训练与采样：**处理千万级蛋白质 MSA 语料，使用 Hydra / Lightning、多 GPU DDP 与 bf16 开展训练；对比 BFN 的 Langevin、ODE、SDE 采样方法，分析采样步数与起始时间的影响。

- **评测结果：**在 CAMEO-61 上，平均 pLDDT 由 **56.46** 提升至 **78.24**，平均 pTM 由 **0.55** 提升至 **0.75**（对比上一代模型）；结合 CCMpred 长程 P@L5 评估共进化接触质量。上述结果均为**结构预测代理指标**。

- **性质可控编辑（腾讯）：**参与条件建模及训练、采样与评测流程的搭建，从目标条件满足程度、序列编辑幅度和预测结构质量三个维度比较编辑方案。
</div>
</article>

<article class="cv-entry cv-project">
<div class="cv-entry-head"><h3>分子三维构象生成｜几何扩散与高效采样</h3><span class="cv-badge">TPAMI</span></div>

<div class="cv-entry-text" markdown="1">
- **距离分布建模（SDDiff）：**针对给定分子图的三维构象生成，刻画原子间距扰动分布从 Gaussian 向 Maxwell–Boltzmann 的过渡，提出 shifting score 扩散模型，兼顾旋转／平移对称性与几何可行性。

- **几何采样方法（TPAMI）：**利用微分几何分析坐标与原子间距流形的关系，构建无需投影的反向 SDE / ODE；比较不同采样步数下的构象覆盖度与结构匹配精度。

- **构象生成评测：**在 GEOM-QM9 / GEOM-Drugs 上评估构象覆盖度（COV）与匹配误差（MAT）。SDDiff 预印本报告的 GEOM-Drugs 平均 **COV 为 90.68%、MAT 为 0.8564 Å**，其中 COV 阈值为 1.25 Å。
</div>
</article>

<article class="cv-entry cv-project">
<div class="cv-entry-head"><h3>物理先验约束下的动力学生成</h3><span class="cv-badge">ICLR 2025</span></div>

<div class="cv-entry-text" markdown="1">
- **核心方法：**将旋转／平移不变性等分布先验，以及守恒律、PDE 等物理约束融入扩散生成过程，缓解仅拟合数据分布时生成轨迹与物理规律不一致的问题。

- **实现与验证：**通过约束分解处理线性与非线性约束，并在多种物理系统与 PDE 数据上验证生成轨迹和流场的物理可行性。
</div>
</article>

</section>

<section id="publications" class="cv-section cv-section--publications">
<h2><span>04</span>已发表论文</h2>

<div class="cv-legend" markdown="1">
\* 共同第一作者；+ 项目指导；# 通讯作者。本人姓名加粗。
</div>

<div class="cv-paper" markdown="1">
[On Diffusion Process in SE(3)-invariant Space.](https://arxiv.org/abs/2403.01430)<br>
**Zihan Zhou**, Ruiying Liu, Jiachen Zheng, Xiaoxue Wang, Tianshu Yu<sup>#</sup>. IEEE TPAMI.
</div>

<div class="cv-paper" markdown="1">
[Order Matters in Retrosynthesis: Structure-aware Generation via Reaction-Center-Guided Discrete Flow Matching.](https://arxiv.org/abs/2602.13136)<br>
Chenguang Wang<sup>*</sup>, **Zihan Zhou**<sup>*</sup>, Lei Bai, Tianshu Yu<sup>#</sup>. ICML 2026.
</div>

<div class="cv-paper" markdown="1">
[Incomplete Data, Complete Dynamics: A Diffusion Approach.](https://arxiv.org/abs/2509.20098)<br>
**Zihan Zhou**, Chenguang Wang, Hongyi Ye, Yongtao Guan, Tianshu Yu<sup>#</sup>. ICLR 2026.
</div>

<div class="cv-paper" markdown="1">
[TEMPO: Temporal Multi-scale Autoregressive Generation of Protein Conformational Ensembles.](https://arxiv.org/abs/2511.05510)<br>
Yaoyao Xu, Di Wang, **Zihan Zhou**, Tianshu Yu<sup>#</sup>, Mingchen Chen<sup>#</sup>. NeurIPS 2025.
</div>

<div class="cv-paper" markdown="1">
[Generating Physical Dynamics under Priors.](https://arxiv.org/abs/2409.00730)<br>
**Zihan Zhou**, Xiaoxue Wang, Tianshu Yu<sup>#</sup>. ICLR 2025.
</div>

<div class="cv-paper" markdown="1">
[Learning to Decouple Complex Systems.](https://proceedings.mlr.press/v202/zhou23q.html)<br>
**Zihan Zhou**, Tianshu Yu<sup>#</sup>. ICML 2023.
</div>

</section>

<section id="preprints" class="cv-section cv-section--preprints">
<h2><span>05</span>预印本</h2>

<div class="cv-paper" markdown="1">
[Learning Field Reconstruction from Incomplete Data by Globally Correcting Local Estimates.](https://arxiv.org/abs/2610.05375)<br>
Renhao Zhong, **Zihan Zhou**<sup>+</sup>, Chiyuan Ma, Tianshu Yu. arXiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[Differentiable mass transfer modeling enables wet lab validated inverse analysis of liquid chromatography.](https://doi.org/10.26434/chemrxiv.15009352/v1)<br>
Baochen Li<sup>*</sup>, **Zihan Zhou**<sup>*</sup>, Yanqing Yu, Sen Lin, Peng Wang, Tianshu Yu<sup>#</sup>, Xiaoxue Wang<sup>#</sup>. ChemRxiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[AMix-2: Establishing Protein as a Native Modality in Large Language Models.](https://arxiv.org/abs/2605.30963)<br>
Keyue Qiu<sup>*</sup>, Yixin Wu<sup>*</sup>, **Zihan Zhou**, Changze Lv, Lihao Wang, et al., Hao Zhou<sup>#</sup>. arXiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[Observation-Aligned Mask Priors for Learning Physical Dynamics from Authentic Occlusions.](https://arxiv.org/abs/2605.16818)<br>
Chiyuan Ma, **Zihan Zhou**<sup>+</sup>, Tianshu Yu<sup>#</sup>. arXiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
Physics-Mediated Diffusion: Leveraging Intermediate Field Representations for Sparse PDE Inversion.<br>
**Zihan Zhou**<sup>*</sup>, Chiyuan Ma<sup>*</sup>, Tianshu Yu<sup>#</sup>. Preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[Molecular Conformation Generation via Shifting Scores.](https://arxiv.org/abs/2309.09985)<br>
**Zihan Zhou**, Ruiying Liu, Chaolong Ying, Ruimao Zhang, Tianshu Yu<sup>#</sup>. arXiv preprint, 2023.
</div>

</section>

<section id="skills" class="cv-section cv-section--skills">
<h2><span>06</span>技术能力</h2>

<div class="cv-skills" markdown="1">
- **生成建模：**扩散模型、BFN、离散流匹配、DiT、条件生成、MSA 条件建模与采样策略。

- **训练与实验：**Lightning、Hydra、多 GPU DDP、bf16；模型规模对比、消融实验与可复现评测。

- **科学计算：**物理先验与守恒约束、PDE 正反问题、SE(3) 不变性、分子构象与蛋白质生成。
</div>

</section>

</div>

</div>
