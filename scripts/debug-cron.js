/**
 * 本地调试脚本
 * 
 * 用于在本地环境模拟运行 Cron 任务，验证逻辑是否正确。
 * 使用方法: node scripts/debug-cron.js
 */

const dotenv = require('dotenv');
const path = require('path');

// 模拟 Express 的 req 和 res 对象
const mockReq = {
  method: 'GET',
  headers: {}
};

const mockRes = {
  statusCode: 200,
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  },
  status(code) {
    this.statusCode = code;
    return {
        json: (data) => {
            console.log('--- 响应结果 (Status: ' + code + ') ---');
            console.log(JSON.stringify(data, null, 2));
            return this;
        },
        send: (data) => {
             console.log('--- 响应内容 (Status: ' + code + ') ---');
             console.log(data);
             return this;
        }
    }
  },
  json(data) {
    console.log('--- 响应结果 ---');
    console.log(JSON.stringify(data, null, 2));
    return this;
  },
  send(data) {
    console.log('--- 响应内容 ---');
    console.log(data);
    return this;
  }
};

async function runDebug() {
  console.log('=== 开始本地调试 ===');
  
  // 加载环境变量
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

  // 检查是否配置了必要的环境变量
  if (!process.env.MONGODB_URI) {
    console.warn('警告: 未找到 MONGODB_URI 环境变量，数据库连接可能会失败。');
    console.warn('请确保 .env 或 .env.local 文件存在并配置正确。');
  }

  // 简单模拟 Vercel 环境
  process.env.VERCEL = '1';

  try {
    // 引入 cron-check 模块
    const cronCheck = require('../api/cron-check');
    
    // 执行任务
    await cronCheck(mockReq, mockRes);
    
    // 等待异步操作完成（如果有未捕获的 Promise）
    // 注意：这里没有直接 exit，因为 mongoose 可能还有连接未关闭
    // 在实际运行中，Vercel 会自动冻结或销毁实例
    console.log('=== 任务执行完毕，等待挂起 ===');
    
  } catch (error) {
    console.error('调试过程中发生错误:', error);
    process.exit(1);
  }
}

runDebug();
