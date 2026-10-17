# 研究项目结果动图

2026-10-13 更新物理动力学生成与 DNS 项目讲解页的中英文版本。本文保留素材对应关系；`docs/` 不发布到网站。

## 物理动力学生成

源目录：`G:\Finished Researchs\Generating Physical Dynamics under Priors\Experiments Results`。

| 网站素材（`images/research/physical-dynamics/`） | 原始模型输出 | 样本 | 物理时间帧 |
| --- | --- | --- | --- |
| `three-body-baseline-rollout.webp` | `visual-body/logs/naive/ParaGRU/naive---ParaGRU---hidden_size-256--n_layers-4--t_embed_size-128---2024_08_21__19_30_49/ode_sample-2024_08_22__02_08_00/samples_all.pkl` | 26 | 10 |
| `three-body-momentum-rollout.webp` | `visual-body/logs/momentum_0.05/ParaGRU/momentum_0.05---ParaGRU---hidden_size-512--n_layers-5--t_embed_size-128---2024_08_23__19_41_23/ode_sample-2024_08_24__05_02_12/samples_all.pkl` | 26 | 10 |
| `five-spring-baseline-rollout.webp` | `visual-spring/logs/baseline/samples_all.pkl` | 22 | 50 |
| `five-spring-prior-rollout.webp` | `visual-spring/logs/ours/samples_all.pkl` | 22 | 50 |

样本索引从零开始。直接取保存的生成位置绘图，不重新积分运动方程，不插入额外轨迹点。浅色背景线表示该样本完整路径，深色轨迹与圆点表示当前帧已走过的路径和位置；帧计数不是秒数或扩散步数。五弹簧虚线来自 `visual-spring/val_edge_5_spring.npy[22]`，随当前粒子位置更新端点。

按用户要求，通过增加白边将四段可视化统一为 800 × 800 像素，保留长方形绘图区的显示比例。五弹簧保留接近原网页静态图的 800 × 600 绘图区，上下各补 100 像素；三体保留 800 × 720 原绘图区，上下各补 40 像素。五弹簧沿用原始 `draw_spring` 的 `aspect=auto`：横纵轴分别按该样本整段轨迹的范围缩放，并各留 5% 边距；各帧使用固定范围，不再把长方形绘图区直接拉伸成方形，也不改成横纵单位等长的 `aspect=equal`。每段循环 5 秒，末帧额外停留 1 秒后重播。各动画的 `*-poster.webp` 是同一绘图的末帧。WebP 使用无损编码。

四段可视化内均已移除帧数。正文通过 `_includes/research-rollout.html` 与 `assets/js/physical-rollouts.js` 播放对应静音 H.264 MP4，并根据视频实际显示时间在图片外侧右上方更新 HTML 帧数，统一为 0.75rem 字号。MP4 为 25 fps、5 秒，编码中的重复帧只延长原结果帧的停留，不插入新的模型状态；显示的帧数仍为三体的 10 帧或五弹簧的 50 帧。减少动态效果时显示末帧及末帧编号；视频无法播放时保留 WebP 并隐藏无法同步的外部帧数。图片放大继续使用相同内容的 WebP。

**图 3 的约束归属修正：** 原静态案例实际使用 `model.loss: momentum_0.05`，该分支约束总速度之和随时间的变化，不是 `jensen` 能量相关监督分支。样本 26 的原始位置、速度重算后与现有 `three-body-energy.webp` 一致：第 6 帧 baseline 势能约 −1.4415、动能约 0.8705，momentum 势能约 −1.0483、动能约 0.7800。页面因此将案例标签修正为“加入动量约束”，并与表中采用能量相关监督的三体主实验区分。理论与主实验表格保持原样。能量、动量静态曲线继续对应原样本。

不要直接使用 `trajectory_lineplot_animation.gif` 作为模型生成结果：其 notebook 在制作动画前对初态重新进行了 ODE 积分。

## DNS / Learning to Decouple Complex Systems

源目录：`G:\Finished Researchs\Learning to Decouple Complex Systems`。

| 网站素材（`images/research/learning-to-decouple/`） | 原始可视化导出 | 时间索引 |
| --- | --- | --- |
| `three-body-evolution.webp` | `DNS for ICLR 2022/IndCDE Visualization/aaaa_24/trajectory_<t>.pdf` 与 `attention_<t>.pdf` | 5 至 12，共 8 帧 |
| `spring-evolution.webp` | `DNS for ICML 2023/Softmax and Sparsemax/Spring/temp/traj_<t>.pdf`、`soft_<t>.pdf`、`sparse_<t>.pdf` | 1 至 10，随后 13、16、…、46，共 22 帧 |

原始 PDF 与对应论文图导出逐个校验一致。只对原图做固定裁边、等比例缩放与同步拼接，不重绘矩阵数值，不生成中间时间状态。

三体轨迹为物理参考运动，交互矩阵为 DNS 推断结果；不能把参考轨迹称为 DNS 预测位置。弹簧轨迹来自输入数据，soft / sparse 矩阵为模型的潜在交互输出。时间标记沿用原导出索引，不赋予秒数单位。

按用户要求将 DNS 回放速度提高到初版的 1.25 倍：三体每帧 640 毫秒，循环 5.12 秒；弹簧每个索引间隔对应 160 毫秒，缺省索引通过延长原帧停留表示，循环 7.68 秒。桌面与手机版本保持相同速度，三个或八个潜在模块的权重分别保持同步；潜在交互不等于物理力或真实弹簧邻接。

桌面横向并列，`*-mobile.webp` 在手机纵向堆叠相同时间帧。每个版本都有匹配的 `*-poster.webp`，三体选索引 8，弹簧选索引 13，供减少动态效果的系统偏好使用。所有版本保持无损编码，放大入口指向桌面完整动图。

## 检查

站点构建成功；中英文四个 URL 在 1440 与 390 像素宽度下检查了动画实际推进、图片加载、响应式素材选择、图片放大、章节导航、MathJax 与页面溢出。减少动态效果时默认显示对应静态帧。临时转换脚本、原始材料、溯源 JSON 与浏览器截图只留在被忽略的 `tmp/` 中。
