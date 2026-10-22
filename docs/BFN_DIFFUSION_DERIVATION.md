# BFN 与 Diffusion 的联系：从离散数据预测到噪声匹配与 Score

> 来源：用户提供的 *Observation-Aligned Mask Priors for Learning Physical Fields from Authentic Occlusions*（`ICLR_2027_Ocean_Imputation.pdf`），重点为正文 §3.3（PDF 第 4–5 页）、附录 B.1–B.2（第 14 页）及 C.1–C.2（第 15–17 页）。下文按逻辑重排推导，并补全中间步骤；公式后的“原文式”指该 PDF 的编号。本文是独立数学笔记，不配置网站发布信息。

## 1. 先明确“等价”指什么

这份材料采用的是 **BFN 启发的连续潜变量模型**：将离散类别嵌入连续空间，通过高斯扰动构造训练样本，让网络预测干净类别的概率，再将输出换算成 diffusion 使用的噪声预测或 score。

核心推导链为：

$$
\text{离散类别 }c
\longrightarrow x_0=K e_c
\longrightarrow x_t=\alpha_t x_0+\sigma_t\epsilon
\longrightarrow \widehat e_\theta
\longrightarrow D_\theta,\ \epsilon_\theta,\ s_\theta.
$$

需要区分三个层次：

1. **损失严格相等**：在相同高斯扰动过程、时间采样分布及指定预测器参数化下，正确换算时间权重后，类别概率的平方误差与噪声匹配损失逐样本相等。
2. **最优预测器对应**：总体最优时，类别概率、干净数据后验均值、噪声条件均值及真实 score 可以互相换算。
3. **与原始 BFN 的完整过程等价**：还需要匹配原始 BFN 的潜变量参数化、噪声日程及相应动力学。本文档所依据的附录没有完整展开这一层，不能仅凭损失重参数化就断言任意 BFN 与任意 diffusion 完全等价。

## 2. 离散类别如何进入连续高斯模型

先讨论一个像素。设类别数为 $C$，类别为 $c\in\{1,\ldots,C\}$，对应 one-hot 向量为 $e_c\in\mathbb R^C$。定义连续目标：

$$
x_0=K e_c,\qquad K>0.
$$

前向扰动为：

$$
\boxed{x_t=\alpha_t K e_c+\sigma_t\epsilon},
\qquad \epsilon\sim\mathcal N(0,I_C),\quad \epsilon\perp c.
$$

因此条件分布是：

$$
q_t(x\mid c)=\mathcal N(x;\alpha_t K e_c,\sigma_t^2I_C).
$$

这里 $K$ 控制连续嵌入的尺度，监督标签始终是精确的 $e_c$，并非 $\operatorname{softmax}(K e_c)$。论文使用 $C=2$、$K=5.4$，分别表示缺失与观测两类。

对完整掩码，将 $d$ 个像素的向量堆叠为 $x_t\in\mathbb R^{d\times C}$；噪声各坐标独立，softmax 沿每个像素的类别轴计算，平方误差对所有像素与类别求和。**噪声独立不意味着真实掩码的像素独立。**

以下含除法的推导在 $\alpha_t>0$、$\sigma_t>0$ 的非退化时间成立，奇异端点需另取极限。（原文式 (14)、(18)）

## 3. 为什么只输入 softmax，不会丢失最优类别预测所需的信息

### 3.1 从贝叶斯公式得到类别后验

设类别先验为 $\pi_j=P(c=j)$，则：

$$
P(c=j\mid x_t=x)
\propto \pi_j\exp\left[-\frac{\|x-\alpha_tK e_j\|^2}{2\sigma_t^2}\right].
$$

展开平方项：

$$
\|x-\alpha_tK e_j\|^2
=\|x\|^2-2\alpha_tKx_j+\alpha_t^2K^2.
$$

其中第一项和第三项与类别无关，归一化时抵消，得到：

$$
\boxed{
P(c=j\mid x_t=x)
=\frac{\pi_j\exp(\lambda_t x_j)}
{\sum_{\ell=1}^{C}\pi_\ell\exp(\lambda_t x_\ell)},
\qquad \lambda_t=\frac{\alpha_tK}{\sigma_t^2}.
}
$$

