import generateToken from "../utils/generateToken.js";

export const createJWT = async (req, res) => {
  try {
    const { email, uid } = req.body;

    const token = generateToken({
      email,
      uid,
    });

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      })
      .status(200)
      .send({
        success: true,
        message: "JWT Created Successfully",
      });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

export const logout = (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    })
    .status(200)
    .send({
      success: true,
      message: "Logged Out Successfully",
    });
};
