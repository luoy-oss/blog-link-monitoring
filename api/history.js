/**
 * 历史记录 API
 * 
 * 用于获取特定站点的历史检测数据，支持分页。
 */

const { connectToDatabase, CheckLogModel, MonthlyStatsModel, getShanghaiMonth, getShanghaiMonthStart } = require('../utils/db');

module.exports = async (req, res) => {
  // 设置CORS头，允许跨域请求
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
    
    const { url, page = 1, limit = 20 } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: true, message: 'URL is required' });
    }

    const currentMonthStart = getShanghaiMonthStart(new Date());
    const currentMonth = getShanghaiMonth(new Date());
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const historyQuery = { url, checkedAt: { $gte: currentMonthStart } };

    const history = await CheckLogModel.find(historyQuery)
      .sort({ checkedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await CheckLogModel.countDocuments(historyQuery);

    let monthlySummary = [];
    if (parseInt(page) === 1) {
      monthlySummary = await MonthlyStatsModel.find({ url, month: { $ne: currentMonth } })
        .sort({ month: -1 });
    }

    res.json({
      success: true,
      data: history,
      monthlySummary,
      currentMonth,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: (skip + history.length) < total
      }
    });
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({ error: true, message: error.message });
  }
};
