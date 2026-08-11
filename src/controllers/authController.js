import generateToken from "../utils/generateToken.js";
import verifyFirebaseIdToken from "../utils/verifyFirebaseIdToken.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

export const createJWT = async (req, res) => {
  try {
    const { idToken } = req.body;

    const firebaseUser = await verifyFirebaseIdToken(idToken);

    const token = generateToken({
      email: firebaseUser.email,
      uid: firebaseUser.uid,
    });

    res.cookie("token", token, cookieOptions).status(200).send({
      success: true,
      message: "Authenticated session created successfully.",
      user: {
        email: firebaseUser.email,
        uid: firebaseUser.uid,
      },
    });
  } catch (error) {
    console.error("JWT creation error:", error.message);

    res.status(401).send({
      success: false,
      message: "Unable to verify Firebase authentication.",
    });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token", cookieOptions).status(200).send({
    success: true,
    message: "Logged Out Successfully",
  });
};
