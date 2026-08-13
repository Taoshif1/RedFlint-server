import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  productsCollection: {
    find: mocks.find,
    findOne: mocks.findOne,
  },
}));

import productRoutes from "../../src/routes/productRoutes.js";

const createCursor = (products) => {
  const cursor = {
    sort: vi.fn(),
    project: vi.fn(),
    limit: vi.fn(),
    toArray: vi.fn(),
  };

  cursor.sort.mockReturnValue(cursor);
  cursor.project.mockReturnValue(cursor);
  cursor.limit.mockReturnValue(cursor);
  cursor.toArray.mockResolvedValue(products);

  return cursor;
};

const app = express();
app.use("/api/products", productRoutes);

describe("Product inventory response headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockReturnValue(
      createCursor([{ _id: "product-1", totalStock: 1 }]),
    );
  });

  it.each([
    "/api/products",
    "/api/products/featured",
    "/api/products/special",
    "/api/products/special-edition",
  ])("sets Cache-Control: no-store on GET %s", async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("sets Cache-Control: no-store on product details", async () => {
    const id = new ObjectId();
    mocks.findOne.mockResolvedValue({
      _id: id,
      totalStock: 1,
      sizes: [{ size: "M", stock: 1 }],
    });

    const response = await request(app).get(`/api/products/${id}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
