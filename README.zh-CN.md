# 🦞 openclaw-insight

> [OpenClaw](https://github.com/openclaw/openclaw) 使用分析与改进建议工具 — 分析你的 AI 助手使用习惯，获得可执行的优化方案。

[English](./README.md) | **简体中文** | [日本語](./README.ja.md)

灵感来自 [Claude Code 的 `/insights` 命令](https://docs.anthropic.com/en/docs/claude-code)，`openclaw-insight` 分析你本地的 OpenClaw 会话历史，生成包含使用统计、行为模式、摩擦分析和改进建议的交互式报告。

## 特性

![总览仪表盘](./resource/summary.jpg)

### 📊 全面的使用统计
- **会话指标**：总数、每日平均、活跃天数、连续使用天数
- **Token 消耗**：输入/输出分解、缓存命中率、费用估算
- **时间维度分析**：每日活跃图表、高峰时段识别
- **频道分布**：各频道会话数、Token 效率对比
- **模型使用**：多模型多样性分析、各模型缓存表现

![图表可视化](./resource/charts.jpg)

### 🔍 行为模式检测
- **高峰时段** — 识别你最活跃的使用时间段
- **频道偏好** — 分析各平台使用分布
- **会话时长画像** — 区分快速查询与深度对话
- **缓存利用** — 衡量 Prompt 缓存有效性
- **模型多样性** — 追踪多模型使用模式
- **工具偏好** — 排名最常用的助手工具

![使用模式](./resource/usage-pattern.jpg)

### 🔥 摩擦分析
自动检测会话中的痛点：

| 摩擦类型 | 说明 |
|---|---|
| Token 浪费过高 | 输出/输入比例异常的会话 |
| 过度压缩 | 反复触达上下文限制的对话 |
| 废弃会话 | 开始但几乎未使用的会话 |
| 缓存未充分利用 | 大会话但零缓存命中 |
| 上下文溢出 | 反复耗尽上下文窗口 |
| 单消息会话 | 高开销的短暂交互 |

![摩擦分析](./resource/friction-analysis.jpg)

### 💡 可执行的改进建议
按影响和实施难度分类的建议：

- **Token 效率** — 缓存优化、冗余控制、批量处理
- **频道优化** — 多频道接入、各频道效率分析
- **模型选择** — 将简单任务路由到更经济的模型
- **上下文管理** — 对话拆分、Token 预算控制
- **调度优化** — 使用模式优化
- **记忆利用** — 跨会话上下文保持
- **功能发现** — 未充分使用的 OpenClaw 功能
- **工作流改进** — 对话深度优化、需求明确化

![改进建议](./resource/improvement-suggestions.jpg)

### 📈 交互式 HTML 报告
精美的深色/浅色主题报告：
- Chart.js 驱动的交互式可视化
- 可展开的建议卡片（含配置代码片段）
- 可排序的会话详情表格
- 全响应式设计
- **100% 本地运行** — 无数据上传

![会话详情](./resource/session-detail.jpg)

## 安装

### 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-insight/main/install.sh | bash
```

### 通过 npm 安装

```bash
# 全局安装
npm install -g openclaw-insight

# 或直接运行
npx openclaw-insight
```

### 从源码构建

```bash
git clone https://github.com/openclaw/openclaw-insight.git
cd openclaw-insight
npm install
npm run build
node dist/index.js
```

## 使用

```bash
# 基本用法 — 分析最近 30 天，在浏览器中打开报告
openclaw-insight

# 分析最近 7 天
openclaw-insight --days 7

# 输出为 JSON 格式
openclaw-insight --format json --output report.json

# 指定自定义状态目录
openclaw-insight --state-dir /path/to/.openclaw

# 分析特定 Agent
openclaw-insight --agent my-agent-id

# 详细模式
openclaw-insight --verbose

# 不自动打开浏览器
openclaw-insight --no-open
```

## 命令行选项

| 选项 | 默认值 | 说明 |
|---|---|---|
| `-d, --days <n>` | `30` | 分析天数 |
| `-m, --max-sessions <n>` | `200` | 最大处理会话数 |
| `-a, --agent <id>` | 自动检测 | 要分析的 Agent ID |
| `-s, --state-dir <path>` | `~/.openclaw` | OpenClaw 状态目录 |
| `-o, --output <path>` | `~/.openclaw/usage-data/report.html` | 输出文件路径 |
| `-f, --format <fmt>` | `html` | 输出格式（`html` 或 `json`） |
| `--no-open` | — | 不自动打开报告 |
| `-v, --verbose` | — | 启用详细输出 |

## 工作原理

```
┌──────────────────────────────────────────────────────────┐
│                    openclaw-insight                        │
├───────────┬───────────┬──────────────┬───────────────────┤
│  数据采集  │  统计分析  │   改进建议    │    报告渲染       │
│           │           │              │                   │
│ sessions  │ 每日活跃   │ Token 效率   │ HTML + Chart.js   │
│ .json     │           │              │ 交互式报告        │
│           │ 时段分布   │ 频道优化     │                   │
│ 会话      │           │              │ 深色/浅色主题     │
│ .jsonl    │ 频道统计   │ 模型选择     │                   │
│ 记录      │           │              │ JSON 导出         │
│           │ 模型统计   │ 上下文管理   │                   │
│           │           │              │                   │
│           │ 行为模式   │ 工作流改进   │                   │
│           │           │              │                   │
│           │ 摩擦事件   │ 功能发现     │                   │
└───────────┴───────────┴──────────────┴───────────────────┘
```

### 处理流程

1. **数据采集** — 读取 `~/.openclaw/agents/{agentId}/sessions/` 下的 `sessions.json` 和 `.jsonl` 会话记录文件
2. **统计分析** — 计算每日/时段分布、频道统计、模型统计，检测行为模式和摩擦事件
3. **生成建议** — 基于检测到的模式生成优先级排序的改进建议
4. **报告渲染** — 生成包含 Chart.js 可视化的自包含 HTML 报告或结构化 JSON 导出

### 数据来源

| 来源 | 路径 | 内容 |
|---|---|---|
| 会话存储 | `~/.openclaw/agents/{id}/sessions/sessions.json` | 会话元数据、Token 总量、模型信息 |
| 会话记录 | `~/.openclaw/agents/{id}/sessions/{sid}.jsonl` | 完整对话历史、每轮 Token 用量 |

## 隐私

- **100% 本地** — 所有分析在你的机器上运行
- **无上传** — 没有数据离开你的系统
- **无遥测** — 工具本身不收集任何使用数据
- **不读取内容** — 只关注交互模式，不分析对话内容

## 项目结构

```
openclaw-insight/
├── src/
│   ├── index.ts          # CLI 入口 & 流水线编排
│   ├── collector.ts      # 数据采集 & JSONL 解析
│   ├── analyzer.ts       # 统计分析 & 模式检测
│   ├── suggestions.ts    # 改进建议引擎
│   ├── report.ts         # 交互式 HTML 报告渲染
│   ├── types.ts          # TypeScript 类型定义
│   └── utils.ts          # 工具函数
├── bin/
│   └── openclaw-insight.mjs  # CLI shim
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式运行
npm run dev

# 运行测试
npm test

# 清理构建产物
npm run clean
```

## 与 Claude Code Insight 对比

| 特性 | Claude Code `/insights` | openclaw-insight |
|---|---|---|
| 范围 | 单个编码 Agent | 多频道 AI 网关 |
| 频道分析 | 不适用 | 各频道统计 & 效率分析 |
| 模型追踪 | 单模型 | 多模型对比 |
| 工具使用 | 代码工具（Read, Edit, Bash） | 所有 OpenClaw 工具 & 插件 |
| 缓存分析 | 基础 | 各模型详细缓存命中率 |
| 费用估算 | 无 | 各模型费用估算 |
| 摩擦类型 | 代码相关 | 网关相关（上下文溢出、Token 浪费） |
| 报告格式 | HTML | HTML + JSON |
| 隐私 | 本地 | 本地 |

## 许可证

MIT — 详见 [LICENSE](LICENSE)
