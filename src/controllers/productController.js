import { ObjectId } from "mongodb";
import { productsCollection } from "../config/database.js";

const normalizeProductPayload = (payload = {}) => {
  const product = { ...payload };

  if (Array.isArray(product.sizes)) {
    const objectSizes = product.sizes.filter(
      (item) => item && typeof item === "object" && item.size,
    );

    if (objectSizes.length > 0) {
      product.sizes = objectSizes.map((item) => ({
        size: String(item.size).trim(),
        stock: Math.max(0, Number(item.stock) || 0),
      }));

      product.totalStock = product.sizes.reduce(
        (sum, item) => sum + item.stock,
        0,
      );
    }
  }

  if (product.price !== undefined) {
    product.price = Math.max(0, Number(product.price) || 0);
  }

  if (product.offerPrice !== undefined && product.offerPrice !== null) {
    product.offerPrice = Math.max(0, Number(product.offerPrice) || 0);
  }

  return product;
};

export const getProducts = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const sort = req.query.sort || "newest";
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let query = {};

    if (safeSearch) {
      query = {
        $or: [
          { title: { $regex: safeSearch, $options: "i" } },
          { description: { $regex: safeSearch, $options: "i" } },
          { category: { $regex: safeSearch, $options: "i" } },
          { season: { $regex: safeSearch, $options: "i" } },
        ],
      };
    }

    const sortOptions = {
      "name-asc": { title: 1, _id: 1 },
      "name-desc": { title: -1, _id: -1 },
      "price-asc": { offerPrice: 1, _id: 1 },
      "price-desc": { offerPrice: -1, _id: -1 },
      oldest: { createdAt: 1, _id: 1 },
      newest: { createdAt: -1, _id: -1 },
    };

    const products = await productsCollection
      .find(query)
      .sort(sortOptions[sort] || sortOptions.newest)
      .toArray();

    res.status(200).send(products);
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).send({ success: false, message: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await productsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!product) {
      return res.status(404).send({
        success: false,
        message: "Product not found.",
      });
    }

    res.send(product);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = normalizeProductPayload(req.body);
    const now = new Date();

    product.createdAt = now;
    product.updatedAt = now;

    const result = await productsCollection.insertOne(product);

    res.status(201).send({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const updatedData = normalizeProductPayload(req.body);
    updatedData.updatedAt = new Date();

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Product not found.",
      });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const result = await productsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const getSpecialEditionProducts = async (req, res) => {
  try {
    const products = await productsCollection.find({ isSpecial: true }).toArray();
    res.send(products);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    const products = await productsCollection.find({ isFeatured: true }).toArray();
    res.send(products);
  } catch (error) {
    console.error("Featured products error:", error);
    res.status(500).send({ success: false, message: error.message });
  }
};
