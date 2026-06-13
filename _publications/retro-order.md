---
date: 2026-01-28
title: "Order Matters in Retrosynthesis: Structure-aware Generation via Reaction-Center-Guided Discrete Flow Matching"
authors: "Chenguang Wang*, <strong>Zihan Zhou*</strong>, Lei Bai, Tianshu Yu<sup>#</sup>"
collection: publications
category: conferences
permalink: /publication/retro-order

excerpt: 'This paper introduces a structure-aware framework for retrosynthesis that encodes chemical reactions'' two-stage nature as a positional inductive bias: placing reaction center atoms at the sequence head transforms implicit chemical knowledge into explicit patterns the model can learn. Combined with a graph diffusion transformer backbone and discrete flow matching, the approach achieves state-of-the-art performance on USPTO-50k (61.2%) and USPTO-Full (51.3%) with 6× faster training and 25× fewer sampling steps than prior diffusion methods. Notably, a 280K-parameter model with proper ordering matches a 65M-parameter model without it, demonstrating that well-designed inductive biases outperform brute-force scaling for efficient molecular design.'

excerpt_zh: '本文提出一种结构感知的逆合成框架，将化学反应的两阶段本质编码为位置先验：把反应中心原子放置到序列头部，从而将隐式化学知识转化为模型可学习的显式模式。结合图扩散 Transformer 主干与离散流匹配，本方法在 USPTO-50k 上取得 61.2%、在 USPTO-Full 上取得 51.3% 的当前最优性能，相较之前的扩散方法训练速度提升 6 倍、采样步数减少 25 倍。值得注意的是，280K 参数的小模型在使用合适顺序后即可达到不使用顺序的 65M 参数模型的水平，表明在分子设计中精心设计的归纳偏置远胜于"堆参数"式的暴力扩展。'

tldr: 'Atom ordering matters in retrosynthesis: placing reaction center atoms at the sequence head encodes the two-stage nature of chemical reactions as a positional inductive bias, achieving SOTA on USPTO-50k (61.2%) and USPTO-Full (51.3%) with 6× faster training via discrete flow matching.'

tldr_zh: '逆合成中原子顺序至关重要：将反应中心原子置于序列头部，把化学反应的两阶段本质编码为位置先验，结合离散流匹配在 USPTO-50k（61.2%）与 USPTO-Full（51.3%）上取得当前最优，训练速度提升 6 倍。'

venue: 'ICML2026'
paperurl: 'https://arxiv.org/pdf/2602.13136v1'
posterurl: 'https://icml.cc/media/PosterPDFs/ICML%202026/60684.png'
poster_image: publications/posters/retro_order_poster.png
image: publications/retro_order.png
---