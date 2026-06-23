---
title: "Learning Complete Dynamics from Incomplete Observations: A Context-Query Framework"
layout: research
collection: research
permalink: /research/context-query-dynamics/
order: 1
published: true
read_time: true
date: 2026-06-23
tags: [diffusion, imputation, context-query, AI4Science]
tldr: "We learn complete physical fields from partial observations that never include a fully observed sample. A unified context-query diffusion backbone trains a denoiser on a context subset and evaluates loss on a withheld query subset. Recovering the true distribution requires every unobserved-in-context dimension to receive queries with strictly positive probability. Two works answer this requirement differently: distribution-preserving heuristic partitioning with ensemble inference, and generative mask-prior partitioning via intersection with observation-aligned guidance."
excerpt: "A unified context-query diffusion framework for learning complete dynamics from incomplete observations, with two complementary routes to guarantee strictly positive query probabilities."
papers:
  - incomplet-data
  - ocean-imputation-mask
---

{% include toc %}

## Technical Roadmap

<div class="mermaid">
flowchart TB
  subgraph backbone [Unified Backbone]
    obs["Partial obs u_obs, mask M"]
    split["Split M into M_ctx and M_qry"]
    train["Train u_phi on context only; loss on M_qry"]
    obs --> split --> train
  end

  subgraph work1 [Work I: Distribution-Preserving]
    part1["Sample M_ctx with same structure as p_mask"]
    ens["Ensemble over context masks at inference"]
    part1 --> ens
  end

  subgraph work2 [Work II: Generative-Prior]
    bfn["Pretrain BFN on p(M)"]
    inter["M_ctx = M1 * M2; intersection positivity"]
    guide["Observation-aligned classifier guidance"]
    bfn --> inter --> guide
  end

  train --> work1
  train --> work2
  work1 --> out["Recover E[u0 | u_obs, M]"]
  work2 --> out
</div>

**Stage 1 (backbone).** Given partial observations \\(u_{obs} = M \\odot u_0\\) and a binary mask \\(M\\), split the observed support into a context mask \\(M_{ctx}\\) (model input) and a query mask \\(M_{qry}\\) (loss region). Train a diffusion denoiser \\(u_\\phi\\) to predict clean data from context only.

**Stage 2a (Work I).** Sample \\(M_{ctx}\\) with the same structural pattern as \\(p_{\\text{mask}}(M)\\) so that every observed dimension can be queried with positive probability. At inference, ensemble over context masks to bridge the train/test conditioning mismatch.

**Stage 2b (Work II).** Pretrain a Bayesian Flow Network on \\(p(M)\\), then form \\(M_{ctx} = M_1 \\odot M_2\\) from two i.i.d. mask draws. Intersection yields strict positivity for any spatial topology; observation-aligned guidance anchors generation to real occlusions.

## 1. Problem Setup

Complete data \\(u_0 \\in \\mathbb{R}^d \\sim p_{\\text{data}}\\), binary observation mask \\(M \\in \\{0,1\\}^d \\sim p_{\\text{mask}}(M)\\) with \\(p_{\\text{mask}}(M \\mid u_0) = p_{\\text{mask}}(M)\\). Only partial observations

$$
u_{obs} = M \odot u_0
$$

are available — **no complete sample ever appears in training**. Goal: learn \\(p_\\theta(u_0 \\mid u_{obs}, M)\\).

## 2. Unified Context-Query Backbone

### Hierarchical masking

Treat \\(u_{obs}\\) as "complete within its support", then split it into a context mask \\(M_{ctx} \\subseteq M\\) (model input) and a query mask \\(M_{qry} \\subseteq M\\) (loss region). With the noisy state

$$
u_{obs,t} = M \odot (\alpha_t u_{obs} + \sigma_t \epsilon),
$$

train \\(u_\\phi\\) to predict clean data from the context only:

$$
\mathcal{L}(t, u_{obs}, M_{ctx}, M_{qry}) = \big\| M_{qry} \odot \big( u_\phi(t,\, M_{ctx} \odot u_{obs,t},\, M_{ctx}) - u_{obs} \big) \big\|^2
$$

> The model sees only \\(M_{ctx}\\) and the masked input — it must infer the withheld region, not memorize it.

### Core result

Minimizing the loss gives, per dimension \\(i\\),

$$
\big(u_\phi(t, M_{ctx} \odot u_{obs,t}, M_{ctx})\big)_i = \begin{cases}
\mathbb{E}\!\left[(u_0)_i \mid M_{ctx} \odot u_{obs,t},\, M_{ctx}\right], & P((M_{qry})_i = 1 \mid M_{ctx}) > 0 \\[4pt]
\text{arbitrary}, & P((M_{qry})_i = 1 \mid M_{ctx}) = 0
\end{cases}
$$

and if the union of possible \\(M_{qry}\\) covers all dimensions,

$$
u_\phi = \mathbb{E}[u_0 \mid M_{ctx} \odot u_{obs,t}, M_{ctx}].
$$

