import { ObjectId } from "mongodb";
import { ordersCollection, usersCollection } from "../config/database.js";

// Get All Orders

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

// Get Single Order

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await ordersCollection.findOne({
      _id: new ObjectId(id),
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

// Update Order Status

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
          updatedAt: new Date(),
        },
      },
    );

    res.send({
      success: true,
      message: "Order updated successfully.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Update Payment Status

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
          updatedAt: new Date(),
        },
      },
    );

    res.send({
      success: true,
      message: "Payment updated successfully.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Get All Users

export const getAllUsers = async (req, res) => {
  try {
    const users = await usersCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.send(users);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Update User Role

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const targetUser = await usersCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!targetUser) {
      return res.status(404).send({
        success: false,
        message: "User not found.",
      });
    }

    if (!["admin", "customer"].includes(role)) {
      return res.status(400).send({
        success: false,
        message: "Invalid role.",
      });
    }

    if (req.decoded.email === targetUser.email && role === "customer") {
      return res.status(400).send({
        success: false,
        message: "You cannot remove your own admin role.",
      });
    }

    const result = await usersCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      },
    );

    res.send({
      success: true,
      message: "Role updated successfully.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Block / Unblock User

export const toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    const targetUser = await usersCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!targetUser) {
      return res.status(404).send({
        success: false,
        message: "User not found.",
      });
    }

    if (req.decoded.email === targetUser.email && isBlocked) {
      return res.status(400).send({
        success: false,
        message: "You cannot block your own account.",
      });
    }

    const result = await usersCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          isBlocked,
          updatedAt: new Date(),
        },
      },
    );

    res.send({
      success: true,
      message: isBlocked
        ? "User blocked successfully."
        : "User unblocked successfully.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const { name, photoURL } = req.body;

    if (!name?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Name is required.",
      });
    }

    const result = await usersCollection.updateOne(
      {
        email: req.decoded.email,
        role: "admin",
      },
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

    res.send({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("Update admin profile error:", error);

    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
