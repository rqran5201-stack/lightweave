# 织光 LightWeave — 产品进度文档

> 最后更新：2026-07-13

## 产品一句话定义

个人 AI 认知伴侣。写下你的复盘、日记、思考随笔，AI 自动发现隐藏关联，从你的记录中孵化出属于你自己的方法论（SOP）。

## 技术架构

- **前端**：Vite + React，纯浏览器端，无服务端
- **存储**：IndexedDB（idb 库），所有用户数据留在浏览器本地
- **AI 代理**：Cloudflare Worker（`lightweave-proxy`）— Workers AI 免费模型 + 可选 Gemini
- **AI 直连**：浏览器直连 LLM API（OpenAI 兼容格式），支持 DeepSeek / OpenAI / 自定义
- **三引擎飞轮**：① 外部知识注入 ② 内部模式关联 ③ SOP 孵化

## 文件结构

```
lightweave/
├── src/
│   ├── App.jsx                    # 路由、Toast、导航、设置弹窗
│   ├── main.jsx                   # 入口
│   ├── index.css                  # 完整 design token CSS（22色/字体/圆角/阴影/组件）
│   ├── api/
│   │   ├── deepseek.js            # LLM API 客户端（OpenAI 兼容，含代理路由）
│   │   ├── models.js              # 模型目录：免费模型 + 自有模型预设 + 配置检测
│   │   ├── embedding.js           # 浏览器端嵌入服务（Transformers.js，语义搜索）
│   │   ├── import.js              # 文件解析器（txt/md/json/docx/pdf）
│   │   └── backup.js              # 数据备份恢复（导出/导入/验证）
│   ├── store/
│   │   └── db.js                  # IndexedDB 封装（5 个 object store）
│   ├── pages/
│   │   ├── RecordHome.jsx         # 首页：输入区 + 关联区 + 记录列表 + 导入入口
│   │   ├── RecordDetail.jsx       # 记录详情：全文 + 关联卡片 + 反向引用 + 懒加载分析
│   │   ├── Discovery.jsx          # 发现页：最近关联 + 周度洞察
│   │   ├── QAPage.jsx             # 问答页：流式 Q&A + SOP 生成 + 折叠/删除
│   │   ├── SOPList.jsx            # SOP 库列表
│   │   ├── SOPDetail.jsx          # SOP 详情
│   │   └── GuidePage.jsx          # 引导页（3 步）
│   └── components/
│       ├── ImportZone.jsx         # 导入区：文件拖拽 + 文字粘贴（双 tab）
│       ├── ExportPopover.jsx      # 导出弹窗：两步选择（范围 → 格式）
│       ├── SettingsModal.jsx      # 设置弹窗：模型选择器 + 代理地址 + API Key
│       └── ConfirmDialog.jsx      # 确认弹窗
├── worker/
│   ├── src/
│   │   └── index.js               # Cloudflare Worker LLM 代理（Workers AI / Gemini）
│   ├── wrangler.toml              # Cloudflare 部署配置
│   └── package.json
├── .github/workflows/deploy.yml   # GitHub Actions 自动部署
├── dist/                          # 构建产物（纯静态，可直接部署）
└── PROGRESS.md                    # 本文件
```

## 版本演进

### V1.0 — 基础骨架（2026-07-09）

- [x] 六阶段齐码流水线走完：idea → interaction → architecture → design → prototype → implement
- [x] Vite + React 项目搭建，31 个模块 0 错误构建
- [x] IndexedDB 5 个 object store：records / associations / sops / qaHistory / settings
- [x] DeepSeek API 客户端：chatCompletion + streamChatCompletion + analyzeAssociations + generateSOP + answerQuestion
- [x] 记录 CRUD：新建 / 查看 / 列表 / 搜索 / 标签筛选
- [x] 文件导入：.txt / .md / .json，拖拽上传（ImportZone — 文件模式）
- [x] 文字粘贴导入：按 --- 拆分 / 按空行拆分 / 整体导入（ImportZone — 粘贴模式）
- [x] 关联分析（引擎②）：保存新记录时触发，分析新记录与历史记录的关联
- [x] 双向链接：getBacklinks 反向引用查询
- [x] 发现页："最近关联"tab（真实数据）
- [x] 导出：MD / TXT / PDF，两步选择（内容范围 → 格式）
- [x] 引导页：3 步介绍（写 / 关联 / 方法论）
- [x] 引导不催导入（用户先体验产品价值，导入入口在首次关联后出现）
- [x] 设置页：API Key 配置
- [x] design.md lint 0 error（22 色 / 5 级字重 / 5 级圆角 / 10 个间距 token）

### V1.1 — 核心体验修复（2026-07-10）

- [x] **修复：导入记录的关联分析缺失** — handleImported 新增逐条关联分析，导入后自动和历史记录比对
- [x] **修复：Q&A 流式响应报错** — answerQuestion 去掉多余的 async 关键字，解决 "not async iterable" 错误
- [x] **修复：SSE 解析兼容性** — streamChatCompletion 同时识别 `data:` 和 `data: `（带/不带空格）
- [x] **新增：记录列表删除按钮** — 每行末尾 ✕ 按钮（hover 可见），带确认弹窗
- [x] **新增：Q&A 消息删除按钮** — 每条消息右上角 ✕ 按钮（hover 可见），同步删除 IndexedDB 记录
- [x] **新增：Q&A 回答折叠** — AI 回答可折叠/展开，折叠态显示前 80 字预览，减少页面篇幅

### V1.2 — SOP 链路接通 + 多 LLM 支持（2026-07-10）

- [x] **新增：Q&A → 一键生成 SOP** — AI 回答下方 "生成 SOP" 按钮，调用 generateSOP API，保存至 DB 并跳转详情
- [x] **新增：记录详情懒加载关联分析** — 打开任意未分析的旧记录，自动在后台补跑关联分析
- [x] **移除：demo SOP 数据** — SOPList/SOPDetail 不再使用假数据，空态展示 CTA 引导
- [x] **新增：多 LLM 支持** — 设置页增加 API 地址和模型字段
  - API 地址：默认 `https://api.deepseek.com/v1`，支持 OpenAI / Ollama / 任意 OpenAI 兼容接口
  - 模型：默认 `deepseek-chat`，支持 gpt-4o / claude-sonnet-4-6 / deepseek-reasoner / qwen2.5 等
  - 旧 deepseek_api_key 自动迁移到新 key（llm_api_key），向下兼容

### V2.0 — 免费内置 LLM（2026-07-10）

