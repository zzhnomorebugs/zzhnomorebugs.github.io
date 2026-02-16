---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

# Zihan Zhou

Email: zihanzhou1@link.cuhk.edu.cn | Tel: (+86) 13098696800

## Education Background

**The Chinese University of Hong Kong, Shenzhen** | 09/2023 -- Present  
MPhil-PhD in Data Science | Cum GPA: 3.811/4.0 | Supervisor: Prof. Tianshu Yu

**The Chinese University of Hong Kong, Shenzhen** | 09/2019 -- 06/2023  
B.S. in Mathematics and Applied Mathematics | Cum GPA: 3.513/4.0 | Honors, First Class

## Publications

### Conference Papers:
- *Incomplete Data, Complete Dynamics: A Diffusion Approach*. **Zihan Zhou**, Chenguang Wang, Hongyi Ye, Yongtao Guan, Tianshu Yu<sup>#</sup>. **ICLR2026**.
- *TEMPO: Temporal Multi-scale Autoregressive Generation of Protein Conformational Ensembles.* Yaoyao Xu, Di Wang, **Zihan Zhou**, Tianshu Yu<sup>#</sup>, Mingchen Chen<sup>#</sup>. **NeurIPS2025**.
- *Generating physical dynamics under priors.* **Zihan Zhou**, Xiaoxue Wang, Tianshu Yu<sup>#</sup>. **ICLR2025**.
- *Learning to decouple complex systems*. **Zihan Zhou**, Tianshu Yu<sup>#</sup>. **ICML2023**.

### Preprint:
- *Order Matters in Retrosynthesis: Structure-aware Generation via Reaction-Center-Guided Discrete Flow Matching*. Chenguang Wang<sup>*</sup>, **Zihan Zhou<sup>*</sup>**, Lei Bai, Tianshu Yu<sup>#</sup>. arXiv preprint arXiv: 2602.13136, 2026.
- *On diffusion process in SE(3)-invariant space*. **Zihan Zhou**, Ruiying Liu, Jiachen Zheng, Xiaoxue Wang, Tianshu Yu<sup>#</sup>. arXiv preprint arXiv: 2403.01430, 2024.
- *Molecular conformation generation via shifting scores*. **Zihan Zhou**, Ruiying Liu, Chaolong Ying, Ruimao Zhang, Tianshu Yu<sup>#</sup>. arXiv preprint arXiv: 2309.09985, 2023.

## Research Interest
- Design and analysis of continuous/discrete diffusion processes
- Solving PDE forward and inverse problems
- Integration of physical priors and design of invariant/equivariant diffusion models
- Generation of molecular conformations and modeling of protein dynamics

## Research Projects

### Chromatography for Parameter Estimation | 06/2024 -- Present
Apply deep learning methods to simulate the chromatography process, which is governed by PDEs and infer possible PDE parameters from observed wet lab results:
- In process

### Order Matters in Retrosynthesis: Structure-aware Generation via Reaction-Center-Guided Discrete Flow Matching | 07/2025 -- 01/2026
Propose a structure-aware template-free framework that encodes the two-stage nature of chemical reactions as a positional inductive bias through reaction-center-guided atom ordering, eliminating the need for explicit templates or completion rules:
- Introduce a reaction-center-rooted atom ordering strategy that places chemically critical atoms at the sequence head via graph traversal, transforming implicit chemical knowledge into explicit positional patterns that the model can directly capture through rotary position embeddings (RoPE).
- Develop RetroDiT, a graph transformer backbone equipped with discrete flow matching that decouples training from sampling, enabling efficient generation in 20-50 steps (versus 500 steps for prior diffusion methods) while achieving 6× faster training convergence.
- Validate the framework on USPTO-50k and USPTO-Full benchmarks, achieving state-of-the-art performance (61.2% and 51.3% top-1 accuracy with predicted centers; 71.1% and 63.4% with oracle centers) and demonstrating that structural priors outperform brute-force scaling—a 280K-parameter model with proper ordering matches a 65M-parameter model without it.