> The expected squared gradient and the parameter-update frequency for dimension \\(i\\) both scale with \\(p_i := P((M_{qry})\_i = 1 \\mid M_{ctx})\\) — a zero-query dimension simply never gets a gradient.

### Design principle

The whole framework reduces to one requirement (plus a balance condition):

$$
P((M_{qry})_i = 1 \mid M_{ctx}) > 0 \quad \forall\, i:\ (M_{ctx})_i = 0, \qquad P((M_{qry})_i = 1 \mid M_{ctx}) \approx P((M_{qry})_j = 1 \mid M_{ctx})
$$

The two works below are two answers to "how do we guarantee this strict positivity?" — one heuristic, one generative.

## 3. Work I — Distribution-Preserving Partitioning

### Partitioning

Decompose the query probability by the law of total probability:

$$
P((M_{qry})_i = 1 \mid M_{ctx}) = \sum_{M} P((M_{qry})_i = 1 \mid M_{ctx}, M)\, P(M \mid M_{ctx})
$$

Since \\(M_{ctx} \\subseteq M\\), sampling \\(M_{ctx}\\) with the **same structural pattern as \\(p_{\\text{mask}}(M)\\)** (i.i.d. pixels → drop pixels independently; block-structured → drop whole blocks) makes multiple \\(M\\) compatible with a given \\(M_{ctx}\\), so both factors can be simultaneously positive → positivity holds for every observed dimension.

> Too few context points → large information gap, high variance, slow convergence; too many → \\(p_i\\) tiny, infrequent updates. A moderate ratio is optimal.

### Ensemble inference

Inference is a train/test mismatch: the model gives \\(\\mathbb{E}[u_0 \\mid M_{ctx} \\odot u_{obs,t}, M_{ctx}]\\) but we want \\(\\mathbb{E}[u_0 \\mid u_{obs,t}, M]\\). Bridge it by ensembling over context masks.

**Single-step sampling.** Apply minimal noise \\(u_\\delta = \\alpha_\\delta u_{obs} + \\sigma_\\delta \\epsilon\\), \\(0 < \\delta \\ll 1\\) (so \\(M \\odot u_\\delta \\approx u_{obs}\\)), then average \\(K\\) context masks:

$$
\hat u^* = \mathbb{E}[u_0 \mid u_{obs}, M] \approx \frac{1}{K} \sum_{k=1}^{K} u_\phi\!\left(\delta,\, M_{ctx}^{(k)} \odot u_{obs,\delta},\, M_{ctx}^{(k)}\right)
$$

**Why it works.** With \\(u_\\phi(t, \\text{ctx}) = \\mathbb{E}[u_0 \\mid \\text{ctx}] + b(\\text{ctx}) + \\epsilon_{\\text{bias}}(\\text{ctx})\\) and \\(\\hat\\mu_K = \\frac{1}{K} \\sum_k u_\\phi(t, \\text{ctx}^{(k)})\\):

$$
\mathbb{E}\big[\|\hat\mu_K - \mathbb{E}[u_0 \mid \text{obs}]\|^2\big] = \big\|\underbrace{\mathbb{E}[\mathbb{E}[u_0 \mid \text{ctx}]] - \mathbb{E}[u_0 \mid \text{obs}]}_{\text{information gap}} + \underbrace{\mathbb{E}[b(\text{ctx})]}_{\text{model bias}}\big\|^2 + \frac{1}{K}\big(\underbrace{\mathrm{Var}[\mathbb{E}[u_0 \mid \text{ctx}]]}_{\text{data variance}} + \underbrace{\mathrm{Var}[b(\text{ctx})] + \mathrm{Var}[\epsilon_{\text{bias}}]}_{\text{model variance}}\big)
$$

$$
\lim_{K \to \infty} \mathbb{E}\big[\|\hat\mu_K - \mathbb{E}[u_0 \mid \text{obs}]\|^2\big] = \big\|\mathbb{E}[\mathbb{E}[u_0 \mid \text{ctx}]] - \mathbb{E}[u_0 \mid \text{obs}] + \mathbb{E}[b(\text{ctx})]\big\|^2
$$

> Averaging kills all variance terms; residual error = information gap + systematic bias only.

**Multi-step sampling.** When the posterior is not near-deterministic, replace each denoising step's denoiser with a weighted combination of two ensemble estimates:

$$
\hat u_\phi(t, u_t, u_{obs}, M) \approx \omega_t\, \mathbb{E}[u_0 \mid u_t] + (1 - \omega_t)\, \mathbb{E}[u_0 \mid u_{obs}, M]
$$

with \\(\\omega_t\\) monotonically increasing \\(0 \\to 1\\). Each term is a Monte-Carlo average over masks (random masks for the first, context masks \\(\\subseteq M\\) for the second). Sampling follows a RePaint-style scheme: estimate noise from the model on unobserved entries, compute it directly from known clean values on observed entries, merge via

$$
\epsilon_{\text{full}} = M \odot \epsilon_{obs} + (1 - M) \odot \epsilon_{\text{unobs}},
$$

