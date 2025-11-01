/**
 * Auth Routes
 * Authentication and session related routes
 */
import express from 'express';
import { checkSession, showExpiredPage, showAccessDeniedPage } from '../controllers/authController.js';

const router = express.Router();

// Check if session is valid
router.get('/check-session', checkSession);

// Session expired page
router.get('/expired', showExpiredPage);

// Access denied page
router.get('/access-denied', showAccessDeniedPage);

export default router;