---
date: 2026-05-19
title: "Physics-Mediated Diffusion: Leveraging Intermediate Field Representations for Sparse PDE Inversion"
authors: "<strong>Zihan Zhou*</strong>, Chiyuan Ma*, Tianshu Yu<sup>#</sup>"
collection: publications
category: preprint
permalink: /publication/physics-mediated-diffusion

excerpt: 'Inferring physical parameters from sparse observations is a severely ill-posed inverse problem: multiple parameter configurations can fit the same sparse data (equifinality), and optimization-based methods often stall in complex loss landscapes. We propose Physics-Mediated Diffusion, which treats the complete spatiotemporal field as a learned intermediate representation. A conditional diffusion model imposes a strong structural prior on plausible fields, and parameters are extracted via a differentiable operator derived from the governing PDE algebra (e.g., diffusivity as the ratio of temporal to spatial derivatives), ensuring end-to-end consistency without a full forward solver. We prove that recovery error is governed by the spectral properties of the extraction operator, and experiments show substantial gains over baselines in parameter recovery, especially for well-conditioned systems under extreme sparsity.'

excerpt_zh: '从稀疏观测反演物理参数是严重不适定的逆问题：多种参数配置可在观测点处同样拟合数据（等终性），传统优化方法也常在复杂损失景观中难以收敛。本文提出物理中介扩散（Physics-Mediated Diffusion），将完整时空场作为可学习的中间表示：条件扩散模型对合理解施加强结构先验，再通过由控制方程代数形式导出的可微算子（如以时间导数与空间导数之比估计扩散系数）提取参数，在无需完整前向求解器的情况下保证场与物理的一致性。理论分析表明恢复误差由提取算子的谱性质决定；实验显示，尤其在极端稀疏与良条件系统下，本方法在参数恢复上显著优于各类基线。'

venue: 'arxiv'
image: publications/physics_mediated.png
---