and step the diffusion ODE — keeping observations consistent throughout.

## 4. Work II — Generative-Prior Partitioning

### Motivation

The distribution-preserving rule must be hand-crafted per observation pattern (pixel dropout, block occlusion, …), introduces pattern-specific hyperparameters, and is mathematically hard to universally guarantee positivity over complex real spatial dependencies. Goal: a single mechanism valid for any spatial topology.

### Intersection gives positivity for free

Model the true mask distribution \\(p(M)\\) with a generative prior; draw two i.i.d. masks \\(M_1, M_2 \\sim p(M)\\) and set

$$
M_{ctx} = M_1 \odot M_2, \qquad M_{qry} = M_1 \odot (1 - M_{ctx})
$$

**Theorem (strict positivity via intersection):** for any valid \\(M_{ctx} = m\\) and any \\(i\\) with \\(m_i = 0\\),

$$
P((M_{qry})_i = 1 \mid M_{ctx} = m) > 0.
$$

This removes all heuristic design — but now requires sampling the complex discrete \\(p(M)\\).

### Modeling p(M) with a BFN

A Bayesian Flow Network handles discrete binary masks, recast into a continuous diffusion-style form so we can intervene by gradients in latent space:

- **Scaled-logit target:** encode class \\(c\\) as \\(u_0 = Ke_c\\), since \\(\\mathrm{softmax}(Ke_c) \\to e_c\\) for large \\(K\\) — discrete generation becomes continuous regression.
- **Forward process:** \\(x_t = \\alpha_t x_0 + \\sigma_t \\epsilon\\), \\(\\epsilon \\sim \\mathcal{N}(0, I)\\).
- **Shift invariance:** the score inherits invariance to adding a constant across logits, enforced architecturally by feeding \\(\\mathrm{softmax}(x_t)\\) as input.
- **Discrete data-matching objective:**

$$
\mathcal{L}_{\text{DM-discrete}} = \mathbb{E}_{t,c,\epsilon}\big[w(t)\, \|\hat e_\theta(t, \mathrm{softmax}(x_t)) - e_c\|^2\big]
$$

- **Sampling:** integrate the probability-flow ODE backward via Tweedie,

$$
\nabla_{x_t} \log p_t(x_t) = \frac{\alpha_t K \hat e_\theta(t, \mathrm{softmax}(x_t)) - x_t}{\sigma_t^2},
$$

decode \\(e_c = \\arg\\max \\frac{1}{K}(x_0 + 1)\\).

### Observation-aligned conditioning

Unconditional intersection can overlap the real \\(M\\) too little → context too sparse. Anchor the generation to the actual observations via classifier guidance:

1. **Stochastic anchor:** \\(y_i = \\mathbf{1}[r_i < \\rho] \\cdot M_i\\), \\(r_i \\sim \\mathrm{Uniform}(0,1)\\) — randomly retaining a fraction \\(\\rho\\) of observed points injects diversity (full anchoring collapses to one deterministic mask).
2. **Globally-normalized guidance loss:**

$$
\mathcal{L}_{\text{guidance}}(x_t, y) = -\frac{1}{d} \sum_{i=1}^d \big[ y_i \log \hat e_i + (1 - y_i) \log(1 - \hat e_i) \big]
$$

Global normalization stabilizes the gradient across very different sparsity levels.

3. **Latent intervention:**

$$
x_{t_{i+1}} \leftarrow x_{t_{i+1}}^{\text{base}} - w_g \nabla_{x_{t_i}} \mathcal{L}_{\text{guidance}}(x_{t_i}, y)
$$

**Theorem (positivity preserved under guidance):** under the ratio-guided intersection constraint, for any observed dimension \\(i\\) (\\(M_i = 1\\)), \\(P((M_{qry})_i = 1 \\mid C_k) > 0\\) — conditioning does not break the guarantee.

### Training

Same context-query objective as the backbone, with the generated partition:

$$
M_{ctx} = \hat M \odot M, \quad M_{qry} = M \odot (1 - M_{ctx}), \qquad \mathcal{L} = \mathbb{E}\big[\| M_{qry} \odot (u_\phi(M_{ctx} \odot u_{obs}, M_{ctx}) - u_{obs}) \|^2 \big]
$$

## 5. Summary

| Route | How positivity is guaranteed | Trade-off |
|:------|:-----------------------------|:----------|
| Work I (distribution-preserving) | Sample \\(M_{ctx}\\) with the same structure as \\(p_{\\text{mask}}\\); ensemble at inference | Pattern-specific heuristics; hard to cover complex spatial dependencies |
| Work II (generative-prior) | Intersection of two i.i.d. masks from \\(p(M)\\); observation-aligned guidance | Requires learning and sampling \\(p(M)\\), but holds for any topology |

Positivity now holds by construction for every valid topology, so the model transfers reconstruction from synthetic training masks to the genuinely-missing regions at test time — **without ever seeing a complete field**.