- [x] **Cloudflare Worker LLM 代理** — `https://lightweave-proxy.lightweave.workers.dev`
  - Workers AI 免费模型：Qwen3 30B（推荐）、Llama 3.1 8B、DeepSeek R1 (Qwen 32B)
  - 可选 Gemini 2.0 Flash（需 Worker 端配置 `GEMINI_API_KEY`）
  - 完整 OpenAI 兼容 `/v1/chat/completions` 接口 + SSE 流式
  - CORS 跨域支持
- [x] **模型选择器** — 设置页下拉菜单，分组显示免费模型（无需 API Key）和自有模型（需自备 Key）
  - 免费模型（4 个）：Qwen3 30B / Llama 3.1 8B / DeepSeek R1 Qwen 32B / Gemini 2.0 Flash
  - 自有模型预设（2 个）：DeepSeek Chat / DeepSeek Reasoner
  - 支持手动输入模型 ID（`__custom__`）
- [x] **透明代理路由** — `getApiBase()`/`getApiKey()`/`getHeaders()` 根据所选模型自动切换代理/直连
- [x] **配置检测升级** — `isLlmConfigured()` 替代硬编码 API Key 检查：有 Key 或（免费模型+代理地址）均视为已配置
- [x] **旧模型自动迁移** — 废弃模型 ID（Cloudflare 5/30 下线的老模型）自动映射到新模型并回写 localStorage
- [x] **默认代理地址预填** — `https://lightweave-proxy.lightweave.workers.dev/v1`，新用户开箱即用
- [x] **代理部署引导** — 设置页内置 5 步 Cloudflare Worker 部署教程（注册 → wrangler → deploy → 填地址 → 可选 Gemini）
- [x] **Worker 流式兼容修复** — 同时处理 Workers AI 的 raw JSON 和 SSE 两种流式格式
- [x] **保存按钮最低字数提示** — < 10 字时显示"还需 N 字"，防止用户以为按钮坏了

### V2.1 — 周度洞察（2026-07-12）

- [x] **周度洞察 AI 生成** — `deepseek.js` 新增 `generateWeeklyInsight` 函数，AI 分析本周记录产出：
  - 3-6 个高频关键词（从本周记录中提取）
  - 情绪趋势分析（与历史记录对比）
  - 2-3 个与过去的亮点关联
  - 一句话本周认知收获总结
- [x] **周度洞察缓存** — `db.js` 新增 `saveWeeklyInsight`/`getWeeklyInsight`，按 ISO 周缓存到 IndexedDB，同周不重复调用 AI
- [x] **发现页周度洞察 tab** — 替换硬编码占位内容，四种状态：
  - 生成中：spinner + "AI 正在阅读你的本周记录"
  - 空态（< 3 条记录）：鼓励文案 + 当前记录数
  - 错误态：错误信息 + 重试按钮
  - 生成完成：关键词云 + 情绪趋势 + 亮点关联卡片（可点击跳转详情）+ "重新生成"按钮
- [x] **LLM 未配置保护** — 免费模型未就绪时提示"请先在设置中配置 LLM"

### V2.2 — 数据备份恢复（2026-07-12）

- [x] **数据导出** — 设置页新增"数据管理"区域，一键导出全量数据为 JSON 文件
  - 导出范围：records / associations / sops / qaHistory / settings
  - 文件格式：`lightweave-backup-{日期}.json`，含版本号和导出时间戳
  - `backup.js`：`exportAllData()` 读取所有 store → 打包 JSON → 触发浏览器下载
- [x] **数据恢复** — 导入 JSON 备份文件，合并模式恢复数据
  - 文件验证：检查 `app: 'lightweave'` 标识和数据结构完整性
  - 确认弹窗：展示备份摘要（记录数/关联数/SOP数/问答数/备份时间）
  - 合并导入：保留原始 ID，已有记录更新、新记录追加，不覆盖设置
  - `backup.js`：`readBackupFile()` → `validateBackup()` → `importBackup()`
- [x] **db.js 新增 `putRecord`** — 保留原始 ID 写入记录，供备份恢复使用

### V2.3 — 字数限制放宽（2026-07-12）

- [x] **记录最低字数从 10 字改为 1 字** — `RecordHome.jsx` 中 `canSave` 条件从 `charCount >= 10` 改为 `charCount > 0`，只要有内容即可保存
- [x] **移除"还需 N 字"提示** — 不再需要最低字数引导

### V2.4 — 7项UX修复 + 多格式导入（2026-07-13）

- [x] **修复#1：空记录问答引导** — 问答页新增 `recordCount` 状态，无记录时显示引导横幅 + 动态 placeholder 提示先写记录
- [x] **修复#2：SOP 标题确定性** — `generateSOP` prompt 新增规则："title 必须从用户提问中直接派生，确保同一问题每次生成相同标题"
- [x] **修复#3：SOP 生成前去重** — `handleGenerateSOP` 新增去重检测：检查已有 SOP 标题是否包含问题关键词，已有则提示"将基于新内容更新"
- [x] **修复#4：外部知识来源严格化** — `analyzeAssociations` prompt 重构 externalKnowledge.source 字段：强制格式（书名/作者/论文标题），不确定写 null；加入反虚构约束"编造来源比漏掉来源更糟"
- [x] **修复#5：数据存储透明度** — 首次记录后弹出数据存储说明横幅（纯浏览器存储，建议定期导出），localStorage 记住已关闭状态
- [x] **修复#6：问答输出中滚轮自由** — 智能自动滚动：仅当 `scrollHeight - scrollTop - clientHeight < 120` 时跟滚，否则用户可自由翻阅
- [x] **修复#7：删除消息不跳转** — `skipAutoScroll` ref 机制：删除消息前设置 ref=true，scroll useEffect 检测后跳过自动滚动
- [x] **修复#8：话题折叠（Codex 风格）** — 新增 `groupMessagesIntoTopics()` 函数，>3 个对话主题时自动分组折叠，可展开/收起；CSS 样式 `.qa-topic-group` / `.qa-topic-header` 等
- [x] **支持 .docx 导入** — `import.js` 新增 `parseDocx()`：动态 `import("mammoth")`，提取纯文本后按 Markdown 标题拆分
- [x] **支持 .pdf 导入** — `import.js` 新增 `parsePdf()`：动态 `import("pdfjs-dist")`，单页→一条、多页→逐页记录+页码标签
- [x] **ImportZone 文件过滤器更新** — 支持扩展名 `.txt/.md/.json/.csv/.docx/.pdf`，帮助文案更新
- [x] **动态 import 代码分割** — mammoth 和 pdfjs-dist 仅在导入 .docx/.pdf 时加载，首次加载不增加体积

