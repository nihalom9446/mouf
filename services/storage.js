/**
 * ==============================================================================
 * MOUF MEDIA - SERVER DATA PERSISTENCE & STORAGE ENGINE
 * ==============================================================================
 * Manages atomic read/write persistence for Site Settings, Live Portfolio Projects,
 * Customer Inquiries / Leads, and Authenticated Sessions.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(__dirname, '..', 'images', 'uploads');

// Ensure storage and uploads directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// File paths
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Password Hashing Helper
function hashPassword(password, salt) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
    if (!storedHash || !storedSalt) return false;
    const { hash } = hashPassword(password, storedSalt);
    return hash === storedHash;
}

// Default Seed Data
const DEFAULT_SETTINGS = () => {
    const defaultPass = process.env.ADMIN_PASSWORD || 'mouf2025';
    const { hash, salt } = hashPassword(defaultPass);
    return {
        adminUsername: process.env.ADMIN_USERNAME || 'admin',
        adminPasswordHash: hash,
        adminPasswordSalt: salt,
        phone: '+91 9995 800 444',
        whatsapp: '+91 9995 800 444',
        email: 'muhammadnihalom@gmail.com',
        address: 'Mouf Media, Kozhikode, Kerala, India - 673001',
        baseRate: 120,
        updatedAt: new Date().toISOString()
    };
};

const DEFAULT_PROJECTS = [
    {
        id: 'PRJ-1',
        title: 'Mega Concert Stage Setup',
        category: 'CONCERTS & FESTIVALS',
        venue: 'Calicut Beach Open Grounds',
        image: 'images/concert_event_1786554949165.png',
        createdAt: new Date().toISOString()
    },
    {
        id: 'PRJ-2',
        title: 'Arena Visual Production',
        category: 'LIVE EVENTS',
        venue: 'Indoor Stadium Arena',
        image: 'images/project_hero_stage.png',
        createdAt: new Date().toISOString()
    },
    {
        id: 'PRJ-3',
        title: 'Indoor Curved Display Wall',
        category: 'AUDITORIUMS',
        venue: 'University Grand Auditorium',
        image: 'images/rental_hero_stage.png',
        createdAt: new Date().toISOString()
    },
    {
        id: 'PRJ-4',
        title: 'Global Summit Video Wall',
        category: 'CORPORATE',
        venue: 'Lulu International Convention Centre',
        image: 'images/corporate_event_1786554835253.png',
        createdAt: new Date().toISOString()
    },
    {
        id: 'PRJ-5',
        title: 'Royal Wedding Stage Backdrop',
        category: 'WEDDINGS',
        venue: 'The Gateway Hotel, Beach Road',
        image: 'images/wedding_event_1786554814381.png',
        createdAt: new Date().toISOString()
    },
    {
        id: 'PRJ-6',
        title: 'Stadium Live Screening',
        category: 'OUTDOOR & SPORTS',
        venue: 'Corporation Stadium Ground',
        image: 'images/sports_event_1786554964693.png',
        createdAt: new Date().toISOString()
    }
];

// Read & Write JSON Helpers
function readJson(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) {
            writeJson(filePath, fallback);
            return fallback;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return fallback;
    }
}

function writeJson(filePath, data) {
    try {
        const tempPath = `${filePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, filePath);
        return true;
    } catch (err) {
        console.error(`Error writing ${filePath}:`, err);
        return false;
    }
}

// Initialize seed files if needed
function initializeStorage() {
    if (!fs.existsSync(SETTINGS_FILE)) {
        writeJson(SETTINGS_FILE, DEFAULT_SETTINGS());
    }
    if (!fs.existsSync(PROJECTS_FILE)) {
        writeJson(PROJECTS_FILE, DEFAULT_PROJECTS);
    }
    if (!fs.existsSync(LEADS_FILE)) {
        writeJson(LEADS_FILE, []);
    }
    if (!fs.existsSync(SESSIONS_FILE)) {
        writeJson(SESSIONS_FILE, {});
    }
}

initializeStorage();

// Storage Service API
const StorageService = {
    // --- Settings & Auth ---
    getSettings() {
        return readJson(SETTINGS_FILE, DEFAULT_SETTINGS());
    },

    getPublicSettings() {
        const settings = this.getSettings();
        return {
            phone: settings.phone || '+91 9995 800 444',
            whatsapp: settings.whatsapp || '+91 9995 800 444',
            email: settings.email || 'muhammadnihalom@gmail.com',
            address: settings.address || 'Mouf Media, Kozhikode, Kerala, India - 673001',
            baseRate: settings.baseRate || 120,
            updatedAt: settings.updatedAt || new Date().toISOString()
        };
    },

    saveSettings(updatedFields) {
        const current = this.getSettings();
        const merged = {
            ...current,
            ...updatedFields,
            updatedAt: new Date().toISOString()
        };
        // Protect sensitive hash/salt fields from direct overwrite unless through changePassword
        merged.adminUsername = current.adminUsername;
        merged.adminPasswordHash = current.adminPasswordHash;
        merged.adminPasswordSalt = current.adminPasswordSalt;
        writeJson(SETTINGS_FILE, merged);
        return this.getPublicSettings();
    },

    verifyAdminCredentials(username, password) {
        const settings = this.getSettings();
        const validUser = (username || '').trim().toLowerCase() === (settings.adminUsername || 'admin').toLowerCase();
        if (!validUser) return false;
        return verifyPassword(password, settings.adminPasswordHash, settings.adminPasswordSalt);
    },

    changeAdminPassword(currentPassword, newPassword) {
        const settings = this.getSettings();
        if (!verifyPassword(currentPassword, settings.adminPasswordHash, settings.adminPasswordSalt)) {
            return { success: false, error: 'Current password is incorrect.' };
        }
        if (!newPassword || newPassword.length < 6) {
            return { success: false, error: 'New password must be at least 6 characters long.' };
        }
        const { hash, salt } = hashPassword(newPassword);
        settings.adminPasswordHash = hash;
        settings.adminPasswordSalt = salt;
        settings.updatedAt = new Date().toISOString();
        writeJson(SETTINGS_FILE, settings);
        return { success: true };
    },

    // --- Session Management ---
    createSession() {
        const token = crypto.randomBytes(32).toString('hex');
        const sessions = readJson(SESSIONS_FILE, {});
        sessions[token] = {
            createdAt: Date.now(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        writeJson(SESSIONS_FILE, sessions);
        return token;
    },

    validateSession(token) {
        if (!token) return false;
        const sessions = readJson(SESSIONS_FILE, {});
        const session = sessions[token];
        if (!session) return false;
        if (Date.now() > session.expiresAt) {
            delete sessions[token];
            writeJson(SESSIONS_FILE, sessions);
            return false;
        }
        return true;
    },

    destroySession(token) {
        if (!token) return;
        const sessions = readJson(SESSIONS_FILE, {});
        if (sessions[token]) {
            delete sessions[token];
            writeJson(SESSIONS_FILE, sessions);
        }
    },

    // --- Projects Management ---
    getProjects() {
        return readJson(PROJECTS_FILE, DEFAULT_PROJECTS);
    },

    addProject(project) {
        const projects = this.getProjects();
        const newProject = {
            id: 'PRJ-' + Date.now().toString().slice(-6),
            title: (project.title || '').trim(),
            category: project.category || 'LIVE EVENTS',
            venue: (project.venue || '').trim() || 'Kozhikode, Kerala',
            image: project.image || 'images/project_hero_stage.png',
            createdAt: new Date().toISOString()
        };
        projects.unshift(newProject);
        writeJson(PROJECTS_FILE, projects);
        return newProject;
    },

    deleteProject(id) {
        let projects = this.getProjects();
        const initialLen = projects.length;
        projects = projects.filter(p => p.id !== id);
        writeJson(PROJECTS_FILE, projects);
        return projects.length < initialLen;
    },

    // --- Leads / Inquiries Management ---
    getLeads() {
        return readJson(LEADS_FILE, []);
    },

    addLead(lead) {
        const leads = this.getLeads();
        const newLead = {
            id: lead.id || ('LD-' + Date.now().toString().slice(-5)),
            name: lead.name || 'Anonymous',
            email: lead.email || '',
            phone: lead.phone || '',
            service: lead.service || 'General Inquiry',
            message: lead.message || '',
            status: 'new', // new, contacted, converted, archived
            createdAt: new Date().toISOString()
        };
        leads.unshift(newLead);
        // Keep up to latest 500 leads
        if (leads.length > 500) leads.length = 500;
        writeJson(LEADS_FILE, leads);
        return newLead;
    },

    updateLeadStatus(id, status, notes) {
        const leads = this.getLeads();
        const lead = leads.find(l => l.id === id);
        if (!lead) return null;
        if (status) lead.status = status;
        if (notes !== undefined) lead.notes = notes;
        lead.updatedAt = new Date().toISOString();
        writeJson(LEADS_FILE, leads);
        return lead;
    },

    deleteLead(id) {
        let leads = this.getLeads();
        const initialLen = leads.length;
        leads = leads.filter(l => l.id !== id);
        writeJson(LEADS_FILE, leads);
        return leads.length < initialLen;
    },

    // --- File Upload Processing ---
    saveUploadedImage(base64Data, originalExt = 'png') {
        try {
            // Remove data URI prefix if present
            const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            let ext = originalExt.replace(/[^a-zA-Z0-9]/g, '') || 'png';
            let buffer;

            if (matches) {
                ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                buffer = Buffer.from(matches[2], 'base64');
            } else {
                buffer = Buffer.from(base64Data, 'base64');
            }

            const fileName = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
            const targetPath = path.join(UPLOADS_DIR, fileName);
            fs.writeFileSync(targetPath, buffer);

            return {
                success: true,
                url: `images/uploads/${fileName}`,
                fileName
            };
        } catch (err) {
            console.error('Error saving uploaded image:', err);
            return { success: false, error: 'Failed to process and save image.' };
        }
    }
};

module.exports = StorageService;
