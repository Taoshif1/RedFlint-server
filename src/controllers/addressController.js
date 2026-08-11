import { ObjectId } from "mongodb";
import { usersCollection } from "../config/database.js";

export const getAddresses = async (req, res) => {
  try {
    const { email } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({ success: false, message: "Forbidden" });
    }

    const user = await usersCollection.findOne(
      { email },
      { projection: { addresses: 1 } },
    );

    res.send(user?.addresses || []);
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const addAddress = async (req, res) => {
  try {
    const { email } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({ success: false, message: "Forbidden" });
    }

    const user = await usersCollection.findOne(
      { email },
      { projection: { addresses: 1 } },
    );

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found.",
      });
    }

    const makeDefault = Boolean(req.body.isDefault) || !user.addresses?.length;

    const address = {
      _id: new ObjectId().toString(),
      label: req.body.label?.trim() || "Address",
      receiver: req.body.receiver?.trim() || "",
      phone: req.body.phone?.trim() || "",
      address: req.body.address?.trim() || "",
      city: req.body.city?.trim() || "",
      postalCode: req.body.postalCode?.trim() || "",
      isDefault: makeDefault,
      createdAt: new Date(),
    };

    if (makeDefault && user.addresses?.length) {
      await usersCollection.updateOne(
        { email },
        {
          $set: {
            "addresses.$[].isDefault": false,
          },
        },
      );
    }

    await usersCollection.updateOne(
      { email },
      {
        $push: { addresses: address },
        $set: { updatedAt: new Date() },
      },
    );

    res.send({
      success: true,
      message: "Address added successfully.",
      address,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { email, id } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({ success: false, message: "Forbidden" });
    }

    const user = await usersCollection.findOne(
      { email },
      { projection: { addresses: 1 } },
    );

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found.",
      });
    }

    const deletedAddress = user.addresses?.find((item) => item._id === id);

    if (!deletedAddress) {
      return res.status(404).send({
        success: false,
        message: "Address not found.",
      });
    }

    await usersCollection.updateOne(
      { email },
      {
        $pull: { addresses: { _id: id } },
        $set: { updatedAt: new Date() },
      },
    );

    if (deletedAddress.isDefault) {
      const remaining = user.addresses.filter((item) => item._id !== id);
      const nextDefault = remaining[0];

      if (nextDefault) {
        await usersCollection.updateOne(
          { email, "addresses._id": nextDefault._id },
          {
            $set: { "addresses.$.isDefault": true },
          },
        );
      }
    }

    res.send({
      success: true,
      message: "Address deleted successfully.",
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};
