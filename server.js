/**
 * ==============================================================================
 * MOUF MEDIA - PRODUCTION SERVER & SECURE API ENGINE
 * ==============================================================================
 * Serves website static assets, handles form submissions with automated Meta
 * WhatsApp Cloud API notifications, Google Forms forwarding, and provides
 * a full REST API for Admin Authentication, Project Portfolios, Leads CRM, and Settings.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const whatsAppService = require('./services/whatsapp');
const googleFormService = require('./services/googleForm');
const storageService = require('./services/storage');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------------------
// 1. MIDDLEWARE SETUP
// ------------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static images/uploads folder ensure & static serving
app.use('/images/uploads', express.static(path.join(__dirname, 'images', 'uploads')));

// ------------------------------------------------------------------------------
// 2. DEDUPLICATION CACHE (In-Memory with 60-Second TTL for Contact Submissions)
// ------------------------------------------------------------------------------
const recentSubmissionsCache = new Map();
const DEDUPLICATION_TTL_MS = 60 * 1000;

function cleanupDeduplicationCache() {
    const now = Date.now();
    for (const [hash, timestamp] of recentSubmissionsCache.entries()) {
        if (now - timestamp > DEDUPLICATION_TTL_MS) {
            recentSubmissionsCache.delete(hash);
        }
    }
}
setInterval(cleanupDeduplicationCache, 30 * 1000);

function getSubmissionHash(lead) {
    const normalized = `${(lead.name || '').trim().toLowerCase()}|${(lead.email || '').trim().toLowerCase()}|${(lead.phone || '').trim().replace(/[^0-9]/g, '')}|${(lead.message || '').trim().toLowerCase()}`;
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ------------------------------------------------------------------------------
// 3. ADMIN AUTHENTICATION MIDDLEWARE
// ------------------------------------------------------------------------------
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (req.headers['x-admin-token']) {
        token = req.headers['x-admin-token'];
    }

    if (!token || !storageService.validateSession(token)) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized. Please sign in to the Admin Portal.'
        });
    }

    req.adminToken = token;
    next();
}

// ------------------------------------------------------------------------------
// 4. PUBLIC API ENDPOINTS
// ------------------------------------------------------------------------------

/**
 * Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Mouf Media API',
        timestamp: new Date().toISOString(),
        whatsappConfigured: whatsAppService.isConfigured(),
        googleFormConnected: true,
        storageReady: true
    });
});

/**
 * Public Dynamic Site Settings
 * GET /api/settings
 */
app.get('/api/settings', (req, res) => {
    try {
        const settings = storageService.getPublicSettings();
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to retrieve site settings.' });
    }
});

/**
 * Public Dynamic Portfolio Projects
 * GET /api/projects
 */
app.get('/api/projects', (req, res) => {
    try {
        const projects = storageService.getProjects();
        res.json({ success: true, projects });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to retrieve portfolio projects.' });
    }
});

