const express = require('express');
const adminPlayersController = require('../controller/adminPlayersController');

const router = express.Router();

router.get('/', adminPlayersController.listPlayers);
router.post('/:id/verify', adminPlayersController.verifyPlayer);

module.exports = router;