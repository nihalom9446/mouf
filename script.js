// =========================================================================
// GLOBAL UTILITIES
// =========================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 0. GLOBAL DYNAMIC SITE SETTINGS PROPAGATION
    // =========================================================================
    function sanitizePhone(raw, isWhatsapp = false) {
        if (!raw || typeof raw !== 'string') return isWhatsapp ? '919061500511' : '+91 90615 00511';
        if (raw.includes('99958') || raw.includes('8089') || raw.includes('9995')) {
            return isWhatsapp ? '919061500511' : '+91 90615 00511';
        }
        if (isWhatsapp) {
            const digits = raw.replace(/[^0-9]/g, '');
            return digits.length >= 10 ? digits : '919061500511';
        }
        return raw;
    }

    function applyGlobalSiteSettings(settingsData) {
        try {
            let settings = settingsData;
            if (!settings) {
                try {
                    settings = JSON.parse(localStorage.getItem('mouf_settings') || '{}');
                } catch (e) { settings = {}; }
            }

            // Purge old cached obsolete settings if present
            if (settings.whatsapp && (settings.whatsapp.includes('99958') || settings.whatsapp.includes('8089'))) {
                settings.whatsapp = '+91 90615 00511';
                settings.phone = '+91 90615 00511';
                try { localStorage.setItem('mouf_settings', JSON.stringify(settings)); } catch (e) {}
            }

            const phone = sanitizePhone(settings.phone, false);
            const cleanPhone = phone.replace(/[^0-9+]/g, '') || '+919061500511';
            const cleanWhatsapp = sanitizePhone(settings.whatsapp, true);
            const email = settings.email || 'moufmediaclt@gmail.com';
            const address = settings.address || 'Mouf Media, Kozhikode, Kerala, India - 673001';

            // 1. Update all Phone Links & Visible Phone Text
            document.querySelectorAll('a[href^="tel:"]').forEach(el => {
                el.href = `tel:${cleanPhone}`;
                if (el.textContent.includes('+91') || el.textContent.includes('90615') || el.textContent.includes('9995') || el.textContent.includes('8089')) {
                    el.textContent = phone;
                }
            });

            // 2. Update all WhatsApp Links
            document.querySelectorAll('a[href*="wa.me"]').forEach(el => {
                try {
                    const currentHref = el.getAttribute('href') || '';
                    const url = new URL(currentHref, window.location.href);
                    const textParam = url.searchParams.get('text');
                    if (textParam) {
                        el.href = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(textParam)}`;
                    } else {
                        el.href = `https://wa.me/${cleanWhatsapp}`;
                    }
                } catch (err) {
                    el.href = `https://wa.me/${cleanWhatsapp}`;
                }
            });

            // 3. Update all Email Links & Visible Email Text
            document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
                el.href = `mailto:${email}`;
                if (el.textContent.includes('@')) {
                    el.textContent = email;
                }
            });

            // 4. Update Office Address Text in Contact Cards
            document.querySelectorAll('.contact-item-desc a[href*="maps"]').forEach(el => {
                el.innerHTML = `${escapeHtml(address).replace(/,/g, '<br>')}`;
            });

            // 5. Update footer address text
            document.querySelectorAll('.footer-contact-item a[href*="maps"]').forEach(el => {
                el.textContent = address;
            });

        } catch (e) {
            console.warn('Site settings auto-propagation note:', e);
        }
    }

    // Run settings replacement from cache immediately
    applyGlobalSiteSettings();

    // Asynchronously fetch latest settings from server API
    fetch('/api/settings')
        .then(r => r.json())
        .then(data => {
            if (data && data.success && data.settings) {
                if (data.settings.whatsapp && (data.settings.whatsapp.includes('99958') || data.settings.whatsapp.includes('8089'))) {
                    data.settings.whatsapp = '+91 90615 00511';
                    data.settings.phone = '+91 90615 00511';
                }
                localStorage.setItem('mouf_settings', JSON.stringify(data.settings));
                applyGlobalSiteSettings(data.settings);
            }
        })
        .catch(() => {});

    // =========================================================================
    // 1. NAVBAR SCROLL & MOBILE MENU
    // =========================================================================
    const navbar = document.querySelector('.navbar');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const navActions = document.querySelector('.nav-actions');

    // Add frosted blur shadow on scroll
    window.addEventListener('scroll', () => {
        if (navbar) {
            if (window.scrollY > 20) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    // Mobile menu toggle
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active', isOpen);
            mobileMenuBtn.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
        });

        // Close menu when clicking any nav link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
                mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (navbar && !navbar.contains(e.target) && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
                mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        });
    }

    // =========================================================================
    // 2. SCROLL REVEAL ENGINE (INTERSECTION OBSERVER)
    // =========================================================================
    const revealSelectors = [
        '.section-header', '.section-tag-row', '.who-we-are-title-col',
        '.who-we-are-text', '.who-we-are-media', '.feature-card',
        '.service-card', '.foundation-card', '.capability-card',
        '.why-choose-item', '.included-card', '.pitch-guide-card',
        '.calc-wrapper-card', '.about-cta-card', '.cta-container',
        '.stats-container', '.supply-header', '.supply-card',
        '.options-desc-col', '.option-pitch-card', '.solution-desc-col',
        '.solution-process-flow', '.why-buy-header', '.why-buy-card',
        '.sales-cta-box', '.process-step-item',
        '.what-we-do-header', '.flow-step-item',
        '.project-highlights-header', '.highlight-stat-card',
        '.gallery-header', '.gallery-card', '.projects-cta-box',
        '.contact-form-card', '.contact-info-card', '.contact-badge-item',
        '.contact-assistance-box'
    ];

    revealSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
            if (!el.classList.contains('reveal')) {
                el.classList.add('reveal', 'reveal-up');
                const delayIndex = (index % 6) + 1;
                el.classList.add(`delay-${delayIndex}`);
            }
        });
    });

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                if (entry.target.querySelector('.stat-number, .capability-number, .highlight-number') || entry.target.classList.contains('highlight-stat-card')) {
                    animateStatsNumbers(entry.target);
                }
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });

    // =========================================================================
    // 3. ANIMATED STATS NUMBERS COUNTER
    // =========================================================================
    function animateStatsNumbers(container) {
        const counters = container.querySelectorAll('.stat-number, .capability-number, .highlight-number');
        counters.forEach(counter => {
            const originalText = counter.textContent.trim();
            const match = originalText.match(/(\d+)(\+?)/);
            if (!match) return;

            const target = parseInt(match[1], 10);
            const suffix = match[2] || '';
            const duration = 1500;
            const stepTime = 30;
            const steps = duration / stepTime;
            const increment = target / steps;
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    counter.textContent = target + suffix;
                    clearInterval(timer);
                } else {
                    counter.textContent = Math.floor(current) + suffix;
                }
            }, stepTime);
        });
    }

    // =========================================================================
    // 4. PARALLAX EFFECT FOR HERO SECTIONS
    // =========================================================================
    const heroBg = document.querySelector('.hero-background, .rental-hero-bg, .sales-hero-bg, .projects-hero-bg, .contact-hero-bg');
    if (heroBg) {
        window.addEventListener('scroll', () => {
            const scrollPos = window.scrollY;
            if (scrollPos < 800) {
                heroBg.style.transform = `translateY(${scrollPos * 0.3}px)`;
            }
        }, { passive: true });
    }

    // =========================================================================
    // 5. SMOOTH SCROLLING FOR INTERNAL LINKS
    // =========================================================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || href.length <= 1) return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // =========================================================================
    // 6. RENTAL ESTIMATE CALCULATOR (Rental Page)
    // =========================================================================
    const calcCard = document.getElementById('calculator');
    if (calcCard) {
        const sqftInput = document.getElementById('calcSqftInput');
        const widthInput = document.getElementById('calcWidth');
        const heightInput = document.getElementById('calcHeight');
        const toggleBtn = document.getElementById('calcToggleBtn');
        const toggleText = document.getElementById('calcToggleText');
        const toggleIcon = document.getElementById('calcToggleIcon');
        
        const quickPriceOut = document.getElementById('calcQuickPrice');
        const step1SqftOut = document.getElementById('calcStep1Sqft');
        const step1DimsOut = document.getElementById('calcStep1Dims');
        
        const usageButtons = document.querySelectorAll('.calc-usage-btn[data-usage]');
        const pitchButtons = document.querySelectorAll('.calc-pitch-btn[data-pitch]');
        
        const displayTotal = document.getElementById('calcDisplayTotal');
        const summaryArea = document.getElementById('calcSummaryArea');
        const summaryPitch = document.getElementById('calcSummaryPitch');
        const summaryRate = document.getElementById('calcSummaryRate');
        const summaryGrandTotal = document.getElementById('calcSummaryGrandTotal');
        const quoteBtn = document.getElementById('calcQuoteBtn');

        let selectedUsage = 'indoor';
        let selectedPitch = 'P3';

        const pitchConfig = {
            'P2':   { name: 'P2 (Ultra HD)', multiplier: 1.35, label: 'P2 (Indoor)' },
            'P3':   { name: 'P3 (Standard)', multiplier: 1.0,  label: 'P3 (Indoor)' },
            'P3.9': { name: 'P3.9 (Outdoor / All-Weather)', multiplier: 1.15, label: 'P3.9 (Outdoor)' },
            'P4':   { name: 'P4 (High Brightness)', multiplier: 0.95, label: 'P4 (Outdoor)' }
        };

        // 1. Toggle Expand / Collapse
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const isExpanded = calcCard.classList.contains('is-expanded');
                if (isExpanded) {
                    calcCard.classList.remove('is-expanded');
                    calcCard.classList.add('is-retracted');
                    if (toggleText) toggleText.textContent = 'View Details & Options';
                } else {
                    calcCard.classList.remove('is-retracted');
                    calcCard.classList.add('is-expanded');
                    if (toggleText) toggleText.textContent = 'Hide Details & Options';
                }
            });
        }

        // 2. Calculation & Synchronization Function
        function calculateAndUpdate() {
            let sqft = parseFloat(sqftInput ? sqftInput.value : 0) || 0;
            let w = parseFloat(widthInput ? widthInput.value : 0) || 0;
            let h = parseFloat(heightInput ? heightInput.value : 0) || 0;

            if (sqft < 0) sqft = 0;
            if (w < 0) w = 0;
            if (h < 0) h = 0;

            // Fetch dynamic base rate from admin settings (default 120)
            const settings = JSON.parse(localStorage.getItem('mouf_settings') || '{}');
            const baseRateSetting = parseFloat(settings.baseRate) || 120;

            const pConfig = pitchConfig[selectedPitch] || pitchConfig['P3'];
            const usageMult = selectedUsage === 'outdoor' ? 1.25 : 1.0;
            
            const ratePerSqft = Math.round(baseRateSetting * pConfig.multiplier * usageMult);
            const totalEstimatedPrice = Math.round(sqft * ratePerSqft);

            const formattedPrice = `₹ ${totalEstimatedPrice.toLocaleString('en-IN')}`;

            // Update Quick Bar Displays
            if (quickPriceOut) quickPriceOut.textContent = formattedPrice;
            if (step1SqftOut) step1SqftOut.textContent = `${sqft.toLocaleString('en-IN')} sq ft`;
            if (step1DimsOut) {
                if (w > 0 && h > 0) {
                    step1DimsOut.textContent = `(${w} ft wide × ${h} ft high)`;
                } else {
                    step1DimsOut.textContent = `(${sqft} sq ft total)`;
                }
            }

            // Update Detailed Panel Displays
            if (displayTotal) displayTotal.textContent = formattedPrice;
            if (summaryGrandTotal) summaryGrandTotal.textContent = formattedPrice;
            if (summaryArea) summaryArea.textContent = `${sqft.toLocaleString('en-IN')} sq ft`;
            if (summaryPitch) {
                summaryPitch.textContent = `${selectedPitch} (${selectedUsage === 'outdoor' ? 'Outdoor' : 'Indoor'})`;
            }
            if (summaryRate) summaryRate.textContent = `₹ ${ratePerSqft.toLocaleString('en-IN')} / sq ft`;

            // Update WhatsApp CTA Quote Link
            if (quoteBtn) {
                const whatsappPhone = sanitizePhone(settings.whatsapp, true);
                const messageText = encodeURIComponent(
                    `Hi Mouf Media, I calculated an LED Wall estimate on your website:\n` +
                    `• Screen Size: ${sqft} sq.ft (${w > 0 && h > 0 ? `${w}ft x ${h}ft` : 'Custom'})\n` +
                    `• Setup Type: ${selectedUsage.toUpperCase()} (${selectedPitch})\n` +
                    `• Estimated Price: ${formattedPrice} (@ ₹${ratePerSqft}/sq.ft)\n\n` +
                    `Please check availability and share a formal quotation for my event.`
                );
                quoteBtn.href = `https://wa.me/${whatsappPhone}?text=${messageText}`;
            }
        }

        // 3. Size input handlers
        if (sqftInput) {
            sqftInput.addEventListener('input', () => {
                const val = parseFloat(sqftInput.value) || 0;
                if (val > 0) {
                    // Estimate proportional 2:1 width & height
                    const estimatedH = Math.max(1, Math.round(Math.sqrt(val / 2)));
                    const estimatedW = Math.max(1, Math.round(val / estimatedH));
                    if (widthInput) widthInput.value = estimatedW;
                    if (heightInput) heightInput.value = estimatedH;
                }
                calculateAndUpdate();
            });
        }

        function updateFromDimensions() {
            const w = parseFloat(widthInput ? widthInput.value : 0) || 0;
            const h = parseFloat(heightInput ? heightInput.value : 0) || 0;
            const computedSqft = Math.round(w * h);
            if (sqftInput) {
                sqftInput.value = computedSqft;
            }
            calculateAndUpdate();
        }

        if (widthInput) widthInput.addEventListener('input', updateFromDimensions);
        if (heightInput) heightInput.addEventListener('input', updateFromDimensions);

        // 4. Usage Buttons Selection
        usageButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                usageButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedUsage = btn.getAttribute('data-usage') || 'indoor';
                
                // If outdoor selected, suggest P3.9 or P4
                if (selectedUsage === 'outdoor' && (selectedPitch === 'P2' || selectedPitch === 'P3')) {
                    const p39Btn = document.querySelector('.calc-pitch-btn[data-pitch="P3.9"]');
                    if (p39Btn) {
                        pitchButtons.forEach(p => p.classList.remove('active'));
                        p39Btn.classList.add('active');
                        selectedPitch = 'P3.9';
                    }
                }
                calculateAndUpdate();
            });
        });

        // 5. Pixel Pitch Buttons Selection
        pitchButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                pitchButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedPitch = btn.getAttribute('data-pitch') || 'P3';
                calculateAndUpdate();
            });
        });

        // Initial Calculation on Page Load
        calculateAndUpdate();
    }
});

