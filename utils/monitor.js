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

/**
 * 监测单个链接状态
 * @param {string} url - 需要监测的URL
 * @returns {Object} - 监测结果
 */
async function checkLinkStatus(url) {
  const n_url = normalizeUrl(url);
  const startTime = Date.now();
  try {
    const response = await axios.get(n_url, {
      timeout: 30000,             // 30秒超时
      validateStatus: () => true, // 允许任何状态码
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {  // 添加浏览器标准头
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Connection': 'keep-alive'
      },
      maxRedirects: 10, // 确保跟随重定向
      beforeRedirect: (options, { headers }) => {
        // 保持必要头信息在重定向过程中
        options.headers = Object.assign({}, options.headers, {
          Referer: options.url
        });
      }
    });

    
    const responseTime = Date.now() - startTime;
    
    return {
      url: n_url,
      status: response.status,
      responseTime,
      available: response.status >= 200 && response.status < 400,
      checkedAt: new Date()
    };
  } catch (error) {
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
  batchCheckLinks
};