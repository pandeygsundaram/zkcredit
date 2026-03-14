const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

router.post('/register', agentController.registerAgent);
router.post('/quote', agentController.getQuote);
router.get('/:wallet', agentController.getAgent);

module.exports = router;