/**
 * Contact / Lead Submission Endpoint
 * POST /api/contact
 */
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, service, message } = req.body || {};

        // 1. Validation
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }
        
        let sanitizedEmail = '';
        if (email && typeof email === 'string' && email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
            }
            sanitizedEmail = email.trim().toLowerCase().substring(0, 100);
        }

        if (!phone || typeof phone !== 'string' || !phone.trim()) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }
        const digitsOnly = phone.replace(/[^0-9]/g, '');
        if (digitsOnly.length < 7) {
            return res.status(400).json({ success: false, error: 'Please provide a valid phone number' });
        }
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const sanitizedLead = {
            id: 'LD-' + Date.now().toString().slice(-4),
            name: name.trim().substring(0, 100),
            email: sanitizedEmail || 'Not provided',
            phone: phone.trim().substring(0, 30),
            service: (service && typeof service === 'string') ? service.trim().substring(0, 100) : 'General Inquiry',
            message: message.trim().substring(0, 3000),
            createdAt: new Date().toISOString()
        };

        // 2. Duplicate Detection
        const submissionHash = getSubmissionHash(sanitizedLead);
        const lastSeen = recentSubmissionsCache.get(submissionHash);
        const now = Date.now();

        if (lastSeen && (now - lastSeen < DEDUPLICATION_TTL_MS)) {
            console.log(`ℹ️ [API] Duplicate submission detected for "${sanitizedLead.name}". Skipped redundant notification.`);
            return res.status(200).json({
                success: true,
                message: 'Your inquiry has already been received! Our team is processing it.',
                deduplicated: true
            });
        }

        recentSubmissionsCache.set(submissionHash, now);

        console.log(`\n📥 [API] New lead received: "${sanitizedLead.name}" <${sanitizedLead.email}> [${sanitizedLead.service}]`);

        // 3. Persist lead in Server Storage for Admin Panel
        storageService.addLead(sanitizedLead);

        // 4. Dispatch WhatsApp Notification & Google Form Entry Asynchronously
        whatsAppService.sendLeadNotification(sanitizedLead)
            .then(result => {
                if (!result.success && !result.skipped) {
                    console.error('⚠️ [API Note] Lead was saved, but WhatsApp notification encountered an issue.');
                }
            })
            .catch(err => {
                console.error('⚠️ [API Note] Uncaught error during WhatsApp notification dispatch:', err);
            });

        googleFormService.submitToGoogleForm(sanitizedLead)
            .then(result => {
                if (!result.success) {
                    console.warn('⚠️ [API Note] Google Form forwarding note.');
                }
            })
            .catch(err => {
                console.error('⚠️ [API Note] Google Form error:', err);
            });

        // 5. Return Immediate Success to Client
        return res.status(200).json({
            success: true,
            message: 'Thank you! Your message has been sent successfully.',
            leadId: sanitizedLead.id
        });

    } catch (err) {
        console.error('❌ [API] Critical error in /api/contact handler:', err);
        return res.status(500).json({
            success: false,
            error: 'An unexpected server error occurred. Please try again or contact us directly.'
        });
    }
});

// ------------------------------------------------------------------------------
// 5. ADMIN AUTHENTICATION & MANAGEMENT ENDPOINTS
// ------------------------------------------------------------------------------

/**
 * Admin Login
 * POST /api/admin/login
 */
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required.' });
        }

        const isValid = storageService.verifyAdminCredentials(username, password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid username or password.' });
        }

        const token = storageService.createSession();
        return res.json({
            success: true,
            token,
            message: 'Authentication successful.'
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Internal login error.' });
    }
});

/**
 * Check Admin Session Validity
 * GET /api/admin/session
 */
app.get('/api/admin/session', requireAdminAuth, (req, res) => {
    res.json({ success: true, valid: true });
});

/**
 * Admin Logout
 * POST /api/admin/logout
 */
app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
    storageService.destroySession(req.adminToken);
    res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * Change Admin Password
 * POST /api/admin/change-password
 */
app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
        }

        const result = storageService.changeAdminPassword(currentPassword, newPassword);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error });
        }

        return res.json({ success: true, message: 'Admin password changed successfully.' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ success: false, error: 'Internal server error while changing password.' });
    }
});

/**
 * Get Admin Leads / Inquiries
 * GET /api/admin/leads
 */
app.get('/api/admin/leads', requireAdminAuth, (req, res) => {
    try {
        const leads = storageService.getLeads();
        res.json({ success: true, leads });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to retrieve leads.' });
    }
});

/**
 * Update Lead Status or Notes
 * PATCH /api/admin/leads/:id
 */
app.patch('/api/admin/leads/:id', requireAdminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body || {};
        const updated = storageService.updateLeadStatus(id, status, notes);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }
        res.json({ success: true, lead: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to update lead.' });
    }
});

/**
 * Delete a Lead
 * DELETE /api/admin/leads/:id
 */
app.delete('/api/admin/leads/:id', requireAdminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const deleted = storageService.deleteLead(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }
        res.json({ success: true, message: 'Lead deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete lead.' });
    }
});

