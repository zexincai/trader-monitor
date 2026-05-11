export default {
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "root123",
    database: process.env.DB_NAME || "trader_monitor",
    waitForConnections: true,
    connectionLimit: 10,
  },
  server: {
    port: parseInt(process.env.SERVER_PORT || "3000", 10),
  },
};
