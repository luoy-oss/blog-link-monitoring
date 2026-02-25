/**
 * 获取指定URL最近30天数据接口
 * 
 * 用于获取特定站点的最近30天每日统计详情。
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const { connectToDatabase, Recent30DaysStatsModel } = require('../utils/db');

module.exports = async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await connectToDatabase();
    
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        error: true, 
        message: '请提供要查询的URL' 
      });
    }

    const stats = await Recent30DaysStatsModel.findOne({ url });

    if (!stats) {
       return res.json({
         success: true,
         data: {
           url,
           stats: []
         }
       });
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取最近30天数据失败:', error);
    res.status(500).json({ error: true, message: error.message });
  }
};
