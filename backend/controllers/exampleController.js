const ExampleModel = require('../models/exampleModel');

class ExampleController {
  static async getAll(req, res) {
    try {
      const data = await ExampleModel.getAll();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async create(req, res) {
    try {
      const newData = await ExampleModel.create(req.body);
      res.status(201).json({ success: true, data: newData });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = ExampleController;
