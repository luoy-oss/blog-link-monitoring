/**
 * 主动式网站链接状态监测 - 监测接口
 * 
 * 执行链接监测并将结果存储到MongoDB数据库
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const { connectToDatabase, LinkModel, upsertLinkStatus } = require('../utils/db');
const { checkLinkStatus } = require('../utils/monitor');

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
      
      // 检查链接状态 (使用 utils/monitor.js 中的优化版本)
      const result = await checkLinkStatus(url);
      
      // 存储监测结果到数据库 (使用 upsert 避免数据膨胀)
      await upsertLinkStatus(result);
      
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