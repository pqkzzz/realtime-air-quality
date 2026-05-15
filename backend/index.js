require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const router = require("./routers/index");

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/api", router);

app.get("/", (req, res) => {
  res.send("<h1>Air Quality API is running...</h1>");
});

// --- SOCKET.IO SETUP ---
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Cho phép tất cả các nguồn (cần thiết cho dev)
  },
});

// Lưu instance io vào app để có thể sử dụng ở các file khác (controllers, jobs)
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`[Socket] 🔌 Một client đã kết nối: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[Socket] ❌ Client đã ngắt kết nối: ${socket.id}`);
  });
});

// Khởi động server bằng server.listen thay vì app.listen
const { startCronJobs } = require("./jobs/airQualityCron");
server.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  // Khởi động Cron Jobs sau khi server đã chạy
  startCronJobs(io);
});
