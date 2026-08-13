import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const sessionWithTransaction = vi.fn();
  const sessionEndSession = vi.fn();

  return {
    startSession: vi.fn(),

    session: {
      withTransaction: sessionWithTransaction,
      endSession: sessionEndSession,
    },

    sessionWithTransaction,
    sessionEndSession,

    ordersFindOne: vi.fn(),
    ordersInsertOne: vi.fn(),
    ordersFind: vi.fn(),

    cartsFind: vi.fn(),
    cartsDeleteMany: vi.fn(),

    productsFindOne: vi.fn(),
    productsUpdateOne: vi.fn(),

    settingsFindOne: vi.fn(),
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
    insertOne: mocks.ordersInsertOne,
    find: mocks.ordersFind,
  },

  cartsCollection: {
    find: mocks.cartsFind,
    deleteMany: mocks.cartsDeleteMany,
  },

  productsCollection: {
    findOne: mocks.productsFindOne,
    updateOne: mocks.productsUpdateOne,
  },

  settingsCollection: {
    findOne: mocks.settingsFindOne,
  },
}));

import {
  createOrder,
  createGuestOrder,
  trackOrder,
  getMyOrders,
  getMyOrderById,
} from "../../src/controllers/orderController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

const createOrderCursor = (orders = []) => {
  const cursor = {
    sort: vi.fn(),
    toArray: vi.fn(),
  };

  cursor.sort.mockReturnValue(cursor);
  cursor.toArray.mockResolvedValue(orders);

  return cursor;
};

const enabledBkashSettings = {
  paymentMethods: {
    bkash: {
      enabled: true,
      accountNumber: "TEST-BKASH-MERCHANT",
      accountType: "Merchant",
      instructions: "Use the test merchant account.",
    },
  },
};

