const Router = require("koa-router");
const categoriesRouter = new Router({ prefix: "/api/categories" });

// 递归删除单个分类
const deleteCategory = async (id, db) => {
  // 检测分类id是否存在
  const [rows] = await db.query("SELECT * FROM categories WHERE id=?", [id]);
  if (rows.length === 0) {
    return { success: false, message: "分类不存在" };
  }

  // 检测分类是否存在子分类
  const [childRows] = await db.query(
    "SELECT * FROM categories WHERE parent_id=?",
    [id]
  );
  if (childRows.length > 0) {
    // 递归删除子分类
    for (const childRow of childRows) {
      const childId = childRow.id;
      const result = await deleteCategory(childId, db);
      if (!result.success) {
        return result;
      }
    }
  }

  try {
    await db.query("DELETE FROM categories WHERE id=?", [id]);
    return { success: true };
  } catch (err) {
    return { success: false, message: "删除失败" };
  }
};

// 递归删除分类及其子分类
const recursiveDelete = async (ids, db) => {
  // 检查id是否存在且不包含子分类
  const [rows] = await db.query(
    `SELECT * FROM categories WHERE id IN (${ids.join()}) AND parent_id IS NULL`
  );
  if (rows.length !== ids.length) {
    return { success: false, message: "部分分类不存在或包含子分类" };
  }

  // 递归删除子分类
  for (const id of ids) {
    const result = await deleteCategory(id, db);
    if (!result.success) {
      return result;
    }
  }

  return { success: true, message: "批量删除成功" };
};

// 往categories表中插入一条数据
categoriesRouter.post("/", async (ctx) => {
  try {
    const { name, parent_id = null } = ctx.request.body;
    console.log("添加分类：" + name, parent_id);
    if (!name) {
      ctx.body = { code: 400, message: "参数不完整" };
      ctx.status = 400;
      return false;
    }
    if (parent_id !== null && !Number.isInteger(parent_id)) {
      ctx.body = { code: 400, message: "父级分类参数错误" };
      ctx.status = 400;
      return false;
    }
    // 检测父级分类id是否存在
    if (parent_id !== null) {
      const [parentRows] = await ctx.db.query(
        "SELECT * FROM categories WHERE id=? AND parent_id IS NULL",
        [parent_id]
      );
      if (parentRows.length === 0) {
        ctx.body = { code: 400, message: "父级 id 不存在或已有父级分类" };
        ctx.status = 400;
        return;
      }
    }
    // 检测分类id是否存在
    const [rows] = await ctx.db.query(
      "SELECT COUNT(*) AS count FROM categories WHERE name = ?",
      [name]
    );
    if (rows[0].count > 0) {
      ctx.body = { code: 400, message: "分类名已存在" };
      ctx.status = 400;
      return false;
    }
    const query = "INSERT INTO categories (name, parent_id) VALUES (?, ?)";
    const params = parent_id ? [name, parent_id] : [name, null];
    await ctx.db.query(query, params);
    ctx.body = { code: 200, message: "添加成功" };
  } catch (err) {
    console.error("添加分类失败", err);
    ctx.body = { code: 500, message: "添加分类失败" };
    ctx.status = 500;
  }
});

// 修改categories表中的一条数据
categoriesRouter.put("/", async (ctx) => {
  ctx.body = { code: 400, message: "参数不完整" };
  ctx.status = 400;
  return false;
});
categoriesRouter.put("/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    const { name, parent_id = null } = ctx.request.body;
    if (!id || !name) {
      ctx.body = { code: 400, message: "参数不完整" };
      ctx.status = 400;
      return false;
    }
    // 检测分类是否存在
    const [rows] = await ctx.db.query("SELECT * FROM categories WHERE id=?", [
      id,
    ]);
    if (rows.length === 0) {
      ctx.body = { code: 404, message: "分类不存在" };
      ctx.status = 404;
      return false;
    }
    // 检测父级分类id是否存在
    if (parent_id !== null) {
      const [parentRows] = await ctx.db.query(
        "SELECT * FROM categories WHERE id=?",
        [parent_id]
      );
      if (parentRows.length === 0) {
        ctx.body = { code: 400, message: "父级分类不存在" };
        ctx.status = 400;
        return false;
      }
    }
    await ctx.db.query("UPDATE categories SET name=?, parent_id=? WHERE id=?", [
      name,
      parent_id,
      id,
    ]);
    ctx.body = { code: 200, message: "修改成功" };
  } catch (err) {
    console.error("修改分类失败", err);
    ctx.body = { code: 500, message: "修改分类失败" };
    ctx.status = 500;
  }
});

// 删除categories表中的一条数据
categoriesRouter.delete("/:id", async (ctx) => {
  try {
    const { id } = ctx.params;
    if (!id) {
      ctx.body = { code: 400, message: "参数不完整" };
      ctx.status = 400;
      return false;
    }

    const result = await deleteCategory(id, ctx.db);
    if (!result.success) {
      ctx.body = { code: 500, message: result.message };
      ctx.status = 500;
      return false;
    }

    ctx.body = { code: 200, message: "删除成功" };
  } catch (err) {
    console.error("删除分类失败", err);
    ctx.body = { code: 500, message: "删除分类失败" };
    ctx.status = 500;
  }
});

// 批量删除categories表中的多条数据
categoriesRouter.delete("/", async (ctx) => {
  try {
    const { ids } = ctx.request.body;
    if (!ids || ids.length === 0) {
      ctx.body = { code: 400, message: "参数不完整" };
      ctx.status = 400;
      return;
    }

    const result = await recursiveDelete(ids, ctx.db);
    if (!result.success) {
      ctx.body = { code: 404, message: result.message };
      ctx.status = 404;
      return;
    }

    ctx.body = { code: 200, message: result.message };
  } catch (err) {
    console.error("批量删除分类失败", err);
    ctx.body = { code: 500, message: "批量删除分类失败" };
    ctx.status = 500;
  }
});

module.exports = categoriesRouter;
