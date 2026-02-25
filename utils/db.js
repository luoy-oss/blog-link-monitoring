/**
 * MongoDB数据库连接工具
 * 
 * 提供MongoDB数据库连接和操作功能
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const mongoose = require('mongoose');

const SHANGHAI_TIMEZONE = 'Asia/Shanghai';

function getShanghaiDateParts(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  map.millisecond = String(date.getMilliseconds()).padStart(3, '0');
  return map;
}

function toShanghaiDate(value) {
  const parts = getShanghaiDateParts(value);
  if (!parts) {
    return new Date();
  }
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.millisecond}+08:00`);
}

function getShanghaiMonth(value) {
  const parts = getShanghaiDateParts(value);
  if (!parts) {
    const fallback = getShanghaiDateParts(new Date());
    return `${fallback.year}-${fallback.month}`;
  }
  return `${parts.year}-${parts.month}`;
}

function getShanghaiMonthStart(value) {
  const parts = getShanghaiDateParts(value);
  const fallback = parts || getShanghaiDateParts(new Date());
  return new Date(`${fallback.year}-${fallback.month}-01T00:00:00.000+08:00`);
}

/**
 * 连接到MongoDB数据库
 * @returns {Promise} 连接Promise
 */
async function connectToDatabase() {
  // 从环境变量获取MongoDB连接字符串
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    throw new Error('请设置MONGODB_URI环境变量');
  }
  
  try {
    // 如果已经连接，则返回现有连接
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    
    // 连接到MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('MongoDB数据库连接成功');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB数据库连接失败:', error);
    throw error;
  }
}

// 链接监测数据结构 (最新状态)
const linkSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  title: String,      // 网站标题
  avatar: String,     // 头像URL
  screenshot: String, // 截图URL
  status: { type: Number },
  responseTime: { type: Number },
  available: { type: Boolean },
  error: { type: String },
  checkedAt: { type: Date, default: Date.now }
});

const LinkModel = mongoose.models.Link || mongoose.model('Link', linkSchema);

// 历史检测记录 (CheckLog) - 对应“每日检查”
const checkLogSchema = new mongoose.Schema({
  url: { type: String, required: true, index: true },
  status: { type: Number },
  responseTime: { type: Number },
  available: { type: Boolean },
  error: { type: String },
  checkedAt: { type: Date, default: Date.now }
});
// 索引优化：查询某 URL 的历史记录，按时间倒序
checkLogSchema.index({ url: 1, checkedAt: -1 });

const CheckLogModel = mongoose.models.CheckLog || mongoose.model('CheckLog', checkLogSchema);

// 月度统计 (MonthlyStats) - 对应“月度汇总”
const monthlyStatsSchema = new mongoose.Schema({
  url: { type: String, required: true },
  month: { type: String, required: true }, // 格式: "YYYY-MM"
  totalChecks: { type: Number, default: 0 },
  successfulChecks: { type: Number, default: 0 },
  failedChecks: { type: Number, default: 0 },
  totalResponseTime: { type: Number, default: 0 }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟字段：动态计算平均响应时间和可用率
monthlyStatsSchema.virtual('avgResponseTime').get(function() {
  return this.totalChecks ? (this.totalResponseTime / this.totalChecks) : 0;
});
monthlyStatsSchema.virtual('uptimePercentage').get(function() {
  return this.totalChecks ? ((this.successfulChecks / this.totalChecks) * 100) : 0;
});

monthlyStatsSchema.index({ url: 1, month: 1 }, { unique: true });

const MonthlyStatsModel = mongoose.models.MonthlyStats || mongoose.model('MonthlyStats', monthlyStatsSchema);

// 最近30天数据表 (Recent30DaysStats) - 存储最近30天的每日统计数据，滚动更新
const dailyStatSchema = new mongoose.Schema({
  date: String, // YYYY-MM-DD
  totalChecks: { type: Number, default: 0 },
  successfulChecks: { type: Number, default: 0 },
  failedChecks: { type: Number, default: 0 },
  totalResponseTime: { type: Number, default: 0 }
}, { _id: false });

const recent30DaysStatsSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  stats: [dailyStatSchema],
  updatedAt: { type: Date, default: Date.now }
});

const Recent30DaysStatsModel = mongoose.models.Recent30DaysStats || mongoose.model('Recent30DaysStats', recent30DaysStatsSchema);

