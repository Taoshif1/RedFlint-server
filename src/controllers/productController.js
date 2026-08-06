import { ObjectId } from "mongodb";
import { productsCollection } from "../config/database.js";

export const getProducts = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const sort = req.query.sort || "newest";

    // Prevent special characters from changing the regex search
    const safeSearch = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    let query = {};

    if (safeSearch) {
      query = {
        $or: [
          {
            title: {
              $regex: safeSearch,
              $options: "i",
            },
          },
          {
            description: {
              $regex: safeSearch,
              $options: "i",
            },
          },
          {
            category: {
              $regex: safeSearch,
              $options: "i",
            },
          },
          {
            season: {
              $regex: safeSearch,
              $options: "i",
            },
          },
        ],
      };
    }

    const sortOptions = {
      "name-asc": {
        title: 1,
        _id: 1,
      },

      "name-desc": {
        title: -1,
        _id: -1,
      },

      "price-asc": {
        offerPrice: 1,
        _id: 1,
      },

      "price-desc": {
        offerPrice: -1,
        _id: -1,
      },

      oldest: {
        createdAt: 1,
        _id: 1,
      },

      newest: {
        createdAt: -1,
        _id: -1,
      },
    };

    const selectedSort =
      sortOptions[sort] || sortOptions.newest;

    const products = await productsCollection
      .find(query)
      .sort(selectedSort)
      .toArray();

    res.status(200).send(products);
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await productsCollection.findOne({
      _id: new ObjectId(id),
    });

    res.send(product);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const product = req.body;

    product.createdAt = new Date();

    const result = await productsCollection.insertOne(product);

    res.status(201).send({
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

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedData = req.body;

    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updatedData,
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

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await productsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export const getSpecialEditionProducts = async (req, res) => {
  try {
    const products = await productsCollection
      .find({ isSpecial: true })
      .toArray();

    res.send(products);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    const products = await productsCollection
      .find({ isFeatured: true })
      .toArray();

    res.send(products);
  } catch (error) {
    console.error("Featured products error:", error);

    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
