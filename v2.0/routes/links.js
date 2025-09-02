const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const linkController = require('../controllers/linkController');

router.post('/create', authenticate, linkController.createLink);
router.get('/my', authenticate, linkController.getMyLinks);
router.put('/:slug', authenticate, linkController.updateLink);
router.delete('/:slug', authenticate, linkController.deleteLink);

module.exports = router;