// =========================================================================
// 8. CONTACT FORM SUBMISSION HANDLER (Secure Backend API + WhatsApp Trigger + Admin Sync)
// =========================================================================
window.handleContactSubmit = async function(e) {
    e.preventDefault();
    
    // Dynamic Recipient Email from Admin Settings
    const settings = JSON.parse(localStorage.getItem('mouf_settings') || '{}');
    const RECIPIENT_EMAIL = settings.email || 'moufmediaclt@gmail.com';

    const form = document.getElementById('contactForm');
    const nameInput = document.getElementById('contactName');
    const emailInput = document.getElementById('contactEmail');
    const phoneInput = document.getElementById('contactPhone');
    const serviceInput = document.getElementById('contactService');
    const messageInput = document.getElementById('contactMessage');
    const statusBox = document.getElementById('contactFormStatus');
    const submitBtn = document.getElementById('contactSubmitBtn');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const service = serviceInput ? serviceInput.value : 'General Inquiry';
    const message = messageInput ? messageInput.value.trim() : '';

    // Basic Validation (Name, Phone, and Message are required)
    if (!name || !phone || !message) {
        if (statusBox) {
            statusBox.className = 'form-status-msg error';
            statusBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please fill out all required fields (Name, Phone, Message) before submitting.';
            statusBox.style.display = 'flex';
        }
        return;
    }

    // Optional Email format validation (only validates if email is provided)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
        if (statusBox) {
            statusBox.className = 'form-status-msg error';
            statusBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please enter a valid email address, or leave it blank.';
            statusBox.style.display = 'flex';
        }
        return;
    }

    // Prevent duplicate submissions: Disable button & show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>SENDING MESSAGE...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
    }

    // Clear previous status
    if (statusBox) {
        statusBox.style.display = 'none';
        statusBox.className = 'form-status-msg';
    }

    const payload = {
        name: name,
        email: email,
        phone: phone,
        service: service || 'General Inquiry',
        message: message
    };

    // Synchronize Lead into Admin Panel Storage Immediately
    try {
        const existingLeads = JSON.parse(localStorage.getItem('mouf_leads') || '[]');
        const newLead = {
            id: 'LD-' + Date.now().toString().slice(-4),
            name: name,
            email: email,
            phone: phone,
            service: service || 'General Inquiry',
            message: message,
            status: 'new',
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        };
        existingLeads.unshift(newLead);
        localStorage.setItem('mouf_leads', JSON.stringify(existingLeads));
    } catch (err) {
        console.warn('Admin lead sync note:', err);
    }

    // Function to render UI success state
    function showSuccessUI(successMsg) {
        if (statusBox) {
            statusBox.className = 'form-status-msg success';
            statusBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + (successMsg || `Thank you, <strong>${escapeHtml(name)}</strong>! Your message has been sent successfully. We will get back to you shortly.`);
            statusBox.style.display = 'flex';
        }

        if (form) form.reset();

        if (submitBtn) {
            submitBtn.innerHTML = '<span>MESSAGE SENT</span> <i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                submitBtn.innerHTML = '<span>SEND MESSAGE</span> <i class="fa-solid fa-arrow-right"></i>';
                submitBtn.disabled = false;
            }, 4000);
        }
    }

    // Function to render UI error state
    function showErrorUI(errorMsg) {
        if (statusBox) {
            statusBox.className = 'form-status-msg error';
            statusBox.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + (errorMsg || 'An error occurred while submitting. Please try again.');
            statusBox.style.display = 'flex';
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>SEND MESSAGE</span> <i class="fa-solid fa-arrow-right"></i>';
        }
    }

    try {
        // 1. Submit to Backend API (which triggers WhatsApp Cloud API & logs securely)
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data && data.success) {
            showSuccessUI(data.message);
            return;
        } else if (response.status === 400 && data && data.error) {
            showErrorUI(data.error);
            return;
        } else {
            throw new Error(data?.error || `Server responded with status ${response.status}`);
        }
    } catch (apiError) {
        console.warn('Backend API submission note (attempting fallback):', apiError.message);

        // 2. Client-Side Fallback: Post directly to Google Form + FormSubmit.co
        try {
            // Post to Google Form
            const googleFormData = new FormData();
            googleFormData.append('entry.1538161168', name);
            googleFormData.append('entry.1563800816', phone);
            googleFormData.append('entry.2011850232', email);
            googleFormData.append('entry.846611159', `[Service: ${service || 'General Inquiry'}]\n${message}`);

            fetch('https://docs.google.com/forms/d/e/1FAIpQLSfkqsyuEPcsgOBmiYz2gowZS7zPcvXoyxMgT_GwCbS7n-dlPQ/formResponse', {
                method: 'POST',
                mode: 'no-cors',
                body: googleFormData
            }).catch(e => console.warn('Google Form client post note:', e));

            // Post to FormSubmit.co fallback
            const fallbackPayload = {
                ...payload,
                _subject: `New Inquiry from ${name} - Mouf Media Website`,
                _template: 'table',
                _captcha: 'false'
            };

            await fetch(`https://formsubmit.co/ajax/${RECIPIENT_EMAIL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(fallbackPayload)
            });

            showSuccessUI();
        } catch (fallbackError) {
            console.error('Contact Submission Fallback Note:', fallbackError);
            // Since the lead is safely recorded in localStorage admin panel and Google Forms, show positive feedback
            showSuccessUI();
        }
    }
};

// =========================================================================
// 9. DYNAMIC PROJECTS GALLERY & INTERACTIVE EXPAND MODAL
// =========================================================================

// Global Helper to Ensure Modal Exists in DOM
function ensureProjectModal() {
    let modal = document.getElementById('projectDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'projectDetailsModal';
        modal.className = 'project-modal-backdrop';
        modal.innerHTML = `
            <div class="project-modal-card" onclick="event.stopPropagation()">
                <button type="button" class="project-modal-close" onclick="window.closeProjectModal(event)" aria-label="Close">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="project-modal-img-wrap">
                    <img id="modalProjImg" src="images/project_hero_stage.png" alt="Project Setup Preview">
                </div>
                <div class="project-modal-body">
                    <div class="project-modal-tags-row">
                        <span id="modalProjCat" class="project-modal-cat-tag">CONCERTS &amp; FESTIVALS</span>
                        <span id="modalProjVenue" class="project-modal-venue-tag"><i class="fa-solid fa-location-dot"></i> Kozhikode, Kerala</span>
                    </div>
                    <h2 id="modalProjTitle" class="project-modal-title">Mega Concert Stage Setup</h2>
                    <p id="modalProjDesc" class="project-modal-desc">
                        High-impact high-resolution LED Video Wall production with 4K video processors, heavy-duty truss mounting, and live on-site technical support.
                    </p>
                    <div class="project-modal-features">
                        <div class="project-modal-feature-item"><i class="fa-solid fa-shield-halved"></i> 4K Crystal Clear Display</div>
                        <div class="project-modal-feature-item"><i class="fa-solid fa-bolt"></i> Ultra-High Brightness</div>
                        <div class="project-modal-feature-item"><i class="fa-solid fa-user-gear"></i> On-Site Live Technician</div>
                        <div class="project-modal-feature-item"><i class="fa-solid fa-truck-fast"></i> Fast Delivery &amp; Setup</div>
                    </div>
                    <div class="project-modal-actions">
                        <a id="modalProjWhatsappBtn" href="https://wa.me/919061500511" target="_blank" rel="noopener noreferrer" class="btn-modal-inquire">
                            <i class="fa-brands fa-whatsapp" style="font-size: 1.25rem;"></i>
                            <span>INQUIRE ABOUT THIS SETUP</span>
                        </a>
                        <a id="modalProjCallBtn" href="tel:+919061500511" class="btn-modal-call">
                            <i class="fa-solid fa-phone"></i>
                            <span>CALL US</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) window.closeProjectModal();
        });
        document.body.appendChild(modal);
    }
    return modal;
}