/**
 * 更新或插入链接状态 (Upsert) - 仅更新最新状态
 * @param {Object} data - 链接数据
 * @returns {Promise}
 */
async function upsertLinkStatus(data) {
  const { url, ...updateData } = data;
  updateData.checkedAt = toShanghaiDate(updateData.checkedAt);
  return LinkModel.findOneAndUpdate(
    { url: url },
    { 
      $set: updateData,
      $setOnInsert: { url: url }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * 记录检测结果 (原子化操作：更新当前状态 + 记录历史 + 更新月度统计)
 * @param {Object} data - 检测结果数据
 */
async function recordCheckResult(data) {
  const { url, status, responseTime, available, error, checkedAt } = data;
  const now = toShanghaiDate(checkedAt);
  
  // 1. 更新当前最新状态 (用于首页显示)
  // 必须最先执行，确保首页总是显示最新数据
  await upsertLinkStatus(data);

  try {
    // 2. 插入历史记录
    await CheckLogModel.create({
      url, 
      status, 
      responseTime, 
      available, 
      error, 
      checkedAt: now
    });

    // 3. 更新月度统计 (增量更新)
    const month = getShanghaiMonth(checkedAt || now);
    const isSuccess = available === true;
    
    // 使用 $inc 原子操作进行计数累加
    await MonthlyStatsModel.findOneAndUpdate(
      { url, month },
      {
        $inc: {
          totalChecks: 1,
          successfulChecks: isSuccess ? 1 : 0,
          failedChecks: isSuccess ? 0 : 1,
          totalResponseTime: responseTime || 0
        },
        $setOnInsert: { url, month } // 如果是新插入，设置基础字段
      },
      { upsert: true, new: true }
    );

    // 4. 更新最近30天数据表 (Recent30DaysStats)
    const dateParts = getShanghaiDateParts(checkedAt || now);
    if (dateParts) {
      const todayDateStr = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

      let recentStats = await Recent30DaysStatsModel.findOne({ url });

      if (!recentStats) {
        recentStats = new Recent30DaysStatsModel({
          url,
          stats: []
        });
      }

      // 查找今天的统计记录
      let todayStat = recentStats.stats.find(s => s.date === todayDateStr);

      if (!todayStat) {
        todayStat = {
          date: todayDateStr,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          totalResponseTime: 0
        };
        recentStats.stats.push(todayStat);
      }

      // 更新数据
      // 注意：由于 todayStat 可能是新 push 进去的对象（尚未保存），或者是从 mongoose 数组中取出的子文档
      // 为了确保更新生效，我们通过索引直接操作数组，或者依赖 Mongoose 的子文档更新机制
      // 这里为了稳妥，重新定位引用
      const statIndex = recentStats.stats.findIndex(s => s.date === todayDateStr);
      if (statIndex !== -1) {
          recentStats.stats[statIndex].totalChecks += 1;
          if (isSuccess) {
            recentStats.stats[statIndex].successfulChecks += 1;
          } else {
            recentStats.stats[statIndex].failedChecks += 1;
          }
          recentStats.stats[statIndex].totalResponseTime += (responseTime || 0);
      }

      // 清理超过30天的数据
      // 计算30天前的日期字符串
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoParts = getShanghaiDateParts(thirtyDaysAgo);
      const thirtyDaysAgoStr = `${thirtyDaysAgoParts.year}-${thirtyDaysAgoParts.month}-${thirtyDaysAgoParts.day}`;

      // 过滤掉旧数据 (保留日期 >= 30天前的)
      // 简单的字符串比较在这里可行，因为 YYYY-MM-DD 格式支持字典序比较
      recentStats.stats = recentStats.stats.filter(s => s.date >= thirtyDaysAgoStr);
      
      // 按日期排序 (确保顺序)
      recentStats.stats.sort((a, b) => a.date.localeCompare(b.date));

      recentStats.updatedAt = new Date();
      await recentStats.save();
    }

  } catch (err) {
    // 如果历史记录或月度统计写入失败，记录错误但不中断流程
    console.error(`[recordCheckResult] 写入历史/统计数据失败 (${url}):`, err);
    // throw err; 
  }
}

module.exports = {
  connectToDatabase,
  LinkModel,
  CheckLogModel,
  MonthlyStatsModel,
  Recent30DaysStatsModel,
  toShanghaiDate,
  getShanghaiMonth,
  getShanghaiMonthStart,
  upsertLinkStatus,
  recordCheckResult
};
