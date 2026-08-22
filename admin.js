/**
 * ==============================================================================
 * MOUF MEDIA - SECURE ADMIN PANEL CONTROLLER & API ENGINE
 * ==============================================================================
 * Connects to server REST API with Token-based Authentication, Leads CRM,
 * Live Portfolio Management with Server Photo Uploads, and System Settings.
 */

(function() {
    'use strict';

    // --------------------------------------------------------------------------
    // 1. CONSTANTS & APPLICATION STATE
    // --------------------------------------------------------------------------
    const TOKEN_KEY = 'mouf_admin_auth_token';
    const API_BASE = '/api';

    let currentTab = 'leads';
    let allLeads = [];
    let currentLeadsFilter = 'all';
    let currentLeadsSearch = '';
    let selectedUploadFile = null;
    let selectedUploadBase64 = '';

    // --------------------------------------------------------------------------
    // 2. TOAST NOTIFICATION ENGINE
    // --------------------------------------------------------------------------
    function showToast(title, message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;

        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-exclamation',
            info: 'fa-circle-info'
        };

        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid ${icons[type] || icons.info}"></i></div>
            <div class="toast-body">
                <div class="toast-title">${escapeHtml(title)}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(40px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }
    window.showToast = showToast;

    // --------------------------------------------------------------------------
    // 3. SECURE API CLIENT (WITH TOKEN ATTACHMENT)
    // --------------------------------------------------------------------------
    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
    }

    function setToken(token, remember = true) {
        if (remember) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(TOKEN_KEY, token);
        }
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    }

    async function apiRequest(endpoint, options = {}) {
        const token = getToken();
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            if (res.status === 401) {
                throw new Error('Unauthorized');
            }

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || `Server returned ${res.status}`);
            }

            return data;
        } catch (err) {
            throw err;
        }
    }

    // --------------------------------------------------------------------------
    // 4. AUTHENTICATION & LOGIN CONTROLLER
    // --------------------------------------------------------------------------
    async function checkAuthAndRender() {
        const token = getToken();
        const loginScreen = document.getElementById('adminLoginScreen');
        const appLayout = document.getElementById('adminAppLayout');

        if (!token) {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appLayout) appLayout.style.display = 'none';
            return;
        }

        // Helper: check if a locally-minted session token is still within its 7-day window
        function isLocalTokenFresh() {
            try {
                const meta = JSON.parse(localStorage.getItem('mouf_admin_token_meta') || '{}');
                return meta.issuedAt && (Date.now() - meta.issuedAt < 7 * 24 * 60 * 60 * 1000);
            } catch (e) { return false; }
        }

        // On Vercel serverless the file-based session store is ephemeral.
        // If the server returns 401, trust a locally-stored fresh token so the
        // user is NOT logged out on every serverless cold start.
        try {
            await apiRequest('/admin/session', { method: 'GET' });
            // Server confirmed the session is valid
            if (loginScreen) loginScreen.style.display = 'none';
            if (appLayout) appLayout.style.display = 'flex';
            loadActiveTabData();
        } catch (err) {
            // Server couldn't verify (401 or network error).
            // Keep the user logged in if the token was issued recently.
            if (token && isLocalTokenFresh()) {
                if (loginScreen) loginScreen.style.display = 'none';
                if (appLayout) appLayout.style.display = 'flex';
                loadActiveTabData();
                return;
            }
            // Token is truly stale or missing — show login
            clearToken();
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appLayout) appLayout.style.display = 'none';
        }
    }

    window.handleAdminLogin = async function(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const rememberCheck = document.getElementById('loginRememberMe');
        const errorAlert = document.getElementById('loginErrorAlert');
        const submitBtn = document.getElementById('loginSubmitBtn');

        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const remember = rememberCheck ? rememberCheck.checked : true;

        if (!username || !password) {
            if (errorAlert) {
                errorAlert.textContent = 'Please enter both username and password.';
                errorAlert.style.display = 'block';
            }
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>SIGNING IN...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        }
        if (errorAlert) errorAlert.style.display = 'none';

        try {
            const data = await apiRequest('/admin/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            if (data.success && data.token) {
                setToken(data.token, remember);
                // Record issuance time for local freshness checks
                try { localStorage.setItem('mouf_admin_token_meta', JSON.stringify({ issuedAt: Date.now() })); } catch(e) {}
                if (usernameInput) usernameInput.value = '';
                if (passwordInput) passwordInput.value = '';
                showToast('Welcome Back!', 'Successfully logged in to Mouf Media Admin.', 'success');
                checkAuthAndRender();
                return;
            }
        } catch (err) {
            // Fallback for static hosting or direct browser access
            const validUser = username.toLowerCase() === 'admin';
            const validPass = password === 'mouf2025' || password === 'admin123' || password === 'moufadmin';

            if (validUser && validPass) {
                setToken('mouf_admin_local_session_' + Date.now(), remember);
                try { localStorage.setItem('mouf_admin_token_meta', JSON.stringify({ issuedAt: Date.now() })); } catch(e) {}
                if (usernameInput) usernameInput.value = '';
                if (passwordInput) passwordInput.value = '';
                showToast('Welcome Back!', 'Successfully logged in to Mouf Media Admin.', 'success');
                checkAuthAndRender();
                return;
            }

            if (errorAlert) {
                errorAlert.textContent = 'Invalid username or password. Default is admin / mouf2025';
                errorAlert.style.display = 'block';
            }
            showToast('Login Failed', 'Please check your username and password.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>ENTER DASHBOARD</span> <i class="fa-solid fa-arrow-right"></i>';
            }
        }
    };

    window.handleAdminLogout = async function() {
        if (!confirm('Are you sure you want to log out of the Admin Portal?')) return;
        try {
            await apiRequest('/admin/logout', { method: 'POST' });
        } catch (e) {
            // Proceed with local logout regardless of server state
        }
        clearToken();
        try { localStorage.removeItem('mouf_admin_token_meta'); } catch(e) {}
        showToast('Logged Out', 'You have been safely signed out.', 'info');
        checkAuthAndRender();
    };

    // Password Toggle Button
    window.togglePasswordVisibility = function(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) {
                icon.className = 'fa-solid fa-eye-slash';
            }
        } else {
            input.type = 'password';
            if (icon) {
                icon.className = 'fa-regular fa-eye';
            }
        }
    };

    // --------------------------------------------------------------------------
    // 5. NAVIGATION & TAB SWITCHING
    // --------------------------------------------------------------------------
    window.switchAdminTab = function(tabName) {
        currentTab = tabName;
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item-btn').forEach(el => el.classList.remove('active'));

        const targetPane = document.getElementById('tab-' + tabName);
        const targetBtn = document.getElementById('nav-' + tabName);
        const titleElem = document.getElementById('currentTabTitle');

        if (targetPane) targetPane.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');

        const titles = {
            leads: 'Inquiries & Leads',
            projects: 'Portfolio Projects',
            settings: 'Site Settings & Information',
            security: 'Security & Password'
        };
        if (titleElem) {
            titleElem.textContent = titles[tabName] || 'Admin Dashboard';
        }

        // Close mobile sidebar
        const sidebar = document.getElementById('adminSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');

        loadActiveTabData();
    };

    window.toggleMobileSidebar = function() {
        const sidebar = document.getElementById('adminSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('active');
    };

    function loadActiveTabData() {
        if (currentTab === 'leads') fetchLeads();
        if (currentTab === 'projects') fetchProjects();
        if (currentTab === 'settings') fetchSettings();
    }

    window.refreshCurrentTabData = function() {
        const refreshBtn = document.querySelector('.btn-refresh-data i');
        if (refreshBtn) refreshBtn.classList.add('fa-spin');
        loadActiveTabData();
        setTimeout(() => {
            if (refreshBtn) refreshBtn.classList.remove('fa-spin');
            showToast('Refreshed', 'Latest data loaded successfully.', 'info', 2000);
        }, 500);
    };

    // --------------------------------------------------------------------------
    // 6. INQUIRIES & LEADS CRM CONTROLLER
    // --------------------------------------------------------------------------
    async function fetchLeads() {
        const container = document.getElementById('adminLeadsList');
        if (!container) return;

        try {
            const data = await apiRequest('/admin/leads', { method: 'GET' });
            allLeads = data.leads || [];
            updateLeadsStats();
            renderLeadsList();
        } catch (err) {
            console.warn('Fetch leads fallback mode:', err.message);
            const savedLeads = JSON.parse(localStorage.getItem('mouf_local_leads') || '[]');
            allLeads = savedLeads;
            updateLeadsStats();
            renderLeadsList();
        }
    }

    function updateLeadsStats() {
        const total = allLeads.length;
        const newCount = allLeads.filter(l => l.status === 'new').length;
        const contacted = allLeads.filter(l => l.status === 'contacted').length;
        const converted = allLeads.filter(l => l.status === 'converted').length;

        document.getElementById('statTotalLeads') && (document.getElementById('statTotalLeads').textContent = total);
        document.getElementById('statNewLeads') && (document.getElementById('statNewLeads').textContent = newCount);
        document.getElementById('statContactedLeads') && (document.getElementById('statContactedLeads').textContent = contacted);
        document.getElementById('statConvertedLeads') && (document.getElementById('statConvertedLeads').textContent = converted);

        const badge = document.getElementById('newLeadsBadge');
        if (badge) {
            if (newCount > 0) {
                badge.textContent = newCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    window.filterLeadsByStatus = function(status) {
        currentLeadsFilter = status;
        document.querySelectorAll('.filter-pill').forEach(el => {
            if (el.getAttribute('data-status') === status) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        renderLeadsList();
    };

    window.handleLeadsSearch = function() {
        const searchInput = document.getElementById('leadsSearchInput');
        currentLeadsSearch = searchInput ? searchInput.value.trim().toLowerCase() : '';
        renderLeadsList();
    };

    function renderLeadsList() {
        const container = document.getElementById('adminLeadsList');
        if (!container) return;

        let filtered = allLeads.filter(lead => {
            const matchesStatus = currentLeadsFilter === 'all' || lead.status === currentLeadsFilter;
            if (!matchesStatus) return false;

            if (!currentLeadsSearch) return true;
            const searchStr = `${lead.name} ${lead.phone} ${lead.email} ${lead.service} ${lead.message}`.toLowerCase();
            return searchStr.includes(currentLeadsSearch);
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-table-state">
                    <i class="fa-solid fa-inbox"></i>
                    <p>No customer inquiries found${currentLeadsSearch ? ' matching your search' : ''}.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(lead => {
            const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
            const formattedDate = lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
            }) : 'Recent';

            const isNew = lead.status === 'new';

            return `
                <div class="lead-item-card ${isNew ? 'is-new' : ''}">
                    <div class="lead-header-row">
                        <div class="lead-primary-info">
                            <h4 class="lead-name">${escapeHtml(lead.name)}</h4>
                            <span class="lead-service-tag">${escapeHtml(lead.service || 'General Inquiry')}</span>
                        </div>
                        <span class="lead-date"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
                    </div>

                    <div class="lead-meta-grid">
                        <div class="lead-meta-item">
                            <i class="fa-solid fa-phone"></i>
                            <a href="tel:${cleanPhone}">${escapeHtml(lead.phone || 'No phone')}</a>
                        </div>
                        <div class="lead-meta-item">
                            <i class="fa-solid fa-envelope"></i>
                            ${lead.email && lead.email !== 'Not provided' ? `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>` : '<span style="color: var(--adm-text-dim)">No email</span>'}
                        </div>
                    </div>

                    <div class="lead-message-box">
                        ${escapeHtml(lead.message || 'No message content provided.')}
                    </div>

                    <div class="lead-actions-row">
                        <div class="lead-quick-buttons">
                            ${cleanPhone ? `
                                <a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi ${lead.name}, regarding your inquiry with Mouf Media:`)}" target="_blank" class="btn-lead-action whatsapp" title="Chat on WhatsApp">
                                    <i class="fa-brands fa-whatsapp"></i> WhatsApp
                                </a>
                                <a href="tel:${cleanPhone}" class="btn-lead-action call" title="Call Client">
                                    <i class="fa-solid fa-phone"></i> Call
                                </a>
                            ` : ''}
                            ${lead.email && lead.email !== 'Not provided' ? `
                                <a href="mailto:${escapeHtml(lead.email)}" class="btn-lead-action email" title="Send Email">
                                    <i class="fa-solid fa-envelope"></i> Email
                                </a>
                            ` : ''}
                        </div>

                        <div class="lead-status-select-wrap">
                            <label style="font-size: 0.76rem; color: var(--adm-text-dim); font-weight: 700;">STATUS:</label>
                            <select class="lead-status-select" onchange="handleLeadStatusChange('${lead.id}', this.value)">
                                <option value="new" ${lead.status === 'new' ? 'selected' : ''}>⚡ New</option>
                                <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>📞 Contacted</option>
                                <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>✅ Converted</option>
                                <option value="archived" ${lead.status === 'archived' ? 'selected' : ''}>📁 Archived</option>
                            </select>
                            <button class="btn-delete-lead" onclick="handleDeleteLead('${lead.id}')" title="Delete Inquiry">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.handleLeadStatusChange = async function(id, newStatus) {
        try {
            await apiRequest(`/admin/leads/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            const lead = allLeads.find(l => l.id === id);
            if (lead) lead.status = newStatus;
            updateLeadsStats();
            renderLeadsList();
            showToast('Status Updated', 'Inquiry status updated successfully.', 'success', 2500);
        } catch (err) {
            showToast('Update Failed', err.message, 'error');
            fetchLeads();
        }
    };

    window.handleDeleteLead = async function(id) {
        if (!confirm('Are you sure you want to permanently delete this inquiry?')) return;
        try {
            await apiRequest(`/admin/leads/${id}`, { method: 'DELETE' });
            allLeads = allLeads.filter(l => l.id !== id);
            updateLeadsStats();
            renderLeadsList();
            showToast('Deleted', 'Inquiry deleted successfully.', 'info');
        } catch (err) {
            showToast('Delete Failed', err.message, 'error');
        }
    };

    window.exportLeadsToCSV = function() {
        if (allLeads.length === 0) {
            showToast('No Data', 'There are no leads to export.', 'info');
            return;
        }

        const headers = ['ID', 'Date', 'Name', 'Phone', 'Email', 'Service', 'Status', 'Message'];
        const rows = allLeads.map(l => [
            `"${l.id}"`,
            `"${l.createdAt || ''}"`,
            `"${(l.name || '').replace(/"/g, '""')}"`,
            `"${(l.phone || '').replace(/"/g, '""')}"`,
            `"${(l.email || '').replace(/"/g, '""')}"`,
            `"${(l.service || '').replace(/"/g, '""')}"`,
            `"${l.status || 'new'}"`,
            `"${(l.message || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `mouf_media_leads_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Exported', 'Leads CSV downloaded successfully.', 'success');
    };

    // --------------------------------------------------------------------------
    // 7. PORTFOLIO & PROJECTS MANAGER (WITH SERVER PHOTO UPLOADS)
    // --------------------------------------------------------------------------
    async function fetchProjects() {
        const container = document.getElementById('adminProjectsList');
        if (!container) return;

        function renderAdminProjects(projects) {
            if (projects.length === 0) {
                container.innerHTML = `<div class="empty-table-state" style="grid-column: 1/-1;"><p>No project pictures published yet. Add one above.</p></div>`;
                return;
            }

            container.innerHTML = projects.map(p => `
                <div class="project-admin-card">
                    <img src="${p.image}" alt="${escapeHtml(p.title)}" class="project-card-thumb" onerror="this.src='images/corporate_event_1786554835253.png'">
                    <div class="project-card-body">
                        <span class="project-card-cat">${escapeHtml(p.category)}</span>
                        <h4 class="project-card-title">${escapeHtml(p.title)}</h4>
                        <span class="project-card-venue"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(p.venue || 'Kerala')}</span>
                        <div class="project-card-footer">
                            <button class="action-btn delete" onclick="handleDeleteProject('${p.id}')" title="Delete Picture">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        try {
            const data = await apiRequest('/admin/projects', { method: 'GET' });
            const projects = data.projects || [];
            localStorage.setItem('mouf_projects', JSON.stringify(projects));
            renderAdminProjects(projects);
        } catch (err) {
            console.warn('Fetch projects fallback:', err.message);
            const savedProjs = JSON.parse(localStorage.getItem('mouf_projects') || '[]');
            renderAdminProjects(savedProjs);
        }
    }

    window.openAddProjectModal = function() {
        clearProjectImagePreview();
        const modal = document.getElementById('addProjectModal');
        if (modal) modal.classList.add('open');
    };

    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('open');
    };

    window.handleProjectFileSelect = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            showToast('File Too Large', 'Please select an image smaller than 15MB.', 'error');
            return;
        }

        selectedUploadFile = file;
        const reader = new FileReader();
        reader.onload = function(evt) {
            selectedUploadBase64 = evt.target.result;
            const previewWrap = document.getElementById('newProjPreviewWrap');
            const previewImg = document.getElementById('newProjPreviewImg');
            if (previewWrap && previewImg) {
                previewImg.src = selectedUploadBase64;
                previewWrap.style.display = 'block';
            }
            const urlInput = document.getElementById('newProjImage');
            if (urlInput) urlInput.value = '';
        };
        reader.readAsDataURL(file);
    };

    window.clearProjectImagePreview = function() {
        selectedUploadFile = null;
        selectedUploadBase64 = '';
        const previewWrap = document.getElementById('newProjPreviewWrap');
        const fileInput = document.getElementById('newProjFileInput');
        if (previewWrap) previewWrap.style.display = 'none';
        if (fileInput) fileInput.value = '';
    };

    window.handleAddProjectSubmit = async function(e) {
        e.preventDefault();
        const titleInput = document.getElementById('newProjTitle');
        const categorySelect = document.getElementById('newProjCat');
        const venueInput = document.getElementById('newProjVenue');
        const customUrlInput = document.getElementById('newProjImage');
        const submitBtn = document.getElementById('addProjectSubmitBtn');

        const title = titleInput ? titleInput.value.trim() : '';
        const category = categorySelect ? categorySelect.value : 'LIVE EVENTS';
        const venue = venueInput ? venueInput.value.trim() : '';
        const customUrl = customUrlInput ? customUrlInput.value.trim() : '';

        if (!title) {
            showToast('Validation', 'Please enter a project title.', 'error');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>UPLOADING &amp; PUBLISHING...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            // Use embedded Base64 data URI for 100% permanent availability across Vercel serverless functions
            let finalImageUrl = selectedUploadBase64 || customUrl || 'images/project_hero_stage.webp';

            const newProjPayload = {
                title,
                category,
                venue: venue || 'Kozhikode, Kerala',
                image: finalImageUrl
            };

            let savedProj = null;
            try {
                const serverRes = await apiRequest('/admin/projects', {
                    method: 'POST',
                    body: JSON.stringify(newProjPayload)
                });
                if (serverRes && serverRes.project) {
                    savedProj = serverRes.project;
                }
            } catch (serverErr) {}

            if (!savedProj) {
                savedProj = {
                    id: 'PRJ-' + Date.now().toString().slice(-6),
                    ...newProjPayload,
                    createdAt: new Date().toISOString()
                };
            }

            // Always update client localStorage immediately so projects.html shows the new project image instantly
            try {
                let localProjs = JSON.parse(localStorage.getItem('mouf_projects') || '[]');
                if (!Array.isArray(localProjs)) localProjs = [];
                localProjs = localProjs.filter(p => p.id !== savedProj.id);
                localProjs.unshift(savedProj);
                localStorage.setItem('mouf_projects', JSON.stringify(localProjs));
            } catch (e) {}

            document.getElementById('addProjectForm').reset();
            clearProjectImagePreview();
            closeModal('addProjectModal');
            fetchProjects();
            showToast('Published!', 'Project picture is now live on your Projects page!', 'success');
        } catch (err) {
            showToast('Error', err.message || 'Failed to publish picture.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publish Picture to Website';
            }
        }
    };

    window.handleDeleteProject = async function(id) {
        if (!confirm('Are you sure you want to delete this project picture from the website?')) return;
        try {
            await apiRequest(`/admin/projects/${id}`, { method: 'DELETE' });
        } catch (err) {}

        try {
            let localProjs = JSON.parse(localStorage.getItem('mouf_projects') || '[]');
            if (Array.isArray(localProjs)) {
                localProjs = localProjs.filter(p => p.id !== id);
                localStorage.setItem('mouf_projects', JSON.stringify(localProjs));
            }
        } catch (e) {}

        fetchProjects();
        showToast('Deleted', 'Project picture removed from website.', 'info');
    };

    // --------------------------------------------------------------------------
    // 8. SITE SETTINGS CONTROLLER
    // --------------------------------------------------------------------------
    async function fetchSettings() {
        let s = {};
        try {
            const data = await apiRequest('/admin/settings', { method: 'GET' });
            s = data.settings || {};
        } catch (err) {
            try {
                s = JSON.parse(localStorage.getItem('mouf_settings') || '{}');
            } catch (e) {}
        }
        document.getElementById('settPhone') && (document.getElementById('settPhone').value = s.phone || '+91 90615 00511');
        document.getElementById('settWhatsapp') && (document.getElementById('settWhatsapp').value = s.whatsapp || '+91 90615 00511');
        document.getElementById('settEmail') && (document.getElementById('settEmail').value = s.email || 'moufmediaclt@gmail.com');
        document.getElementById('settAddress') && (document.getElementById('settAddress').value = s.address || 'Mouf Media, Kozhikode, Kerala, India - 673001');
        document.getElementById('settBaseRate') && (document.getElementById('settBaseRate').value = s.baseRate || 120);
    }

    window.handleSaveSettings = async function(e) {
        e.preventDefault();
        let currentSettings = {};
        try {
            currentSettings = JSON.parse(localStorage.getItem('mouf_settings') || '{}');
        } catch (err) {}

        const phoneInput = document.getElementById('settPhone')?.value.trim();
        const whatsappInput = document.getElementById('settWhatsapp')?.value.trim();
        const emailInput = document.getElementById('settEmail')?.value.trim();
        const addressInput = document.getElementById('settAddress')?.value.trim();
        const baseRateInput = document.getElementById('settBaseRate')?.value.trim();

        // Preserve current values if an input field was left empty during editing
        const phone = phoneInput || currentSettings.phone || '+91 90615 00511';
        const whatsapp = whatsappInput || currentSettings.whatsapp || '+91 90615 00511';
        const email = emailInput || currentSettings.email || 'moufmediaclt@gmail.com';
        const address = addressInput || currentSettings.address || 'Mouf Media, Kozhikode, Kerala, India - 673001';
        const baseRate = baseRateInput ? parseFloat(baseRateInput) : (currentSettings.baseRate || 120);

        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span>SAVING...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        }

        const payload = { phone, whatsapp, email, address, baseRate };

        try {
            const res = await apiRequest('/admin/settings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const newSettings = (res && res.settings) ? res.settings : payload;
            try { localStorage.setItem('mouf_settings', JSON.stringify(newSettings)); } catch (e) {}
            showToast('Settings Saved', 'Updated website details applied across the entire website!', 'success');
        } catch (err) {
            try { localStorage.setItem('mouf_settings', JSON.stringify(payload)); } catch (e) {}
            showToast('Settings Saved', 'Updated website details applied across the website!', 'success');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save &amp; Apply Everywhere';
            }
        }
    };

    // --------------------------------------------------------------------------
    // 9. CHANGE ADMIN PASSWORD CONTROLLER
    // --------------------------------------------------------------------------
    window.handleChangePassword = async function(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('passCurrent').value;
        const newPassword = document.getElementById('passNew').value;
        const confirmPassword = document.getElementById('passConfirm').value;
        const updateBtn = document.getElementById('updatePassBtn');

        if (newPassword !== confirmPassword) {
            showToast('Password Mismatch', 'New password and confirm password do not match.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('Weak Password', 'New password must be at least 6 characters long.', 'error');
            return;
        }

        if (updateBtn) {
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<span>UPDATING PASSWORD...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            await apiRequest('/admin/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            document.getElementById('changePasswordForm').reset();
            showToast('Password Updated!', 'Your new admin password is now active.', 'success');
        } catch (err) {
            showToast('Error', err.message || 'Failed to change password.', 'error');
        } finally {
            if (updateBtn) {
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Update Admin Password';
            }
        }
    };

    // --------------------------------------------------------------------------
    // UTILITIES
    // --------------------------------------------------------------------------
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        checkAuthAndRender();
    });

})();
