const Router = require("koa-router");
const linksRouter = new Router({ prefix: "/api/links" });

linksRouter.post("/", async (ctx) => {
  // 往links表中插入一条数据
  console.log("新增站点：", ctx.request.body);
  const { name, url, ico = null, categories, description } = ctx.request.body;
  if (!name || !url || !categories || !description) {
    ctx.body = { code: 400, message: "参数不完整" };
    ctx.status = 400;
    return false;
  }
  await ctx.db.query(
    "INSERT INTO links (name, url, ico, categories, description) VALUES (?, ?, ?, ?, ?)",
    [name, url, ico, categories, description]
  );
  ctx.body = { code: 200, message: "添加成功" };
});

linksRouter.put("/:id", async (ctx) => {
  // 修改links表中的一条数据
  const { id } = ctx.params;
  const { name, url, ico = null, categories, description } = ctx.request.body;
  if (!id || !name || !url || !categories || !description) {
    ctx.body = { code: 400, message: "参数不完整" };
    ctx.status = 400;
    return false;
  }
  const [rows] = await ctx.db.query("SELECT * FROM links WHERE id=?", [id]);
  if (rows.length === 0) {
    ctx.body = { code: 404, message: "该 id 不存在" };
    ctx.status = 404;
    return false;
  }
  await ctx.db.query(
    "UPDATE links SET name=?, url=?, ico=?, categories=?, description=? WHERE id=?",
    [name, url, ico, categories, description, id]
  );
  ctx.body = { code: 200, message: "修改成功" };
});

linksRouter.delete("/:id", async (ctx) => {
  // 删除links表中的一条数据
  const { id } = ctx.params;
  if (!id) {
    ctx.body = { code: 400, message: "参数不完整" };
    ctx.status = 400;
    return false;
  }
  const [rows] = await ctx.db.query("SELECT * FROM links WHERE id=?", [id]);
  if (rows.length === 0) {
    ctx.body = { code: 404, message: "该 id 不存在" };
    ctx.status = 404;
    return false;
  }
  await ctx.db.query("DELETE FROM links WHERE id=?", [id]);
  ctx.body = { code: 200, message: "删除成功" };
});

module.exports = linksRouter;
