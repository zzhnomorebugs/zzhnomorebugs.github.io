---
date: 2023-09-01
title: "Molecule Conformation Generation via Shifting Scores"
authors: "<strong>Zihan Zhou</strong>, Ruiying Liu, Chaolong Ying, Ruimao Zhang, Tianshu Yu<sup>#</sup>"
collection: publications
category: preprint
permalink: /publication/shifting-score

excerpt: 'This paper introduces SDDiff, a diffusion-based model for molecular conformation generation that operates on inter-atomic distances to ensure SE(3)-equivariance. Instead of assuming a Gaussian distribution for distance perturbations, SDDiff derives a shifting score function based on molecular thermodynamics, modeling how inter-atomic distance changes transition from a Gaussian to a Maxwell-Boltzmann distribution under increasing noise. This formulation provides a more physically grounded way to reverse the diffusion process, ensuring more feasible molecular geometries.'

excerpt_zh: '本文提出 SDDiff，一种作用于原子间距的扩散式分子构象生成模型，从而天然满足 SE(3) 等变性。与假设距离扰动服从高斯分布的常规做法不同，SDDiff 从分子热力学出发，推导出一种"移位"得分函数，刻画了原子间距变化在噪声增大过程中如何由高斯分布过渡到 Maxwell-Boltzmann 分布。这一表述为扩散过程的反向求解提供了更具物理依据的方式，从而生成更合理可行的分子几何结构。'

venue: 'arxiv'
paperurl: 'https://arxiv.org/pdf/2309.09985'
image: publications/shifting_score.png

---