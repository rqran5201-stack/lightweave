# Changelog

## V3.1 — 2026-07-18

- **修复**：HTTP 环境下 `crypto.randomUUID()` 不可用导致保存失败——新增 `generateId()` 降级函数，使用 `crypto.getRandomValues()` 手动生成 UUID v4
- **修复**：SOP 生成时 LLM 返回数组导致崩溃——prompt 强化单对象约束 + 解析端数组防御（自动合并 steps）
- 移除未使用的依赖（`openai`、`react-router-dom`）

## V3.0 — 2026-07-13

- **嵌入语义搜索**：Transformers.js + bge-small-zh-v1.5 浏览器端 embedding（512维），替代 `slice(0, 30)` 截断策略
- IndexedDB v2：新增 `embeddings` object store，保存记录时异步生成嵌入向量
- 关联分析 / 问答 / SOP 生成全部接入语义搜索：生成嵌入 → 余弦相似度排序 → Top-30 → LLM
- 旧记录后台逐条迁移，非阻塞、可取消；嵌入模型未就绪时自动回退
- `deleteRecord` 级联清理 embedding

## V2.4 — 2026-07-13

- 7 项 UX 修复：空记录问答引导、SOP 标题确定性、生成前去重、外部知识来源严格化、数据存储透明度通知、智能自动滚动、删除消息不跳转
- 话题折叠（Codex 风格）：>3 个对话主题自动分组折叠
- 支持 .docx（mammoth）和 .pdf（pdfjs-dist）导入，动态 import 代码分割

## V2.3 — 2026-07-12

- 记录最低字数从 10 字降为 1 字，移除最低字数提示

## V2.2 — 2026-07-12

- **数据备份恢复**：JSON 导出/导入（合并模式），含版本号和校验
- `db.js` 新增 `putRecord` 保留原始 ID 写入

## V2.1 — 2026-07-12

- **周度洞察**：AI 生成关键词/情绪趋势/亮点关联 + IndexedDB ISO 周缓存
- 发现页四种状态：生成中 / 空态 / 错误重试 / 完成展示

## V2.0 — 2026-07-10

- **免费内置 LLM**：Cloudflare Worker 代理（Workers AI 免费模型 + 可选 Gemini）
- 模型选择器：免费模型 / 自有模型分组下拉 + 手动输入
- 透明代理路由：根据所选模型自动切换代理/直连
- 旧模型废弃 ID 自动迁移

## V1.3 — 2026-07-10

- **部署上线**：GitHub Pages + GitHub Actions CI/CD
- 引导页完善、API Key 未配置提示、数据存储一次性提醒

## V1.2 — 2026-07-10

- **SOP 链路接通**：Q&A → 一键生成 SOP → DB 存储 → 跳转详情
- 记录详情懒加载关联分析（打开任意未分析记录自动补跑）
- **多 LLM 支持**：API 地址和模型可配置（DeepSeek / OpenAI / Ollama 等）

## V1.1 — 2026-07-10

- 修复导入记录的关联分析缺失
- 修复 Q&A 流式响应 "not async iterable" 错误
- SSE 解析兼容 `data:` 和 `data: ` 两种格式
- 记录列表增加删除按钮；Q&A 消息增加删除按钮
- Q&A 回答折叠/展开

## V1.0 — 2026-07-09

- 初始版本：Vite + React 项目
- IndexedDB 5 个 object store（records / associations / sops / qaHistory / settings）
- 记录 CRUD + 搜索 + 标签筛选
- 文件导入（.txt / .md / .json）+ 文字粘贴（3 种拆分）
- 关联分析引擎 + 双向链接
- 发现页 / SOP 页 / 引导页 / 设置页
- 多格式导出（MD / TXT / PDF）