### TEMPO: Temporal Multi-scale Autoregressive Generation of Protein Conformational Ensembles | 03/2025 -- 08/2025
Propose a multi-scale autoregressive framework for generating temporally coherent protein conformational trajectories by explicitly modeling the hierarchical nature of protein dynamics:
- Develop a two-scale architecture that decomposes protein motion into slow collective transitions (nanosecond to microsecond timescales) and fast local fluctuations (picosecond to nanosecond timescales), with each scale parameterized by stochastic differential equations (SDEs) to capture both deterministic drift dynamics and stochastic thermal fluctuations.
- Model protein dynamics as a Markovian process using discrete-time SDE approximations, where a low-resolution model learns slow conformational transitions and a high-resolution model generates detailed atomic fluctuations conditioned on the slow-scale trajectory, preserving causal dependencies through autoregressive generation.
- Experimentally validate the framework on mdCATH and ATLAS datasets, demonstrating state-of-the-art performance in structural accuracy (RMSD, RMSF), temporal coherence (principal component alignment, state transition fidelity), and computational efficiency compared to diffusion-based ensemble generation methods.

### Incomplete Data, Complete Dynamics: A Diffusion Approach | 05/2025 -- 09/2025
Propose a principled diffusion-based framework for learning physical dynamics directly from incomplete observations without requiring complete ground truth data:
- Develop a conditional diffusion training paradigm that strategically partitions each incomplete sample into context and query components, with the partitioning strategy tailored to match the underlying observation pattern (e.g., pixel-wise vs. block-wise missing structures).
- Provide theoretical guarantees demonstrating that the model trained on incomplete data with appropriate context-query partitioning asymptotically recovers the true complete data distribution, and introduce an ensemble sampling procedure that bridges the gap between training on partial contexts and inference on full observations.
- Experimentally validate the framework across synthetic PDE systems (Shallow Water, Advection, Navier-Stokes) and real-world climate data (ERA5), achieving substantial improvements over existing baselines particularly in sparse observation regimes ranging from 1% to 20% coverage.

### Generating Physical Dynamics Under Priors | 06/2024 -- 01/2025
Propose a framework for generating physically feasible dynamics by integrating physical priors into diffusion-based generative models:
- Develop a method that injects two types of priors into the generative process: distributional priors (e.g., roto-translational and permutation invariance) and physical feasibility priors (e.g., conservation of energy, momentum, and PDE constraints).
- Incorporate distributional priors by designing equivariant score models and leveraging data or noise matching objectives, and enforce physical feasibility priors through constraint decomposition, allowing both linear and nonlinear constraints to be effectively embedded.
- Experimentally validate the proposed framework on diverse PDE-based datasets and particle dynamic systems, demonstrating enhanced physical accuracy and robustness compared to baseline diffusion models without priors.

### On Diffusion Process in SE(3)-Invariant Space | 06/2023 -- 07/2024
Mathematically characterize the diffusion process in SE(3)-invariant spaces for efficient 3D structure generation:
- Analyze the interaction between coordinates and the inter-point distance manifold using differential geometry, deriving linear mappings to approximate projections with bounded errors.
- Formulate projection-free reverse SDE and ODE frameworks by alternating between coordinates and distance matrices, enabling acceleration of diffusion-based sampling without compromising SE(3)-invariance.
- Validate the proposed methods on molecular conformation and human pose generation tasks, achieving superior or comparable performance with significantly fewer sampling steps compared to standard Langevin dynamics.

### Molecular Conformation Generation via Shifting Scores | 02/2023 -- 06/2023
Propose a novel molecular conformation generation method using diffusion models by modeling the shift in inter-atomic distance distributions under perturbation:
- Formulate a physical perspective where molecular disintegration under increasing perturbations transitions the inter-atomic distance distribution from Gaussian to Maxwell-Boltzmann, leading to a closed-form shifting score function for generation.
- Develop a new diffusion-based generative model, SDDiff, that models distance distributions instead of coordinates to maintain SE(3)-equivariance and leverages the shifting score to reverse the disintegration process effectively.
- Experimentally validate the method on GEOM-QM9 and GEOM-Drugs benchmarks, demonstrating state-of-the-art performance in molecular conformation generation compared to existing diffusion-based and non-diffusion baselines.

### Learning to Decouple Complex Systems | 10/2021 -- 02/2023
Propose a sequential learning paradigm by decoupling a complex system for handling irregularly sampled and clustered sequential observations:
- Establish a deeply coupled differential equation set based on a decoupling mechanism that raises not only each latent sub-system but also another system capturing the evolving interactions between the sub-systems.
- Model the system of interactions by a projected differential equation, followed by a generalization within the context of Bregman Divergence.
- Experimentally validate the new approach using synthetic and real-world datasets, demonstrating its advantage in handling complex and clustered sequential data compared to the state-of-the-art.

