# 主动式网站链接状态监测

这是一个可部署在Vercel上的主动式网站链接状态监测，用于监测博客链接的可用性并将数据存储到MongoDB数据库。

## 功能特点

- 执行链接监测请求，并将监测数据存储到指定的远端MongoDB数据库
- 获取监测数据，从远端MongoDB数据库中检索链接监测数据并以JSON形式返回
- 支持GET和POST方法获取数据
- 可部署在Vercel平台上运行

## API接口

### 1. 执行链接监测

```
POST /api/monitor
```

请求体：

```json
{
  "url": "https://www.drluo.top/"
}
```

响应：

```json
{
    "success": true,
    "data": {
        "url": "https://www.drluo.top",
        "status": 200,
        "responseTime": 537,
        "available": true,
        "checkedAt": "2025-05-22T10:21:13.641Z"
    }
}
```

### 2. 批量执行链接监测

```
POST /api/batch-monitor
```

请求体：

```json
{
  "urls": [
    "https://www.drluo.top/",
    "https://www.baidu.com"
  ]
}
```

响应：

```json
{
    "success": true,
    "count": 2,
    "data": [
        {
            "url": "https://www.drluo.top",
            "status": 200,
            "responseTime": 494,
            "available": true,
            "checkedAt": "2025-05-22T10:20:52.507Z"
        },
        {
            "url": "https://www.baidu.com",
            "status": 200,
            "responseTime": 190,
            "available": true,
            "checkedAt": "2025-05-22T10:20:52.210Z"
        }
    ]
}
```

```
POST /api/monitor
```

请求体：

```json
{
  "url": "https://example.com"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "status": 200,
    "responseTime": 123,
    "available": true,
    "checkedAt": "2023-08-15T12:34:56.789Z"
  }
}
```

### 2. 获取监测数据

```
GET /api/data?url=https://www.drluo.top&limit=3
```

或

```
POST /api/data
```

请求体：

```json
{
  "query": { "url": "https://www.drluo.top" },
  "options": { "limit": 3 }
}
```

响应：

```json
{
    "success": true,
    "count": 3,
    "data": [
        {
            "_id": "682efa99737751e5ad54253b",
            "url": "https://www.drluo.top",
            "status": 200,
            "responseTime": 537,
            "available": true,
            "checkedAt": "2025-05-22T10:21:13.641Z",
            "__v": 0
        },
        {
            "_id": "682efa84737751e5ad542538",
            "url": "https://www.drluo.top",
            "status": 200,
            "responseTime": 494,
            "available": true,
            "checkedAt": "2025-05-22T10:20:52.507Z",
            "__v": 0
        },
        {
            "_id": "682ef99eeda05392be0b7b77",
            "url": "https://www.drluo.top",
            "status": 200,
            "responseTime": 465,
            "available": true,
            "checkedAt": "2025-05-22T10:17:00.434Z",
            "__v": 0
        }
    ]
}
```

## 环境变量

部署时需要设置以下环境变量：

- `MONGODB_URI`: MongoDB数据库连接字符串

例如：
```
MONGODB_URI=mongodb://username:password@host:port/database
```
其中，database为你要使用的数据库名称，不写默认为test。

## 本地开发

1. 克隆仓库
2. 安装依赖：`npm install`
3. 创建`.env`文件并设置`MONGODB_URI`
4. 启动开发服务器：`npm run dev`

## 部署到Vercel

1. Fork本仓库
2. 在Vercel上导入项目
3. 在项目设置中添加环境变量`MONGODB_URI`
4. 部署项目

## 许可证

MIT