/**
 * 定时任务 - 自动从 GitHub Issues 获取链接并检测
 * 
 * 1. 从 GitHub API 获取带有 active 标签的 Issues
 * 2. 解析 Issue 内容获取 URL 和元数据
 * 3. 检测链接状态
 * 4. 更新数据库 (Upsert)
 */

const axios = require('axios');
const { connectToDatabase, upsertLinkStatus } = require('../utils/db');
const { checkLinkStatus, extractDataFromIssueBody } = require('../utils/monitor');
const config = require('../config');

module.exports = async (req, res) => {
  // 设置超时时间，避免 Vercel 函数超时
  // 注意：Vercel Hobby 计划限制为 10秒 (Serverless Function)
  // 如果链接太多，可能需要分批处理或使用 Edge Functions (但 Edge 不支持 mongoose)
  // 或者在此处限制处理数量
  
  try {
    console.log('开始执行自动检测任务...');
    await connectToDatabase();

    // 1. 获取 GitHub Issues
    // 构建 API URL
    const { REPO, LABEL, STATE, SORT, DIRECTION, PER_PAGE, TOKEN } = config.GITHUB;
    const issuesUrl = `https://api.github.com/repos/${REPO}/issues?sort=${SORT}&direction=${DIRECTION}&state=${STATE}&page=1&per_page=${PER_PAGE}&labels=${LABEL}`;
    
    console.log(`正在从 ${issuesUrl} 获取数据...`);
    
    const headers = {
      'User-Agent': config.MONITOR.USER_AGENT,
      'Accept': 'application/vnd.github.v3+json'
    };

    // 如果配置了 Token，添加到请求头
    if (TOKEN) {
      headers['Authorization'] = `token ${TOKEN}`;
    }

    const issuesResponse = await axios.get(issuesUrl, { headers });

    const issues = issuesResponse.data;
    console.log(`获取到 ${issues.length} 个 Issues`);
    
    const results = [];
    
    // 2. 处理每个 Issue
    // 为避免超时，限制并发数或总数。这里简单串行处理，但要注意时间限制。
    // 如果 Issues 很多 (比如 100 个)，串行检测每个 1-2秒，肯定超时。
    // 建议：并行处理，限制并发为 5-10。
    
    const validIssues = issues.map(issue => {
      const data = extractDataFromIssueBody(issue.body);
      return data && data.url ? { ...data, issueTitle: issue.title } : null;
    }).filter(item => item !== null);

    console.log(`解析出 ${validIssues.length} 个有效链接`);

    // 分批处理
    const batchSize = config.MONITOR.BATCH_SIZE;
    for (let i = 0; i < validIssues.length; i += batchSize) {
      const batch = validIssues.slice(i, i + batchSize);
      const batchPromises = batch.map(async (data) => {
        try {
          const statusResult = await checkLinkStatus(data.url);
          
          const finalData = {
            ...statusResult,
            title: data.title || data.issueTitle,
            avatar: data.avatar,
            screenshot: data.screenshot
          };

          // 更新数据库
          await upsertLinkStatus(finalData);
          return finalData;
        } catch (err) {
          console.error(`处理 ${data.url} 失败:`, err);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));
    }

    res.json({
      success: true,
      processed: results.length,
      message: '自动检测完成',
      data: results.map(r => ({ url: r.url, status: r.status, available: r.available })) // 返回简化数据以减小响应体积
    });

  } catch (error) {
    console.error('自动检测任务失败:', error);
    res.status(500).json({ 
      error: true, 
      message: error.message 
    });
  }
};
