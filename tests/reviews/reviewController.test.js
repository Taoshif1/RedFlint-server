import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({
  productFindOne: vi.fn(),
  reviewInsertOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  productsCollection: {
    findOne: mocks.productFindOne,
  },

  reviewsCollection: {
    insertOne: mocks.reviewInsertOne,
  },
}));

import { createReview } from "../../src/controllers/reviewController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

describe("Review Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-REVIEW-001
  it("rejects a review rating outside the allowed range", async () => {
    const req = {
      body: {
        productId: new ObjectId().toString(),
        customerName: "Customer",
        rating: 6,
        comment: "Great product",
      },
    };

    const res = createResponse();

    await createReview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Rating must be between 1 and 5.",
    });

    expect(mocks.productFindOne).not.toHaveBeenCalled();
    expect(mocks.reviewInsertOne).not.toHaveBeenCalled();
  });

  // TC-BE-REVIEW-002
  it("creates a valid review as pending for admin approval", async () => {
    const productId = new ObjectId();
    const insertedId = new ObjectId();

    mocks.productFindOne.mockResolvedValue({
      _id: productId,
      title: "Premium Shirt",
      images: ["shirt.jpg"],
    });

    mocks.reviewInsertOne.mockResolvedValue({
      insertedId,
    });

    const req = {
      body: {
        productId: productId.toString(),
        customerName: "  Customer Name  ",
        rating: "5",
        comment: "  Excellent shirt quality.  ",
      },
    };

    const res = createResponse();

    await createReview(req, res);

    expect(mocks.productFindOne).toHaveBeenCalledWith({
      _id: expect.any(ObjectId),
    });

    expect(mocks.reviewInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: productId.toString(),
        productTitle: "Premium Shirt",
        productImage: "shirt.jpg",
        customerName: "Customer Name",
        rating: 5,
        comment: "Excellent shirt quality.",
        verifiedPurchase: false,
        status: "pending",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      insertedId,
      message:
        "Review submitted successfully. It will appear after approval.",
    });
  });
});