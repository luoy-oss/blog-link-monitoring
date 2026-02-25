/**
 * 月度每日状态 API
 * 
 * 用于获取所有站点在特定月份的每日可用性状态。
 * 返回格式：{ "url": [ { date: "2023-10-01", uptime: 1.0, count: 24 }, ... ] }
 */

const { connectToDatabase, CheckLogModel } = require('../utils/db');

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
    
    // 获取月份参数 (格式 YYYY-MM)，默认为当前服务器时间的月份
    // timezone 默认为 Asia/Shanghai
    const { month, timezone = 'Asia/Shanghai' } = req.query;
    let startDate, endDate, targetMonthStr;

    const now = new Date();
    if (month) {
      const parts = month.split('-');
      if (parts.length === 2) {
        const year = parseInt(parts[0]);
        const monthIndex = parseInt(parts[1]) - 1;
        // 构造 UTC 时间的月初和下月初
        startDate = new Date(Date.UTC(year, monthIndex, 1));
        endDate = new Date(Date.UTC(year, monthIndex + 1, 1));
        
        // 扩大查询范围，前后各宽限一天以覆盖时区差异
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() + 1);
        
        targetMonthStr = month;
      } else {
        return res.status(400).json({ error: true, message: 'Invalid month format. Use YYYY-MM' });
      }
    } else {
      const year = now.getFullYear();
      const monthIndex = now.getMonth();
      startDate = new Date(Date.UTC(year, monthIndex, 1));
      endDate = new Date(Date.UTC(year, monthIndex + 1, 1));
      
      // 扩大查询范围
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() + 1);
      
      targetMonthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    }

    // 聚合查询：按 URL 和 日期 分组，计算平均可用性
    const stats = await CheckLogModel.aggregate([
      {
        $match: {
          checkedAt: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $project: {
          url: 1,
          available: 1,
          // 提取日期部分 (格式 YYYY-MM-DD)，使用指定时区
          date: { 
            $dateToString: { 
              format: "%Y-%m-%d", 
              date: "$checkedAt", 
              timezone: timezone 
            } 
          }
        }
      },
      {
        // 再次过滤，确保日期属于目标月份
        $match: {
          date: { $regex: `^${targetMonthStr}` }
        }
      },
      {
        $group: {
          _id: { url: "$url", date: "$date" },
          // 计算当天的平均可用性 (0.0 - 1.0)，true=1, false=0
          uptime: { $avg: { $cond: ["$available", 1, 0] } },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.url",
          days: {
            $push: {
              date: "$_id.date",
              uptime: "$uptime",
              count: "$count"
            }
          }
        }
      }
    ]);

    // 转换为 Map 格式 { url: [days...] }
    const data = {};
    stats.forEach(item => {
      data[item._id] = item.days;
    });

    res.json({
      success: true,
      month: targetMonthStr,
      data: data
    });

  } catch (error) {
    console.error('获取月度状态失败:', error);
    res.status(500).json({ error: true, message: error.message });
  }
};