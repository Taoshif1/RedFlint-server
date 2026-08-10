import client from "./mongodb.js";

const database = client.db("redflintdb");

export const usersCollection = database.collection("users");
export const productsCollection = database.collection("products");
export const cartsCollection = database.collection("carts");
export const ordersCollection = database.collection("orders");
export const wishlistCollection = database.collection("wishlist");
export const settingsCollection = database.collection("settings");
export const reviewsCollection = database.collection("reviews");
