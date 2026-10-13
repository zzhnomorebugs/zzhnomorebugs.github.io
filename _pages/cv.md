---
layout: cv
title: "CV"
permalink: /cv/
lang_switch_url: /zh/cv/
redirect_from:
  - /resume
---

{% include base_path %}

<header class="cv-hero">
<img class="cv-hero-art" src="{{ base_path }}/images/cv/research-network.svg" alt="" width="400" height="250" aria-hidden="true">
<div class="cv-identity">
<img class="cv-avatar" src="{{ base_path }}/images/Zhou_Zihan_20260306_thumb.webp" alt="Zihan Zhou" width="88" height="88">
<div><p class="cv-eyebrow">ACADEMIC & RESEARCH / CV</p>
<h1>Zihan Zhou <span>周子涵</span></h1></div>
</div>
<a class="cv-download" href="{{ base_path }}/files/Zihan-Zhou-AI4Science-EN.pdf">{% include cv-icon.html name="download" %} Download CV <span class="cv-filetype">PDF</span></a>
<div class="cv-tags"><span>AI for Chemistry</span><span>Molecular Generation</span><span>AI for Science Research</span></div>
<div class="cv-summary" markdown="1">
Ph.D. student in Data Science focused on generative models for scientific applications, including single-step retrosynthesis, protein sequence generation, and modeling with physical priors. Publications in TPAMI, ICML, NeurIPS, and ICLR.
</div>
<div class="cv-contact">
<a href="tel:+8613098696800">{% include cv-icon.html name="phone" %} +86 13098696800</a>
<a href="mailto:zihanzhou1@link.cuhk.edu.cn">{% include cv-icon.html name="mail" %} zihanzhou1@link.cuhk.edu.cn</a>
<a href="https://zzhnomorebugs.github.io/">{% include cv-icon.html name="web" %} zzhnomorebugs.github.io</a>
</div>
</header>

<div class="cv-body">

<nav class="cv-nav" aria-label="CV sections"><p>ON THIS PAGE</p>

<a href="#education"><span>01</span>Education</a>

<a href="#internships"><span>02</span>Research Internships</a>

<a href="#projects"><span>03</span>Selected Research Projects</a>

<a href="#publications"><span>04</span>Publications</a>

<a href="#preprints"><span>05</span>Preprints</a>

<a href="#skills"><span>06</span>Technical Skills</a>

</nav>

<div class="cv-content">

<section id="education" class="cv-section cv-section--education">
<h2><span>01</span>Education</h2>

<article class="cv-entry cv-timeline-entry">
<span class="cv-institution cv-institution--education">{% include cv-icon.html name="education" %}</span>
<div class="cv-entry-head"><h3>The Chinese University of Hong Kong, Shenzhen</h3><span class="cv-date">Sep. 2023 - Jun. 2027 (expected)</span></div>
<p class="cv-role">Ph.D. in Data Science</p>

