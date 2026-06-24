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
tldr: "We learn complete physical fields from partial observations that never include a fully observed sample. A unified context-query diffusion backbone trains a denoiser on a context subset and evaluates loss on a withheld query subset. Recovering the true distribution requires every unobserved-in-context dimension to receive queries with strictly positive probability. Two complementary works answer this requirement differently: distribution-preserving heuristic partitioning with ensemble inference when \\(p_{\\text{mask}}(M)\\) is known or analytic, and generative mask-prior partitioning via intersection with observation-aligned guidance when mask structure is complex or unknown."
excerpt: "A unified context-query diffusion framework for learning complete dynamics from incomplete observations, with two complementary routes to guarantee strictly positive query probabilities."
papers:
  - incomplet-data
  - ocean-imputation-mask
---

{% include toc %}

## Technical Roadmap

<div class="mermaid">
flowchart TB
  subgraph backbone ["Unified Backbone"]
    obs["Partial obs and mask M"]
    split["Split M into context and query"]
    train["Train on context, loss on query"]
    obs --> split --> train
  end

  subgraph work1 ["Work I: Distribution-Preserving"]
    part1["Sample context mask from p_mask"]
    ens["Ensemble context masks at inference"]
    part1 --> ens
  end

  subgraph work2 ["Work II: Generative-Prior"]
    bfn["Pretrain BFN on mask prior"]
    inter["Context = intersection of two masks"]
    guide["Observation-aligned guidance"]
    bfn --> inter --> guide
  end

  train --> work1
  train --> work2
  work1 --> out["Recover conditional expectation"]
  work2 --> out
</div>

- **Stage 1 (backbone).** Given partial observations \\(u_{\\text{obs}} = M \\odot u_0\\) and a binary mask \\(M\\), split the observed support into a context mask \\(M_{\\text{ctx}}\\) (model input) and a query mask \\(M_{\\text{qry}}\\) (loss region). Train a diffusion denoiser \\(u_\\phi\\) to predict clean data from context only.
- **Stage 2a (Work I).** Sample \\(M_{\\text{ctx}}\\) with the same structural pattern as \\(p_{\\text{mask}}(M)\\) so that every observed dimension can be queried with positive probability. At inference, ensemble over context masks to bridge the train/test conditioning mismatch.
- **Stage 2b (Work II).** Pretrain a Bayesian Flow Network on \\(p(M)\\), then form \\(M_{\\text{ctx}} = M_1 \\odot M_2\\) from two i.i.d. mask draws. Intersection yields strict positivity for any spatial topology; observation-aligned guidance anchors generation to real occlusions.

## 1. Problem Setup

Complete data \\(u_0 \\in \\mathbb{R}^d \\sim p_{\\text{data}}\\), binary observation mask \\(M \\in \\{0,1\\}^d \\sim p_{\\text{mask}}(M)\\) with \\(p_{\\text{mask}}(M \\mid u_0) = p_{\\text{mask}}(M)\\). We only observe

$$
u_{\text{obs}} = M \odot u_0
$$

with **no complete sample ever in training**. Goal: learn \\(p_\\phi(u_0 \\mid u_{\\text{obs}}, M)\\).

## 2. Unified Context-Query Backbone

### Hierarchical masking

Treat \\(u_{\\text{obs}}\\) as "complete within its support", then split it into a context mask \\(M_{\\text{ctx}} \\subseteq M\\) (model input) and a query mask \\(M_{\\text{qry}} \\subseteq M\\) (loss region). The noisy state is

$$
u_{\text{obs},t} = M \odot (\alpha_t u_{\text{obs}} + \sigma_t \epsilon),
$$

and we train \\(u_\\phi\\) to predict clean data from the context only:

$$
\mathcal{L}(t, u_{\text{obs}}, M_{\text{ctx}}, M_{\text{qry}}) = \big\| M_{\text{qry}} \odot \big( u_\phi(t,\, M_{\text{ctx}} \odot u_{\text{obs},t},\, M_{\text{ctx}}) - u_{\text{obs}} \big) \big\|^2
$$

> The model sees only \\(M_{\\text{ctx}}\\) and the masked input — it must infer the withheld region, not memorize it.

### Core result

Minimizing the loss gives, per dimension \\(i\\),

