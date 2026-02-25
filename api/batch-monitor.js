/**
 * 主动式网站链接状态监测 - 批量监测接口
 * 
 * 批量执行多个链接监测并将结果存储到MongoDB数据库
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const { connectToDatabase, LinkModel, toShanghaiDate } = require('../utils/db');
const { batchCheckLinks } = require('../utils/monitor');

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
      const { urls } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ 
          error: true, 
          message: '请提供要监测的URL数组' 
        });
      }
      
      // 连接数据库
      await connectToDatabase();
      
      // 批量检查链接状态
      const results = await batchCheckLinks(urls);
      const normalizedResults = results.map(result => ({
        ...result,
        checkedAt: toShanghaiDate(result.checkedAt)
      }));
      
      // 存储监测结果到数据库
      await LinkModel.insertMany(normalizedResults);
      
      return res.json({
        success: true,
        count: normalizedResults.length,
        data: normalizedResults
      });
    } catch (error) {
      console.error('批量监测链接失败:', error);
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
