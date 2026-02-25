/**
 * MongoDB数据库连接工具
 * 
 * 提供MongoDB数据库连接和操作功能
 * 
 * @author luoy-oss <2557657882@qq.com>
 */

const mongoose = require('mongoose');

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

/**
 * 更新或插入链接状态 (Upsert) - 仅更新最新状态
 * @param {Object} data - 链接数据
 * @returns {Promise}
 */
async function upsertLinkStatus(data) {
  const { url, ...updateData } = data;
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
  const now = checkedAt ? new Date(checkedAt) : new Date();
  
  // 1. 更新当前最新状态 (用于首页显示)
  await upsertLinkStatus(data);

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
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
}

module.exports = {
  connectToDatabase,
  LinkModel,
  CheckLogModel,
  MonthlyStatsModel,
  upsertLinkStatus,
  recordCheckResult
};