const express = require('express');
const router = express.Router();
const exampleRouter = require('./exampleRouter');

// Tổng hợp các module router tại đây
router.use('/example', exampleRouter);

module.exports = router;
