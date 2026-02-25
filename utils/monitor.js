/**
 * 博客链接监测工具
 * 
 * 提供链接监测相关的工具函数
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const axios = require('axios');
const https = require('https');
const { normalizeUrl } = require('./normalize');
const config = require('../config');

/**
 * 监测单个链接状态
 * @param {string} url - 需要监测的URL
 * @returns {Object} - 监测结果
 */
async function checkLinkStatus(url) {
  const n_url = normalizeUrl(url);
  const startTime = Date.now();
  
  // 定义请求配置生成函数
  const getRequestConfig = (isRetry = false) => ({
    timeout: config.MONITOR.TIMEOUT,             // 默认 30秒超时
    validateStatus: () => true, // 允许任何状态码
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
      'User-Agent': isRetry 
        ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' // 重试时伪装成 Googlebot
        : config.MONITOR.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    },
    maxRedirects: 10,
    beforeRedirect: (options) => {
      // 保持必要头信息在重定向过程中
      options.headers = Object.assign({}, options.headers, {
        Referer: 'https://www.google.com/' // 伪装 Referer
      });
    }
  });

  try {
    // 第一次尝试
    let response = await axios.get(n_url, getRequestConfig(false));
    
    // 如果是 403 或 429 或 406，尝试伪装成 Googlebot 重试
    if ([403, 429, 406].includes(response.status)) {
       try {
         const retryResponse = await axios.get(n_url, getRequestConfig(true));
         // 只有当重试成功（200-399）时才覆盖结果
         if (retryResponse.status >= 200 && retryResponse.status < 400) {
            response = retryResponse;
         }
       } catch (retryError) {
         // 重试失败则忽略，保持原始响应
       }
    }

    const responseTime = Date.now() - startTime;
    
    return {
      url: n_url,
      status: response.status,
      responseTime,
      available: response.status >= 200 && response.status < 400,
      checkedAt: new Date()
    };
  } catch (error) {
    // 如果是网络错误，尝试重试一次
    try {
      const response = await axios.get(n_url, getRequestConfig(true));
      const responseTime = Date.now() - startTime;
      return {
        url: n_url,
        status: response.status,
        responseTime,
        available: response.status >= 200 && response.status < 400,
        checkedAt: new Date()
      };
    } catch (retryError) {
      return {
        url: n_url,
        status: 0,
        responseTime: Date.now() - startTime,
        available: false,
        error: error.message,
        checkedAt: new Date()
      };
    }
  }
}

/**
 * 从 GitHub Issue Body 中提取 URL 和元数据
 * @param {string} body - Issue body content
 * @returns {Object|null} - Extracted data or null
 */
function extractDataFromIssueBody(body) {
  try {
    // 尝试匹配 JSON 代码块
    const jsonMatch = body.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      const data = JSON.parse(jsonMatch[1]);
      if (data.url) return data;
    }
    
    // 如果没有 JSON 块，尝试直接寻找 URL
    const urlMatch = body.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return { url: urlMatch[0] };
    }
    
    return null;
  } catch (e) {
    console.error('解析 Issue Body 失败:', e);
    return null;
  }
}

/**
 * 批量监测多个链接
 * @param {Array<string>} urls - 需要监测的URL数组
 * @returns {Array<Object>} - 监测结果数组
 */
async function batchCheckLinks(urls) {
  if (!Array.isArray(urls)) {
    throw new Error('urls参数必须是一个数组');
  }
  
  const results = [];
  
  // 使用Promise.all并行处理所有链接检查
  const checkPromises = urls.map(url => checkLinkStatus(url));
  const checkResults = await Promise.all(checkPromises);
  
  return checkResults;
}

module.exports = {
  checkLinkStatus,
  batchCheckLinks,
  extractDataFromIssueBody
};