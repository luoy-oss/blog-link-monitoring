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

// 定义重试策略列表
const RETRY_STRATEGIES = [
  {
    name: 'Googlebot',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    referer: 'https://www.google.com/'
  },
  {
    name: 'Bingbot',
    userAgent: 'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    referer: 'https://www.bing.com/'
  },
  {
    name: 'Baiduspider',
    userAgent: 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    referer: 'https://www.baidu.com/'
  },
  {
    name: 'Mobile Safari',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    referer: ''
  },
  {
    name: 'Edge Desktop',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    referer: ''
  }
];

/**
 * 监测单个链接状态
 * @param {string} url - 需要监测的URL
 * @returns {Object} - 监测结果
 */
async function checkLinkStatus(url) {
  const n_url = normalizeUrl(url);
  const startTime = Date.now();
  
  // 定义请求配置生成函数
  const getRequestConfig = (strategy = null) => {
    const headers = {
      'User-Agent': strategy 
        ? strategy.userAgent
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
    };

    return {
      timeout: config.MONITOR.TIMEOUT,             // 默认 30秒超时
      validateStatus: () => true, // 允许任何状态码
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers,
      maxRedirects: 10,
      beforeRedirect: (options) => {
        // 保持必要头信息在重定向过程中
        const newHeaders = Object.assign({}, options.headers);
        if (strategy && strategy.referer) {
            newHeaders.Referer = strategy.referer;
        } else {
            // 默认伪装 Referer
            newHeaders.Referer = 'https://www.google.com/';
        }
        options.headers = newHeaders;
      }
    };
  };

  let response;
  let errorMsg;

  // 1. 第一次尝试 (使用默认配置)
  try {
    response = await axios.get(n_url, getRequestConfig());
  } catch (error) {
    errorMsg = error.message;
    response = { status: 0 }; // 标记为网络错误
  }

  // 2. 如果失败 (状态码 403/429/406 或 网络错误)，尝试所有重试策略
  // 判断是否需要重试：状态码在黑名单中，或者 status 为 0 (网络错误)
  const shouldRetry = (res) => [403, 429, 406].includes(res.status) || res.status === 0;

  if (shouldRetry(response)) {
    console.log(`[Monitor] URL ${n_url} failed with status ${response.status}. Starting retry strategies...`);
    
    for (const strategy of RETRY_STRATEGIES) {
      try {
        // 增加一点随机延迟，避免请求过于密集
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        const retryResponse = await axios.get(n_url, getRequestConfig(strategy));
        
        // 如果成功 (200-399)，则采纳结果并停止重试
        if (retryResponse.status >= 200 && retryResponse.status < 400) {
          console.log(`[Monitor] Retry success for ${n_url} using ${strategy.name}`);
          response = retryResponse;
          errorMsg = null; // 清除之前的错误
          break;
        } else {
            // 如果虽然没报错但是状态码依然不好，暂时保留这个response，继续尝试下一个策略
            // 如果所有策略都试完了，response 自然就是最后一次的结果
            response = retryResponse;
        }
      } catch (retryError) {
        // 如果当前策略网络报错，记录错误，继续尝试下一个策略
        errorMsg = retryError.message;
        // 保持 response.status 为 0 或上一次的状态
        if (!response || response.status !== 0) {
             response = { status: 0 };
        }
      }
    }
  }

  const responseTime = Date.now() - startTime;
  
  if (response.status === 0) {
      return {
        url: n_url,
        status: 0,
        responseTime,
        available: false,
        error: errorMsg,
        checkedAt: new Date()
      };
  }

  return {
    url: n_url,
    status: response.status,
    responseTime,
    available: response.status >= 200 && response.status < 400,
    checkedAt: new Date()
  };
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