<div class="cv-entry-text" markdown="1">
Advisor: Prof. [Tianshu Yu](https://mypage.cuhk.edu.cn/academics/yutianshu/)
</div>
</article>

<article class="cv-entry cv-timeline-entry">
<span class="cv-institution cv-institution--education">{% include cv-icon.html name="education" %}</span>
<div class="cv-entry-head"><h3>The Chinese University of Hong Kong, Shenzhen</h3><span class="cv-date">Sep. 2019 - Jun. 2023</span></div>
<p class="cv-role">B.Sc. Mathematics and Applied Mathematics</p>

<div class="cv-entry-text" markdown="1">
GPA: 3.513 / 4.0 · First Class Honors
</div>
</article>

</section>

<section id="internships" class="cv-section cv-section--internships">
<h2><span>02</span>Research Internships</h2>

<article class="cv-entry cv-timeline-entry">
<span class="cv-institution"><img src="{{ base_path }}/images/experience/logos/bytedance-seed.png" alt="" loading="lazy" width="44" height="44"></span>
<div class="cv-entry-head"><h3>ByteDance Seed</h3><span class="cv-date">Aug. 2026 - Present</span></div>
<p class="cv-role">AI for Science Intern</p>

<div class="cv-entry-text" markdown="1">
Conduct research in AI for Science.
</div>
</article>

<article class="cv-entry cv-timeline-entry">
<span class="cv-institution"><img src="{{ base_path }}/images/experience/logos/tencent.png" alt="" loading="lazy" width="44" height="44"></span>
<div class="cv-entry-head"><h3>Tencent Life Sciences Lab</h3><span class="cv-date">Jun. 2026 - Aug. 2026</span></div>
<p class="cv-role">Applied Research Intern</p>

<div class="cv-entry-text" markdown="1">
**Generative modeling:** Implemented algorithms for controllable protein sequence generation and editing; contributed to conditional modeling and the development and refinement of training and sampling pipelines.

**Evaluation:** Assessed candidate sequences and generation methods by target condition satisfaction, extent of sequence edits, and predicted structural quality.
</div>
</article>

<article class="cv-entry cv-timeline-entry">
<span class="cv-institution"><img src="{{ base_path }}/images/experience/logos/shanghai-ai-lab.png" alt="" loading="lazy" width="44" height="44"></span>
<div class="cv-entry-head"><h3>Shanghai AI Laboratory</h3><span class="cv-date">Aug. 2025 - May 2026</span></div>
<p class="cv-role">AI for Science Research Intern (Retrosynthesis)</p>

<div class="cv-entry-text" markdown="1">
**Single-step retrosynthesis:** Led development and maintenance of the training, evaluation, and experiment codebase; built reproducible workflows for comparative studies and ablations.
</div>
</article>

<article class="cv-entry cv-timeline-entry">
<span class="cv-institution"><img src="{{ base_path }}/images/experience/logos/shanghai-ai-lab.png" alt="" loading="lazy" width="44" height="44"></span>
<div class="cv-entry-head"><h3>Shanghai AI Laboratory</h3><span class="cv-date">Jun. 2025 - Dec. 2025</span></div>
<p class="cv-role">AI for Science Research Intern (Proteins)</p>

<div class="cv-entry-text" markdown="1">
**Protein generation:** Contributed to architecture design and large-scale training of MSA-conditioned generative models; compared conditioning and sampling methods and evaluated predicted structural quality.
</div>
</article>

</section>

<section id="projects" class="cv-section cv-section--projects">
<h2><span>03</span>Selected Research Projects</h2>

<article class="cv-entry cv-project">
<div class="cv-project-top">
<div class="cv-entry-head"><h3>Reaction-Center-Guided Molecular Retrosynthesis</h3><span class="cv-badge">ICML 2026</span></div>
{% include cv-project-visual.html image="images/research/retro/framework.webp" url="/research/retro/" alt="Training and generation framework for reaction-center-guided retrosynthesis" %}
</div>

<div class="cv-entry-text" markdown="1">
Shanghai AI Laboratory · Aug. 2025 - May 2026

- **Problem and approach:** Predicted reactants from products for single-step retrosynthesis. Prioritized reaction-center atoms to introduce a structural inductive bias, combining a graph diffusion Transformer with discrete flow matching.

- **Contributions:** Built the training and evaluation codebase from scratch and led its development and maintenance. Designed a Hydra-based experiment framework for reproducible ablations on atom ordering, model size, and sampling steps.

- **Results:** Achieved Top-1 accuracy of **61.2% / 51.3%** on USPTO-50k / USPTO-Full. Compared with prior diffusion methods evaluated in the paper, training was **6 times faster** with **1/25** as many sampling steps. With appropriate atom ordering, a **280K**-parameter model matched a **65M**-parameter baseline without this bias.
</div>
</article>

<article class="cv-entry cv-project">
<div class="cv-project-top">
<div class="cv-entry-head"><h3>Protein Sequence Generation: MSA Modeling and Property-Controlled Editing</h3></div>
{% include cv-project-visual.html image="images/cv/protein-sequence.svg" alt="Abstract illustration of protein sequence modeling" caption="Sequence modeling & controlled generation" %}
</div>

<div class="cv-entry-text" markdown="1">
MSA modeling: Shanghai AI Laboratory, Jun. - Dec. 2025; controllable editing: Tencent, Jun. - Aug. 2026

- **MSA-conditioned modeling:** Adapted the ESM-2 Transformer into a DiT and compared BFN and DFM using the same **650M**-parameter architecture. Evaluated additive profile embeddings, Perceiver cross-attention, and profile-based initialization for DFM.

- **Training and sampling:** Processed a protein MSA corpus at the tens-of-millions scale; trained with Hydra / Lightning, multi-GPU DDP, and bf16. Compared Langevin, ODE, and SDE sampling for BFN and analyzed the effects of step count and starting time.

- **Evaluation:** On CAMEO-61, mean pLDDT improved from **56.46** to **78.24** and mean pTM from **0.55** to **0.75** versus the previous-generation model. Used CCMpred long-range P@L5 to assess coevolutionary contact quality. These are **structure-prediction proxy metrics**.

- **Property-controlled editing (Tencent):** Contributed to conditional modeling and training, sampling, and evaluation pipelines; compared editing methods by target condition satisfaction, extent of sequence edits, and predicted structural quality.
</div>
</article>

<article class="cv-entry cv-project">
<div class="cv-project-top">
<div class="cv-entry-head"><h3>3D Molecular Conformation Generation: Geometric Diffusion and Efficient Sampling</h3><span class="cv-badge">TPAMI</span></div>
{% include cv-project-visual.html image="images/publications/se3_diffusion_timeline.webp" url="https://arxiv.org/abs/2403.01430" alt="Geometric diffusion in SE(3)-invariant space" external=true %}
</div>

<div class="cv-entry-text" markdown="1">
- **Distance distribution modeling (SDDiff):** For 3D conformation generation from molecular graphs, characterized the transition of perturbed interatomic distance distributions from Gaussian to Maxwell–Boltzmann. Proposed a shifting-score diffusion model accounting for rotational / translational symmetry and geometric feasibility.

- **Geometric sampling (TPAMI):** Used differential geometry to analyze the relationship between coordinate and interatomic-distance manifolds; derived projection-free reverse SDEs / ODEs and compared conformation coverage and matching accuracy across sampling step counts.

- **Evaluation:** Evaluated conformation coverage (COV) and matching error (MAT) on GEOM-QM9 / GEOM-Drugs. The SDDiff preprint reported mean **COV of 90.68% and MAT of 0.8564 Å** on GEOM-Drugs, with a COV threshold of 1.25 Å.
</div>
</article>

<article class="cv-entry cv-project">
<div class="cv-project-top">
<div class="cv-entry-head"><h3>Generating Physical Dynamics under Priors</h3><span class="cv-badge">ICLR 2025</span></div>
{% include cv-project-visual.html image="images/research/physical-dynamics/three-body-prior.webp" url="/research/physical-dynamics/" alt="Generated three-body trajectories with physical priors" %}
</div>

<div class="cv-entry-text" markdown="1">
- **Approach:** Incorporated distributional priors such as rotational / translational invariance, together with physical constraints such as conservation laws and PDEs, into diffusion generation to reduce inconsistencies between generated trajectories and physical laws.

- **Implementation and validation:** Handled linear and nonlinear constraints through constraint decomposition; validated the physical feasibility of generated trajectories and flow fields across multiple physical systems and PDE datasets.
</div>
</article>

</section>

<section id="publications" class="cv-section cv-section--publications">
<h2><span>04</span>Publications</h2>

<div class="cv-legend" markdown="1">
\* Equal contribution; + Project supervision; # Corresponding author. Name in bold.
</div>

<article class="cv-paper cv-paper--published">
<span class="cv-paper-mark"><img src="{{ base_path }}/images/venues/ieee.svg" alt="" loading="lazy" width="32" height="32"></span>
<div class="cv-paper-text" markdown="1">
[On Diffusion Process in SE(3)-invariant Space.](https://arxiv.org/abs/2403.01430)<br>
**Zihan Zhou**, Ruiying Liu, Jiachen Zheng, Xiaoxue Wang, Tianshu Yu<sup>#</sup>. IEEE TPAMI.
</div>
</article>

<article class="cv-paper cv-paper--published">
<span class="cv-paper-mark"><img src="{{ base_path }}/images/venues/icml.svg" alt="" loading="lazy" width="32" height="32"></span>
<div class="cv-paper-text" markdown="1">
[Order Matters in Retrosynthesis: Structure-aware Generation via Reaction-Center-Guided Discrete Flow Matching.](https://arxiv.org/abs/2602.13136)<br>
Chenguang Wang<sup>*</sup>, **Zihan Zhou**<sup>*</sup>, Lei Bai, Tianshu Yu<sup>#</sup>. ICML 2026.
</div>
</article>

<article class="cv-paper cv-paper--published">
<span class="cv-paper-mark"><img src="{{ base_path }}/images/venues/iclr.svg" alt="" loading="lazy" width="32" height="32"></span>
<div class="cv-paper-text" markdown="1">
[Incomplete Data, Complete Dynamics: A Diffusion Approach.](https://arxiv.org/abs/2509.20098)<br>
**Zihan Zhou**, Chenguang Wang, Hongyi Ye, Yongtao Guan, Tianshu Yu<sup>#</sup>. ICLR 2026.
</div>
</article>

<article class="cv-paper cv-paper--published">
<span class="cv-paper-mark"><img src="{{ base_path }}/images/venues/neurips.svg" alt="" loading="lazy" width="32" height="32"></span>
<div class="cv-paper-text" markdown="1">
[TEMPO: Temporal Multi-scale Autoregressive Generation of Protein Conformational Ensembles.](https://arxiv.org/abs/2511.05510)<br>
Yaoyao Xu, Di Wang, **Zihan Zhou**, Tianshu Yu<sup>#</sup>, Mingchen Chen<sup>#</sup>. NeurIPS 2025.
</div>
</article>

<article class="cv-paper cv-paper--published">
<span class="cv-paper-mark"><img src="{{ base_path }}/images/venues/iclr.svg" alt="" loading="lazy" width="32" height="32"></span>
<div class="cv-paper-text" markdown="1">
[Generating Physical Dynamics under Priors.](https://arxiv.org/abs/2409.00730)<br>
**Zihan Zhou**, Xiaoxue Wang, Tianshu Yu<sup>#</sup>. ICLR 2025.
</div>
</article>

<article class="cv-paper cv-paper--published">
<span class="cv-paper-mark"><img src="{{ base_path }}/images/venues/icml.svg" alt="" loading="lazy" width="32" height="32"></span>
<div class="cv-paper-text" markdown="1">
[Learning to Decouple Complex Systems.](https://proceedings.mlr.press/v202/zhou23q.html)<br>
**Zihan Zhou**, Tianshu Yu<sup>#</sup>. ICML 2023.
</div>
</article>

</section>

<section id="preprints" class="cv-section cv-section--preprints">
<h2><span>05</span>Preprints</h2>

<div class="cv-paper" markdown="1">
[Learning Field Reconstruction from Incomplete Data by Globally Correcting Local Estimates.](https://arxiv.org/abs/2610.05375)<br>
Renhao Zhong, **Zihan Zhou**<sup>+</sup>, Chiyuan Ma, Tianshu Yu. arXiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[Differentiable mass transfer modeling enables wet lab validated inverse analysis of liquid chromatography.](https://doi.org/10.26434/chemrxiv.15009352/v1)<br>
Baochen Li<sup>*</sup>, **Zihan Zhou**<sup>*</sup>, Yanqing Yu, Sen Lin, Peng Wang, Tianshu Yu<sup>#</sup>, Xiaoxue Wang<sup>#</sup>. ChemRxiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[AMix-2: Establishing Protein as a Native Modality in Large Language Models.](https://arxiv.org/abs/2605.30963)<br>
Keyue Qiu<sup>*</sup>, Yixin Wu<sup>*</sup>, **Zihan Zhou**, Changze Lv, Lihao Wang, et al., Hao Zhou<sup>#</sup>. arXiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[Observation-Aligned Mask Priors for Learning Physical Dynamics from Authentic Occlusions.](https://arxiv.org/abs/2605.16818)<br>
Chiyuan Ma, **Zihan Zhou**<sup>+</sup>, Tianshu Yu<sup>#</sup>. arXiv preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
Physics-Mediated Diffusion: Leveraging Intermediate Field Representations for Sparse PDE Inversion.<br>
**Zihan Zhou**<sup>*</sup>, Chiyuan Ma<sup>*</sup>, Tianshu Yu<sup>#</sup>. Preprint, 2026.
</div>

<div class="cv-paper" markdown="1">
[Molecular Conformation Generation via Shifting Scores.](https://arxiv.org/abs/2309.09985)<br>
**Zihan Zhou**, Ruiying Liu, Chaolong Ying, Ruimao Zhang, Tianshu Yu<sup>#</sup>. arXiv preprint, 2023.
</div>

</section>

<section id="skills" class="cv-section cv-section--skills">
<h2><span>06</span>Technical Skills</h2>

<div class="cv-skills" markdown="1">
- **Generative modeling:** Diffusion models, BFN, discrete flow matching, DiT, conditional generation, MSA-conditioned modeling, and sampling strategies.

- **Training and experimentation:** Lightning, Hydra, multi-GPU DDP, bf16; model scaling comparisons, ablation studies, and reproducible evaluation.

- **Scientific computing:** Physical priors and conservation constraints, forward / inverse PDE problems, SE(3) invariance, molecular conformation generation, and protein generation.
</div>

</section>

</div>

</div>
