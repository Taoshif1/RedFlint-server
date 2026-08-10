import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";

import {
  ordersCollection,
  cartsCollection,
  productsCollection,
  settingsCollection,
} from "../config/database.js";

// ======================================
// Helper: Calculate products from database
// ======================================

const prepareOrderProducts = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No products provided.");
  }

  const preparedProducts = [];

  for (const item of items) {
    const productId = item.productId;

    if (!productId || !ObjectId.isValid(productId)) {
      throw new Error("Invalid product ID.");
    }

    const quantity = Number(item.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Invalid product quantity.");
    }

    const product = await productsCollection.findOne({
      _id: new ObjectId(productId),
    });

    if (!product) {
      throw new Error("One or more products no longer exist.");
    }

    // ======================================
    // Validate selected size
    // ======================================

    let selectedSize = null;

    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      selectedSize = product.sizes.find(
        (sizeItem) => sizeItem.size === item.size,
      );

      if (!selectedSize) {
        throw new Error(`Selected size is unavailable for ${product.title}.`);
      }

      if (
        typeof selectedSize.stock === "number" &&
        quantity > selectedSize.stock
      ) {
        throw new Error(
          `Only ${selectedSize.stock} item(s) available for ${product.title} - ${item.size}.`,
        );
      }
    }

    // ======================================
    // Server decides the real price
    // ======================================

    const regularPrice = Number(product.price || 0);

    const sellingPrice =
      product.offerPrice !== undefined && product.offerPrice !== null
        ? Number(product.offerPrice)
        : regularPrice;

    const lineTotal = sellingPrice * quantity;

    preparedProducts.push({
      productId: product._id.toString(),

      title: product.title,

      image: product.images?.[0] || "",

      size: item.size || "",

      quantity,

      price: regularPrice,

      offerPrice: product.offerPrice ?? null,

      unitPrice: sellingPrice,

      lineTotal,
    });
  }

  return preparedProducts;
};

// ======================================
// Helper: Calculate totals
// ======================================

const calculateOrderTotals = async (products) => {
  const subtotal = products.reduce((sum, item) => sum + item.lineTotal, 0);

  const settings = await settingsCollection.findOne({
    _id: "store",
  });

  const shippingFee = Number(settings?.shippingFee ?? 120);

  const freeShipping = Number(settings?.freeShipping ?? 3000);

  let shipping = shippingFee;

  if (subtotal <= 0) {
    shipping = 0;
  } else if (freeShipping > 0 && subtotal >= freeShipping) {
    shipping = 0;
  }

  const total = subtotal + shipping;

  return {
    subtotal,
    shipping,
    total,
  };
};

// ======================================
// Helper: Check transaction ID
// ======================================

const validateTransactionId = async (transactionId) => {
  const cleanTransactionId = transactionId?.trim();

  if (!cleanTransactionId) {
    throw new Error("Transaction ID is required.");
  }

  const existingOrder = await ordersCollection.findOne({
    "payment.transactionId": cleanTransactionId,
  });

  if (existingOrder) {
    throw new Error("This transaction ID has already been used.");
  }

  return cleanTransactionId;
};

const SUPPORTED_PAYMENT_METHODS = ["bkash", "nagad", "rocket"];

const validatePaymentMethod = (paymentMethod) => {
  const method = paymentMethod?.trim().toLowerCase();

  if (!SUPPORTED_PAYMENT_METHODS.includes(method)) {
    throw new Error("Invalid payment method.");
  }

  return method;
};

// ======================================
// Helper: Normalize phone
// ======================================

const normalizePhone = (phone = "") => {
  return phone.replace(/[\s-]/g, "").trim();
};

// ======================================
// Helper: Generate customer order number
// ======================================

const generateOrderNumber = async () => {
  let orderNumber;
  let exists = true;

  while (exists) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const randomPart = randomBytes(3).toString("hex").toUpperCase();

    orderNumber = `RF-${datePart}-${randomPart}`;

    exists = await ordersCollection.findOne({
      orderNumber,
    });
  }

  return orderNumber;
};

// ======================================
// CREATE ORDER - REGISTERED USER
// ======================================

export const createOrder = async (req, res) => {
  try {
    const userEmail = req.decoded.email;

    const {
      customerName,
      phone,
      address,
      city = "",
      postalCode = "",
      transactionId,
      paymentMethod = "bkash",
      products: requestedProducts,
    } = req.body;

    if (!customerName?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Customer name is required.",
      });
    }

    if (!phone?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Phone number is required.",
      });
    }

    if (!address?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Delivery address is required.",
      });
    }

    // If products were sent directly,
    // this is a Buy Now order.
    const isBuyNow =
      Array.isArray(requestedProducts) && requestedProducts.length > 0;

    let sourceItems = [];

    if (isBuyNow) {
      sourceItems = requestedProducts;
    } else {
      sourceItems = await cartsCollection
        .find({
          userEmail,
        })
        .toArray();

      if (sourceItems.length === 0) {
        return res.status(400).send({
          success: false,
          message: "Your cart is empty.",
        });
      }
    }

    const products = await prepareOrderProducts(sourceItems);

    const { subtotal, shipping, total } = await calculateOrderTotals(products);

    const cleanTransactionId = await validateTransactionId(transactionId);

    const cleanPaymentMethod = validatePaymentMethod(paymentMethod);

    const orderNumber = await generateOrderNumber();

    const order = {
      orderNumber,

      customerType: "registered",

      orderSource: isBuyNow ? "buy_now" : "cart",

      customerName: customerName.trim(),

      phone: phone.trim(),

      email: userEmail,

      userEmail,

      address: address.trim(),

      city: city?.trim() || "",

      postalCode: postalCode?.trim() || "",

      products,

      subtotal,

      shipping,

      total,

      payment: {
        method: cleanPaymentMethod,
        transactionId: cleanTransactionId,
        status: "Pending",
      },

      orderStatus: "Pending",

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    const result = await ordersCollection.insertOne(order);

    // Only clear MongoDB cart for normal checkout.
    // Buy Now should not destroy an existing cart.
    if (!isBuyNow) {
      await cartsCollection.deleteMany({
        userEmail,
      });
    }

    res.status(201).send({
      success: true,
      insertedId: result.insertedId,
      orderNumber,
      message: "Order placed successfully.",
    });
  } catch (error) {
    console.error("Create registered order error:", error);

    res.status(400).send({
      success: false,
      message: error.message || "Failed to place order.",
    });
  }
};

