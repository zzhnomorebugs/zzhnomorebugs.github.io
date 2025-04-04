---
title: "Teaching experience 1"
collection: teaching
type: "Undergraduate course"
permalink: /teaching/2014-spring-teaching-1
venue: "University 1, Department"
date: 2014-01-01
location: "City, Country"
---
# Summary of Diffusion Models via Stochastic Differential Equations

jiohn fuyv fuuyvb gi

## Problem Definition

- **Forward SDE**:
  \[
  \mathrm{d}\mathbf{x} = \mathbf{f}(\mathbf{x}, t)\mathrm{d}t + g(t)\mathrm{d}\mathbf{w}, \quad \mathbf{x}(0) \sim p_{\text{data}}, \quad \mathbf{x}(T) \sim p_T
  \]
  Transforms data distribution \( p_0 \) into a tractable prior \( p_T \) (e.g., Gaussian) via noise injection.
- **Reverse-Time SDE** (Anderson, 1982):
  \[
  \mathrm{d}\mathbf{x} = \left[\mathbf{f}(\mathbf{x}, t) - g(t)^2 \nabla_{\mathbf{x}} \log p_t(\mathbf{x})\right]\mathrm{d}t + g(t)\mathrm{d}\tilde{\mathbf{w}},
  \]
  Requires estimating \( \nabla_{\mathbf{x}} \log p_t(\mathbf{x}) \) (score function) via a neural network \( \mathbf{s}_{\theta}(\mathbf{x}, t) \).

## Key Results

1. **Score Estimation**:

   - Trained via a continuous generalization of denoising score matching:
     \[
     \bm{\theta}^* = \arg\min_{\theta} \mathbb{E}_t \left[ \lambda(t) \mathbb{E}_{\mathbf{x}(0), \mathbf{x}(t)} \left\| \mathbf{s}_{\theta}(\mathbf{x}(t), t) - \nabla_{\mathbf{x}(t)} \log p_{0t}(\mathbf{x}(t) \mid \mathbf{x}(0)) \right\|_2^2 \right].
     \]
2. **Probability Flow ODE**:

   - Deterministic counterpart of the SDE:
     \[
     \mathrm{d}\mathbf{x} = \left[\mathbf{f}(\mathbf{x}, t) - \frac{1}{2}g(t)^2 \nabla_{\mathbf{x}} \log p_t(\mathbf{x})\right]\mathrm{d}t.
     \]
   - Enables **exact likelihood computation** via neural ODEs and **fast adaptive sampling**.
3. **Sampling Methods**:

   - **Predictor-Corrector (PC) Samplers**: Combine numerical SDE solvers (predictor) with score-based MCMC (corrector).
   - **Sub-VP SDE**:
     \[
     \mathrm{d}\mathbf{x} = -\frac{1}{2}\beta(t)\mathbf{x}\mathrm{d}t + \sqrt{\beta(t)(1 - e^{-2\int_0^t \beta(s)\mathrm{d}s})}\mathrm{d}\mathbf{w},
     \]
     Achieves state-of-the-art likelihood (2.99 bits/dim on CIFAR-10).
4. **Controllable Generation**:

   - Solve conditional reverse-time SDE for tasks like class-conditional sampling, inpainting, and colorization:
     \[
     \mathrm{d}\mathbf{x} = \left[\mathbf{f}(\mathbf{x}, t) - g(t)^2\left(\nabla_{\mathbf{x}} \log p_t(\mathbf{x}) + \nabla_{\mathbf{x}} \log p_t(\mathbf{y} \mid \mathbf{x})\right)\right]\mathrm{d}t + g(t)\mathrm{d}\tilde{\mathbf{w}}.
     \]

## Experimental Highlights

- **CIFAR-10**: Inception Score (9.89), FID (2.20) for unconditional generation.
- **High-Resolution**: First \(1024 \times 1024\) samples from a score-based model.
- **Likelihood**: Sub-VP SDE achieves 2.99 bits/dim (uniformly dequantized CIFAR-10).

## Conclusion

The SDE framework unifies SMLD and DDPM, enables flexible sampling (PC/ODE), exact likelihoods, and extends to conditional generation. Trade-offs exist between sample quality (VE SDE) and likelihood (sub-VP SDE).
