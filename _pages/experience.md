---
layout: archive
title: "Experience"
permalink: /experience/
lang_switch_url: /zh/experience/
---

{% include base_path %}

### Shanghai Artificial Intelligence Laboratory (Shanghai AI Lab) | 08/2025 -- 05/2026
Research Intern, AI4Science
- **Single-Step Retrosynthesis Generation:** Built the project codebase from scratch for product-to-reactant generation, serving as the primary developer and maintainer of the training, evaluation, and experiment infrastructure.
- **Configurable Experiment Framework:** Designed a Hydra-based framework to support reproducible comparisons across retrosynthesis settings, including reaction-center-guided ordering, atom-ordering strategies, model-scale variants, and sampling-step sweeps.
- **Research Codebase Maintenance:** Maintained and extended the core implementation throughout the project, enabling rapid iteration on new ablations, debugging training and evaluation workflows, and keeping the codebase adaptable for follow-up experiments.

### Shanghai Artificial Intelligence Laboratory (Shanghai AI Lab) | 06/2025 -- 12/2025
Research Intern, AI4Science
- **Protein Sequence Generation (MSA-conditioned discrete modeling):** Boosted fold-confidence metrics on CAMEO-61 over the previous generation model, improving mean pLDDT from 56.46 to 78.24 and pTM from 0.55 to 0.75, with co-evolution contact quality (CCMpred long-range P@L5) as an additional structural proxy.
- **Architecture & Framework Comparison:** Redesigned the ESM-2 Transformer into a Diffusion Transformer (DiT) backbone and, on a shared 650M architecture, systematically compared discrete generative frameworks (Bayesian Flow Network vs. Discrete Flow Matching) and MSA conditioning strategies (additive profile embedding vs. Perceiver cross-attention; DFM with profile-initialized x₀).
- **Large-Scale Training & Inference:** Processed a 33M-sequence protein MSA corpus and trained a 650M-parameter generative model at scale (Hydra/Lightning, multi-GPU DDP, bf16), then optimized inference via comparative sampling studies (BFN Langevin / ODE / SDE, step count and start_t sweeps). Also explored LLM-based SFT data synthesis for targeted protein Q&A.
