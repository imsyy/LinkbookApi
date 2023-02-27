require("dotenv").config();

const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const cors = require("koa2-cors");
const Router = require("koa-router");
const mysql = require("mysql2/promise");
const serve = require("koa-static");
const jwt = require("jsonwebtoken");

const publicRouter = require("./routes/public");
const linksRouter = require("./routes/links");
const categoriesRouter = require("./routes/categories");
const authRouter = require("./routes/auth");

const app = new Koa();
const router = new Router();
const net = require("net");
let port = process.env.PORT || 3000;

// 解析请求体
app.use(bodyParser());

// 设置静态文件目录
app.use(serve(__dirname + "/public"));

// 创建数据库连接池
const connectionPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS,
  connectionLimit: process.env.DB_CONNECTION_LIMIT,
  queueLimit: process.env.DB_QUEUE_LIMIT,
});

// 检查是否存在表
const createTableIfNotExists = async () => {
  const createLinksTable = `
    CREATE TABLE IF NOT EXISTS links (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      ico VARCHAR(255),
      url VARCHAR(255) NOT NULL,
      description VARCHAR(255) NOT NULL,
      categories VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      parent_id INT DEFAULT NULL,
      ico VARCHAR(255) DEFAULT NULL,
      sorting INT DEFAULT NULL,
      PRIMARY KEY (id),
      FOREIGN KEY (parent_id) REFERENCES categories (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

  const insertAdminUser = `
    INSERT INTO users (username, password) 
    SELECT 'admin', 'admin' 
    FROM DUAL 
    WHERE NOT EXISTS (SELECT * FROM users)`;

  const connection = await connectionPool.getConnection();
  try {
    await connection.query(createUsersTable);
    await connection.query(createCategoriesTable);
    await connection.query(createLinksTable);
    await connection.query(insertAdminUser);
  } catch (err) {
    console.error("数据表创建失败：", err);
  } finally {
    connection.release();
  }
};

createTableIfNotExists();

// 跨域
app.use(
  cors({
    origin: "http://localhost:5173", // 允许跨域的域名
    credentials: true, // 允许携带 Cookie
    // allowMethods: ["GET", "POST", "DELETE", "PUT"], // 允许的请求方法
    // allowHeaders: ["Content-Type", "Authorization", "Accept"], // 允许的请求头
  })
);

// 注册中间件
app.use(async (ctx, next) => {
  // 从连接池中获取连接对象
  const connection = await connectionPool.getConnection();
  try {
    // 把数据库连接对象挂载到ctx上，后续的中间件和路由都可以通过ctx.db访问数据库
    ctx.db = connection;
    await next();
  } catch (err) {
    console.error("操作数据库时出现错误：", err);
  } finally {
    connection.release();
  }
});

// 公共路由
router.use(publicRouter.routes());
// 路由守卫
router.use(async (ctx, next) => {
  if (ctx.request.url === "/api/login" || ctx.request.url === "/api/status") {
    await next();
    return true;
  }
  const token = ctx.headers.authorization;
  const secretKey = process.env.JWT_SECRET_KEY;
  if (!token) {
    ctx.body = { code: 401, message: "未授权访问" };
    ctx.status = 401;
    return false;
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    ctx.state.password = decoded.password;
  } catch (err) {
    ctx.body = { code: 401, message: "验证失败，请重新登录" };
    ctx.status = 401;
    return false;
  }
  await next();
});
router.use(authRouter.routes());
router.use(linksRouter.routes());
router.use(categoriesRouter.routes());

// 使用路由中间件
app.use(router.routes());
app.use(router.allowedMethods());

// 启动应用程序并监听端口
const startApp = (port) => {
  app.listen(port, () => {
    console.log(`成功在 ${port} 端口上运行`);
  });
};

// 检测端口是否被占用
const checkPort = (port) => {
  return new Promise((resolve, reject) => {
    const server = net
      .createServer()
      .once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`端口 ${port} 已被占用, 正在尝试其他端口...`);
          server.close();
          resolve(false);
        } else {
          reject(err);
        }
      })
      .once("listening", () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
};

// 尝试启动应用程序
const tryStartApp = async (port) => {
  let isPortAvailable = await checkPort(port);
  while (!isPortAvailable) {
    port++;
    isPortAvailable = await checkPort(port);
  }
  startApp(port);
};

tryStartApp(port);