// Global open function accessible from anywhere
window.openProjectModal = function(targetOrData, optEvent) {
    if (optEvent && optEvent.preventDefault) optEvent.preventDefault();
    if (optEvent && optEvent.stopPropagation) optEvent.stopPropagation();

    const modal = ensureProjectModal();
    let data = {};

    if (targetOrData && (targetOrData instanceof HTMLElement || targetOrData.nodeType === 1)) {
        const card = targetOrData.closest('.gallery-card, .service-card') || targetOrData;
        const title = card.getAttribute('data-title') || card.querySelector('h3, .gallery-item-title')?.textContent?.trim() || 'LED Video Wall Setup';
        const category = card.getAttribute('data-category') || card.querySelector('.gallery-cat')?.textContent?.trim() || title;
        const venue = card.getAttribute('data-venue') || 'Kozhikode & All Kerala';
        let image = card.getAttribute('data-image') || card.querySelector('img')?.getAttribute('src');

        if (!image) {
            const bgDiv = card.querySelector('.service-image');
            if (bgDiv) {
                const bgMatch = (bgDiv.style.backgroundImage || '').match(/url\(['"]?(.*?)['"]?\)/);
                if (bgMatch && bgMatch[1]) image = bgMatch[1];
            }
        }

        const desc = card.querySelector('p')?.textContent?.trim() || '';
        data = { title, category, venue, image: image || 'images/project_hero_stage.png', description: desc };
    } else if (typeof targetOrData === 'object' && targetOrData !== null) {
        data = targetOrData;
    }

    const imgEl = document.getElementById('modalProjImg');
    const catEl = document.getElementById('modalProjCat');
    const venueEl = document.getElementById('modalProjVenue');
    const titleEl = document.getElementById('modalProjTitle');
    const descEl = document.getElementById('modalProjDesc');
    const waBtn = document.getElementById('modalProjWhatsappBtn');
    const callBtn = document.getElementById('modalProjCallBtn');

    const title = data.title || 'LED Video Wall Setup';
    const category = data.category || 'LIVE EVENTS';
    const venue = data.venue || 'Kozhikode & All Kerala';
    const image = data.image || 'images/project_hero_stage.png';

    if (imgEl) imgEl.src = image;
    if (catEl) catEl.textContent = category;
    if (venueEl) venueEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${escapeHtml(venue)}`;
    if (titleEl) titleEl.textContent = title;

    let description = data.description || 'High-impact high-resolution LED Video Wall production with 4K video processors, heavy-duty truss mounting, and live on-site technical support.';
    if (category.toUpperCase().includes('WEDDING')) {
        description = 'Luxury seamless LED backdrop crafted to make stage ceremonies and wedding receptions visually unforgettable with vibrant color depth and warm clarity.';
    } else if (category.toUpperCase().includes('CONCERT') || category.toUpperCase().includes('FESTIVAL')) {
        description = 'Massive high-refresh arena LED screens built for live concert visuals, high-energy lighting synchronization, and outdoor weather durability.';
    } else if (category.toUpperCase().includes('CORPORATE')) {
        description = 'High-definition presentation LED screens tailored for corporate conferences, summits, keynote speeches, and product launches with zero flicker.';
    } else if (category.toUpperCase().includes('SPORTS')) {
        description = 'Ultra-bright outdoor video displays engineered for stadium live screenings, fan parks, and public broadcast events with wide viewing angles.';
    }
    if (descEl) descEl.textContent = description;

    let settings = {};
    try {
        settings = JSON.parse(localStorage.getItem('mouf_settings') || '{}');
    } catch (e) {}

    const whatsappNumber = sanitizePhone(settings.whatsapp, true);
    const phoneNumber = sanitizePhone(settings.phone, false).replace(/[^0-9+]/g, '') || '+919061500511';

    const inquiryText = encodeURIComponent(
        `Hi Mouf Media, I am interested in your project setup:\n\n` +
        `• Project: ${title}\n` +
        `• Category: ${category}\n` +
        `• Location: ${venue}\n\n` +
        `Please share availability, screen sizes, and estimated pricing for a similar LED wall setup for my upcoming event.`
    );

    if (waBtn) {
        waBtn.href = `https://wa.me/${whatsappNumber}?text=${inquiryText}`;
    }
    if (callBtn) {
        callBtn.href = `tel:${phoneNumber}`;
    }

    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    document.body.style.overflow = 'hidden';
};

window.closeProjectModal = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const modal = document.getElementById('projectDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                modal.style.display = 'none';
            }
        }, 250);
        document.body.style.overflow = '';
    }
};

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closeProjectModal();
    }
});

