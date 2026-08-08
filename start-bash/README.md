# Dify 本地开发启动脚本

## 配置步骤

### 1. 修改 `00_common.ps1` 中的路径

打开 `00_common.ps1`，修改以下变量为你的实际路径：

```powershell
$DIFY_ROOT = "C:\dify"                    # 改为你的 Dify 项目根目录
$DIFY_DOCKER = "$DIFY_ROOT\docker"        # Docker compose 所在目录
$DIFY_API = "$DIFY_ROOT\api"              # 后端 API 目录
$DIFY_WEB = "$DIFY_ROOT\web"              # 前端 Web 目录
```

### 2. 端口配置（可选）

如果默认端口有冲突，可以修改：

```powershell
$DIFY_DB_PORT = 5432            # PostgreSQL 容器端口 (EXPOSE_POSTGRES_PORT)
$DIFY_REDIS_PORT = 6379         # Redis 容器端口 (EXPOSE_REDIS_PORT)
$DIFY_WEAVIATE_PORT = 8080      # Weaviate 端口 (EXPOSE_WEAVIATE_PORT)
$DIFY_API_PORT = 5001           # 后端 API 端口
$DIFY_WEB_PORT = 3000           # 前端服务端口
```

## 使用顺序

按顺序执行以下脚本：

```powershell
# 1. 启动 Docker 中间件（PostgreSQL、Redis、Weaviate）
.\01_docker_middleware.ps1

# 2. 设置后端 Python 环境和依赖
.\02_backend_setup.ps1

# 3. 启动后端 API 和 Worker
.\03_backend_start.ps1

# 4. 检查环境（可选）
.\04_doctor.ps1

# 5. 启动前端开发服务器
.\05_frontend_start.ps1
```

## 脚本说明

- **00_common.ps1**: 公共配置文件，被其他脚本引用
- **01_docker_middleware.ps1**: 启动 Docker 容器（数据库、Redis、向量数据库）
- **02_backend_setup.ps1**: 设置 Python 虚拟环境，安装后端依赖
- **03_backend_start.ps1**: 运行数据库迁移，启动 API 服务和 Worker
- **04_doctor.ps1**: 环境诊断工具，检查配置和连接
- **05_frontend_start.ps1**: 安装前端依赖，启动开发服务器

## 辅助脚本

- **\_diagnose.py**: Python 诊断脚本，检查 .env、连通性、包导入

## 常见问题

### 端口被占用

运行以下命令查看端口占用：

```powershell
netstat -ano | Select-String "LISTENING" | Select-String ":5001"
```

### Docker 未启动

确保 Docker Desktop 已启动并运行

### Python 版本

后端需要 Python 3.12

### Node 版本

前端需要 Node.js 22.x
