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
    
    const { month } = req.query;
    const timezone = 'Asia/Shanghai';
    let startDate, endDate, targetMonthStr, year, monthIndex, startMonth;

    const now = new Date();
    if (month) {
      const match = /^(\d{4})-(\d{2})$/.exec(month);
      if (!match) {
        return res.status(400).json({ error: true, message: 'Invalid month format. Use YYYY-MM' });
      }
      year = parseInt(match[1], 10);
      monthIndex = parseInt(match[2], 10) - 1;
      if (monthIndex < 0 || monthIndex > 11) {
        return res.status(400).json({ error: true, message: 'Invalid month value. Use 01-12' });
      }
    } else {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit'
      }).formatToParts(now);
      const map = {};
      for (const part of parts) {
        if (part.type !== 'literal') {
          map[part.type] = part.value;
        }
      }
      year = parseInt(map.year, 10);
      monthIndex = parseInt(map.month, 10) - 1;
    }

    startMonth = String(monthIndex + 1).padStart(2, '0');
    targetMonthStr = `${year}-${startMonth}`;
    const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextMonthYear = monthIndex === 11 ? year + 1 : year;
    startDate = new Date(`${year}-${startMonth}-01T00:00:00+08:00`);
    endDate = new Date(`${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-01T00:00:00+08:00`);

    // --- 新增逻辑：如果当前月份无数据，尝试回退到最近一次有数据的月份 ---
    // 只有在未指定 month 参数时才执行此逻辑
    if (!month) {
      // 快速检查当前查询范围是否有数据
      const hasData = await CheckLogModel.findOne({
        checkedAt: { $gte: startDate, $lt: endDate }
      }).select('_id');

      if (!hasData) {
        // 查找最近一条日志
        const lastLog = await CheckLogModel.findOne().sort({ checkedAt: -1 });
        if (lastLog && lastLog.checkedAt) {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit'
          }).formatToParts(lastLog.checkedAt);
          const map = {};
          for (const part of parts) {
            if (part.type !== 'literal') {
              map[part.type] = part.value;
            }
          }
          year = parseInt(map.year, 10);
          monthIndex = parseInt(map.month, 10) - 1;
          startMonth = String(monthIndex + 1).padStart(2, '0');
          targetMonthStr = `${year}-${startMonth}`;
          const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
          const nextMonthYear = monthIndex === 11 ? year + 1 : year;
          startDate = new Date(`${year}-${startMonth}-01T00:00:00+08:00`);
          endDate = new Date(`${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-01T00:00:00+08:00`);
        }
      }
    }
    // --- 新增逻辑结束 ---

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
