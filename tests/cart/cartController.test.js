import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  cartsCollection: {
    findOne: mocks.findOne,
    insertOne: mocks.insertOne,
    updateOne: mocks.updateOne,
    deleteOne: mocks.deleteOne,
  },
}));

import {
  addToCart,
  updateCartQuantity,
  removeFromCart,
} from "../../src/controllers/cartController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

describe("Cart Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // TC-BE-CART-001
  it("adds a new product to the authenticated user's cart", async () => {
    const insertedId = new ObjectId();

    mocks.findOne.mockResolvedValue(null);

    mocks.insertOne.mockResolvedValue({
      insertedId,
    });

    const req = {
      decoded: {
        email: "customer@example.com",
      },
      body: {
        productId: "product-123",
        title: "Premium Shirt",
        image: "shirt.jpg",
        price: 2500,
        offerPrice: 2200,
        size: "M",
        quantity: 1,
      },
    };

    const res = createResponse();

    await addToCart(req, res);

    expect(mocks.findOne).toHaveBeenCalledWith({
      userEmail: "customer@example.com",
      productId: "product-123",
      size: "M",
    });

    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: "customer@example.com",
        productId: "product-123",
        title: "Premium Shirt",
        image: "shirt.jpg",
        price: 2500,
        offerPrice: 2200,
        size: "M",
        quantity: 1,
        createdAt: expect.any(Date),
      }),
    );

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      insertedId,
      message: "Added to cart.",
    });
  });

  // TC-BE-CART-002
  it("increases quantity when the same product and size already exist", async () => {
    const existingId = new ObjectId();

    mocks.findOne.mockResolvedValue({
      _id: existingId,
      userEmail: "customer@example.com",
      productId: "product-123",
      size: "M",
      quantity: 1,
    });

    mocks.updateOne.mockResolvedValue({
      modifiedCount: 1,
    });

    const req = {
      decoded: {
        email: "customer@example.com",
      },
      body: {
        productId: "product-123",
        title: "Premium Shirt",
        image: "shirt.jpg",
        price: 2500,
        offerPrice: 2200,
        size: "M",
        quantity: 2,
      },
    };

    const res = createResponse();

    await addToCart(req, res);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      {
        _id: existingId,
      },
      {
        $inc: {
          quantity: 2,
        },
      },
    );

    expect(mocks.insertOne).not.toHaveBeenCalled();

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Cart quantity updated.",
    });
  });

  // TC-BE-CART-003
  it("rejects cart quantity below one", async () => {
    const req = {
      params: {
        id: new ObjectId().toString(),
      },
      decoded: {
        email: "customer@example.com",
      },
      body: {
        quantity: 0,
      },
    };

    const res = createResponse();

    await updateCartQuantity(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Quantity must be at least 1.",
    });

    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  // TC-BE-CART-004
  it("removes only the authenticated user's cart item", async () => {
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
      decoded: {
        email: "customer@example.com",
      },
    };

    const res = createResponse();

    await removeFromCart(req, res);

    expect(mocks.deleteOne).toHaveBeenCalledWith({
      _id: expect.any(ObjectId),
      userEmail: "customer@example.com",
    });

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Item removed.",
      result: deleteResult,
    });
  });
});