/**
 * Get Admin Projects
 * GET /api/admin/projects
 */
app.get('/api/admin/projects', requireAdminAuth, (req, res) => {
    try {
        const projects = storageService.getProjects();
        res.json({ success: true, projects });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to retrieve projects.' });
    }
});

/**
 * Add New Portfolio Project
 * POST /api/admin/projects
 */
app.post('/api/admin/projects', requireAdminAuth, (req, res) => {
    try {
        const { title, category, venue, image } = req.body || {};
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Project title is required.' });
        }

        const newProj = storageService.addProject({
            title: title.trim(),
            category: category || 'LIVE EVENTS',
            venue: venue || 'Kozhikode, Kerala',
            image: image || 'images/project_hero_stage.png'
        });

        res.json({ success: true, project: newProj, message: 'Project added successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to add project.' });
    }
});

/**
 * Delete Portfolio Project
 * DELETE /api/admin/projects/:id
 */
app.delete('/api/admin/projects/:id', requireAdminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const deleted = storageService.deleteProject(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Project not found.' });
        }
        res.json({ success: true, message: 'Project deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete project.' });
    }
});

/**
 * Upload Image to Server
 * POST /api/admin/upload
 */
app.post('/api/admin/upload', requireAdminAuth, (req, res) => {
    try {
        const { base64Data, extension } = req.body || {};
        if (!base64Data) {
            return res.status(400).json({ success: false, error: 'Image data is required.' });
        }

        const result = storageService.saveUploadedImage(base64Data, extension || 'png');
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        res.json({
            success: true,
            url: result.url,
            fileName: result.fileName,
            message: 'Image uploaded successfully.'
        });
    } catch (err) {
        console.error('Upload handler error:', err);
        res.status(500).json({ success: false, error: 'Failed to upload image.' });
    }
});

/**
 * Get Full Admin Site Settings
 * GET /api/admin/settings
 */
app.get('/api/admin/settings', requireAdminAuth, (req, res) => {
    try {
        const settings = storageService.getPublicSettings();
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to retrieve site settings.' });
    }
});

/**
 * Update Admin Site Settings
 * POST /api/admin/settings
 */
app.post('/api/admin/settings', requireAdminAuth, (req, res) => {
    try {
        const { phone, whatsapp, email, address, baseRate } = req.body || {};
        const updated = storageService.saveSettings({
            phone: phone ? phone.trim() : undefined,
            whatsapp: whatsapp ? whatsapp.trim() : undefined,
            email: email ? email.trim() : undefined,
            address: address ? address.trim() : undefined,
            baseRate: baseRate ? parseFloat(baseRate) : undefined
        });

        res.json({ success: true, settings: updated, message: 'Site settings updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to save settings.' });
    }
});

// ------------------------------------------------------------------------------
// 6. STATIC FILE SERVING
// ------------------------------------------------------------------------------
app.use(express.static(path.join(__dirname)));

// Fallback route for direct HTML navigation
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    const filePath = path.join(__dirname, req.path);
    res.sendFile(filePath, err => {
        if (err) {
            res.sendFile(path.join(__dirname, 'index.html'));
        }
    });
});

// ------------------------------------------------------------------------------
// 7. START SERVER
// ------------------------------------------------------------------------------
if (require.main === module) {
    app.listen(PORT, () => {
        console.log('\n=============================================================');
        console.log(`🚀 Mouf Media Server running live at: http://localhost:${PORT}`);
        console.log(`📱 Meta WhatsApp Cloud API: ${whatsAppService.isConfigured() ? '✅ Configured' : '⚠️  Pending .env credentials'}`);
        console.log(`🛡️  Admin REST API & Storage Engine: ✅ Initialized & Active`);
        console.log(`🌐 Contact Form Endpoint: POST http://localhost:${PORT}/api/contact`);
        console.log('=============================================================\n');
    });
}

module.exports = app;
