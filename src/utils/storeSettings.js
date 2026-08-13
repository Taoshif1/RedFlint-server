const PAYMENT_METHOD_KEYS = ["bkash", "nagad", "cod"];

export const DEFAULT_PAYMENT_METHODS = {
  bkash: {
    enabled: false,
    label: "bKash",
    accountNumber: "",
    accountType: "Personal",
    instructions:
      "Send the full order amount, then enter the bKash transaction ID.",
    requiresTransactionId: true,
  },
  nagad: {
    enabled: false,
    label: "Nagad",
    accountNumber: "",
    accountType: "Personal",
    instructions:
      "Send the full order amount, then enter the Nagad transaction ID.",
    requiresTransactionId: true,
  },
  cod: {
    enabled: true,
    label: "Cash on Delivery",
    accountNumber: "",
    accountType: "",
    instructions: "Pay in cash when your order is delivered.",
    requiresTransactionId: false,
  },
};

export const DEFAULT_STORE_SETTINGS = {
  _id: "store",
  storeName: "RedFlint",
  supportEmail: "support@redflint.com",
  supportPhone: "",
  whatsappNumber: "",
  messengerLink: "",
  currency: "BDT",
  shippingFee: 120,
  freeShipping: 3000,
  maintenanceMode: false,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
};

const cleanString = (value, field, maxLength, { required = false } = {}) => {
  if (value === undefined || value === null) {
    if (required) throw createValidationError(`${field} is required.`);
    return "";
  }

  if (typeof value !== "string") {
    throw createValidationError(`${field} must be text.`);
  }

  const cleaned = value.trim();

  if (required && !cleaned) {
    throw createValidationError(`${field} is required.`);
  }

  if (cleaned.length > maxLength) {
    throw createValidationError(`${field} is too long.`);
  }

  return cleaned;
};

const cleanAmount = (value, field) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    throw createValidationError(`${field} must be a valid non-negative amount.`);
  }

  return amount;
};

export const getPaymentMethods = (settings = {}) =>
  Object.fromEntries(
    PAYMENT_METHOD_KEYS.map((key) => {
      const defaults = DEFAULT_PAYMENT_METHODS[key];
      const stored = settings.paymentMethods?.[key];
      const method =
        stored && typeof stored === "object" && !Array.isArray(stored)
          ? stored
          : {};

      return [
        key,
        {
          enabled:
            typeof method.enabled === "boolean"
              ? method.enabled
              : defaults.enabled,
          label: defaults.label,
          accountNumber:
            typeof method.accountNumber === "string"
              ? method.accountNumber
              : defaults.accountNumber,
          accountType:
            typeof method.accountType === "string"
              ? method.accountType
              : defaults.accountType,
          instructions:
            typeof method.instructions === "string"
              ? method.instructions
              : defaults.instructions,
          requiresTransactionId: defaults.requiresTransactionId,
        },
      ];
    }),
  );

const storedStringOrDefault = (value, fallback) =>
  typeof value === "string" ? value : fallback;

const storedAmountOrDefault = (value, fallback) => {
  const amount = Number(value);

  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000
    ? amount
    : fallback;
};

export const withStoreDefaults = (settings = {}) => ({
  _id: "store",
  storeName: storedStringOrDefault(
    settings.storeName,
    DEFAULT_STORE_SETTINGS.storeName,
  ),
  supportEmail: storedStringOrDefault(
    settings.supportEmail,
    DEFAULT_STORE_SETTINGS.supportEmail,
  ),
  supportPhone: storedStringOrDefault(
    settings.supportPhone,
    DEFAULT_STORE_SETTINGS.supportPhone,
  ),
  whatsappNumber: storedStringOrDefault(
    settings.whatsappNumber,
    DEFAULT_STORE_SETTINGS.whatsappNumber,
  ),
  messengerLink: storedStringOrDefault(
    settings.messengerLink,
    DEFAULT_STORE_SETTINGS.messengerLink,
  ),
  currency: "BDT",
  shippingFee: storedAmountOrDefault(
    settings.shippingFee,
    DEFAULT_STORE_SETTINGS.shippingFee,
  ),
  freeShipping: storedAmountOrDefault(
    settings.freeShipping,
    DEFAULT_STORE_SETTINGS.freeShipping,
  ),
  maintenanceMode: settings.maintenanceMode === true,
  paymentMethods: getPaymentMethods(settings),
});