### V3.0 — 嵌入语义搜索升级（2026-07-13）

- [x] **安装 Transformers.js** — `@xenova/transformers`，模型 `Xenova/bge-small-zh-v1.5`（中文优化，512维，~30MB，首次下载后浏览器缓存）
- [x] **创建嵌入服务模块** — `src/api/embedding.js`：`loadEmbeddingModel()` / `generateEmbedding(text)` / `cosineSimilarity(a,b)` / `findRelevantRecords(emb, records, topK)`
- [x] **IndexedDB 升级到 v2** — 新增 `embeddings` 对象存储（keyPath: recordId）；`saveEmbedding` / `getEmbedding` / `getAllEmbeddings` / `getAllRecordsWithEmbeddings` / `getRecordsWithoutEmbeddings`
- [x] **记录保存自动生成嵌入** — `RecordHome.jsx` handleSave 在后台生成嵌入向量并持久化；批量导入同步生成
- [x] **关联分析引擎语义化** — `analyzeAssociations` 调用方全部改造（首页保存/导入/详情页懒加载）：生成嵌入 → 余弦相似度排序 → Top-30 最相关记录 → 送入 LLM
- [x] **问答语义搜索** — `QAPage.jsx` handleSend + handleGenerateSOP：用问题文本生成嵌入 → 找最相关的 30 条记录 → 作为 LLM 上下文
- [x] **旧记录后台迁移** — `App.jsx` 启动时 `useEffect`：扫描未嵌入记录，逐条生成嵌入并保存；非阻塞、可取消、失败静默跳过
- [x] **回退机制** — 嵌入模型未就绪时（首次下载中/加载失败）自动 fallback 到 `getRecentRecords(50)`，确保功能不受影响
- [x] **deleteRecord 级联清理** — 删除记录时同步删除关联的 embedding 记录

### V1.3 — 部署上线 + 体验闭环（2026-07-10）

- [x] **部署：GitHub Pages** — `https://rqran5201-stack.github.io/lightweave/`
  - 仓库：`github.com/rqran5201-stack/lightweave`
  - GitHub Actions 自动构建部署（push master → build → deploy）
  - 纯静态托管，全球 CDN，免费
- [x] **新增：API Key 未配置引导** — 首页顶部 warm banner，引导用户点击右上角设置
- [x] **新增：引导页 API Key 提示** — 第三步底部卡片提醒配置 LLM API Key
- [x] **新增：数据存储一次性提醒** — 首条记录写入后出现 dismissible banner

## 部署信息

| 项目 | 值 |
|------|-----|
| 线上地址 | https://rqran5201-stack.github.io/lightweave/ |
| GitHub 仓库 | https://github.com/rqran5201-stack/lightweave |
| LLM 代理 | https://lightweave-proxy.lightweave.workers.dev |
| 前端部署 | GitHub Actions → GitHub Pages |
| 代理部署 | wrangler deploy → Cloudflare Workers |
| 触发条件 | 前端：push master / 代理：手动 `wrangler deploy` |
| 本地开发 | `npm run dev` → localhost:5173 |

## 当前功能全景（截至 V3.0）

| 模块 | 功能 | 状态 |
|------|------|------|
| 记录 | 新建 / 编辑 / 删除 / 搜索 / 标签筛选 | ✅ |
| 导入 | 文件拖拽（.txt/.md/.json/.docx/.pdf）+ 文字粘贴（3 种拆分方式） | ✅ |
| 关联分析 | 新记录触发 / 导入触发 / 详情页懒加载触发 + **语义搜索 Top-30** | ✅ |
| 语义搜索 | Transformers.js 浏览器端嵌入（bge-small-zh-v1.5） + 余弦相似度 | ✅ |
| 双向链接 | 正向关联卡片 + 反向引用（getBacklinks） | ✅ |
| 外部知识 | 关联分析附带外部知识框架推荐（严格来源格式 + 反虚构约束） | ✅ |
| Q&A | 流式问答（语义搜索上下文） / 话题折叠 / 删除消息 / 建议问题 / 空态引导 | ✅ |
| SOP | Q&A 一键生成（去重检测 + 确定性标题） / 库列表 / 详情查看 / 删除 / 导出 | ✅ |
| 发现 | 最近关联（真实数据）+ 周度洞察（AI 生成） | ✅ |
| 导出 | MD / TXT / PDF / JSON，两步选择 | ✅ |
| 引导 | 3 步引导页，首次使用自动触发 | ✅ |
| 免费模型 | Qwen3 30B / Llama 3.1 8B / DeepSeek R1 / Gemini | ✅ |
| 模型选择器 | 免费模型 / 自有模型 分组下拉选择 + 手动输入 | ✅ |
| 代理部署 | Cloudflare Worker LLM 代理 + 内置部署引导 | ✅ |
| 旧模型迁移 | 废弃模型 ID 自动映射到新模型 | ✅ |
| 周度洞察 | AI 生成关键词/情绪趋势/亮点关联 + IndexedDB 缓存 | ✅ |
| 数据备份 | JSON 导出/恢复 + 验证 + 合并模式 | ✅ |

## LLM 后端配置参考

| 服务 | 类型 | 模型示例 |
|------|------|---------|
| Cloudflare Workers AI（默认） | 免费内置 | `Qwen3 30B` / `Llama 3.1 8B` / `DeepSeek R1 Qwen 32B` |
| Google Gemini | 免费（需 Worker 端配置） | `gemini-2.0-flash` |
| DeepSeek | 自有 API Key | `deepseek-chat` / `deepseek-reasoner` |
| OpenAI | 自有 API Key | `gpt-4o` / `gpt-4-turbo` |
| Ollama（本地） | 自有 | `qwen2.5` / `llama3` / `mistral` |
| 其他兼容接口 | 自有 API Key | 按服务商提供 |

## 关键设计决策

