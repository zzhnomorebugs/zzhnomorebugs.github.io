---
title: test
layout: research
permalink: /research/_mermaid-test/
published: false
---
{::nomarkdown}
<div class="mermaid">
flowchart TB
  subgraph backbone["Unified Backbone"]
    obs["Partial obs and mask M"]
    split["Split M into context and query"]
    train["Train on context, loss on query"]
    obs --> split
    split --> train
  end

  subgraph work1["Work I - Distribution Preserving"]
    part1["Sample context mask from p_mask"]
    ens["Ensemble context masks at inference"]
    part1 --> ens
  end

  subgraph work2["Work II - Generative Prior"]
    bfn["Pretrain BFN on mask prior"]
    inter["Context as intersection of two masks"]
    guide["Observation-aligned guidance"]
    bfn --> inter
    inter --> guide
  end

  train --> work1
  train --> work2
  work1 --> out["Recover conditional expectation"]
  work2 --> out
</div>
{:/nomarkdown}