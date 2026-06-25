---
title: "Bayesian Flow Networks as Shift-Invariant Continuous Diffusion"
layout: research
collection: research
permalink: /research/bayesian-flow-networks/
order: 2
published: true
read_time: true
date: 2026-06-25
tags: [diffusion, BFN, discrete-generation, generative-modeling]
tldr: "BFN diffuses continuous distribution parameters, not raw data. In the discrete branch, a scaled-logit lift embeds one-hot targets in a Gaussian forward process on Euclidean space, softmax removes shift redundancy, and Tweedie maps a class predictor to a score field for ODE/SDE sampling and gradient guidance."
excerpt: "A compact technical note on discrete BFN as shift-redundant continuous diffusion, including scaled-logit embedding, simplex geometry, data-matching training, and Tweedie-based score sampling."
papers:
  - ocean-imputation-mask
---

{% include toc %}

## Overview

For the discrete branch of Bayesian Flow Networks, generation can be written as diffusion on continuous distribution parameters rather than on discrete symbols themselves. The key move is a scaled-logit lift from class labels to a Euclidean state, followed by Gaussian corruption and score-based reverse dynamics. This yields the same sampler-level interface as continuous diffusion while preserving the categorical semantics through softmax decoding.

This note is intentionally scoped to the discrete scaled-logit formulation. It does not attempt to re-derive the full sender-receiver Bayesian message-passing view used in the original BFN presentation.

<div class="mermaid">
flowchart LR
  classLabel["Discrete class c"] --> lift["Lift: x0 = K ec"]
  lift --> forward["Forward: xt = alpha_t x0 + sigma_t eps"]
  forward --> predictor["Predictor: ehat_theta(t, softmax(xt))"]
  predictor --> tweedie["Score via Tweedie"]
  tweedie --> reverse["Reverse ODE/SDE"]
  reverse --> decode["Decode to categorical sample"]
</div>

## 1. Diffusion on parameter space

BFN uses a continuous parameter state \(x_t\) that represents beliefs about a discrete variable, instead of diffusing the discrete variable itself. Under the Gaussian forward family,

$$
x_t = \alpha_t x_0 + \sigma_t \epsilon, \qquad \epsilon \sim \mathcal{N}(0, I),
$$

the marginal \(p_t(x_t)\) is a continuous density on Euclidean space, so \(\nabla_{x_t}\log p_t(x_t)\) is a standard score field.

## 2. Discrete lift via scaled logits

For \(c \in \{1,\dots,K\}\), define

$$
x_0 = K e_c,
$$

with \(e_c\) the one-hot basis vector. Then \(\mathrm{softmax}(K e_c)\) approaches \(e_c\) as the scale grows, turning categorical generation into regression on a continuous target \(x_0\). For finite \(K\), this is a controlled approximation rather than an exact identity.

## 3. Shift redundancy and simplex geometry

Categorical semantics depend on \(\mathrm{softmax}(x)\), not on absolute logits. Therefore \(x\) and \(x + b\mathbf{1}\) encode the same class probabilities, which introduces a one-dimensional redundancy in logit space.

Architecturally feeding \(\mathrm{softmax}(x_t)\) into the predictor removes that redundancy at the representation level without losing information relevant to \(p(c \mid x_t)\). In this parameterization, score components along the all-ones direction are non-identifiable and can be treated as gauge freedom.

## 4. Training as discrete data matching

A standard objective in this branch is weighted data matching:

$$
\mathcal{L}_{\mathrm{DM}} = \mathbb{E}_{t,c,\epsilon}\Big[w(t)\,\big\|\hat e_\theta\!\big(t,\mathrm{softmax}(x_t)\big)-e_c\big\|^2\Big].
$$

Here \(\hat e_\theta\) predicts class-probability targets (equivalently \(x_0/K\)), not \(\epsilon\). The schedule terms \(w(t), \alpha_t, \sigma_t\) should be chosen consistently.

## 5. Score via Tweedie and reverse sampling

Under \(x_t \mid x_0 \sim \mathcal{N}(\alpha_t x_0,\sigma_t^2 I)\), Tweedie gives

$$
\nabla_{x_t}\log p_t(x_t) = \frac{\alpha_t \,\mathbb{E}[x_0 \mid x_t]-x_t}{\sigma_t^2}.
$$

Using \(\mathbb{E}[x_0 \mid x_t] \approx K\,\hat e_\theta(t,\mathrm{softmax}(x_t))\), we obtain

$$
\nabla_{x_t}\log p_t(x_t)=\frac{\alpha_t K\,\hat e_\theta(t,\mathrm{softmax}(x_t))-x_t}{\sigma_t^2}.
$$

This directly enables probability-flow ODE or SDE reverse integration with the same control surface as continuous score models.

## 6. Gradient guidance in latent space

Because the sampling state is continuous, guidance can be injected by adding a gradient term in \(x_t\)-space, for example from a conditioning loss \(\mathcal{L}_{\mathrm{guide}}(x_t, y)\). This is the mechanism used by observation-aligned mask guidance in the context-query setting, where guidance acts on logits while decoding remains categorical.

## 7. Factorization for binary masks

For \(M \in \{0,1\}^d\), one practical view is \(d\) coupled binary subproblems (\(K=2\) per site), with a joint latent state in \(\mathbb{R}^{2d}\) or equivalent per-site logits. Spatial dependence is captured by the network architecture over \(\mathrm{softmax}(x_t)\), not by assuming independent outputs at inference time.

## 8. Scope and caveats

- This note targets discrete scaled-logit BFN; continuous-data BFN is typically formulated over Gaussian posterior parameters and is not identical to raw-data VP diffusion.
- The approximation quality of \(\mathrm{softmax}(K e_c)\approx e_c\) is finite-\(K\) dependent.
- Training is stated in data-matching form, while reverse-time sampling uses score dynamics derived from Tweedie.

## Related

- Application-level integration in context-query learning: [Context-Query Dynamics](/research/context-query-dynamics/).
- Original BFN reference: [Graves et al., Bayesian Flow Networks (arXiv:2308.07037)](https://arxiv.org/abs/2308.07037).
