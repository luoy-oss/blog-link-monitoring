/**
 * 定时任务 - 自动从 GitHub Issues 获取链接并检测
 * 
 * 1. 从 GitHub API 获取带有 active 标签的 Issues
 * 2. 解析 Issue 内容获取 URL 和元数据
 * 3. 检测链接状态
 * 4. 更新数据库 (Upsert)
 */

const axios = require('axios');
const { connectToDatabase, recordCheckResult } = require('../utils/db');
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
    const { REPO, LABEL, STATE, SORT, DIRECTION, PER_PAGE, MAX_PAGES, TOKEN } = config.GITHUB;
    
    let allIssues = [];
    let page = 1;
    let hasMore = true;

    const headers = {
      'User-Agent': config.MONITOR.USER_AGENT,
      'Accept': 'application/vnd.github.v3+json'
    };
    if (TOKEN) {
      headers['Authorization'] = `token ${TOKEN}`;
    }

    // 分页获取所有 Issues
    while (hasMore && page <= MAX_PAGES) {
      const issuesUrl = `https://api.github.com/repos/${REPO}/issues?sort=${SORT}&direction=${DIRECTION}&state=${STATE}&page=${page}&per_page=${PER_PAGE}&labels=${LABEL}`;
      console.log(`正在从 ${issuesUrl} 获取第 ${page} 页数据...`);
      
      try {
        const issuesResponse = await axios.get(issuesUrl, { headers });
        const issues = issuesResponse.data;
        
        if (issues && issues.length > 0) {
          allIssues = allIssues.concat(issues);
          console.log(`第 ${page} 页获取到 ${issues.length} 条数据`);
          
          // 如果返回数量小于每页数量，说明是最后一页
          if (issues.length < PER_PAGE) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.error(`获取第 ${page} 页失败:`, err.message);
        // 如果是 404，可能是页数超出，停止获取
        if (err.response && err.response.status === 404) {
          hasMore = false;
        } else {
          // 其他错误，根据需要决定是否重试或停止，这里简单起见停止
          throw err;
        }
      }
    }

    console.log(`总共获取到 ${allIssues.length} 个 Issues`);
    
    const results = [];
    
    // 2. 处理每个 Issue
    const validIssues = allIssues.map(issue => {
      const data = extractDataFromIssueBody(issue.body);
      return data && data.url ? { ...data, issueTitle: issue.title } : null;
    }).filter(item => item !== null);

    console.log(`解析出 ${validIssues.length} 个有效链接`);

    // 限制检测数量，防止 Vercel 函数超时
    const maxLimit = config.MONITOR.MAX_CHECK_LIMIT;
    let targetIssues = validIssues;
    
    if (maxLimit > 0 && validIssues.length > maxLimit) {
      console.warn(`警告: 待检测链接数 (${validIssues.length}) 超过限制 (${maxLimit})。为防止超时，本次仅检测前 ${maxLimit} 个链接。`);
      // 这里的策略是简单的截断。更高级的策略可能是随机选择或按上次检测时间排序。
      // 为保持简单，我们截取前 N 个。
      targetIssues = validIssues.slice(0, maxLimit);
    }

    // 分批处理
    const batchSize = config.MONITOR.BATCH_SIZE;
    for (let i = 0; i < targetIssues.length; i += batchSize) {
      const batch = targetIssues.slice(i, i + batchSize);
      const batchPromises = batch.map(async (data) => {
        try {
          const statusResult = await checkLinkStatus(data.url);
          
          const finalData = {
            ...statusResult,
            title: data.title || data.issueTitle,
            avatar: data.avatar,
            screenshot: data.screenshot,
            checkedAt: new Date()
          };

          // 更新数据库 (同时保存：最新状态、历史记录、月度统计)
          await recordCheckResult(finalData);
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
