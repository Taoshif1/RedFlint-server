// Add To Wishlist

import { wishlistCollection } from "../config/database.js";

export const addToWishlist = async (req, res) => {
  try {
    const userEmail = req.decoded.email;

    const { productId, title, image, price } = req.body;

    const exists = await wishlistCollection.findOne({
      userEmail,
      productId,
    });

    if (exists) {
      return res.send({
        success: true,
        message: "Already in wishlist.",
      });
    }

    const result = await wishlistCollection.insertOne({
      userEmail,
      productId,
      title,
      image,
      price,
      createdAt: new Date(),
    });

    res.send({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Get Wishlist

export const getWishlist = async (req, res) => {
  try {
    const userEmail = req.decoded.email;

    const wishlist = await wishlistCollection
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(wishlist);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Delete Wishlist Item

import { ObjectId } from "mongodb";

export const removeWishlist = async (req, res) => {
  try {
    const result = await wishlistCollection.deleteOne({
      _id: new ObjectId(req.params.id),
      userEmail: req.decoded.email,
    });

    res.send({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
