import { ObjectId } from "mongodb";

import { reviewsCollection, productsCollection } from "../config/database.js";

// ======================================
// CREATE REVIEW
// ======================================

export const createReview = async (req, res) => {
  try {
    const { productId, customerName, rating, comment } = req.body;

    // ======================================
    // Validation
    // ======================================

    if (!productId?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Product ID is required.",
      });
    }

    if (!ObjectId.isValid(productId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid product ID.",
      });
    }

    if (!customerName?.trim()) {
      return res.status(400).send({
        success: false,
        message: "Your name is required.",
      });
    }

    const numericRating = Number(rating);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).send({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    const cleanComment = comment?.trim();

    if (!cleanComment || cleanComment.length < 5) {
      return res.status(400).send({
        success: false,
        message: "Please write a review.",
      });
    }

    if (cleanComment.length > 1000) {
      return res.status(400).send({
        success: false,
        message: "Review cannot exceed 1000 characters.",
      });
    }

    // ======================================
    // Find Product
    // ======================================

    const product = await productsCollection.findOne({
      _id: new ObjectId(productId),
    });

    if (!product) {
      return res.status(404).send({
        success: false,
        message: "Product not found.",
      });
    }

    // ======================================
    // Save Review
    // ======================================

    const review = {
      productId: product._id.toString(),

      productTitle: product.title || "",

      productImage: product.images?.[0] || "",

      customerName: customerName.trim(),

      rating: numericRating,

      comment: cleanComment,

      verifiedPurchase: false,

      status: "pending",

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    const result = await reviewsCollection.insertOne(review);

    res.status(201).send({
      success: true,

      insertedId: result.insertedId,

      message: "Review submitted successfully. It will appear after approval.",
    });
  } catch (error) {
    console.error("Create review error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to submit review.",
    });
  }
};

// ======================================
// GET APPROVED REVIEWS FOR PRODUCT
// ======================================

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await reviewsCollection
      .find({
        productId: String(productId),
        status: "approved",
      })
      .sort({
        createdAt: -1,
      })
      .toArray();

    const reviewCount = reviews.length;

    const averageRating =
      reviewCount > 0
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
          reviewCount
        : 0;

    const publicReviews = reviews.map((review) => ({
      _id: review._id,

      customerName: review.customerName,

      productId: review.productId,

      productTitle: review.productTitle,

      productImage: review.productImage,

      rating: review.rating,

      comment: review.comment,

      createdAt: review.createdAt,
    }));

    res.send({
      success: true,

      averageRating: Number(averageRating.toFixed(1)),

      reviewCount,

      reviews: publicReviews,
    });
  } catch (error) {
    console.error("Get product reviews error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to load reviews.",
    });
  }
};

// ======================================
// FEATURED REVIEWS FOR HOME PAGE
// ======================================

export const getFeaturedReviews = async (req, res) => {
  try {
    let limit = Number(req.query.limit) || 6;

    limit = Math.min(Math.max(limit, 1), 12);

    const reviews = await reviewsCollection
      .find({
        status: "approved",

        rating: {
          $gte: 4,
        },
      })
      .sort({
        rating: -1,
        createdAt: -1,
      })
      .limit(limit)
      .toArray();

    const publicReviews = reviews.map((review) => ({
      _id: review._id,

      customerName: review.customerName,

      productId: review.productId,

      productTitle: review.productTitle,

      productImage: review.productImage,

      rating: review.rating,

      comment: review.comment,

      createdAt: review.createdAt,
    }));

    res.send(publicReviews);
  } catch (error) {
    console.error("Featured reviews error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to load featured reviews.",
    });
  }
};

// ======================================
// ADMIN - GET ALL REVIEWS
// ======================================

export const getAllReviews = async (req, res) => {
  try {
    const reviews = await reviewsCollection
      .find()
      .sort({
        createdAt: -1,
      })
      .toArray();

    res.send(reviews);
  } catch (error) {
    console.error("Get all reviews error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to load reviews.",
    });
  }
};

// ======================================
// ADMIN - UPDATE REVIEW STATUS
// ======================================

export const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const { status } = req.body;

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid review ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).send({
        success: false,
        message: "Invalid review status.",
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "approved") {
      updateData.approvedAt = new Date();
    }

    const result = await reviewsCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: updateData,
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Review not found.",
      });
    }

    res.send({
      success: true,

      message: `Review ${status} successfully.`,

      result,
    });
  } catch (error) {
    console.error("Update review error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to update review.",
    });
  }
};

// ======================================
// ADMIN - DELETE REVIEW
// ======================================

export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid review ID.",
      });
    }

    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Review not found.",
      });
    }

    res.send({
      success: true,
      message: "Review deleted successfully.",
    });
  } catch (error) {
    console.error("Delete review error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to delete review.",
    });
  }
};
