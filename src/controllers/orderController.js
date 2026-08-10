import { ObjectId } from "mongodb";

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

    const order = {
      customerType: "registered",

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

    const order = {
      customerType: "guest",

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
