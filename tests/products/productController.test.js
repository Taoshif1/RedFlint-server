import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  productsCollection: {
    find: mocks.find,
    findOne: mocks.findOne,
    insertOne: mocks.insertOne,
    updateOne: mocks.updateOne,
    deleteOne: mocks.deleteOne,
  },
}));

import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../src/controllers/productController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);

  return res;
};

const createCursor = (products = []) => {
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

describe("Product Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-PROD-001
  it("loads products with search, sorting, card view and safe limit", async () => {
    const products = [
      {
        _id: "1",
        title: "Premium Shirt",
      },
    ];

    const cursor = createCursor(products);

    mocks.find.mockReturnValue(cursor);

    const req = {
      query: {
        search: "shirt.*",
        sort: "price-desc",
        view: "card",
        limit: "100",
      },
    };

    const res = createResponse();

    await getProducts(req, res);

    expect(mocks.find).toHaveBeenCalledWith({
      $or: [
        {
          title: {
            $regex: "shirt\\.\\*",
            $options: "i",
          },
        },
        {
          description: {
            $regex: "shirt\\.\\*",
            $options: "i",
          },
        },
        {
          category: {
            $regex: "shirt\\.\\*",
            $options: "i",
          },
        },
        {
          season: {
            $regex: "shirt\\.\\*",
            $options: "i",
          },
        },
      ],
    });

    expect(cursor.sort).toHaveBeenCalledWith({
      offerPrice: -1,
      _id: -1,
    });

    expect(cursor.project).toHaveBeenCalled();
    expect(cursor.limit).toHaveBeenCalledWith(48);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(products);

    expect(res.set).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300",
    );
  });

  // TC-BE-PROD-002
  it("rejects invalid product ID", async () => {
    const req = {
      params: {
        id: "invalid-product-id",
      },
    };

    const res = createResponse();

    await getProductById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Invalid product ID.",
    });

    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  // TC-BE-PROD-003
  it("returns a product by valid ID", async () => {
    const id = new ObjectId().toString();

    const product = {
      _id: new ObjectId(id),
      title: "Premium Shirt",
      price: 2500,
    };

    mocks.findOne.mockResolvedValue(product);

    const req = {
      params: {
        id,
      },
    };

    const res = createResponse();

    await getProductById(req, res);

    expect(mocks.findOne).toHaveBeenCalledWith({
      _id: expect.any(ObjectId),
    });

    expect(res.set).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=120, stale-while-revalidate=300",
    );

    expect(res.send).toHaveBeenCalledWith(product);
  });

  // TC-BE-PROD-004
  it("normalizes product stock and price before creating product", async () => {
    const insertedId = new ObjectId();

    mocks.insertOne.mockResolvedValue({
      insertedId,
    });

    const req = {
      body: {
        title: "Premium Shirt",
        price: "-500",
        offerPrice: "1500",
        sizes: [
          {
            size: " S ",
            stock: 3,
          },
          {
            size: "M",
            stock: -5,
          },
        ],
      },
    };

    const res = createResponse();

    await createProduct(req, res);

    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Premium Shirt",
        price: 0,
        offerPrice: 1500,
        sizes: [
          {
            size: "S",
            stock: 3,
          },
          {
            size: "M",
            stock: 0,
          },
        ],
        totalStock: 3,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      insertedId,
    });
  });

  // TC-BE-PROD-005
  it("returns not found when updating a missing product", async () => {
    const id = new ObjectId().toString();

    mocks.updateOne.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
    });

    const req = {
      params: {
        id,
      },
      body: {
        title: "Updated Shirt",
        price: 2000,
      },
    };

    const res = createResponse();

    await updateProduct(req, res);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      {
        _id: expect.any(ObjectId),
      },
      {
        $set: expect.objectContaining({
          title: "Updated Shirt",
          price: 2000,
          updatedAt: expect.any(Date),
        }),
      },
    );

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Product not found.",
    });
  });

  // TC-BE-PROD-006
  it("deletes a product using a valid product ID", async () => {
    const id = new ObjectId().toString();

    const deleteResult = {
      acknowledged: true,
      deletedCount: 1,
    };

    mocks.deleteOne.mockResolvedValue(deleteResult);

    const req = {
      params: {
        id,
      },
    };

    const res = createResponse();

    await deleteProduct(req, res);

    expect(mocks.deleteOne).toHaveBeenCalledWith({
      _id: expect.any(ObjectId),
    });

    expect(res.send).toHaveBeenCalledWith(deleteResult);
  });
});