1. **全浏览器端**：无服务端，用户数据留在 IndexedDB，API 调用从浏览器直连 LLM。隐私优先，但需提醒用户备份数据。
2. **导入不在引导中催促**：用户还不知道产品价值时不应该要求数据迁移。导入入口在首次关联发现后以引导提示出现，同时在输入框工具栏常驻。
3. **关联分析不区分新旧**：新记录触发、导入触发、详情页懒加载——三种触发点确保所有记录最终都被分析。
4. **双 tab 导入（文件 + 文字）**：覆盖知识迁移两大场景——存量文件（Notion/Obsidian 导出）和随手复制（微信/备忘录粘贴）。
5. **多 LLM 支持**：API 地址和模型名完全可配置，不锁定单一服务商。
6. **语义搜索替代时间截断**：V3.0 起不再用 `slice(0, 30)` 选历史记录，改用 Transformers.js 浏览器端嵌入 + 余弦相似度全文检索。LLM 看到的是最相关的记录而非最新的记录。这是织光从"能用"到"真正有效"的关键一跳。

---

## 用户反馈与交互记录

> 以下按时间线记录用户的核心反馈、需求表达，以及我的理解和回应。每条包含日期、用户原话要点、上下文背景、我的分析和最终采取的行动。

---

### 2026-07-09（前置 session — 齐码流水线 & 产品构建）

#### 1. 项目启动：从"知识库"到"织光"

**用户**：继续知识库的项目。

**上下文**：用户此前已完成竞品调研，发现 RAG 知识库市场极度拥挤（MaxKB / Dify / FastGPT / RAGFlow 等），决定转向"AI 认知伴侣"方向，产品命名为"织光 LightWeave"。

**回应**：确认产品定位——不做文档查询工具，做个人认知伴侣。启动齐码 vibe coding 流水线（idea → interaction → architecture → design → prototype → implement）。

**产出**：`idea.md` / `interaction.md` / `architecture.md` / `design.md` 全部就位，design.md lint 0 error。

---

#### 2. /btw — 笔记产品的"日记感"与用户信任

**用户**：笔记产品的"日记"属性很重要——用户在里面写下的、思考的东西是对产品的托付。日记格式能加强用户和产品的联系，也是对产品被认可的标志。可以参考标签、flomo 等产品。

**我的理解**：用户不是在提功能需求，而是在描述产品哲学——织光的核心体验不是"工具"，而是"伴侣"。用户把思考托付给产品，产品回报以关联和洞察。

**影响**：这一理念贯穿了后续所有设计决策——引导不催导入、关联语气用"我注意到"而非"你应该"、SOP 语气像"未来的自己写给现在的自己"。

---

#### 3. /btw — 导出内容范围选择

**用户**：导出时用户应该能选择导出原始记录还是 AI 生成的内容，或者两者都导出。给一个选择按钮：笔记 / AI 生成 / 笔记及 AI 生成。

**我的理解**：用户对"自己的内容"和"AI 生成的内容"有清晰的边界意识。导出时不应混在一起。

**影响**：ExportPopover 设计为两步交互——第一步选内容范围（全部 / 仅笔记 / 仅 AI 分析），第二步选格式（MD / TXT / PDF / PNG）。

---

#### 4. /btw — 图片/PDF 导出排版参考

**用户**：图片和 PDF 的导出排版参考了什么？

**回应**：说明参考了 7 个产品的卡片/导出格式——Flomo 的分享卡片、流光卡片（JesseZhuang）、吉光卡片、ContentPal、Day One 日记导出、Mono Card、Qi Card Note。设计要点：衬线字体大字号、留白为主、左侧色条标记、圆角容器、底部 product badge。

**影响**：这些参考整合进了 `interaction.md` 和 `design.md` 的 Export 组件规范中。

---

#### 5. 导入策略的大转弯

**用户（最初）**：用户第一次打开产品，应该先导入自己已经有的文件或者文字记录等内容的吧？也就是迁移已有知识到织光。

**我的回应**：在引导页第一步加了导入组件，让用户先迁移数据再使用。

**用户（纠正）**：这样做不合理。导出操作不仅是在第一次用产品时要有，还应该在用户使用过程中随时可以从外部导入。而且刚打开产品就让用户迁移已有数据的话，用户还不知道织光是干嘛的，导入就更不合理了。

**我的理解**：这是一个关键的产品洞察——"先给价值，再要数据"。用户需要先体验关联分析的神奇之处，才会愿意把历史记录导入。否则导入只是一个无意义的搬运动作。

**最终方案**：
- 引导页恢复为纯 3 步介绍（不催导入）
- 导入按钮放在输入框工具栏常驻（随时可用）
- 首次发现关联后出现引导提示："发现关联了吗？如果你在其他地方也有记录，点这里导入——记录越多，关联越准"
- 这个时机用户已经体验到产品价值，导入意愿最强

---

#### 6. 文字粘贴导入

**用户**：现在的导入支持纯文字的形式吗？我看好像是只能导入文件？

**我的理解**：文件导入覆盖了存量文档迁移场景，但遗漏了更日常的场景——从微信/Notion/备忘录随手复制粘贴。用户日常记录可能分散在各种 App 里，不太可能每次都先导出文件再导入。

**回应**：ImportZone 重构为双 tab 组件：
- Tab "拖拽文件"：保留原有拖拽上传功能
- Tab "粘贴文字"：textarea + 3 种拆分方式（按 --- / 按空行 / 整体导入）+ 实时预览记录条数

**产出**：`ImportZone.jsx` 重写，新增 `mode` 状态切换、`pasteSplit` 拆分逻辑、`doImport` 共享调用。

---

#### 7. 原型 vs 产品

**用户**：产品是 html 文件还是一个网站？

**回应**：解释了两者的区别——原型（`lightweave-mockup.html`）是静态视觉稿用于对齐设计，实际产品（`lightweave/` 目录）是 Vite + React 完整应用，所有功能真实可用。

---

### 2026-07-10（当前 session — bug 修复 & 体验打磨）

#### 8. 两个 bug：导入无关联 + Q&A 无回答

**用户**：现在我导入了三条记录，没有显示有关联。并且我把我的 deepseek API 加入后可以提问，但没有解答，这是为什么？

**诊断**：
- Bug 1：`handleImported` 回调保存记录后只更新了列表，从未调用 `analyzeAssociations`。关联分析只在手动保存（`handleSave`）时触发。
- Bug 2：Q&A 流式响应可能因两个原因失败——SSE 解析只识别 `data: `（带空格），部分 API 实现可能发送 `data:`（不带空格）导致所有 chunk 被丢弃；且 `answerQuestion` 返回 0 chunk 时 AI 消息 `content` 为空字符串，spinner 永远转。

**修复**：
- `handleImported` 新增逐条关联分析循环
- `streamChatCompletion` SSE 解析同时处理 `data: ` 和 `data:`
- `QAPage` 新增零 chunk 保护——if (!fullContent) 时清除空消息并提示用户

