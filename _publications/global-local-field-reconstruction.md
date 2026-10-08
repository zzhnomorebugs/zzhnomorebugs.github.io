---
date: 2026-10-04
title: "Learning Field Reconstruction from Incomplete Data by Globally Correcting Local Estimates"
authors: "Renhao Zhong, <strong>Zihan Zhou</strong><sup>+</sup>, Chiyuan Ma, Tianshu Yu"
collection: publications
category: preprint
permalink: /publication/global-local-field-reconstruction
excerpt: 'We learn local field estimates from incomplete patches, reconcile overlapping predictions into a consensus field, and refine it with a full-domain residual corrector conditioned on the original observations. This local-to-global approach preserves spatial detail while allowing broader evidence to revise local predictions. On three real-world ocean datasets, it reduces MSE by 28.9%–34.5% relative to the strongest external baseline.'
excerpt_zh: '本文从不完整的局部片段中学习场估计，将重叠预测整合为一致性先验，再利用原始观测，通过全域残差模型修正局部估计。该方法在保留局部空间细节的同时，允许全局证据修订局部预测。在三个真实海洋数据集上，相较最强外部基线，MSE 降低 28.9%–34.5%。'
tldr: 'Learn locally from incomplete patches, then globally correct the consensus field using the original observations.'
tldr_zh: '从不完整片段中学习局部结构，再结合原始观测对一致性场估计进行全局修正。'
venue: 'arxiv'
arxivurl: 'https://arxiv.org/abs/2610.05375'
paperurl: 'https://arxiv.org/pdf/2610.05375'
image: publications/global_local_field_reconstruction.png
---

{{ page.authors }}

{{ page.excerpt }}

<img src="{{ page.image | prepend: '/images/' | relative_url }}" alt="Architecture: local field prediction, consensus prior, and full-domain residual correction">
