const Router = require("koa-router");
const publicRouter = new Router();

// 父级分类递归
const buildCategoryTree = (categories, parentId = null) => {
  const tree = [];
  for (const category of categories) {
    if (category.parent_id === parentId) {
      const children = buildCategoryTree(categories, category.id);
      if (children.length > 0) {
        category.children = children;
      } else {
        category.children = [];
      }
      tree.push(category);
    }
  }
  return tree;
};

// 显示默认页面
publicRouter.get("/", async (ctx) => {
  await ctx.render("index");
});

// 获取总体数据
publicRouter.get("/api/all", async (ctx) => {
  try {
    const [linksCount] = await ctx.db.query("SELECT COUNT(*) FROM links");
    const [categoriesCount] = await ctx.db.query(
      "SELECT COUNT(*) FROM categories"
    );
    ctx.body = {
      code: 200,
      message: "调用成功",
      linksCount: linksCount[0]["COUNT(*)"],
      categoriesCount: categoriesCount[0]["COUNT(*)"],
    };
    ctx.status = 200;
  } catch (err) {
    console.error("调用失败", err);
    ctx.body = { code: 500, message: "调用失败" };
    ctx.status = 500;
  }
});

// 查询links表中的所有数据
publicRouter.get("/api/links", async (ctx) => {
  const [rows] = await ctx.db.query("SELECT * FROM links");
  ctx.body = { code: 200, message: "调用成功", total: rows.length, data: rows };
});

// 查询categories表中的所有数据
publicRouter.get("/api/categories", async (ctx) => {
  const [rows] = await ctx.db.query("SELECT * FROM categories");
  const categories = buildCategoryTree(rows);
  ctx.body = {
    code: 200,
    message: "调用成功",
    total: rows.length,
    data: categories,
  };
});

module.exports = publicRouter;