---

#### 9. Q&A 流式报错详情

**用户**：我用问答形式提问的时候，有这样的提示结果：`answerQuestion(...) is not a function or its return value is not async iterable`

**根因**：`answerQuestion` 声明为 `async function`，内部调用 `streamChatCompletion`（`async function*`）并 `return` 其结果。`async function` 将返回值包裹为 `Promise<AsyncGenerator>`，而 `for await...of` 无法直接迭代 Promise 包装的对象。

**修复**：去掉 `answerQuestion` 的 `async` 关键字——函数内部根本没有 `await` 调用，不需要是 async。去掉后直接返回 AsyncGenerator，`for await` 可正常迭代。

**涉及文件**：`deepseek.js:260`（`export async function` → `export function`）

---

#### 10. 关联分析的产品哲学

**用户**：对于用户导入的内容没能产生关联，只能在用户使用织光产品之后写下新的记录才能找到和已存在（也就是已导入内容）的关联。我认为关联的内容应该是不区分以前的还是现在的，当然应该把最新输入的东西和之前的内容找关联，但之前的内容的关联我认为也该给到用户。

**我的理解**：用户提出了一个核心产品原则——关联应该是"无时间偏见"的。系统不应该只关心"最新一条记录和历史的关联"，而应该让所有记录都在关联图谱中拥有一席之地。旧记录也应该被分析和展示关联。

**修复**：
- `RecordDetail.jsx` 新增懒加载关联分析：当用户打开一条没有缓存关联的旧记录时，自动在后台调用 `analyzeAssociations` 与所有其他记录比对
- 使用 `analyzedRef` 防止重复触发
- 分析中显示 "正在寻找关联..." spinner
- 现在关联分析有三个触发点：新记录保存 → 导入记录 → 详情页懒加载，确保所有记录最终都被分析

**涉及文件**：`RecordDetail.jsx`（新增 imports、analyzing 状态、lazy analysis 逻辑）

---

#### 11. 记录列表加删除按钮

**用户**：记录部分我认为应该加一个删除按钮。

**回应**：在每条记录行末尾添加 ✕ 删除按钮。交互设计——平时不可见（`opacity: 0`），hover 行时出现。点击弹出 `window.confirm` 确认，确认后调用 `deleteRecord` 并刷新列表。使用 `e.stopPropagation()` 防止触发行点击跳转详情页。

**涉及文件**：`RecordHome.jsx`（新增 deleteRecord import、删除按钮 JSX）、`index.css`（`.record-delete-btn` 样式）

---

#### 12. Q&A 消息加删除按钮

**用户**：问答的界面的提问也加一个可删除按钮。

**回应**：
- `db.js` 新增 `deleteQAMessage(id)` 函数
- QAPage 每条消息包裹 `qa-message-wrapper`，右上角 ✕ 按钮（hover 可见）
- 点击后同步删除 IndexedDB 记录和 React state

**涉及文件**：`db.js`（新增函数）、`QAPage.jsx`（新增 import 和删除按钮 JSX）、`index.css`（wrapper + delete 样式）

---

#### 13. Q&A 回答折叠

**用户**：对于问答的问题和回答如果都展开的话篇幅太大了，我认为用户提问给出解答后可以给出一个折叠按钮，只显示问题，答案可以选择折叠会更好，这样占的页面篇幅就没那么大了。

**回应**：AI 回答新增折叠/展开切换：
- 展开态（默认）：完整回答 + "收起回答 ▲" 按钮
- 折叠态：只显示前 80 字预览（斜体灰色）+ "展开回答 ▼" 按钮
- 提问始终完整显示
- `collapsed` 状态为 `{[msgId]: boolean}` 对象，每条消息独立控制

**涉及文件**：`QAPage.jsx`（collapsed state、条件渲染）、`index.css`（`.qa-collapse-toggle`、`.qa-collapsed-preview`）

---

#### 14. 产品发布评估

**用户**：现在织光可以给外围用户使用了吗？可以的话，还需要怎么做；不可以的话，还需要做什么。

**回应**：给出了现状评估表，结论是核心功能可用但有三件事要做：
1. 部署到公网（Vercel / Netlify / GitHub Pages，纯静态 5 分钟）
2. 补完 SOP 生成链路（Q&A → 生成 SOP 还没有 UI 入口）
3. 加强数据丢失提醒

**决策**：先完善产品本身，再考虑部署。

---

#### 15. 个人可用目标

**用户**：继续完善织光这一版，完善目标：用户可以在自己的设备上面用，还需要做什么。

**回应**：系统梳理了三个缺口：
1. **SOP 生成链路缺失**：`generateSOP` API 写了但从 UI 从未调用
2. **SOP 页面展示 demo 假数据**：SOPList 和 SOPDetail 有硬编码的 DEMO_SOP
3. **周度洞察占位**：硬编码关键词

**行动**：
- QAPage 接入 SOP 生成：AI 回答下方增加"生成 SOP"按钮，调用 `generateSOP(question, records)`，保存至 DB 并跳转 SOP 详情页
- SOPList 移除 DEMO_SOPS，空态展示引导 CTA
- SOPDetail 移除 DEMO_SOP，loading/not-found 状态分离

**涉及文件**：`QAPage.jsx`（generatingSOP state、handleGenerateSOP、按钮 JSX）、`SOPList.jsx`（删除 demo 数据）、`SOPDetail.jsx`（删除 demo 数据、分离 loading/404 状态）、`index.css`（`.qa-answer-footer`）

---

#### 16. /btw — 多 LLM 支持

**用户**：织光的 API 调用只能用 deepseek 这一个大模型吗？是否支持其他的 LLM？

**回应**：目前只接了 DeepSeek，但 DeepSeek 使用的是 OpenAI 兼容 API 格式。要支持其他 LLM 只需把 API 地址和模型名变成可配置的——在设置页加两个字段，`deepseek.js` 从 localStorage 读取替代硬编码。

**用户**：（/btw 加上）

**实现**：
- `deepseek.js`：新增 `getApiBase()`、`getModel()` 函数；所有 `API_BASE` 替换为 `getApiBase()`；所有 `model: 'deepseek-chat'` 替换为 `model: getModel()`；`getApiKey()` 增加旧 key 迁移逻辑（`deepseek_api_key` 作为 fallback）
- `SettingsModal.jsx`：新增 API 地址和模型两个输入框，各带 placeholder 和说明文案；保存时迁移旧 key
- `App.jsx`：`apiKeyOk` 检测同步使用新 key 名（带 fallback）

