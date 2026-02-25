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

// 链接监测数据结构
const linkSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true }, // 添加唯一索引
  title: String,      // 网站标题
  avatar: String,     // 头像URL
  screenshot: String, // 截图URL
  status: { type: Number },
  responseTime: { type: Number },
  available: { type: Boolean },
  error: { type: String },
  checkedAt: { type: Date, default: Date.now }
});

// 创建模型（如果不存在）
const LinkModel = mongoose.models.Link || mongoose.model('Link', linkSchema);

/**
 * 更新或插入链接状态 (Upsert)
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

module.exports = {
  connectToDatabase,
  LinkModel,
  upsertLinkStatus
};