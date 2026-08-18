/**
 * ==============================================================================
 * Meta WhatsApp Business Cloud API Service
 * ==============================================================================
 * Handles secure communication with the official Meta WhatsApp Business Cloud API.
 * Supports direct text messages and pre-approved WhatsApp message templates.
 */

require('dotenv').config();

class WhatsAppService {
    constructor() {
        this.phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || '';
        this.accessToken = process.env.META_WA_ACCESS_TOKEN || '';
        this.recipientPhone = process.env.META_WA_RECIPIENT_PHONE || '';
        this.apiVersion = process.env.META_WA_API_VERSION || 'v21.0';
        this.useTemplate = process.env.META_WA_USE_TEMPLATE === 'true';
        this.templateName = process.env.META_WA_TEMPLATE_NAME || 'lead_notification';
        this.templateLang = process.env.META_WA_TEMPLATE_LANG || 'en_US';
    }

    /**
     * Sanitizes phone number to digits only (removes +, spaces, dashes, parentheses)
     * @param {string} phone 
     * @returns {string}
     */
    sanitizePhone(phone) {
        if (!phone) return '';
        return String(phone).replace(/[^0-9]/g, '');
    }

    /**
     * Formats submission date to human-readable string in Indian Standard Time / Local Time
     * @param {Date} date 
     * @returns {string}
     */
    formatDate(date = new Date()) {
        try {
            return new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(date);
        } catch (e) {
            return date.toLocaleString();
        }
    }

    /**
     * Formats direct WhatsApp text message with clean markdown styling & emojis
     */
    buildTextMessage(lead) {
        const timestamp = this.formatDate(lead.createdAt || new Date());
        return `🔔 *NEW WEBSITE INQUIRY* — *MOUF MEDIA*\n` +
               `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
               `👤 *Name:* ${lead.name}\n` +
               `📞 *Phone:* ${lead.phone}\n` +
               `✉️ *Email:* ${lead.email}\n` +
               `📌 *Service:* ${lead.service || 'General Inquiry'}\n\n` +
               `💬 *Message Details:*\n` +
               `"${lead.message}"\n` +
               `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
               `📅 *Submitted:* ${timestamp}\n` +
               `🌐 *Source:* Mouf Media Website`;
    }

    /**
     * Builds payload for Meta pre-approved template message
     */
    buildTemplatePayload(recipient, lead) {
        const timestamp = this.formatDate(lead.createdAt || new Date());
        return {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'template',
            template: {
                name: this.templateName,
                language: {
                    code: this.templateLang
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: lead.name || 'N/A' },
                            { type: 'text', text: lead.phone || 'N/A' },
                            { type: 'text', text: lead.email || 'N/A' },
                            { type: 'text', text: lead.service || 'General Inquiry' },
                            { type: 'text', text: (lead.message || 'No details').substring(0, 1000) },
                            { type: 'text', text: timestamp }
                        ]
                    }
                ]
            }
        };
    }

    /**
     * Builds payload for direct freeform text message
     */
    buildTextPayload(recipient, lead) {
        return {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'text',
            text: {
                preview_url: false,
                body: this.buildTextMessage(lead)
            }
        };
    }

    /**
     * Checks if credentials are ready
     */
    isConfigured() {
        const isPlaceholder = (val) => !val || val.includes('your_') || val.includes('_here');
        return !isPlaceholder(this.phoneNumberId) && 
               !isPlaceholder(this.accessToken) && 
               !isPlaceholder(this.recipientPhone);
    }

    /**
     * Sends WhatsApp notification for a new lead
     * @param {Object} lead - { name, email, phone, service, message, createdAt }
     * @returns {Promise<{ success: boolean, data?: any, error?: any }>}
     */
    async sendLeadNotification(lead) {
        const recipient = this.sanitizePhone(this.recipientPhone);

        // 1. Verify Configuration
        if (!this.isConfigured()) {
            console.warn('\n⚠️  [WhatsApp Service] Meta Cloud API credentials not configured yet in .env');
            console.warn('ℹ️  Lead received successfully, but WhatsApp message dispatch was skipped.');
            console.warn('👉 To enable live WhatsApp notifications, please update .env with your Meta credentials:\n' +
                         '   - META_WA_PHONE_NUMBER_ID\n' +
                         '   - META_WA_ACCESS_TOKEN\n' +
                         '   - META_WA_RECIPIENT_PHONE\n');
            return {
                success: false,
                skipped: true,
                reason: 'Credentials not configured'
            };
        }

        if (!recipient) {
            console.error('❌ [WhatsApp Service] Invalid or missing META_WA_RECIPIENT_PHONE in .env');
            return { success: false, error: 'Recipient phone missing' };
        }

        // 2. Prepare payload
        const payload = this.useTemplate 
            ? this.buildTemplatePayload(recipient, lead)
            : this.buildTextPayload(recipient, lead);

        const endpoint = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

        console.log(`\n📨 [WhatsApp Service] Dispatching notification to ${recipient} (Mode: ${this.useTemplate ? 'Template' : 'Direct Text'})...`);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error('❌ [WhatsApp Service] Meta Cloud API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: responseData.error || responseData
                });
                return {
                    success: false,
                    error: responseData.error || responseData
                };
            }

            console.log('✅ [WhatsApp Service] Notification sent successfully! Message ID:', responseData.messages?.[0]?.id || 'N/A');
            return {
                success: true,
                data: responseData
            };
        } catch (networkError) {
            console.error('❌ [WhatsApp Service] Network or Execution Exception:', networkError.message || networkError);
            return {
                success: false,
                error: networkError.message || networkError
            };
        }
    }
}

module.exports = new WhatsAppService();
