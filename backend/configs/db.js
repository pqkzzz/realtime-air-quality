const knex = require('knex');
const knexConfig = require('./knexfile');

// Sử dụng môi trường từ biến NODE_ENV, mặc định là development
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

const db = knex(config);

module.exports = db;