**涉及文件**：`deepseek.js`、`SettingsModal.jsx`、`App.jsx`

---

#### 17. 进度文档独立

**用户**：更新织光产品的进度，每一步修改、更新、设置都要写在进度文档里面。我想你把织光的相关内容单独放一个产品进度更新文档，和黄老师的项目不要掺杂在一起。

**回应**：创建 `lightweave/PROGRESS.md`，包含产品定义、技术架构、文件结构、版本演进（V1.0 → V1.1 → V1.2）、功能全景表、LLM 配置参考、关键设计决策。

**用户（追加）**：把我的要求和我说的内容以及你的回答也都整理在进度文档里面，具体的内容你去你的存储空间找。

**回应**：从对话 transcript（`1916526a-7e2a-4fe7-a3c2-7088be408541.jsonl`，1486 行）和 memory 目录提取了所有交互记录，按时间线组织为"用户反馈与交互记录"章节，每条包含日期、用户原话要点、上下文背景、我的诊断/理解和最终采取的行动。

**涉及文件**：`PROGRESS.md`（完整更新）

---

#### 18. 最低字数提示

**用户**：现在写文字后记录的按钮成灰色了，无法点，上传不上去。

**根因**：保存按钮有 ≥10 字符的最低限制（`canSave = charCount >= 10 && !saving`），但界面上没有任何提示告知这个规则。用户打字后看到按钮仍是灰色，以为是功能故障。

**修复**：在字数统计旁新增"还需 N 字"提示（1-9 字符时显示），超过 10 字符后自动消失。

**涉及文件**：`RecordHome.jsx`

---

#### 19. 免费 LLM 内置

**用户**：你把免费的 LLM 直接部署在织光上，让用户自己选择用哪个模型，这样不需要用户自己配 API KEY，更好上手。

**方案**：Cloudflare Worker 作为 LLM 代理，利用 Cloudflare Workers AI 免费套餐（每日 10 万请求 + 1 万 AI 推理配额）。Worker 暴露 OpenAI 兼容 `/v1/chat/completions` 端点，前端透明路由。

**实现**：
- 新建 `worker/` 目录（3 个文件）：Cloudflare Worker 代理，支持 Workers AI 和 Gemini 双后端
- 新建 `src/api/models.js`：模型目录 + `isLlmConfigured()` + `isFreeModel()` + `migrateModel()`
- `deepseek.js`：`getApiBase()`/`getApiKey()`/`getHeaders()` 根据模型类型切换代理/直连
- `SettingsModal.jsx`：下拉模型选择器 + 条件字段（代理地址 / API Key / API Base）+ 5 步代理部署教程
- `App.jsx`：`apiKeyOk` 改用 `isLlmConfigured()`
- `GuidePage.jsx`：引导页提及免费模型
- `RecordHome.jsx`：设置提示横幅文案更新

**部署**：注册 Cloudflare 账号 → `wrangler login` → `wrangler deploy` → Worker 地址 `https://lightweave-proxy.lightweave.workers.dev`。前端默认代理地址已预填。

**费用**：零成本。GitHub Pages 免费 + Cloudflare Workers 免费套餐 + Workers AI 免费额度。

**涉及文件**：`worker/`（3 个新文件）、`models.js`（新）、`deepseek.js`、`SettingsModal.jsx`、`App.jsx`、`RecordHome.jsx`、`GuidePage.jsx`

---

#### 20. 模型废弃修复

**用户**：输入问题后提示 `5028: This model was deprecated on 2026-05-30. Please use an alternative model.`

**根因**：Cloudflare 在 5 月 30 日废弃了 `@cf/meta/llama-3.1-8b-instruct` 等一批老模型。免费模型列表更新为新模型名后，用户 localStorage 中缓存的旧模型 ID 不在 `FREE_IDS` 集合中，`isFreeModel()` 返回 false，请求被错误路由到 DeepSeek API。

**修复**：
- 免费模型列表更新为 4 个当前可用模型（Qwen3 30B / Llama 3.1 8B fp8 / DeepSeek R1 Qwen 32B / Gemini 2.0 Flash）
- 新增 `DEPRECATED_FREE_IDS` 集合 + `migrateModel()` 自动映射旧 ID 到新 ID
- `getModel()` 读取时自动迁移并回写 localStorage

**涉及文件**：`models.js`、`deepseek.js`

---

#### 21. Q&A 流式空响应

**用户**：问答提示"未收到回复，请检查 API Key 或重试"，但有时又能看到回复内容。

**诊断**：Workers AI 流式返回的数据格式可能因模型而异——部分模型返回 raw JSON（`{"response":"text"}\n`），部分返回 SSE 格式（`data: {"response":"text"}\n\n`）。Worker 只处理了 raw JSON 格式，遇到 SSE 格式时 JSON.parse 失败，所有 chunk 被跳过，导致前端收到 0 内容。

**修复**：Worker 的 `handleWorkersAIStream` 新增 `data:` / `data: ` 前缀兼容处理，同时识别两种流式格式。

**涉及文件**：`worker/src/index.js`

---

### 2026-07-12（当前 session — 功能补完 & 战略评估）

#### 22. 周度洞察从占位到 AI 驱动

**用户**："做"（继续继续周度洞察功能）

**实现**：
- `deepseek.js` 新增 `generateWeeklyInsight(weekRecords, historicalRecords)` — 分析本周记录产出关键词、情绪趋势、与过去的亮点关联、一句话总结
- `db.js` 新增 `saveWeeklyInsight`/`getWeeklyInsight`，按 ISO 周缓存，同周不重复调用 AI
- `Discovery.jsx` 周度洞察 tab 完全重写，四种状态覆盖（加载中/空态/错误态/完成态）
- 亮点关联卡片可点击跳转记录详情

**涉及文件**：`deepseek.js`、`db.js`、`Discovery.jsx`、`PROGRESS.md`

---

#### 23. 数据备份恢复

**用户**：（确认数据备份要做产品级功能，非个人一次性脚本）

**用户**：B（设置页"数据管理"区域，所有用户可用）

**实现**：
- `src/api/backup.js`（新文件）：`exportAllData()` → 打包全量 JSON → 触发下载；`readBackupFile()` → `validateBackup()` → `importBackup()` 全链路
- `db.js` 新增 `putRecord` 保留原始 ID 写入
- `SettingsModal.jsx` 新增"数据管理"区域：导出按钮 + 导入按钮 + 备份信息确认弹窗 + 成功/错误状态

