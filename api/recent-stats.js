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
    
    // 如果没有提供URL，则返回所有站点的最近30天数据 (统一获取)
    if (!url) {
      const allStats = await Recent30DaysStatsModel.find({});
      return res.json({
        success: true,
        data: allStats
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
