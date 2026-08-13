import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";

import client from "../config/mongodb.js";
import {
  ordersCollection,
  cartsCollection,
  productsCollection,
  settingsCollection,
} from "../config/database.js";
import { getPaymentMethods, withStoreDefaults } from "../utils/storeSettings.js";

const MAX_ORDER_ITEMS = 50;
const MAX_ITEM_QUANTITY = 99;

const normalizePhone = (phone = "") => phone.replace(/[\s-]/g, "").trim();

const validatePaymentMethod = (paymentMethod, settings) => {
  const method = paymentMethod?.trim().toLowerCase();
  const paymentMethods = getPaymentMethods(settings);

  if (!paymentMethods[method]?.enabled) {
    throw new Error("This payment method is not available.");
  }

  return method;
};

const assertStoreOperational = async (session) => {
  const settings = await settingsCollection.findOne(
    { _id: "store" },
    { session },
  );

  if (settings?.maintenanceMode) {
    throw new Error(
      "RedFlint is currently under maintenance. Ordering is temporarily unavailable.",
    );
  }

  return withStoreDefaults(settings || {});
};

const validateTransactionId = async (transactionId, paymentMethod, session) => {
  if (paymentMethod === "cod") return undefined;

  const cleanTransactionId = transactionId?.trim();

  if (!cleanTransactionId) {
    throw new Error("Transaction ID is required.");
  }

  if (
    cleanTransactionId.length < 4 ||
    cleanTransactionId.length > 64 ||
    !/^[A-Za-z0-9_-]+$/.test(cleanTransactionId)
  ) {
    throw new Error("Transaction ID format is invalid.");
  }

  const existingOrder = await ordersCollection.findOne(
    { "payment.transactionId": cleanTransactionId },
    { session },
  );

  if (existingOrder) {
    throw new Error("This transaction ID has already been used.");
  }

  return cleanTransactionId;
};

const generateOrderNumber = async (session) => {
  while (true) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomPart = randomBytes(4).toString("hex").toUpperCase();
    const orderNumber = `RF-${datePart}-${randomPart}`;

    const exists = await ordersCollection.findOne(
      { orderNumber },
      { session },
    );

    if (!exists) return orderNumber;
  }
};

const prepareOrderProducts = async (items = [], session) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No products provided.");
  }

  if (items.length > MAX_ORDER_ITEMS) {
    throw new Error(`An order cannot contain more than ${MAX_ORDER_ITEMS} items.`);
  }

  const preparedProducts = [];

  for (const item of items) {
    const productId = item.productId;
    const quantity = Number(item.quantity);

    if (!productId || !ObjectId.isValid(productId)) {
      throw new Error("Invalid product ID.");
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ITEM_QUANTITY
    ) {
      throw new Error("Invalid product quantity.");
    }

    const product = await productsCollection.findOne(
      { _id: new ObjectId(productId) },
      { session },
    );

    if (!product) {
      throw new Error("One or more products no longer exist.");
    }

    const selectedSizeName = item.size || "";
    const objectSizes = Array.isArray(product.sizes)
      ? product.sizes.filter(
          (sizeItem) => sizeItem && typeof sizeItem === "object",
        )
      : [];
    const legacySizes = Array.isArray(product.sizes)
      ? product.sizes.filter((sizeItem) => typeof sizeItem === "string")
      : [];

    let inventoryMode = "total";
    let availableStock = Number(product.totalStock);

    if (objectSizes.length > 0) {
      const selectedSize = objectSizes.find(
        (sizeItem) => sizeItem.size === selectedSizeName,
      );

      if (!selectedSize) {
        throw new Error(`Selected size is unavailable for ${product.title}.`);
      }

      inventoryMode = "size";
      availableStock = Number(selectedSize.stock);
    } else if (legacySizes.length > 0) {
      if (!legacySizes.includes(selectedSizeName)) {
        throw new Error(`Selected size is unavailable for ${product.title}.`);
      }

      inventoryMode = "legacy";
    }

    if (!Number.isFinite(availableStock)) {
      throw new Error(`Stock is not configured correctly for ${product.title}.`);
    }

    if (quantity > availableStock) {
      throw new Error(
        `Only ${Math.max(availableStock, 0)} item(s) available for ${product.title}${selectedSizeName ? ` - ${selectedSizeName}` : ""}.`,
      );
    }

    const regularPrice = Number(product.price || 0);
    const sellingPrice =
      product.offerPrice !== undefined && product.offerPrice !== null
        ? Number(product.offerPrice)
        : regularPrice;

    if (
      !Number.isFinite(regularPrice) ||
      regularPrice < 0 ||
      !Number.isFinite(sellingPrice) ||
      sellingPrice < 0
    ) {
      throw new Error(`Price is not configured correctly for ${product.title}.`);
    }

    preparedProducts.push({
      productId: product._id.toString(),
      title: product.title,
      image: product.images?.[0] || "",
      size: selectedSizeName,
      quantity,
      price: regularPrice,
      offerPrice: product.offerPrice ?? null,
      unitPrice: sellingPrice,
      lineTotal: sellingPrice * quantity,
      _inventoryMode: inventoryMode,
      _hasTotalStock: Number.isFinite(Number(product.totalStock)),
    });
  }

  return preparedProducts;
};

