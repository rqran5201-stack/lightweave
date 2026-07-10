# 织光 LightWeave — 产品进度文档

> 最后更新：2026-07-10

## 产品一句话定义

个人 AI 认知伴侣。写下你的复盘、日记、思考随笔，AI 自动发现隐藏关联，从你的记录中孵化出属于你自己的方法论（SOP）。

## 技术架构

- **前端**：Vite + React，纯浏览器端，无服务端
- **存储**：IndexedDB（idb 库），所有用户数据留在浏览器本地
- **AI**：浏览器直连 LLM API（OpenAI 兼容格式），默认 DeepSeek，可切换
- **三引擎飞轮**：① 外部知识注入 ② 内部模式关联 ③ SOP 孵化

## 文件结构

```
lightweave/
├── src/
│   ├── App.jsx                    # 路由、Toast、导航、设置弹窗
│   ├── main.jsx                   # 入口
│   ├── index.css                  # 完整 design token CSS（22色/字体/圆角/阴影/组件）
│   ├── api/
│   │   ├── deepseek.js            # LLM API 客户端（OpenAI 兼容）
│   │   └── import.js              # 文件解析器（txt/md/json）
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
│       ├── SettingsModal.jsx      # 设置弹窗：API Key + API 地址 + 模型
│       └── ConfirmDialog.jsx      # 确认弹窗
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

## 当前功能全景（截至 V1.2）

| 模块 | 功能 | 状态 |
|------|------|------|
| 记录 | 新建 / 编辑 / 删除 / 搜索 / 标签筛选 | ✅ |
| 导入 | 文件拖拽（.txt/.md/.json）+ 文字粘贴（3 种拆分方式） | ✅ |
| 关联分析 | 新记录触发 / 导入触发 / 详情页懒加载触发 | ✅ |
| 双向链接 | 正向关联卡片 + 反向引用（getBacklinks） | ✅ |
| 外部知识 | 关联分析附带外部知识框架推荐 | ✅ |
| Q&A | 流式问答 / 折叠 / 删除消息 / 建议问题 | ✅ |
| SOP | Q&A 一键生成 / 库列表 / 详情查看 / 删除 / 导出 | ✅ |
| 发现 | 最近关联（真实数据） | ✅ |
| 导出 | MD / TXT / PDF，两步选择 | ✅ |
| 引导 | 3 步引导页，首次使用自动触发 | ✅ |
| 设置 | API Key + API 地址 + 模型，留空使用默认值 | ✅ |
| 周度洞察 | — | ⬜ 占位 |
| 数据备份 | — | ⬜ |

## LLM 后端配置参考

| 服务 | API 地址 | 模型示例 |
|------|---------|---------|
| DeepSeek（默认） | `https://api.deepseek.com/v1` | `deepseek-chat` / `deepseek-reasoner` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` / `gpt-4-turbo` |
| Ollama（本地） | `http://localhost:11434/v1` | `qwen2.5` / `llama3` / `mistral` |
| 其他兼容接口 | 任意 | 按服务商提供 |

## 关键设计决策

1. **全浏览器端**：无服务端，用户数据留在 IndexedDB，API 调用从浏览器直连 LLM。隐私优先，但需提醒用户备份数据。
2. **导入不在引导中催促**：用户还不知道产品价值时不应该要求数据迁移。导入入口在首次关联发现后以引导提示出现，同时在输入框工具栏常驻。
3. **关联分析不区分新旧**：新记录触发、导入触发、详情页懒加载——三种触发点确保所有记录最终都被分析。
4. **双 tab 导入（文件 + 文字）**：覆盖知识迁移两大场景——存量文件（Notion/Obsidian 导出）和随手复制（微信/备忘录粘贴）。
5. **多 LLM 支持**：API 地址和模型名完全可配置，不锁定单一服务商。

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
