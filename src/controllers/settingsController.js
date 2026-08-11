import { settingsCollection } from "../config/database.js";

// Get Store Settings

export const getSettings = async (req, res) => {
  try {
    let settings = await settingsCollection.findOne({
      _id: "store",
    });

    if (!settings) {
      settings = {
        _id: "store",
        storeName: "RedFlint",
        supportEmail: "support@redflint.com",
        supportPhone: "",
        whatsappNumber: "",
        messengerLink: "",
        currency: "BDT",
        shippingFee: 120,
        freeShipping: 3000,
        maintenanceMode: false,
        createdAt: new Date(),
      };

      await settingsCollection.insertOne(settings);
    }

    res.send(settings);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Update Settings
export const updateSettings = async (req, res) => {
  try {
    const settings = req.body;

    await settingsCollection.updateOne(
      {
        _id: "store",
      },
      {
        $set: {
          ...settings,
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    res.send({
      success: true,
      message: "Settings updated successfully.",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
