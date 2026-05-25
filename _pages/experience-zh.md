---
layout: archive
title: "经历"
permalink: /zh/experience/
lang: zh-CN
lang_switch_url: /experience/
---

{% include base_path %}

### 上海人工智能实验室（Shanghai AI Lab） ｜ 2025.08 -- 2026.05
研究实习生，AI4Science 方向
- **单步逆合成生成（Single-Step Retrosynthesis Generation）：** 从零搭建用于产物到反应物生成的项目代码库，作为训练、评测与实验基础设施的主要开发者和维护者。
- **可配置实验框架：** 设计基于 Hydra 的实验框架，支持反应中心引导排序、原子排序策略、模型规模变体、采样步数扫描等多类逆合成对比实验的可复现运行。
- **研究代码库维护：** 在项目周期内持续维护并扩展核心实现，支持新消融实验的快速迭代，调试训练与评测流程，并保持代码库对后续实验的可扩展性。

### 上海人工智能实验室（Shanghai AI Lab） ｜ 2025.06 -- 2025.12
研究实习生，AI4Science 方向
- **蛋白质序列生成（MSA 条件离散建模）：** 在 CAMEO-61 上相较上一代生成模型显著提升折叠置信度指标：平均 pLDDT 由 56.46 提升至 78.24，pTM 由 0.55 提升至 0.75；并以共进化接触质量（CCMpred 长程 P@L5）作为额外的结构代理指标。
- **架构与框架对比：** 将 ESM-2 Transformer 重构为 Diffusion Transformer (DiT) 骨干网络；在共享 650M 架构上系统对比离散生成框架（Bayesian Flow Network vs. Discrete Flow Matching）及 MSA 条件化策略（加性 profile 嵌入 vs. Perceiver 交叉注意力；DFM 采用 profile 初始化的 x₀）。
- **大规模训练与推理优化：** 处理 3300 万条蛋白质 MSA 语料并规模化训练 650M 参数生成模型（Hydra/Lightning、多 GPU DDP、bf16），随后通过对比采样研究优化推理（BFN Langevin / ODE / SDE，步数与 start_t 扫参）；并探索基于 LLM 的 SFT 数据合成，用于面向特定蛋白质问答场景。
