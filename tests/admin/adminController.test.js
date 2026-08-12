import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const session = {
    withTransaction: vi.fn(),
    endSession: vi.fn(),
  };

  return {
    session,

    startSession: vi.fn(),

    usersFindOne: vi.fn(),
    usersUpdateOne: vi.fn(),

    ordersFindOne: vi.fn(),
    ordersUpdateOne: vi.fn(),

    productsFindOne: vi.fn(),
    productsUpdateOne: vi.fn(),
  };
});

vi.mock("../../src/config/mongodb.js", () => ({
  default: {
    startSession: mocks.startSession,
  },
}));

vi.mock("../../src/config/database.js", () => ({
  ordersCollection: {
    findOne: mocks.ordersFindOne,
    updateOne: mocks.ordersUpdateOne,
  },

  usersCollection: {
    findOne: mocks.usersFindOne,
    updateOne: mocks.usersUpdateOne,
  },

  productsCollection: {
    findOne: mocks.productsFindOne,
    updateOne: mocks.productsUpdateOne,
  },
}));

import {
  toggleUserBlock,
  updateOrderStatus,
  updateUserRole,
} from "../../src/controllers/adminController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

describe("Admin Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.startSession.mockReturnValue(mocks.session);

    mocks.session.withTransaction.mockImplementation(
      async (callback) => {
        await callback();
      },
    );

    mocks.session.endSession.mockResolvedValue();
  });

  // TC-BE-ADMIN-001
  it("prevents an admin from removing their own admin role", async () => {
    const id = new ObjectId().toString();

    mocks.usersFindOne.mockResolvedValue({
      _id: new ObjectId(id),
      email: "admin@example.com",
      role: "admin",
    });

    const req = {
      params: {
        id,
      },

      body: {
        role: "customer",
      },

      decoded: {
        email: "admin@example.com",
      },
    };

    const res = createResponse();

    await updateUserRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "You cannot remove your own admin role.",
    });

    expect(mocks.usersUpdateOne).not.toHaveBeenCalled();
  });

  // TC-BE-ADMIN-002
  it("prevents an admin from blocking their own account", async () => {
    const id = new ObjectId().toString();

    mocks.usersFindOne.mockResolvedValue({
      _id: new ObjectId(id),
      email: "admin@example.com",
      role: "admin",
    });

    const req = {
      params: {
        id,
      },

      body: {
        isBlocked: true,
      },

      decoded: {
        email: "admin@example.com",
      },
    };

    const res = createResponse();

    await toggleUserBlock(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "You cannot block your own account.",
    });

    expect(mocks.usersUpdateOne).not.toHaveBeenCalled();
  });

  // TC-BE-ADMIN-003
  it("restores reserved stock when an active order is cancelled", async () => {
    const orderId = new ObjectId();
    const productId = new ObjectId();

    mocks.ordersFindOne.mockResolvedValue({
      _id: orderId,
      orderStatus: "Processing",
      inventoryReleased: false,

      products: [
        {
          productId: productId.toString(),
          size: "M",
          quantity: 2,
        },
      ],
    });

    mocks.productsFindOne.mockResolvedValue({
      _id: productId,

      sizes: [
        {
          size: "M",
          stock: 1,
        },
      ],

      totalStock: 1,
    });

    mocks.productsUpdateOne.mockResolvedValue({
      modifiedCount: 1,
    });

    mocks.ordersUpdateOne.mockResolvedValue({
      modifiedCount: 1,
    });

    const req = {
      params: {
        id: orderId.toString(),
      },

      body: {
        status: "Cancelled",
      },
    };

    const res = createResponse();

    await updateOrderStatus(req, res);

    expect(mocks.productsUpdateOne).toHaveBeenCalledTimes(1);

    expect(mocks.productsUpdateOne).toHaveBeenCalledWith(
      {
        _id: expect.any(ObjectId),
        "sizes.size": "M",
      },

      {
        $inc: {
          "sizes.$[selectedSize].stock": 2,
          totalStock: 2,
        },

        $set: {
          updatedAt: expect.any(Date),
        },
      },

      {
        session: mocks.session,

        arrayFilters: [
          {
            "selectedSize.size": "M",
          },
        ],
      },
    );

    expect(mocks.ordersUpdateOne).toHaveBeenCalledWith(
      {
        _id: orderId,
      },

      {
        $set: expect.objectContaining({
          orderStatus: "Cancelled",
          inventoryReleased: true,
          cancelledAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      },

      {
        session: mocks.session,
      },
    );

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,

        message:
          "Order cancelled and reserved stock restored.",

        order: expect.objectContaining({
          orderStatus: "Cancelled",
          inventoryReleased: true,
        }),
      }),
    );

    expect(
      mocks.session.endSession,
    ).toHaveBeenCalledTimes(1);
  });
});