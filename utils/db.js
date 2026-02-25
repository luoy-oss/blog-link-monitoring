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

// 当月数据表 (CurrentMonthStats) - 仅存储当月每日数据，跨月重置
const dailyStatSchema = new mongoose.Schema({
  date: String, // YYYY-MM-DD
  totalChecks: { type: Number, default: 0 },
  successfulChecks: { type: Number, default: 0 },
  failedChecks: { type: Number, default: 0 },
  totalResponseTime: { type: Number, default: 0 }
}, { _id: false });

const currentMonthStatsSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  month: { type: String, required: true }, // YYYY-MM
  stats: [dailyStatSchema],
  updatedAt: { type: Date, default: Date.now }
});

const CurrentMonthStatsModel = mongoose.models.CurrentMonthStats || mongoose.model('CurrentMonthStats', currentMonthStatsSchema);

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

    // 4. 更新当月数据表 (CurrentMonthStats)
    const dateParts = getShanghaiDateParts(checkedAt || now);
    if (dateParts) {
      const todayDateStr = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      const currentMonthStr = `${dateParts.year}-${dateParts.month}`;

      let currentStats = await CurrentMonthStatsModel.findOne({ url });

      if (!currentStats) {
        currentStats = new CurrentMonthStatsModel({
          url,
          month: currentMonthStr,
          stats: []
        });
      }

      // 检查是否跨月，如果跨月则重置
      if (currentStats.month !== currentMonthStr) {
        currentStats.month = currentMonthStr;
        currentStats.stats = []; // 重置统计数据
      }

      // 查找今天的统计记录
      let todayStat = currentStats.stats.find(s => s.date === todayDateStr);

      if (!todayStat) {
        currentStats.stats.push({
          date: todayDateStr,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          totalResponseTime: 0
        });
        // 获取新添加的记录引用
        todayStat = currentStats.stats[currentStats.stats.length - 1];
      }

      // 更新数据
      todayStat.totalChecks += 1;
      if (isSuccess) {
        todayStat.successfulChecks += 1;
      } else {
        todayStat.failedChecks += 1;
      }
      todayStat.totalResponseTime += (responseTime || 0);
      
      currentStats.updatedAt = new Date();
      await currentStats.save();
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
  CurrentMonthStatsModel,
  toShanghaiDate,
  upsertLinkStatus,
  recordCheckResult
};
