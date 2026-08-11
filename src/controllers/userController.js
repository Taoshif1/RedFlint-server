import { usersCollection } from "../config/database.js";

// Create User
export const createUser = async (req, res) => {
  try {
    const { name = "", phone = "", photoURL = "" } = req.body;
    const email = req.decoded.email;
    const uid = req.decoded.uid;

    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      return res.status(200).send({
        success: true,
        message: "User already exists.",
        user: existingUser,
      });
    }

    const user = {
      uid,
      email,
      name: name.trim() || email.split("@")[0],
      phone: phone.trim() || "Not Provided",
      photoURL: photoURL || "",
      role: "customer",
      isBlocked: false,
      addresses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: new Date(),
    };

    const result = await usersCollection.insertOne(user);

    res.status(201).send({
      success: true,
      message: "User created successfully.",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Get User By Email
export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    const user = await usersCollection.findOne({ email });

    res.send(user);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// Update User Profile
export const updateUser = async (req, res) => {
  try {
    const { email } = req.params;
    const { name, phone, photoURL } = req.body;

    if (req.decoded.email !== email) {
      return res.status(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    const updatedData = {
      ...(name?.trim() && { name: name.trim() }),
      ...(phone?.trim() && { phone: phone.trim() }),
      ...(typeof photoURL === "string" && { photoURL }),
      updatedAt: new Date(),
    };

    const result = await usersCollection.updateOne(
      { email },
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

// Update Last Login
export const updateLastLogin = async (req, res) => {
  try {
    const { email } = req.params;

    if (req.decoded.email !== email) {
      return res.status(403).send({
        success: false,
        message: "Forbidden",
      });
    }

    const result = await usersCollection.updateOne(
      { email },
      {
        $set: {
          lastLogin: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    res.send({
      success: true,
      message: "Last login updated.",
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
