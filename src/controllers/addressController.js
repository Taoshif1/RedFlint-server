import { ObjectId } from "mongodb";
import { usersCollection } from "../config/database.js";

// Get Addresses
export const getAddresses = async (req, res) => {
  try {
    const { email } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    const user = await usersCollection.findOne(
      { email },
      {
        projection: {
          addresses: 1,
        },
      },
    );

    res.send(user?.addresses || []);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Add Address
export const addAddress = async (req, res) => {
  try {
    const { email } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    const address = {
      _id: new ObjectId().toString(),
      ...req.body,
      createdAt: new Date(),
    };

    // if (address.isDefault) {
    //   await usersCollection.updateOne(
    //     { email },
    //     {
    //       $set: {
    //         "addresses.$[].isDefault": false,
    //       },
    //     },
    //   );
    // }

    await usersCollection.updateOne(
      { email },
      {
        $push: {
          addresses: address,
        },
      },
    );

    res.send({
      success: true,
      message: "Address Added",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Delete Address
export const deleteAddress = async (req, res) => {
  try {
    const { email, id } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    await usersCollection.updateOne(
      { email },
      {
        $pull: {
          addresses: {
            _id: id,
          },
        },
      },
    );

    res.send({
      success: true,
      message: "Address Deleted",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
