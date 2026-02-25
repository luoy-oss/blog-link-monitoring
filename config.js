/**
 * 项目配置文件
 * 
 * 所有的配置项都可以在此处修改，或者通过环境变量覆盖
 */

const config = {
  // MongoDB 连接字符串 (必填)
  MONGODB_URI: process.env.MONGODB_URI,

  // GitHub Issues 配置
  GITHUB: {
    // 仓库路径 (格式: owner/repo)
    REPO: process.env.GITHUB_REPO || 'luoy-oss/friend_link',
    // 筛选标签
    LABEL: process.env.GITHUB_ISSUE_LABEL || 'active',
    // 状态 (open, closed, all)
    STATE: process.env.GITHUB_ISSUE_STATE || 'all',
    // 排序字段 (created, updated, comments)
    SORT: process.env.GITHUB_ISSUE_SORT || 'created',
    // 排序方向 (asc, desc)
    DIRECTION: process.env.GITHUB_ISSUE_DIRECTION || 'asc',
    // 每页数量 (最大 100)
    PER_PAGE: parseInt(process.env.GITHUB_ISSUE_PER_PAGE || '100', 10),
    // 最大获取页数 (防止无限循环，建议设置合理值)
    MAX_PAGES: parseInt(process.env.GITHUB_ISSUE_MAX_PAGES || '5', 10),
    // 访问令牌 (可选，如果公开仓库通常不需要，但配置后可提高限流阈值)
    TOKEN: process.env.GITHUB_TOKEN || '',
  },

  // 监控配置
  MONITOR: {
    // 请求超时时间 (毫秒)
    TIMEOUT: parseInt(process.env.MONITOR_TIMEOUT || '30000', 10),
    // 批量检测时的并发/批次大小 (Vercel Serverless 建议设置较小，防止超时)
    BATCH_SIZE: parseInt(process.env.MONITOR_BATCH_SIZE || '5', 10),
    // 每次执行最大检测数量 (防止 Vercel 函数超时，0 为不限制)
    MAX_CHECK_LIMIT: parseInt(process.env.MONITOR_MAX_CHECK_LIMIT || '50', 10),
    // User-Agent
    USER_AGENT: process.env.MONITOR_USER_AGENT || 'Blog-Link-Monitoring-Bot',
    // 重试次数
    RETRY_COUNT: parseInt(process.env.MONITOR_RETRY_COUNT || '1', 10),
  }
};

module.exports = config;
