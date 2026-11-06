<div align="center">
  <h1>Remind · Web</h1>
  <p>「岁记」备忘提醒前端 · Vue 3 + Vite，农历备忘、列表与编辑</p>
</div>

<div align="center">

![Vue](https://img.shields.io/badge/Vue-3-42b883)
![Vite](https://img.shields.io/badge/Vite-6-646CFF)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

## 项目定位

「岁记」的**前端**，配套后端是 [Remind-api](https://github.com/CheeseTJ/Remind-api)。
一个轻量单页应用：登录后看到备忘列表，点进去编辑，农历日期可视化选择。

```text
Remind-web (本仓库)  ──fetch /api/*──>  Remind-api (Go)  ──> SQLite + SMTP
```

## 功能

- **列表** —— 备忘卡片，桌面双列 / 手机单列，显示下次提醒时间
- **编辑** —— 标题、内容、提醒时间；农历/阳历切换
- **农历选择** —— 农历月份日期选择，自动提示对应公历
- **登录** —— 走统一身份中心（JWT）
- **响应式** —— 手机端专门的卡片布局与悬浮新建按钮

## 快速开始

```bash
npm install
npm run dev          # 开发服务器
```

构建：

```bash
npm run build
npm run preview
```

### 后端地址

由 `VITE_API_BASE` 控制（见 `.env.production`）：

```bash
VITE_API_BASE=https://remind.example.com
```

## 目录结构

```text
src/
  views/         ListView（列表）/ EditView（编辑）/ LoginView（登录）
  api/           remind.js（后端接口）/ ucenter.js（身份中心）
  router/        路由
  utils/memo.js  备忘格式化与农历显示
  App.vue        应用外壳
```

## License

[MIT](./LICENSE) © 2026 JuneT