将 $x$ 换为 $x+a\mathbf 1$，分子分母都乘以 $\exp(\lambda_ta)$，所以后验不变。干净数据的最优平方误差预测器也就满足：

$$
D_t^*(x)=\mathbb E[x_0\mid x_t=x]
=K\big(P(c=j\mid x_t=x)\big)_{j=1}^{C},
$$

$$
D_t^*(x+a\mathbf 1)=D_t^*(x).
$$

这称为对 logits 公共平移的不变性。（原文式 (15)–(16)）

### 3.2 Softmax 恰好保留相对 logits

设 $h(x+a\mathbf 1)=h(x)$。对单纯形内部的概率向量 $p$，定义：

$$
g(p)=h(\log p).
$$

由于：

$$
\log\operatorname{softmax}(x)
=x-\log\left(\sum_j e^{x_j}\right)\mathbf 1,
$$

得到：

$$
g(\operatorname{softmax}(x))=h(x).
$$

因此，任何具有这种平移不变性的函数都能通过 softmax 输入表示。又因 $\operatorname{softmax}(\log p)=p$，该表示在单纯形内部唯一。（原文定理 3、式 (12)–(13)）

应用于 $D_t^*$，可采用：

$$
\boxed{D_\theta(t,x)=K\widehat e_\theta(t,\operatorname{softmax}(x))},
$$

其中 $\widehat e_\theta$ 输出类别概率向量。总体最优时，它等于类别后验。

**输入的 $\operatorname{softmax}(x)$ 一般不等于类别后验。** 后验还依赖先验、时间以及整张掩码的空间关系；softmax 在这里提供的是足够的表示，而不是直接完成贝叶斯推断。

该表示结论针对有限 logits 对应的单纯形内部，不自动保证在整个边界上存在连续扩展。

### 3.3 该论证允许像素间相关

设整张掩码类别配置为 $\mathbf c=(c_1,\ldots,c_d)$，任意联合先验为 $\pi(\mathbf c)$。同样展开高斯似然：

$$
P(\mathbf c\mid x_t=x)
\propto \pi(\mathbf c)
\exp\left(\lambda_t\sum_{i=1}^{d}x_{i,c_i}\right).
$$

在每个像素内部独立平移 $x_{i,j}\mapsto x_{i,j}+a_i$，所有配置的未归一化概率都乘上相同的 $\exp(\lambda_t\sum_i a_i)$。因此联合后验及像素边缘后验均不变。

所以逐像素 softmax 足以表示最优数据预测器，**不需要分解联合先验，也不限制网络跨像素建模**。（原文式 (17)）

## 4. 后验均值、噪声预测与 Score 的关系

令扰动后的边缘密度为 $p_t(x)$，真实 score 为：

$$
s_t^*(x)=\nabla_x\log p_t(x).
$$

高斯条件分布的 score 为：

$$
\nabla_x\log q_t(x\mid x_0)
=-\frac{x-\alpha_tx_0}{\sigma_t^2}.
$$

对 $x_0\mid x_t=x$ 取条件期望：

$$
\begin{aligned}
s_t^*(x)
&=\mathbb E\left[\nabla_x\log q_t(x\mid x_0)\mid x_t=x\right]\\
&=\frac{\alpha_t\mathbb E[x_0\mid x_t=x]-x}{\sigma_t^2}.
\end{aligned}
$$

移项得到 Tweedie 关系：

$$
\boxed{D_t^*(x)=\frac{x+\sigma_t^2s_t^*(x)}{\alpha_t}}.
$$

另一方面，由 $\epsilon=(x_t-\alpha_tx_0)/\sigma_t$：

$$
\boxed{
\epsilon_t^*(x)=\mathbb E[\epsilon\mid x_t=x]
=\frac{x-\alpha_tD_t^*(x)}{\sigma_t}
=-\sigma_ts_t^*(x).
}
$$

这说明数据预测、噪声预测、score 预测在最优条件下是同一个后验信息的不同参数化。（原文式 (19a)–(19b)）

## 5. 核心代数：噪声匹配严格改写为离散数据匹配

给定类别概率网络，定义相应的噪声预测器：

