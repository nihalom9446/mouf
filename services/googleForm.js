/**
 * ==============================================================================
 * GOOGLE FORM SUBMISSION SERVICE
 * ==============================================================================
 * Automatically posts contact form submissions to the connected Google Form:
 * Form URL: https://docs.google.com/forms/d/e/1FAIpQLSfkqsyuEPcsgOBmiYz2gowZS7zPcvXoyxMgT_GwCbS7n-dlPQ/viewform
 * Form Action: https://docs.google.com/forms/d/e/1FAIpQLSfkqsyuEPcsgOBmiYz2gowZS7zPcvXoyxMgT_GwCbS7n-dlPQ/formResponse
 * 
 * Fields:
 *  - name    -> entry.1538161168
 *  - phone   -> entry.1563800816
 *  - email   -> entry.2011850232
 *  - message -> entry.846611159
 */

const https = require('https');
const querystring = require('querystring');

const GOOGLE_FORM_ACTION_URL = process.env.GOOGLE_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSfkqsyuEPcsgOBmiYz2gowZS7zPcvXoyxMgT_GwCbS7n-dlPQ/formResponse';
const ENTRY_NAME = process.env.GOOGLE_FORM_ENTRY_NAME || 'entry.1538161168';
const ENTRY_PHONE = process.env.GOOGLE_FORM_ENTRY_PHONE || 'entry.1563800816';
const ENTRY_EMAIL = process.env.GOOGLE_FORM_ENTRY_EMAIL || 'entry.2011850232';
const ENTRY_MESSAGE = process.env.GOOGLE_FORM_ENTRY_MESSAGE || 'entry.846611159';

/**
 * Submits lead data to Google Form asynchronously (fail-safe)
 * @param {Object} lead 
 * @returns {Promise<{success: boolean, statusCode?: number, error?: string}>}
 */
async function submitToGoogleForm(lead) {
    return new Promise((resolve) => {
        try {
            const messageWithService = lead.service && lead.service !== 'General Inquiry' 
                ? `[Service: ${lead.service}]\n${lead.message || ''}`
                : (lead.message || '');

            const formData = {
                [ENTRY_NAME]: lead.name || '',
                [ENTRY_PHONE]: lead.phone || '',
                [ENTRY_EMAIL]: lead.email && lead.email !== 'Not provided' ? lead.email : '',
                [ENTRY_MESSAGE]: messageWithService
            };

            const postData = querystring.stringify(formData);
            const urlObj = new URL(GOOGLE_FORM_ACTION_URL);

            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MoufMedia/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 400) {
                        console.log(`📋 [Google Form] Lead "${lead.name}" submitted successfully (HTTP ${res.statusCode})`);
                        resolve({ success: true, statusCode: res.statusCode });
                    } else {
                        console.warn(`⚠️ [Google Form] Unexpected status code: ${res.statusCode}`);
                        resolve({ success: false, statusCode: res.statusCode });
                    }
                });
            });

            req.on('error', (err) => {
                console.error('⚠️ [Google Form] Request error:', err.message);
                resolve({ success: false, error: err.message });
            });

            req.setTimeout(8000, () => {
                req.destroy();
                console.warn('⚠️ [Google Form] Request timed out after 8s');
                resolve({ success: false, error: 'Timeout' });
            });

            req.write(postData);
            req.end();
        } catch (err) {
            console.error('⚠️ [Google Form] Error preparing submission:', err.message);
            resolve({ success: false, error: err.message });
        }
    });
}

module.exports = {
    submitToGoogleForm,
    GOOGLE_FORM_ACTION_URL
};
