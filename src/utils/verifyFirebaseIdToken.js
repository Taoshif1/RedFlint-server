const verifyFirebaseIdToken = async (idToken) => {
  if (!idToken) {
    throw new Error("Firebase ID token is required.");
  }

  const apiKey = process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("FIREBASE_API_KEY is not configured on the server.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok || !Array.isArray(data.users) || !data.users[0]) {
    const message =
      data?.error?.message || "Firebase authentication token is invalid.";

    throw new Error(message);
  }

  const firebaseUser = data.users[0];

  if (!firebaseUser.localId || !firebaseUser.email) {
    throw new Error("Firebase user identity is incomplete.");
  }

  return {
    uid: firebaseUser.localId,
    email: firebaseUser.email,
    emailVerified: Boolean(firebaseUser.emailVerified),
  };
};

export default verifyFirebaseIdToken;
