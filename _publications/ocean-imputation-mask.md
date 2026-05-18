---
date: 2026-05-19
title: "Observation-Aligned Mask Priors for Learning Physical Dynamics from Authentic Occlusions"
authors: "Chiyuan Ma, <strong>Zihan Zhou</strong><sup>+</sup>, Tianshu Yu<sup>#</sup>"
collection: publications
category: preprint
permalink: /publication/ocean-imputation-mask

excerpt: 'Learning physical dynamics from incomplete observations is difficult when authentic occlusions are structured, sample-dependent, and often missing not at random, while existing context-query methods typically rely on heuristic masking that mismatches real sensing topologies. We propose Observation-Aligned Mask Priors: a Bayesian Flow Network is pretrained on binary observation masks to capture authentic occlusion patterns, then mask sampling is guided by a globally normalized cross-entropy objective to build sample-specific context-query partitions. Intersection-based partitioning assigns every valid observed dimension a strictly positive query probability, eliminating zero-query dead zones and local generative collapse. On three real-world oceanographic datasets with genuine satellite occlusions, at resolutions up to 256×256, our method consistently improves over strong diffusion baselines in MSE and PSNR without requiring fully observed training fields.'

excerpt_zh: '当真实遮挡具有结构化、样本相关且常为 MNAR 的缺失模式时，从不完整观测中学习物理动力学极具挑战，而现有上下文-查询方法多依赖与真实传感拓扑不匹配的启发式掩码。本文提出观测对齐掩码先验（Observation-Aligned Mask Priors）：先在二值观测掩码上预训练贝叶斯流网络以刻画真实遮挡分布，再以全局归一化交叉熵引导采样，为每个稀疏样本构建样本特定的上下文-查询划分；基于交集的划分保证每个有效观测维度具有严格正的查询概率，从而避免零查询死区与局部生成坍缩。在三个含真实卫星遮挡的海洋学数据集上（最高 256×256），无需完全观测训练场，本方法在 MSE 与 PSNR 上稳定优于强扩散基线。'

venue: 'arxiv'
image: publications/ocean_imputation_mask.png
---
