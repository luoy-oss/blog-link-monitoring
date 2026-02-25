# 主动式网站链接状态监测 (Blog Link Monitoring)

这是一个基于 Vercel + MongoDB 构建的主动式网站链接状态监测服务，专为博客友链、个人收藏夹等场景设计。它能自动监测链接的可用性、响应时间，并提供历史数据追踪和可视化分析能力。

## ✨ 核心特性

- **自动监测**：利用 Vercel Cron Jobs 每天定时自动检测目标链接状态。
- **多维度数据**：
  - **实时状态**：记录最新一次的存活状态、响应时间、截图等。
  - **最近30天趋势**：自动维护最近30天的每日统计数据（可用率、平均响应时间），支持滚动更新。
  - **历史流水**：保存详细的检测日志，便于故障追溯。
  - **月度汇总**：自动生成月度可用性报表。
- **API 支持**：提供丰富的 RESTful API，支持单点/批量监测、数据查询、历史回溯。
- **无服务器架构**：完全适配 Vercel Serverless 环境，无需维护传统服务器。
- **可视化组件**：提供配套的前端组件（适配 Butterfly 主题），轻松集成到博客页面。

## 🚀 快速部署

### 1. 准备工作
- 一个 [GitHub](https://github.com/) 账号
- 一个 [Vercel](https://vercel.com/) 账号
- 一个 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 数据库（免费版即可）

### 2. 部署 API 服务
1. Fork 本仓库到你的 GitHub。
2. 在 Vercel 中导入该项目。
3. 配置环境变量（Environment Variables）：
   - `MONGODB_URI`: MongoDB 连接字符串 (例如: `mongodb+srv://user:pass@cluster.xxx.mongodb.net/monitoring?retryWrites=true&w=majority`)
   - `GITHUB_REPO`: 你的友链数据来源仓库 (例如: `yourname/blog-data`) [**✅必须** 用于自动从 Issue 获取友链]
   - `GITHUB_TOKEN`: GitHub Token [可选，用于读取 Issue]
4. 部署项目。

### 3. 配置自动监测
项目已内置 `vercel.json` 配置，部署后 Vercel 会自动识别 Cron Job。
- 默认每天执行一次全量检查。
- 你也可以访问 `/api/cron-check` 手动触发检查。

## 🔌 API 接口文档

### 1. 执行监测

**单点监测**
- **URL**: `/api/monitor`
- **Method**: `POST`
- **Body**: `{ "url": "https://example.com" }`

**批量监测**
- **URL**: `/api/batch-monitor`
- **Method**: `POST`
- **Body**: `{ "urls": ["https://a.com", "https://b.com"] }`

### 2. 获取数据

**获取所有站点最新状态**
- **URL**: `/api/data`
- **Method**: `GET`
- **Query**: `?limit=100` (可选)

**获取单站最近30天趋势**
- **URL**: `/api/recent-stats`
- **Method**: `GET`
- **Query**: `?url=https://example.com`
- **Response**: 返回该站点最近30天的每日可用率、响应时间统计。

**获取单站历史流水**
- **URL**: `/api/history`
- **Method**: `GET`
- **Query**: `?url=https://example.com&page=1&limit=20`

**获取月度汇总**
- **URL**: `/api/monthly`
- **Method**: `GET`

## 💻 本地开发

1. 克隆仓库
   ```bash
   git clone https://github.com/luoy-oss/blog-link-monitoring.git
   cd blog-link-monitoring
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 配置环境变量
   复制 `.env.example` 为 `.env`，并填入你的 `MONGODB_URI`。

4. 启动开发服务器
   ```bash
   npm start
   ```
   服务将运行在 `http://localhost:3000`。

## 🎨 前端集成

如果你使用的是 Hexo Butterfly 主题，可以直接使用配套的前端插件：
[Butterfly Link Monitoring](https://github.com/luoy-oss/butterfly-link-monitoring)

该插件支持：
- 在友链页面显示状态徽章
- 独立的监控仪表盘页面
- 交互式的历史状态查询弹窗

## 📄 许可证

本项目基于 GPLv3 协议开源。你可以在遵守协议的前提下自由使用、修改和分发本项目的代码。