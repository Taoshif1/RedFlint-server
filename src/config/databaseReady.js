import client from "./mongodb.js";
import { ordersCollection, productsCollection } from "./database.js";

export const createDatabaseReadiness = ({
  mongoClient,
  prepareIndexes,
}) => {
  let readinessPromise;

  return () => {
    if (!readinessPromise) {
      readinessPromise = (async () => {
        await mongoClient.connect();
        await mongoClient.db("admin").command({ ping: 1 });
        await prepareIndexes();
      })().catch((error) => {
        readinessPromise = undefined;
        throw error;
      });
    }

    return readinessPromise;
  };
};

const prepareProductionIndexes = () =>
  Promise.all([
    ordersCollection.createIndex(
      { orderNumber: 1 },
      { unique: true, sparse: true },
    ),
    ordersCollection.createIndex(
      { "payment.transactionId": 1 },
      { unique: true, sparse: true },
    ),
    productsCollection.createIndex({ createdAt: -1, _id: -1 }),
    productsCollection.createIndex({
      isFeatured: 1,
      createdAt: -1,
      _id: -1,
    }),
    productsCollection.createIndex({
      isSpecial: 1,
      createdAt: -1,
      _id: -1,
    }),
  ]);

export const ensureDatabaseReady = createDatabaseReadiness({
  mongoClient: client,
  prepareIndexes: prepareProductionIndexes,
});
