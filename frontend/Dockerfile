# 使用官方 Node.js 镜像作为构建阶段的基础镜像
FROM node:20-alpine AS build

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果有的话）
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 构建前端项目
RUN npm run build

# 使用 Nginx 镜像作为生产环境的基础镜像
FROM nginx:alpine

# 删除默认的 Nginx 配置
RUN rm -rf /usr/share/nginx/html/*

# 将构建后的静态文件复制到 Nginx 的公共目录中
COPY --from=build /app/dist /usr/share/nginx/html

# 暴露端口 80
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]