$$
\big(u_\phi(t, M_{\text{ctx}} \odot u_{\text{obs},t}, M_{\text{ctx}})\big)_i = \begin{cases}
\mathbb{E}\!\left[(u_0)_i \mid M_{\text{ctx}} \odot u_{\text{obs},t},\, M_{\text{ctx}}\right], & P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) > 0 \\[4pt]
\text{arbitrary}, & P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) = 0
\end{cases}
$$

If the union of possible \\(M_{\\text{qry}}\\) covers all dimensions,

$$
u_\phi = \mathbb{E}[u_0 \mid M_{\text{ctx}} \odot u_{\text{obs},t}, M_{\text{ctx}}].
$$

> The expected squared gradient and the parameter-update frequency for dimension \\(i\\) both scale with \\(p_i := P((M_{\\text{qry}})\_i = 1 \\mid M_{\\text{ctx}})\\) — a zero-query dimension simply never gets a gradient.

### Design principle

The whole framework reduces to one requirement (plus a balance condition):

$$
P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) > 0 \quad \forall\, i:\ (M_{\text{ctx}})_i = 0, \qquad P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) \approx P((M_{\text{qry}})_j = 1 \mid M_{\text{ctx}})
$$

The two works below are two answers to "how do we guarantee this strict positivity?" — one heuristic, one generative.

## 3. Work I — Distribution-Preserving Partitioning

### Partitioning

Decompose the query probability by the law of total probability:

$$
P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) = \sum_{M} P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}, M)\, P(M \mid M_{\text{ctx}})
$$

Since \\(M_{\\text{ctx}} \\subseteq M\\), sampling \\(M_{\\text{ctx}}\\) with the **same structural pattern as \\(p_{\\text{mask}}(M)\\)** (i.i.d. pixels → drop pixels independently; block-structured → drop whole blocks) makes multiple \\(M\\) compatible with a given \\(M_{\\text{ctx}}\\), so both factors can be simultaneously positive → positivity holds for every observed dimension.

> Too few context points → large information gap, high variance, slow convergence; too many → \\(p_i\\) tiny, infrequent updates. A moderate ratio is optimal.

### Ensemble inference

Inference is a train/test mismatch: the model gives \\(\\mathbb{E}[u_0 \\mid M_{\\text{ctx}} \\odot u_{\\text{obs},t}, M_{\\text{ctx}}]\\) but we want \\(\\mathbb{E}[u_0 \\mid u_{\\text{obs},t}, M]\\). Bridge it by ensembling over context masks.

**Single-step sampling.** Apply minimal noise \\(u_\\delta = \\alpha_\\delta u_{\\text{obs}} + \\sigma_\\delta \\epsilon\\), \\(0 < \\delta \\ll 1\\) (so \\(M \\odot u_\\delta \\approx u_{\\text{obs}}\\)), then average \\(K\\) context masks:

$$
\hat\mu_K = \frac{1}{K} \sum_{k=1}^{K} u_\phi\!\left(\delta,\, M_{\text{ctx}}^{(k)} \odot u_{\text{obs},\delta},\, M_{\text{ctx}}^{(k)}\right) \approx \mathbb{E}[u_0 \mid u_{\text{obs}}, M]
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
\hat u_\phi(t, u_t, u_{\text{obs}}, M) \approx \omega_t\, \mathbb{E}[u_0 \mid u_t] + (1 - \omega_t)\, \mathbb{E}[u_0 \mid u_{\text{obs}}, M]
$$

with \\(\\omega_t\\) monotonically increasing \\(0 \\to 1\\). The two conditional expectations are estimated with symmetric Monte-Carlo ensembles:

$$
\mathbb{E}[u_0 \mid u_t] \approx \frac{1}{K} \sum_{k=1}^{K} u_\phi\!\left(t,\, M_{\text{rnd}}^{(k)} \odot u_t,\, M_{\text{rnd}}^{(k)}\right), \qquad \mathbb{E}[u_0 \mid u_{\text{obs}}, M] \approx \frac{1}{K} \sum_{k=1}^{K} u_\phi\!\left(\delta,\, M_{\text{ctx}}^{(k)} \odot u_{\text{obs},\delta},\, M_{\text{ctx}}^{(k)}\right)
$$

