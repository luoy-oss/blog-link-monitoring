/**
 * 主动式网站链接状态监测 - 监测接口
 * 
 * 执行链接监测并将结果存储到MongoDB数据库
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const axios = require('axios');
const https = require('https');
const { connectToDatabase, LinkModel } = require('../utils/db');
const { normalizeUrl } = require('../utils/normalize');

/**
 * 监测链接状态
 * @param {string} url - 需要监测的URL
 * @returns {Object} - 监测结果
 */
async function checkLinkStatus(url) {
  const normalizedUrl = normalizeUrl(url);
  const startTime = Date.now();
  try {
    const response = await axios.get(normalizedUrl, {
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
      url: normalizedUrl,
      status: response.status,
      responseTime,
      available: response.status >= 200 && response.status < 400,
      checkedAt: new Date()
    };
  } catch (error) {
    return {
      url: normalizedUrl,
      status: 0,
      responseTime: Date.now() - startTime,
      available: false,
      error: error.message,
      checkedAt: new Date()
    };
  }
}

module.exports = async (req, res) => {
  // 设置CORS头，允许跨域请求
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          error: true, 
          message: '请提供要监测的URL' 
        });
      }
      
      // 连接数据库
      await connectToDatabase();
      
      // 检查链接状态
      const result = await checkLinkStatus(url);
      
      // 存储监测结果到数据库
      await LinkModel.create(result);
      
      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('监测链接失败:', error);
      return res.status(500).json({
        error: true,
        message: error.message
      });
    }
  }
  
  return res.status(405).json({
    error: true,
    message: '请使用POST方法调用此API'
  });
};