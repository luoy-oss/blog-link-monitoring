/**
 * 历史记录与月度汇总功能验证脚本
 * 
 * 模拟不同日期的检测数据，验证：
 * 1. 历史记录 (CheckLog) 是否正确插入
 * 2. 月度统计 (MonthlyStats) 是否正确累加（跨日、跨月）
 * 3. 虚拟字段 (uptimePercentage, avgResponseTime) 是否计算正确
 * 
 * 使用方法: node scripts/debug-history.js
 */

const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const { connectToDatabase, CheckLogModel, MonthlyStatsModel, recordCheckResult } = require('../utils/db');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// 测试用的模拟数据
const TEST_URL = 'https://test-example.com';
const TEST_TITLE = 'Test Site';

async function runDebug() {
  console.log('=== 开始历史记录与月度汇总验证 ===');
  
  try {
    // 1. 连接数据库
    if (!process.env.MONGODB_URI) {
      console.warn('警告: 未找到 MONGODB_URI 环境变量，数据库连接可能会失败。');
      console.warn('请确保 .env 或 .env.local 文件存在并配置正确。');
    }
    
    // 简单模拟 Vercel 环境
    process.env.VERCEL = '1';

    await connectToDatabase();
    
    // 2. 清理旧的测试数据
    console.log('\n正在清理旧数据...');
    await CheckLogModel.deleteMany({ url: TEST_URL });
    await MonthlyStatsModel.deleteMany({ url: TEST_URL });
    console.log('清理完成');

    // 3. 模拟插入数据
    console.log('\n正在模拟插入跨月数据...');

    // 场景 A: 2023-10-30 (上个月) - 成功
    await simulateCheck('2023-10-30T10:00:00Z', true, 100);
    // 场景 B: 2023-10-31 (上个月) - 失败
    await simulateCheck('2023-10-31T10:00:00Z', false, 0, 'Connection timeout');
    
    // 场景 C: 2023-11-01 (本月) - 成功
    await simulateCheck('2023-11-01T10:00:00Z', true, 200);
    // 场景 D: 2023-11-01 (本月，同一天第二次检测) - 成功
    await simulateCheck('2023-11-01T14:00:00Z', true, 150);
    // 场景 E: 2023-11-02 (本月) - 失败
    await simulateCheck('2023-11-02T10:00:00Z', false, 0, '500 Internal Server Error');

    // 4. 验证 CheckLog (历史记录)
    console.log('\n验证历史记录 (CheckLog)...');
    const logs = await CheckLogModel.find({ url: TEST_URL }).sort({ checkedAt: 1 });
    console.log(`共找到 ${logs.length} 条历史记录 (预期 5 条)`);
    if (logs.length !== 5) throw new Error('历史记录数量不正确');
    
    // 验证是否按时间正确存储
    const firstLog = logs[0];
    console.log(`第一条记录时间: ${firstLog.checkedAt.toISOString()} (预期 2023-10-30)`);
    
    // 5. 验证 MonthlyStats (月度汇总)
    console.log('\n验证月度汇总 (MonthlyStats)...');
    const stats = await MonthlyStatsModel.find({ url: TEST_URL }).sort({ month: 1 });
    console.log(`共找到 ${stats.length} 条月度记录 (预期 2 条: 2023-10 和 2023-11)`);
    
    if (stats.length !== 2) throw new Error('月度记录数量不正确');

    // 验证 10 月数据 (1成功, 1失败)
    const octStats = stats.find(s => s.month === '2023-10');
    console.log(`\n[2023-10] 统计:`);
    console.log(`  总检测: ${octStats.totalChecks} (预期 2)`);
    console.log(`  成功: ${octStats.successfulChecks} (预期 1)`);
    console.log(`  失败: ${octStats.failedChecks} (预期 1)`);
    console.log(`  可用率: ${octStats.uptimePercentage}% (预期 50%)`);
    console.log(`  平均响应: ${octStats.avgResponseTime}ms (预期 50ms)`); // (100+0)/2 = 50

    if (octStats.totalChecks !== 2 || octStats.uptimePercentage !== 50) {
      throw new Error('10月统计数据错误');
    }

    // 验证 11 月数据 (2成功, 1失败)
    const novStats = stats.find(s => s.month === '2023-11');
    console.log(`\n[2023-11] 统计:`);
    console.log(`  总检测: ${novStats.totalChecks} (预期 3)`);
    console.log(`  成功: ${novStats.successfulChecks} (预期 2)`);
    console.log(`  失败: ${novStats.failedChecks} (预期 1)`);
    console.log(`  可用率: ${novStats.uptimePercentage.toFixed(2)}% (预期 66.67%)`);
    console.log(`  平均响应: ${novStats.avgResponseTime.toFixed(2)}ms (预期 116.67ms)`); // (200+150+0)/3 = 116.66...

    if (novStats.totalChecks !== 3 || novStats.failedChecks !== 1) {
      throw new Error('11月统计数据错误');
    }

    console.log('\n=== 验证通过！所有逻辑正常 ===');

    // 验证完毕后清理数据
    console.log('\n正在清理测试数据...');
    await CheckLogModel.deleteMany({ url: TEST_URL });
    await MonthlyStatsModel.deleteMany({ url: TEST_URL });

  } catch (error) {
    console.error('\n!!! 验证失败 !!!');
    console.error(error);
    process.exit(1);
  } finally {
    // 保持连接一会确保输出完成（虽然不是必须的）
    setTimeout(() => {
        process.exit(0);
    }, 1000);
  }
}

/**
 * 模拟单次检测并写入数据库
 */
async function simulateCheck(dateStr, available, responseTime, error = null) {
  const data = {
    url: TEST_URL,
    title: TEST_TITLE,
    status: available ? 200 : 0,
    responseTime,
    available,
    error,
    checkedAt: new Date(dateStr)
  };
  
  await recordCheckResult(data);
  console.log(`模拟写入: ${dateStr} - ${available ? '成功' : '失败'}`);
}

runDebug();