**设计决策**：导入采用合并模式（非替换）——保留原始 ID，已有记录更新、新记录追加，不覆盖已有设置。避免用户误导入旧备份导致数据丢失。

**涉及文件**：`backup.js`（新）、`db.js`、`SettingsModal.jsx`

---

#### 24. 取消最低字数限制

**用户**：把最低字数限制取消，只要不是没有字符就好

**改动**：`RecordHome.jsx` 中 `canSave = charCount >= 10` → `charCount > 0`，移除"还需 N 字"提示。现在输入任意有内容的文字即可保存。

**涉及文件**：`RecordHome.jsx`

---

#### 25. 回顾原始迭代路线

**用户**：你回想一下最开始我们商讨的织光的迭代

**回应**：回顾了 idea.md 原始规划——三引擎飞轮、V1 用户画像（林知然）、用户群扩张路线（V1→V2→V3→V4+）、MVP 必做与明确不做、以及 idea.md 标注的 V2/V3 待做项（显式反馈 👍/👎、Tavily Search API、账号体系+多设备同步、Freemium）。

**发现**：实际走的路线与原始 V2 规划有偏差——原始 V2 偏"系统化"（账号/反馈/搜索API），我们实际做的 V2.0-V2.3 偏"体验闭环"（免费LLM/周度洞察/数据备份/字数放宽）。两者不矛盾，但方向不同。

---

#### 26. ToB 战略评估

**用户**：重新评估织光的迭代方向。最开始想的是可以做个人也可以做企业，第一版做了个人，是否有扩展到企业/商业/ToB市场的可能？

**回应要点**：

- **织光与"知识库"产品本质不同**：不做 RAG 检索，做从非结构化思考记录中发现模式、孵化方法。三引擎在企业侧有自然映射——跨部门经验关联、行业最佳实践解释项目卡点、从多项目文档中提炼组织 SOP。

- **企业版一句话定义**：组织的"集体认知伴侣"——从散落各处的项目记录中，自动发现跨团队模式、提炼可复用方法论、防止组织知识流失。

- **ToB 是蓝海但需要独立产品**：飞书/钉钉/Notion/Confluence 全在做"整理文档"，无人做"从文档孵化方法论"。但企业版和个人版是两个独立产品——共享引擎内核，完全不同的部署方式（私有化/SaaS）、交互语言（不能用"我注意到你最近..."）、商业模式。

- **用户的核心洞察**：对于 ToB 市场，现有的织光如果迭代成适配更大群体、更宏大体系的商用场景，是两个不同的方向。需要重新搭建。

**结论**：个人版深耕和 ToB 探索是两条独立路线。

---

#### 27. 个人版深耕方向评估

**用户**：个人版的深耕还有可能有什么方向

**回应**：提出了五个方向并给出优先级判断：

| 方向 | 用户感知 | 实现难度 | 竞品差异化 |
|------|:---:|:---:|:---:|
| 关联深度（主题追踪/矛盾检测） | 极高 | 中 | 极高 |
| 主动关怀（时光回溯/低谷识别） | 极高 | 中 | 高 |
| 写作引导（反思卡片/复盘框架） | 高 | 低 | 中 |
| 可视化认知地图 | 高 | 中高 | 高 |
| 外部知识搜索（Tavily） | 中 | 低 | 中 |

**关联深度**和**主动关怀**被评估为"用户真的会觉得不一样"的方向——前者让关联从"找相似"质变为"讲故事"，后者让系统从被动响应变为真正的伴侣。

**涉及文件**：无代码改动，纯战略讨论。记录于此以供后续参考。

---

#### 28. Sprint 1 待办列表填写

**用户**：根据当前进度，填写 `培训提交资料/sprint1待办列表(1).xls`

**产出**：`sprint1待办列表_织光.xls`（原文件被 Excel 锁定，另存为新文件）

内容基于 PROGRESS.md 中的完整研发记录：

- **6 个用户故事** — 按织光实际功能模块组织：
  1. 基础记录系统（40 pts）— 项目骨架 / IndexedDB / CRUD / CSS
  2. 关联分析引擎（55 pts）— API 客户端 / 引擎② / 双向链接 / 引擎①
  3. 数据导入导出（35 pts）— 文件导入 / 粘贴导入 / 导出 / 备份恢复
  4. 问答与 SOP（30 pts）— 流式问答 / 引擎③ SOP 孵化 / SOP 页面
  5. 免费 LLM 内置（30 pts）— Worker 代理 / 模型选择器 / 透明路由
  6. 周度洞察与引导（25 pts）— AI 周度洞察 / 引导页 / 部署 CI/CD

- **32 项任务** — 每项标注优先级（1-3）和工时估算
- **每日工时跟踪**（Day1-Day5）— 按实际开发顺序拆分每天工时
  - Day1 36h / Day2 32h / Day3 50h / Day4 46h / Day5 38h = 总计 202h
- **故事点总计**：215 pts

**涉及文件**：`培训提交资料/sprint1待办列表_织光.xls`（新文件）

---

### 2026-07-13（当前 session — 产品汇报 & UX 修复 & 架构升级）

#### 29. 第一阶段产品汇报

**用户**：要进行织光第一阶段的产品汇报

**上下文**：用户在培训项目中需要做织光的产品阶段汇报，需要一个完整的逐字稿和 PDF 供现场使用。

**产出**：
- `Agent体系/织光_发布汇报_逐字稿.md`（新文件）— 5 分钟完整逐字稿，含开场/产品演示流程/技术亮点/Q&A 预判
- `Agent体系/generate_script_pdf.py`（新文件）— Markdown → HTML → Word COM → PDF 转换脚本（WeasyPrint 在 Windows 有 GTK 依赖问题，改用 Word COM）

**汇报核心内容**：
- 产品定位：个人 AI 认知伴侣，不是笔记工具也不是知识库
- 三引擎飞轮：外部知识注入 → 内部模式关联 → SOP 孵化
- 技术架构：纯浏览器端（IndexedDB + localStorage）、双路径 LLM 路由（免费 Worker 代理 / 自有 API 直连）
- Demo 流程：写记录 → AI 发现关联 → 外部知识推荐 → Q&A 问答 → 一键生成 SOP
- 竞品差异：vs 思源笔记（传统 Embedding→FAISS，被动检索）vs Flomo（无 AI 关联）

#### 30. 技术深度讨论

**用户**：技术实践和大模型接入是怎么实现的 / 在本地检索知识库的时候，是用什么算法实现的 / 现在织光用的什么模型训练的