where \\(M_{\text{rnd}}^{(k)}\\) are random masks following the same marginal as \\(M_{\text{ctx}}\\) (not constrained to \\(\\subseteq M\\)), and \\(M_{\text{ctx}}^{(k)} \\subseteq M\\). Sampling follows a RePaint-style scheme: estimate noise from the model on unobserved entries, compute it directly from known clean values on observed entries, then merge via

$$
\epsilon_{\text{full}} = M \odot \epsilon_{\text{obs}} + (1 - M) \odot \epsilon_{\text{unobs}},
$$

and step the diffusion ODE — keeping observations consistent throughout.

## 4. Work II — Generative-Prior Partitioning

### Motivation

The distribution-preserving rule must be hand-crafted per observation pattern (pixel dropout, block occlusion, …), introduces pattern-specific hyperparameters, and is mathematically hard to universally guarantee positivity over complex real spatial dependencies. Goal: a single mechanism valid for any spatial topology.

### Intersection gives positivity for free

Model the true mask distribution \\(p(M)\\) with a generative prior; draw two i.i.d. masks \\(M_1, M_2 \\sim p(M)\\) and set

$$
M_{\text{ctx}} = M_1 \odot M_2, \qquad M_{\text{qry}} = M_1 \odot (1 - M_{\text{ctx}})
$$

**Theorem (strict positivity via intersection):** for any valid \\(M_{\\text{ctx}} = m\\) and any \\(i\\) with \\(m_i = 0\\),

$$
P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}} = m) > 0.
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

**Stochastic anchor.** \\(y_i = \\mathbf{1}[r_i < \\rho] \\cdot M_i\\), \\(r_i \\sim \\mathrm{Uniform}(0,1)\\) — randomly retaining a fraction \\(\\rho\\) of observed points injects diversity (full anchoring collapses to one deterministic mask).

**Globally-normalized guidance loss.**

$$
\mathcal{L}_{\text{guidance}}(x_t, y) = -\frac{1}{d} \sum_{i=1}^d \big[ y_i \log \hat e_i + (1 - y_i) \log(1 - \hat e_i) \big]
$$

Global normalization stabilizes the gradient across very different sparsity levels.

**Latent intervention.**

$$
x_{t_{i+1}} \leftarrow x_{t_{i+1}}^{\text{base}} - w_g \nabla_{x_{t_i}} \mathcal{L}_{\text{guidance}}(x_{t_i}, y)
$$

**Theorem (positivity preserved under guidance):** under the ratio-guided intersection constraint, for any observed dimension \\(i\\) (\\(M_i = 1\\)), \\(P((M_{\\text{qry}})_i = 1 \\mid C_k) > 0\\) — conditioning does not break the guarantee.

### Training

Same context-query objective as the backbone, with the generated partition:

$$
M_{\text{ctx}} = \hat M \odot M, \quad M_{\text{qry}} = M \odot (1 - M_{\text{ctx}}), \qquad \mathcal{L} = \mathbb{E}\big[\| M_{\text{qry}} \odot (u_\phi(M_{\text{ctx}} \odot u_{\text{obs}}, M_{\text{ctx}}) - u_{\text{obs}}) \|^2 \big]
$$

## 5. Summary

| Route | How positivity is guaranteed | Trade-off |
|:------|:-----------------------------|:----------|
| Work I (distribution-preserving) | Sample \\(M_{\\text{ctx}}\\) with the same structure as \\(p_{\\text{mask}}\\); ensemble at inference | Pattern-specific heuristics; hard to cover complex spatial dependencies |
| Work II (generative-prior) | Intersection of two i.i.d. masks from \\(p(M)\\); observation-aligned guidance | Requires learning and sampling \\(p(M)\\), but holds for any topology |

The two routes are complementary, not competing. Work I is lightweight and needs no extra generative model when \\(p_{\\text{mask}}(M)\\) has a known or analytic structure, while Work II is the route when mask structure is complex or unknown, guaranteeing positivity by construction for any topology (whereas Work I relies on matched sampling).

Positivity now holds by construction for every valid topology, so the model transfers reconstruction from synthetic training masks to the genuinely-missing regions at test time — **without ever seeing a complete field**.
