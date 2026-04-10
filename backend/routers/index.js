const express = require("express");
const router = express.Router();
const exampleRouter = require("./exampleRouter");

// Tổng hợp các module router tại đây
router.use("/example", exampleRouter);

// Air Quality routes
router.use("/air-quality", require("./airQualityRouter"));

module.exports = router;
