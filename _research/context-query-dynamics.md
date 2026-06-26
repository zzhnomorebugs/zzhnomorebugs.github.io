---
title: "Context-Query Dynamics in Diffusion Models: From Mask Requirements to Generative Construction"
layout: research
collection: research
permalink: /research/context-query-dynamics/
lang_switch_url: /zh/research/context-query-dynamics/
order: 1
published: true
read_time: true
date: 2026-06-23
tags: [diffusion, imputation, context-query, AI4Science]
tldr: "The central question is what properties context-query masks must satisfy for diffusion models to learn from incomplete observations. The first work characterizes the requirement: every recoverable dimension must enter the query set with strictly positive probability, otherwise the denoiser is not identifiable there. It then gives a first construction for known mask families through distribution-preserving partitioning and ensemble inference. The second work generalizes the construction problem: when mask topology is complex or unknown, a generative mask prior can sample valid context-query partitions by construction."
excerpt: "A context-query diffusion framework organized around mask requirements: first characterize when a split is valid, then generate valid masks from a learned prior for complex missingness."
papers:
  - incomplet-data
  - ocean-imputation-mask
---

{% include toc %}

## Overview

### Core Question

What properties must context-query masks satisfy for diffusion models to learn from incomplete observations?

Many scientific datasets are not missing a few random entries; they are collected through sensors, satellites, probes, or simulations that only reveal structured parts of the underlying field. The difficulty is that a standard supervised model would like pairs of incomplete input and complete target, but in this setting a complete target never appears during training.

The context-query idea creates supervision inside each partial observation. From the observed region, one subset is hidden as the **query** target and another is provided as **context** input. This turns incomplete data into self-supervision, but only if the split has the right statistical property: every dimension that is absent from context but recoverable from the observation process must appear in query with strictly positive probability.

The two works on this page form a single requirement-to-construction story. The first work asks what makes a context-query split valid and gives a first construction when the mask family is known. The second work asks how to generate such valid splits automatically when the mask topology is complex or unknown.

<nav class="research-jump-nav" aria-label="Section navigation">
  <a href="#technical-roadmap">Roadmap</a>
  <a href="#2-context-query-backbone-and-mask-requirements">Requirements</a>
  <a href="#first-construction">First Construction</a>
  <a href="#general-construction">General Construction</a>
  <a href="#5-summary">Summary</a>
</nav>

## Technical Roadmap

<pre class="mermaid">
flowchart TB
  subgraph backbone["Context-Query Backbone"]
    obs["Partial obs and mask M"]
    split["Split M into context and query"]
    train["Train on context, loss on query"]
    obs --> split
    split --> train
  end

  subgraph req["Mask Requirement"]
    pos["Strict query positivity"]
    ident["Identifiable denoising targets"]
    pos --> ident
  end

  subgraph first["First Construction"]
    part1["Distribution-preserving partition"]
    ens["Ensemble inference"]
    part1 --> ens
  end

  subgraph general["General Construction"]
    bfn["Pretrain BFN on mask prior"]
    inter["Context as intersection of two masks"]
    guide["Observation-aligned guidance"]
    bfn --> inter
    inter --> guide
  end

  train --> req
  req --> first
  req --> general
  first --> output["Valid context-query supervision"]
  general --> output
</pre>

The diagram separates the learning backbone, the mask property it requires, and two ways to realize that property. Distribution-preserving partitioning is the first construction for known mask families; generative mask-prior partitioning is the general construction for complex or unknown topologies.

<div class="research-pillars">
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">Requirement · Query Positivity</span>

Given partial observations \\(u_{\text{obs}} = M \odot u_0\\), a valid split must make every recoverable non-context dimension appear in \\(M_{\text{qry}}\\) with positive probability. Otherwise the denoising target is arbitrary there.
</div>
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">First Construction · Known Mask Family</span>

Sample \\(M_{\text{ctx}}\\) with the same structural pattern as \\(p_{\text{mask}}(M)\\). This preserves compatibility with multiple full masks and gives a lightweight valid split when the observation pattern is known.
</div>
<div class="research-pillar" markdown="1">
<span class="research-pillar__label">General Construction · Learned Mask Prior</span>

Learn \\(p(M)\\), form \\(M_{\text{ctx}} = M_1 \odot M_2\\) from two i.i.d. mask draws, and guide samples toward the current observation. Valid partitions are generated rather than hand-designed.
</div>
</div>

## 1. Problem Setup

Complete data \\(u_0 \\in \\mathbb{R}^d \\sim p_{\\text{data}}\\), binary observation mask \\(M \\in \\{0,1\\}^d \\sim p_{\\text{mask}}(M)\\) with \\(p_{\\text{mask}}(M \\mid u_0) = p_{\\text{mask}}(M)\\). Training provides only

$$
u_{\text{obs}} = M \odot u_0
$$

with **no complete sample ever in training**. Goal: learn \\(p_\\phi(u_0 \\mid u_{\\text{obs}}, M)\\).

Intuitively, \\(M\\) indicates which coordinates are visible and \\(1-M\\) marks the region to reconstruct at test time. The challenge is not only to fill a particular missing region, but to learn a conditional distribution over complete fields from a dataset where every example is censored in a different structured way.

