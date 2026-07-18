# 织光 LightWeave — 个人 AI 认知伴侣

> 你只管记，它帮你发现"原来我是这样的"。

织光是一个纯浏览器端的个人 AI 认知伴侣。写下你的复盘、日记、思考随笔，AI 自动发现历史记录间的语义关联，帮你从散落记录中看见自己的模式、矛盾、成长，最终孵化出属于自己的方法论（SOP）。

## 和笔记工具有什么不同

- **不是笔记工具**，不是聊天机器人——是一个安安静静陪你、偶尔轻声说两句话的朋友
- **别人用 AI 替你干活，织光用 AI 帮你看清自己**
- **所有数据只存浏览器 IndexedDB**，数据不出设备，不是"承诺不偷看"，是技术上就看不了

## 三引擎认知系统

| 引擎 | 触发时机 | 产出 |
|------|---------|------|
| 关联引擎 | 每次保存记录 | 与历史记录的语义关联 + 类别 + 置信度 |
| 问答引擎 | 用户主动提问 | 基于全部记录的流式回答 + 原文引用 |
| 孵化引擎 | 用户点「生成SOP」 | 3-7 步个人方法论 + 来源追溯 |

三个引擎共享 Transformers.js 浏览器端 embedding + 余弦相似度语义检索。

## 技术架构

```
React 19（纯前端 SPA）
  ├── IndexedDB（6 个 Object Stores，idb 封装）
  ├── Transformers.js + bge-small-zh-v1.5（浏览器端 embedding）
  ├── DeepSeek API（付费模型，fetch 直连，SSE 流式）
  ├── Cloudflare Worker（免费模型中转，Qwen3 30B）
  ├── Web Crypto API（AES-256-GCM 加密备份）
  └── Canvas API + jsPDF（PNG 卡片 + PDF 导出）
部署：GitHub Pages + GitHub Actions CI/CD
```

## 快速开始

```bash
cd lightweave
npm install
npm run dev        # 本地开发 → http://localhost:5173
npm run build      # 构建生产版本 → dist/
```

**线上地址**：https://rqran5201-stack.github.io/lightweave/

首次打开会自动下载 embedding 模型（~45MB，浏览器缓存），之后即可使用。免费模型（Qwen3 30B）开箱即用，无需配置 API Key。

## 项目文档

- [产品定义（idea.md）](../idea.md)
- [交互文档（interaction.md）](../interaction.md)
- [架构文档（architecture.md）](../architecture.md)
- [视觉设计（design.md）](../design.md)
- [产品进度（PROGRESS.md）](./PROGRESS.md)
- [部署方法论](./部署方法论_纯前端SPA免费部署方案.md)

## 团队

三菜一汤（6人）— 产品经理 王依然 / 项目经理 / 技术经理 / 组员×3

## 许可证

MIT
