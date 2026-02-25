/**
 * 主动式网站链接状态监测 - 主服务入口
 * 
 * 提供REST API接口，用于监测博客链接状态并存储到MongoDB
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');

// 导入API处理函数
const monitorHandler = require('./api/monitor');
const dataHandler = require('./api/data');
const batchMonitorHandler = require('./api/batch-monitor');
const cronCheckHandler = require('./api/cron-check');
const monthlyHandler = require('./api/monthly');
const recentStatsHandler = require('./api/recent-stats');

// 加载环境变量
dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;

// 中间件设置
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 主页路由
app.get('/', (req, res) => {
  res.send(`
<meta charset="UTF-8">
<title>主动式网站链接状态监测 API</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 800px;
    margin: 0;
    padding: 40px 20px;
    background-color: #f9f9fa;
  }
  .container {
    max-width: 800px;
    margin: 0 auto;
  }
  h1 {
    margin-top: 0;
    color: #1890ff;
    font-size: 24px;
    font-weight: 500;
    border-bottom: 1px solid #f0f0f0;
    padding-bottom: 15px;
    margin-bottom: 25px;
  }
  p {
    margin-bottom: 15px;
    font-size: 16px;
  }
  .endpoint {
    margin-bottom: 12px;
    font-family: Consolas, Monaco, "Andale Mono", monospace;
    font-size: 15px;
  }
  .method {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    margin-right: 10px;
    min-width: 45px;
    text-align: center;
  }
  .get { background-color: #e6f7ff; color: #096dd9; border: 1px solid #91d5ff; }
  .post { background-color: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f; }
  
  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #f0f0f0;
    font-size: 14px;
    color: #888;
  }
  a {
    color: #1890ff;
    text-decoration: none;
    transition: color 0.2s;
  }
  a:hover {
    color: #40a9ff;
    text-decoration: underline;
  }
</style>
<body>
  <div class="container">
    <h1>主动式网站链接状态监测</h1>
    <p>当你看到这段文字时，说明服务已成功启动</p>
    <p>请使用以下API接口：</p>
    <div class="endpoint">
      <span class="method post">POST</span> /api/monitor - 执行链接监测并存储数据
    </div>
    <div class="endpoint">
      <span class="method post">POST</span> /api/batch-monitor - 批量执行链接监测并存储数据
    </div>
    <div class="endpoint">
      <span class="method get">GET</span> /api/data - 获取所有监测数据
    </div>
    <div class="endpoint">
      <span class="method get">GET</span> /api/recent-stats - 获取单站最近30天详情
    </div>

    <div class="footer">
      <p>
        Github: <a href="https://github.com/luoy-oss" target="_blank">luoy-oss</a>
      <br>
        GitHub仓库: <a href="https://github.com/luoy-oss/blog-link-monitoring" target="_blank">blog-link-monitoring</a>
      <br>
        作者主页: <a href="https://www.drluo.top" target="_blank">drluo.top</a>
      </p>
    </div>
  </div>
</body>
  `);
});

app.use('/api/monitor', monitorHandler);
app.use('/api/data', dataHandler);
app.use('/api/batch-monitor', batchMonitorHandler);
app.use('/api/cron-check', cronCheckHandler);
app.use('/api/history', historyHandler);
app.use('/api/monthly', monthlyHandler);
app.use('/api/recent-stats', recentStatsHandler);

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

module.exports = app;