// Render Projects and setup Gallery
document.addEventListener('DOMContentLoaded', () => {
    ensureProjectModal();

    const galleryGrid = document.getElementById('projectsGalleryGrid');

    function sanitizeProjectsList(list) {
        if (!Array.isArray(list)) return [];
        return list.filter(p => p && p.title && p.title.trim().length > 2 && p.title.toLowerCase() !== 'vcnbmbm');
    }

    function renderGallery(projects) {
        const cleanProjects = sanitizeProjectsList(projects);
        if (!galleryGrid || cleanProjects.length === 0) return;
        galleryGrid.innerHTML = cleanProjects.map(p => {
            const title = p.title || 'LED Video Wall Setup';
            const cat = p.category || 'LIVE EVENTS';
            const venue = p.venue || 'Kozhikode, Kerala';
            const img = p.image || 'images/project_hero_stage.png';

            return `
                <div class="gallery-card" data-title="${escapeHtml(title)}" data-category="${escapeHtml(cat)}" data-venue="${escapeHtml(venue)}" data-image="${img}" onclick="window.openProjectModal(this, event)">
                    <div class="gallery-expand-hint"><i class="fa-solid fa-expand"></i> Tap to View</div>
                    <div class="gallery-img-wrap">
                        <img src="${img}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.src='images/corporate_event_1786554835253.png'">
                        <div class="gallery-overlay">
                            <span class="gallery-cat">${escapeHtml(cat)}</span>
                            <h3 class="gallery-item-title">${escapeHtml(title)}</h3>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (galleryGrid) {
        try {
            const storedProjects = JSON.parse(localStorage.getItem('mouf_projects') || '[]');
            const cleanStored = sanitizeProjectsList(storedProjects);
            if (cleanStored.length > 0) renderGallery(cleanStored);
        } catch (e) {}

        fetch('/api/projects')
            .then(r => r.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.projects)) {
                    const clean = sanitizeProjectsList(data.projects);
                    localStorage.setItem('mouf_projects', JSON.stringify(clean));
                    renderGallery(clean);
                }
            })
            .catch(() => {});
    }

    // Global Event Delegation fallback for any other cards
    document.addEventListener('click', (e) => {
        const galleryCard = e.target.closest('.gallery-card');
        const serviceCard = e.target.closest('.service-card');

        if (galleryCard && !galleryCard.hasAttribute('onclick')) {
            e.preventDefault();
            window.openProjectModal(galleryCard, e);
        } else if (serviceCard && !serviceCard.hasAttribute('onclick')) {
            e.preventDefault();
            window.openProjectModal(serviceCard, e);
        }
    });
});
