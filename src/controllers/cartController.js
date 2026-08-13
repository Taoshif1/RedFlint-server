import { cartsCollection } from "../config/database.js";
import { ObjectId } from "mongodb";

// Add to Cart
export const addToCart = async (req, res) => {
  try {
    const { productId, title, image, price, offerPrice, size, quantity } =
      req.body;

    const userEmail = req.decoded.email;

    const existingItem = await cartsCollection.findOne({
      userEmail,
      productId,
      size,
    });

    if (existingItem) {
      await cartsCollection.updateOne(
        {
          _id: existingItem._id,
        },
        {
          $inc: {
            quantity,
          },
        },
      );

      return res.send({
        success: true,
        message: "Cart quantity updated.",
      });
    }

    const cartItem = {
      userEmail,
      productId,
      title,
      image,
      price,
      offerPrice,
      size,
      quantity,
      createdAt: new Date(),
    };

    const result = await cartsCollection.insertOne(cartItem);

    res.status(201).send({
      success: true,
      insertedId: result.insertedId,
      message: "Added to cart.",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Get Cart
export const getCart = async (req, res) => {
  try {
    const userEmail = req.decoded.email;

    const cart = await cartsCollection
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(cart);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Update Cart Quantity
export const updateCartQuantity = async (req, res) => {
  try {
    const { id } = req.params;

    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).send({
        success: false,
        message: "Quantity must be at least 1.",
      });
    }

    const result = await cartsCollection.updateOne(
      {
        _id: new ObjectId(id),
        userEmail: req.decoded.email,
      },
      {
        $set: {
          quantity,
        },
      },
    );

    res.send({
      success: true,
      message: "Cart updated.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Remove from Cart
export const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await cartsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: req.decoded.email,
    });

    res.send({
      success: true,
      message: "Item removed.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Clear Cart
export const clearCart = async (req, res) => {
  try {
    const result = await cartsCollection.deleteMany({
      userEmail: req.decoded.email,
    });

    res.send({
      success: true,
      message: "Cart cleared.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
