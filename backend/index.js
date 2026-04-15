require("dotenv").config();
const express = require("express");
const app = express();
const router = require("./routers/index");
const { startCronJobs } = require("./jobs/airQualityCron");
startCronJobs();

const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON bodies
app.use(express.json());

// Main Router: tất cả các API sẽ có prefix là /api
app.use("/api", router);

// Root endpoint: kiểm tra server hoạt động
app.get("/", (req, res) => {
  res.send("<h1>Air Quality API is running...</h1>");
});

// Lắng nghe kết nối trên port cấu hình
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