const cleanPaymentMethods = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createValidationError("Payment methods are required.");
  }

  const unsupported = Object.keys(value).filter(
    (key) => !PAYMENT_METHOD_KEYS.includes(key),
  );

  if (unsupported.length) {
    throw createValidationError("Unsupported payment method.");
  }

  const methods = Object.fromEntries(
    PAYMENT_METHOD_KEYS.map((key) => {
      const method = value[key] || {};
      const defaults = DEFAULT_PAYMENT_METHODS[key];

      if (typeof method !== "object" || Array.isArray(method)) {
        throw createValidationError(`Invalid ${defaults.label} settings.`);
      }

      const enabled =
        method.enabled === undefined ? defaults.enabled : method.enabled;

      if (typeof enabled !== "boolean") {
        throw createValidationError(
          `${defaults.label} enabled status must be true or false.`,
        );
      }

      const cleaned = {
        enabled,
        label: defaults.label,
        accountNumber:
          key === "cod"
            ? ""
            : cleanString(
                method.accountNumber ?? defaults.accountNumber,
                `${defaults.label} account number`,
                30,
              ),
        accountType:
          key === "cod"
            ? ""
            : cleanString(
                method.accountType ?? defaults.accountType,
                `${defaults.label} account type`,
                30,
              ),
        instructions: cleanString(
          method.instructions ?? defaults.instructions,
          `${defaults.label} instructions`,
          240,
          { required: true },
        ),
        requiresTransactionId: defaults.requiresTransactionId,
      };

      if (enabled && key !== "cod" && !cleaned.accountNumber) {
        throw createValidationError(
          `${defaults.label} account number is required while the method is enabled.`,
        );
      }

      return [key, cleaned];
    }),
  );

  if (!Object.values(methods).some((method) => method.enabled)) {
    throw createValidationError("At least one payment method must be enabled.");
  }

  return methods;
};

export const validateStoreSettings = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createValidationError("Invalid settings payload.");
  }

  const allowedFields = [
    "storeName",
    "supportEmail",
    "supportPhone",
    "whatsappNumber",
    "messengerLink",
    "currency",
    "shippingFee",
    "freeShipping",
    "maintenanceMode",
    "paymentMethods",
  ];
  const unsupported = Object.keys(value).filter(
    (key) => !allowedFields.includes(key),
  );

  if (unsupported.length) {
    throw createValidationError(`Unsupported settings field: ${unsupported[0]}.`);
  }

  const supportEmail = cleanString(
    value.supportEmail,
    "Support email",
    254,
    { required: true },
  ).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    throw createValidationError("Support email is invalid.");
  }

  const messengerLink = cleanString(
    value.messengerLink,
    "Messenger link",
    300,
  );

  if (messengerLink) {
    let parsedUrl;

    try {
      parsedUrl = new URL(messengerLink);
    } catch {
      throw createValidationError("Messenger link is invalid.");
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw createValidationError("Messenger link must use HTTP or HTTPS.");
    }
  }

  if (value.maintenanceMode !== true && value.maintenanceMode !== false) {
    throw createValidationError("Maintenance mode must be true or false.");
  }

  if (value.currency && value.currency !== "BDT") {
    throw createValidationError("RedFlint currently supports BDT only.");
  }

  return {
    storeName: cleanString(value.storeName, "Store name", 100, {
      required: true,
    }),
    supportEmail,
    supportPhone: cleanString(value.supportPhone, "Support phone", 30),
    whatsappNumber: cleanString(
      value.whatsappNumber,
      "WhatsApp number",
      30,
    ),
    messengerLink,
    currency: "BDT",
    shippingFee: cleanAmount(value.shippingFee, "Shipping fee"),
    freeShipping: cleanAmount(value.freeShipping, "Free-shipping threshold"),
    maintenanceMode: value.maintenanceMode,
    paymentMethods: cleanPaymentMethods(value.paymentMethods),
  };
};
