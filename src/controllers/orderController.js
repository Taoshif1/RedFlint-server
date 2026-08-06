import { ordersCollection, cartsCollection } from "../config/database.js";
import { ObjectId } from "mongodb";

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


// get single order by id

export const getSingleOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const userEmail = req.decoded.email;

    const order = await ordersCollection.findOne({
      _id: new ObjectId(id),
      userEmail,
    });

    if (!order) {
      return res.status(404).send({
        message: "Order not found",
      });
    }

    res.send(order);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
};

// import { ObjectId } from "mongodb";

export const getMyOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.decoded.email;

    const order = await ordersCollection.findOne({
      _id: new ObjectId(id),
      userEmail,
    });

    if (!order) {
      return res.status(404).send({
        success: false,
        message: "Order not found",
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
