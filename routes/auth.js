const jwt = require("jsonwebtoken");
const Router = require("koa-router");
const authRouter = new Router();
const secretKey = process.env.JWT_SECRET_KEY;

require("dotenv").config();

// 登录接口
authRouter.get("/api/login", async (ctx) => {
  ctx.body = { code: 400, message: "请求方式错误" };
  ctx.status = 400;
  return false;
});
authRouter.post("/api/login", async (ctx) => {
  console.log("请求登录", ctx.request.body + new Date().toLocaleString());
  const { username, password } = ctx.request.body;
  if (!username || !password) {
    ctx.body = { code: 400, message: "参数不完整" };
    ctx.status = 400;
    return false;
  }
  // 验证是否正确
  const [user] = await ctx.db.query(
    "SELECT id, username, password FROM users WHERE username = ? AND password = ?",
    [username, password]
  );
  if (user.length === 0) {
    console.info(username + " 认证失败 " + new Date().toLocaleString());
    ctx.body = { code: 401, message: "用户名或密码错误" };
    ctx.status = 401;
    return false;
  }
  console.info("成功查询：" + JSON.stringify(user[0]));
  // 生成token
  const token = jwt.sign({ password: user[0].password }, secretKey, {
    expiresIn: "8h",
  });
  console.info(username + " 登录成功 " + new Date().toLocaleString());
  ctx.body = {
    code: 200,
    message: "登录成功",
    id: user[0].id,
    user: username,
    token,
  };
});

// 修改用户名及密码
authRouter.put("/api/user/:id", async (ctx) => {
  const { id } = ctx.params;
  const { username, password } = ctx.request.body;
  if (!username || !password) {
    ctx.body = { code: 400, message: "参数不完整" };
    ctx.status = 400;
    return false;
  }
  try {
    // 验证当前用户是否存在
    const [user] = await ctx.db.query("SELECT id FROM users WHERE id = ?", [
      id,
    ]);
    if (user.length === 0) {
      ctx.body = { code: 404, message: "用户不存在" };
      ctx.status = 404;
      return false;
    }
    // 更新用户信息
    await ctx.db.query(
      "UPDATE users SET username = ?, password = ? WHERE id = ?",
      [username, password, id]
    );
    console.info(`用户 ${id} 信息修改成功 ` + new Date().toLocaleString());
    console.table([{ 新用户名: username, 新密码: password }]);
    ctx.body = { code: 200, message: "用户信息修改成功" };
  } catch (error) {
    console.error(error);
    ctx.body = { code: 500, message: "用户信息修改失败" };
    ctx.status = 500;
  }
});

// 检测登录状态
authRouter.get("/api/status", async (ctx) => {
  const token = ctx.headers.authorization;
  if (!token) {
    ctx.body = { code: 400, message: "用户未登录" };
    return false;
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    ctx.state.password = decoded.password;
    ctx.body = { code: 200, message: "正常" };
    return false;
  } catch (err) {
    ctx.body = { code: 401, message: "登录已过期，请重新登录" };
    return false;
  }
});

module.exports = authRouter;
