# 蛋白质序列可控生成 — 项目进展报告

## 项目说明

本项目围绕“蛋白质序列可控生成”展开，目标是构建一套能够在给定功能或性质约束下，自动生成候选蛋白质序列的方法体系。要解决的核心任务是：在保证序列生物学合理性与可折叠性的前提下，实现对目标条件（如功能标签、结构倾向、活性方向等）的定向引导，从而降低人工设计成本、提升候选序列筛选效率，并为后续实验验证提供高质量生成结果。

---

## 一、技术路线数学说明

### 1.1 总体架构

系统由三个核心模块构成：

| 模块 | 名称 | 作用 | 输入 | 输出 |
|------|------|------|------|------|
| **f(t, xₜ)** | 无条件生成模型 | 学习蛋白质序列的通用语言规律与先验 | 加噪序列 xₜ | 去噪后的蛋白序列 |
| **g(t, xₜ, y)** | 条件引导网络 | 学习从加噪序列到目标条件 y 的局部修正方向 | 加噪序列 xₜ + 条件标签 y | Score 修正项（同 f 维度） |
| **h = f + g** | 可控采样引擎 | 组合 f 与 g 实现定向生成 | 初始序列 + 目标条件 y | 满足条件的蛋白序列 |

三个模块的工作流：

```
   ┌──────────────┐            ┌──────────────┐
   │  野生型/先验  │ ──加噪──▶  │  xₜ (中间态) │
   └──────────────┘            └──────┬───────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               │                      │                      │
               ▼                      ▼                      ▼
         ┌──────────┐           ┌──────────┐           ┌──────────┐
         │   f 模块 │           │   g 模块  │           │   评估   │
         │(阶段性ckpt)│         │(新任务微调)│           │  模型    │
         └────┬─────┘           └────┬─────┘           └──────────┘
              │                      │
              └────────── + ─────────┘
                          │
                          ▼
                    ┌──────────┐
                    │  h = f+g │
                    │ (采样引擎)│
                    └────┬─────┘
                         │
                         ▼
                  目标条件 y 下的新序列
```

### 1.2 模块一：f(t, xₜ) — 蛋白质序列生成模型

#### 1.2.1 模块作用

f 是整个系统的基础，负责学习"什么样的氨基酸序列是合理的蛋白质"，用于提供稳定的无条件序列先验。

训练采用单一范式：

- **无条件预训练**：在大规模天然蛋白序列上学习通用语法——氨基酸位置保守性、二级结构偏好、结构域组合等。

#### 1.2.2 输入输出

| 模式 | 输入 | 输出 |
|------|------|------|
| 无条件模式 | 离散噪声序列 xₜ | 去噪后蛋白序列 |

#### 1.2.3 训练数据

f 预训练固定使用 UniRef50 数据集：

| 数据集 | 样本量 | 用途 | 链接 |
|--------|--------|------|------|
| **UniRef50** | 原始 FASTA 60,315,044 条；按当前配置（min_len=32, max_len=512）过滤后有效 60,011,545 条（train 59,411,442 / val 300,077 / test 300,026） | 通用蛋白序列语言预训练 | https://www.uniprot.org/uniref/ |

当前代码与本机数据路径（已下载/已缓存）：
- 原始下载文件：`/mnt/ai4g_ceph/private/maruhuang/tzuhanzhou/data/uniref50/uniref50.fasta`（同目录含 `uniref50.fasta.gz`）
- 训练缓存目录：`/mnt/ai4g_ceph/private/maruhuang/tzuhanzhou/codes/seq_generation/data/uniref50/cache/esm2_t30_150M_UR50D`

### 1.3 模块二：g(t, xₜ, y) — 条件引导网络

#### 1.3.1 模块作用

g 是系统的**可控性核心**。在 f 已经训练好的前提下，g 学习的是"在 f 的无条件 score 基础上，应当朝哪个方向修正才能让序列满足条件 y"。

在数学上：

$$
g(t, x_t, y) \;\approx\; \nabla_{x_t} \log p_t(y \mid x_t)
$$

即"给定当前加噪序列 xₜ 满足条件 y 的对数似然梯度"。这是一个**关于 xₜ 的可微函数**——只要 y 通过一个可微映射 f_g(x) 给出（可以是分类头、回归头、神经网络任意层），g 就能在反向传播时拿到梯度。

**因此 g 标签的取值范围非常宽**：
- 离散二/多分类（可溶/不溶、致病/良性、EC 号）
- 连续回归（Tm、ΔΔG、log Kd、kcat、fitness score）
- 多标签向量（GO terms、亚细胞定位、MHC 等位）
- 稀疏二值集合（包含信号肽、二硫键、跨膜区等）
- 以另一序列/结构为条件（binder 设计、伴侣设计）

#### 1.3.2 模型输入输出

| 输入 | 说明 |
|------|------|
| 加噪序列 xₜ | 与 f 模块共享的离散 token 序列 |
| 条件标签 y | 由数据集定义（标量 / 向量 / 序列 / 结构） |

| 输出 | 说明 |
|------|------|
| Score 修正项 | 与 f 同维度的向量，表示序列空间的修正方向 |

#### 1.3.3 训练策略

- **冻结 f 的权重**，只训练 g 的参数
- g 的多任务版本（M-Task g）以多任务学习的方式同时接受多个 y 维度的训练，损失为各任务损失加权和
- g 在训练时接收与 f 同分布的加噪输入 xₜ，预测目标是"加上 y 标签后序列的去噪方向"
- 推理时 h = f + g(或 λ·g)，λ 为引导强度

### 1.4 模块三：h = f + g — 可控采样引擎

#### 1.4.1 模块作用

h 模块是**实际使用时的采样引擎**，本身不需要额外训练——只需将预训练好的 f 和 g 组合即可。

**采样流程**（以"wt_seq 出发，编辑到目标条件 y"为例）：

1. **初始化**：从野生型序列 wt_seq 出发。
2. **引导去噪**：用组合 score h = f + g(y) 进行多步去噪。其中 f 负责保持序列的语法合理性，g(y) 负责朝目标条件方向修正。
3. **输出**：经过若干步去噪后，得到既保留 wt_seq 骨架、又满足条件 y 的新序列。

**单目标引导**与多目标引导共用同一采样引擎——通过调整 g 的输入 y 和强度系数实现不同任务（详见 1.5 节数学原理）。

#### 1.4.2 应用场景

| 场景 | 输入 | 输出 |
|------|------|------|
| 蛋白质工程 | wt_seq + 目标条件 y | 满足 y 的变体序列 |
| 跨物种迁移 | wt_seq + 目标物种标签 | 适配目标物种的同源序列 |
| 稳定性优化 | wt_seq + "高稳定"标签 | ΔΔG 改善的变体 |
| 酶活性优化 | wt_seq + "高 kcat"标签 | 酶活改善的变体 |
| 多属性联合 | wt_seq + (y₁, y₂, …) | 多目标折中序列 |

### 1.5 方法数学原理 — Classifier Guidance

本节给出 h = f + g 策略的数学依据。整个推导建立在 score-based 生成模型与贝叶斯定理之上。

#### 1.5.1 从贝叶斯定理到 Score 分解

设蛋白序列为 $x$，在时刻 $t$ 的加噪序列为 $x_t$，目标条件为 $y$。扩散/流匹配模型生成样本的本质是学习一个 **score function**：

$$
s(t, x_t) \;=\; \nabla_{x_t} \log p_t(x_t)
$$

即"在序列空间中，应当朝哪个方向去噪"。

对**条件生成** $p_t(x_t \mid y)$，由贝叶斯定理：

$$
p_t(x_t \mid y) \;=\; \frac{p_t(x_t)\, p_t(y \mid x_t)}{p(y)}
$$

对 $x_t$ 取梯度（$p(y)$ 与 $x_t$ 无关，求导为零）：

$$
\nabla_{x_t} \log p_t(x_t \mid y) \;=\; \nabla_{x_t} \log p_t(x_t) \;+\; \nabla_{x_t} \log p_t(y \mid x_t)
$$

**关键结论**：
> **条件 score = 无条件 score + 分类器梯度**

这正是 **Dhariwal & Nichol (2021) Classifier Guidance** 的数学基础。

#### 1.5.2 本项目 f / g / h 与上述分解的对应

| 记号 | 物理含义 | 数学对应 |
|------|----------|----------|
| $f(t, x_t)$ | 蛋白生成基础模型 | $\nabla_{x_t} \log p_t(x_t)$，学的是"蛋白序列的无条件 score" |
| $g(t, x_t, y)$ | 条件引导网络 | $\nabla_{x_t} \log p_t(y \mid x_t)$，学的是"给定序列它是否满足条件 y"的分类器梯度 |
| $h = f + g$ | 可控采样引擎 | $\nabla_{x_t} \log p_t(x_t \mid y)$，是 f 与 g 的简单加和 |

即：

$$
\boxed{\, h(t, x_t, y) \;\approx\; \nabla_{x_t} \log p_t(x_t \mid y) \;=\; f(t, x_t) + g(t, x_t, y)\,}
$$

**工程意义（扩散模型类比）**：在上述 Classifier Guidance 图景中，f 一次训练好后冻结，g 只需要学习“在无条件 score 的基础上，应当朝哪个方向修正”。从容量分工看，f 负责蛋白序列语言规律与全局先验，通常需要更大的模型容量；g 负责条件引导方向，对表征能力的需求相对更小。因此可以用“大 f + 小 g”作为直观设计思路：先训练高容量 f 并冻结，再训练轻量 g，推理时以 $h = f + \lambda g$ 表示组合引导。

> **Note（数学类比与代码实现的边界）**：本节刻意使用读者更熟悉的连续 diffusion / Classifier Guidance 形式解释 f、g、h，仅用于辅助理解条件先验与条件修正的分工，并不表示当前 BFN/DFM 代码显式学习连续 score 或分类器梯度。实际实现中，网络预测 clean sequence 的 token logits/probability；baseline、pretrain 与 finetune 使用单个条件生成网络，只有 residual setting 显式计算 `base_logits + residual_logits`。因此 residual logits 只能视为条件修正量的工程类比，不能严格等同于 $\nabla_{x_t}\log p_t(y\mid x_t)$。本项目当前实现也不是 Ho & Salimans (2022) 的标准 Classifier-Free Guidance。

#### 1.5.3 在离散流匹配 (DFM) 框架下的对应

本项目采用 **Discrete Flow Matching (DFM)** 或 **Bayesian Flow Network (BFN)** 作为生成框架——它们是 score-based 方法在离散序列空间上的对应物。score 的具体形式略有不同：

- 状态空间：$K$ 个氨基酸 token，序列长度 $L$
- $x_t$ 是一个 $L \times K$ 的概率分布矩阵（每行是该位置氨基酸的归一化分布）
- $f$、$g$ 的输出是该分布的"流速度"或"对数转移方向"
- 贝叶斯分解的**逻辑结构**（无条件 score + 分类器梯度 = 条件 score）**完全成立**

也就是说，连续空间推导出的"score 可加性"，在离散流匹配下转化为"概率分布修正量的可加性"，工程实现与连续情形一致。BFN 的 ELBO 训练目标和 DFM 的 flow matching 损失，都允许 score-based 的分解形式直接套用。

#### 1.5.4 关键假设的边界与工程缓解

| 假设 | 严格性 | 实际偏离 | 缓解策略 |
|------|--------|----------|----------|
| **g 标签 y 通过可微映射给出** | 工程前提 | 部分任务 y 本身离散（如物种 ID），但 f_g(x) → y_pred 是可微分类头 | 在分类头之前用 softmax，连续化标签分布 |
| **f 充分学习 $p_t(x_t)$** | 训练充分性 | 大模型可能欠拟合 | 在多个下游任务上检验 f 的覆盖率 |

**总结**：在连续 diffusion 的 Classifier Guidance 类比下，h = f + g 可由条件 score 分解得到；在本项目中，该分解用于解释“大 f + 小 g”的容量分工，而不是对 BFN/DFM 代码对象的严格数学等同。实际实现与适用边界以上述 Note 为准。条件独立性的要求只在多个 g 联合引导时出现，单 g 引导不受此限制。

---

## 二、f 预训练专项

> **本节口径**：f 仅保留无条件模式，在 UniRef50 上进行预训练。本节按 BFN、DFM-abs 与 DFM-uni 三条主线组织，只保留关键设定和当前可复用结论。

### 2.1 BFN 预训练

#### 2.1.1 核心模型设定

- **Backbone**：DiT 架构
- **Time embedding 注入方式**：add（time embedding 与 token hidden state 直接相加）。参考其他类似序列生成项目经验，`add`、`cross attention`、`adaLN-Zero` 三种方式中，`add` 与 `cross attention` 通常表现更好；考虑到显存开销与 `cross attention` 模块的可拓展性成本，当前选择 `add`。同时，已有经验显示该模块的具体注入形式通常不是性能的主导因素。
- **初始化方式**：加载 ESM 预训练参数初始化 DiT
- **规模规划**：35M / 150M / 650M
- **日志目录**：`logs/base_models/uniref50_bfn_dit35m`、`logs/base_models/uniref50_bfn_dit150m`、`logs/base_models/uniref50_bfn_dit650m`
- **当前训练状态说明**：受算力限制，上述规模当前均未完全收敛，现阶段结果主要用于 proof of concept；后续正式训练应进一步增大 batch size（或等效总 batch size）以提升训练稳定性与收敛质量。

##### 2.1.1.1 训练配置与当前进度

三个规模共用以下训练配置：

| 配置项 | 取值 |
|--------|------|
| 生成框架 | BFN（`beta=1.0`，`loss_func=l_infty_decay`） |
| 优化器 | AdamW，peak lr `5e-4`，weight_decay `1e-12`，amsgrad |
| 学习率调度 | PolyNomialLR（warmup 500 step，`power=0.3`，衰减至 `lr_end=1e-5`） |
| 精度 / 梯度裁剪 | bf16-mixed；grad clip norm `1.0` |
| max_steps / 验证间隔 | `1.5M` / 每 `4096` step 验证一次 |
| tokenizer / 长度 | ESM2 t30-150M（`min_len=32`，`max_len=512`） |
| 批构造 | 按 token 分桶采样（`bucket_size=2048`，`max_batch_size=192`） |

各规模的架构、初始化与当前训练进度：

| 规模 | DiT（blocks × hidden，heads） | 初始化 | max_tokens/批 | grad accum | 已训进度 | 最优 val/loss |
|------|------------------------------|--------|--------------:|-----------:|----------|--------------:|
| 35M | 12 × 480，20 | ESM2 t12-35M | 131072 | 1 | ≈1.07M step / 27 ep（best ckpt `step966656`） | 8.9458 |
| 150M | 30 × 640，20 | ESM2 t30-150M | 32768 | 1 | ≈0.86M step / 13 ep（best ckpt `step544768`） | 8.8973 |
| 650M（run1） | 33 × 1280，20 | ESM2 t33-650M | 8192 | 1 | ≈0.14M step（< 1 ep） | 9.1952 |
| 650M（run2，续训） | 同上 | run1 续训 | 8192 | 4 | ≈48k step（< 1 ep） | 9.1602 |

说明：BFN 的 `val/loss`（`l_infty_decay`）与 DFM 的 CE loss 量纲不同，两条主线不可直接横比，此处数值仅用于 BFN 组内比较。150M 最优 val/loss（8.8973）低于 35M（8.9458），与 2.1.3 的 scaling 结论一致；650M 因当前仅训练不到 1 个 epoch（step 数远少于 35M/150M）尚处欠拟合，其 val/loss 偏高属预期，不代表规模劣势。run2 在 run1 基础上将梯度累积提升到 4（等效 batch ×4）以增强稳定性。训练时记录的 `val/mean_plddt` 为阶段性前向填充值、且采用早期 Langevin 少步采样，可靠性有限，pLDDT 走势以 2.1.4 配图为准，不在此列出。

#### 2.1.2 采样策略对比结论

