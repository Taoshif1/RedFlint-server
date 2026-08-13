import { settingsCollection } from "../config/database.js";
import {
  validateStoreSettings,
  withStoreDefaults,
} from "../utils/storeSettings.js";

// Get Store Settings

export const getSettings = async (req, res) => {
  try {
    let settings = await settingsCollection.findOne({
      _id: "store",
    });

    res.send(withStoreDefaults(settings || {}));
  } catch (error) {
    console.error("Get settings error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to load settings.",
    });
  }
};

// Update Settings
export const updateSettings = async (req, res) => {
  try {
    const settings = validateStoreSettings(req.body);

    await settingsCollection.updateOne(
      {
        _id: "store",
      },
      {
        $set: {
          ...settings,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    const updatedSettings = await settingsCollection.findOne({ _id: "store" });

    res.send({
      success: true,
      message: "Settings updated successfully.",
      settings: withStoreDefaults(updatedSettings || settings),
    });
  } catch (error) {
    res.status(error.name === "ValidationError" ? 400 : 500).send({
      success: false,
      message:
        error.name === "ValidationError"
          ? error.message
          : "Failed to update settings.",
    });
  }
};
