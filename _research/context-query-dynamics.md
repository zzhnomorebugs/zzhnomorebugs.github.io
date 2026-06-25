---
title: "Learning Complete Dynamics from Incomplete Observations: A Context-Query Framework"
layout: research
collection: research
permalink: /research/context-query-dynamics/
lang_switch_url: /zh/research/context-query-dynamics/
order: 1
published: true
read_time: true
date: 2026-06-23
tags: [diffusion, imputation, context-query, AI4Science]
tldr: "The central question is whether we can learn complete physical dynamics when training data only contains partial observations. I frame the problem as context-query learning: the model receives one observed subset as context and is supervised on another withheld subset as query. This turns incomplete data into self-supervision, but it only works when every missing-from-context dimension is queried with strictly positive probability. The two works below provide complementary ways to guarantee that condition: a lightweight distribution-preserving partition when the mask pattern is known, and a generative mask-prior partition when the mask structure is complex or unknown."
excerpt: "A context-query diffusion framework for learning complete dynamics from incomplete observations, with two complementary routes to make self-supervision cover every recoverable dimension."
papers:
  - incomplet-data
  - ocean-imputation-mask
---

{% include toc %}

## Overview

Many scientific datasets are not missing a few random entries; they are collected through sensors, satellites, probes, or simulations that only reveal structured parts of the underlying field. The difficulty is that a standard supervised model would like pairs of incomplete input and complete target, but in this setting a complete target never appears during training.

The key idea is to create supervision inside each partial observation. From the observed region, we hide one subset as the **query** target and give another subset as **context** input. If this splitting rule is designed correctly, the model repeatedly learns how observed pieces predict withheld pieces, and this local self-supervision can be transferred to genuinely unobserved regions at test time.

This page summarizes two connected works around that idea. The first work asks how far we can go with a hand-designed partition that respects the observation pattern. The second work replaces the hand-designed rule with a learned generative prior over masks, so the same principle can handle complex spatial missingness.

<nav class="research-jump-nav" aria-label="Section navigation">
  <a href="#technical-roadmap">Roadmap</a>
  <a href="#2-unified-context-query-backbone">Backbone</a>
  <a href="#work-i">Work I</a>
  <a href="#work-ii">Work II</a>
  <a href="#5-summary">Summary</a>
</nav>

## Technical Roadmap

<div class="mermaid">
flowchart TB
  subgraph backbone [Unified Backbone]
    obs["Partial obs and mask M"]
    split["Split M into context and query"]
    train["Train on context, loss on query"]
    obs --> split
    split --> train
  end

  subgraph work1 [Work I · Distribution Preserving]
    part1["Sample context mask from p_mask"]
    ens["Ensemble context masks at inference"]
    part1 --> ens
  end

  subgraph work2 [Work II · Generative Prior]
    bfn["Pretrain BFN on mask prior"]
    inter["Context as intersection of two masks"]
    guide["Observation-aligned guidance"]
    bfn --> inter
    inter --> guide
  end

  out["Recover conditional expectation"]

  train --> part1
  train --> bfn
  ens --> out
  guide --> out
</div>

The diagram separates the shared learning principle from the two ways of constructing masks. Both works use the same context-query denoising backbone; they differ mainly in how they choose the context/query split so that no recoverable dimension is left without training signal.

<div class="research-pillars">
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">Stage 1 · Backbone</span>

Given partial observations \\(u_{\text{obs}} = M \odot u_0\\) and mask \\(M\\), split the observed support into context \\(M_{\text{ctx}}\\) (input) and query \\(M_{\text{qry}}\\) (loss). Train diffusion denoiser \\(u_\phi\\) on context only.
</div>
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">Stage 2a · Work I</span>

Sample \\(M_{\text{ctx}}\\) with the same structural pattern as \\(p_{\text{mask}}(M)\\) so every observed dimension can be queried with positive probability. Ensemble context masks at inference.
</div>
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">Stage 2b · Work II</span>

Pretrain BFN on \\(p(M)\\), form \\(M_{\text{ctx}} = M_1 \odot M_2\\) from two i.i.d. mask draws. Intersection yields strict positivity; observation-aligned guidance anchors generation.
</div>
</div>

## 1. Problem Setup

Complete data \\(u_0 \\in \\mathbb{R}^d \\sim p_{\\text{data}}\\), binary observation mask \\(M \\in \\{0,1\\}^d \\sim p_{\\text{mask}}(M)\\) with \\(p_{\\text{mask}}(M \\mid u_0) = p_{\\text{mask}}(M)\\). We only observe

$$
u_{\text{obs}} = M \odot u_0
$$

with **no complete sample ever in training**. Goal: learn \\(p_\\phi(u_0 \\mid u_{\\text{obs}}, M)\\).

Intuitively, \\(M\\) tells us which coordinates are visible and \\(1-M\\) marks the region we ultimately want to reconstruct. The challenge is not only to fill a particular missing region, but to learn a conditional distribution over complete fields from a dataset where every example is censored in a different structured way.

<figure class="research-figure">
  <a href="/images/research/context-query-dynamics/mask-topologies.png" class="image-popup">
    <img src="/images/research/context-query-dynamics/mask-topologies.png" alt="Examples of structured incomplete observation masks from ocean and satellite data">
  </a>
  <figcaption class="research-figure__caption">
    Figure 1. Real incomplete observations often have structured spatial topologies, from regional ocean coverage to satellite track patterns, rather than independent random missing pixels.
  </figcaption>
</figure>