$$
\epsilon_\theta(t,x)
:=\frac{x-\alpha_tD_\theta(t,x)}{\sigma_t}
=\frac{x-\alpha_tK\widehat e_\theta(t,\operatorname{softmax}(x))}{\sigma_t}.
$$

将训练样本 $x_t=\alpha_tKe_c+\sigma_t\epsilon$ 代入：

$$
\begin{aligned}
\epsilon_\theta(t,x_t)-\epsilon
&=\frac{\alpha_tKe_c+\sigma_t\epsilon
-\alpha_tK\widehat e_\theta(t,\operatorname{softmax}(x_t))}{\sigma_t}-\epsilon\\
&=\frac{\alpha_tK}{\sigma_t}
\left(e_c-\widehat e_\theta(t,\operatorname{softmax}(x_t))\right).
\end{aligned}
$$

平方后：

$$
\boxed{
\|\epsilon_\theta(t,x_t)-\epsilon\|^2
=\frac{\alpha_t^2K^2}{\sigma_t^2}
\|\widehat e_\theta(t,\operatorname{softmax}(x_t))-e_c\|^2.
}
$$

这是对**每个样本、每个网络参数值**成立的恒等式，不要求网络已经训练到最优。（原文式 (21)–(23)）

设 diffusion 噪声匹配损失为：

$$
\mathcal J_{\mathrm{noise}}(\theta)
=\mathbb E_{t,c,\epsilon}\left[
w_{\mathrm{NM}}(t)\|\epsilon_\theta(t,x_t)-\epsilon\|^2
\right].
$$

则：

$$
\mathcal J_{\mathrm{noise}}(\theta)
=\mathbb E_{t,c,\epsilon}\left[
w_{\mathrm{NM}}(t)\frac{\alpha_t^2K^2}{\sigma_t^2}
\|\widehat e_\theta(t,\operatorname{softmax}(x_t))-e_c\|^2
\right].
$$

因此，定义离散数据匹配损失：

$$
\mathcal L_{\mathrm{DM\text{-}discrete}}(\theta)
=\mathbb E_{t,c,\epsilon}\left[
w(t)\|\widehat e_\theta(t,\operatorname{softmax}(x_t))-e_c\|^2
\right],
$$

只要：

$$
\boxed{w(t)=w_{\mathrm{NM}}(t)\frac{\alpha_t^2K^2}{\sigma_t^2}},
$$

就有 $\mathcal J_{\mathrm{noise}}=\mathcal L_{\mathrm{DM\text{-}discrete}}$。（原文式 (24)–(25)，对应正文式 (5)）

例如，无权重噪声匹配 $w_{\mathrm{NM}}=1$ 对应 $w=\alpha_t^2K^2/\sigma_t^2$；无权重类别平方误差 $w=1$ 则对应 $w_{\mathrm{NM}}=\sigma_t^2/(\alpha_t^2K^2)$。不能在两边都随意取常数权重后仍宣称目标严格相等。

还需使用相同的时间采样分布，并保证期望有限。其他严格正时间权重在不受容量限制的函数空间中具有相同的逐时间总体最优解，但对于有限容量网络，可能产生不同的最优参数。

## 6. 从类别预测恢复 Diffusion Score

与上述噪声预测器对应，定义：

$$
\boxed{
s_\theta(t,x)
=-\frac{\epsilon_\theta(t,x)}{\sigma_t}
=\frac{\alpha_tK\widehat e_\theta(t,\operatorname{softmax}(x))-x}{\sigma_t^2}.
}
$$

当网络输出精确类别后验时，$s_\theta=s_t^*$；否则它是用于 diffusion 采样的 score 估计。（原文式 (26)，对应正文式 (6)）

其与去噪 score matching（DSM）的联系也可直接写出。条件 score 是 $-\epsilon/\sigma_t$，所以：

$$
\left\|s_\theta(t,x_t)+\frac{\epsilon}{\sigma_t}\right\|^2
=\frac{1}{\sigma_t^2}\|\epsilon_\theta(t,x_t)-\epsilon\|^2.
$$

因而，若 DSM 权重为 $v(t)$，对应的噪声匹配权重是 $w_{\mathrm{NM}}(t)=v(t)/\sigma_t^2$。这里的 DSM 写法是根据上述关系补充的代数说明。

