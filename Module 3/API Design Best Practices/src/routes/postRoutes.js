const express = require('express');

const controller = require('../controllers/postController');

const router = express.Router();

// Posts collection
router.get('/posts', controller.listPosts);
router.post('/posts', controller.createPost);

// Single post
router.get('/posts/:id', controller.getPost);

// Like a post
router.post('/posts/:id/likes', controller.likePost);

module.exports = router;