// ======================================
// CREATE ORDER - GUEST USER
// ======================================

export const createGuestOrder = async (req, res) => {
  try {
    const {
      customerName,
      phone,
      email = "",
      address,
      city = "",
      postalCode = "",
      transactionId,
      paymentMethod = "bkash",
      orderSource = "cart",
      products: requestedProducts,
    } = req.body;

    if (!customerName?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Customer name is required.",
      });
    }

    if (!phone?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Phone number is required.",
      });
    }

    if (!address?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Delivery address is required.",
      });
    }

    if (!Array.isArray(requestedProducts) || requestedProducts.length === 0) {
      return res.status(400).send({
        success: false,
        message: "No products selected.",
      });
    }

    const products = await prepareOrderProducts(requestedProducts);

    const { subtotal, shipping, total } = await calculateOrderTotals(products);

    const cleanTransactionId = await validateTransactionId(transactionId);

    const cleanPaymentMethod = validatePaymentMethod(paymentMethod);

    const orderNumber = await generateOrderNumber();

    const order = {
      orderNumber,
      customerType: "guest",
      orderSource: orderSource === "buy_now" ? "buy_now" : "cart",
      customerName: customerName.trim(),

      phone: phone.trim(),

      email: email?.trim() || "",

      userEmail: null,

      address: address.trim(),

      city: city?.trim() || "",

      postalCode: postalCode?.trim() || "",

      products,

      subtotal,

      shipping,

      total,

      payment: {
        method: cleanPaymentMethod,
        transactionId: cleanTransactionId,
        status: "Pending",
      },

      orderStatus: "Pending",

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    const result = await ordersCollection.insertOne(order);

    res.status(201).send({
      success: true,
      insertedId: result.insertedId,
      orderNumber,
      message: "Guest order placed successfully.",
    });
  } catch (error) {
    console.error("Create guest order error:", error);

    res.status(400).send({
      success: false,
      message: error.message || "Failed to place guest order.",
    });
  }
};

// ======================================
// TRACK ORDER - PUBLIC
// ======================================

export const trackOrder = async (req, res) => {
  try {
    const { orderNumber, phone } = req.body;

    if (!orderNumber?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Order number is required.",
      });
    }

    if (!phone?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Phone number is required.",
      });
    }

    const cleanOrderNumber = orderNumber.trim();

    const cleanPhone = normalizePhone(phone);

    // ======================================
    // Support new RF order numbers
    // and old MongoDB order IDs
    // ======================================

    let query = {
      phone: cleanPhone,
    };

    if (
      ObjectId.isValid(cleanOrderNumber) &&
      !cleanOrderNumber.toUpperCase().startsWith("RF-")
    ) {
      query._id = new ObjectId(cleanOrderNumber);
    } else {
      query.orderNumber = cleanOrderNumber.toUpperCase();
    }

    const order = await ordersCollection.findOne(query);

    if (!order) {
      return res.status(404).send({
        success: false,
        message: "Order not found. Check your order number and phone number.",
      });
    }

    // ======================================
    // Return only safe tracking information
    // ======================================

    const safeProducts =
      order.products?.map((item) => ({
        productId: item.productId,

        title: item.title,

        image: item.image,

        size: item.size,

        quantity: item.quantity,

        unitPrice: item.unitPrice,

        lineTotal: item.lineTotal,
      })) || [];

    res.send({
      success: true,

      order: {
        orderNumber: order.orderNumber || order._id.toString(),

        customerName: order.customerName,

        customerType: order.customerType || "registered",

        orderSource: order.orderSource || "cart",

        products: safeProducts,

        subtotal: order.subtotal,

        shipping: order.shipping,

        total: order.total,

        payment: {
          method: order.payment?.method,

          status: order.payment?.status,
        },

        orderStatus: order.orderStatus,

        createdAt: order.createdAt,

        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("Track order error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to track order.",
    });
  }
};

// ======================================
// GET MY ORDERS
// ======================================

export const getMyOrders = async (req, res) => {
  try {
    const userEmail = req.decoded.email;

    const orders = await ordersCollection
      .find({
        userEmail,
      })
      .sort({
        createdAt: -1,
      })
      .toArray();

    res.send(orders);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// GET MY SINGLE ORDER
// ======================================

export const getMyOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const userEmail = req.decoded.email;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await ordersCollection.findOne({
      _id: new ObjectId(id),

      userEmail,
    });

    if (!order) {
      return res.status(404).send({
        success: false,
        message: "Order not found.",
      });
    }

    res.send(order);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// Compatibility export
// ======================================

export const getSingleOrder = getMyOrderById;
