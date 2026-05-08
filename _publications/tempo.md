---
date: 2025-10-24
title: "TEMPO: Temporal Multi-scale Autoregressive Generation of Protein Conformational Ensembles"
authors: "Yaoyao Xu, Di Wang, <strong>Zihan Zhou</strong>, Tianshu Yu<sup>#</sup>, Mingchen Chen<sup>#</sup>"
collection: publications
category: conferences
permalink: /publication/tempo

excerpt: 'This paper addresses the challenge of generating temporally coherent and physically realistic protein conformational ensembles by explicitly modeling the multi-scale nature of protein dynamics. While existing diffusion-based approaches generate conformational states independently and fail to capture causal dependencies in protein motion, the proposed TEMPO framework introduces a hierarchical autoregressive architecture that models dynamics as a Markovian stochastic process. The method decomposes motions into two temporal scales: a low-resolution model capturing slow collective transitions, and a high-resolution model generating detailed local fluctuations conditioned on these large-scale movements. Comprehensive evaluations on mdCATH and ATLAS datasets demonstrate superior performance in structural accuracy, temporal coherence, and computational efficiency, highlighting its potential for efficient and physically grounded protein dynamics simulation.'

excerpt_zh: '本文通过显式建模蛋白质动力学的多尺度本质，解决了生成时间连贯且物理上合理的蛋白质构象系综这一挑战。现有的扩散式方法独立地生成各构象状态，难以捕捉蛋白质运动中的因果依赖；为此，本文提出 TEMPO 框架，引入分层自回归结构，将动力学建模为马尔可夫随机过程。该方法将运动分解为两个时间尺度：低分辨率模型捕捉缓慢的集体跃迁；高分辨率模型在低分辨率运动的条件下生成精细的局部涨落。在 mdCATH 与 ATLAS 数据集上的全面评估显示，本方法在结构精度、时间连贯性与计算效率方面均显著优于已有方法，展现了其在高效且具有物理依据的蛋白质动力学模拟方面的潜力。'

venue: 'NeurIPS2025'
paperurl: 'https://arxiv.org/pdf/2511.05510'
githuburl: 'https://github.com/LOGO-CUHKSZ/TEMPO'
# slidesurl: ''
image: publications/tempo.png
---