**回应要点**：
- **没有用训练模型**：织光不做 fine-tuning，用的是 prompt engineering + context injection。三引擎都是精心设计的 system prompt + 用户记录上下文 → LLM 推理
- **本地检索算法**：坦白讲，V2.x 没有检索算法——直接取 `slice(0, 30)` 最近记录送给 LLM。这是当前最大短板
- **与思源笔记对比**：思源用 Embedding → FAISS 向量检索（传统 RAG 路线），织光用 LLM 直接理解（zero-shot 推理）。理念不同——思源是被动检索，织光是主动发现关联。但织光受限于 context window，记录多了会丢失信息

**关键洞察**：这场讨论直接引出了 #34 的数据量限制分析 → #35 的嵌入语义搜索升级。用户问"用什么算法"让我意识到"没有算法"本身就是问题。

#### 31. 用户测试反馈：9 项问题

**用户**：使用织光发现了一些问题：1. 用户不上传记录直接用问答模式时… 2. 每次生成的 SOP… 3. 对于同样的问题… 4. 来源空白… 5. 用户清除后数据会丢失… 6. 滚轮在问答输出过程中不能查看上部内容… 7. 在删除问或者答后，页面会自动到最后的部分… 8. 借鉴 Codex 的话题折叠… 9. 借鉴思源的搜索，把织光的深度做到极致

**诊断**：逐一分析 9 项问题的根因：
- #1: 空记录问答无引导，AI 基于零记录回答但用户不知道
- #2: SOP 标题每次随机生成，同一问题产生不同标题
- #3: 重复生成 SOP 无去重检测
- #4: LLM 编造外部知识来源
- #5: 纯浏览器存储，用户不知道数据有丢失风险
- #6: `scrollIntoView` 锁定滚动位置
- #7: 删除触发 React state 更新导致 scroll useEffect 重新执行
- #8: 对话多时页面冗长
- #9: LLM context window 限制导致只看到最近 30 条记录

**决策**：先做 #1-8 七项修复（UX 层面，快速见效），#9 单独做（架构层面，影响最大）。

#### 32. 7 项 UX 修复提交流程

**用户**：先把这 7 项推上去

**产出**：
- `QAPage.jsx` 重写：空记录引导横幅、动态 placeholder、scrollContainerRef 智能滚动、skipAutoScroll ref、groupMessagesIntoTopics 话题折叠
- `deepseek.js` prompt 修复：SOP 标题确定性规则、外部知识来源严格化+反虚构约束
- `ImportZone.jsx`：首次记录后数据存储说明横幅
- `index.css`：新增 `.qa-scroll-area` / `.qa-topic-group` / `.qa-topic-header` 等折叠样式

**提交**：`44c6847` — "Fix 7 UX issues: smart scroll, topic folding, empty guidance, SOP dedup, anti-hallucination prompts, data notice"

#### 33. 多格式导入扩展

**用户**：现在的导入模式，我想加入更多模式的文档适配：Word 文档、PDF、md

**实现**：
- `import.js` 新增 `parseDocx()`（mammoth 动态加载）和 `parsePdf()`（pdfjs-dist 动态加载）
- 两种库均使用动态 `import()` — 仅在用户导入 .docx/.pdf 时加载，首次加载不增加体积
- PDF 按页拆分：单页→一条记录，多页→逐页记录+`第N页` 标签
- `ImportZone.jsx` 更新 accept 属性、文件类型过滤器、帮助文案

**构建优化**：main bundle 274KB gzipped，PDF chunk 425KB，lib chunk 497KB — 三个独立文件并行加载

**提交**：`c3b6177` — "feat: support .docx and .pdf file import"

#### 34. 数据量限制分析

**用户**：现在的织光对用户上传的数据量是否有限制，还是说用户上传多大的空间的内容都能承受

**分析结论**：
- IndexedDB 上限：~2GB（浏览器限制，非织光限制）
- 实际瓶颈不在存储，而在 **LLM context window**
- 所有 LLM 调用 hard-truncate：`slice(0, 30)` — 永远只送最近 30 条记录
- 用户有 1000 条记录时，AI 仍然只看到最近 30 条
- **这直接阉割了织光的核心价值**：旧记录对 AI 完全不可见

**用户反馈**：这确实是个严重的问题，织光的主要功能被阉割了。

#### 35. 嵌入语义搜索升级

**用户**：升级

**方案**：Transformers.js 浏览器端嵌入 + 语义搜索替代 `slice(0, 30)`

**架构变化**：
```
之前：保存记录 → IndexedDB → LLM 调用时取 slice(0, 30) → LLM
之后：保存记录 → 生成嵌入向量 → IndexedDB → 查询时全文语义搜索 Top-30 → LLM
```

**实现**（6个文件）：
- `src/api/embedding.js`（新）：嵌入 pipeline（bge-small-zh-v1.5，512维）+ 余弦相似度检索
- `src/store/db.js`：DB v2 + embeddings store + `getAllRecordsWithEmbeddings` + `getRecordsWithoutEmbeddings`
- `src/App.jsx`：启动时后台迁移旧记录嵌入 + cancelled 清理
- `src/pages/RecordHome.jsx`：保存/导入 → 生成嵌入 → 语义搜索关联 → fallback 到最近记录
- `src/pages/QAPage.jsx`：问答/SOP 生成 → 语义搜索上下文
- `src/pages/RecordDetail.jsx`：懒加载关联分析 → 语义搜索

**关键设计**：
- 嵌入生成异步非阻塞（fire-and-forget）
- 模型未就绪时自动回退到最近记录模式
- 旧记录后台逐条迁移，可取消
- 首次下载模型 ~30MB（5-15秒），浏览器永久缓存

**效果**：LLM 现在"看到"的是全文中最相关的 30 条记录，而非简单取最近 30 条。即使有 10000 条历史记录，AI 也能精准找到与当前内容相关的那些。

#### 36. Sprint 2 待办列表

**用户**：下一步迭代要填写 sprint2 待办列表，根据我们之间的交流给出这个文档

**产出**：`培训提交资料/sprint2待办列表.xls`

- **5 个 Epic**：语义搜索内核 / 多格式导入 / 问答体验修复 / AI 可信度 / 数据安全透明
- **21 项任务**，总预估 76.5 小时（约 3 周 × 1 人）
- Sprint 周期：2026.07.15 - 2026.08.04
- 全部围绕"个人层面功能做深做透"主题
