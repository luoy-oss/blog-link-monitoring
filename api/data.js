/**
 * 主动式网站链接状态监测 - 数据获取接口
 * 
 * 从MongoDB数据库获取链接监测数据
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const { connectToDatabase, LinkModel } = require('../utils/db');
const { normalizeUrl } = require('../utils/normalize');

/**
 * 获取链接监测数据
 * @param {Object} query - 查询条件
 * @param {Object} options - 查询选项
 * @returns {Array} - 监测数据列表
 */
async function getLinkData(query = {}, options = {}) {
  try {
    // 连接数据库
    await connectToDatabase();
    
    // 设置默认查询选项
    const defaultOptions = {
      limit: 100,
      sort: { checkedAt: -1 } // 默认按检查时间降序排序
    };
    
    // 合并查询选项
    const queryOptions = { ...defaultOptions, ...options };
    
    // 查询数据
    const data = await LinkModel.find(query, null, queryOptions);
    
    return data;
  } catch (error) {
    console.error('获取链接数据失败:', error);
    throw error;
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

  try {
    let query = {};
    let options = {};
    
    if (req.method === 'GET') {
      // 从URL查询参数获取查询条件
      const { url, available, limit, sort } = req.query;
      
      if (url) query.url = normalizeUrl(url);
      if (available !== undefined) query.available = available === 'true';
      if (limit) options.limit = parseInt(limit, 10);
      if (sort) options.sort = { [sort]: -1 };
    } else if (req.method === 'POST') {
      // 从请求体获取查询条件
      const { query: bodyQuery, options: bodyOptions } = req.body;
      
      if (bodyQuery) query = bodyQuery;
      if (bodyOptions) options = bodyOptions;
    } else {
      return res.status(405).json({
        error: true,
        message: '请使用GET或POST方法调用此API'
      });
    }
    
    // 获取链接监测数据
    const data = await getLinkData(query, options);
    
    return res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('获取监测数据失败:', error);
    return res.status(500).json({
      error: true,
      message: error.message
    });
  }
};