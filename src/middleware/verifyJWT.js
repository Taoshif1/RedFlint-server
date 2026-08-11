import jwt from "jsonwebtoken";
import { usersCollection } from "../config/database.js";

const verifyJWT = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized Access",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const dbUser = await usersCollection.findOne(
      { email: decoded.email },
      { projection: { isBlocked: 1 } },
    );

    if (dbUser?.isBlocked) {
      return res.status(403).send({
        success: false,
        message: "This account is blocked.",
      });
    }

    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(401).send({
      success: false,
      message: "Invalid Token",
    });
  }
};

export default verifyJWT;
