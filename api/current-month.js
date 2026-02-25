/**
 * 获取指定URL当月数据接口
 * 
 * 用于获取特定站点的当月每日统计详情。
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const { connectToDatabase, CurrentMonthStatsModel } = require('../utils/db');

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

    const stats = await CurrentMonthStatsModel.findOne({ url });

    if (!stats) {
       // 如果没有找到数据，可能是因为还没有监测过，或者本月还没有数据
       return res.json({
         success: true,
         data: {
           url,
           month: null,
           stats: []
         }
       });
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取当月数据失败:', error);
    res.status(500).json({ error: true, message: error.message });
  }
};