const reserveInventory = async (preparedProducts, session) => {
  for (const item of preparedProducts) {
    const productId = new ObjectId(item.productId);
    const quantity = item.quantity;

    let result;

    if (item._inventoryMode === "size") {
      const increment = {
        "sizes.$[selectedSize].stock": -quantity,
      };

      if (item._hasTotalStock) {
        increment.totalStock = -quantity;
      }

      result = await productsCollection.updateOne(
        {
          _id: productId,
          sizes: {
            $elemMatch: {
              size: item.size,
              stock: { $gte: quantity },
            },
          },
        },
        {
          $inc: increment,
          $set: { updatedAt: new Date() },
        },
        {
          session,
          arrayFilters: [
            {
              "selectedSize.size": item.size,
              "selectedSize.stock": { $gte: quantity },
            },
          ],
        },
      );
    } else {
      result = await productsCollection.updateOne(
        {
          _id: productId,
          totalStock: { $gte: quantity },
          ...(item._inventoryMode === "legacy" ? { sizes: item.size } : {}),
        },
        {
          $inc: { totalStock: -quantity },
          $set: { updatedAt: new Date() },
        },
        { session },
      );
    }

    if (result.matchedCount === 0) {
      throw new Error(
        `Sorry, ${item.title}${item.size ? ` - ${item.size}` : ""} just sold out or no longer has enough stock. Please refresh and try again.`,
      );
    }
  }
};

const cleanProductsForOrder = (products) =>
  products.map(({ _inventoryMode, _hasTotalStock, ...product }) => product);

const calculateOrderTotals = (products, settings) => {
  const subtotal = products.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = Number(settings?.shippingFee ?? 120);
  const freeShipping = Number(settings?.freeShipping ?? 3000);

  let shipping = shippingFee;

  if (subtotal <= 0) {
    shipping = 0;
  } else if (freeShipping > 0 && subtotal >= freeShipping) {
    shipping = 0;
  }

  return {
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
};

const validateCustomerFields = ({
  customerName,
  phone,
  address,
  city = "",
  postalCode = "",
  email = "",
}) => {
  const cleanName = customerName?.trim();
  const cleanPhone = normalizePhone(phone);
  const cleanAddress = address?.trim();
  const cleanCity = city?.trim();
  const cleanPostalCode = postalCode?.trim();
  const cleanEmail = email?.trim();

  if (!cleanName) throw new Error("Customer name is required.");
  if (cleanName.length > 100) throw new Error("Customer name is too long.");
  if (!cleanPhone) throw new Error("Phone number is required.");
  if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
    throw new Error("Enter a valid Bangladesh phone number.");
  }
  if (!cleanAddress) throw new Error("Delivery address is required.");
  if (cleanAddress.length > 500) {
    throw new Error("Delivery address is too long.");
  }
  if (cleanCity.length > 100) throw new Error("City is too long.");
  if (cleanPostalCode.length > 20) throw new Error("Postal code is too long.");
  if (
    cleanEmail &&
    (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
  ) {
    throw new Error("Email address is invalid.");
  }
};

const buildPayment = (method, transactionId) => ({
  method,
  status: method === "cod" ? "Due" : "Pending",
  ...(transactionId ? { transactionId } : {}),
});

const formatOrderError = (error) => {
  if (error?.code === 11000) {
    if (error?.keyPattern?.["payment.transactionId"]) {
      return "This transaction ID has already been used.";
    }

    if (error?.keyPattern?.orderNumber) {
      return "Could not generate a unique order number. Please try again.";
    }
  }

  return error.message || "Failed to place order.";
};

export const createOrder = async (req, res) => {
  const session = client.startSession();

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

    validateCustomerFields({
      customerName,
      phone,
      address,
      city,
      postalCode,
    });

    const isBuyNow =
      Array.isArray(requestedProducts) && requestedProducts.length > 0;

    let insertedId;
    let orderNumber;

    await session.withTransaction(async () => {
      const settings = await assertStoreOperational(session);

      const sourceItems = isBuyNow
        ? requestedProducts
        : await cartsCollection.find({ userEmail }, { session }).toArray();

      if (!sourceItems.length) {
        throw new Error("Your cart is empty.");
      }

      const preparedProducts = await prepareOrderProducts(sourceItems, session);
      const totals = calculateOrderTotals(preparedProducts, settings);
      const cleanPaymentMethod = validatePaymentMethod(paymentMethod, settings);
      const cleanTransactionId = await validateTransactionId(
        transactionId,
        cleanPaymentMethod,
        session,
      );

      orderNumber = await generateOrderNumber(session);

      await reserveInventory(preparedProducts, session);

      const products = cleanProductsForOrder(preparedProducts);
      const now = new Date();

      const order = {
        orderNumber,
        customerType: "registered",
        orderSource: isBuyNow ? "buy_now" : "cart",
        customerName: customerName.trim(),
        phone: normalizePhone(phone),
        email: userEmail,
        userEmail,
        address: address.trim(),
        city: city?.trim() || "",
        postalCode: postalCode?.trim() || "",
        products,
        ...totals,
        payment: buildPayment(cleanPaymentMethod, cleanTransactionId),
        orderStatus: "Pending",
        createdAt: now,
        updatedAt: now,
      };

      const result = await ordersCollection.insertOne(order, { session });
      insertedId = result.insertedId;

      if (!isBuyNow) {
        await cartsCollection.deleteMany({ userEmail }, { session });
      }
    });

    res.status(201).send({
      success: true,
      insertedId,
      orderNumber,
      message: "Order placed successfully.",
    });
  } catch (error) {
    console.error("Create registered order error:", error);

    res.status(400).send({
      success: false,
      message: formatOrderError(error),
    });
  } finally {
    await session.endSession();
  }
};

