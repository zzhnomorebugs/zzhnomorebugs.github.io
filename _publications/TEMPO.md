---
date: 2025-10-24
title: "TEMPO: Temporal Multi-scale Autoregressive Generation of Protein Conformational Ensembles"
authors: "Yaoyao Xu, Di Wang, <strong>Zihan Zhou</strong>, Tianshu Yu<sup>#</sup>, Mingchen Chen<sup>#</sup>"
collection: publications
category: conferences
permalink: /publication/TEMPO

excerpt: 'This paper addresses the challenge of generating temporally coherent and physically realistic protein conformational ensembles by explicitly modeling the multi-scale nature of protein dynamics. While existing diffusion-based approaches generate conformational states independently and fail to capture causal dependencies in protein motion, the proposed TEMPO framework introduces a hierarchical autoregressive architecture that models dynamics as a Markovian stochastic process. The method decomposes motions into two temporal scales: a low-resolution model capturing slow collective transitions, and a high-resolution model generating detailed local fluctuations conditioned on these large-scale movements. Comprehensive evaluations on mdCATH and ATLAS datasets demonstrate superior performance in structural accuracy, temporal coherence, and computational efficiency, highlighting its potential for efficient and physically grounded protein dynamics simulation.'

venue: 'NeurIPS2025'
paperurl: 'https://arxiv.org/pdf/2511.05510'
# slidesurl: ''
---
