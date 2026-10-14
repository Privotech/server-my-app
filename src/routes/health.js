const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'react-bank-api' });
});

module.exports = router;
