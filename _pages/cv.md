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
- *Generating physical dynamics under priors.* **Zihan Zhou**, Xiaoxue Wang, Tianshu Yu. **ICLR2025.**
- *Learning to decouple complex systems*. **Zihan Zhou**, Tianshu Yu. **ICML2023**.

### Preprint:
- *On diffusion process in SE(3)-invariant space*. **Zihan Zhou**, Ruiying Liu, Jiachen Zheng, Xiaoxue Wang, Tianshu Yu. arXiv preprint arXiv: 2403.01430, 2024
- *Molecular conformation generation via shifting scores*. **Zihan Zhou**, Ruiying Liu, Chaolong Ying, Ruimao Zhang, Tianshu Yu. arXiv preprint arXiv:2309.09985, 2023.

## Research Interest
- Design and analysis of diffusion processes
- Solving PDE forward and inverse problems
- Integration of physical priors and design of invariant/equivariant diffusion models
- Generation of molecular conformations and modeling of protein dynamics

## Research Projects

### Chromatography for Parameter Estimation | 06/2024 -- Present
Apply deep learning methods to simulate the chromatography process, which is governed by PDEs and infer possible PDE parameters from observed wet lab results:
- In process

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