**最终结论**：综合来看，**ode 提供了最可控、最可复现的编辑行为**——其 TM-score 随编辑强度 t 整体清晰回归 query，t0.9 达 0.943，且对步数不敏感（100≈200，可用更低成本）。RMSD 的单点最优值来自 SDE-100（0.327），因此不能称 ODE 的 TM-score 与 RMSD 均为四者最优。Langevin 虽然在纯 de novo 场景下可折叠性略高（500 步 pLDDT≈63），但其随机混合在高步数下会破坏 query 对应关系（t0.9 TM-score 从 0.72 跌到 0.33），不适合以 WT 为起点的编辑任务。因此采样默认策略已从早期的 **Langevin** 切换为 **ODE**（当前默认，推荐 steps=100–200）；Langevin/SDE/r_ode 保留为对照实验选项。完整搜索参数、逐 t 结果表和运行完整性说明见[附录 A](#appendix-a)。

#### 2.1.3 Scaling 观察（当前阶段）

基于 `logs/base_models` 的 35M/150M/650M 训练记录：

- 在当前可用训练记录下，35M 与 150M 均表现出稳定下降趋势；
- 150M 的最优训练 loss 低于 35M，说明增大规模带来可见收益；
- 650M 已出现较低的阶段性最优值，但现阶段训练步数相对不足，末段仍有波动，后续需要更长训练预算验证稳定收敛区间。
- 650M 当前有效训练步数和 epoch 数明显少于 35M/150M，且单步 token 预算更小，因此现阶段不能比较其最终收敛速度或规模收益。

#### 2.1.4 Training loss 配图（BFN，EMA 平滑）

![BFN f pretraining training loss with EMA smoothing](figures/f_pretrain_train_loss_bfn_ema09999_std5000.png)

图说明：展示 BFN DiT-35M 与 DiT-150M 的 `train/loss` 随 `global_step` 的变化。实线使用 EMA 平滑，权重为 `0.9999`（当前值权重为 `0.0001`）；同色阴影为原始训练 loss 在最近 5000 个记录点上的滑动 `±1 std`。为同时保留训练初期的高损失与放大收敛阶段的细微变化，y 轴采用断轴：上段为 `10.00–12.60`，下段为 `8.50–9.60`；图中未包含 DiT-650M 的两个 run。

#### 2.1.5 Validation loss 与 pLDDT 配图（BFN 分组，左右排列）

| Validation loss | pLDDT |
|---|---|
| ![f pretraining validation loss curves for BFN with unified axes](figures/f_pretrain_val_loss_bfn_unified_axes.png) | ![f pretraining pLDDT curves for BFN with unified axes](figures/f_pretrain_plddt_bfn_unified_axes.png) |

图说明：左图比较 BFN 组内 35M、150M、650M 的 `val/loss` 曲线（y 轴为 log scale）；右图展示 BFN 组内 `val/mean_plddt` 曲线（线性坐标）。两图均为组内统一坐标轴，其中 650M 仅使用指定 run 的 `global_step <= 15360` 数据。训练阶段用于生成验证样本并计算 pLDDT 时沿用的是早期默认 Langevin 采样，且采样步数更少；当前下游默认采样已切换为 ODE，因此两者性能存在轻微差异，不做严格一一对应。

### 2.2 DFM-abs 预训练

#### 2.2.1 核心模型设定

- **Backbone**：DiT 架构
- **Time embedding 注入方式**：add
- **初始化方式**：加载 ESM 预训练参数初始化 DiT
- **规模规划**：35M / 150M / 650M（当前已完成 35M 与 150M）
- **日志目录**：`logs/base_models/uniref50_dfm_absorbing_dit35m`、`logs/base_models/uniref50_dfm_absorbing_dit150m`

##### 2.2.1.1 训练配置与当前进度

两个规模共用以下训练配置：

| 配置项 | 取值 |
|--------|------|
| 生成框架 | DFM-abs（absorbing 转移，`loss_type=ce`，`kld=false`） |
| 优化器 / 调度 | AdamW，peak lr `5e-4`，weight_decay `1e-12`，amsgrad；PolyNomialLR（warmup 500 / power 0.3 / lr_end 1e-5） |
| 精度 / 梯度裁剪 | bf16-mixed；grad clip norm `1.0` |
| max_steps / 验证间隔 | `1.5M` / 每 `4096` step 验证一次 |
| tokenizer / 长度 | ESM2 t30-150M（`min_len=32`，`max_len=512`） |

各规模的架构、初始化与当前训练进度：

| 规模 | DiT（blocks × hidden，heads） | 初始化 | max_tokens/批 | grad accum | 已训进度 | 最优 val/loss（CE） |
|------|------------------------------|--------|--------------:|-----------:|----------|--------------------:|
| 35M | 12 × 480，20 | ESM2 t12-35M | 131072 | 1 | ≈0.93M step / 24 ep | 1.3107 |
| 150M | 30 × 640，20 | ESM2 t30-150M | 32768 | 1 | ≈0.59M step / 9 ep（best ckpt `step557056`） | **1.2907** |

说明：DFM-abs 的 CE loss 与 BFN 的 `l_infty_decay` loss 量纲不同，1.29–1.31 不能与 BFN 的 ~8.9 直接比较；两条主线的对比应基于下游生成 / 结构指标而非训练损失绝对值。150M 最优 val/loss（1.2907）低于 35M（1.3107），与 BFN 侧 scaling 结论一致；150M best ckpt 处的验证记录另有 val/acc≈0.5979、val/mean_aar≈0.0759、val/mean_aa_kl≈0.1833、val/mean_plddt≈57.16，其中训练阶段 pLDDT 采用早期少步采样、可靠性有限，仅供组内参考。

#### 2.2.2 当前结果与后续推进

- 当前 DFM-abs 路线受计算资源限制完成了一版 35M 与 150M 阶段性训练，可用于 proof of concept 和组内诊断；
- 150M 最优 val/loss 低于 35M，呈现阶段性的 scaling 信号，但现有 checkpoint 不视为正式充分训练版本；
- 若后续正式使用，应增加资源重新充分训练 35M/150M，并扩展到 650M，再在 DFM-abs 组内统一比较。

#### 2.2.3 Training loss 配图（DFM-abs，EMA 平滑）

![DFM-abs f pretraining training loss with EMA smoothing](figures/f_pretrain_train_loss_dfm_ema09999_std5000.png)

图说明：展示 DFM-abs DiT-35M 与 DiT-150M 的 `train/loss` 随 `global_step` 的变化。实线使用 EMA 平滑，权重为 `0.9999`（当前值权重为 `0.0001`）；同色阴影为原始训练 loss 在最近 5000 个记录点上的滑动 `±1 std`。为同时保留训练初期的快速下降与放大收敛阶段的细微变化，y 轴采用断轴：上段为 `1.40–2.10`，下段为 `1.27–1.39`；图中未包含尚未训练的 DiT-650M。DFM-abs 的 CE loss 与 BFN 的 `l_infty_decay` loss 量纲不同，因此两张训练损失图不进行绝对值横向比较。

#### 2.2.4 Validation loss 与 pLDDT 配图（DFM-abs 分组，左右排列）

| Validation loss | pLDDT |
|---|---|
| ![f pretraining validation loss curves for DFM-abs with unified axes](figures/f_pretrain_val_loss_dfm_unified_axes.png) | ![f pretraining pLDDT curves for DFM-abs with unified axes](figures/f_pretrain_plddt_dfm_unified_axes.png) |

图说明：左图展示 DFM-abs 分组的 `val/loss` 曲线（y 轴为 log scale），右图展示 `val/mean_plddt` 曲线（线性坐标）；两图均采用组内统一坐标轴。训练阶段用于生成验证样本并计算 pLDDT 时沿用的是早期默认 Langevin 采样，且采样步数更少；当前下游默认采样已切换为 ODE，因此两者性能存在轻微差异，不做严格一一对应。35M 与 150M 结果已纳入，待 DFM-abs-650M 结果补齐后可扩展组内 scale 对比。

### 2.3 DFM-uni 预训练

#### 2.3.1 核心模型设定

- **Backbone**：DiT 架构
- **Time embedding 注入方式**：add
- **初始化方式**：加载 ESM 预训练参数初始化 DiT
- **规模规划**：35M / 150M / 650M（当前 35M 与 150M 均在训练中）
- **日志目录**：`logs/base_models/uniref50_dfm_uniform_dit35m`、`logs/base_models/uniref50_dfm_uniform_dit150m`
- **当前训练状态说明**：35M 与 150M 均未完全收敛；本节训练曲线和进度均截至 8 月 4 日 18:35，仅用于阶段性诊断。

##### 2.3.1.1 训练配置与当前进度

两个规模共用以下训练配置：

| 配置项 | 取值 |
|--------|------|
| 生成框架 | DFM-uni（uniform 转移，`loss_type=ce`，`kld=false`） |
| 优化器 / 调度 | AdamW，peak lr `5e-4`，weight_decay `1e-12`，amsgrad；PolyNomialLR（warmup 500 / power 0.3 / lr_end 1e-5） |
| 精度 / 梯度裁剪 | bf16-mixed；grad clip norm `1.0` |
| max_steps / 验证间隔 | `1.5M` / 每 `4096` step 验证一次 |
| tokenizer / 长度 | ESM2 t30-150M（`min_len=32`，`max_len=512`） |

各规模的架构、初始化与截至 8 月 4 日 18:35 的训练进度：

| 规模 | DiT（blocks × hidden，heads） | 初始化 | max_tokens/批 | grad accum | 已训进度 | 最优 val/loss（CE） |
|------|------------------------------|--------|--------------:|-----------:|----------|--------------------:|
| 35M | 12 × 480，20 | ESM2 t12-35M | 131072 | 1 | ≈0.086M step / 2 ep（best ckpt `step73728`） | 1.6509 |
| 150M | 30 × 640，20 | ESM2 t30-150M | 32768 | 1 | ≈0.066M step / 1 ep（best ckpt `step65536`） | **1.6429** |

说明：DFM-uni 的 CE loss 与 BFN 的 `l_infty_decay` loss 量纲不同，不能与 BFN 的 ~8.9 直接比较；DFM-uni 与 DFM-abs 使用不同 transition，当前均应优先基于下游生成 / 结构指标比较。150M 的当前最优 val/loss（1.6429）低于 35M（1.6509），但两者训练步数和 epoch 数均较少且不一致，不能据此作出稳定的 scaling 结论。最优 checkpoint 处，35M 的 val/acc≈0.5542、val/mean_aar≈0.0808、val/mean_aa_kl≈0.1749、val/mean_plddt≈56.30；150M 分别为 ≈0.5556、≈0.0825、≈0.1787、≈56.40。训练阶段 pLDDT 采用早期少步采样，可靠性有限，仅供组内参考。

#### 2.3.2 当前结果与后续推进

- 截至 8 月 4 日 18:35，35M 与 150M 分别仅完成约 0.086M 与 0.066M step，远未达到 `1.5M` step 的训练预算，尚未完全收敛；
- 两个规模的验证 loss 均仍处于阶段性下降区间，150M 的当前最优值略低于 35M，但现阶段不能视为正式的规模比较结论；
- 后续应继续训练 35M/150M 至稳定收敛区间，并补齐 650M 后在 DFM-uni 组内统一比较。

#### 2.3.3 Training loss 配图（DFM-uni，EMA 平滑）

![DFM-uni f pretraining training loss with EMA smoothing](figures/f_pretrain_train_loss_dfm_uni_ema09999_std5000.png)

图说明：展示截至 8 月 4 日 18:35 的 DFM-uni DiT-35M 与 DiT-150M `train/loss` 随 `global_step` 的变化。实线使用 EMA 平滑，权重为 `0.9999`（当前值权重为 `0.0001`）；同色阴影为原始训练 loss 在最近 5000 个记录点上的滑动 `±1 std`。为同时保留训练初期的快速下降与当前阶段的细微变化，y 轴采用断轴：上段为 `1.85–2.10`，下段为 `1.50–1.82`。两条曲线均尚未收敛，不应视为最终训练结果。

#### 2.3.4 Validation loss 与 pLDDT 配图（DFM-uni 分组，左右排列）

| Validation loss | pLDDT |
|---|---|
| ![f pretraining validation loss curves for DFM-uni with unified axes](figures/f_pretrain_val_loss_dfm_uni_unified_axes.png) | ![f pretraining pLDDT curves for DFM-uni with unified axes](figures/f_pretrain_plddt_dfm_uni_unified_axes.png) |

图说明：左图展示截至 8 月 4 日 18:35 的 DFM-uni `val/loss` 曲线（y 轴为 log scale），右图展示同一时间截面的 `val/mean_plddt` 曲线（线性坐标）；两图均采用组内统一坐标轴。训练阶段用于生成验证样本并计算 pLDDT 时沿用的是早期默认 Langevin 采样，且采样步数更少；当前下游默认采样已切换为 ODE，因此两者性能存在轻微差异，不做严格一一对应。35M 与 150M 均未完全收敛，待继续训练并补齐 DFM-uni-650M 结果后再作组内 scale 对比。

---

## 三、g 函数在各数据集的训练和评测表现

> **本节口径**：正文只报告已开展数据集的关键结果、可信度边界和下一步。评估方法、完整表格、训练曲线解读及诊断过程统一收录于[附录 B](#appendix-b)。目前 ProteinGYM、FireProtDB 与 Ortlund 已有阶段性结果；MaveDB、OMA、DeepGOPlus 与 Multiplex peptide 的后续规划见[第六节](#future-work)。

### 3.1 通用实验设定与指标口径

所有已完成任务统一比较四种 g 参数化方式，顺序为 baseline、pretrain、finetune、residual：

| Setting | 核心定义 |
|---------|----------|
| **baseline** | ESM2 初始化的单网络直接预测生成目标，全部权重可训练 |
| **pretrain** | 加载 f 预训练生成器作为初始化，但与 finetune 不同，训练时全部权重可训练 |
| **finetune** | 加载 f 预训练生成器并冻结 backbone，仅训练条件注入部分 |
| **residual** | 在冻结的 f 先验上叠加可训练残差网络 |

> **DFM transition setting**：DFM 按 f 预训练与下游生成使用的 transition 区分为 `DFM-abs`、`DFM-uni` 和 `DFM-abs2uni`。其中 `DFM-abs2uni` 使用 `absorbing` f checkpoint 与 `uniform` 下游 transition，是独立的跨 transition transfer setting。baseline 不加载 f checkpoint，因此只按下游 transition 标记为 `DFM-abs-baseline` 或 `DFM-uni-baseline`，不设置 `DFM-abs2uni-baseline`；pretrain 加载 f checkpoint 后进行全参数训练。

| DFM 标记 | f 预训练 transition | 下游 transition | 参数化子类 |
|----------|---------------------|-----------------|------------|
| **DFM-abs** | baseline 不加载；pretrain / finetune / residual 为 absorbing | absorbing | baseline / pretrain / finetune / residual |
| **DFM-uni** | baseline 不加载；pretrain / finetune / residual 为 uniform | uniform | baseline / pretrain / finetune / residual |
| **DFM-abs2uni** | absorbing | uniform | finetune / residual |

连续性质任务的外部 predictor 比较 `delta` 与 `joint`；最终结论优先采用 held-out 实验标签或经独立验证可靠的 predictor。所有生成 checkpoint 均按最低 `val/loss` 选择；除明确标注的 rank-0 test 结构指标外，结构指标取同一验证记录。正文从三个层面报告 metric：

- **条件遵循**：MSE、RMSE、MAE 衡量生成性质值与目标值之间的误差大小；Pearson 衡量线性响应，Spearman 衡量目标排序是否被保留。误差越低、相关性越高越好。
- **可评估覆盖**：`evaluable rate` 表示全部生成序列中可由实验表或可靠评估器评分的比例；`hit rate` 表示生成编辑中实际命中实验记录的比例，具体分母随任务查表口径单独说明。误差和相关性必须结合这两个覆盖指标解读。
- **生成与结构质量**：`val/loss` 衡量生成目标上的验证损失；pLDDT、pTM、TM-score 与 RMSD 衡量预测结构质量或相对 query 的结构保持程度。它们不能替代性质条件遵循指标。

粗体仅标记同一口径下的最佳值；当可评估样本过少时，相关性只作描述，不据此排序。详细定义见[附录 B.1](#appendix-b-1)。

### 3.2 ProteinGYM DMS 变异预测

**任务目标**：根据目标 fitness z-score 编辑序列，并检验生成序列的预测 fitness 是否随目标值变化。

**评估器质量**：外部 predictor 自身先在独立 test split 上验证。`delta` 的排序能力显著优于 `joint`，因此生成结果统一由 `delta` checkpoint 评分。BFN 的 baseline / pretrain / finetune / residual、DFM-uni-baseline、DFM-abs-baseline / pretrain / finetune / residual 以及 DFM-abs2uni-finetune / residual 均纳入统一 setting 矩阵；其中 DFM-uni-pretrain 和 DFM-uni-finetune / residual 的具体性能待补。

| Predictor | val best Spearman ↑ | test Spearman ↑ | 判定 |
|-----------|--------------------:|----------------:|------|
| delta | **0.812** | **0.813** | 强排序信号，可用于条件遵循评估 |
| joint | 0.022 | 0.022 | 接近无信号，不采用 |

**生成评估口径**：对每个已完成 setting 各 8,000 条生成序列评分（8 个 rank 文件 × `BUDGET_N=1000` 长度分层抽样）。误差定义为 `|score_pred_z - query_fields.score|`；MAE/RMSE 的单位均为 assay 内标准差。`within τ` 表示绝对误差不超过 τ 的样本比例，Median AE 与 Q75 AE 分别描述典型误差和误差分布上四分位；`零编辑占比` 为生成序列与 `query_seq`（WT）完全一致的样本比例。已完成 setting 使用同一 predictor 和抽样口径，可直接进行阶段性横向比较；尚未完成的 setting 以 `[待补充]` 标记。

| Setting | MAE ↓ | RMSE ↓ | Median AE ↓ | Q75 AE ↓ | within 0.25 ↑ | within 0.5 ↑ | within 1.0 ↑ | Pearson ↑ | Spearman ↑ | 零编辑占比 ↓ |
|---------|------:|-------:|------------:|---------:|--------------:|-------------:|-------------:|----------:|-----------:|------------:|
| BFN-baseline | 0.5993 | 0.8791 | 0.3936 | 0.8492 | 37.33% | 57.65% | 79.99% | 0.5562 | 0.5915 | **0.33%** |
| BFN-pretrain | 0.5987 | 0.8772 | 0.3957 | 0.8570 | 36.51% | 57.96% | 80.01% | 0.5716 | 0.6005 | 0.99% |
| BFN-finetune | 0.6881 | 0.9736 | 0.4883 | 0.9933 | 32.12% | 50.96% | 75.26% | 0.4552 | 0.4826 | 2.31% |
| BFN-residual | 0.5983 | 0.8690 | 0.4037 | 0.8488 | 36.68% | 57.04% | 80.03% | 0.5805 | 0.6122 | 6.04% |
| DFM-abs-baseline | 0.4617 | 0.7143 | 0.2724 | 0.6355 | 47.15% | 67.65% | 87.25% | 0.7101 | 0.7471 | 0.38% |
| DFM-abs-pretrain | 0.4888 | 0.7334 | 0.3023 | 0.6826 | 44.24% | 64.94% | 85.85% | 0.6943 | 0.7215 | **0.26%** |
| DFM-abs-finetune | 0.5718 | 0.8477 | 0.3690 | 0.8131 | 38.41% | 59.33% | 81.86% | 0.5948 | 0.6316 | 1.35% |
| DFM-abs-residual | **0.4456** | **0.6726** | **0.2707** | **0.6144** | **47.45%** | **68.91%** | **88.43%** | **0.7406** | **0.7643** | 1.84% |
| DFM-uni-baseline | 0.5172 | 0.7701 | 0.3401 | 0.7297 | 40.91% | 62.19% | 85.02% | 0.6616 | 0.6997 | 7.11% |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 0.5963 | 0.8650 | 0.3997 | 0.8600 | 36.29% | 56.43% | 80.23% | 0.5996 | 0.6369 | 8.88% |
| DFM-abs2uni-residual | 0.4992 | 0.7409 | 0.3309 | 0.6993 | 41.61% | 63.94% | 85.95% | 0.6862 | 0.7246 | 4.48% |

- BFN 已完成的 baseline / pretrain / finetune / residual 的 Pearson / Spearman 排序为 residual > pretrain > baseline > finetune，四个 setting 均呈显著正相关；其中 pretrain（0.5716 / 0.6005）介于 residual 与 baseline 之间。
- 当前已完成的 DFM setting 中，DFM-abs-residual 的误差最低、相关性最高（MAE 0.4456，Pearson 0.7406，Spearman 0.7643），除零编辑占比外的九列指标均为当前矩阵最优；DFM-abs-baseline 紧随其后（0.4617 / 0.7101 / 0.7471），DFM-abs-pretrain 再次之（0.4888 / 0.6943 / 0.7215），DFM-abs2uni-residual（0.4992 / 0.6862 / 0.7246）与 DFM-uni-baseline 随后。DFM-abs 组内排序为 residual > baseline > pretrain > finetune。
- DFM-abs-finetune 的 MAE、RMSE、within 0.25 和零编辑占比优于各已完成 BFN setting，Pearson / Spearman 高于 BFN-finetune、低于 BFN-baseline / residual；因此不能表述为“全面优于 BFN”。
- 对 DFM-abs-residual 的 Spearman 0.7643 以 predictor reliability 0.813 作近似去衰减，点估计约为 0.94；这一估计受 Spearman 近似和生成分布漂移限制（见[附录 B.2.7](#appendix-b-2-7)）。
- `零编辑占比`在已记录 DFM 结果中为 DFM-abs-pretrain 0.26%、DFM-abs-baseline 0.38%、DFM-abs-finetune 1.35%、DFM-abs-residual 1.84%、DFM-abs2uni-residual 4.48%、DFM-uni-baseline 7.11%、DFM-abs2uni-finetune 8.88%；BFN baseline、pretrain、finetune、residual 分别为 0.33%、0.99%、2.31%、6.04%。

完整 predictor 对比与目标分桶结果见[附录 B.2](#appendix-b-2)。

### 3.3 FireProtDB 热稳定性预测

**任务目标**：按目标 ΔΔG 编辑 WT 序列，并以 FireProtDB test split 的实验 ΔΔG 直接评估生成突变。

**评估器质量**：先在 FireProtDB 的独立 test split 上验证外部 ΔΔG predictor。`delta` 的 test Spearman/Pearson 仅为 0.147/0.154，`joint` 进一步降至 0.092/0.049；两者都不足以对未测生成序列提供可靠的绝对性质评分。因此，FireProtDB 最终评估不使用 predictor 外推，而采用真实实验 ΔΔG 的严格查表法。该选择针对的是评估器可靠性，不代表生成模型本身性能不佳。

| Predictor | val best Spearman ↑ | test Spearman ↑ | test Pearson ↑ | 判定 |
|-----------|--------------------:|----------------:|----------------:|------|
| delta | 0.173 | **0.147** | **0.154** | 相关性偏弱，不作为最终裁判 |
| joint | 0.190 | 0.092 | 0.049 | 过拟合且几乎无稳定信号，不采用 |

**训练 metric**：所有生成模型按最低 `val/loss` checkpoint 选择。验证损失衡量生成目标上的拟合，不能替代实验 ΔΔG 条件遵循评估。

| Setting | val/loss ↓ |
|---------|-----------:|
| BFN-baseline | 0.2017 |
| BFN-pretrain | 0.1959 |
| BFN-finetune | 0.2061 |
| BFN-residual | 0.1846 |
| DFM-abs-baseline | **0.0371** |
| DFM-abs-pretrain | 0.0466 |
| DFM-abs-finetune | 0.0484 |
| DFM-abs-residual | 0.0432 |
| DFM-uni-baseline | 0.0652 |
| DFM-uni-pretrain | [待补充] |
| DFM-uni-finetune | [待补充] |
| DFM-uni-residual | [待补充] |
| DFM-abs2uni-finetune | 0.0706 |
| DFM-abs2uni-residual | 0.0592 |

**实验 ΔΔG metric**：只有与 WT 等长、恰好 1 个替换且能在同一 FireProtDB test 表中唯一命中的序列参与 MSE、MAE、Pearson 和 Spearman 计算。`单编辑命中率` 的分母是单编辑序列数，`可评估率` 的分母是去重生成序列数；已完成实验查表的 setting 均有 544 条去重 test 序列。

| Setting | 恰好 1 编辑 | 单编辑命中率 ↑ | 可评估 N | 可评估率 ↑ | ΔΔG MSE ↓ | ΔΔG MAE ↓ | Pearson ↑ | Spearman ↑ |
|---------|------------:|----------------:|-----------:|-------------:|-----------:|-----------:|----------:|-----------:|
| BFN-baseline | 154（28.31%） | 11/154（7.14%） | 11 | 2.02% | 6.0278 | 1.6109 | -0.2704 | 0.0046 |
| BFN-pretrain | 116（21.32%） | 3/116（2.59%） | 3 | 0.55% | 0.5147 | 0.6533 | 0.4595 | 0.5000 |
| BFN-finetune | 152（27.94%） | 4/152（2.63%） | 4 | 0.74% | 1.0248 | 0.9400 | 0.7859 | 1.0000 |
| BFN-residual | 149（27.39%） | 8/149（5.37%） | 8 | 1.47% | 5.1669 | 1.8013 | -0.3150 | -0.4286 |
| DFM-abs-baseline | 125（22.98%） | 2/125（1.60%） | 2 | 0.37% | 4.9554 | 1.7700 | 1.0000 | 1.0000 |
| DFM-abs-pretrain | 169（31.07%） | 13/169（7.69%） | 13 | 2.39% | 2.1163 | 0.9869 | -0.0776 | -0.0865 |
| DFM-abs-finetune | 58（10.66%） | 2/58（3.45%） | 2 | 0.37% | 0.7897 | 0.8400 | 1.0000 | 1.0000 |
| DFM-abs-residual | 117（21.51%） | 2/117（1.71%） | 2 | 0.37% | 15.9250 | 3.1500 | -1.0000 | -1.0000 |
| DFM-uni-baseline | 124（22.79%） | 7/124（5.65%） | 7 | 1.29% | 8.0500 | 2.7286 | 0.1352 | 0.0000 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 85（15.63%） | 3/85（3.53%） | 3 | 0.55% | 0.7667 | 0.8667 | 0.8532 | 0.5000 |
| DFM-abs2uni-residual | 142（26.10%） | 11/142（7.75%） | 11 | 2.02% | 3.3567 | 1.4745 | -0.4158 | -0.4389 |

- 最终评估不采用外部 predictor，因为其 test Spearman/Pearson 仅为 0.147/0.154；正文只使用真实实验 ΔΔG 查表。
- DFM-abs 的 baseline / pretrain / finetune / residual 四个 setting 已纳入统一实验矩阵并全部完成训练、生成与查表；已完成 setting 的严格单编辑可评估样本仅 2–13 条，MSE/MAE 与相关性均为极小样本描述。
- 严格查表中现有 setting 的可评估样本仅 2–11 条，表中误差与相关性均为小样本描述。BFN-finetune 的 Spearman=1.0000（4 条）、DFM-abs2uni-finetune 的 Pearson=0.8532（3 条），以及已完成的 DFM-abs setting 的 |r|=|ρ|=1.0000（均 2 条）都来自极小样本，不能据此判定最优。
- 训练数据全部是单点突变，但两种框架的单编辑率均偏低。下一步应强制相对 WT 恰好 1 个替换，并同步提高单编辑率、查表命中率和全体可评估率。

完整训练表、查表规则、逐位拆解和编辑数分布见[附录 B.3](#appendix-b-3)。

### 3.4 Ortlund DMS IgG1Fc–FcγR 抗体亲和力

**任务目标**：根据 6 个 FcγR 受体的目标 `logKa` 谱编辑 WT Fc，并在突变位点不重叠的 held-out test split 上用 DMS 实测值评估。

**评估器质量**：先在按突变位点划分的独立 test split 上验证 6 维 `logKa` predictor。下表中的 Pearson/Spearman 是先按受体分别计算、再等权平均的 macro 指标；`delta` 的 test Spearman/Pearson 为 0.226/0.242，六个受体的 Spearman 仅为 0.122–0.283，`joint` 为 0.150/0.194。两种 predictor 都只能提供较弱的排序信号，难以作为未测生成序列的可靠连续性质裁判。因此，Ortlund 最终评估统一采用 DMS 实测 `logKa` 的严格查表法，而不是使用 predictor 对未测序列进行外推。该选择针对的是评估器可靠性，不代表生成模型本身性能不佳。

| Predictor | val best mean-receptor Spearman ↑ | test mean-receptor Spearman ↑ | test mean-receptor Pearson ↑ | 判定 |
|-----------|---------------------------------:|--------------------------------:|-------------------------------:|------|
| delta | 0.180 | **0.226** | **0.242** | 弱排序信号，不作为最终裁判 |
| joint | 0.210 | 0.150 | 0.194 | 验证集偶有信号，但 test 泛化较弱，不采用 |

**BFN 训练与结构 metric**：各指标均取最低 `val/loss` checkpoint 的同一验证记录。baseline 的结构相似性近乎完美，但后续 test 结果表明这主要来自 WT 回退，不能解释为条件控制更好。

| Setting | val/loss ↓ | pLDDT ↑ | pTM ↑ | TM-score ↑ | RMSD ↓ |
|---------|-----------:|--------:|------:|-----------:|-------:|
| BFN-baseline | 0.1407 | **75.74** | **0.7747** | **1.0000** | **0.0000** |
| BFN-pretrain | 0.1334 | 75.53 | 0.7696 | 0.9738 | 0.9115 |
| BFN-finetune | 0.1397 | 75.45 | 0.7650 | 0.9864 | 0.5958 |
| BFN-residual | **0.1317** | 75.61 | 0.7737 | 0.9864 | 0.5804 |

**新 DFM-abs 训练与结构 metric**：四个 setting 均使用 `absorbing` 下游 transition；pretrain / finetune 加载 absorbing DFM f checkpoint，其中 pretrain 全参数训练，finetune 冻结 backbone；residual 使用 absorbing DFM-150M base checkpoint。`val/loss` 用于选择 checkpoint；结构指标为所选 checkpoint 在 rank-0 test 分片上的记录，仅作生成质量参考。

| Setting | 最优 val/loss ↓ | 最优 checkpoint | rank-0 test pLDDT ↑ | pTM ↑ | TM-score ↑ | RMSD ↓ |
|---------|----------------:|-----------------|--------------------:|------:|-----------:|-------:|
| DFM-abs-baseline | **0.0231** | `best_loss_model_step432.ckpt` | 75.455 | 0.772 | 0.993 | 0.390 |
| DFM-abs-pretrain | 0.0272 | `best_loss_model_step648.ckpt` | 75.588 | 0.771 | 0.996 | 0.261 |
| DFM-abs-finetune | 0.0253 | `best_loss_model_step648.ckpt` | 75.654 | 0.774 | 0.997 | 0.205 |
| DFM-abs-residual | 0.0251 | `best_loss_model_step432.ckpt` | **75.688** | **0.775** | **0.998** | **0.144** |

**目标条件 held-out 评估口径**：目标突变来自按位点划分、未参与 checkpoint 选择的 test split；但评估脚本会在 train/val/test 合并后的完整 DMS 查找表中匹配生成编辑，因此这是目标条件 held-out，不代表所有被命中的生成编辑也严格来自 test split。`sequence weighted MSE/MAE` 先在每个编辑的有效受体维度上平均，再在同一生成序列的可查编辑间平均，最后对可评估序列平均；`pooled Spearman` 汇总全部有效的序列×受体配对，`mean receptor Spearman` 则先分别计算 6 个受体的 Spearman 再等权平均。`evaluable rate` 是至少含一个可查 DMS 编辑的生成序列比例，`hit rate` 是全部生成编辑位点中的 DMS 查表命中比例。BFN 与 DFM 均为 DiT-35M，采用同一评估脚本与同一批目标条件。

| Setting | MSE ↓ | MAE ↓ | pooled Spearman ↑ | mean receptor Spearman ↑ | seq identity ↑ | 可评估 N | evaluable rate ↑ | hit rate ↑ | 零/单/多编辑 |
|---------|------:|------:|------------------:|-------------------------:|---------------:|-----------:|-----------------:|-----------:|-------------:|
| BFN-baseline | 4.917 | 1.854 | -0.373 | -0.500 | **0.99998** | 3 | 0.34% | 3/4（75.0%） | 886/4/0 |
| BFN-pretrain | 1.900 | 0.990 | 0.079 | 0.075 | 0.99503 | 600 | 67.34% | 1019/1024（99.5%） | 288/304/296 |
| BFN-finetune | 1.153 | 0.778 | 0.291 | 0.274 | 0.99253 | 700 | 78.56% | 1535/1544（99.4%） | 188/292/411 |
| BFN-residual | 1.734 | 0.941 | 0.110 | 0.097 | 0.99387 | 672 | 75.42% | 1256/1267（99.1%） | 216/308/367 |
| DFM-abs-baseline | 2.019 | 1.042 | 0.028 | 0.021 | 0.99437 | 635 | 71.27% | 1150/1159（99.2%） | 249/313/326 |
| DFM-abs-pretrain | 1.096 | 0.744 | 0.473 | 0.449 | 0.99537 | 579 | 64.98% | 940/943（99.7%） | 311/325/254 |
| DFM-abs-finetune | 1.513 | 0.879 | 0.259 | 0.241 | **0.99314** | **638** | **71.60%** | 1406/1417（99.2%） | 248/317/325 |
| DFM-abs-residual | 1.290 | 0.816 | 0.356 | 0.338 | 0.99464 | 634 | 71.16% | 1104/1107（99.7%） | 256/314/321 |
| DFM-uni-baseline | 1.026 | 0.739 | 0.523 | 0.495 | 0.99646 | 482 | 54.10% | 728/731（99.6%） | 408/311/172 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | **0.711** | **0.573** | **0.658** | **0.632** | 0.99926 | 124 | 13.92% | 151/152（99.3%） | 764/110/15 |
| DFM-abs2uni-residual | 1.167 | 0.780 | 0.434 | 0.413 | 0.99813 | 311 | 34.90% | **386/386（100%）** | 580/243/68 |

注：BFN-baseline 有 1 条、BFN-pretrain 有 3 条、DFM-abs2uni-finetune 有 2 条、DFM-abs-baseline 有 3 条、DFM-abs-pretrain 有 1 条、DFM-abs-finetune 有 1 条长度不匹配，因此对应行的零/单/多编辑计数之和少于 891 条。

- Ortlund 已将 DFM-abs baseline / pretrain / finetune / residual 纳入四个 setting 的实验矩阵并全部完成训练、生成与评估。
- 在已完成的 DFM-abs setting 中，residual 的 held-out test 条件遵循最好（MSE 1.290、MAE 0.816、pooled Spearman 0.356），且六个受体的 Spearman 均为正；finetune 次之（0.259）。两者的可评估率均约 71%，高于 DFM-uni-baseline。
- DFM-abs-baseline 虽有 71.27% 可评估率和 99.2% 编辑查表命中率，但 pooled Spearman 仅 0.028，说明当前采样下几乎没有稳定的目标排序信号。
- 当前全部已完成 DFM setting 中，DFM-abs2uni-finetune 的 pooled Spearman 最高（0.658），DFM-uni-baseline 为 0.523，DFM-abs-residual 为 0.356；补齐 DFM-uni-finetune / residual 后可进一步进行受控的 transition 与参数化归因。
- BFN-baseline 的 99.4% test 输出未发生编辑，仅 3 条序列可评估；其高 `seq identity` 来自 WT 回退，误差与相关性不具统计可比性。下一步应补齐 DFM-uni-finetune / residual、增加随机种子，并加入相对 WT 的单点 edit budget 后复评。

完整数据口径、训练结果、val/overall 统计、逐受体结果和编辑行为见[附录 B.8](#appendix-b-8)。

### 3.5 g 训练综合对比

| 数据集 | 当前状态 | 正文结论 | 主要证据 |
|--------|----------|----------|----------|
| ProteinGYM | BFN 四 setting 全部完成；DFM-abs 四 setting（baseline / pretrain / finetune / residual）与 DFM-uni-baseline、DFM-abs2uni 两 setting 已完成；DFM-uni-pretrain / finetune / residual 的下游 g 实验仍未发现对应 run | 已完成 BFN 的连续 score 控制生效，内部排序 residual > pretrain > baseline > finetune；DFM-abs-residual 为当前已完成 DFM setting 中相关性最高者，DFM-abs-baseline 紧随其后 | BFN Spearman：residual 0.6122、pretrain 0.6005、baseline 0.5915、finetune 0.4826；DFM-abs-residual 0.7643、DFM-abs-baseline 0.7471、DFM-abs-pretrain 0.7215、DFM-abs2uni-residual 0.7246 |
| FireProtDB | BFN 四 setting 已纳入矩阵并完成训练、生成与实验查表；DFM-uni-baseline、DFM-abs2uni 两 setting 与 DFM-abs 四 setting 已完成训练、生成与实验查表 | 实验查表覆盖过低，暂不能可靠排序 | 已完成严格查表 setting 的可评估率为 0.37%–2.39% |
| Ortlund DMS | BFN 四 setting 已纳入矩阵并完成评估；DFM-abs 四 setting、DFM-uni-baseline 与 DFM-abs2uni 两 setting 已完成评估，DFM-uni-finetune / residual 的下游 g 实验仍未发现对应 run | 当前已完成 DFM-abs 中 pretrain 最好、residual 次之；全部已完成 DFM setting 中 DFM-abs2uni-finetune 的正相关最高 | DFM-abs-pretrain pooled Spearman 0.473、DFM-abs-residual 0.356（evaluable rate 约 65%–71%）；DFM-uni-baseline 0.523；DFM-abs2uni-finetune 0.658 |


---

## 四、总结与下一步计划

### 4.1 整体进展

| 板块 | 状态 | 主要产出 |
|------|------|----------|
| **技术路线数学说明** | ✅ 完成 | h = f + g 的 diffusion 类比、代码实现边界与假设说明 |
| **f 预训练（UniRef50）** | 阶段性完成 | 受计算资源限制完成了一版 proof-of-concept 训练，当前 checkpoint 未充分收敛；如后续正式使用，建议投入更多资源重新充分训练 |
| **g 训练与评测** | 部分完成 | ProteinGYM、FireProtDB 与 Ortlund 已有 BFN 四 setting、DFM-abs 四 setting（baseline / pretrain / finetune / residual）、DFM-uni-baseline 和 DFM-abs2uni 阶段性结果；DFM-uni-pretrain / finetune / residual 的下游 g 实验仍未发现对应 run，其余待推进数据集见第六节 |

### 4.2 下一步计划

1. **完成剩余 DFM 设置**：完成各任务 `pretrain` 的训练、生成与评估，以及各任务的 DFM-uni-finetune / residual 和 FireProtDB DFM-abs 的正式查表，形成可受控比较的实验矩阵
2. **完善已完成任务**：汇总 ProteinGYM DFM checkpoint 结构指标；Ortlund 补充多随机种子、显式单点编辑预算和生成编辑来源 split 后复评
3. **重新训练正式 f**：若后续任务继续依赖 f checkpoint，增加算力、总 batch/token 预算和训练时长，在 UniRef50 上重新充分训练并验证收敛
4. **推进待完成任务**：依次开展 MaveDB、OMA、DeepGOPlus 与 Multiplex peptide 的 g 训练和独立评估
5. **同步训练评估模型**：评估模型应先于或与 g 同时完成，并先验证其独立性能
6. **完成横向对比**：在配置定义明确且评估口径一致的 setting 间比较条件遵循、序列合理性与实验可评估覆盖率；涉及 transition 或参数化效果归因时使用受控对照

### 4.3 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| 评估模型自身性能不够强 | g 引导效果无法准确量化 | 选择文献中已验证的强 baseline（如 ESM-2、ThermoMPNN），并报告其独立性能 |
| 跨任务 g 性能差异大 | 部分数据集 g 训练不收敛 | 先在 P0 任务验证，失败任务降级到 P2 |
| g 引导导致序列不合理（f 失效） | 生成序列 folding 不稳定 | 加大 f 训练数据规模；在评估中加入 pLDDT / ESMFold 结构检查 |
| 数据集分布与 f 预训练分布差异大 | f 冻结后引导无效 | 在 f 训练数据中包含目标任务的同源序列（弱条件注入） |

---

## 五、相关工作与文献定位

> 本节基于文献调研，围绕本项目的 BFN/DFM 蛋白序列生成、条件引导和 WT 编辑设定，对相关方法进行归类与对比，并据此明确当前项目的文献定位和后续实验重点。

### 5.1 结论概览

1. **相关工作数量较多，但主要建模空间已被本项目覆盖**：蛋白质条件生成自 2023 年起已形成成熟且竞争激烈的研究方向。本项目已同时覆盖 BFN 与 DFM 两条主线，并以训练式残差分解实现“大 f、小 g”的容量分工；重点不是复现已有命名方法，而是在统一框架下比较其建模与采样选择。
2. **最接近的工作及当前判断**：
   - **ProtBFN**（Nature Communications 2025, InstaDeep/Alex Graves 组）：其 BFN 建模方式与关键技巧已在本项目中完整考虑，包括文中涉及的不同采样器及对应的 r_ode 采样。已有实验显示，这些额外采样变体相对当前 ODE 默认方案的增益有限；
   - **Nisonoff et al. 2024（离散空间 Classifier Guidance 理论）+ ProteinGuide（2025）**：为离散扩散/流模型属性引导提供严格理论形式。项目已在其他离散生成任务中试验该类方法及近期 ICLR 2026 的引导生成变体；在不计额外训练开销的条件下，显式 f + g 分解的稳定性和效果均更好；
   - **DPLM / DPLM-2**：两者本质上均以生成式 MLM 为底座；从数学建模看可视为 DFM-absorbing 的特例，可通过调整 DFM 的转移方程与采样策略实现。项目在建模能力上已覆盖该路线，但尚未逐项完整核对其工程技巧；
   - **ProfileBFN / ProteinGenerator**：前者验证了 profile 条件对同源性和稳定性的显著价值，后者则是连续 one-hot 扩散的序列-结构生成路线；两者均可在 BFN 框架下统一表达和扩展。
3. **本项目在文献分类学中的定位**：本项目位于参数更新式引导（alignment）与推理时引导（steering）之间。g 通过训练获得，接近 alignment；但 f 保持冻结，g 输出对无条件 logits 的加性修正，形式上接近 steering/classifier guidance。已有离散生成实验表明，显式训练 f + g 的分解在稳定性和效果上优于基于近似估计的 classifier guidance；其代价是需要为新条件训练 g。

### 5.2 相关工作全景

按照建模范式，相关工作可以分为四类。四类之间并非完全互斥，例如 ESM3 同时具备基础模型和引导式生成能力，但这样的分类有助于组织本项目的对比基线。

#### 5.2.1 A 类：自回归条件生成（control tag / prompt 注入）

这类工作把条件信息作为序列前缀 token，让自回归语言模型直接学习 $p(x \mid y)$。它们是本项目在概念上的替代路线，也是蛋白质条件生成中引用较多的基线家族。

| 工作 | 年份/出处 | 条件形式 | 建模方法 |
|------|----------|----------|----------|
| **ProGen** (Madani et al.) | 2023, Nature Biotechnology | Pfam 家族、GO term、物种、关键词等 control tags | 1.2B decoder-only Transformer，条件标签拼接在序列前缀，自回归 next-token 预测；湿实验验证溶菌酶家族生成 |
| **ProGen2** (Nijkamp et al.) | 2023, Cell Systems | 同上 + few-shot 提示 | 最大 6.4B 参数，讨论数据分布与规模的作用 |
| **ProGen3** (Profluent) | 2025, preprint | control tags + 更长上下文 | 自回归继续扩规模 |
| **ZymCTRL** (Munsamy et al.) | 2022, MLSB workshop | EC 号（酶分类码） | 在 BRENDA 酶序列上训练，前缀拼 EC 标签，按 EC 号条件生成人工酶 |
| **ProtGPT2** (Ferruz et al.) | 2022, Nature Communications | 无条件 | GPT-2 架构，UniRef50 上训练，无条件 de novo 生成 |
| **ESM3** (Hayes et al.) | 2025, Science | 序列/结构/功能三轨 prompt（function keyword、结构 motif） | 最大 98B 的掩码式多模态生成模型，chain-of-thought 提示（先 prompt 功能→结构→序列），代表作 esmGFP |
| **ProteinDT** (Liu et al.) | 2024, ICLR | 自由文本描述 | ProteinCLAP 对比学习对齐文本-序列，再做条件解码（自回归 + 扩散解码器变体） |
| **ProLLaMA / PeptideGPT** 等 | 2024+ | 指令/属性文本 | 将 Llama 等 LLM 用蛋白序列持续预训练 + 指令微调 |

**与本项目的异同**：

- **相同点**：都遵循“先学习序列先验、再加入条件”的两阶段思想，条件标签类型也高度重叠，包括物种、GO 和连续性质。
- **不同点**：A 类方法把条件注入输入端（prefix/prompt），条件模型与先验联合训练或进行全量微调；本项目把条件注入输出端（score/logits 修正），冻结先验 f，仅训练 g。A 类方法更换条件类型时通常需要重新训练或至少重新微调主体模型；本项目可以通过替换或重新训练 g 适配不同条件。A 类方法是自回归单向生成，没有从 wt 出发的部分加噪和连续编辑强度 $t$，因此在定向进化式编辑上不如扩散/流框架自然。
- **对标关系**：ProGen、ZymCTRL、ESM3 是条件蛋白生成的重要基线；本项目的 ProteinGYM、OMA、DeepGOPlus 任务可分别与其中的 fitness、物种和 GO 条件设定对标。

#### 5.2.2 B 类：离散扩散 / 流匹配蛋白序列生成器（本项目 f 的同类）

| 工作 | 年份/出处 | 生成框架 | 架构/初始化 | 条件能力 |
|------|----------|----------|------------|----------|
| **EvoDiff** (Alamdari et al.) | 2023, NeurIPS | 离散扩散（OADM / D3PM） | 42M UniRef50，CARP 卷积架构 | 无条件生成 + motif scaffolding（inpainting）；有 MSA 版本 |
| **DPLM** (Wang et al.) | 2024, ICML | 掩码式离散扩散（生成式 MLM） | UniRef50，Transformer，150M/650M/3B | 无条件 + motif scaffolding + 二级结构 plug-and-play 条件 + 逆折叠 adapter |
| **DPLM-2** (Wang et al.) | 2025, ICLR | 同上，扩展结构 token | 序列-结构联合生成 | 折叠、逆折叠、scaffolding |
| **ProtBFN** (Atkinson et al.) | 2025, Nature Communications | **BFN**（与本项目直接同框架） | 650M，UniProtKB 精选数据，128 TPU-v4 × 2 周 | 无条件生成（显著优于自回归与离散扩散基线）+ 零样本 inpainting；抗体微调版 AbBFN |
| **ProfileBFN** | 2025, arXiv 2502.07671 | **BFN** + 家族 profile 条件 | 先 MLM 预热再 BFN | 以蛋白家族氨基酸频率 profile 为条件做家族生成；用初始时间 $t_0$ 控制偏离程度 |
| **Multiflow** (Campbell et al.) | 2024, ICML | 离散流匹配（DFM 原始论文同一团队） | 序列+结构多模态共生成 | 主要为共生成，性质条件有限 |
| **ProteinGenerator** (Lisanza et al.) | 2024, Nature Biotechnology | 连续 one-hot 空间 DDPM（序列-结构联合） | RoseTTAFold 微调 | 氨基酸组成、二级结构、motif、**实验活性数据引导**（见 5.2.3） |
| **PLAID** (Wang et al.) | 2025 | ESMFold 潜空间扩散 | 潜变量生成后解码 | 功能/organism 条件（潜空间条件注入） |
| **Germline-absorbing diffusion** (Sanders et al.) | 2026, arXiv 2605.06720 | SEDD 离散扩散，**germline 序列作吸收态** | 抗体 OAS 数据 | 支持任意 off-the-shelf 分类器引导（见 5.2.3） |

**与本项目的异同及实测经验**：

- **ProtBFN 的核心设计已被完整纳入比较范围**：两者都使用 BFN 进行蛋白序列生成，规模上限都达到 650M。ProtBFN 的 BFN 建模和关键技巧、不同采样方法及对应的 r_ode 采样均已在本项目中考虑和验证；相较当前 ODE 默认策略，额外采样方法的实际提升有限。ProtBFN 报告的 ESMFold pLDDT、novelty 和 diversity 仍可作为 f 充分收敛后的质量参考。其使用 DiT-like Transformer 从零训练与 UniProtKB 精选数据，而本项目使用 ESM2 初始化 DiT 并在 UniRef50 上训练。
- **EvoDiff/DPLM/DPLM-2 与本项目 DFM 主线在建模上同源**：DPLM 和 DPLM-2 本质上是以 MLM 为生成底座的模型；其中 mask/absorbing 生成可视为 DFM-absorbing 的特例。通过修改 DFM 转移方程和采样策略，本项目能够表达该类建模方式，因此其 pLDDT 数字（DPLM-650M 在长度 100–500 上约 74–88）可作为 f 充分收敛后的对照锚点。需要区分的是，DPLM 系列论文中的具体工程技巧尚未逐项完整核对；本项目当前阶段性 pLDDT 约为 55–64，且 f 尚未充分收敛。
- **ProfileBFN 的 profile 条件具有明确价值但超参数敏感**：此前完整实验表明，加入 profile 会显著提高蛋白质序列生成的同源性和稳定性；但计算 profile 时纳入的 MSA 序列数会显著影响结果，初始时间 $t_0$ 也是高度敏感的超参数。其训练中还可让同一蛋白不同氨基酸位置使用不同加噪时间，这能带来小幅而非质变的提升，当前不建议作为优先方案采用。
- **ProteinGenerator 的能力边界可被 BFN 覆盖**：从数学建模视角，ProteinGenerator 是在连续 one-hot 表示上进行的扩散建模；BFN 在同一表示空间上提供更完整的贝叶斯流建模，因此 ProteinGenerator 能实现的后续条件化和采样扩展均可在 BFN 框架内实现，不构成额外的建模能力边界。
- **Germline-absorbing diffusion 的吸收态改造**也具有参考价值：该方法用生物学先验替换 mask 吸收态，而本项目从 wt 出发进行部分加噪，本质上也是将生物学序列先验作为条件起点。

#### 5.2.3 C 类：引导式条件生成（本项目 g 的同类）

这是与本项目 g/h 模块关系最密切的一类，可以细分为四条技术路线。需要强调的是：在离散生成中，当基础生成模型已较强时，额外叠加 classifier guidance 往往不稳定；该路线本质上依赖对条件项的近似估计。项目已在其他离散生成任务中比较该类方法和近期 ICLR 2026 的引导生成工作，在不计训练成本时，显式拆分并训练 f + g 的方案在稳定性与生成效果上更优。

##### 5.2.3.1 严格的离散 Classifier Guidance（理论锚点）

- **Dhariwal & Nichol 2021**：连续扩散 Classifier Guidance 的原始出处，也是本报告第一节数学说明中使用的基础参考。
- **Nisonoff, Xiong, Allenspach, Listgarten 2024（“Unlocking Guidance for Discrete State-Space Diffusion and Flow Models”, ICML 2024）**：将 Classifier Guidance 严格推广到离散状态空间。核心结果是，条件生成的反向过程应使用倾斜后的转移率矩阵
  $$R_t^y[x, \tilde{x}] = \frac{p(y|\tilde{x}, t)}{p(y|x, t)}\, \bar{Q}_t[x, \tilde{x}]$$
  即使用外部分类器对相邻离散状态的似然比重新加权转移率。这为本项目的 `base_logits + residual_logits` 提供理论参照：log 域加性对应概率域乘性，与 Nisonoff 的形式只差归一化常数。但该路线在实际离散生成中仍要依赖分类器和离散状态近似；已有内部对比显示，在不计额外训练成本时，显式训练 f + g 的分解比此类推理时 guidance 更稳定、效果更好。
- **Steering Generative Models with Experimental Data for Protein Fitness Optimization**（arXiv 2505.15093, 2025）：使用离散 guidance 和 posterior sampling，以时间相关 fitness 回归器（输入包含加噪序列 $x_t$ 和时间 $t$）进行引导，并在蛋白 fitness 优化上验证。该方法与本项目的 g 在条件输入和引导强度上高度可比；主要差异是其在推理时逐步回传梯度，而本项目将引导信息训练进 g，由 g 前向输出修正项。

##### 5.2.3.2 推理时梯度引导（不改生成模型参数）

- **EvoProtGrad**（Emami et al., 2023, ICML；NREL）：product-of-experts 框架，将蛋白语言模型作为合理性专家、性质预测器作为功能专家，通过梯度加速的离散 MCMC 进行采样。该方法模型无关、可即插即用，是引导式蛋白编辑的重要基线。
- **NOS / LaMBO-2**（Gruver, Stanton, Frey, …, Cho & Wilson, NeurIPS 2023, “Protein Design with Guided Discrete Diffusion”）：在离散扩散去噪网络的隐状态上沿值函数梯度进行 Langevin 更新（diffusioN Optimized Sampling），结合贝叶斯优化并支持编辑预算约束；其抗体亲和力和表达量任务包含湿实验验证。
- **ProteinGuide**（Xiong et al., 2025, arXiv 2505.04823）：指出掩码扩散/流模型与 OA-AR 模型（ESM3、ESM-C、ProteinMPNN）的训练目标具有等价关系，因此可以将已训练的 MLM/OA-AR 模型作为离散扩散模型，在推理时用贝叶斯因子乘积进行属性引导，基本不需要额外训练。该路线及同类近期引导生成方法已在其他离散任务中试验；在不计额外训练成本时，结果不如显式 f + g 分解稳定且有效。其 PbrR 多性质 Pareto 外推结果仍可作为本项目多属性任务的参考。
- **DiffAntiSeq**（ICLR 2026）：使用连续潜空间扩散和 pLM 亲和力分类器的梯度引导进行抗体库设计。
- **BADASS**（PLoS Computational Biology 2025）等：属于梯度 MCMC 引导方法的后续改进。

##### 5.2.3.3 训练时条件注入（条件模型微调，本项目 finetune setting 的同类）

- **ProteinGenerator**（Lisanza et al., Nature Biotechnology 2024）：在生成轨迹中融入实验活性数据引导，将外部活性预测与模型当前预测的 $\hat{x}_0$ 结合以偏置去噪方向，同时支持 motif 固定和二级结构条件，是“扩散 + 活性数据引导”在蛋白质上的代表性湿实验工作之一。
- **抗体 developability guidance**（Villegas-Morcillo et al., MLSB 2023）：在 DiffAb 上进行无梯度的性质条件建模和按性质采样。
- **ProHiFlo**（2026, arXiv 2606.11243）：采用结构流匹配和预训练预测器进行功能引导，强调 training-free steering。
- **DPLM 的 plug-and-play 二级结构条件**：在推理时将约束注入采样过程，与本项目推理阶段调整 $\lambda$ 和条件 $y$ 的使用方式具有可比性。

##### 5.2.3.4 分类学综述

- **Stocco, Garibbo, Ferruz 2026**（Current Opinion in Structural Biology, “Steering generative models for protein design”）：将可控生成策略分为**参数更新式 alignment**（微调、RL）和**参数固定式 steering**（条件注入、检索、贝叶斯引导、采样策略）。本项目横跨这两类：g 通过训练获得，接近 alignment；f 保持冻结且 g 只输出加性修正，形式上接近 steering。该综述可用于定位本项目的 related work 结构。

#### 5.2.4 D 类：任务与评估口径的对应关系

本项目的下游任务在现有文献中均有可对应的先例，评估口径也基本一致：

| 本项目任务 | 文献先例 | 可比口径 |
|----------|----------|----------|
| ProteinGYM fitness 条件生成 | ProteinGuide（GB1/TrpB/PbrR）、Steering with Experimental Data（2505.15093）、EvoProtGrad | 外部 oracle 打分 + Spearman/误差；去衰减校正 |
| FireProtDB ΔΔG 条件编辑 | Stability Oracle、ThermoMPNN 相关采样工作、ProteinGenerator 耐热设计 | 实验查表；单编辑命中率低是已知难点，文献常用编辑预算硬约束，例如 LaMBO-2 的 edit budget B=16 |
| Ortlund Fc 亲和力 | LaMBO-2 抗体亲和力任务、DiffAntiSeq | 按位点/突变 held-out；pooled 与 per-receptor Spearman |
| OMA 物种条件 | ProGen（物种 tag）、ESM3（taxonomy prompt） | 独立分类器 top-1 |
| DeepGOPlus GO 条件 | ProGen（GO tag）、ProteinDT（文本功能） | 多标签 F1 |
| Multiplex 多属性肽 | 多目标 EvoProtGrad（product of experts 天然支持多目标）、PbrR 多性质 Pareto（ProteinGuide） | 多属性同时满足率 |

### 5.3 本项目与文献的系统对比

#### 5.3.1 方法对比总表

| 维度 | 本项目方法 | 最接近的文献 | 相同点 | 差异点 |
|------|----------|-------------|-----|-----|
| 生成框架 | BFN + DFM 双框架 | ProtBFN（BFN）；EvoDiff/DPLM（DFM 等价物） | 框架同源 | DPLM/DPLM-2 的 MLM 建模可视为 DFM-absorbing 特例；本项目通过转移方程和采样策略覆盖该建模空间，但尚未逐项复核其工程技巧 |
| 基础模型初始化 | ESM2 权重初始化 DiT | ProtBFN 从零训练；DPLM 从零训练 | 规模区间相近（35M–650M） | ESM2 初始化使模型从进化表征先验出发 |
| 条件注入位置 | 输出端（logits/score 修正） | Nisonoff 2024（转移率倾斜）；ProteinGuide（贝叶斯因子乘积） | 数学形式同族（log 域加性 ↔ 概率域乘性） | 本项目的 g 是训练得到的网络；内部离散生成对比中，显式 f + g 比推理时近似 guidance 更稳定、效果更好 |
| g 的获得方式 | baseline / pretrain / finetune / residual 四种参数化 | C3 类方法（ProteinGenerator 活性引导、抗体性质引导） | 都是通过训练或额外模块加入条件信号 | pretrain 是加载 f 后全参数训练，finetune 只训练条件注入部分，residual 显式采用 `base + Δlogits` 分解 |
| 引导的数学严格性 | 当前报告以工程类比为主 | Nisonoff 2024 给出严格离散形式 | 均使用条件信息修正反向过程 | Nisonoff 是推理时 classifier guidance 的理论锚点；本项目以训练式 f + g 分解规避其离散近似带来的稳定性问题 |
| 编辑范式 | 从 wt 部分加噪（$t$ 控制强度），ODE 采样回归 query | ProfileBFN 的 $t_0$；germline-absorbing；LaMBO-2 编辑预算 | 思想同构 | ProfileBFN 的 MSA 数量与 $t_0$ 均高度敏感；本项目已完成采样器×步数×$t$ 网格搜索，ProtBFN 的 r_ode 等变体增益有限 |
| 多条件 | M-Task g（暂缓） | EvoProtGrad product-of-experts；ProteinGuide 多性质 | 都是条件组合 | 本项目计划通过多任务网络内化多条件引导 |
| 评估 | 外部 predictor（先验证独立性能）+ 实验查表双轨 | ProteinGuide / Steering 论文相近口径 | 评估思路一致 | 本项目显式报告可评估率和 hit rate，强调实验覆盖边界 |

#### 5.3.2 四个 setting（baseline / pretrain / finetune / residual）的文献定位

- **baseline**（ESM2 初始化的单网络直接条件生成）≈ A 类条件微调路线（如 ProGen 微调家族）的扩散版。
- **pretrain**（加载 f 预训练权重后全参数训练）≈ 以预训练生成器为初始化的全量条件微调路线。
- **finetune**（冻结 backbone，仅训练条件注入 cross-att + score embedding）≈ 参数高效条件化，思想上与 LoRA 条件微调、DPLM 的 adapter 逆折叠相近。
- **residual**（冻结先验 + 加性残差网络）是本项目最具区分度的 setting。文献中最接近的是 Nisonoff 的离散 guidance（外部分类器）和 Steering 论文（推理时梯度），但它们主要在推理时计算引导；本项目将引导训练为常驻 g，推理时只需额外前向，不需要逐步反传梯度。虽然更换条件时需要重新训练 g，但已在其他离散生成任务中观察到：在不计额外训练成本时，该显式 f + g 分解比推理时近似 guidance 更稳定、效果更好。

#### 5.3.3 新颖性与表述边界

**本项目的组合（BFN/DFM 蛋白序列生成 + 训练式残差引导 + 大 f 小 g + wt 编辑范式）目前尚未发现完全相同的公开方案**，可重点考察以下差异化贡献：

1. ProtBFN 已证明 BFN 适合蛋白序列生成；本项目完整纳入其核心建模与采样选择，并进一步将 BFN/DFM 用于性质条件生成。当前采样搜索显示，ProtBFN 相关采样器和 r_ode 相较默认 ODE 的提升有限。
2. residual 参数化将条件修正显式分解为 f + g。在其他离散生成任务中，相较 Nisonoff/ProteinGuide 一类依赖近似估计的推理时 guidance，该分解在不计训练成本时表现出更好的稳定性和效果；ProteinGYM 中 residual > baseline > finetune 的阶段性排序提供了项目内的补充证据。
3. DPLM/DPLM-2 的 MLM 路线在数学上可纳入 DFM-absorbing；ProfileBFN 的 profile 条件和 ProteinGenerator 的连续 one-hot 扩散也均可在 BFN 框架内表达。因此项目的贡献重点在统一建模、受控比较和经验结论，而非宣称覆盖范围之外的独立建模能力。

**需要避免的过度表述**：

- 不应将创新点表述为“首次把 classifier guidance 用于蛋白序列”，因为 Nisonoff 2024、Steering 2505.15093、ProteinGuide 和 germline-absorbing 2026 已经覆盖相关方向。
- 不应将创新点表述为“首次 BFN 蛋白生成”，因为 ProtBFN 已经建立了该方向的代表性工作。
- 更稳妥的表述是：**在 BFN/DFM 蛋白序列生成器上，以显式 f + g 分解系统比较训练式条件修正与推理时引导，并分析其稳定性、条件遵循和训练成本的权衡**。

### 5.4 对本项目的具体建议

1. **理论边界**：保留 Nisonoff et al. 2024 的倾斜转移率公式，用于说明推理时离散 Classifier Guidance 的严格形式及其与 residual logits 加法的联系，同时明确本项目的优势来自训练式 f + g 分解而非将两者机械等同。
2. **基线复核而非优先方案**：若需在具体蛋白任务上补充基线，可在相同 oracle、wt 起点和编辑预算下复核 EvoProtGrad 或 ProteinGuide 式引导；应将其作为对照，而非替代当前 f + g 主线。
3. **应对 FireProtDB 低命中率**：参考 LaMBO-2 的硬编辑预算约束和 germline-absorbing 的先验设计，实施相对 WT 恰好 1 次替换的约束，并报告单编辑率、查表命中率和可评估率。
4. **分析零编辑 / WT 回退**：当前 Ortlund BFN-baseline 有 99.4% 输出等于 WT，可能对应引导强度不足时退化到先验众数的现象。建议固定分析 $\lambda$、零编辑率和 Spearman 的联合曲线，并将其作为不同 setting 的标准诊断图。
5. **统一写作分类学**：正式论文的 related work 可按 Stocco 2026 的 alignment/steering 二分组织，将本项目明确放在“trained residual steering”的交叉位置。

### 5.5 参考文献清单

**生成框架与基础模型**

1. Graves et al., Bayesian Flow Networks, 2023.
2. Campbell et al.; Gat et al., Discrete Flow Matching, 2024.
3. Atkinson et al., *Protein sequence modelling with Bayesian flow networks*, Nature Communications, 2025. https://www.nature.com/articles/s41467-025-58250-2
4. *Steering Protein Family Design through Profile Bayesian Flow*, arXiv:2502.07671, 2025.
5. Alamdari et al., *Protein generation with evolutionary diffusion: sequence is all you need* (EvoDiff), NeurIPS 2023.
6. Wang et al., *Diffusion Language Models Are Versatile Protein Learners* (DPLM), ICML 2024.
7. Wang et al., *DPLM-2: A Multimodal Diffusion Protein Language Model*, ICLR 2025.
8. Campbell et al., *Generative Flows on Discrete State-Spaces* (Multiflow), ICML 2024.
9. Sanders et al., *Conditional generation of antibody sequences with classifier-guided germline-absorbing discrete diffusion*, arXiv:2605.06720, 2026.

**条件 / 引导生成**

10. Dhariwal & Nichol, *Diffusion Models Beat GANs on Image Synthesis* (Classifier Guidance), NeurIPS 2021.
11. Nisonoff, Xiong, Allenspach, Listgarten, *Unlocking Guidance for Discrete State-Space Diffusion and Flow Models*, ICML 2024.
12. *Steering Generative Models with Experimental Data for Protein Fitness Optimization*, arXiv:2505.15093, 2025.
13. Xiong et al., *ProteinGuide: On-the-fly property guidance for protein sequence generative models*, arXiv:2505.04823, 2025. https://github.com/junhaobearxiong/proteinguide
14. Emami et al., *EvoProtGrad: Directed evolution of proteins with fast gradient-based discrete MCMC*, ICML 2023.
15. Gruver et al., *Protein Design with Guided Discrete Diffusion* (NOS / LaMBO-2), NeurIPS 2023.
16. Lisanza et al., *Multistate and functional protein design using RoseTTAFold sequence space diffusion* (ProteinGenerator), Nature Biotechnology, 2024.
17. Villegas-Morcillo et al., *Guiding diffusion models for antibody sequence and structure co-design with developability properties*, MLSB 2023.
18. *DiffAntiSeq: Target-Steered Diffusion in Latent Sequence Space for Antibody Library Design*, ICLR 2026.
19. *ProHiFlo: Hierarchical Flow Matching with Functional Guidance for De Novo Protein Generation*, arXiv:2606.11243, 2026.
20. Stocco, Garibbo, Ferruz, *Steering generative models for protein design: Aligning and conditioning strategies*, Current Opinion in Structural Biology, 2026. https://doi.org/10.1016/j.sbi.2026.103250

**自回归 / 语言模型条件生成**

21. Madani et al., *Large language models generate functional protein sequences across diverse families* (ProGen), Nature Biotechnology, 2023.
22. Nijkamp et al., *ProGen2: Exploring the boundaries of protein language models*, Cell Systems, 2023.
23. Munsamy et al., *ZymCTRL: a conditional language model for the controllable generation of artificial enzymes*, MLSB 2022.
24. Ferruz et al., *ProtGPT2 is a deep unsupervised language model for protein design*, Nature Communications, 2022.
25. Hayes et al., *Simulating 500 million years of evolution with a language model* (ESM3), Science, 2025.
26. Liu et al., *A Text-Guided Protein Design Framework* (ProteinDT), ICLR 2024.

---

<a id="future-work"></a>

## 六、未来可以做哪些

### 6.1 数据集

以下四个数据集目前仍处于实验计划阶段，后续将作为 g 条件引导网络的待推进任务。各数据集的可控生成内容描述见[附录 B.4](#appendix-b-4)、[B.5](#appendix-b-5)、[B.6](#appendix-b-6)和[B.7](#appendix-b-7)。

#### 6.1.1 MaveDB 变异效应预测

**状态**：待实验。计划以 per-assay 连续 score 为条件，主要报告每个 assay 的 Spearman、跨 assay 等权的 macro-average Spearman，以及与文献 SOTA 的对比；前者衡量 assay 内排序，后者避免大 assay 主导总体结论。当前不报告结果或排序。数据集可控生成内容见[附录 B.4](#appendix-b-4)。

#### 6.1.2 OMA 跨物种序列生成

**状态**：待实验。计划以目标物种 ID 为条件，主要报告独立物种分类器对目标物种的 top-1 准确率，并结合氨基酸组成、同源关系与 OrthologTransformer 结果判断物种特异性。当前不报告结果或排序。数据集可控生成内容见[附录 B.5](#appendix-b-5)。

#### 6.1.3 DeepGOPlus GO term 预测

**状态**：待实验。计划以多标签 GO 向量为条件，报告目标 GO 与预测 GO 的 F1、Coverage 和 Hamming distance；三者分别衡量标签集合的综合重合度、目标功能召回程度和整体标签向量差异。当前不报告结果或排序。数据集可控生成内容见[附录 B.6](#appendix-b-6)。

#### 6.1.4 Multiplex therapeutic peptide 多属性生成

**状态**：待实验。计划联合控制 15 类活性和 47 类属性，报告 per-属性 AUROC、多属性同时满足率，以及生成肽的长度与氨基酸组成合理性；分别衡量单属性可分性、联合条件达成和基础序列有效性。当前不报告结果或排序。数据集可控生成内容见[附录 B.7](#appendix-b-7)。

### 6.2 直接以三维坐标作为结构条件

当前 `_struct` setting 注入的是由 pLM 序列表征提取的结构特征，而不是直接由三维坐标构造的几何条件。附录 B.10 的消融显示，该类特征没有带来稳定收益，并且在部分 setting 中诱发 WT 回退。后续结构条件应优先转向**序列无关的三维几何表示**，而非继续叠加 pLM sequence embedding。

- **动机与文献依据**：inverse folding 主流方法（ProteinMPNN、PiFold、ESM-IF）以主链原子间距离、相对方向、局部坐标系和二面角等纯几何信息为条件；其消融结果普遍表明，将 pLM 序列表征额外作为结构条件的收益很小，甚至可能为负，因此主流实现通常不使用该特征。ESM3 与 DPLM-2 均采用不读取氨基酸序列的结构 tokenizer，使结构模态与序列模态互补。DPLM-2.1（ICML 2025）进一步将 pLM 表征与结构表征的对齐列为多模态蛋白语言模型的核心瓶颈，指出需要显式的 representation alignment 才能缓解两种表征的冲突。
- **建模方向**：以主链 $N$、$C_\alpha$、$C$、$O$ 的三维坐标构造残基级几何图或 sequence-agnostic structure token，编码残基间距离、相对方向、局部参考系和二面角；再通过 cross-attention 或条件适配器将几何 token 注入 g，而不将序列 embedding 伪装为结构条件。对于只有预测结构的任务，应固定结构预测器和坐标预处理，避免把同一序列信息经不同路径重复输入。
- **对照实验**：在相同 f、g、训练预算与采样设置下，比较仅序列条件、现有 pLM 结构特征、直接坐标几何条件和结构 token 四类方案；除条件遵循指标外，同时报告零编辑率、序列相似度、pLDDT/pTM、TM-score/RMSD 及跨蛋白泛化，以区分真实结构约束收益与 WT 复制效应。

### 6.3 以蛋白家族 profile 为条件的家族生成

参考 ProfileBFN，以蛋白家族多序列比对（MSA）得到的逐位点氨基酸频率 profile 作为条件，学习在保留家族保守性与功能位点偏好的同时生成序列。profile 提供的是家族级进化约束，与单条 WT 序列和连续性质标签互补，适合用于家族内设计及同源序列生成。

- **条件与训练**：将长度对齐的 $L \times K$ 氨基酸频率矩阵编码为残基级条件 token，并与 WT 序列、任务标签共同输入 g；训练、验证和测试应按家族或低序列一致性簇划分，防止同源泄漏造成虚高结果。
- **偏离程度控制**：沿用 ProfileBFN 的初始时间 $t_0$，以部分加噪程度控制输出偏离 query/profile 共识的幅度：较小或较大的 $t_0$ 对应的编辑强度需按本项目 BFN 时间定义校准，并以序列 identity、与 profile 的 KL divergence/位点恢复率、家族分类准确率和结构质量共同选择。
- **关键消融**：比较无 profile、不同 MSA 深度/采样数、profile 与 WT 的单独及联合条件，以及不同 $t_0$；重点检查 profile 是否仅提高保守位点复制，还是能在保持家族归属和可折叠性的同时提升条件遵循与多样性。

### 6.4 面向具体 SDE 的更精确 f + g 条件建模

当前 residual setting 使用 `base_logits + residual_logits` 近似 f + g，将条件修正直接加到无条件模型输出上。该参数化便于实现，但未显式利用不同 SDE 的前向噪声核、反向漂移项与扩散系数；因此它不一定是每种连续或离散扩散过程下最精确的条件反向过程。

后续可针对实际采用的 SDE/离散 transition，推导与其前向过程一致的条件反向动力学或条件转移率，并直接参数化其中的条件项，而不是统一使用 logits 加法近似。实验上应至少比较：(1) 当前加性 residual 近似；(2) 按 SDE 系数缩放、时间相关的条件漂移/score 修正；(3) 基于条件反向过程或倾斜转移率的精确参数化。比较应在相同 f checkpoint、条件数据、引导强度搜索和 ODE/SDE 采样预算下进行，并同时报告条件遵循、生成质量、数值稳定性、不同时间步的误差及训练/推理成本，从而判断精确建模的收益是否足以覆盖额外复杂度。

---

<a id="appendix-a"></a>

## 附录 A：BFN 预训练采样策略搜索

本附录收录 2.1.2 的完整采样策略对比。结果基于 `logs/bfn_sampling_para_search`，搜索维度为 **采样器（langevin / ode / sde / r_ode）× 采样步数（100 / 200 / 500）× 起始噪声水平 t（0.0 / 0.3 / 0.5 / 0.7 / 0.9）**。每个 setting 使用 UniRef50 test split 生成序列，并用 ESMFold 对固定预算的 64 条样本（每 rank 16 条）计算 `plddt`、`tm_score` 和 `rmsd`。这里 `t` 是“部分加噪 / 编辑强度”控制量：`t→0` 表示几乎完全加噪，`t→1` 表示仅轻度扰动 query。

### A.1 可折叠性 mean pLDDT ↑

| 采样器 / 步数 | t0.0 | t0.3 | t0.5 | t0.7 | t0.9 |
|--------------|-----:|-----:|-----:|-----:|-----:|
| langevin-100 | 60.76 | 60.83 | 60.22 | 56.15 | 55.50 |
| langevin-200 | 59.76 | 59.99 | 59.96 | 55.87 | 55.43 |
| langevin-500 | **63.92** | **63.01** | **61.60** | 57.12 | 55.53 |
| ode-100 | 57.01 | 55.57 | 57.03 | 55.72 | 55.44 |
| ode-200 | 57.03 | 55.52 | 57.07 | 55.74 | 55.44 |
| ode-500 | 39.27\* | 55.47 | 55.11\* | 55.74 | 55.44 |
| sde-100 | 57.81 | 56.95 | 56.28 | 55.88 | 55.47 |
| sde-200 | 58.62 | 56.95 | 55.53 | 55.49 | 55.56 |
| sde-500 | 57.05 | 57.04 | 56.14 | 56.08 | 55.55 |
| r_ode-100 | 59.37 | —† | — | — | — |
| r_ode-200 | 59.95 | 58.02 | 56.11 | 56.54 | 55.74 |
| r_ode-500 | 60.87 | 57.62 | 55.61 | 56.16 | 55.72 |

### A.2 query 结构相似度 tm_score ↑

| 采样器 / 步数 | t0.0 | t0.3 | t0.5 | t0.7 | t0.9 |
|--------------|-----:|-----:|-----:|-----:|-----:|
| langevin-100 | 0.0777 | 0.1015 | 0.0765 | 0.1645 | 0.7221 |
| langevin-200 | 0.0771 | 0.0807 | 0.0952 | 0.1098 | 0.6149 |
| langevin-500 | 0.0843 | 0.1053 | 0.1024 | 0.1124 | 0.3328 |
| ode-100 | 0.0989 | 0.1210 | 0.2156 | 0.6449 | **0.9429** |
| ode-200 | 0.0989 | 0.1203 | 0.2162 | 0.6393 | **0.9429** |
| ode-500 | 0.0994\* | 0.1208 | 0.4338\* | 0.6393 | **0.9429** |
| sde-100 | 0.0742 | 0.1042 | 0.1924 | 0.5380 | 0.9402 |
| sde-200 | 0.0690 | 0.0993 | 0.1850 | 0.5512 | 0.9116 |
| sde-500 | 0.0764 | 0.1223 | 0.1868 | 0.5038 | 0.9237 |
| r_ode-100 | 0.0631 | —† | — | — | — |
| r_ode-200 | 0.0624 | 0.0690 | 0.0678 | 0.1693 | 0.6546 |
| r_ode-500 | 0.0696 | 0.0675 | 0.0644 | 0.1690 | 0.6432 |

### A.3 query 结构偏差 rmsd ↓

| 采样器 / 步数 | t0.0 | t0.3 | t0.5 | t0.7 | t0.9 |
|--------------|-----:|-----:|-----:|-----:|-----:|
| langevin-100 | 9.454 | 8.478 | 9.571 | 7.080 | 1.667 |
| langevin-200 | 9.884 | 10.319 | 8.980 | 8.282 | 2.450 |
| langevin-500 | 9.173 | 9.094 | 9.142 | 8.831 | 4.750 |
| ode-100 | 9.190 | 8.258 | 6.221 | 2.500 | **0.356** |
| ode-200 | 9.190 | 8.300 | 6.210 | 2.519 | **0.356** |
| ode-500 | 24.084\* | 8.298 | 12.093\* | 2.519 | **0.356** |
| sde-100 | 10.600 | 8.556 | 7.045 | 3.017 | 0.327 |
| sde-200 | 10.094 | 9.149 | 7.116 | 3.013 | 0.537 |
| sde-500 | 9.901 | 8.056 | 6.860 | 3.360 | 0.446 |
| r_ode-100 | 9.664 | —† | — | — | — |
| r_ode-200 | 9.745 | 9.556 | 9.815 | 7.060 | 2.201 |
| r_ode-500 | 9.374 | 9.742 | 9.568 | 7.024 | 2.262 |

\* `steps500_ode` 组的 `t0.0`、`t0.5` 折叠样本数异常（1016/rank，其余 setting 均为 16/rank），其中 `t0.0` 结果显著退化（plddt 39.27、rmsd 24.08），属单次运行异常，横比时应剔除。†`steps100_r_ode` 仅完成 `t0.0`，`t0.3` 的 run 失败无产出、`t0.5/0.7/0.9` 未跑。

### A.4 详细结果解读与运行完整性

- **可折叠性**：pLDDT 整体偏低（约 55–64，与 2.1.1.1 中“f 未收敛”一致）。同一 t 下，langevin-500 在低 t（0.0/0.3/0.5）区间最高（63.92 / 63.01 / 61.60）；所有采样器在高 t（0.7、0.9）都回落到约 55–57。ode / sde 对步数相对不敏感，Langevin 则明显受步数影响。
- **编辑强度可控性**：ODE/SDE 随 t 增大呈现较清晰的整体回归 query 趋势；Langevin 与 r_ode 存在局部非单调点。ode 的整体收敛最清晰：t0.5 的 tm 约为 0.216、t0.7 达 0.64、t0.9 达 0.9429（rmsd 0.356），且 100/200/500 步数值近似一致（除 500 步异常点）。sde 次之，SDE-100 在 t0.9 的 RMSD 为 0.327，略优于 ODE 的 0.356。
- **Langevin 与 r_ode**：两者在中高 t 上整体偏弱且存在局部反向波动。Langevin 的 t0.9 query 保留度随步数升高反而变差（100 步 0.7221 → 200 步 0.6149 → 500 步 0.3328），提示随机扩散在高步数下可能过度混合。
- **运行完整性**：`steps100_r_ode_t0.3` 的 run 目录存在但未产出生成样本，且 `steps100_r_ode` 的 t 扫描不完整；`steps500_ode_t0.0` 与 `steps500_ode_t0.5` 的折叠样本数为 1016/rank，与其余 setting 的 16/rank 不一致。其余组合均以固定 64 样本预算完成。

---

<a id="appendix-b"></a>

## 附录 B：各数据集详细分析

> **附录说明**：本附录保存各数据集的评估口径、完整结果表、诊断过程和补充分析。ProteinGYM、FireProtDB 与 Ortlund 已有阶段性结果，其余任务仍为实验计划。正文仅保留关键结果与结论。

<a id="appendix-b-1"></a>

### B.1 通用实验设定

#### B.1.1 g 训练的四个参数化 setting（baseline / pretrain / finetune / residual）

所有数据集在 g 训练上统一对比以下四种参数化方式。四者的生成损失公式与量纲完全一致，区别只在**预测项的参数化方式**：

| Setting | 参数化方式 | 初始化 | 可训练部分 |
|---------|-----------|--------|-----------|
| **baseline** | `pred = net(t, batch)`，单网络直接预测 target | DiT backbone 从 ESM2 权重初始化（`load_pretrained_ckpt=<ESM2>`），不加载 f 预训练生成器 | 全部权重（`freeze_backbone=false`） |
| **pretrain** | 与 baseline 同结构 | 加载与当前生成框架对应的 f 预训练权重（`load_pretrained_ckpt=<f ckpt>`） | 全部权重（`freeze_backbone=false`） |
| **finetune** | 与 baseline 同结构 | 加载与当前生成框架对应的 f 预训练权重（`load_pretrained_ckpt=<f ckpt>`） | 仅条件注入部分（`freeze_backbone=true`：只训练 `cross_att` 交叉注意力与 `score_emb` 条件嵌入，backbone 冻结） |
| **residual** | `pred = base_logits + residual_logits`，在冻结的 UniRef50 预训练无条件先验上叠加可训练残差 | base 加载与当前生成框架对应的 f 预训练权重并冻结；残差网络随机初始化 | 仅残差修正网络（base 冻结） |

对 DFM，参数化方式还必须与 transition 配置共同标记：`DFM-abs-*` 表示 absorbing 下游 transition，`DFM-uni-*` 表示 uniform 下游 transition，`DFM-abs2uni-*` 表示加载 absorbing f checkpoint 后使用 uniform 下游 transition 的跨 transition transfer setting。DFM-abs 与 DFM-uni 均包含 baseline、pretrain、finetune、residual，DFM-abs2uni 包含 finetune、residual。

各 setting 的具体日志目录随数据集不同，在对应任务小节列出。所有生成模型均按 `ModelCheckpoint(monitor=val/loss, mode=min)` 选择 checkpoint；训练结果表中的 pLDDT、pTM、TM-score 与 RMSD 必须取该 `best_loss_model_*` 对应的同一条验证记录，不再分别取各指标在训练过程中的最优值。

#### B.1.2 评估模型（property predictor）的 setting

为独立评估"g 是否真的生成了满足目标条件的序列"，每个任务需训练一个外部 property predictor，对生成序列预测条件值 `score_pred_z`。predictor 目前有两个通用参数化 setting：

| Setting | 参数化方式 |
|---------|-----------|
| **delta** | `pred = net(mut) - net(wt)`，显式建模突变前后差值 |
| **joint** | `pred = net(mut, wt)`，wt 作为条件一次前向 |

不同数据集可能因标签形式不同而引入其他预测方法（如 ESM-2 回归器、DeepGOPlus、物种分类器、多标签头等），这些在对应任务小节说明。各任务只报告选用的 predictor setting 及其对比结论，不再重复上述定义。

<a id="appendix-b-2"></a>

### B.2 任务一：ProteinGYM DMS 变异预测（基线任务）

#### B.2.1 数据集上的可控生成内容

- **数据来源**：ProteinGYM 217 个 DMS assay
- **控制目标 g**："给定一个目标 fitness score，学习应当如何编辑序列，使生成的蛋白质序列符合该指定 score"
- **g 标签 y**：连续 fitness score（标准化后的 z-score）
- **g 的角色**：在加噪到中间时间步的 mut_seq 上，预测"为了让 score 达到目标，应当朝哪个方向再修改"

##### B.2.1.1 数据集分布统计

以下统计基于当前预处理缓存，合并 train / val / test 三个 split；缓存配置为 `min_len=32`、`max_len=512`，同时保留 single-mutant 和 multiple-mutant 样本。当前缓存实际加载 210 个 assay，共 2,326,789 个样本。序列长度按去除 tokenizer 两个 special token 后的氨基酸数统计；由于 ProteinGYM 样本为替换突变，WT 与 mutant 的序列长度相同。编辑次数直接由 `mutation_depth`（每个样本中氨基酸替换的数量）统计。

| 序列长度分布 | 氨基酸编辑次数分布 |
|---|---|
| ![ProteinGYM 序列长度分布](figures/g_task1_proteingym_sequence_length_distribution.png) | ![ProteinGYM 氨基酸编辑次数分布](figures/g_task1_proteingym_edit_count_distribution.png) |

序列长度范围为 37–510 aa，均值为 322.61 aa，中位数为 306 aa；编辑次数范围为 1–44 次，均值为 3.46 次，中位数为 2 次。两张图的纵轴均采用对数刻度，以同时展示高频区间和长尾样本；编辑次数分布中 1 次和 2 次编辑分别有 613,144 和 801,397 个样本。

#### B.2.2 g 训练实验

本任务在 DiT-35M 规模下比较 B.1.1 定义的 baseline / pretrain / finetune / residual 四个 setting，均以 BFN 为生成框架（`beta=1.0`，`loss_func=l_infty_decay`）。数据集目录为 `proteingym_dms`，四个 setting 的 run 目录分别为 `proteingym_dms_baseline_dit35m`、`proteingym_dms_pretrain_dit35m`、`proteingym_dms_finetune_dit35m` 与 `proteingym_dms_residual_dit35m`。

四个 setting 均训练至收敛并留有完整产物：`csv/metrics.csv`（含 `val/*` 记录）、`best_loss_model_*` checkpoint（baseline `step65536`、pretrain `step61440`、finetune `step81920`、residual `step135168`）与 test 生成样本。

此外，DFM-abs-baseline / pretrain / finetune / residual、DFM-uni-baseline 与 DFM-abs2uni-finetune / residual 已完成训练和 test 生成评分；DFM-uni-pretrain / finetune / residual 的下游 g 实验仍未发现对应 run。DFM-abs-baseline 的八个 rank 分片位于相邻的两个同批次 run 目录，汇总时合并统计。DFM-abs2uni 的 f checkpoint 为 absorbing，finetune / residual 下游 transition 为 uniform，作为跨 transition transfer setting 在 B.2.6 中报告。

需要说明的是，当前四个 setting 的生成模型输入均为 `(xₜ, wt_seq, target_score)`，并不包含样本所属的 assay 标识，即模型在生成时并不知道该序列来自哪一个 DMS assay，只能依据 wt_seq 与目标 score 做条件生成。由于 ProteinGYM 的 `score` 已在各 assay 内做 z-score 标准化到同一量纲，这一设定下模型仍可学习跨 assay 通用的"按目标 score 编辑"能力；但也因此无法利用 assay-specific 的实验背景信息。后续改进方向是将 `assay_id` 也作为一个显式条件注入模型，使其能针对不同 assay 的功能表型做更精细的可控生成。

进一步地，这 217 个 assay 只对应 187 个唯一 wt_seq，其中有 24 组、共 54 个 assay 共享相同的 wt_seq（例如 BLAT_ECOLX 的 4 个实验、P53_HUMAN_Giacomelli_2018 的 3 种选择压力等）。对这批 assay，模型即便理论上也无法仅凭 `(wt_seq, target_score)` 区分它们属于哪个实验设置，因为输入完全相同而底层 assay 不同——这是"无法利用 assay-specific 背景信息"更本质的一层原因。若后续要针对该数据集专门优化，可将 `assay_id` 作为显式条件注入以消除这种不可区分性；但当前工作主要是做 proof of concept，因此暂未引入这一改动。

#### B.2.3 训练曲线对比

**BFN**：

![任务一四个 setting 训练曲线对比（BFN）](figures/g_task1_proteingym_train_curves_compare.png)

该图对比 BFN 的 baseline、pretrain、finetune 与 residual 四个 setting 的训练与验证曲线（`train/loss`、`train/acc` 与 `val/loss`、`val/mean_plddt`、`val/mean_ptm`、`val/mean_tm_score`、`val/mean_rmsd`）。四个 setting 的 `val/loss` 均稳定收敛至约 0.21，结构指标（pLDDT / pTM / TM-score / RMSD）趋势接近；baseline 与 pretrain 的 `val/loss` 与 finetune / residual 处于同一水平，其结构指标（pLDDT≈71、TM-score≈0.89）略低于两者，与其在 B.2.4 中略高的 RMSD 一致。

**DFM-abs**：

![任务一四个 setting 训练曲线对比（DFM-abs）](figures/g_task1_proteingym_train_curves_compare_dfm_abs.png)

该图对比下游 transition 均为 `absorbing` 的 baseline、pretrain、finetune 与 residual。四个 setting 的 `val/loss` 均稳定收敛至约 0.019–0.020；baseline / pretrain / finetune 的训练长度接近，residual 训练更久。四者的 pLDDT、pTM、TM-score 与 RMSD 整体处于相近范围，具体 best-loss checkpoint 对齐值见 B.2.4。

**DFM-uni**：

![任务一 uniform 下游 setting 训练曲线对比（DFM-uni）](figures/g_task1_proteingym_train_curves_compare_dfm_uni.png)

当前纯 DFM-uni 仅有 baseline run；为完整展示已有的 uniform 下游训练曲线，本组同时纳入 DFM-abs2uni-finetune 与 DFM-abs2uni-residual，并在图例中保留其跨 transition 名称。三者的下游 transition 均为 `uniform`，其中后两者的 f checkpoint 来自 absorbing DFM，因此不等同于纯 DFM-uni-finetune / residual。三条曲线的 `val/loss` 均稳定收敛至约 0.027–0.029；DFM-uni-pretrain / finetune / residual 的下游 g 实验仍未发现对应 run。

#### B.2.4 Checkpoint 对齐状态

各 setting 的结构指标取自各自 `val/loss` 最低的同一条验证记录。

**BFN**：

| Setting | `val/loss` 最优 checkpoint | pLDDT ↑ | pTM ↑ | TM-score ↑ | RMSD ↓ | 状态 |
|---------|-----------------------------|--------:|------:|-----------:|-------:|------|
| BFN-baseline | `best_loss_model_step65536`（`val/loss` 0.2132） | 71.30 | 0.5791 | 0.8924 | 0.9074 | 已收敛 |
| BFN-pretrain | `best_loss_model_step61440`（`val/loss` 0.2120） | 71.21 | 0.5789 | 0.8904 | 0.8423 | 已收敛 |
| BFN-finetune | `best_loss_model_step81920`（`val/loss` 0.2182） | **71.52** | **0.5846** | **0.9128** | **0.6753** | 已收敛 |
| BFN-residual | `best_loss_model_step135168`（`val/loss` 0.2134） | 71.50 | 0.5840 | 0.9054 | 0.7280 | 已收敛 |

已完成的 BFN baseline、pretrain、finetune、residual 四个 setting 的 pLDDT 非常接近（≈71.2–71.5），说明生成序列都较好保留了query 骨架。baseline 与 pretrain 的 TM-score 略低（0.8924 / 0.8904 vs ≈0.91）、RMSD 略高（0.9074 / 0.8423 vs 0.68/0.73），即其结构对 query 的贴合度稍逊于 finetune / residual，但差距有限。

**DFM**：DFM-abs-baseline / pretrain / finetune / residual、DFM-uni-baseline 与 DFM-abs2uni-finetune / residual 均已有 checkpoint、验证结构指标和 test 生成评分；DFM-uni-pretrain / finetune / residual 的下游 g 实验仍未发现对应 run。

| Setting | `val/loss` 最优 checkpoint | pLDDT ↑ | pTM ↑ | TM-score ↑ | RMSD ↓ | 状态 |
|---------|-----------------------------|--------:|------:|-----------:|-------:|------|
| DFM-abs-baseline | `best_loss_model_step126976.ckpt`（`val/loss` 0.0193） | 71.362 | 0.5820 | 0.8790 | 0.8677 | 已收敛 |
| DFM-abs-pretrain | `best_loss_model_step126976.ckpt`（`val/loss` 0.0194） | 71.186 | 0.5790 | 0.9041 | 0.6843 | 已收敛 |
| DFM-abs-finetune | `best_loss_model_step131072.ckpt`（`val/loss` 0.0197） | 71.067 | 0.5754 | 0.8699 | 1.0087 | 已收敛 |
| DFM-abs-residual | `best_loss_model_step229376.ckpt`（`val/loss` 0.0199） | 71.312 | 0.5782 | 0.9075 | 0.7107 | 已收敛 |
| DFM-uni-baseline | `best_loss_model_step126976.ckpt`（`val/loss` 0.0274） | 71.125 | 0.5715 | 0.8700 | 1.1430 | 已收敛 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | 下游 g 实验未发现 run |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | 下游 g 实验未发现 run |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | 下游 g 实验未发现 run |
| DFM-abs2uni-finetune | `best_loss_model_step126976.ckpt`（`val/loss` 0.0281） | 70.831 | 0.5677 | 0.8378 | 1.2366 | 已收敛 |
| DFM-abs2uni-residual | `best_loss_model_step126976.ckpt`（`val/loss` 0.0285） | 71.213 | 0.5793 | 0.8958 | 0.8056 | 已收敛 |

#### B.2.5 评估模型训练

为独立评估"g 是否真的生成了符合目标 fitness 的序列"，需要训练一个**外部 fitness 预测器**，对生成序列预测 `score_pred_z`。评估器复用项目自身的 `SeqScoreModule`（DiT-35M backbone + 回归头，加载 ESM-2 t12-35M 参数初始化），在 ProteinGYM train 划分上以 per-assay z-score fitness 为回归目标训练。这里对比了 B.1.2 定义的 delta 与 joint 两个 setting，日志目录分别为 `proteingym_seq_score_delta_dit35m` 与 `proteingym_seq_score_joint_dit35m`。

| 项目 | 详情 |
|------|------|
| **模型** | `SeqScoreModule`（DiT-35M backbone + 回归头，ESM-2 t12-35M 初始化） |
| **训练数据** | ProteinGYM 217 个 DMS assay 的 train 划分（与 g 训练数据相同） |
| **标签** | 真实 fitness 的 per-assay z-score（`score`） |
| **优化器 / LR** | AdamW，peak lr `2e-5`，`PolyNomialLR`（warmup 500 step，`power=0.3`，衰减至 `1e-6`），weight_decay `1e-12` |
| **checkpoint / 早停** | `monitor=val/spearman, mode=max, patience=5`；best ckpt 按 `val/spearman` 取最优 |
| **评估指标** | val/test Spearman ρ ≥ 0.5 视为可用；预测头唯一被监控与选点的指标为 Spearman（Pearson 因 bf16 下 `pearson_corrcoef` 数值溢出全程记录为 `nan`，评估以 Spearman 为准） |

**训练结果**：两者 test split 打分口径一致（全体样本拉平算全局 Spearman；因 `score` 已按 assay 内 z-score 标准化到同一量纲，跨 assay 拉平仍可比）。

| Setting | 训练进度 | val/best_spearman | test/spearman | val/loss 趋势 | 判定 |
|---------|---------|------------------:|--------------:|--------------|------|
| **delta**（推荐） | 12 epoch（≈41k step） | **0.812**（epoch5 / step20480） | **0.813** | 0.607 → 0.30，稳定下降 | 强预测器，可用 |
| joint | 9 epoch（≈37k step） | 0.022 | 0.022 | 1.05↔1.00 几乎不动 | 几乎无信号，不可用 |

best ckpt 为 `best_spearman_model_step20480.ckpt`（后续 B.2.6 的 `score_pred_z` 打分即使用该权重）。

##### B.2.5.1 训练曲线

![任务一评估模型（delta/joint）训练曲线](figures/g_task1_proteingym_eval_predictor_curves.png)

三张子图分别为 `val/spearman`、`val/loss`（均按 epoch 对齐）与 `train/loss`（按 global_step，y 轴 log scale）。读图要点：

- **delta**：`val/spearman` 第 1 epoch 即达 0.62，第 5 epoch 升到峰值 0.812 后在 0.72–0.80 间小幅震荡；`val/loss` 从 0.607 单调降到 ≈0.30，`train/loss` 从 1.31 降到 ≈0.14，属正常收敛。末尾 epoch11 的 `val/spearman` 掉到 0.60 是采样噪声，不影响 best ckpt（已固定在 step20480）。
- **joint**：`val/spearman` 全程贴着 0 抖动（[-0.03, 0.02]），`val/loss` 卡在 ≈1.0（即预测恒等于均值 0 的平凡解），几乎没有学到 wt→mut 的差异信号。

##### B.2.5.2 该评估器是否足以支撑评估

围绕"这个 predictor 能否作为裁判"给出结论：

1. **delta 足以作为可信裁判。** test Spearman 0.813 属强相关水平，远高于阈值 0.5，且训练曲线稳定收敛、best ckpt 明确。相比任务二 FireProtDB 的 delta predictor（test spearman 仅 0.147），本任务裁判质量高一个量级——原因在于 ProteinGYM 的 `score` 已做 per-assay z-score，跨 assay 拉平后量纲一致，全局 Spearman 不被蛋白间尺度差异稀释。
2. **joint 不可用。** 其 `net(mut, wt)` 一次前向的参数化在本任务上坍缩到"恒输出均值"的平凡解（loss≈1.0、spearman≈0），因此 ProteinGYM 评估统一采用 delta。
3. **对 B.2.6 结论的支撑。** 裁判本身很强（0.81），按测量衰减关系 `observed_corr ≈ true_control_corr × r_predictor`，强裁判（r≈0.81）会近乎无损地传递真实控制信号。因此 B.2.6 中 finetune / residual 观察到的显著正相关（Spearman 0.48 / 0.61）是生成端真实可控性的体现，而非评估器引入的假象。
4. **口径边界。** 该 predictor 只被验证为可靠的"相对排序 / 条件遵循"裁判（Spearman 强）；因 Pearson 未能可靠记录，单条序列 `score_pred_z` 的绝对数值不宜过度解读，评估应以排序 / 相关性口径为主。

#### B.2.6 最终评估指标

本节采用外部 score predictor 对生成序列打分，评估口径从“生成序列 score 越高越好”修正为“生成序列预测 score 是否接近给定的目标 score”。具体指标为：

$$
\text{error} = \left|\text{score\_pred\_z}(x_{gen}) - \text{query\_fields.score}\right|
$$

其中 `query_fields.score` 是条件输入的目标 fitness z-score，`generated[].metrics.score_pred_z` 是生成序列经过外部 predictor 得到的预测 score。评分脚本对每个 test jsonl 通过 `BUDGET_N=1000` 做长度分层抽样，8 个 rank 文件合计每个已完成 setting 评估 8,000 条样本。BFN 已完成的 baseline / pretrain / finetune / residual、DFM-abs-baseline / pretrain / finetune / residual、DFM-uni-baseline 与 DFM-abs2uni-finetune / residual 均已完成评分并共用同一抽样口径；DFM-uni-pretrain 结果待补。其中 DFM-abs-baseline 的八个 rank 分片位于相邻的两个同批次 run 目录，汇总时合并统计。DFM-uni-finetune / residual 尚待训练和评分。

**ProteinGYM score 的生物学含义与边界**：ProteinGYM DMS 中的 `raw_score` 是每个 DMS assay 原始报告的变异效应 / fitness readout；本项目使用的 `score` 是在每个 assay 内按 train split 做 z-score 标准化后的值，即 `(raw_score - assay_train_mean) / assay_train_std`。因此它不是单一物理量，而是跨 assay 标准化后的功能表型信号。当前生成器与 predictor 均未显式输入 `assay_id`；对于共享相同 WT 的不同 assay，它们无法仅凭序列区分实验背景。因此 `score_pred_z` 不应被解释为完全 assay-specific 的 phenotype 预测，而应理解为当前输入可辨识范围内的跨 assay 标准化信号。

**整体误差与相关性**：

| Setting | MAE ↓ | RMSE ↓ | Median AE ↓ | Q75 AE ↓ | within 0.25 ↑ | within 0.5 ↑ | within 1.0 ↑ | Pearson ↑ | Spearman ↑ | 零编辑占比 ↓ |
|---------|------:|-------:|------------:|---------:|--------------:|-------------:|-------------:|----------:|-----------:|------------:|
| BFN-baseline | 0.5993 | 0.8791 | 0.3936 | 0.8492 | 37.33% | 57.65% | 79.99% | 0.5562 | 0.5915 | **0.33%** |
| BFN-pretrain | 0.5987 | 0.8772 | 0.3957 | 0.8570 | 36.51% | 57.96% | 80.01% | 0.5716 | 0.6005 | 0.99% |
| BFN-finetune | 0.6881 | 0.9736 | 0.4883 | 0.9933 | 32.12% | 50.96% | 75.26% | 0.4552 | 0.4826 | 2.31% |
| BFN-residual | 0.5983 | 0.8690 | 0.4037 | 0.8488 | 36.68% | 57.04% | 80.03% | 0.5805 | 0.6122 | 6.04% |
| DFM-abs-baseline | **0.4617** | **0.7143** | **0.2724** | **0.6355** | **47.15%** | **67.65%** | **87.25%** | **0.7101** | **0.7471** | 0.38% |
| DFM-abs-pretrain | 0.4888 | 0.7334 | 0.3023 | 0.6826 | 44.24% | 64.94% | 85.85% | 0.6943 | 0.7215 | **0.26%** |
| DFM-abs-finetune | 0.5718 | 0.8477 | 0.3690 | 0.8131 | 38.41% | 59.33% | 81.86% | 0.5948 | 0.6316 | 1.35% |
| DFM-abs-residual | 0.4456 | 0.6726 | 0.2707 | 0.6144 | 47.45% | 68.91% | 88.43% | 0.7406 | 0.7643 | 1.84% |
| DFM-uni-baseline | 0.5172 | 0.7701 | 0.3401 | 0.7297 | 40.91% | 62.19% | 85.02% | 0.6616 | 0.6997 | 7.11% |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 0.5963 | 0.8650 | 0.3997 | 0.8600 | 36.29% | 56.43% | 80.23% | 0.5996 | 0.6369 | 8.88% |
| DFM-abs2uni-residual | 0.4992 | 0.7409 | 0.3309 | 0.6993 | 41.61% | 63.94% | 85.95% | 0.6862 | 0.7246 | 4.48% |

BFN 已完成的 baseline、pretrain、finetune、residual 四个 setting 的 Pearson / Spearman 均为显著正值：BFN-residual 达到 0.5805 / 0.6122，BFN-pretrain 为 0.5716 / 0.6005，BFN-baseline 为 0.5562 / 0.5915，BFN-finetune 为 0.4552 / 0.4826；内部排序为 residual > pretrain > baseline > finetune。当前已完成 DFM setting 的 Spearman / Pearson 分别为 DFM-abs-residual 0.7643 / 0.7406、DFM-abs-baseline 0.7471 / 0.7101、DFM-abs-pretrain 0.7215 / 0.6943、DFM-abs2uni-residual 0.7246 / 0.6862、DFM-uni-baseline 0.6997 / 0.6616、DFM-abs2uni-finetune 0.6369 / 0.5996、DFM-abs-finetune 0.6316 / 0.5948；DFM-abs 组内排序为 residual > baseline > pretrain > finetune，residual 除零编辑占比外的九列指标均为当前矩阵最优。该排序可用于当前 setting 的阶段性比较，完整的 transition 与参数化归因仍需等待其余 DFM-uni setting。`零编辑占比`方面，DFM-abs-pretrain、DFM-abs-baseline、DFM-abs-finetune、DFM-abs-residual、DFM-abs2uni-residual、DFM-uni-baseline、DFM-abs2uni-finetune 分别为 0.26%、0.38%、1.35%、1.84%、4.48%、7.11%、8.88%；BFN baseline、pretrain、finetune、residual 分别为 0.33%、0.99%、2.31%、6.04%。

**目标分桶**（各列为对应 target score 分组的生成序列预测 score 均值；五档 target mean 依次为 -1.3796、-0.6181、0.0617、0.6757、1.2618）：

| Setting | lowest 20% | 20%-40% | 40%-60% | 60%-80% | highest 20% |
|---------|-----------:|--------:|--------:|--------:|------------:|
| BFN-baseline | -0.7304 | -0.2752 | 0.0229 | 0.3980 | 0.6448 |
| BFN-pretrain | -0.7312 | -0.2464 | 0.0799 | 0.4249 | 0.7079 |
| BFN-finetune | -0.5661 | -0.1930 | 0.0477 | 0.3807 | 0.5673 |
| BFN-residual | -0.7167 | -0.2781 | 0.0902 | 0.4586 | 0.7337 |
| DFM-abs-baseline | -0.8636 | -0.3879 | 0.0350 | 0.4916 | 0.8135 |
| DFM-abs-pretrain | -0.8691 | -0.3992 | 0.0045 | 0.4727 | 0.7832 |
| DFM-abs-finetune | -0.7736 | -0.3406 | 0.0687 | 0.4327 | 0.6978 |
| DFM-abs-residual | -0.8887 | -0.3583 | 0.0593 | 0.5295 | 0.8350 |
| DFM-uni-baseline | -0.8027 | -0.3661 | 0.0328 | 0.4656 | 0.8014 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | -0.7928 | -0.3671 | 0.0138 | 0.4564 | 0.8069 |
| DFM-abs2uni-residual | -0.8510 | -0.4089 | 0.0351 | 0.4836 | 0.8140 |

BFN 已完成的 baseline、pretrain、finetune、residual 四个 setting 的 `pred mean` 均随 `target mean` 单调上升，其中 BFN-baseline、BFN-pretrain 与 BFN-residual 的跨度大于 BFN-finetune，与其更高的 Pearson / Spearman 一致；BFN-pretrain 的两端跨度为 -0.7312→0.7079。DFM-abs-baseline、DFM-abs-pretrain、DFM-abs-finetune、DFM-abs-residual、DFM-abs2uni-finetune 与 DFM-abs2uni-residual 的五档均值也均单调上升，两端跨度分别为 -0.8636→0.8135、-0.8691→0.7832、-0.7736→0.6978、-0.8887→0.8350、-0.7928→0.8069 和 -0.8510→0.8140；其中 DFM-abs-residual 的两端跨度最大，DFM-abs-pretrain 的两端跨度接近 DFM-abs-baseline，中间三档同样单调过渡。DFM-uni-baseline 的五档均值为 -0.8027、-0.3661、0.0328、0.4656、0.8014，随 target score 单调上升，但整体跨度和中间斜率仍需结合其 Spearman=0.6997 解读。

**生成序列自身预测 score 的分布**：

| Setting | mean score_pred_z | median | Q75 | positive fraction | top10% mean | max |
|---------|------------------:|-------:|----:|------------------:|------------:|----:|
| BFN-baseline | 0.0120 | 0.0078 | 0.6562 | 50.08% | 1.4164 | 9.5000 |
| BFN-pretrain | 0.0470 | 0.0625 | 0.6875 | 52.55% | 1.4745 | 10.0000 |
| BFN-finetune | 0.0473 | 0.0625 | 0.6562 | 52.29% | 1.4650 | 10.1875 |
| BFN-residual | 0.0575 | 0.0312 | 0.6875 | 50.89% | 1.5138 | 10.8750 |
| DFM-abs-baseline | 0.0177 | 0.0156 | 0.6484 | 50.38% | 1.4133 | 11.1250 |
| DFM-abs-pretrain | -0.0016 | 0.0156 | 0.6455 | 50.25% | 1.3724 | 10.1250 |
| DFM-abs-finetune | 0.0170 | 0.0156 | 0.6562 | 50.43% | 1.4445 | 8.6875 |
| DFM-abs-residual | 0.0354 | 0.0312 | 0.6563 | 51.18% | 1.3830 | 10.6875 |
| DFM-uni-baseline | 0.0262 | 0.0000 | 0.6563 | 47.62% | 1.4187 | 10.8750 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 0.0234 | 0.0000 | 0.6875 | 45.89% | 1.6054 | 9.6250 |
| DFM-abs2uni-residual | 0.0146 | 0.0000 | 0.6719 | 48.88% | 1.4005 | 9.7500 |

各 setting 的整体预测 score 分布接近（mean 约 0.00–0.06，positive fraction 约 46%–52%），均不是把分布整体推高的“高分偏置”模式；结合分桶与相关性，主要信号来自随目标 score 的响应。DFM-abs-baseline / pretrain / finetune / residual 与 DFM-abs2uni 两个条件 setting 的分布同样以 0 为中心；DFM-abs-residual 的 mean / median / Q75 为 0.0354 / 0.0312 / 0.6563，positive fraction 为 51.18%，与其他 DFM-abs setting 处于同一范围；其他 DFM setting 补齐后可进一步比较不同 transition family 的分布差异。

从生物学解释上看，可控性生效意味着给定更高目标 fitness z-score 时，生成序列被外部 ProteinGYM predictor 判断为具有更高的跨 assay 标准化表型信号。由于生成器和 predictor 均未显式输入 `assay_id`，对于共享 WT 的不同实验不能将该信号解释为“在对应 assay 中”的完全 assay-specific 预测。这里仍是 predictor-based 结论，最终需要真实实验验证。

<a id="appendix-b-2-7"></a>

#### B.2.7 考虑 predictor 误差后的条件 following 能力（去衰减估计）

B.2.6 报告的是**目标 score 与 predictor 预测值**之间的 Spearman 相关。predictor 在天然 ProteinGYM test 变异上的 Spearman 为 0.813，可用经典测量误差关系作近似去衰减；该计算对 Spearman 并不严格，只用于量级估计。

记目标 score 为 $T$，生成序列真实 fitness 为 $F$，predictor 输出为 $\hat F$。在 $\hat F=F+\varepsilon$ 且误差与 $T$ 独立的理想假设下：

$$
\rho_{\text{true}} \approx \frac{\rho_{\text{obs}}}{\rho_{\text{pred}}}.
$$

| Setting | $\rho_{\text{obs}}$ | $\rho_{\text{pred}}$ | 去衰减近似 |
|---------|---------------------:|----------------------:|-----------:|
| BFN-residual | 0.6122 | 0.813 | 0.753 |
| BFN-pretrain | 0.6005 | 0.813 | 0.739 |
| DFM-abs-baseline | 0.7471 | 0.813 | 0.919 |
| DFM-abs-pretrain | 0.7215 | 0.813 | 0.887 |
| DFM-abs-finetune | 0.6316 | 0.813 | 0.777 |
| DFM-abs-residual | 0.7643 | 0.813 | 0.940 |
| DFM-abs2uni-residual | 0.7246 | 0.813 | 0.891 |

BFN-residual 的近似值约 0.75，BFN-pretrain 约 0.74；DFM-abs baseline / pretrain / finetune / residual 的近似值分别约为 0.92 / 0.89 / 0.78 / 0.94；DFM-abs2uni-residual 约为 0.89。由于 $\rho_{\text{pred}}\le 1$，在理想误差假设成立时，相应观测相关可视作各自 setting 的近似下界；这不是无条件的统计保证。

**前提与风险：**

1. 去衰减公式对 Pearson 相关有明确测量误差解释，对 Spearman 秩相关只是近似。
2. 0.813 是 predictor 在天然 test 变异上测得的可靠性；生成序列存在分布漂移，且 predictor 可能产生与目标相关的系统偏差。
3. predictor 与生成器均未显式输入 `assay_id`，共享 WT 的不同 assay 不可辨识。
4. DFM-abs2uni-residual 是 absorbing 预训练到 uniform 下游的跨 transition transfer setting，其估计不能外推到 DFM-abs 或 DFM-uni。

**结论。** BFN-residual 的去衰减近似约为 0.75；DFM-abs-residual 约为 0.94，是当前已完成 setting 中最高值，其后为 DFM-abs-baseline 的 0.92；DFM-abs-pretrain 与 DFM-abs2uni-residual 均约为 0.89，DFM-abs-finetune 约为 0.78。上述数值仍是 predictor-based 的近似推断，不能直接外推到未完成的其他参数化、transition setting，严格证实仍需要独立实验和真实实验测量。

<a id="appendix-b-3"></a>

### B.3 任务二：FireProtDB 热稳定性预测

#### B.3.1 数据集上的可控生成内容

- **数据来源**：FireProtDB 2.0（http://loschmidt.chemi.muni.cz/fireprotdb/）
- **样本量**：本任务使用 FireProtDB 的 ΔΔG 突变子集（`measurement=ddg`），按蛋白切分为 train 7,869 / val 503 / test 582 条突变记录（合计 8,954 条）
- **控制目标 g**："对给定 wt_seq 做编辑，使其热稳定性 ΔΔG 提高 / 达到目标值"
- **g 标签 y**：连续 ΔΔG 值（kcal/mol）

#### B.3.2 g 训练实验

四个 setting（baseline / pretrain / finetune / residual，定义见 B.1.1）均以 BFN 为生成框架（`beta=1.0`，`loss_func=l_infty_decay`），DiT-35M backbone，条件注入 `cond_on_attn=true` + `cond_on_score=true`，标签为基于 FireProtDB train split 全体样本统计量计算的 global ΔΔG z-score（`cont_vars.score`，dim=1），并非 per-protein z-score。共用训练配置如下：

| 项目 | 详情 |
|------|------|
| **g 架构** | DiT-35M（12×480）backbone + score 条件头 |
| **g 输入** | (xₜ, wt_seq, target ΔΔG z-score) |
| **g 输出** | score 修正项（同 f 维度） |
| **训练数据划分** | 按蛋白切分（train 7,869 / val 503 / test 582） |
| **优化器 / LR** | AdamW，peak lr `5e-4`，weight_decay `1e-12`，amsgrad；PolyNomialLR（warmup 500，power 0.3，lr_end 1e-5） |
| **早停 / 验证** | `monitor=val/loss, mode=min, patience=5, min_delta=0`；每 4 epoch 验证一次 |

四者的初始化 / 可训练部分差异与新版训练进度：

| Setting | 初始化 / 可训练部分 | 训练进度 | 最优 val/loss | 最优 checkpoint |
|---------|--------------------|----------|--------------:|-----------------|
| BFN-baseline | ESM2 t12-35M 初始化，全权重训练 | epoch 51 / global step 2007 | 0.2017（CSV validation step 773） | `best_loss_model_step774.ckpt` |
| BFN-pretrain | 加载 f 预训练 BFN-35M（`step966656`），全权重训练 | epoch 51 / global step 2012 | 0.1959（CSV validation step 773） | `best_loss_model_step774.ckpt` |
| BFN-finetune | 加载 f 预训练 BFN-35M（`step966656`），冻结 backbone | epoch 91 / global step 3559 | 0.2061（CSV validation step 2783） | `best_loss_model_step2784.ckpt` |
| BFN-residual | 冻结 f 预训练 BFN-150M（`step544768`）base + 可训练残差 | epoch 51 / global step 2007 | **0.1846**（CSV validation step 773） | `best_loss_model_step774.ckpt` |

结构指标均取上述 `best_loss_model_*` 对应的同一条 `val/loss` 最低验证记录。本任务为突变编辑，生成序列与 query 高度相似，故指标接近饱和、区分度有限：

| 指标 | BFN-baseline | BFN-pretrain | BFN-finetune | BFN-residual |
|------|-------------:|-------------:|-------------:|-------------:|
| plddt ↑ | 78.67 | 78.44 | 78.86 | **79.13** |
| ptm ↑ | 0.8621 | 0.8578 | 0.8621 | **0.8675** |
| tm_score ↑ | 0.9971 | 0.9960 | 0.9976 | **0.9989** |
| rmsd ↓ | 0.1311 | 0.1626 | 0.1280 | **0.0564** |

**小结**：residual 的验证生成损失最低（0.1846），且其冻结 base 采用更大的 BFN-150M 先验，符合“大 f + 小残差”设计；在各自 best-loss checkpoint 上，residual 的四项结构指标也最好。但这些指标接近饱和，只反映可折叠性和与 query 的结构相似性，不能据此推断条件控制能力。四个 BFN setting 的实际条件遵循能力应以 B.3.5 的 test 生成结果为准。

**DFM 补充。** 本任务已完成 DFM-uni-baseline、DFM-abs2uni-finetune / residual，以及 DFM-abs baseline / pretrain / finetune / residual 的训练、test 生成和实验查表；DFM-abs 四个 setting 的最低 `val/loss` 分别为 baseline 0.0371、pretrain 0.0466、finetune 0.0484、residual 0.0432。其 test 实验 ΔΔG 查表结果已汇总至 B.3.5。

| Setting | val/loss ↓ | pLDDT ↑ | pTM ↑ | TM-score ↑ | RMSD ↓ |
|---------|-----------:|--------:|------:|-----------:|-------:|
| DFM-abs-baseline | **0.0371** | 79.14 | 0.8667 | **0.9992** | **0.0325** |
| DFM-abs-pretrain | 0.0466 | 79.06 | 0.8668 | 0.9971 | 0.1248 |
| DFM-abs-finetune | 0.0484 | 77.70 | 0.8454 | 0.9945 | 0.2169 |
| DFM-abs-residual | 0.0432 | 79.15 | **0.8674** | 0.9973 | 0.1101 |
| DFM-uni-baseline | 0.0652 | 79.15 | 0.8673 | 0.9976 | 0.1242 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 0.0706 | 78.92 | 0.8628 | 0.9983 | 0.0981 |
| DFM-abs2uni-residual | 0.0592 | 79.23 | 0.8692 | 0.9994 | 0.0451 |

同 BFN，这些结构/可折叠性指标接近饱和，只反映生成序列保留 query 骨架，不能据此推断条件控制能力；DFM 的实际条件遵循能力仍以 B.3.5 的 test 查表结果为准。

##### B.3.2.1 训练曲线

**BFN**：

![任务二四个 setting 训练曲线对比（BFN）](figures/g_task2_fireprotdb_train_curves_compare.png)

**x 轴统一为“分数 epoch”**（`global_step / steps_per_epoch`）。图中展示 baseline、pretrain、finetune、residual 四个 run，每 epoch 约 39 step。baseline、pretrain 与 residual 训练至约 epoch 51，finetune 训练至约 epoch 91；pretrain 的最优 checkpoint 为 `best_loss_model_step774.ckpt`。

**读图要点**：

- **train/loss、train/acc**：四个 run 的训练 acc 均在约 0.994–0.996 的窄区间内，训练侧差异有限；finetune 的训练轮数更多。
- **val/loss**：residual 在 epoch 19 / step773 达到四个 setting 中最低的 0.1846；pretrain、baseline 在同一 step 分别达到 0.1959、0.2017；finetune 在 epoch 71 / step2783 达到 0.2061。四个 setting 后期均未带来持续的验证损失改善。
- **结构/可折叠性指标**：plddt 约为 79、ptm 约为 0.86–0.87、tm_score 接近 1.0、rmsd 较低，反映生成结果高度保留 query 骨架；这些近饱和指标不是区分条件控制效果的可靠依据。

**DFM-abs**：

![任务二四个 setting 训练曲线对比（DFM-abs）](figures/g_task2_fireprotdb_train_curves_compare_dfm_abs.png)

图中以同一分数 epoch 口径对比 DFM-abs baseline、pretrain、finetune 与 residual。四个 setting 的最低 `val/loss` 分别为 0.0371、0.0466、0.0484、0.0432；baseline 最低，residual 次之。结构指标整体接近饱和，其实际条件遵循能力仍以 B.3.5 的实验 ΔΔG 查表为准。

#### B.3.3 评估模型训练

评估器复用项目自身的 `SeqScoreModule`（DiT-35M backbone + 回归头），在 FireProtDB train 划分上以 ΔΔG z-score 为回归目标训练，用于对生成序列独立预测条件值 `score_pred_z`。此处对比了 B.1.2 定义的 delta 与 joint 两个 setting，日志目录分别为 `fireprotdb_seq_score_delta_dit35m_ddg` 与 `fireprotdb_seq_score_joint_dit35m_ddg`。

两者的 checkpoint 均按 `val/spearman` 取最优（`best_spearman_model_*`），test split 共 582 条（多蛋白混合）。核心性能如下（Spearman 的 95% 置信区间按 Fisher z 变换在 n=582 下给出）：

| Setting | val/best_spearman | test/spearman（95% CI） | test/pearson | val/loss 趋势 | 判定 |
|---------|------------------:|:------------------------|-------------:|--------------|------|
| **delta**（两者较优） | 0.173 | **0.147**  [0.067, 0.226]，p≈3e-4 | 0.154 | 0.87→0.83，缓慢下降、收敛稳定 | 显著非零但很弱 |
| joint | 0.190 | 0.092  [0.011, 0.172]，p≈0.026 | 0.049 | 2.09↔1.69 剧烈波动 | 过拟合 + 几乎无信号 |

##### B.3.3.1 训练曲线

![任务二评估模型（delta/joint）训练曲线](figures/g_task2_fireprotdb_eval_predictor_curves.png)

三张子图分别为 `val/spearman`、`val/loss`（按 epoch 对齐）与 `train/loss`（按 `global_step`，纵轴为对数刻度）。图中直接读取 `logs/property_predict/fireprotdb` 下的 delta/joint 日志；验证点按日志实际记录的 epoch 展示。delta 的验证 Spearman 从 0.134 逐步升至最佳 0.173，验证 loss 约从 0.87 降至 0.83；joint 在首个验证点达到 0.190 后回落，验证 loss 在 1.59–2.17 间波动。

**关键观察**：

1. **joint 严重过拟合**：其 `val/best_spearman=0.190` 出现在最早的 epoch 105 / step4096，之后一路下滑到 0.13–0.16，best ckpt 就是第一个存点；test pearson 仅 0.049（≈0），基本不可用。
2. **delta 是两者中唯一稳定收敛的**，但 pearson=0.154 意味着仅能解释目标约 2.4% 的方差（r²≈0.024）。先前的 predictor 分析使用 delta 的 `best_spearman_model_step24576.ckpt`；最终生成评估已改用 B.3.5 的实验 ΔΔG 查表。

#### B.3.4 评估器是否足以支撑评估（可信度分析）

围绕"这个 predictor 的性能是否足以支撑它作为裁判"这一核心问题，给出分层结论：

1. **作为「绝对打分器」：不够格。** test spearman 0.147 / pearson 0.154 太低，单条序列 `score_pred_z` 的绝对值几乎不可信，不能据此断言"某条生成序列 score 高 = 它真的更稳定"。
2. **不再用于最终生成评估。** 先前基于 `score_pred_z` 的生成端 MSE、MAE 与相关性仅反映弱 predictor 的输出，现已由 B.3.5 中对 FireProtDB test 原始实验 ΔΔG 的直接查表结果替代。
3. **方法学缺陷（可能低估了 predictor）**：`seq_score.py` 的 `_epoch_metrics` 把 582 条跨多个蛋白的样本**全部拉平算一个全局 Spearman**。ddG 领域标准是 per-protein Spearman 再平均——混池会因蛋白间 ΔΔG 尺度差异引入偏移噪声，**系统性压低**相关性。故 0.147 很可能低估了 predictor 在"同一蛋白内区分突变好坏"的真实分辨力，而可控生成主要吃的正是这个蛋白内分辨力。

**结论**：当前 delta predictor **不足以作为可信的绝对评估器**，其训练结果仅保留为历史记录。B.3.5 仅使用可精确命中的 FireProtDB test 实验 ΔΔG；对于无法查表的生成序列，不再以 predictor 值替代真实标签。

#### B.3.5 最终评估指标（实验 ΔΔG 查表）

不再使用 `aggregate_metrics.mean_score_pred_z` 作为生成序列的 ΔΔG。对每个已完成 setting 的两个 rank test JSONL，以 `(query_seq, target_seq, query_fields.score)` 去重：原始输入均为 582 条，其中 38 条为重复记录，得到 544 条唯一生成序列。全部唯一记录均能回连至 FireProtDB 的同一 test split 目标突变；生成候选仅在满足以下条件时计入真实实验评估：与 `query_seq` 等长、恰好 1 个氨基酸替换，并能以 `(protein_id, wt_seq, generated_seq)` 在该 test 原始表中唯一命中。

对第 $i$ 个可查生成序列，令 $d_i^{\mathrm{target}}$ 与 $d_i^{\mathrm{gen}}$ 分别为目标和生成突变的原始实验 ΔΔG（kcal/mol），计算：

$$
\mathrm{MSE}=\frac{1}{N_{\mathrm{eval}}}\sum_{i=1}^{N_{\mathrm{eval}}}(d_i^{\mathrm{gen}}-d_i^{\mathrm{target}})^2,\qquad
\mathrm{MAE}=\frac{1}{N_{\mathrm{eval}}}\sum_{i=1}^{N_{\mathrm{eval}}}|d_i^{\mathrm{gen}}-d_i^{\mathrm{target}}|
$$

| Setting | 唯一生成 N | 恰好 1 编辑 | 单编辑查表命中 | 可评估 N（占全部） | 实验 ΔΔG MSE ↓ | 实验 ΔΔG MAE ↓ | Pearson r | Spearman ρ |
|---------|-----------:|------------:|----------------:|------------------:|----------------:|----------------:|----------:|-----------:|
| BFN-baseline | 544 | 154（28.31%） | 11 / 154（7.14%） | 11（2.02%） | 6.0278 | 1.6109 | -0.2704 | 0.0046 |
| BFN-pretrain | 544 | 116（21.32%） | 3 / 116（2.59%） | 3（0.55%） | 0.5147 | 0.6533 | 0.4595 | 0.5000 |
| BFN-finetune | 544 | 152（27.94%） | 4 / 152（2.63%） | 4（0.74%） | 1.0248 | 0.9400 | 0.7859 | 1.0000 |
| BFN-residual | 544 | 149（27.39%） | 8 / 149（5.37%） | 8（1.47%） | 5.1669 | 1.8013 | -0.3150 | -0.4286 |
| DFM-abs-baseline | 544 | 125（22.98%） | 2 / 125（1.60%） | 2（0.37%） | 4.9554 | 1.7700 | 1.0000 | 1.0000 |
| DFM-abs-pretrain | 544 | 169（31.07%） | 13 / 169（7.69%） | 13（2.39%） | 2.1163 | 0.9869 | -0.0776 | -0.0865 |
| DFM-abs-finetune | 544 | 58（10.66%） | 2 / 58（3.45%） | 2（0.37%） | 0.7897 | 0.8400 | 1.0000 | 1.0000 |
| DFM-abs-residual | 544 | 117（21.51%） | 2 / 117（1.71%） | 2（0.37%） | 15.9250 | 3.1500 | -1.0000 | -1.0000 |
| DFM-uni-baseline | 544 | 124（22.79%） | 7 / 124（5.65%） | 7（1.29%） | 8.0500 | 2.7286 | 0.1352 | 0.0000 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 544 | 85（15.63%） | 3 / 85（3.53%） | 3（0.55%） | 0.7667 | 0.8667 | 0.8532 | 0.5000 |
| DFM-abs2uni-residual | 544 | 142（26.10%） | 11 / 142（7.75%） | 11（2.02%） | 3.3567 | 1.4745 | -0.4158 | -0.4389 |

已完成 setting 的目标记录均可回连，单编辑未命中与实验标签歧义则不参与误差。因可评估样本仅为 2–13 条，表中的相关性不作显著性检验，也不能据此对各 setting 作可靠排序；尤其 BFN-finetune 的 ρ=1.0000（4 对）、DFM-abs2uni-finetune 的 r=0.8532（3 对），以及已完成的 DFM-abs setting 的 |r|=|ρ|=1.0000（各 2 对）都只来自极小样本，不能视为连续条件控制证据。

**补充 setting：多编辑逐位拆解为单突变。** 对每个与 `query_seq` 等长、且至少有一个编辑的生成序列，在每个变化位点单独构造“WT 序列 + 该位点生成残基”的单突变候选；因此一个有 $K$ 个替换的生成序列贡献 $K$ 个候选。候选仍只在相同 `protein_id`、同一 test split 的实验表中唯一命中时计分，且均与该生成记录的目标实验 ΔΔG 比较。该 setting 的每个候选是模型从多编辑输出中隐含提出的单点设计，**不是**原始多编辑序列的真实组合 ΔΔG；同一原始序列拆出的候选和同一目标下的候选彼此相关，不能按独立样本处理。

| Setting | 拆解来源序列（单编辑 / 多编辑） | 单突变候选（来自多编辑） | 实验命中 N（占候选） | 实验 ΔΔG MSE ↓ | 实验 ΔΔG MAE ↓ | Pearson r | Spearman ρ |
|---------|--------------------------------:|-------------------------:|---------------------:|----------------:|----------------:|----------:|-----------:|
| BFN-baseline | 411（154 / 257） | 982（828） | 31（3.16%） | 3.9650 | 1.3710 | -0.1293 | 0.1172 |
| BFN-pretrain | 473（116 / 357） | 1802（1686） | 54（3.00%） | 7.4433 | 1.7243 | -0.2115 | 0.0254 |
| BFN-finetune | 405（152 / 253） | 913（761） | 17（1.86%） | 1.5396 | 0.9718 | 0.0600 | 0.1373 |
| BFN-residual | 400（149 / 251） | 887（738） | 47（5.30%） | 4.1877 | 1.5700 | -0.1018 | -0.0159 |
| DFM-abs-baseline | 464（125 / 339） | 1512（1387） | 32（2.12%） | 9.5578 | 2.4416 | 0.1282 | 0.0478 |
| DFM-abs-pretrain | 474（169 / 305） | 1367（1198） | 56（4.10%） | 3.9230 | 1.4537 | 0.2538 | 0.1701 |
| DFM-abs-finetune | 519（58 / 461） | 2915（2857） | 53（1.82%） | 2.4162 | 1.0662 | -0.0178 | 0.0014 |
| DFM-abs-residual | 474（117 / 357） | 1389（1272） | 22（1.58%） | 4.6371 | 1.6823 | 0.3963 | 0.5106 |
| DFM-uni-baseline | 524（124 / 400） | 2327（2203） | 100（4.30%） | 4.1362 | 1.6152 | 0.2444 | 0.0863 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 531（85 / 446） | 2024（1939） | 74（3.66%） | 6.4424 | 1.8572 | 0.0591 | 0.0812 |
| DFM-abs2uni-residual | 440（142 / 298） | 1203（1061） | 89（7.40%） | 3.2942 | 1.3908 | 0.1060 | 0.0194 |

逐位拆解将可查候选从严格 setting 的 2–11 条增加至 17–100 条，但候选命中率仍仅为 1.58%–7.40%。因此该表仅作为“多编辑输出中单点设计倾向”的补充描述；MSE、MAE 与相关性不应被解释为原始多编辑序列的稳定性，亦不用于对各 setting 作显著性或优劣排序。

**结论**：

1. **严格查表仍不能支持强条件控制结论。** 原始生成序列层面的真实实验覆盖率为 0.55%–2.02%；逐位拆解虽可增加候选数，但同一生成序列和同一目标会贡献多个相关候选，仍不足以形成独立的 setting 间比较。不再报告 predictor 推断的全覆盖 MSE、MAE 与五分位响应。
2. **单点突变先验没有被稳定复现。** 各 setting 的恰好 1 编辑率均偏低（BFN 约 27.39%–28.31%，DFM 约 15.63%–26.10%），其余输出不是 WT 回退就是多编辑。逐位拆解可衡量多编辑输出隐含的单点候选，但不能产生这些多编辑序列的真实组合 ΔΔG。
3. **实验候选覆盖仍然偏低。** 严格单编辑中仅 2.63%–7.75% 可唯一查表；加入多编辑拆解后，候选命中率为 1.86%–7.40%，说明多数生成替换不在 FireProtDB test 的已测变体中，或落在实验 ΔΔG 有冲突的变体上。

**下一步（按优先级）**：

1. 在采样时强制相对 WT 恰好 1 个替换，并优先从同一蛋白已测量的 test 变体集合中选取替换；分别报告严格单点生成质量、逐位拆解候选质量与查表覆盖率。
2. 对未测量的单点和多编辑序列保留为候选设计；多编辑输出可报告逐位拆解查表，但不能将该统计或 predictor 输出称为原始多编辑序列的真实 ΔΔG。
3. 补充包含组合突变的 held-out 实验数据，或按每个蛋白收集更完整的单点测量，再评估连续目标响应。

#### B.3.6 编辑数量与查表覆盖分布

数据集中的编辑数定义为预处理后 `wt_seq` 与 `mut_seq` 的等长 Hamming 距离。为与 B.3.5 的真实查表口径一致，生成序列按 `(query_seq, target_seq, query_fields.score)` 去重后统计；与 query 长度不同的输出单列为长度不一致，等长输出以 Hamming 距离计数。

**数据集编辑数。** 当前预处理会过滤掉截断后 WT 与 mutant 相同的记录；保留记录全部是单氨基酸替换。因此，模型看到的三个 split 的目标编辑数分布完全一致：

| Split | N | 0 编辑 | 1 编辑 | ≥2 编辑 |
|-------|--:|-------:|-------:|--------:|
| train | 7,869 | 0（0.0%） | 7,869（100.0%） | 0（0.0%） |
| val | 503 | 0（0.0%） | 503（100.0%） | 0（0.0%） |
| test | 582 | 0（0.0%） | 582（100.0%） | 0（0.0%） |
| 合计 | 8,954 | 0（0.0%） | 8,954（100.0%） | 0（0.0%） |

**生成序列编辑与可评估性。** 每个已完成 setting 均有 544 条唯一生成序列；单编辑“未命中”包括原始表中没有该变体的样本，“歧义”表示同一查找键对应多个不同实验 ΔΔG：

| Setting | 0 编辑 | 1 编辑 | 多编辑 | 长度不一致 | 单编辑未命中 | 单编辑歧义 | 可查实验 ΔΔG |
|---------|-------:|-------:|-------:|-----------:|-------------:|-----------:|--------------:|
| BFN-baseline | 132（24.26%） | 154（28.31%） | 257（47.24%） | 1（0.18%） | 138 | 5 | 11（2.02%） |
| BFN-pretrain | 66（12.13%） | 116（21.32%） | 357（65.62%） | 5（0.92%） | 105 | 8 | 3（0.55%） |
| BFN-finetune | 139（25.55%） | 152（27.94%） | 253（46.51%） | 0（0.00%） | 142 | 6 | 4（0.74%） |
| BFN-residual | 144（26.47%） | 149（27.39%） | 251（46.14%） | 0（0.00%） | 134 | 7 | 8（1.47%） |
| DFM-abs-baseline | 80（14.71%） | 125（22.98%） | 339（62.32%） | 0（0.00%） | 120 | 3 | 2（0.37%） |
| DFM-abs-pretrain | 70（12.87%） | 169（31.07%） | 305（56.07%） | 0（0.00%） | 141 | 15 | 13（2.39%） |
| DFM-abs-finetune | 25（4.60%） | 58（10.66%） | 461（84.74%） | 0（0.00%） | 54 | 2 | 2（0.37%） |
| DFM-abs-residual | 70（12.87%） | 117（21.51%） | 357（65.63%） | 0（0.00%） | 111 | 4 | 2（0.37%） |
| DFM-uni-baseline | 20（3.68%） | 124（22.79%） | 400（73.53%） | 0（0.00%） | 95 | 22 | 7（1.29%） |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 13（2.39%） | 85（15.63%） | 446（81.99%） | 0（0.00%） | 79 | 3 | 3（0.55%） |
| DFM-abs2uni-residual | 104（19.12%） | 142（26.10%） | 298（54.78%） | 0（0.00%） | 121 | 10 | 11（2.02%） |

**讨论**：

1. **生成编辑数与训练目标分布不匹配。** 训练数据的每条记录都对应恰好 1 个替换，而各 setting 满足该约束的生成序列偏少（BFN 27.39%–28.31%，DFM 15.63%–26.10%）；DFM 尤其偏向多编辑（54.78%–81.99%），BFN 的多编辑比例为 46.14%–47.24%，两框架均有大量输出落在单点突变标签空间之外。
2. **高序列相似度不等于可实验评估。** 部分输出回退至 WT（DFM-abs2uni-residual 达 19.12%），近半到八成输出超出单点突变数据的标签空间；即使限制到单编辑，两框架仍有大量单编辑无法唯一命中实验表。
3. **当前结果优先暴露采样约束问题，而非 setting 间性能差异。** 真实查表的样本覆盖率过低，MSE、MAE 和相关性只能作为少量已测变体的描述性统计，不能取代更受约束的生成实验。
4. **后续应显式建模编辑预算与实验候选空间。** 对该单点突变数据集，可在采样时加入相对 WT 的恰好 1 编辑约束，并将位点与替换残基限制到有实验标签的候选集；评估时同时报告“恰好 1 编辑率”、单编辑查表命中率和全体可评估率。

<a id="appendix-b-4"></a>

### B.4 任务三：MaveDB 变异效应预测

#### B.4.1 数据集上的可控生成内容

- **数据来源**：MaveDB（https://www.mavedb.org/），大规模多 assay 变异效应数据库
- **样本量**：> 7M 测量，覆盖 1000+ assay
- **控制目标 g**：对 wt_seq 做编辑，使其在多种功能指标（表达、活性、结合等）上达到目标值
- **g 标签 y**：连续功能 score（每个 assay 一个维度），模型需同时接收目标 score 向量与 assay_id 以区分不同实验的功能表型
- **g 的角色**：学习 assay-aware 的序列编辑策略，在已知 assay 身份的条件下按目标 score 修改序列
- **拓展价值**：MaveDB 覆盖数百种蛋白、上千个功能 assay，天然支持多任务、多条件联合可控生成；相比单 assay 的 ProteinGYM，可验证 g 是否能在不同蛋白、不同表型维度间迁移控制能力

<a id="appendix-b-5"></a>

### B.5 任务四：OMA 跨物种序列生成

#### B.5.1 数据集上的可控生成内容

- **数据来源**：OMA OrthologTransformer 数据集（https://github.com/mana438/OrthologTransformer），基于 OMA 同源组数据库构建
- **样本量**：约 4.97M 同源对，覆盖 2138 个细菌物种
- **控制目标 g**：对给定的祖先序列或同源序列做编辑，使其适配目标物种的氨基酸偏好
- **g 标签 y**：离散物种 ID（one-hot 或 embedding），模型需学习物种特异性的蛋白质序列偏好
- **g 的角色**：学习物种特异性的保守位点、氨基酸组成和同源序列模式，将输入序列推向目标物种的序列空间
- **拓展价值**：跨物种可控生成为蛋白质设计开辟了"物种适配"这一新维度——可验证 g 是否能提取物种级序列偏好信号，并在未见物种间泛化；适合作为离散标签条件的代表性任务

<a id="appendix-b-6"></a>

### B.6 任务五：DeepGOPlus GO term 预测

#### B.6.1 数据集上的可控生成内容

- **数据来源**：DeepGOPlus / SwissProt 蛋白质功能注释数据库
- **样本量**：约 66,841 训练样本，覆盖 5,220 个 GO term（含 MF / BP / CC 三类）
- **控制目标 g**：生成一段蛋白序列，使其具备给定的 GO term 组合，即同时满足若干分子功能（MF）、生物过程（BP）和细胞组分（CC）标注
- **g 标签 y**：多标签 GO 向量（5,220 维 0/1），每条序列可对应多个 GO term
- **g 的角色**：学习序列模式与功能标注之间的映射，在去噪过程中按目标功能向量引导序列生成
- **拓展价值**：高维多标签条件（5,220 维）是当前已开展任务中最复杂的条件空间；可验证 g 能否从稀疏标签中提取结构化功能语义，并生成满足指定功能组合的序列；天然适配 de novo 生成场景

<a id="appendix-b-7"></a>

### B.7 任务六：Multiplex therapeutic peptide 多属性生成

#### B.7.1 数据集上的可控生成内容

- **数据来源**：Multiplex therapeutic peptide 数据集，收集多种治疗性肽的活性与理化属性标注
- **样本量**：约 58,583 条肽序列，标注 15 类活性（抗菌、抗真菌、抗癌等）和 47 类理化属性（毒性、稳定性、溶解度等）
- **控制目标 g**：生成一段治疗性肽，使其同时具备给定的活性谱（如抗菌+抗真菌）和属性谱（如低毒性+高稳定性）
- **g 标签 y**：多标签向量（15 + 47 = 62 维 0/1），同时编码活性类别与理化属性
- **g 的角色**：联合控制多类生物活性与理化属性，在去噪过程中按目标属性谱引导肽序列生成
- **拓展价值**：多属性联合控制是最接近实际药物设计需求的任务——真实场景中治疗性肽需同时满足活性、毒性、稳定性等多个约束；可验证 g 能否在不破坏某一属性条件的前提下同时达成另一属性目标，即多目标之间的解耦控制能力

<a id="appendix-b-8"></a>

### B.8 任务七：Ortlund DMS IgG1Fc–FcγR 抗体亲和力

#### B.8.0 评估模型训练

为独立评估生成序列是否遵循 6 个 FcγR 受体的目标 `logKa` 谱，训练外部 `SeqScoreModule` 对每个突变的 6 维 `logKa` 进行回归。数据按突变位点划分为 train 2,611、val 851 和 held-out test 891 个变体；模型使用 DiT-35M backbone，并比较 `delta` 与 `joint` 两种参数化。checkpoint 按 `val/spearman` 选择，Ortlund 的多维指标按 6 个受体分别计算后等权平均，不能与后续生成查表中的 pooled Spearman 混用。

| 项目 | 详情 |
|------|------|
| **模型** | `SeqScoreModule`（DiT-35M backbone + 6 维回归头，ESM-2 t12-35M 初始化） |
| **训练数据** | Ortlund DMS train split，2,611 个单点变体 |
| **标签** | 6 个 FcγR 受体的 `logKa`，按 train split 统计量标准化 |
| **验证 / 测试数据** | val 851 个变体；held-out test 891 个变体，突变位点不重叠 |
| **checkpoint** | `monitor=val/spearman, mode=max`；两种 setting 均使用各自最佳 `val/spearman` checkpoint 测试 |
| **评估指标** | 每个受体独立计算 Pearson/Spearman 后取等权平均；同时保留逐受体 test 结果 |

| Predictor | best val mean-receptor Spearman ↑ | test mean-receptor Spearman ↑ | test mean-receptor Pearson ↑ | test Spearman 范围 | 判定 |
|-----------|----------------------------------:|--------------------------------:|-------------------------------:|------------------:|------|
| **delta** | **0.180** | **0.226** | **0.242** | 0.122–0.283 | 弱排序信号，不作为最终裁判 |
| joint | 0.210 | 0.150 | 0.194 | 0.098–0.222 | test 泛化较弱，不采用 |

##### B.8.0.1 训练曲线

![任务七评估模型（delta/joint）训练曲线](figures/g_task7_ortlund_dms_eval_predictor_curves.png)

三张子图分别为 `val/spearman`、`val/loss`（按 epoch 对齐）与 `train/loss`（按 `global_step`，纵轴为对数刻度）。图中直接读取 `logs/property_predict/ortlund_dms` 下的 delta/joint 日志；验证 Spearman 和 loss 均为六个 FcγR 受体逐受体指标的等权汇总口径。delta 的验证 Spearman 从 0.038 上升至最佳 0.180，随后在 0.15–0.18 附近波动；joint 在 epoch 79 达到 0.210 后持续回落，验证 loss 同期由约 1.06 上升至 1.36，表现出明显过拟合。该曲线与表中的 best val 和 held-out test 指标保持相同的预测器口径。

**逐受体 held-out test 结果**：

| 受体 | delta Spearman | delta Pearson | joint Spearman | joint Pearson |
|------|---------------:|--------------:|---------------:|--------------:|
| FcγR2a-131H | 0.263 | 0.284 | 0.222 | 0.238 |
| FcγR2a-131R | 0.220 | 0.239 | 0.146 | 0.159 |
| FcγR2b | 0.199 | 0.201 | 0.098 | 0.084 |
| FcγR3a-158F | 0.267 | 0.273 | 0.170 | 0.217 |
| FcγR3a-158V | 0.283 | 0.306 | 0.160 | 0.241 |
| FcγR1 | 0.122 | 0.148 | 0.103 | 0.225 |

**评估器可信度结论**：`delta` 在两个 setting 中相对更好，但 test mean-receptor Spearman 仅为 0.226，且最强受体的 Spearman 也只有 0.283；`joint` 的 test mean-receptor Spearman 为 0.150。该性能不足以支撑对未测生成序列的连续 `logKa` 外推，因此最终结果只使用 DMS 查表命中的真实实验标签。查表法本身也只对已测编辑有效，未命中的生成序列不能被当作实验性质进行补值。

#### B.8.1 数据集与评估口径

- **数据来源**：Ortlund DMS IgG1Fc 抗体亲和力数据集。目标为 6 个 FcγR 受体 `FcγR2a-131H`、`FcγR2a-131R`、`FcγR2b`、`FcγR3a-158F`、`FcγR3a-158V` 与 `FcγR1` 的结合亲和力 `logKa`。
- **WT / 变体**：WT Fc 序列来自 `Fc_prot.fasta`，长度为 232；预处理后共 4,353 个单点变体。
- **划分**：使用按突变位点划分的 `fold_site_5`，`test_fold_index=0`、`val_fold_index=1`，训练、验证、测试集分别为 2,611、851、891 个变体。不同 split 的突变位点互不重叠。
- **生成记录**：BFN 的 baseline / pretrain / finetune / residual 已纳入统一 setting 矩阵并完成评估。已完成的 DFM-abs baseline / pretrain / finetune / residual、DFM-uni-baseline 和 DFM-abs2uni 两个 setting 均包含 test 891 条、val 851 条唯一目标记录；具体去重口径见对应结果小节。
- **条件方向**：`query_seq` 是 WT Fc 序列，`target_seq` 是 DMS 单点突变目标；`query_fields.logKa` 是该目标突变的 6 维条件向量。每个受体的 `logKa` 仅使用 train split 的有效标签计算均值与总体标准差后标准化。

##### B.8.1.1 原始 `logKa` 分布

以下统计直接读取六个受体目录下的 `KD_Output/mutation_to_Ka.csv`，使用项目预处理相同的 `(site, to_aa)` 合并键；数值为原始 `logKa`，未做标准化。合并后共有 4,353 个单点变体，六个受体共有 25,974 个有效的变体×受体标签。表中 `n` 为该受体的有效标签数，`缺失` 为相对 4,353 个合并变体缺少或无效的标签数；`std` 使用总体标准差（`ddof=0`）。

| 受体 | n | 缺失 | 均值 | std | 最小值 | Q1 | 中位数 | Q3 | 最大值 |
|------|--:|----:|-----:|----:|-------:|---:|--------:|---:|-------:|
| FcγR2a-131H | 4,304 | 49 | 6.656435 | 0.230992 | 5.104386 | 6.567211 | 6.703605 | 6.800551 | 7.537914 |
| FcγR2a-131R | 4,336 | 17 | 6.362504 | 0.194181 | 5.452431 | 6.262586 | 6.369560 | 6.462900 | 8.040132 |
| FcγR2b | 4,329 | 24 | 5.835749 | 0.152566 | 5.200000 | 5.749092 | 5.834035 | 5.910000 | 6.923235 |
| FcγR3a-158F | 4,335 | 18 | 6.308954 | 0.159391 | 5.432750 | 6.236766 | 6.329760 | 6.399696 | 7.047506 |
| FcγR3a-158V | 4,342 | 11 | 6.360064 | 0.220511 | 5.250000 | 6.248437 | 6.393183 | 6.506246 | 7.020000 |
| FcγR1 | 4,328 | 25 | 6.449037 | 0.105040 | 5.510000 | 6.439836 | 6.471082 | 6.496720 | 7.010000 |
| **合并全部有效标签** | **25,974** | — | **6.328491** | **0.307171** | **5.104386** | **6.159626** | **6.389421** | **6.503962** | **8.040132** |

![Ortlund DMS 原始 logKa 分布](figures/ortlund_dms_logka_distribution.png)

图中上方为六个受体的密度直方图，虚线表示各受体均值；左下为不显示极端离群点的箱线图，右下为 4,353 个合并变体上的标签覆盖情况。分布上，FcγR2a-131H 的中心位置最高（中位数 6.703605），FcγR2b 最低（5.834035）；FcγR1 的离散程度最小（std=0.105040，IQR=0.056884），而 FcγR3a-158V 的 IQR 最大（0.257809）。FcγR2a-131R 的最大值 8.040132 明显高于其上四分位数，提示该受体存在少量高值尾部。由于不同受体的整体位置和尺度不同，后续多受体条件建模仍应使用按 train split 统计量得到的逐受体标准化标签，而不应直接把 pooled 分布当作单一性质分布。

最终评估由 `scripts/run/eval/ortlund_dms_eval_lookup.py` 完成。目标条件来自按位点划分的 held-out test split，但脚本将生成序列相对 WT 的每一个编辑映射到 train/val/test 合并后的完整 DMS 查找表，并在该编辑与目标突变共同有效的受体维度上计算误差。因此 held-out 指目标条件位点，不能理解为所有命中的生成编辑也都来自 test split：

- **sequence_weighted_mse / sequence_weighted_mae ↓**：先在每个编辑的有效受体维度上平均误差，再在一条生成序列的可查编辑间平均，最后对可评估生成序列平均。
- **pooled_receptor_spearman ↑**：汇总全部有效的 序列×受体 配对，对目标 `logKa` 与生成编辑的实测 `logKa` 计算 Spearman 相关性。
- **mean_receptor_spearman ↑**：分别计算 6 个受体的 Spearman 后取平均。
- **seq_identity ↑**：生成序列与 WT query 的逐位点一致率，仅作为编辑幅度参考。
- **evaluable_rate / hit_rate ↑**：前者为至少存在一个可查 DMS 编辑的生成序列比例；后者为所有生成编辑位点中可由 DMS 表查到的比例。

以下以从未参与 checkpoint 选择的 held-out test split 为主结果；val split 仅用于辅助观察，不能作为泛化性能结论。

#### B.8.2 当前训练结果

本节训练曲线覆盖 BFN 与 DFM-abs 的 DiT-35M 四个 setting；DFM-uni-baseline 与 DFM-abs2uni-finetune / residual 的查表结果已并入 B.8.3–B.8.5。DFM-abs baseline / pretrain / finetune / residual 已完成训练、生成和查表评估；DFM-uni-finetune / residual 仍待补齐。以下先列出 BFN run 的日志摘要：

| Setting | 训练终点 | 最优 val/loss | 最优 checkpoint | pLDDT ↑ | pTM ↑ | TM-score ↑ | RMSD ↓ |
|---------|---------:|--------------:|-----------------|--------:|------:|-----------:|-------:|
| BFN-baseline | epoch 63 / step 576 | 0.1407（CSV validation step 215） | `best_loss_model_step216.ckpt` | **75.74** | **0.7747** | **1.0000** | **0.0000** |
| BFN-pretrain | epoch 103 / step 935 | 0.1334（CSV validation step 575） | `best_loss_model_step576.ckpt` | 75.53 | 0.7696 | 0.9738 | 0.9115 |
| BFN-finetune | epoch 143 / step 1296 | 0.1397（CSV validation step 935） | `best_loss_model_step936.ckpt` | 75.45 | 0.7650 | 0.9864 | 0.5958 |
| BFN-residual | epoch 63 / step 576 | **0.1317**（CSV validation step 215） | `best_loss_model_step216.ckpt` | 75.61 | 0.7737 | 0.9864 | 0.5804 |

各结构指标均取表内 `best_loss_model_*` 对应的同一条 `val/loss` 最低验证记录。

**DFM-abs（DiT-35M）**：四个 setting 均使用 `absorbing` 下游transition。表中结构指标来自 best-loss checkpoint 的 rank-0 test 分片，因未跨 rank 聚合，只作为参考。

| Setting | 最优 val/loss | 最优 checkpoint | rank-0 test pLDDT ↑ | pTM ↑ | TM-score ↑ | RMSD ↓ |
|---------|--------------:|-----------------|--------------------:|------:|-----------:|-------:|
| DFM-abs-baseline | **0.023145** | `best_loss_model_step432.ckpt` | 75.455 | 0.772 | 0.993 | 0.390 |
| DFM-abs-pretrain | 0.027214 | `best_loss_model_step648.ckpt` | 75.588 | 0.771 | 0.996 | 0.261 |
| DFM-abs-finetune | 0.025264 | `best_loss_model_step648.ckpt` | 75.654 | 0.774 | 0.997 | 0.205 |
| DFM-abs-residual | 0.025061 | `best_loss_model_step432.ckpt` | **75.688** | **0.775** | **0.998** | **0.144** |

**BFN**：

![任务七四个 setting 训练曲线对比（BFN）](figures/g_task7_ortlund_dms_train_curves_compare.png)

图中纳入 baseline、pretrain、finetune 与 residual 四个 setting。训练曲线横轴按各 run 的 `global_step / steps_per_epoch` 归一化为分数 epoch；验证曲线按实际验证 epoch 绘制。`train/loss` 与 `train/acc` 显示训练过程，`val/loss`、pLDDT、pTM、TM-score 与 RMSD 来自每 8 个 epoch 一次的验证采样。

**DFM-abs**：

![任务七四个 setting 训练曲线对比（DFM-abs）](figures/g_task7_ortlund_dms_train_curves_compare_dfm_abs.png)

图中使用相同口径对比 DFM-abs baseline、pretrain、finetune 与 residual。灰色阴影为同一 run 的局部日志波动，不代表多随机种子的置信区间。结构指标只反映可折叠性和与 WT 的结构相似性，不替代 DMS 查表的条件遵循评估；baseline 的接近完美结构相似性也可能来自 WT 回退，而非更好的条件遵循。

生成损失只能反映重构训练目标，不直接等价于 DMS 条件遵循；已完成 setting 的最终比较以 B.8.3 的 held-out test 查表结果为准。

#### B.8.3 最终评估指标

**目标条件来自 held-out test split（N=891 条唯一记录）**：BFN、DFM-abs、DFM-uni-baseline 与 DFM-abs2uni 采用同一评估脚本和目标条件。DFM-abs 每个 setting 合并两个 test rank 文件的 892 条输入后，去除 1 条 DDP padding 重复记录；DFM-abs finetune / residual 的 f checkpoint 与下游均为 absorbing，DFM-abs2uni 则为 absorbing f checkpoint 与 uniform 下游 transition。DFM-uni-finetune / residual 结果待补。生成编辑的查表边界见 B.8.1。

| Setting | sequence weighted MSE ↓ | sequence weighted MAE ↓ | pooled Spearman ↑ | mean receptor Spearman ↑ | seq identity ↑ | 可评估序列 | evaluable rate ↑ | hit rate ↑ | 零编辑 / 单编辑 / 多编辑 |
|---------|------------------------:|------------------------:|------------------:|-------------------------:|---------------:|-----------:|-----------------:|-----------:|-------------------------:|
| BFN-baseline | 4.917 | 1.854 | -0.373 | -0.500 | **0.99998** | 3 | 0.34% | 3/4 = 0.750 | 886 / 4 / 0 |
| BFN-pretrain | 1.900 | 0.990 | 0.079 | 0.075 | 0.99503 | 600 | 67.34% | 1019/1024 = 0.995 | 288 / 304 / 296 |
| BFN-finetune | 1.153 | 0.778 | 0.291 | 0.274 | 0.99253 | 700 | 78.56% | 1535/1544 = 0.994 | 188 / 292 / 411 |
| BFN-residual | 1.734 | 0.941 | 0.110 | 0.097 | 0.99387 | 672 | 75.42% | 1256/1267 = 0.991 | 216 / 308 / 367 |
| DFM-abs-baseline | 2.019 | 1.042 | 0.028 | 0.021 | 0.99437 | 635 | 71.27% | 1150/1159 = 0.992 | 249 / 313 / 326 |
| DFM-abs-pretrain | 1.096 | 0.744 | 0.473 | 0.449 | 0.99543 | 579 | 64.98% | 940/943 = 0.997 | 311 / 325 / 254 |
| DFM-abs-finetune | 1.513 | 0.879 | 0.259 | 0.241 | **0.99314** | **638** | **71.60%** | 1406/1417 = 0.992 | 248 / 317 / 325 |
| DFM-abs-residual | 1.290 | 0.816 | 0.356 | 0.338 | 0.99464 | 634 | 71.16% | 1104/1107 = 0.997 | 256 / 314 / 321 |
| DFM-uni-baseline | 1.026 | 0.739 | 0.523 | 0.495 | 0.99646 | 482 | 54.10% | 728/731 = 0.996 | 408 / 311 / 172 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | **0.711** | **0.573** | **0.658** | **0.632** | 0.99926 | 124 | 13.92% | 151/152 = 0.993 | 764 / 110 / 15 |
| DFM-abs2uni-residual | 1.167 | 0.780 | 0.434 | 0.413 | 0.99813 | 311 | 34.90% | **386/386 = 1.000** | 580 / 243 / 68 |

BFN-baseline 有 1 条、BFN-pretrain 有 3 条、DFM-abs2uni-finetune 有 2 条、DFM-abs-baseline 有 3 条、DFM-abs-pretrain 有 1 条、DFM-abs-finetune 有 1 条长度不匹配，其余已完成 setting 无。BFN-baseline 在 test 上仅有 3 条可评估序列，误差与相关性无统计可比性；其接近 1 的序列一致率来自几乎完全回退到 WT。DFM-abs-pretrain 在已完成的 DFM-abs setting 中最优（MSE 1.096、MAE 0.744、pooled Spearman 0.473），DFM-abs-residual 次之（1.290 / 0.816 / 0.356），DFM-abs-finetune 为 1.513 / 0.879 / 0.259，且三者可评估率均约 65%–71%。DFM-abs-baseline 的 pooled Spearman 仅 0.028。全部已完成 DFM setting 中，DFM-abs2uni-finetune 的 pooled Spearman 最高（0.658），DFM-uni-baseline 为 0.523，DFM-abs-pretrain 为 0.473，DFM-abs2uni-residual 为 0.434。

**Val split（辅助结果，N=851 条唯一记录）**：

| Setting | sequence weighted MSE ↓ | sequence weighted MAE ↓ | pooled Spearman ↑ | mean receptor Spearman ↑ | 可评估序列 | evaluable rate ↑ | hit rate ↑ |
|---------|------------------------:|------------------------:|------------------:|-------------------------:|-----------:|-----------------:|-----------:|
| BFN-baseline | — | — | — | — | 0 | 0.00% | — |
| BFN-pretrain | 1.515 | 0.860 | 0.336 | 0.320 | 667 | 78.38% | 1286/1289 = 0.998 |
| BFN-finetune | 1.360 | 0.816 | 0.359 | 0.341 | 604 | 70.98% | 1220/1226 = 0.995 |
| BFN-residual | 1.740 | 0.950 | 0.203 | 0.188 | 669 | 78.61% | 1246/1253 = 0.994 |
| DFM-abs-baseline | 1.311 | 0.797 | 0.483 | 0.460 | 456 | 53.58% | 634/635 = 0.998 |
| DFM-abs-pretrain | 0.820 | 0.619 | 0.656 | 0.642 | 574 | 67.45% | 946/946 = 1.000 |
| DFM-abs-finetune | 1.351 | 0.814 | 0.416 | 0.400 | **579** | **68.04%** | 1197/1199 = 0.998 |
| DFM-abs-residual | 1.157 | 0.719 | 0.495 | 0.471 | 428 | 50.29% | **652/652 = 1.000** |
| DFM-uni-baseline | 0.642 | 0.550 | **0.802** | **0.783** | 404 | 47.47% | 584/584 = 1.000 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | **0.582** | **0.484** | 0.666 | 0.640 | 345 | 40.54% | 458/458 = 1.000 |
| DFM-abs2uni-residual | 0.798 | 0.606 | 0.744 | 0.721 | **467** | **54.88%** | 694/694 = 1.000 |

合并 test 与 val 的去重后 overall 口径为 1,742 条记录：新 DFM-abs-baseline、finetune、residual 的 MSE / MAE / pooled Spearman 分别为 1.723 / 0.940 / 0.229、1.436 / 0.848 / 0.334、1.236 / 0.777 / 0.414。由于 val 参与模型选择，overall 只用于完整性统计，不替代 test 结论。

#### B.8.4 按受体的 held-out test 结果

下表对 test split 中可评估的生成序列按受体拆分。BFN-baseline 每个受体仅有 3 个配对，数值已从日志汇总，但仅作记录，不列入横向比较。

**BFN（DiT-35M）逐受体 test**：

| 受体 | baseline MSE ↓ | baseline MAE ↓ | baseline Spearman ↑ | pretrain MSE ↓ | pretrain MAE ↓ | pretrain Spearman ↑ | finetune MSE ↓ | finetune MAE ↓ | finetune Spearman ↑ | residual MSE ↓ | residual MAE ↓ | residual Spearman ↑ |
|------|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|
| FcγR2a-131H | 6.531 | 2.162 | -0.500 | 1.825 | 0.996 | 0.098 | **1.086** | **0.766** | **0.253** | 1.679 | 0.931 | 0.086 |
| FcγR2a-131R | 2.742 | 1.628 | -0.500 | 1.993 | 1.053 | 0.032 | **1.302** | **0.848** | **0.282** | 1.853 | 1.017 | 0.102 |
| FcγR2b | 1.330 | 1.100 | -0.500 | 2.134 | 1.057 | -0.008 | **1.250** | **0.836** | **0.258** | 1.766 | 0.987 | 0.099 |
| FcγR3a-158F | 4.768 | 1.917 | -1.000 | 1.856 | 1.004 | 0.125 | **1.101** | **0.796** | **0.308** | 1.686 | 0.961 | 0.105 |
| FcγR3a-158V | 2.611 | 1.329 | -1.000 | 1.750 | 1.018 | 0.102 | **1.042** | **0.776** | **0.388** | 1.610 | 0.969 | 0.145 |
| FcγR1 | 11.521 | 2.991 | 0.500 | 1.830 | 0.811 | 0.102 | **1.101** | **0.633** | **0.157** | 1.759 | 0.760 | 0.044 |

BFN 内部 finetune 在全部 6 个受体上均取得更低的 MSE、MAE 与更高的 Spearman；相对排序在各受体上保持一致，其中 FcγR3a-158V 的条件排序信号最强，FcγR1 最低。

**DFM-uni（DiT-35M）逐受体 test**：

| 受体 | baseline MSE ↓ | baseline MAE ↓ | baseline Spearman ↑ | pretrain MSE ↓ | pretrain MAE ↓ | pretrain Spearman ↑ | finetune MSE ↓ | finetune MAE ↓ | finetune Spearman ↑ | residual MSE ↓ | residual MAE ↓ | residual Spearman ↑ |
|------|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|
| FcγR2a-131H | 0.929 | 0.700 | 0.474 | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| FcγR2a-131R | 1.244 | 0.828 | 0.556 | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| FcγR2b | 1.175 | 0.811 | 0.542 | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| FcγR3a-158F | 1.076 | 0.788 | 0.533 | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| FcγR3a-158V | 0.838 | 0.729 | 0.592 | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| FcγR1 | 0.858 | 0.568 | 0.271 | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |

**DFM-abs2uni（DiT-35M）逐受体 test**：

| 受体 | pretrain MSE ↓ | pretrain MAE ↓ | pretrain Spearman ↑ | finetune MSE ↓ | finetune MAE ↓ | finetune Spearman ↑ | residual MSE ↓ | residual MAE ↓ | residual Spearman ↑ |
|------|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|---------------:|---------------:|--------------------:|
| FcγR2a-131H | [待补充] | [待补充] | [待补充] | 0.828 | 0.605 | 0.545 | 1.069 | 0.766 | 0.467 |
| FcγR2a-131R | [待补充] | [待补充] | [待补充] | 0.789 | 0.612 | **0.712** | 1.357 | 0.870 | 0.414 |
| FcγR2b | [待补充] | [待补充] | [待补充] | 0.687 | 0.637 | 0.560 | 1.267 | 0.829 | 0.436 |
| FcγR3a-158F | [待补充] | [待补充] | [待补充] | 0.534 | 0.549 | 0.719 | 1.101 | 0.775 | 0.493 |
| FcγR3a-158V | [待补充] | [待补充] | [待补充] | **0.459** | **0.513** | **0.801** | 0.995 | 0.756 | 0.479 |
| FcγR1 | [待补充] | [待补充] | [待补充] | 1.002 | 0.542 | 0.455 | 1.059 | 0.629 | 0.188 |

DFM-uni-baseline 与两个 DFM-abs2uni setting 在全部 6 个受体上的 Spearman 都为正。DFM-abs2uni-finetune 在多数受体上记录到更低误差和更高相关性（FcγR3a-158V 为 0.801）；DFM-uni-baseline 在各受体上保持 0.27–0.59 的正相关。

**新 DFM-abs（DiT-35M）逐受体 test Spearman**：pretrain 在六个受体上均为四者最高，FcγR3a-158V 的排序信号最强，FcγR1 最弱。

| 受体 | baseline ↑ | pretrain ↑ | finetune ↑ | residual ↑ |
|------|-----------:|-----------:|-----------:|-----------:|
| FcγR2a-131H | 0.047 | 0.436 | 0.183 | 0.338 |
| FcγR2a-131R | 0.033 | 0.500 | 0.296 | 0.330 |
| FcγR2b | -0.010 | 0.442 | 0.259 | 0.326 |
| FcγR3a-158F | -0.016 | 0.502 | 0.264 | 0.374 |
| FcγR3a-158V | 0.028 | 0.537 | 0.338 | 0.435 |
| FcγR1 | 0.046 | 0.278 | 0.108 | 0.222 |

#### B.8.5 编辑行为统计

下表为 held-out test split（N=891）的编辑行为。

| Setting | 零编辑 | 单编辑 | 多编辑 | 总编辑位点 | 可查编辑位点 | 不可查编辑位点 |
|---------|-------:|-------:|-------:|-----------:|-------------:|---------------:|
| BFN-baseline | 886 | 4 | 0 | 4 | 3 | 1 |
| BFN-pretrain | 288 | 304 | 296 | 1,024 | 1,019 | 5 |
| BFN-finetune | 188 | 292 | 411 | 1,544 | 1,535 | 9 |
| BFN-residual | 216 | 308 | 367 | 1,267 | 1,256 | 11 |
| DFM-abs-baseline | 249 | 313 | 326 | 1,159 | 1,150 | 9 |
| DFM-abs-pretrain | 311 | 325 | 254 | 943 | 940 | 3 |
| DFM-abs-finetune | 248 | 317 | 325 | 1,417 | 1,406 | 11 |
| DFM-abs-residual | 256 | 314 | 321 | 1,107 | 1,104 | 3 |
| DFM-uni-baseline | 408 | 311 | 172 | 731 | 728 | 3 |
| DFM-uni-pretrain | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-finetune | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-uni-residual | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] | [待补充] |
| DFM-abs2uni-finetune | 764 | 110 | 15 | 152 | 151 | 1 |
| DFM-abs2uni-residual | 580 | 243 | 68 | 386 | 386 | 0 |

训练数据均为单点突变。BFN-finetune / BFN-residual 在目标条件 test 记录中产生大量多编辑序列，覆盖率高但引入较多离数据分布的组合编辑；BFN-pretrain 的零/单/多编辑分布为 288/304/296，编辑位点查表命中率 99.5%。已完成 DFM-abs baseline / pretrain / finetune / residual 的零/单/多编辑分布分别为 249/313/326、311/325/254、248/317/325、256/314/321，单编辑与多编辑均占较大比例；其编辑位点查表命中率为 99.2%–99.7%。DFM-abs2uni 两个 setting 的零/单/多编辑分布为 764/110/15 和 580/243/68。后续应在所有 DFM setting 中统一加入相对 WT 的单点 edit budget。

#### B.8.6 结论

1. **DFM-abs-pretrain 在已完成的 DFM-abs setting 中最好。** 在 held-out test 上，其 MSE / MAE / pooled Spearman 为 1.096 / 0.744 / 0.473，六个受体相关性均为正；residual 为 1.290 / 0.816 / 0.356，finetune 为 1.513 / 0.879 / 0.259，baseline 为 2.019 / 1.042 / 0.028。
2. **DFM-abs 的覆盖率足够但相关性尚未超过 DFM-uni-baseline。** pretrain / finetune / residual 的 evaluable rate 约为 65%–72%，其中最高的 pretrain Spearman 0.473 仍低于 DFM-uni-baseline 的 0.523；因此当前无法称 absorbing transition family 在该任务上整体更优。
3. **DFM-abs2uni 是有效的跨 transition transfer setting。** DFM-abs2uni-finetune 的 pooled Spearman 0.658 为当前已完成 DFM setting 中最高值；补齐 DFM-uni-finetune / residual 后可进一步进行受控归因。
4. **BFN-baseline 不适合条件生成比较。** 99.4% 的目标条件记录输出未发生编辑，只有 3 条样本可被查表评估，其高 sequence identity 仅反映 WT 回退。
5. **评估边界仍需收紧。** 当前目标条件来自 held-out test，但生成编辑可在完整 DMS 表中命中；下一步应完成 DFM-uni-finetune / residual、多随机种子和单点 edit budget 复评，并报告生成编辑来源 split。

### B.9 g 训练综合对比表

| 任务 | 数据集 | 数据规模 | g 标签形式 | 选用 g setting | 评估模型（setting） | 主要指标 | 备注 |
|------|--------|----------|------------|----------------|---------------------|----------|------|
| DMS 变异预测 | ProteinGYM | 2.7M | 连续 score | BFN 四 setting、DFM-abs 四 setting、DFM-uni-baseline 与 DFM-abs2uni 两 setting 已评估；DFM-uni-pretrain / finetune / residual 的下游 g 实验仍未发现对应 run | SeqScore（delta，test spearman 0.813，见 B.2.5） | 已完成 BFN Spearman：residual 0.6122、baseline 0.5915、finetune 0.4826；DFM-abs-residual 0.7643、DFM-abs-baseline 0.7471、DFM-abs2uni-residual 0.7246 | 当前生成器和 predictor 均不含 assay_id |
| 热稳定性 | FireProtDB | 8,954 ΔΔG 突变 | 连续 ΔΔG | BFN 四 setting 已纳入矩阵并完成训练、生成与实验查表；DFM-uni-baseline 与 DFM-abs2uni 两 setting 已评估；DFM-abs 四 setting 已完成训练、生成与实验查表；DFM-uni-finetune / residual 待补 | FireProtDB test 实验 ΔΔG 查表 | 严格与逐位拆解的实验 ΔΔG MSE / MAE / Spearman、查表覆盖率 | 已完成严格查表的 setting 仅有 2–13 条可评估序列，多编辑无真实组合标签 |
| 抗体亲和力 | Ortlund DMS IgG1Fc–FcγR | 4,353 单点突变（train 2,611 / val 851 / test 891） | 连续 logKa（6 受体谱） | BFN 四 setting 已纳入矩阵并完成评估；DFM-abs 四 setting 已完成评估；DFM-uni-baseline 与 DFM-abs2uni 两 setting 已评估，DFM-uni-finetune / residual 待补 | DMS 实测 logKa 查表 | DFM-abs-pretrain pooled Spearman 0.473、DFM-abs-residual 0.356（evaluable rate 约 65%–71%）；DFM-uni-baseline 0.523；DFM-abs2uni-finetune 0.658 | 目标条件 held-out；生成编辑使用完整 DMS 查找表 |

### B.10 结构条件消融：加结构 vs 不加结构

> **附录说明**：本节汇总 BFN 与 DFM-abs 条件生成中已有的“额外注入结构条件（`_struct`）”与“仅序列条件（无后缀）”结果。仅报告现有结果，该维度不在正文展开，只作补充诊断。

#### B.10.1 FireProtDB（实验 ΔΔG 查表）

误差（MSE / MAE）越低越好，evaluable rate 越高越好；`n_zero_edit` 为回退到 WT 的样本数。

**BFN**：

| Setting | 变体 | 可评估率 | n_eval | MSE ↓ | MAE ↓ | Spearman | n_zero_edit |
|---------|------|---------:|-------:|------:|------:|---------:|------------:|
| BFN-baseline | 不加结构 | 2.02% | 11 | 6.03 | 1.61 | 0.005 | 132 |
| BFN-pretrain | 不加结构 | 0.55% | 3 | 0.51 | 0.65 | 0.500（n=3） | 66 |
| BFN-finetune | 不加结构 | 0.74% | 4 | 1.02 | 0.94 | 1.0（n=4） | 139 |
| BFN-residual | 不加结构 | 1.47% | 8 | 5.17 | 1.80 | -0.43 | 144 |
| BFN-baseline | 加结构 | 0% | 0 | — | — | — | 430 |
| BFN-finetune | 加结构 | 0% | 0 | — | — | — | 367 |
| BFN-residual | 加结构 | 2.02% | 11 | 5.01 | 1.42 | -0.06 | 103 |

**DFM-abs**：无结构与带结构 run 的实验 ΔΔG lookup 已覆盖已完成 setting；无结构的 baseline、pretrain、finetune、residual 各纳入 544 条去重 test 序列；带结构中 baseline 仅纳入 rank-0 的 286 条去重 test 序列。

| Setting | 变体 | val/loss ↓ | 实验 ΔΔG lookup | 可评估率 | n_eval | MSE ↓ | MAE ↓ | Spearman | n_zero_edit |
|---------|------|-----------:|------------------|---------:|-------:|------:|------:|---------:|------------:|
| DFM-abs-baseline | 不加结构 | **0.0371** | 已完成（544 条） | 0.37% | 2 | 4.96 | 1.77 | 1.0（n=2） | 80 |
| DFM-abs-pretrain | 不加结构 | 0.0466 | 已完成（544 条） | 2.39% | 13 | 2.12 | 0.99 | -0.087（n=13） | 70 |
| DFM-abs-finetune | 不加结构 | **0.0484** | 已完成（544 条） | 0.37% | 2 | 0.79 | 0.84 | 1.0（n=2） | 25 |
| DFM-abs-residual | 不加结构 | 0.0432 | 已完成（544 条） | 0.37% | 2 | 15.93 | 3.15 | -1.0（n=2） | 70 |
| DFM-abs-baseline | 加结构 | 0.0626 | 仅 rank-0（286 条） | 0.00% | 0 | — | — | — | 247 |
| DFM-abs-finetune | 加结构 | 0.0565 | 已完成（544 条） | 1.65% | 9 | 6.74 | 2.24 | 0.639 | 220 |
| DFM-abs-residual | 加结构 | **0.0294** | 已完成（544 条） | 0.74% | 4 | 1.20 | 0.82 | 0.800 | 253 |

**结论。** 在现有成对结果中，BFN 不加结构整体更可靠：baseline / finetune 加结构后可评估序列归零，residual 的带结构 MAE 虽略低，但样本量极小。DFM-abs 中，加结构只在 residual 的 `val/loss` 上改善，在 baseline 和 finetune 上变差；实验 ΔΔG 侧，无结构 setting 的严格单编辑可评估样本为 2–13 条（相关性仍属小样本描述），finetune / residual 加结构后可评估样本分别升至 9 / 4 条，但相应 MSE/MAE 未见一致改善。综合样本量与误差，现有数据仍不足以判断 DFM-abs 加结构是否提高真实 ΔΔG 条件遵循。

#### B.10.2 Ortlund DMS（edit-score error）

MSE / MAE 越低越好，pooled Spearman 越高越好；`len_mismatch` 为与 WT 长度不一致的生成数。

| Setting | 变体 | 可评估率 | n_eval | MSE ↓ | MAE ↓ | pooled Spearman ↑ | len_mismatch |
|---------|------|---------:|-------:|------:|------:|------------------:|-------------:|
| BFN-baseline | 不加结构 | 0.34% | 3 | 4.92 | 1.85 | -0.373 | 1 |
| BFN-pretrain | 不加结构 | 67.3% | 600 | 1.90 | 0.990 | 0.079 | 3 |
| BFN-finetune | 不加结构 | 78.6% | 700 | **1.15** | **0.778** | **0.291** | 0 |
| BFN-residual | 不加结构 | 75.4% | 672 | 1.73 | 0.941 | 0.110 | 0 |
| BFN-baseline | 加结构 | 0% | 0 | — | — | — | 639 |
| BFN-finetune | 加结构 | 0.11% | 1 | 11.7 | 3.03 | 0.086（n=6） | 1 |
| BFN-residual | 加结构 | 80.6% | 718 | 1.81 | 0.966 | 0.109 | 0 |

**结论：不加结构更好或持平。**
- baseline：加结构 639 条长度不符、0 可评估，完全崩溃。
- finetune：不加结构为全场最佳（Spearman 0.291 / MSE 1.15 / 可评估率 78.6%），加结构崩溃到仅 1 条可评估。
- residual：两者基本打平（MSE / MAE 不加结构略优，Spearman 相同，可评估率加结构略高），差异在噪声范围内。

#### B.10.3 ProteinGYM DMS（恢复 / 结构指标）

AAR、TM-score 越高越好，RMSD 越低越好。

| Setting | 变体 | AAR ↑ | TM-score ↑ | RMSD ↓ | pTM ↑ | pLDDT ↑ |
|---------|------|------:|-----------:|-------:|------:|--------:|
| BFN-baseline | 不加结构 | 0.961 | 0.942 | 0.468 | 0.587 | 71.35 |
| BFN-pretrain | 不加结构 | 0.966 | 0.895 | 0.828 | 0.575 | 71.02 |
| BFN-finetune | 不加结构 | 0.959 | 0.891 | 0.739 | 0.590 | 71.78 |
| BFN-residual | 不加结构 | **0.968** | **0.957** | **0.365** | 0.590 | 71.64 |
| BFN-baseline | 加结构 | 0.959 | 0.937 | 0.485 | 0.584 | 71.12 |
| BFN-finetune | 加结构 | 0.959 | 0.918 | 0.542 | 0.584 | 71.06 |
| BFN-residual | 加结构 | 0.958 | 0.897 | 0.699 | 0.584 | 71.44 |

**结论：test 集上加结构无泛化收益。** baseline 基本持平（不加结构略优）；finetune 加结构在 TM / RMSD 上略好；residual 不加结构明显更好。需注意：在 val 集上 baseline_struct / finetune_struct 的 AAR / TM 曾达到约 1.000，但这是结构条件让模型近乎复制 WT、且验证蛋白与训练重叠导致的记忆 / 泄漏假象，在留出的 test 蛋白上优势完全消失。

#### B.10.4 总体结论

**"不加结构"总体更好或持平，加结构未带来稳定收益。**

- 根因：注入结构条件后模型倾向于**复制 / 回退到野生型**（zero-edit、seq identity 升高），因此在依赖"突变编辑效应"评估的 FireProtDB / Ortlund 上，可评估序列大量崩溃——尤其 baseline 与 finetune 直接归零，性能明显变差。
- **residual 相对更稳健，但并非三个数据集都持平**：FireProtDB 样本过少，Ortlund 基本持平；ProteinGYM 中不加结构的 residual 明显更好（TM-score 0.957 vs 0.897，RMSD 0.365 vs 0.699）。
- **ProteinGYM** 的 test 集显示加结构无泛化增益，尤其 residual 明显退化；val 上的高分属泄漏假象。
- 一句话总结：**当前结构条件对 BFN 条件生成没有正向帮助，反而在 baseline / finetune 下诱发野生型回退、破坏突变生成；建议优先使用不加结构的设置。**

---

**报告结束**

> 所有标 [待补充] / [待训练] 的位置，请在对应实验完成后补入具体数字。最后更新时间：2026-08-06。