<figure class="research-figure">
  <a href="/images/research/context-query-dynamics/mask-topologies.png" class="image-popup">
    <img src="/images/research/context-query-dynamics/mask-topologies.png" alt="Examples of structured incomplete observation masks from ocean and satellite data">
  </a>
  <figcaption class="research-figure__caption">
    Figure 1. Real incomplete observations often have structured spatial topologies, from regional ocean coverage to satellite track patterns, rather than independent random missing pixels.
  </figcaption>
</figure>

## 2. Context-Query Backbone and Mask Requirements

The backbone treats each partial observation as a small self-supervised task. Instead of asking the model to reconstruct entries that were never observed, the training objective first targets entries that are observed but deliberately hidden from the input. This gives a valid training target while keeping the test-time task aligned with imputation.

### Hierarchical masking

Treat \\(u_{\\text{obs}}\\) as "complete within its support", then split it into a context mask \\(M_{\\text{ctx}} \\subseteq M\\) (model input) and a query mask \\(M_{\\text{qry}} \\subseteq M\\) (loss region). The noisy state is

$$
u_{\text{obs},t} = M \odot (\alpha_t u_{\text{obs}} + \sigma_t \epsilon),
$$

and \\(u_\\phi\\) is trained to predict clean data from the context only:

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

This is the requirement that organizes the two constructions below. First, if the mask family is known, a distribution-preserving split can satisfy it directly. Second, if the mask topology is complex or unknown, valid splits must be generated from a learned mask prior.

<div class="research-work-section" markdown="1">

## 3. A First Construction - Distribution-Preserving Partitioning {#first-construction}

The first construction applies when the observation mask has a known structure, such as independent pixel dropout, regular sensor patterns, or block occlusions. In this setting, the goal is not to invent a new mask generator, but to construct a context mask whose distribution preserves the structural family of the original observation process.

This work therefore has two roles: it characterizes the required mask property, and it shows that the property can be realized with a lightweight hand-designed split when the mask family is known.

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

### Inference with many valid contexts

During training, the denoiser sees only a context subset. During inference, however, the full observed support \\(M\\) is available. Ensembling asks the model many slightly different context questions and averages the answers, using the extra observations without changing the trained backbone.

Inference is a train/test mismatch: the model gives \\(\\mathbb{E}[u_0 \\mid M_{\\text{ctx}} \\odot u_{\\text{obs},t}, M_{\\text{ctx}}]\\) but the target is \\(\\mathbb{E}[u_0 \\mid u_{\\text{obs},t}, M]\\). This gap is bridged by ensembling over context masks.

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
    <img src="/images/research/context-query-dynamics/block-reconstruction-comparison.png" alt="Navier-Stokes block reconstruction comparison between ground truth, the proposed method, and MissDiff">
  </a>
  <figcaption class="research-figure__caption">
    Figure 3. Under block-structured missingness, distribution-aware context-query training better preserves the evolving physical field than a baseline that leaves block interiors under-supervised.
  </figcaption>
</figure>

</div>

<div class="research-work-section" markdown="1">

## 4. A General Construction - Generative Mask-Prior Partitioning {#general-construction}

The general construction targets the harder case where mask geometry is too complex to specify by a few hand-written rules. The requirement from the previous section remains unchanged: query positivity must hold for every recoverable coordinate. What changes is how the split is constructed.

Instead of manually deciding what a valid context split should look like, the observation-mask distribution is learned first and valid partitions are sampled from that learned prior.

### From validity requirement to mask sampler

The distribution-preserving rule must be hand-crafted per observation pattern (pixel dropout, block occlusion, …), introduces pattern-specific hyperparameters, and is mathematically hard to universally guarantee positivity over complex real spatial dependencies. The goal is a single mechanism valid for any spatial topology: learn the mask distribution, sample candidate context structures, and preserve the same positivity property by construction.

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

A model is needed for a high-dimensional discrete mask prior \\(p(M)\\) that also supports latent gradient intervention during sampling. BFN provides exactly that bridge by lifting binary categories to continuous logits, training with discrete data matching, and sampling through a Tweedie-derived score under Gaussian forward dynamics.

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

Both works are built around the same message: incomplete observations are usable for learning complete dynamics only when the context-query split satisfies the right mask property. The first work identifies that property and gives a first construction for known observation patterns. The second work turns the same property into a generative construction problem, enabling valid splits for complex or unknown mask topologies.

<div class="research-comparison-table" markdown="1">

| Role | What it answers | Mechanism |
|:-----|:----------------|:----------|
| Mask requirement | What properties must a context-query split satisfy? | Strict query positivity and identifiable denoising targets |
| First construction | How can valid masks be built when the mask family is known? | Distribution-preserving partitioning and ensemble inference |
| General construction | How can valid masks be generated when topology is complex or unknown? | Generative mask priors, intersection partitions, and observation-aligned guidance |

</div>

The two constructions are complementary, not competing. Distribution-preserving partitioning is lightweight and needs no extra generative model when \\(p_{\\text{mask}}(M)\\) has a known or analytic structure. Generative mask-prior partitioning is the scalable route when mask structure is complex or unknown, guaranteeing positivity by construction for any topology.

The broader research thread is therefore: first characterize what a valid context-query mask must guarantee, then build mechanisms that generate such masks under increasingly realistic observation processes.
