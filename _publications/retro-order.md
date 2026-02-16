---
date: 2024-03-01
title: "Order Matters in Retrosynthesis: Structure-aware Generation via Reaction-Center-Guided Discrete Flow Matching"
authors: "Chenguang Wang*, <strong>Zihan Zhou*</strong>, Lei Bai, Tianshu Yu<sup>#</sup>"
collection: publications
category: preprint
permalink: /publication/retro-order

excerpt: "This paper introduces a structure-aware framework for retrosynthesis that encodes chemical reactions' two-stage nature as a positional inductive bias: placing reaction center atoms at the sequence head transforms implicit chemical knowledge into explicit patterns the model can learn. Combined with a graph diffusion transformer backbone and discrete flow matching, the approach achieves state-of-the-art performance on USPTO-50k (61.2%) and USPTO-Full (51.3%) with 6× faster training and 25× fewer sampling steps than prior diffusion methods. Notably, a 280K-parameter model with proper ordering matches a 65M-parameter model without it, demonstrating that well-designed inductive biases outperform brute-force scaling for efficient molecular design."

venue: 'arxiv'
paperurl: 'https://arxiv.org/pdf/2602.13136v1'
image: publications/retro_order.png
---