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
const historyHandler = require('./api/history');
const monthlyHandler = require('./api/monthly');

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
    <h1>主动式网站链接状态监测</h1>
    <p>当你看到这段文字时，说明服务已成功启动</p>
    <p>请使用以下API接口：</p>
    <p>1. POST /api/monitor - 执行链接监测并存储数据</p>
    <p>2. GET/POST /api/data - 获取监测数据</p>
    <p>3. POST /api/batch-monitor - 批量执行链接监测并存储数据</p>
    <p>GitHub: <a href="https://www.github.com/luoy-oss" target="_blank">luoy-oss</a></p>
    <p>GitHub仓库: <a href="https://github.com/luoy-oss/blog-link-monitoring" target="_blank">blog-link-monitoring</a></p>
    <p>作者主页: <a href="https://www.drluo.top" target="_blank">drluo.top</a></p>

  `);
});

app.use('/api/monitor', monitorHandler);
app.use('/api/data', dataHandler);
app.use('/api/batch-monitor', batchMonitorHandler);
app.use('/api/cron-check', cronCheckHandler);
app.use('/api/history', historyHandler);
app.use('/api/monthly', monthlyHandler);

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

module.exports = app;