import { ObjectId } from "mongodb";
import client from "../config/mongodb.js";
import {
  ordersCollection,
  usersCollection,
  productsCollection,
} from "../config/database.js";

const isValidId = (id) => ObjectId.isValid(id);

export const getAllOrders = async (req, res) => {
  try {
    const orders = await ordersCollection.find().sort({ createdAt: -1 }).toArray();
    res.send(orders);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).send({ success: false, message: "Invalid order ID." });
    }

    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

    if (!order) {
      return res.status(404).send({ success: false, message: "Order not found." });
    }

    res.send(order);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

const restoreOrderInventory = async (order, session) => {
  for (const item of order.products || []) {
    if (!ObjectId.isValid(item.productId)) continue;

    const productId = new ObjectId(item.productId);
    const quantity = Number(item.quantity) || 0;

    if (quantity < 1) continue;

    const product = await productsCollection.findOne(
      { _id: productId },
      { session, projection: { sizes: 1, totalStock: 1 } },
    );

    if (!product) continue;

    const hasObjectSizes =
      Array.isArray(product.sizes) &&
      product.sizes.some((sizeItem) => sizeItem && typeof sizeItem === "object");

    if (hasObjectSizes && item.size) {
      const increment = { "sizes.$[selectedSize].stock": quantity };

      if (Number.isFinite(Number(product.totalStock))) {
        increment.totalStock = quantity;
      }

      await productsCollection.updateOne(
        { _id: productId, "sizes.size": item.size },
        {
          $inc: increment,
          $set: { updatedAt: new Date() },
        },
        {
          session,
          arrayFilters: [{ "selectedSize.size": item.size }],
        },
      );
    } else if (Number.isFinite(Number(product.totalStock))) {
      await productsCollection.updateOne(
        { _id: productId },
        {
          $inc: { totalStock: quantity },
          $set: { updatedAt: new Date() },
        },
        { session },
      );
    }
  }
};

export const updateOrderStatus = async (req, res) => {
  const session = client.startSession();

  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    if (!isValidId(id)) {
      return res.status(400).send({ success: false, message: "Invalid order ID." });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).send({ success: false, message: "Invalid order status." });
    }

    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await ordersCollection.findOne(
        { _id: new ObjectId(id) },
        { session },
      );

      if (!order) {
        throw new Error("Order not found.");
      }

      if (order.orderStatus === "Cancelled" && status !== "Cancelled") {
        throw new Error("A cancelled order cannot be reopened. Create a new order instead.");
      }

      if (status === "Cancelled" && order.orderStatus === "Delivered") {
        throw new Error("A delivered order cannot be cancelled from order management.");
      }

      if (
        status === "Cancelled" &&
        order.orderStatus !== "Cancelled" &&
        !order.inventoryReleased
      ) {
        await restoreOrderInventory(order, session);
      }

      const update = {
        orderStatus: status,
        updatedAt: new Date(),
      };

      if (status === "Cancelled") {
        update.inventoryReleased = true;
        update.cancelledAt = order.cancelledAt || new Date();
      }

      await ordersCollection.updateOne(
        { _id: order._id },
        { $set: update },
        { session },
      );

      updatedOrder = { ...order, ...update };
    });

    res.send({
      success: true,
      message:
        status === "Cancelled"
          ? "Order cancelled and reserved stock restored."
          : "Order status updated successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(error.message === "Order not found." ? 404 : 400).send({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidId(id)) {
      return res.status(400).send({ success: false, message: "Invalid order ID." });
    }

    if (!["Due", "Pending", "Verified"].includes(status)) {
      return res.status(400).send({ success: false, message: "Invalid payment status." });
    }

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          "payment.status": status,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: "Order not found." });
    }

    res.send({
      success: true,
      message: "Payment updated successfully.",
      result,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await usersCollection.find().sort({ createdAt: -1 }).toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isValidId(id)) {
      return res.status(400).send({ success: false, message: "Invalid user ID." });
    }

    if (!["admin", "customer"].includes(role)) {
      return res.status(400).send({ success: false, message: "Invalid role." });
    }

    const targetUser = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!targetUser) {
      return res.status(404).send({ success: false, message: "User not found." });
    }

    if (req.decoded.email === targetUser.email && role === "customer") {
      return res.status(400).send({
        success: false,
        message: "You cannot remove your own admin role.",
      });
    }

    const result = await usersCollection.updateOne(
      { _id: targetUser._id },
      { $set: { role, updatedAt: new Date() } },
    );

    res.send({ success: true, message: "Role updated successfully.", result });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    if (!isValidId(id)) {
      return res.status(400).send({ success: false, message: "Invalid user ID." });
    }

    if (typeof isBlocked !== "boolean") {
      return res.status(400).send({ success: false, message: "Invalid block status." });
    }

    const targetUser = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!targetUser) {
      return res.status(404).send({ success: false, message: "User not found." });
    }

    if (req.decoded.email === targetUser.email && isBlocked) {
      return res.status(400).send({
        success: false,
        message: "You cannot block your own account.",
      });
    }

    const result = await usersCollection.updateOne(
      { _id: targetUser._id },
      { $set: { isBlocked, updatedAt: new Date() } },
    );

    res.send({
      success: true,
      message: isBlocked ? "User blocked successfully." : "User unblocked successfully.",
      result,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const { name, photoURL } = req.body;

    if (!name?.trim()) {
      return res.status(400).send({ success: false, message: "Name is required." });
    }

    const result = await usersCollection.updateOne(
      { email: req.decoded.email, role: "admin" },
      {
        $set: {
          name: name.trim(),
          photoURL: photoURL || "",
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Admin account not found.",
      });
    }

    res.send({ success: true, message: "Profile updated successfully." });
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).send({ success: false, message: error.message });
  }
};
