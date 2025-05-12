/**
 * Admin authentication routes
 * This JavaScript implementation avoids TypeScript errors
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { withClient } = require('../db');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Variable to store admin data if found
        let admin = null;

        // Find admin user in database
        await withClient(async (client) => {
            const query = 'SELECT * FROM admins WHERE username = $1 LIMIT 1';
            const result = await client.query(query, [username]);

            if (result.rows.length > 0) {
                admin = result.rows[0];
            }
        });

        // Admin not found
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, admin.password);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login time
        await withClient(async (client) => {
            await client.query(
                'UPDATE admins SET last_login = NOW() WHERE id = $1',
                [admin.id]
            );
        });

        // Create authentication payload
        const payload = {
            id: admin.id,
            username: admin.username
        };

        // Create and set JWT cookie
        res.cookie('admin_token',
            jwt.sign(payload, process.env.JWT_SECRET || 'secret_key', { expiresIn: '30m' }),
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 30 * 60 * 1000, // 30 minutes
                sameSite: 'lax',
                signed: true
            }
        );

        // Set session data
        if (req.session) {
            req.session.admin = payload;
        }

        // Send success response
        return res.json({
            success: true,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// Logout route
router.post('/logout', (req, res) => {
    // Clear session
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
        });
    }

    // Clear auth cookie
    res.clearCookie('admin_token');

    return res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Validation route
router.get('/validate', (req, res) => {
    const admin = req.admin;

    if (admin && admin.username) {
        return res.json({
            success: true,
            data: {
                username: admin.username,
                authenticated: true
            }
        });
    } else {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
});

module.exports = router; 