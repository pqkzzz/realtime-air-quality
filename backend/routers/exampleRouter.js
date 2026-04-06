const express = require('express');
const router = express.Router();
const ExampleController = require('../controllers/exampleController');

// Route: GET /api/example
router.get('/', ExampleController.getAll);

// Route: POST /api/example
router.post('/', ExampleController.create);

module.exports = router;
