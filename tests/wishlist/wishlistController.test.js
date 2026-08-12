import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  find: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  wishlistCollection: {
    findOne: mocks.findOne,
    insertOne: mocks.insertOne,
    find: mocks.find,
    deleteOne: mocks.deleteOne,
  },
}));

import {
  addToWishlist,
  getWishlist,
  removeWishlist,
} from "../../src/controllers/wishlistController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

const createCursor = (items = []) => {
  const cursor = {
    sort: vi.fn(),
    toArray: vi.fn(),
  };

  cursor.sort.mockReturnValue(cursor);
  cursor.toArray.mockResolvedValue(items);

  return cursor;
};

describe("Wishlist Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-WISH-001
  it("adds a product to the authenticated user's wishlist", async () => {
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
      },
    };

    const res = createResponse();

    await addToWishlist(req, res);

    expect(mocks.findOne).toHaveBeenCalledWith({
      userEmail: "customer@example.com",
      productId: "product-123",
    });

    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: "customer@example.com",
        productId: "product-123",
        title: "Premium Shirt",
        image: "shirt.jpg",
        price: 2500,
        createdAt: expect.any(Date),
      }),
    );

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      insertedId,
    });
  });

  // TC-BE-WISH-002
  it("returns authenticated user's wishlist in newest-first order", async () => {
    const wishlist = [
      {
        productId: "product-2",
        title: "Black Shirt",
      },
      {
        productId: "product-1",
        title: "White Shirt",
      },
    ];

    const cursor = createCursor(wishlist);
    mocks.find.mockReturnValue(cursor);

    const req = {
      decoded: {
        email: "customer@example.com",
      },
    };

    const res = createResponse();

    await getWishlist(req, res);

    expect(mocks.find).toHaveBeenCalledWith({
      userEmail: "customer@example.com",
    });

    expect(cursor.sort).toHaveBeenCalledWith({
      createdAt: -1,
    });

    expect(res.send).toHaveBeenCalledWith(wishlist);
  });

  // TC-BE-WISH-003
  it("removes only the authenticated user's wishlist item", async () => {
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

    await removeWishlist(req, res);

    expect(mocks.deleteOne).toHaveBeenCalledWith({
      _id: expect.any(ObjectId),
      userEmail: "customer@example.com",
    });

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      result: deleteResult,
    });
  });
});