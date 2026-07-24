import jwt from "jsonwebtoken";

const verifyJWT = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({
      success: false,
      message: "Unauthorized Access",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({
        success: false,
        message: "Invalid Token",
      });
    }

    req.decoded = decoded;

    next();
  });
};

export default verifyJWT;
