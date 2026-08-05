import { usersCollection } from "../config/database.js";

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded.email;

    const user = await usersCollection.findOne({ email });

    if (!user || user.role !== "admin") {
      return res.status(403).send({
        success: false,
        message: "Forbidden Access",
      });
    }

    next();
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export default verifyAdmin;