export const createGuestOrder = async (req, res) => {
  const session = client.startSession();

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

    validateCustomerFields({
      customerName,
      phone,
      address,
      city,
      postalCode,
      email,
    });

    if (!Array.isArray(requestedProducts) || requestedProducts.length === 0) {
      throw new Error("No products selected.");
    }

    let insertedId;
    let orderNumber;

    await session.withTransaction(async () => {
      const settings = await assertStoreOperational(session);
      const preparedProducts = await prepareOrderProducts(
        requestedProducts,
        session,
      );
      const totals = calculateOrderTotals(preparedProducts, settings);
      const cleanPaymentMethod = validatePaymentMethod(paymentMethod, settings);
      const cleanTransactionId = await validateTransactionId(
        transactionId,
        cleanPaymentMethod,
        session,
      );

      orderNumber = await generateOrderNumber(session);

      await reserveInventory(preparedProducts, session);

      const products = cleanProductsForOrder(preparedProducts);
      const now = new Date();

      const order = {
        orderNumber,
        customerType: "guest",
        orderSource: orderSource === "buy_now" ? "buy_now" : "cart",
        customerName: customerName.trim(),
        phone: normalizePhone(phone),
        email: email?.trim() || "",
        userEmail: null,
        address: address.trim(),
        city: city?.trim() || "",
        postalCode: postalCode?.trim() || "",
        products,
        ...totals,
        payment: buildPayment(cleanPaymentMethod, cleanTransactionId),
        orderStatus: "Pending",
        createdAt: now,
        updatedAt: now,
      };

      const result = await ordersCollection.insertOne(order, { session });
      insertedId = result.insertedId;
    });

    res.status(201).send({
      success: true,
      insertedId,
      orderNumber,
      message: "Guest order placed successfully.",
    });
  } catch (error) {
    console.error("Create guest order error:", error);

    res.status(400).send({
      success: false,
      message: formatOrderError(error),
    });
  } finally {
    await session.endSession();
  }
};

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
    const query = { phone: cleanPhone };

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

export const getMyOrders = async (req, res) => {
  try {
    const orders = await ordersCollection
      .find({ userEmail: req.decoded.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(orders);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export const getMyOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid order ID.",
      });
    }

    const order = await ordersCollection.findOne({
      _id: new ObjectId(id),
      userEmail: req.decoded.email,
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

export const getSingleOrder = getMyOrderById;