describe("Order Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.startSession.mockReturnValue(mocks.session);

    mocks.sessionWithTransaction.mockImplementation(
      async (callback) => {
        await callback();
      },
    );

    mocks.sessionEndSession.mockResolvedValue();

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TC-BE-ORDER-001
  it("creates a registered buy-now order using server product price", async () => {
    const productId = new ObjectId().toString();
    const insertedId = new ObjectId();

    mocks.settingsFindOne.mockResolvedValue({
      ...enabledBkashSettings,
      shippingFee: 120,
      freeShipping: 3000,
      maintenanceMode: false,
    });

    mocks.productsFindOne.mockResolvedValue({
      _id: new ObjectId(productId),
      title: "Premium Shirt",
      price: 2000,
      offerPrice: 1500,
      images: ["shirt.jpg"],
      totalStock: 5,
      sizes: [
        {
          size: "M",
          stock: 5,
        },
      ],
    });

    mocks.ordersFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mocks.productsUpdateOne.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });

    mocks.ordersInsertOne.mockResolvedValue({
      insertedId,
    });

    const req = {
      decoded: {
        email: "customer@example.com",
      },

      body: {
        customerName: " Customer Name ",
        phone: "017 1234-5678",
        address: " Dhaka ",
        city: " Dhaka ",
        postalCode: "1200",
        transactionId: "TX-1001",
        paymentMethod: "BKASH",

        products: [
          {
            productId,
            size: "M",
            quantity: 2,

            // Client values should not control final pricing
            price: 1,
            offerPrice: 1,
          },
        ],
      },
    };

    const res = createResponse();

    await createOrder(req, res);

    expect(mocks.ordersInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        customerType: "registered",
        orderSource: "buy_now",

        customerName: "Customer Name",
        phone: "01712345678",
        email: "customer@example.com",
        userEmail: "customer@example.com",
        address: "Dhaka",

        subtotal: 3000,
        shipping: 0,
        total: 3000,

        payment: {
          method: "bkash",
          transactionId: "TX-1001",
          status: "Pending",
        },

        orderStatus: "Pending",

        products: [
          expect.objectContaining({
            productId,
            title: "Premium Shirt",
            size: "M",
            quantity: 2,
            price: 2000,
            offerPrice: 1500,
            unitPrice: 1500,
            lineTotal: 3000,
          }),
        ],
      }),
      {
        session: mocks.session,
      },
    );

    expect(mocks.cartsDeleteMany).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      insertedId,
      orderNumber: expect.stringMatching(/^RF-/),
      message: "Order placed successfully.",
    });

    expect(mocks.sessionEndSession).toHaveBeenCalledTimes(1);
  });

  // TC-BE-ORDER-002
  it("rejects ordering while store maintenance mode is enabled", async () => {
    mocks.settingsFindOne.mockResolvedValue({
      maintenanceMode: true,
    });

    const req = {
      decoded: {
        email: "customer@example.com",
      },

      body: {
        customerName: "Customer",
        phone: "01700000000",
        address: "Dhaka",
        transactionId: "TX-1002",

        products: [
          {
            productId: new ObjectId().toString(),
            quantity: 1,
            size: "M",
          },
        ],
      },
    };

    const res = createResponse();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message:
        "RedFlint is currently under maintenance. Ordering is temporarily unavailable.",
    });

    expect(mocks.productsFindOne).not.toHaveBeenCalled();
    expect(mocks.ordersInsertOne).not.toHaveBeenCalled();
    expect(mocks.sessionEndSession).toHaveBeenCalledTimes(1);
  });

  // TC-BE-ORDER-003
  it("rejects a transaction ID that has already been used", async () => {
    const productId = new ObjectId().toString();

    mocks.settingsFindOne.mockResolvedValue({
      ...enabledBkashSettings,
      maintenanceMode: false,
      shippingFee: 120,
      freeShipping: 3000,
    });

    mocks.productsFindOne.mockResolvedValue({
      _id: new ObjectId(productId),
      title: "Premium Shirt",
      price: 2000,
      totalStock: 5,
      sizes: [
        {
          size: "M",
          stock: 5,
        },
      ],
    });

    mocks.ordersFindOne.mockResolvedValueOnce({
      orderNumber: "RF-OLD",
      payment: {
        transactionId: "USED-TX",
      },
    });

    const req = {
      decoded: {
        email: "customer@example.com",
      },

      body: {
        customerName: "Customer",
        phone: "01700000000",
        address: "Dhaka",
        transactionId: "USED-TX",

        products: [
          {
            productId,
            quantity: 1,
            size: "M",
          },
        ],
      },
    };

    const res = createResponse();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "This transaction ID has already been used.",
    });

    expect(mocks.productsUpdateOne).not.toHaveBeenCalled();
    expect(mocks.ordersInsertOne).not.toHaveBeenCalled();
  });

  // TC-BE-ORDER-004
  it("rejects order if stock becomes unavailable during inventory reservation", async () => {
    const productId = new ObjectId().toString();

    mocks.settingsFindOne.mockResolvedValue({
      ...enabledBkashSettings,
      maintenanceMode: false,
      shippingFee: 120,
      freeShipping: 3000,
    });

    mocks.productsFindOne.mockResolvedValue({
      _id: new ObjectId(productId),
      title: "Premium Shirt",
      price: 2000,
      totalStock: 5,
      sizes: [
        {
          size: "M",
          stock: 5,
        },
      ],
    });

    mocks.ordersFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mocks.productsUpdateOne.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
    });

    const req = {
      decoded: {
        email: "customer@example.com",
      },

      body: {
        customerName: "Customer",
        phone: "01700000000",
        address: "Dhaka",
        transactionId: "TX-RACE-1",

        products: [
          {
            productId,
            quantity: 2,
            size: "M",
          },
        ],
      },
    };

    const res = createResponse();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message:
        "Sorry, Premium Shirt - M just sold out or no longer has enough stock. Please refresh and try again.",
    });

    expect(mocks.ordersInsertOne).not.toHaveBeenCalled();
  });

  // TC-BE-ORDER-005
  it("creates a COD guest order without storing a transaction ID", async () => {
    const productId = new ObjectId().toString();
    const insertedId = new ObjectId();

    mocks.settingsFindOne.mockResolvedValue({
      maintenanceMode: false,
      shippingFee: 120,
      freeShipping: 3000,
    });
    mocks.productsFindOne.mockResolvedValue({
      _id: new ObjectId(productId),
      title: "Premium Shirt",
      price: 1500,
      images: ["shirt.jpg"],
      totalStock: 3,
      sizes: [{ size: "M", stock: 3 }],
    });
    mocks.ordersFindOne.mockResolvedValueOnce(null);
    mocks.productsUpdateOne.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });
    mocks.ordersInsertOne.mockResolvedValue({ insertedId });

    const req = {
      body: {
        customerName: "COD Customer",
        phone: "01712345678",
        address: "Dhaka",
        city: "Dhaka",
        paymentMethod: "cod",
        products: [{ productId, quantity: 1, size: "M" }],
      },
    };
    const res = createResponse();

    await createGuestOrder(req, res);

    expect(mocks.ordersInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: {
          method: "cod",
          status: "Due",
        },
      }),
      { session: mocks.session },
    );
    expect(mocks.ordersInsertOne.mock.calls[0][0].payment).not.toHaveProperty(
      "transactionId",
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // TC-BE-ORDER-006
  it("rejects guest checkout when no products are selected", async () => {
    const req = {
      body: {
        customerName: "Guest Customer",
        phone: "01700000000",
        address: "Dhaka",
        transactionId: "GUEST-TX-1",
        products: [],
      },
    };

    const res = createResponse();

    await createGuestOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "No products selected.",
    });

    expect(mocks.settingsFindOne).not.toHaveBeenCalled();
    expect(mocks.ordersInsertOne).not.toHaveBeenCalled();
    expect(mocks.sessionEndSession).toHaveBeenCalledTimes(1);
  });

  // TC-BE-ORDER-007
  it("requires an order number when tracking an order", async () => {
    const req = {
      body: {
        orderNumber: "",
        phone: "01700000000",
      },
    };

    const res = createResponse();

    await trackOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Order number is required.",
    });

    expect(mocks.ordersFindOne).not.toHaveBeenCalled();
  });

  // TC-BE-ORDER-008
  it("returns safe order information when tracking succeeds", async () => {
    const orderId = new ObjectId();

    mocks.ordersFindOne.mockResolvedValue({
      _id: orderId,
      orderNumber: "RF-20260813-ABC12345",
      customerName: "Customer",
      phone: "01700000000",
      email: "private@example.com",
      address: "Private Address",

      customerType: "guest",
      orderSource: "cart",

      products: [
        {
          productId: "product-1",
          title: "Premium Shirt",
          image: "shirt.jpg",
          size: "M",
          quantity: 1,
          unitPrice: 1500,
          lineTotal: 1500,

          privateField: "should-not-return",
        },
      ],

      subtotal: 1500,
      shipping: 120,
      total: 1620,

      payment: {
        method: "bkash",
        transactionId: "SECRET-TX",
        status: "Pending",
      },

      orderStatus: "Processing",
      createdAt: new Date("2026-08-13"),
      updatedAt: new Date("2026-08-13"),
    });

    const req = {
      body: {
        orderNumber: "rf-20260813-abc12345",
        phone: "017 000-00000",
      },
    };

    const res = createResponse();

    await trackOrder(req, res);

    expect(mocks.ordersFindOne).toHaveBeenCalledWith({
      phone: "01700000000",
      orderNumber: "RF-20260813-ABC12345",
    });

    const response = res.send.mock.calls[0][0];

    expect(response.success).toBe(true);

    expect(response.order).toEqual(
      expect.objectContaining({
        orderNumber: "RF-20260813-ABC12345",
        customerName: "Customer",
        customerType: "guest",
        orderStatus: "Processing",
        subtotal: 1500,
        shipping: 120,
        total: 1620,
      }),
    );

    expect(response.order.payment).toEqual({
      method: "bkash",
      status: "Pending",
    });

    expect(response.order.payment.transactionId).toBeUndefined();
    expect(response.order.email).toBeUndefined();
    expect(response.order.address).toBeUndefined();

    expect(response.order.products[0].privateField).toBeUndefined();
  });

  // TC-BE-ORDER-009
  it("returns only orders belonging to the authenticated user", async () => {
    const orders = [
      {
        orderNumber: "RF-002",
      },
      {
        orderNumber: "RF-001",
      },
    ];

    const cursor = createOrderCursor(orders);

    mocks.ordersFind.mockReturnValue(cursor);

    const req = {
      decoded: {
        email: "customer@example.com",
      },
    };

    const res = createResponse();

    await getMyOrders(req, res);

    expect(mocks.ordersFind).toHaveBeenCalledWith({
      userEmail: "customer@example.com",
    });

    expect(cursor.sort).toHaveBeenCalledWith({
      createdAt: -1,
    });

    expect(res.send).toHaveBeenCalledWith(orders);
  });

  // TC-BE-ORDER-010
  it("does not return another user's order by ID", async () => {
    const id = new ObjectId().toString();

    mocks.ordersFindOne.mockResolvedValue(null);

    const req = {
      params: {
        id,
      },

      decoded: {
        email: "customer@example.com",
      },
    };

    const res = createResponse();

    await getMyOrderById(req, res);

    expect(mocks.ordersFindOne).toHaveBeenCalledWith({
      _id: expect.any(ObjectId),
      userEmail: "customer@example.com",
    });

    expect(res.status).toHaveBeenCalledWith(404);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Order not found.",
    });
  });
});
