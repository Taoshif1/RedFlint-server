import { ordersCollection, cartsCollection } from "../config/database.js";

// Create Order

export const createOrder = async (req, res) => {
  try {
    const userEmail = req.decoded.email;

    const order = req.body;

    order.userEmail = userEmail;

    order.payment = {
      method: "bkash",
      transactionId: order.transactionId,
      status: "Pending",
    };

    order.orderStatus = "Pending";

    order.createdAt = new Date();

    delete order.transactionId;

    const result = await ordersCollection.insertOne(order);

    // Clear user's cart after successful order
    await cartsCollection.deleteMany({
      userEmail,
    });

    res.status(201).send({
      success: true,
      insertedId: result.insertedId,
      message: "Order placed successfully.",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Get My Orders

export const getMyOrders = async (req, res) => {
  try {
    const userEmail = req.decoded.email;

    const orders = await ordersCollection
      .find({ userEmail })
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

// Get All Orders (Admin)

export const getAllOrders = async (req, res) => {
  try {
    const orders = await ordersCollection
      .find()
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

// Payment Verification

import { ObjectId } from "mongodb";

export const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const { status } = req.body;

    const result = await ordersCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          "payment.status": status,
        },
      },
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Order Status Update

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { status } = req.body;

    const result = await ordersCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          orderStatus: status,
        },
      },
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