在常规可积条件下，条件期望的平方误差分解给出：

$$
\mathbb E\left[
\left\|s_\theta(t,x_t)+\frac{\epsilon}{\sigma_t}\right\|^2
\right]
=\mathbb E\left[\|s_\theta(t,x_t)-s_t^*(x_t)\|^2\right]
+\text{与 }\theta\text{ 无关的项}.
$$

因此，匹配条件高斯 score 的 DSM 目标可以学习边缘密度 $p_t$ 的 score，而无需显式计算整个高斯混合分布。

### 为什么 score 不能直接只由 softmax 表示

虽然 $D_t^*(x+a\mathbf 1)=D_t^*(x)$，但：

$$
s_t^*(x+a\mathbf 1)
=s_t^*(x)-\frac{a}{\sigma_t^2}\mathbf 1,
$$

$$
\epsilon_t^*(x+a\mathbf 1)
=\epsilon_t^*(x)+\frac{a}{\sigma_t}\mathbf 1.
$$

所以完整 score 与噪声预测器并不具有平移不变性。正确做法是让网络只学习平移不变的类别概率，再保留公式中的显式线性项 $-x/\sigma_t^2$ 或 $x/\sigma_t$。（原文式 (20)）

## 7. 对采样和原始 BFN 等价性的含义

论文正文把恢复出的 $s_\theta$ 用于 probability flow ODE，并采用 $x_T\sim\mathcal N(0,I_{d\times C})$ 的终端近似，最后逐像素以 argmax 解码类别。

这一采样解释有两点边界：

- **终端分布与日程有关。** 从 $x_T=\alpha_TKe_c+\sigma_T\epsilon$ 可知，若 $\alpha_T=0$、$\sigma_T=1$，终端才精确为标准高斯；否则一般仍是高斯混合分布。论文将标准高斯称为终端近似是必要的。
- **损失相等不自动确定动力学。** 要复现具体 diffusion 的 SDE 或 probability flow ODE，还必须指定匹配的前向过程及其系数。要进一步与原始 BFN 完全对应，也必须给出其潜变量变换、时间方向及噪声日程的匹配。

附录 B.2 引述 Xue 等人的 SDE 统一结果，指出离散 BFN 可在连续潜变量空间解释，其连续时间回归损失可重参数化为 DSM。本 PDF 在 C.1–C.2 具体展开的是上文的表示充分性与损失重参数化，并未重新给出原始 BFN 的完整 SDE 等价证明。

此外，这里严格改写的是**类别概率的平方误差**。正文 §3.4 用于条件引导的交叉熵是另一个采样干预目标，不属于这条损失恒等式。

## 8. 关键公式速查

| 对象 | 表达式 | 含义 |
| --- | --- | --- |
| 连续嵌入 | $x_0=K e_c$ | 将离散类别表示为连续向量 |
| 高斯扰动 | $x_t=\alpha_tKe_c+\sigma_t\epsilon$ | 构造连续潜变量 |
| 类别网络 | $\widehat e_\theta(t,\operatorname{softmax}(x))$ | 最优时输出类别后验 |
| 数据预测 | $D_\theta=K\widehat e_\theta$ | 最优时为 $\mathbb E[x_0\mid x_t=x]$ |
| 噪声预测 | $\epsilon_\theta=(x-\alpha_tK\widehat e_\theta)/\sigma_t$ | 与类别网络绑定的噪声参数化 |
| Score 估计 | $s_\theta=(\alpha_tK\widehat e_\theta-x)/\sigma_t^2$ | 最优时为 $\nabla_x\log p_t(x)$ |
| 权重换算 | $w=w_{\mathrm{NM}}\alpha_t^2K^2/\sigma_t^2$ | 保证两种训练损失严格相等 |

**可以准确引用的结论：** 在该高斯潜变量模型及指定预测器参数化下，离散类别概率的加权平方误差与 diffusion 的加权噪声匹配损失严格等价；类别后验预测还可通过 Tweedie 关系恢复 diffusion score。与原始 BFN 的完整生成过程等价，则需要额外匹配潜变量参数化与噪声日程。