## 2. Unified Context-Query Backbone

The backbone treats each partial observation as a small self-supervised task. Instead of asking the model to reconstruct entries that were never observed, we first ask it to reconstruct entries that are observed but deliberately hidden from the input. This gives a valid training target while keeping the test-time task aligned with imputation.

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

The main guarantee is simple: the model can only learn dimensions that sometimes appear in the query set. If a coordinate is always kept out of the loss once a context is fixed, the objective gives no reason for the denoiser to be correct there.

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

<div class="research-work-section" markdown="1">

## 3. Work I — Distribution-Preserving Partitioning {#work-i}

Work I is the practical route when the observation mask has a known structure, such as independent pixel dropout, regular sensor patterns, or block occlusions. Rather than learning a separate mask generator, we design the context mask to follow the same family of patterns as the original observation process.

<figure class="research-figure">
  <a href="/images/research/context-query-dynamics/context-query-selection.png" class="image-popup">
    <img src="/images/research/context-query-dynamics/context-query-selection.png" alt="Comparison between pixel-level and block-wise context-query partitioning strategies">
  </a>
  <figcaption class="research-figure__caption">
    Figure 2. Context-query selection must respect the mask distribution: pixel-level splitting can leave zero-query regions, while block-wise splitting keeps query probabilities positive under block-structured observations.
  </figcaption>
</figure>

### Partitioning

Decompose the query probability by the law of total probability:

$$
P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}) = \sum_{M} P((M_{\text{qry}})_i = 1 \mid M_{\text{ctx}}, M)\, P(M \mid M_{\text{ctx}})
$$

Since \\(M_{\\text{ctx}} \\subseteq M\\), sampling \\(M_{\\text{ctx}}\\) with the **same structural pattern as \\(p_{\\text{mask}}(M)\\)** (i.i.d. pixels → drop pixels independently; block-structured → drop whole blocks) makes multiple \\(M\\) compatible with a given \\(M_{\\text{ctx}}\\), so both factors can be simultaneously positive → positivity holds for every observed dimension.

> Too few context points → large information gap, high variance, slow convergence; too many → \\(p_i\\) tiny, infrequent updates. A moderate ratio is optimal.

### Ensemble inference

During training, the denoiser sees only a context subset. During inference, however, we have the full observed support \\(M\\). Ensembling asks the model many slightly different context questions and averages the answers, using the extra observations without changing the trained backbone.

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

<figure class="research-figure">
  <a href="/images/research/context-query-dynamics/block-reconstruction-comparison.png" class="image-popup">
    <img src="/images/research/context-query-dynamics/block-reconstruction-comparison.png" alt="Navier-Stokes block reconstruction comparison between ground truth, our method, and MissDiff">
  </a>
  <figcaption class="research-figure__caption">
    Figure 3. Under block-structured missingness, distribution-aware context-query training better preserves the evolving physical field than a baseline that leaves block interiors under-supervised.
  </figcaption>
</figure>

</div>

<div class="research-work-section" markdown="1">

## 4. Work II — Generative-Prior Partitioning {#work-ii}

Work II targets the harder case where mask geometry is too complex to specify by a few hand-written rules. Instead of manually deciding what a valid context split should look like, we first learn the distribution of observation masks and then sample partitions from that learned prior.

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

We need a model for a high-dimensional discrete mask prior \\(p(M)\\) that also supports latent gradient intervention during sampling. In this work, BFN provides exactly that bridge by lifting binary categories to continuous logits, training with discrete data matching, and sampling through a Tweedie-derived score under Gaussian forward dynamics.

Concretely, the implementation here uses the standard discrete BFN recipe (scaled-logit lift, \\(\mathcal{L}_{\mathrm{DM}}\\), and probability-flow sampling):

$$
\nabla_{x_t}\log p_t(x_t)\propto \alpha_t K \hat{e}_{\theta} - x_t.
$$

A full mathematical treatment is moved to the dedicated note: [Bayesian Flow Networks as Shift-Invariant Continuous Diffusion](/research/bayesian-flow-networks/).

### Observation-aligned conditioning

Purely sampling from the mask prior may generate contexts that are structurally plausible but poorly aligned with the current observation. The guidance term pulls generated masks toward the actually visible region while preserving enough randomness to keep query coverage positive.

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

</div>

## 5. Summary

Both works are built around the same message: incomplete observations are usable for learning complete dynamics if the self-supervised query mechanism covers every recoverable coordinate. The difference is whether that coverage is achieved by a rule we design or by a mask distribution we learn.

<div class="research-comparison-table" markdown="1">

| Route | How positivity is guaranteed | Trade-off |
|:------|:-----------------------------|:----------|
| Work I (distribution-preserving) | Sample \\(M_{\text{ctx}}\\) with the same structure as \\(p_{\text{mask}}\\); ensemble at inference | Pattern-specific heuristics; hard to cover complex spatial dependencies |
| Work II (generative-prior) | Intersection of two i.i.d. masks from \\(p(M)\\); observation-aligned guidance | Requires learning and sampling \\(p(M)\\), but holds for any topology |

</div>

The two routes are complementary, not competing. Work I is lightweight and needs no extra generative model when \\(p_{\\text{mask}}(M)\\) has a known or analytic structure, while Work II is the route when mask structure is complex or unknown, guaranteeing positivity by construction for any topology (whereas Work I relies on matched sampling).

Positivity now holds by construction for every valid topology, so the model transfers reconstruction from synthetic training masks to the genuinely-missing regions at test time — **without ever seeing a complete field**.
