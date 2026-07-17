// API Base URL
const API_URL = '';

// Application State
const state = {
    activePage: 'dashboard',
    activeBidId: null,
    activeDetailTab: 'requirements',
    bids: [],
    requirements: [],
    tasks: [],
    documents: [],
    certificates: [],
    dashboardData: null,
    charts: {},
    currentUser: null
};

// DOM Elements
const pageContent = document.getElementById('page-content');
const breadcrumb = document.getElementById('header-breadcrumb');
const navItems = document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-footer .nav-item');
const reqModal = document.getElementById('requirement-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const saveModalBtn = document.getElementById('save-modal-btn');

// Create Bid Modal Elements
const createBidModal = document.getElementById('create-bid-modal');
const closeBidModalBtn = document.getElementById('close-bid-modal-btn');
const cancelBidModalBtn = document.getElementById('cancel-bid-modal-btn');
const saveNewBidBtn = document.getElementById('save-new-bid-btn');

// Page Title Mapping
const breadcrumbMap = {
    'dashboard': 'Dashboard / Overview',
    'tasks': 'My Tasks / Operations Workspace',
    'bids': 'Bids / Opportunity Management',
    'knowledge': 'Knowledge Repository / Vector Index',
    'documents': 'Document Repository / Version Control',
    'certificates': 'Certificates / Compliance Tracking',
    'sources': 'Knowledge Sources / Data Ingestion',
    'analytics': 'Analytics / SME Productivity & Portfolio',
    'admin': 'Administration / User Roles & Governance',
    'settings': 'Configuration / AI Model Setup',
    'notifications': 'Notifications / Workspace Alerts',
    'help': 'Help & Support / Documentation'
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupModal();
    setupCreateBidModal();
    setupPreviewModal();
    setupAuth(); // Authenticate user and setup session listener
    
    // Bell icon navigation helper
    const bellIcon = document.getElementById('bell-icon');
    if (bellIcon) {
        bellIcon.addEventListener('click', () => {
            navItems.forEach(nav => {
                if (nav.getAttribute('data-page') === 'notifications') {
                    nav.classList.add('active');
                } else {
                    nav.classList.remove('active');
                }
            });
            navigate('notifications');
        });
    }
    
    // Periodically refresh badges
    setInterval(refreshBadges, 15000);
});

// Setup Navigation Routing
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const page = item.getAttribute('data-page');
            if (!page) return;
            
            // Update active state in sidebar
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Reset active bid state when navigating away from bids
            if (page !== 'bids') {
                state.activeBidId = null;
            }
            
            navigate(page);
        });
    });
}

function navigate(page) {
    // Role-Based Access Control Guard
    if (state.currentUser && state.currentUser.role === 'SME') {
        if (['dashboard', 'bids', 'analytics', 'admin'].includes(page)) {
            renderAccessDenied();
            breadcrumb.textContent = 'Access Denied / System Governance';
            return;
        }
    }

    state.activePage = page;
    breadcrumb.textContent = breadcrumbMap[page] || 'BidGenius AI';
    
    // Clean up existing charts to prevent memory leaks
    destroyCharts();
    
    if (page === 'dashboard') {
        loadDashboard();
    } else if (page === 'tasks') {
        loadTasks();
    } else if (page === 'bids') {
        if (state.activeBidId) {
            loadBidDetail(state.activeBidId);
        } else {
            loadBids();
        }
    } else if (page === 'knowledge') {
        loadKnowledge();
    } else if (page === 'documents') {
        loadDocuments();
    } else if (page === 'certificates') {
        loadCertificates();
    } else if (page === 'sources') {
        loadSources();
    } else if (page === 'analytics') {
        loadAnalytics();
    } else if (page === 'settings') {
        loadSettings();
    } else if (page === 'admin') {
        loadAdmin();
    } else if (page === 'notifications') {
        loadNotifications();
    } else if (page === 'help') {
        loadHelp();
    } else {
        renderPlaceholderPage(page);
    }
}

// Global Badges refresher (Sidebar task counts)
async function refreshBadges() {
    try {
        const dashboardRes = await fetch(`${API_URL}/api/dashboard`);
        const dashboard = await dashboardRes.json();
        
        const bidsRes = await fetch(`${API_URL}/api/bids`);
        const bids = await bidsRes.json();
        
        document.getElementById('tasks-badge').textContent = dashboard.pendingTasksCount;
        document.getElementById('bids-badge').textContent = bids.length;
        
        // Refresh notifications count
        const notifRes = await fetch(`${API_URL}/api/notifications`);
        if (notifRes.ok) {
            const notifications = await notifRes.json();
            const unreadCount = notifications.filter(n => !n.is_read).length;
            
            const notifBadge = document.getElementById('notif-badge');
            if (notifBadge) {
                notifBadge.textContent = unreadCount;
                notifBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            }
            
            const bellBadge = document.querySelector('.bell-badge');
            if (bellBadge) {
                bellBadge.textContent = unreadCount;
                bellBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            }
        }
    } catch (err) {
        console.error("Failed to load badges:", err);
    }
}

// -------------------------------------------------------------
// PAGE 1: DASHBOARD
// -------------------------------------------------------------
async function loadDashboard() {
    pageContent.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:300px;">
            <div style="font-size:16px; color:var(--text-muted);">Loading Dashboard...</div>
        </div>
    `;
    
    try {
        const res = await fetch(`${API_URL}/api/dashboard`);
        const data = await res.json();
        state.dashboardData = data;
        
        renderDashboard(data);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading dashboard: ${err.message}</div>`;
    }
}

function renderDashboard(data) {
    pageContent.innerHTML = `
        <!-- Welcome banner -->
        <div class="welcome-card">
            <h1>Welcome back, Priya</h1>
            <p>You have ${data.pendingTasksCount} tasks pending, 3 deadlines this week, and an active win-rate of ${data.winRate}%.</p>
        </div>
        
        <!-- Stats Widgets -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon pending"><i data-lucide="check-square"></i></div>
                <div class="stat-details">
                    <h3>Pending Tasks</h3>
                    <div class="stat-number">${data.pendingTasksCount}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon deadlines"><i data-lucide="calendar"></i></div>
                <div class="stat-details">
                    <h3>Deadlines This Week</h3>
                    <div class="stat-number">${data.deadlinesThisWeek}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon winrate"><i data-lucide="trending-up"></i></div>
                <div class="stat-details">
                    <h3>Active Win-Rate</h3>
                    <div class="stat-number">${data.winRate}%</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon generations"><i data-lucide="cpu"></i></div>
                <div class="stat-details">
                    <h3>Generations (7d)</h3>
                    <div class="stat-number">${data.generationsThisWeek}</div>
                </div>
            </div>
        </div>
        
        <!-- Charts -->
        <div class="charts-grid">
            <div class="chart-card">
                <div class="chart-header">
                    <h3>Submitted vs Won — Last 6 Months</h3>
                </div>
                <div class="chart-container">
                    <canvas id="submittedVsWonChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-header">
                    <h3>From Qualification to Submitted</h3>
                </div>
                <div class="chart-container">
                    <canvas id="qualToSubChart"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Upcoming Bids Table -->
        <div class="upcoming-bids-section">
            <div class="table-header-row">
                <h3>Bids Due in the Next 30 Days</h3>
                <a class="view-all-link" id="dashboard-view-all-bids">View all bids</a>
            </div>
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Bid Code</th>
                            <th>Bid Name</th>
                            <th>Submission Date</th>
                            <th>Complexity</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="dashboard-bids-tbody">
                        ${data.upcomingBids.map(bid => `
                            <tr data-bid-id="${bid.bid_id}" style="cursor:pointer;" class="dashboard-bid-row">
                                <td><span class="bid-card-code">${bid.bid_code}</span></td>
                                <td style="font-weight:600;">${bid.bid_name}</td>
                                <td>${formatDate(bid.bid_submission_date)}</td>
                                <td><span class="badge ${bid.complexity.toLowerCase()}">${bid.complexity}</span></td>
                                <td><span class="badge ${bid.overall_status.toLowerCase()}">${bid.overall_status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Initialize icons
    lucide.createIcons();
    
    // Draw charts
    renderDashboardCharts(data.charts);
    
    // Add Click listeners
    document.getElementById('dashboard-view-all-bids').addEventListener('click', () => {
        const bidsNav = document.querySelector('.sidebar-nav [data-page="bids"]');
        if (bidsNav) bidsNav.click();
    });
    
    document.querySelectorAll('.dashboard-bid-row').forEach(row => {
        row.addEventListener('click', () => {
            const bidId = row.getAttribute('data-bid-id');
            state.activeBidId = parseInt(bidId);
            const bidsNav = document.querySelector('.sidebar-nav [data-page="bids"]');
            if (bidsNav) bidsNav.click();
        });
    });
}

function renderDashboardCharts(chartData) {
    const ctx1 = document.getElementById('submittedVsWonChart').getContext('2d');
    state.charts.submittedVsWon = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: chartData.submittedVsWon.map(d => d.name),
            datasets: [
                {
                    label: 'Submitted',
                    data: chartData.submittedVsWon.map(d => d.submitted),
                    backgroundColor: '#818cf8',
                    borderRadius: 4
                },
                {
                    label: 'Won',
                    data: chartData.submittedVsWon.map(d => d.won),
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });

    const ctx2 = document.getElementById('qualToSubChart').getContext('2d');
    state.charts.qualToSub = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: chartData.qualificationToSubmitted.map(d => d.name),
            datasets: [
                {
                    label: 'Qualified',
                    data: chartData.qualificationToSubmitted.map(d => d.qualified),
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Submitted',
                    data: chartData.qualificationToSubmitted.map(d => d.submitted),
                    borderColor: '#4f46e5',
                    backgroundColor: 'transparent',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function destroyCharts() {
    for (const key in state.charts) {
        if (state.charts[key]) {
            state.charts[key].destroy();
            state.charts[key] = null;
        }
    }
}

// -------------------------------------------------------------
// PAGE 2: BIDS LIST
// -------------------------------------------------------------
async function loadBids() {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Loading Bids Portfolio...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/bids`);
        const bids = await res.json();
        state.bids = bids;
        
        renderBidsList(bids);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading bids: ${err.message}</div>`;
    }
}

function renderBidsList(bids) {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Bids</h1>
                <div class="page-header-desc">${bids.length} bids active · ${bids.filter(b => b.overall_status === 'Active').length} in flight</div>
            </div>
            <div style="display:flex; gap:12px;">
                <button class="btn btn-secondary" id="sync-bids-btn"><i data-lucide="refresh-cw"></i> Sync Folders</button>
                <button class="btn btn-primary" id="create-bid-btn"><i data-lucide="plus"></i> Create Bid</button>
            </div>
        </div>
        
        <div class="bids-grid" id="bids-grid-container">
            ${bids.map(bid => {
                const progressPct = bid.requirements_count > 0 ? Math.round((bid.completed_count / bid.requirements_count) * 100) : 0;
                return `
                    <div class="bid-grid-card" data-bid-id="${bid.bid_id}">
                        <div class="bid-card-header" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                            <div>
                                <span class="bid-card-code">${bid.bid_code}</span>
                                <span class="badge ${bid.overall_status.toLowerCase()}">${bid.overall_status}</span>
                            </div>
                            <button class="delete-bid-btn" data-bid-id="${bid.bid_id}" title="Delete Bid" style="background:none; border:none; color:var(--error); cursor:pointer; padding:4px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition: background 0.2s;">
                                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                            </button>
                        </div>
                        <div class="bid-card-title">${bid.bid_name}</div>
                        
                        <div class="bid-card-meta">
                            <div class="bid-card-meta-item">
                                <i data-lucide="user"></i>
                                <span>Manager: <strong>${bid.bid_manager}</strong></span>
                            </div>
                            <div class="bid-card-meta-item">
                                <i data-lucide="calendar"></i>
                                <span>Due: <strong>${formatDate(bid.bid_submission_date)}</strong></span>
                            </div>
                            <div class="bid-card-meta-item">
                                <i data-lucide="activity"></i>
                                <span>Complexity: <strong>${bid.complexity}</strong></span>
                            </div>
                        </div>
                        
                        <div class="bid-card-progress-bar">
                            <div class="bid-card-progress-fill" style="width: ${progressPct}%"></div>
                        </div>
                        <div class="bid-card-progress-text">
                            <span>SME Approvals</span>
                            <span>${progressPct}% (${bid.completed_count}/${bid.requirements_count})</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    lucide.createIcons();
    
    // Add Click listeners
    document.querySelectorAll('.bid-grid-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Ignore click if it came from the delete button
            if (e.target.closest('.delete-bid-btn')) return;
            
            const bidId = card.getAttribute('data-bid-id');
            state.activeBidId = parseInt(bidId);
            loadBidDetail(state.activeBidId);
        });
    });
    
    // Add Delete Click listeners
    document.querySelectorAll('.delete-bid-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const bidId = btn.getAttribute('data-bid-id');
            if (confirm("Are you sure you want to delete this bid and all its extracted requirements? This action cannot be undone.")) {
                try {
                    const res = await fetch(`${API_URL}/api/bids/${bidId}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        toastNotify("Bid deleted successfully");
                        loadBids();
                        refreshBadges();
                    } else {
                        const err = await res.json();
                        alert("Failed to delete bid: " + (err.detail || "Unknown error"));
                    }
                } catch (err) {
                    alert("Failed to delete bid: " + err.message);
                }
            }
        });
    });
    
    document.getElementById('create-bid-btn').addEventListener('click', openCreateBidModal);
    
    document.getElementById('sync-bids-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="spin"></i> Syncing...`;
        lucide.createIcons();
        
        await loadBids();
        await refreshBadges();
    });
}

// -------------------------------------------------------------
// OPPORTUNITY DETAIL WORKSPACE
// -------------------------------------------------------------
async function loadBidDetail(bidId) {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Loading Bid Details...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/bids/${bidId}`);
        const bid = await res.json();
        
        if (!state.documents || state.documents.length === 0) {
            try {
                const docRes = await fetch(`${API_URL}/api/documents`);
                state.documents = await docRes.json();
            } catch (docErr) {
                console.error("Error loading document list:", docErr);
            }
        }
        
        renderBidDetail(bid);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading bid detail: ${err.message}</div>`;
    }
}

function renderBidDetail(bid) {
    const activeTab = state.activeDetailTab || 'requirements';
    const reqClass = activeTab === 'requirements' ? 'active' : '';
    const filesClass = activeTab === 'files' ? 'active' : '';
    const refsClass = activeTab === 'references' ? 'active' : '';
    const appsClass = activeTab === 'approvals' ? 'active' : '';

    // Breadcrumb update
    breadcrumb.textContent = `Bids / ${bid.bid_code} / Workspace`;
    
    // Dynamic timeline state calculations
    const reqCount = bid.requirements ? bid.requirements.length : 0;
    const completedCount = bid.requirements ? bid.requirements.filter(r => r.sme_status === 'Approved').length : 0;
    
    const hasRequirements = reqCount > 0;
    const allSMEsApproved = hasRequirements && (completedCount === reqCount);
    const hasApprovals = bid.approvers && bid.approvers.length > 0;
    const allApprovalsApproved = hasApprovals && bid.approvers.every(a => a.approval_status === 'Approved');
    const finalSubmissionCompleted = ['Bid Submitted', 'Won', 'Lost'].includes(bid.overall_status);

    let step1Class = "completed"; // Bid folder received
    let step2Class = "";
    let step3Class = "";
    let step4Class = "";
    let step5Class = "";

    if (finalSubmissionCompleted) {
        step2Class = "completed";
        step3Class = "completed";
        step4Class = "completed";
        step5Class = "completed";
    } else if (bid.overall_status === 'Ready to Ship' || allApprovalsApproved) {
        step2Class = "completed";
        step3Class = "completed";
        step4Class = "completed";
        step5Class = "active";
    } else if (allSMEsApproved) {
        step2Class = "completed";
        step3Class = "completed";
        step4Class = "active";
    } else if (hasRequirements) {
        step2Class = "completed";
        step3Class = "active";
    } else {
        step2Class = "active"; // Work in progress: parsing files & draft proposal
    }
    
    pageContent.innerHTML = `
        <a class="back-btn" id="bid-detail-back-btn">
            <i data-lucide="arrow-left"></i> Back to Bids Portfolio
        </a>
        
        <div class="page-header" style="margin-bottom: 24px;">
            <div>
                <h1 style="font-size:24px;">${bid.bid_name}</h1>
                <p class="page-header-desc">Manager: ${bid.bid_manager} &bull; Code: ${bid.bid_code}</p>
            </div>
            <div style="display:flex; gap:12px;">
                <span class="badge ${bid.complexity ? bid.complexity.toLowerCase() : 'medium'}" style="font-size:14px; padding: 4px 12px;">${bid.complexity} Complexity</span>
                <span class="badge ${bid.overall_status ? bid.overall_status.toLowerCase() : 'active'}" style="font-size:14px; padding: 4px 12px;">Status: ${bid.overall_status}</span>
            </div>
        </div>
        
        <div class="detail-layout">
            <!-- Left Area: Workspace Tabs & Contents -->
            <div>
                <div class="detail-tabs">
                    <div class="detail-tab ${reqClass}" data-tab="requirements">Requirements Matrix (${reqCount})</div>
                    <div class="detail-tab ${filesClass}" data-tab="files">Inbound RFP Files (${bid.folder_files ? bid.folder_files.length : 0})</div>
                    <div class="detail-tab ${refsClass}" data-tab="references">Reference Documents</div>
                    <div class="detail-tab ${appsClass}" data-tab="approvals">Management Approvals</div>
                </div>
                
                <div id="tab-content-area">
                    ${activeTab === 'requirements' ? renderRequirementsTab(bid) : 
                      activeTab === 'files' ? renderFilesTab(bid) : 
                      activeTab === 'references' ? renderReferencesTab(bid) : 
                      activeTab === 'approvals' ? renderApprovalsTab(bid) : ''}
                </div>
            </div>
            
            <!-- Right Area: Timeline Engine & Folder details -->
            <div style="display:flex; flex-direction:column; gap:24px;">
                <div class="timeline-engine">
                    <h3>Dynamic Timeline Engine</h3>
                    <div class="timeline-steps">
                        <div class="timeline-step ${step1Class}">
                            <div class="timeline-node">1</div>
                            <div class="timeline-content">
                                <div class="timeline-date">${formatDate(bid.bid_received_date)}</div>
                                <div class="timeline-title">Bid Received Date</div>
                                <div class="timeline-desc">RFP imported into workspace</div>
                            </div>
                        </div>
                        <div class="timeline-step ${step2Class}">
                            <div class="timeline-node">2</div>
                            <div class="timeline-content">
                                <div class="timeline-date">${formatDate(bid.draft_bid_proposal_date)}</div>
                                <div class="timeline-title">Draft Proposal Complete</div>
                                <div class="timeline-desc">AI initial pass completion</div>
                            </div>
                        </div>
                        <div class="timeline-step ${step3Class}">
                            <div class="timeline-node">3</div>
                            <div class="timeline-content">
                                <div class="timeline-date">${formatDate(bid.sme_review_due_date)}</div>
                                <div class="timeline-title">SME Review Due Date</div>
                                <div class="timeline-desc">Verification & override review</div>
                            </div>
                        </div>
                        <div class="timeline-step ${step4Class}">
                            <div class="timeline-node">4</div>
                            <div class="timeline-content">
                                <div class="timeline-date">${formatDate(bid.management_approval_date)}</div>
                                <div class="timeline-title">Management Approval</div>
                                <div class="timeline-desc">Final bid sign-off gate</div>
                            </div>
                        </div>
                        <div class="timeline-step ${step5Class}">
                            <div class="timeline-node">5</div>
                            <div class="timeline-content">
                                <div class="timeline-date">${formatDate(bid.bid_submission_date)}</div>
                                <div class="timeline-title">Bid Submission Date</div>
                                <div class="timeline-desc">Portal submission deadline</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="timeline-engine" style="padding: 20px;">
                    <h4 style="font-size:14px; color:var(--text-muted); margin-bottom:12px;">Active Workspace Folder</h4>
                    <code style="font-size:12px; word-break:break-all; background-color:var(--bg-main); padding:8px; display:block; border-radius:4px; border:1px solid var(--border);">${bid.folder_path}</code>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    
    // Bind Details Back button
    document.getElementById('bid-detail-back-btn').addEventListener('click', () => {
        state.activeBidId = null;
        state.activeDetailTab = 'requirements';
        navigate('bids');
    });
    
    // Tab switching event handlers
    const tabs = document.querySelectorAll('.detail-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-tab');
            state.activeDetailTab = target;
            const container = document.getElementById('tab-content-area');
            
            if (target === 'requirements') {
                container.innerHTML = renderRequirementsTab(bid);
                setupRequirementsHandlers(bid);
            } else if (target === 'files') {
                container.innerHTML = renderFilesTab(bid);
                setupFilesHandlers(bid);
            } else if (target === 'approvals') {
                container.innerHTML = renderApprovalsTab(bid);
                setupApprovalsHandlers(bid);
            } else if (target === 'references') {
                container.innerHTML = renderReferencesTab(bid);
                setupReferencesHandlers(bid);
            }
            lucide.createIcons();
        });
    });
    
    // Initial bindings for default active tab
    const curTab = state.activeDetailTab || 'requirements';
    if (curTab === 'requirements') {
        setupRequirementsHandlers(bid);
    } else if (curTab === 'files') {
        setupFilesHandlers(bid);
    } else if (curTab === 'references') {
        setupReferencesHandlers(bid);
    } else if (curTab === 'approvals') {
        setupApprovalsHandlers(bid);
    }
}

// -------------------------------------------------------------
// TAB RENDERERS
// -------------------------------------------------------------
function renderRequirementsTab(bid) {
    const uniqueDocs = [...new Set(bid.requirements.map(r => r.source_document).filter(Boolean))].sort();
    const uniqueSMEs = [...new Set(bid.requirements.map(r => r.assigned_sme).filter(Boolean))].sort();
    const uniqueModules = [...new Set(bid.requirements.map(r => r.sap_module).filter(Boolean))].sort();

    return `
        <div class="detail-pane">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; background:var(--bg-card); padding:16px 20px; border-radius:8px; border:1px solid var(--border);">
                <div>
                    <h3 style="font-size:15px; margin-bottom:4px; font-weight:600;">Export AI Responses to Source RFP</h3>
                    <p style="font-size:12px; color:var(--text-muted); margin:0;">Write approved/generated responses back into their exact Excel cell coordinates.</p>
                </div>
                <button class="btn btn-primary" id="export-responses-btn" style="display:flex; align-items:center; gap:8px; height: 38px; padding:0 16px;">
                    <i data-lucide="download" style="width:14px; height:14px;"></i> Write Responses to Document
                </button>
            </div>
            <div class="search-filter-row" style="flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px;">
                <div class="search-input-wrapper" style="min-width: 250px; flex: 2 1 0%;">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Search requirements, modules, questions..." id="matrix-search">
                </div>
                <select id="matrix-filter-type" class="filter-select" style="min-width: 120px; flex: 1 1 0%;">
                    <option value="">All Types</option>
                    <option value="Question">Question</option>
                    <option value="Requirement">Requirement</option>
                    <option value="Instruction">Instruction</option>
                    <option value="Context">Context</option>
                </select>
                <select id="matrix-filter-fitment" class="filter-select" style="min-width: 140px; flex: 1 1 0%;">
                    <option value="">All Fitments</option>
                    <option value="Full Compliance">Full Compliance</option>
                    <option value="Configurable">Configurable</option>
                    <option value="Custom Development">Custom Development</option>
                    <option value="Third-Party Solution">Third-Party Solution</option>
                    <option value="Need Further Info">Need Further Info</option>
                    <option value="Non-Compliant">Non-Compliant</option>
                </select>
                <select id="matrix-filter-source" class="filter-select" style="min-width: 150px; flex: 1 1 0%;">
                    <option value="">All Source Docs</option>
                    ${uniqueDocs.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
                <select id="matrix-filter-module" class="filter-select" style="min-width: 130px; flex: 1 1 0%;">
                    <option value="">All Modules</option>
                    ${uniqueModules.map(m => `<option value="${m}">${m}</option>`).join('')}
                </select>
                <select id="matrix-filter-sme" class="filter-select" style="min-width: 130px; flex: 1 1 0%;">
                    <option value="">All SMEs</option>
                    ${uniqueSMEs.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <select id="matrix-filter-status" class="filter-select" style="min-width: 120px; flex: 1 1 0%;">
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>
            
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;">ID</th>
                            <th style="width: 90px;">Type</th>
                            <th style="width: 40%; min-width: 350px;">RFP Content</th>
                            <th style="width: 15%; min-width: 140px;">Source Document</th>
                            <th style="width: 130px;">SAP Module</th>
                            <th style="width: 130px;">Fitment</th>
                            <th style="width: 140px;">Assigned SME</th>
                            <th style="width: 90px;">Status</th>
                            <th style="width: 60px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="matrix-tbody">
                        ${bid.requirements.length === 0 ? `
                            <tr>
                                <td colspan="9" style="text-align:center; padding:40px; color:var(--text-muted);">
                                    No requirements parsed yet. Sync files in the "Inbound RFP Files" tab to generate responses.
                                </td>
                            </tr>
                        ` : bid.requirements.map(req => `
                            <tr class="req-row" data-req-id="${req.id}" style="cursor:pointer;">
                                <td style="font-weight:600; font-size:12px; min-width: 80px;">${req.requirement_id_source || `REQ-${req.id}`}</td>
                                <td style="min-width: 90px;"><span class="badge type-${(req.requirement_type || 'Question').toLowerCase()}">${req.requirement_type || 'Question'}</span></td>
                                <td style="min-width: 350px; width: 40%;">
                                    <div class="matrix-question" style="word-break: normal; word-wrap: break-word; white-space: normal; max-width: 100%;">${req.question_text}</div>
                                    ${req.question_coordinate ? `
                                        <div style="margin-top: 6px; font-size: 10px; font-family: monospace; color: var(--text-muted); background: var(--bg-main); padding: 2px 8px; border-radius: 4px; display: inline-block; border: 1px solid var(--border);">
                                            📍 Excel Cell: <strong>${req.question_coordinate}</strong> &rarr; Write response to: <strong>${req.answer_coordinate}</strong>
                                        </div>
                                    ` : ''}
                                    <div class="matrix-response" id="response-container-${req.id}" style="margin-top: 6px; font-size: 12px; color: var(--text-muted); max-width: 100%;">
                                        ${req.manual_override_response || req.ai_generated_response ? `<span>${req.manual_override_response || req.ai_generated_response}</span>` : ''}
                                    </div>
                                </td>
                                <td style="min-width: 140px;">
                                    ${req.source_document_rel_path ? `
                                        <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                                            <span style="font-family: monospace; background: var(--bg-main); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${req.source_document}">${req.source_document}</span>
                                            <div style="display: flex; gap: 4px; flex-shrink: 0;">
                                                <button class="btn btn-secondary inline-preview-btn" data-rel-path="${req.source_document_rel_path}" title="Preview" style="padding: 3px 6px; display: flex; align-items: center; justify-content: center; height: 22px; width: 22px;">
                                                    <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                                                </button>
                                                <button class="btn btn-secondary inline-download-btn" data-rel-path="${req.source_document_rel_path}" title="Download" style="padding: 3px 6px; display: flex; align-items: center; justify-content: center; height: 22px; width: 22px;">
                                                    <i data-lucide="download" style="width: 12px; height: 12px;"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ` : `
                                        <span style="font-size: 11px; font-family: monospace; background: var(--bg-main); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); display: block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${req.source_document || ''}">${req.source_document || 'System/Manual'}</span>
                                    `}
                                </td>
                                <td style="min-width: 120px;"><span class="badge active">${req.sap_module || 'Cross-App'}</span></td>
                                <td style="min-width: 120px;"><span class="badge ${req.fitment_score.toLowerCase().replace(/ /g, '-')}">${req.fitment_score}</span></td>
                                <td style="min-width: 130px;"><strong>${req.assigned_sme || 'Unassigned'}</strong></td>
                                <td style="min-width: 90px;"><span class="badge ${req.sme_status.toLowerCase()}">${req.sme_status}</span></td>
                                <td style="min-width: 60px; text-align: center;">
                                    <button class="btn btn-primary generate-ai-btn" data-req-id="${req.id}" title="Generate AI Answer" style="padding: 4px 6px; font-size: 10px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary), var(--info)); border: none; color: white; border-radius: 4px; font-weight: 600; cursor: pointer; height: 24px; width: 24px;">
                                        <i data-lucide="sparkles" style="width: 12px; height: 12px;"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function setupRequirementsHandlers(bid) {
    // Bind inline preview buttons
    document.querySelectorAll('.inline-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) openDocumentPreview(relPath, bid.bid_id);
        });
    });

    // Bind inline download buttons
    document.querySelectorAll('.inline-download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) {
                window.open(`${API_URL}/api/documents/view?rel_path=${encodeURIComponent(relPath)}&bid_id=${bid.bid_id}&download=true`, '_blank');
            }
        });
    });

    // Open edit modal on row click (excluding inline buttons and wand)
    document.querySelectorAll('.req-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.inline-preview-btn') || e.target.closest('.inline-download-btn') || e.target.closest('.generate-ai-btn')) {
                return;
            }
            const reqId = parseInt(row.getAttribute('data-req-id'));
            const req = bid.requirements.find(r => r.id === reqId);
            if (req) openRequirementModal(req);
        });
    });

    // Bind generate-ai-btn clicks (Wand tool)
    document.querySelectorAll('.generate-ai-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const reqId = btn.getAttribute('data-req-id');
            const container = document.getElementById(`response-container-${reqId}`);
            
            btn.disabled = true;
            btn.style.opacity = '0.5';
            
            if (container) {
                container.innerHTML = `
                    <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--primary);">
                        <i data-lucide="loader" class="spin" style="width:12px; height:12px;"></i>
                        <span>Thinking...</span>
                    </div>
                `;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            
            try {
                const selectedModel = localStorage.getItem("selected_model") || "gemini/gemini-2.5-flash-lite";
                const res = await fetch(`${API_URL}/api/requirements/${reqId}/generate-answer?model_name=${encodeURIComponent(selectedModel)}`, {
                    method: 'POST'
                });
                if (res.ok) {
                    const data = await res.json();
                    
                    // Update state
                    const reqIdx = bid.requirements.findIndex(r => r.id === parseInt(reqId));
                    if (reqIdx !== -1) {
                        bid.requirements[reqIdx] = data; // Replace entire requirement object
                    }
                    
                    // Update specific cells in the table row dynamically
                    const row = btn.closest('.req-row');
                    if (row) {
                        // Type cell (index 1)
                        const typeCell = row.cells[1];
                        if (typeCell) typeCell.innerHTML = `<span class="badge type-${(data.requirement_type || 'Question').toLowerCase()}">${data.requirement_type || 'Question'}</span>`;
                        
                        // Module cell (index 4)
                        const moduleCell = row.cells[4];
                        if (moduleCell) moduleCell.innerHTML = `<span class="badge active">${data.sap_module || 'Cross-Application'}</span>`;
                        
                        // Fitment cell (index 5)
                        const fitmentCell = row.cells[5];
                        if (fitmentCell) fitmentCell.innerHTML = `<span class="badge ${data.fitment_score.toLowerCase().replace(/ /g, '-')}">${data.fitment_score}</span>`;
                        
                        // SME cell (index 6)
                        const smeCell = row.cells[6];
                        if (smeCell) smeCell.innerHTML = `<strong>${data.assigned_sme || 'Unassigned'}</strong>`;
                    }
                    
                    if (container) {
                        container.innerHTML = `<span>${data.ai_generated_response}</span>`;
                    }
                } else {
                    const err = await res.json();
                    if (container) {
                        container.innerHTML = `<span style="color:var(--error); font-size:12px;">Error: ${err.detail || "Failed to generate"}</span>`;
                    }
                }
            } catch (err) {
                console.error("AI Generation Error:", err);
                if (container) {
                    container.innerHTML = `<span style="color:var(--error); font-size:12px;">Error: Network issue</span>`;
                }
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
    });
    
    // Matrix search and filtering
    const search = document.getElementById('matrix-search');
    const filterFitment = document.getElementById('matrix-filter-fitment');
    const filterType = document.getElementById('matrix-filter-type');
    const filterSource = document.getElementById('matrix-filter-source');
    const filterModule = document.getElementById('matrix-filter-module');
    const filterSME = document.getElementById('matrix-filter-sme');
    const filterStatus = document.getElementById('matrix-filter-status');
    
    if (search && filterFitment && filterType && filterSource && filterModule && filterSME && filterStatus) {
        const handleFilter = () => {
            const query = search.value.toLowerCase();
            const fitment = filterFitment.value;
            const type = filterType.value;
            const source = filterSource.value;
            const module = filterModule.value;
            const sme = filterSME.value;
            const status = filterStatus.value;
            
            const rows = document.querySelectorAll('.req-row');
            
            rows.forEach(row => {
                const reqId = parseInt(row.getAttribute('data-req-id'));
                const req = bid.requirements.find(r => r.id === reqId);
                
                if (!req) return;
                
                const matchesSearch = req.question_text.toLowerCase().includes(query) || 
                                      (req.sap_module && req.sap_module.toLowerCase().includes(query)) ||
                                      (req.assigned_sme && req.assigned_sme.toLowerCase().includes(query)) ||
                                      (req.requirement_id_source && req.requirement_id_source.toLowerCase().includes(query)) ||
                                      (req.ai_generated_response && req.ai_generated_response.toLowerCase().includes(query));
                                      
                const matchesFitment = !fitment || req.fitment_score === fitment;
                const matchesType = !type || (req.requirement_type || 'Question') === type;
                const matchesSource = !source || req.source_document === source;
                const matchesModule = !module || req.sap_module === module;
                const matchesSME = !sme || req.assigned_sme === sme;
                const matchesStatus = !status || (req.sme_status || 'Pending') === status;
                
                if (matchesSearch && matchesFitment && matchesType && matchesSource && matchesModule && matchesSME && matchesStatus) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        };
        
        search.addEventListener('input', handleFilter);
        filterFitment.addEventListener('change', handleFilter);
        filterType.addEventListener('change', handleFilter);
        filterSource.addEventListener('change', handleFilter);
        filterModule.addEventListener('change', handleFilter);
        filterSME.addEventListener('change', handleFilter);
        filterStatus.addEventListener('change', handleFilter);
    }
    const exportBtn = document.getElementById('export-responses-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            exportBtn.disabled = true;
            exportBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px; height:14px;"></i> Exporting...`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
            try {
                const res = await fetch(`${API_URL}/api/bids/${bid.bid_id}/export-responses`, {
                    method: 'POST'
                });
                const data = await res.json();
                if (res.ok) {
                    toastNotify("Success! " + data.message);
                } else {
                    alert("Export failed: " + (data.detail || "Server error"));
                }
            } catch (err) {
                console.error("Export error:", err);
                alert("Export failed: Network issue");
            } finally {
                exportBtn.disabled = false;
                exportBtn.innerHTML = `<i data-lucide="download" style="width:14px; height:14px;"></i> Write Responses to Document`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                
                // Reload notifications
                if (typeof loadNotifications === 'function') loadNotifications();
            }
        });
    }
}

function renderFilesTab(bid) {
    return `
        <div class="detail-pane">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                <h3 style="margin:0; font-size:16px;">Files in Bid Workspace</h3>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <label class="btn btn-secondary" for="bid-file-upload-input" style="cursor: pointer; padding: 6px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 6px; font-weight: 600;">
                        <i data-lucide="upload" style="width: 14px; height: 14px;"></i>
                        <span>Upload File</span>
                    </label>
                    <input type="file" id="bid-file-upload-input" style="display: none;" multiple accept=".xlsx,.xls,.docx,.doc,.pdf,.txt,.log">
                </div>
            </div>
            <div class="doc-card-list">
                ${bid.folder_files.length === 0 ? `
                    <div style="text-align:center; padding:30px; color:var(--text-muted); border:1px dashed var(--border); border-radius:8px;">
                        No documents found inside this folder. Upload documents here or place them in the active folder to begin.
                    </div>
                ` : bid.folder_files.map(file => {
                    let fileClass = 'pdf';
                    if (['.xlsx', '.xls'].includes(file.extension)) fileClass = 'xlsx';
                    if (['.docx', '.doc'].includes(file.extension)) fileClass = 'docx';
                    
                    return `
                        <div class="doc-item bid-file-row" data-rel-path="${file.rel_path}">
                            <div class="doc-info" style="flex-grow: 1; overflow: hidden; min-width: 0; display: flex; align-items: center; gap: 12px;">
                                <div class="doc-icon ${fileClass}" style="flex-shrink: 0;">
                                    <i data-lucide="file-text"></i>
                                </div>
                                <div class="doc-details" style="overflow: hidden; min-width: 0;">
                                    <h4 style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 350px; margin: 0; font-size: 14px;">${file.name}</h4>
                                    <p style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 4px 0 0 0; font-size: 12px; color: var(--text-light);">${formatBytes(file.size_bytes)} &bull; ${file.rel_path}</p>
                                </div>
                            </div>
                            <div class="doc-actions" style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                                <button class="btn btn-secondary preview-bid-file-btn" data-rel-path="${file.rel_path}" style="padding: 6px 12px; font-size: 13px; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                    <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Preview
                                </button>
                                <button class="btn btn-secondary download-bid-file-btn" data-rel-path="${file.rel_path}" style="padding: 6px 12px; font-size: 13px; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                    <i data-lucide="download" style="width: 14px; height: 14px;"></i> Download
                                </button>
                                <button class="btn btn-secondary delete-bid-file-btn" data-rel-path="${file.rel_path}" style="padding: 6px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; color: var(--state-error) !important; border-color: rgba(239, 68, 68, 0.2);">
                                    <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--state-error);"></i> Delete
                                </button>
                                <button class="btn btn-secondary run-rag-btn" data-file-path="${file.rel_path}" style="flex-shrink: 0;">
                                    <i data-lucide="cpu"></i> Run AI RAG Analysis
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function setupFilesHandlers(bid) {
    document.querySelectorAll('.run-rag-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent row click
            const btnEl = e.currentTarget;
            const filePath = btnEl.getAttribute('data-file-path');
            
            btnEl.disabled = true;
            btnEl.innerHTML = `<i data-lucide="loader" class="spin"></i> Indexing...`;
            lucide.createIcons();
            
            try {
                const activeModel = localStorage.getItem("selected_model") || "gemini/gemini-2.5-flash-lite";
                const res = await fetch(`${API_URL}/api/bids/${bid.bid_id}/ingest-file`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        question_text: filePath,
                        model_name: activeModel
                    })
                });
                const resData = await res.json();
                
                // Check if document was already scanned
                if (resData.status === "already_scanned") {
                    const forceScan = confirm(resData.message + "\n\nThis document has already been analyzed and its requirements are in the matrix.\n\nDo you want to re-run the scan? This will update the existing requirements.");
                    if (!forceScan) {
                        btnEl.disabled = false;
                        btnEl.innerHTML = `<i data-lucide="cpu"></i> Run AI RAG Analysis`;
                        lucide.createIcons();
                        return;
                    }
                    
                    // User confirmed re-run! Dispatch a second request with force=true
                    const forceRes = await fetch(`${API_URL}/api/bids/${bid.bid_id}/ingest-file`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            question_text: filePath,
                            model_name: activeModel,
                            force: true
                        })
                    });
                    if (!forceRes.ok) {
                        const forceErr = await forceRes.json();
                        throw new Error(forceErr.detail || "Force scan initiation failed");
                    }
                }
                
                // 1. Switch to requirements tab so user can see it populate
                const reqTab = document.querySelector('.detail-tab[data-tab="requirements"]');
                if (reqTab) {
                    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
                    reqTab.classList.add('active');
                }
                
                // 2. Put a loading indicator inside the matrix list
                const container = document.getElementById('tab-content-area');
                if (container) {
                    container.innerHTML = `
                        <div class="detail-pane" style="text-align: center; padding: 60px 20px;">
                            <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 16px;">
                                <i data-lucide="loader" class="spin" style="width: 40px; height: 40px; color: var(--primary); margin-bottom: 8px;"></i>
                                <h3 style="margin: 0; font-size: 16px; font-weight: 600;">AI RAG Extraction & Analysis in Progress...</h3>
                                <div id="rag-timer" style="font-family: monospace; font-size: 14px; font-weight: 700; color: var(--primary); background: rgba(14, 165, 233, 0.1); padding: 6px 16px; border-radius: 20px; border: 1px solid rgba(14, 165, 233, 0.2); margin-top: 4px; display: inline-flex; align-items: center; gap: 6px;">
                                    <i data-lucide="clock" class="spin" style="width: 14px; height: 14px;"></i>
                                    <span>Elapsed Time: 0s</span>
                                </div>
                                <div id="rag-active-tab" style="display: none; font-size: 12px; font-weight: 600; color: var(--primary); margin-top: -4px;">
                                    Reading Tab: -
                                </div>
                                <p style="margin: 0; font-size: 13px; color: var(--text-light); max-width: 320px; line-height: 1.5; margin-top: 4px;">
                                    Reading document, matching context from master knowledge base, and generating answers...
                                </p>
                            </div>
                        </div>
                    `;
                    lucide.createIcons();
                }
                
                // 3. Poll every 1 second until backend processing finishes (marked by status 'idle')
                let pollCounter = 0;
                const pollInterval = setInterval(async () => {
                    // Guard: If user navigated away, stop polling immediately
                    if (state.activePage !== 'bids' || state.activeBidId !== bid.bid_id) {
                        clearInterval(pollInterval);
                        return;
                    }
                    pollCounter++;
                    
                    const timerEl = document.querySelector('#rag-timer span');
                    if (timerEl) {
                        timerEl.textContent = `Elapsed Time: ${pollCounter}s`;
                    }
                    
                    try {
                        const statusRes = await fetch(`${API_URL}/api/bids/${bid.bid_id}/ingest-status`);
                        const statusData = await statusRes.json();
                        
                        if (statusData.current_tab) {
                            const tabEl = document.getElementById('rag-active-tab');
                            if (tabEl) {
                                tabEl.textContent = `Reading Tab: ${statusData.current_tab}`;
                                tabEl.style.display = 'inline-flex';
                            }
                        } else {
                            const tabEl = document.getElementById('rag-active-tab');
                            if (tabEl) tabEl.style.display = 'none';
                        }
                        
                        const pollRes = await fetch(`${API_URL}/api/bids/${bid.bid_id}`);
                        if (pollRes.ok) {
                            const updatedBid = await pollRes.json();
                            const activeTab = document.querySelector('.detail-tab.active');
                            if (activeTab && activeTab.getAttribute('data-tab') === 'requirements' && container) {
                                if (updatedBid.requirements && updatedBid.requirements.length > 0) {
                                    container.innerHTML = renderRequirementsTab(updatedBid);
                                    setupRequirementsHandlers(updatedBid);
                                    lucide.createIcons();
                                }
                            }
                        }
                        
                        if ((statusData.status === "idle" && pollCounter > 2) || pollCounter >= 180) {
                            clearInterval(pollInterval);
                            loadBidDetail(bid.bid_id);
                            toastNotify("RAG analysis extraction completed!");
                        }
                    } catch (pollErr) {
                        console.error("Error polling bid requirements:", pollErr);
                    }
                }, 1000);
                
            } catch (err) {
                alert("RAG Extraction failed: " + err.message);
                btnEl.disabled = false;
                btnEl.innerHTML = `<i data-lucide="cpu"></i> Run AI RAG Analysis`;
                lucide.createIcons();
            }
        });
    });

    // Bind preview button clicks
    document.querySelectorAll('.preview-bid-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) openDocumentPreview(relPath, bid.bid_id);
        });
    });

    // Bind download button clicks
    document.querySelectorAll('.download-bid-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) {
                window.open(`${API_URL}/api/documents/view?rel_path=${encodeURIComponent(relPath)}&bid_id=${bid.bid_id}&download=true`, '_blank');
            }
        });
    });

    // Bind upload file input
    const fileUploadInput = document.getElementById('bid-file-upload-input');
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            
            toastNotify(`Uploading ${files.length} file(s)...`);
            
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                
                try {
                    const res = await fetch(`${API_URL}/api/bids/${bid.bid_id}/upload-file`, {
                        method: 'POST',
                        body: formData
                    });
                    if (res.ok) {
                        toastNotify(`Successfully uploaded ${files[i].name}!`);
                    } else {
                        const err = await res.json();
                        alert(`Failed to upload ${files[i].name}: ${err.detail || "Server error"}`);
                    }
                } catch (err) {
                    console.error("Upload error:", err);
                    alert(`Failed to upload ${files[i].name}: Network issue`);
                }
            }
            
            // Refresh the details page to show the newly uploaded files
            loadBidDetail(bid.bid_id);
        });
    }

    // Bind delete file buttons
    document.querySelectorAll('.delete-bid-file-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (!relPath) return;
            
            const filename = relPath.split('/').pop();
            if (!confirm(`Are you sure you want to delete '${filename}'? This will remove the file from the workspace folder.`)) {
                return;
            }
            
            try {
                const res = await fetch(`${API_URL}/api/bids/${bid.bid_id}/files?rel_path=${encodeURIComponent(relPath)}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    toastNotify(`Deleted ${filename}`);
                    loadBidDetail(bid.bid_id);
                } else {
                    const err = await res.json();
                    alert(`Failed to delete file: ${err.detail || "Server error"}`);
                }
            } catch (err) {
                console.error("Delete error:", err);
                alert("Failed to delete file: Network issue");
            }
        });
    });

    // Clear any existing folder files polling interval
    if (state.filesPollInterval) {
        clearInterval(state.filesPollInterval);
        state.filesPollInterval = null;
    }

    // Setup 5-second scanner to automatically refresh file list on folder changes
    state.filesPollInterval = setInterval(async () => {
        if (state.activePage !== 'bids' || state.activeBidId !== bid.bid_id || state.activeDetailTab !== 'files') {
            clearInterval(state.filesPollInterval);
            state.filesPollInterval = null;
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/api/bids/${bid.bid_id}`);
            if (res.ok) {
                const updatedBid = await res.json();
                
                const oldFiles = bid.folder_files || [];
                const newFiles = updatedBid.folder_files || [];
                
                let changed = oldFiles.length !== newFiles.length;
                if (!changed) {
                    for (let i = 0; i < oldFiles.length; i++) {
                        if (oldFiles[i].name !== newFiles[i].name || oldFiles[i].size_bytes !== newFiles[i].size_bytes) {
                            changed = true;
                            break;
                        }
                    }
                }
                
                if (changed) {
                    bid = updatedBid;
                    const container = document.getElementById('tab-content-area');
                    if (container) {
                        container.innerHTML = renderFilesTab(bid);
                        setupFilesHandlers(bid);
                    }
                }
            }
        } catch (err) {
            console.error("Error polling files automatically:", err);
        }
    }, 5000);
}

function renderReferencesTab(bid) {
    const uniqueSources = new Set();
    if (bid.requirements) {
        bid.requirements.forEach(r => {
            if (r.ai_sources_listed) {
                let sources = [];
                if (r.ai_sources_listed.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(r.ai_sources_listed);
                        sources = parsed.map(item => item.file_source || item.file || item);
                    } catch (e) {
                        sources = r.ai_sources_listed.split(',');
                    }
                } else {
                    sources = r.ai_sources_listed.split(',');
                }
                sources.forEach(s => {
                    const clean = (typeof s === 'string') ? s.trim() : '';
                    if (clean && !['system', 'system knowledge', 'api bulk process', 'pending'].includes(clean.toLowerCase())) {
                        uniqueSources.add(clean);
                    }
                });
            }
        });
    }

    const sourcesList = Array.from(uniqueSources);

    const docMap = {};
    if (state.documents && state.documents.length > 0) {
        state.documents.forEach(d => {
            docMap[d.name.toLowerCase()] = d.rel_path;
        });
    }

    return `
        <div class="detail-pane">
            <h3 style="margin-bottom:20px; font-size:16px;">AI Reference Knowledge Base Docs</h3>
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Document Name</th>
                            <th>Source Location</th>
                            <th style="text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sourcesList.length === 0 ? `
                            <tr>
                                <td colspan="3" style="text-align:center; padding:30px; color:var(--text-muted);">
                                    No external knowledge base reference documents cited for this bid. Run AI analysis to identify sources.
                                </td>
                            </tr>
                        ` : sourcesList.map(src => {
                            const matchedRelPath = docMap[src.toLowerCase()] || src;
                            return `
                                <tr>
                                    <td>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <i data-lucide="file-text" style="width:16px; height:16px; color:var(--primary);"></i>
                                            <strong>${src}</strong>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="badge info" style="font-size:11px;">Knowledge Base Repository</span>
                                    </td>
                                    <td style="text-align:right;">
                                        <div style="display:inline-flex; gap:8px;">
                                            <button class="btn btn-secondary preview-ref-file-btn" data-rel-path="${matchedRelPath}" style="padding: 4px 10px; font-size: 11px; display:inline-flex; align-items:center; gap:4px;">
                                                <i data-lucide="eye" style="width:12px; height:12px;"></i> Preview
                                            </button>
                                            <button class="btn btn-secondary download-ref-file-btn" data-rel-path="${matchedRelPath}" style="padding: 4px 10px; font-size: 11px; display:inline-flex; align-items:center; gap:4px;">
                                                <i data-lucide="download" style="width:12px; height:12px;"></i> Download
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function setupReferencesHandlers(bid) {
    document.querySelectorAll('.preview-ref-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) openDocumentPreview(relPath);
        });
    });

    document.querySelectorAll('.download-ref-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) {
                window.open(`${API_URL}/api/documents/view?rel_path=${encodeURIComponent(relPath)}&download=true`, '_blank');
            }
        });
    });
}

function renderApprovalsTab(bid) {
    return `
        <div class="detail-pane">
            <h3 style="margin-bottom:20px; font-size:16px;">Governance Sign-off Signatures</h3>
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Level</th>
                            <th>Gate Approver</th>
                            <th>Role</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bid.approvers.length === 0 ? `
                            <tr>
                                <td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">
                                    No approval sign-off path configured for this bid. Add parameters in Administration to initialize.
                                </td>
                            </tr>
                        ` : bid.approvers.map(appr => `
                            <tr>
                                <td style="font-weight:600;">Lvl ${appr.approval_level}</td>
                                <td><strong>${appr.approver_name.split(' (')[0]}</strong></td>
                                <td style="color:var(--text-muted);">${appr.approver_name.includes('(') ? appr.approver_name.split('(')[1].replace(')', '') : 'Approver'}</td>
                                <td>
                                    <span class="badge ${appr.approval_status.toLowerCase()}">${appr.approval_status}</span>
                                    ${appr.approval_status === 'Pending' ? `
                                        <button class="btn btn-primary approve-gate-btn" data-approval-id="${appr.approval_id}" style="padding: 4px 10px; font-size: 11px; margin-left: 10px;">
                                            <i data-lucide="check" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Approve Gate
                                        </button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function setupApprovalsHandlers(bid) {
    document.querySelectorAll('.approve-gate-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const approvalId = btnEl.getAttribute('data-approval-id');
            
            btnEl.disabled = true;
            btnEl.innerHTML = `<i data-lucide="loader" class="spin"></i> Approving...`;
            lucide.createIcons();
            
            try {
                const res = await fetch(`${API_URL}/api/approvals/${approvalId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ approval_status: 'Approved' })
                });
                
                if (res.ok) {
                    loadBidDetail(bid.bid_id);
                    refreshBadges();
                } else {
                    const err = await res.json();
                    alert("Approval failed: " + err.detail);
                    btnEl.disabled = false;
                    btnEl.innerHTML = `<i data-lucide="check"></i> Approve Gate`;
                    lucide.createIcons();
                }
            } catch (err) {
                alert("Approval failed: " + err.message);
                btnEl.disabled = false;
                btnEl.innerHTML = `<i data-lucide="check"></i> Approve Gate`;
                lucide.createIcons();
            }
        });
    });
}

// -------------------------------------------------------------
// PAGE 3: MY TASKS
// -------------------------------------------------------------
async function loadTasks() {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Loading Tasks...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/tasks`);
        const tasks = await res.json();
        state.tasks = tasks;
        
        renderTasksPage(tasks);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading tasks: ${err.message}</div>`;
    }
}

function renderTasksPage(tasks) {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>My Tasks</h1>
                <div class="page-header-desc">${tasks.length} pending operations requirements requiring SME verification.</div>
            </div>
        </div>
        
        <div class="detail-pane">
            <div class="search-filter-row">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Search tasks, bids, questions..." id="tasks-search">
                </div>
            </div>
            
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 100px;">Bid Code</th>
                            <th style="width: 150px;">Bid Name</th>
                            <th style="width: 80px;">Req ID</th>
                            <th style="width: 90px;">Type</th>
                            <th style="width: 35%; min-width: 300px;">RFP Content</th>
                            <th style="width: 15%; min-width: 140px;">Source Document</th>
                            <th style="width: 120px;">SAP Module</th>
                            <th style="width: 120px;">Fitment</th>
                        </tr>
                    </thead>
                    <tbody id="tasks-tbody">
                        ${tasks.length === 0 ? `
                            <tr>
                                <td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">
                                    🎉 Great job! No pending SME tasks found.
                                </td>
                            </tr>
                        ` : tasks.map(task => `
                            <tr class="task-row" data-task-id="${task.id}" style="cursor:pointer;">
                                <td style="min-width: 100px;"><span class="bid-card-code">${task.bid_code}</span></td>
                                <td style="font-weight:600; min-width: 150px;">${task.bid_name}</td>
                                <td style="font-weight:600; font-size:12px; min-width: 80px;">${task.requirement_id_source || `REQ-${task.id}`}</td>
                                <td style="min-width: 90px;"><span class="badge type-${(task.requirement_type || 'Question').toLowerCase()}">${task.requirement_type || 'Question'}</span></td>
                                <td style="min-width: 300px; width: 35%;">
                                    <div class="matrix-question" style="word-break: normal; word-wrap: break-word; white-space: normal; max-width: 100%;">${task.question_text}</div>
                                </td>
                                <td style="min-width: 140px;">
                                    ${task.source_document_rel_path ? `
                                        <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                                            <span style="font-family: monospace; background: var(--bg-main); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${task.source_document}">${task.source_document}</span>
                                            <div style="display: flex; gap: 4px; flex-shrink: 0;">
                                                <button class="btn btn-secondary inline-task-preview-btn" data-rel-path="${task.source_document_rel_path}" data-bid-id="${task.bid_id}" title="Preview" style="padding: 3px 6px; display: flex; align-items: center; justify-content: center; height: 22px; width: 22px;">
                                                    <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                                                </button>
                                                <button class="btn btn-secondary inline-task-download-btn" data-rel-path="${task.source_document_rel_path}" data-bid-id="${task.bid_id}" title="Download" style="padding: 3px 6px; display: flex; align-items: center; justify-content: center; height: 22px; width: 22px;">
                                                    <i data-lucide="download" style="width: 12px; height: 12px;"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ` : `
                                        <span style="font-size: 11px; font-family: monospace; background: var(--bg-main); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); display: block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${task.source_document || ''}">${task.source_document || 'System/Manual'}</span>
                                    `}
                                </td>
                                <td style="min-width: 120px;"><span class="badge active">${task.sap_module || 'Cross-App'}</span></td>
                                <td style="min-width: 120px;"><span class="badge ${task.fitment_score.toLowerCase().replace(/ /g, '-')}">${task.fitment_score}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    
    // Bind inline preview buttons on tasks page
    document.querySelectorAll('.inline-task-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            const bidId = parseInt(btn.getAttribute('data-bid-id'));
            if (relPath) openDocumentPreview(relPath, bidId);
        });
    });

    // Bind inline download buttons on tasks page
    document.querySelectorAll('.inline-task-download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            const bidId = btn.getAttribute('data-bid-id');
            if (relPath) {
                window.open(`${API_URL}/api/documents/view?rel_path=${encodeURIComponent(relPath)}&bid_id=${bidId}&download=true`, '_blank');
            }
        });
    });

    // Add edit modal triggers (excluding inline buttons)
    document.querySelectorAll('.task-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.inline-task-preview-btn') || e.target.closest('.inline-task-download-btn')) {
                return;
            }
            const taskId = parseInt(row.getAttribute('data-task-id'));
            const task = state.tasks.find(t => t.id === taskId);
            if (task) openRequirementModal(task);
        });
    });
    
    // Tasks search filter
    const search = document.getElementById('tasks-search');
    if (search) {
        search.addEventListener('input', () => {
            const query = search.value.toLowerCase();
            document.querySelectorAll('.task-row').forEach(row => {
                const taskId = parseInt(row.getAttribute('data-task-id'));
                const task = state.tasks.find(t => t.id === taskId);
                
                const matches = task.question_text.toLowerCase().includes(query) ||
                              task.bid_name.toLowerCase().includes(query) ||
                              task.bid_code.toLowerCase().includes(query) ||
                              (task.sap_module && task.sap_module.toLowerCase().includes(query));
                              
                row.style.display = matches ? '' : 'none';
            });
        });
    }
}

// -------------------------------------------------------------
// PAGE 4: KNOWLEDGE BASE
// -------------------------------------------------------------
async function loadKnowledge() {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Loading Vector Repository...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/knowledge`);
        const records = await res.json();
        
        renderKnowledgePage(records);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading knowledge database: ${err.message}</div>`;
    }
}

function renderKnowledgePage(records) {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Knowledge Repository</h1>
                <div class="page-header-desc">20,350 total curated master records, vectorized into pgvector (384-dimensional).</div>
            </div>
        </div>
        
        <div class="detail-pane">
            <div class="search-filter-row">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Search Master Q&As, implementation architectures..." id="kb-search">
                </div>
            </div>
            
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;">Index ID</th>
                            <th>Knowledge Content (Text Chunk)</th>
                            <th>Source File Name</th>
                            <th>Folder Origin</th>
                        </tr>
                    </thead>
                    <tbody id="kb-tbody">
                        ${records.map(r => `
                            <tr>
                                <td style="font-weight:600; font-size:12px; color:var(--text-muted);">KB-${r.id}</td>
                                <td><div style="max-width: 500px; line-height: 1.5; font-size: 13.5px;">${r.text_content}</div></td>
                                <td>
                                    ${r.rel_path ? `
                                        <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                                            <span class="badge active" style="font-size:11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.file_source}">${r.file_source}</span>
                                            <div style="display: flex; gap: 4px; flex-shrink: 0;">
                                                <button class="btn btn-secondary inline-kb-preview-btn" data-rel-path="${r.rel_path}" title="Preview" style="padding: 3px 6px; display: flex; align-items: center; justify-content: center; height: 22px; width: 22px;">
                                                    <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                                                </button>
                                                <button class="btn btn-secondary inline-kb-download-btn" data-rel-path="${r.rel_path}" title="Download" style="padding: 3px 6px; display: flex; align-items: center; justify-content: center; height: 22px; width: 22px;">
                                                    <i data-lucide="download" style="width: 12px; height: 12px;"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ` : `
                                        <span class="badge active" style="font-size:11px;">${r.file_source || 'sap_knowledge'}</span>
                                    `}
                                </td>
                                <td style="font-size:13px; color:var(--text-muted);">${r.folder_source || 'Root'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    
    // Bind inline preview buttons for knowledge base
    document.querySelectorAll('.inline-kb-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) openDocumentPreview(relPath);
        });
    });

    // Bind inline download buttons for knowledge base
    document.querySelectorAll('.inline-kb-download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) {
                window.open(`${API_URL}/api/documents/view?rel_path=${encodeURIComponent(relPath)}&download=true`, '_blank');
            }
        });
    });
    
    // Knowledge search filter client-side representation
    const search = document.getElementById('kb-search');
    if (search) {
        search.addEventListener('input', () => {
            const query = search.value.toLowerCase();
            const rows = document.querySelectorAll('#kb-tbody tr');
            rows.forEach(row => {
                const text = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
                const file = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
                row.style.display = (text.includes(query) || file.includes(query)) ? '' : 'none';
            });
        });
    }
}

// -------------------------------------------------------------
// PAGE 5: DOCUMENT REPOSITORY
// -------------------------------------------------------------
async function loadDocuments() {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Scanning Workspace Documents...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/documents`);
        const docs = await res.json();
        state.documents = docs;
        
        renderDocumentsPage(docs);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading Document Repository: ${err.message}</div>`;
    }
}

function renderDocumentsPage(docs) {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Document Repository</h1>
                <div class="page-header-desc">Unified view of inbound RFPs, templates, and corporate library.</div>
            </div>
        </div>
        
        <div class="detail-pane" style="margin-bottom: 24px;">
            <div class="search-filter-row">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Search filenames, templates, RFI files..." id="docs-search">
                </div>
                <select id="docs-filter-category" class="filter-select">
                    <option value="">All Categories</option>
                    <option value="Active Bid">Active Bid</option>
                    <option value="Closed Won">Closed Won</option>
                    <option value="Closed Lost">Closed Lost</option>
                    <option value="Template">Template</option>
                    <option value="Other">Other</option>
                </select>
            </div>
        </div>
        
        <div class="doc-card-list" id="doc-repo-list">
            ${docs.map(doc => {
                let fileClass = 'pdf';
                if (['.xlsx', '.xls'].includes(doc.extension)) fileClass = 'xlsx';
                if (['.docx', '.doc'].includes(doc.extension)) fileClass = 'docx';
                           return `
                    <div class="doc-item doc-repo-row" data-doc-category="${doc.category}">
                        <div class="doc-info" style="flex-grow:1; overflow: hidden; min-width: 0; display: flex; align-items: center; gap: 12px;">
                            <div class="doc-icon ${fileClass}" style="flex-shrink: 0;">
                                <i data-lucide="file-text"></i>
                            </div>
                            <div class="doc-details" style="overflow: hidden; min-width: 0;">
                                <h4 class="doc-name" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px; margin: 0; font-size: 14px;">${doc.name}</h4>
                                <p style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 4px 0 0 0; font-size: 12px; color: var(--text-light);">${formatBytes(doc.size_bytes)} &bull; Category: <strong>${doc.category}</strong> &bull; Modified: ${formatDate(doc.modified_at)}</p>
                            </div>
                        </div>
                        <div style="font-size:12px; color:var(--text-light); font-family:monospace; margin-right: 24px; text-align:right; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 1; min-width: 0;">
                            ${doc.rel_path}
                        </div>
                        <div class="doc-actions" style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                            <button class="btn btn-secondary preview-doc-btn" data-rel-path="${doc.rel_path}" style="padding: 6px 12px; font-size: 13px; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Preview
                            </button>
                            <button class="btn btn-secondary download-doc-btn" data-rel-path="${doc.rel_path}" style="padding: 6px 12px; font-size: 13px; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                <i data-lucide="download" style="width: 14px; height: 14px;"></i> Download
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    lucide.createIcons();

    // Bind preview button clicks
    document.querySelectorAll('.preview-doc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) openDocumentPreview(relPath);
        });
    });

    // Bind download button clicks
    document.querySelectorAll('.download-doc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const relPath = btn.getAttribute('data-rel-path');
            if (relPath) {
                window.open(`${API_URL}/api/documents/view?rel_path=${encodeURIComponent(relPath)}&download=true`, '_blank');
            }
        });
    });
    
    // Bind search and filter
    const search = document.getElementById('docs-search');
    const filter = document.getElementById('docs-filter-category');
    
    if (search && filter) {
        const handleFilter = () => {
            const query = search.value.toLowerCase();
            const category = filter.value;
            
            document.querySelectorAll('.doc-repo-row').forEach(row => {
                const name = row.querySelector('.doc-name').textContent.toLowerCase();
                const rowCategory = row.getAttribute('data-doc-category');
                
                const matchesSearch = name.includes(query);
                const matchesFilter = !category || rowCategory === category;
                
                row.style.display = (matchesSearch && matchesFilter) ? 'flex' : 'none';
            });
        };
        
        search.addEventListener('input', handleFilter);
        filter.addEventListener('change', handleFilter);
    }
}

// -------------------------------------------------------------
// PAGE 6: CERTIFICATES
// -------------------------------------------------------------
async function loadCertificates() {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Loading Compliance Certificates...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/corporate-assets`);
        const assets = await res.json();
        state.certificates = assets;
        
        renderCertificatesPage(assets);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading Certificates: ${err.message}</div>`;
    }
}

function renderCertificatesPage(assets) {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Certificates</h1>
                <div class="page-header-desc">ISO security frameworks, audit compliance certificates and partner levels.</div>
            </div>
        </div>
        
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
            ${assets.map(asset => {
                const end = new Date(asset.validity_end);
                const today = new Date();
                const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                
                let alertClass = 'winrate'; // Green
                let alertText = 'Active & Valid';
                if (diffDays < 0) {
                    alertClass = 'deadlines'; // Red
                    alertText = 'Expired';
                } else if (diffDays < 90) {
                    alertClass = 'pending'; // Yellow
                    alertText = `Expiring soon (${diffDays} days)`;
                }
                
                return `
                    <div class="stat-card" style="flex-direction:column; align-items:flex-start; gap:12px; height: 100%;">
                        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                            <span class="badge ${alertClass}">${alertText}</span>
                            <i data-lucide="award" style="color:var(--primary);"></i>
                        </div>
                        <h3 style="font-size:16px; font-weight:700; color:var(--text-main); line-height:1.4; margin-top:8px;">${asset.asset_name}</h3>
                        <p style="font-size:13px; color:var(--text-muted); flex-grow:1;">${asset.meta_details}</p>
                        
                        <div style="width:100%; border-top:1px solid var(--border); padding-top:12px; margin-top:8px; font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between;">
                            <span>Issued: <strong>${formatDate(asset.validity_start)}</strong></span>
                            <span>Expires: <strong>${formatDate(asset.validity_end)}</strong></span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    lucide.createIcons();
}

// -------------------------------------------------------------
// PAGE 7: KNOWLEDGE SOURCES
// -------------------------------------------------------------
function loadSources() {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Knowledge Sources</h1>
                <div class="page-header-desc">List of external links and knowledge references feeding the RAG embedding engine.</div>
            </div>
        </div>
        
        <div class="detail-pane">
            <h3 style="margin-bottom:16px; font-size:16px;">Registered Sources</h3>
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Source ID</th>
                            <th>Reference Path</th>
                            <th>Status</th>
                            <th>Provenance Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight:600;">SRC-001</td>
                            <td><code>c:\\Users\\Saket Dronamraju\\Desktop\\RFP project\\01-RFPs-RFIs-RFQs\\Close Won\\SAP Central Finance Implementation Playbook.docx</code></td>
                            <td><span class="badge won">Synced</span></td>
                            <td><strong>15,400 vectors</strong></td>
                        </tr>
                        <tr>
                            <td style="font-weight:600;">SRC-002</td>
                            <td><code>c:\\Users\\Saket Dronamraju\\Desktop\\RFP project\\01-RFPs-RFIs-RFQs\\Close Won\\ISO-27001-Compliance-Language-2024.pdf</code></td>
                            <td><span class="badge won">Synced</span></td>
                            <td><strong>3,850 vectors</strong></td>
                        </tr>
                        <tr>
                            <td style="font-weight:600;">SRC-003</td>
                            <td><code>c:\\Users\\Saket Dronamraju\\Desktop\\RFP project\\01-RFPs-RFIs-RFQs\\Active Bids\\0-TURCK. - may 8th\\TURCK_Functional_Matrix.xlsx</code></td>
                            <td><span class="badge won">Synced</span></td>
                            <td><strong>1,100 vectors</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    lucide.createIcons();
}

// -------------------------------------------------------------
// PAGE 8: ANALYTICS
// -------------------------------------------------------------
function loadAnalytics() {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Analytics</h1>
                <div class="page-header-desc">Win/loss analysis, proposal volume charts, and SME verification turnaround time.</div>
            </div>
        </div>
        
        <div class="charts-grid" style="grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); margin-bottom: 24px;">
            <div class="chart-card">
                <div class="chart-header">
                    <h3>Submitted vs Won — Portfolio Win Rate</h3>
                </div>
                <div class="chart-container">
                    <canvas id="submittedVsWonChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-header">
                    <h3>Qualifications Trend</h3>
                </div>
                <div class="chart-container">
                    <canvas id="qualToSubChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon generations"><i data-lucide="clock"></i></div>
                <div class="stat-details">
                    <h3>Avg SME Turnaround</h3>
                    <div class="stat-number">1.4 Days</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon winrate"><i data-lucide="sparkles"></i></div>
                <div class="stat-details">
                    <h3>SME Hours Saved</h3>
                    <div class="stat-number">142 Hours</div>
                </div>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    
    // Draw charts using dashboard mock data
    const mockCharts = {
        submittedVsWon: [
            {"name": "Jan", "submitted": 4, "won": 2},
            {"name": "Feb", "submitted": 6, "won": 4},
            {"name": "Mar", "submitted": 5, "won": 3},
            {"name": "Apr", "submitted": 8, "won": 5},
            {"name": "May", "submitted": 7, "won": 5},
            {"name": "Jun", "submitted": 9, "won": 6}
        ],
        qualificationToSubmitted: [
            {"name": "Jan", "qualified": 8, "submitted": 4},
            {"name": "Feb", "qualified": 10, "submitted": 6},
            {"name": "Mar", "qualified": 9, "submitted": 5},
            {"name": "Apr", "qualified": 12, "submitted": 8},
            {"name": "May", "qualified": 11, "submitted": 7},
            {"name": "Jun", "qualified": 15, "submitted": 9}
        ]
    };
    renderDashboardCharts(mockCharts);
}

// -------------------------------------------------------------
// PLACEHOLDERS: SETTINGS, ADMINISTRATION, HELP, NOTIFICATIONS
// -------------------------------------------------------------
// -------------------------------------------------------------
// PAGE 7: ADMINISTRATION
// -------------------------------------------------------------
async function loadAdmin() {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Loading Admin Panel...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/admin/users`);
        const users = await res.json();
        
        renderAdminPage(users);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading user governance data: ${err.message}</div>`;
    }
}

function renderAdminPage(users) {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Administration</h1>
                <div class="page-header-desc">Manage system users, assign specialized SAP modules, and configure governance structures.</div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">
            <!-- Users list -->
            <div class="detail-pane">
                <h3 style="margin-top:0; margin-bottom:16px; font-size:16px;">SMEs & Governance Personnel</h3>
                <div class="data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Specialty</th>
                                <th>Email</th>
                                <th style="width: 80px; text-align: center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td><strong>${u.full_name}</strong></td>
                                    <td><span style="font-family: monospace; background: var(--bg-main); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">${u.username}</span></td>
                                    <td><span class="badge active">${u.role}</span></td>
                                    <td><span class="badge type-compliance">${u.specialty_module || 'Cross-App'}</span></td>
                                    <td style="color:var(--text-muted); font-size:13px;">${u.email || '-'}</td>
                                    <td style="text-align: center;">
                                        <button class="btn btn-secondary delete-user-btn" data-user-id="${u.id}" title="Remove User" style="padding: 4px 8px; color: var(--error); border-radius: 4px;">
                                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Side panel form -->
            <div class="detail-pane" style="position: sticky; top: 20px;">
                <h3 style="margin-top:0; margin-bottom:16px; font-size:16px;">Add New User</h3>
                <form id="add-user-form" style="display:flex; flex-direction:column; gap:16px;">
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:12px; font-weight:600; color:var(--text-muted);">Full Name</label>
                        <input type="text" id="add-user-fullname" placeholder="e.g. Robert Chen" required style="width:100%;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:12px; font-weight:600; color:var(--text-muted);">Username</label>
                        <input type="text" id="add-user-username" placeholder="e.g. robert.c" required style="width:100%;">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:12px; font-weight:600; color:var(--text-muted);">Role</label>
                        <select id="add-user-role" style="width:100%;">
                            <option value="SME">SME / Functional Expert</option>
                            <option value="Bid Manager">Bid Manager</option>
                            <option value="Bid Director">Bid Director</option>
                            <option value="Finance Controller">Finance Controller</option>
                            <option value="SAP Delivery Head">SAP Delivery Head</option>
                        </select>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:12px; font-weight:600; color:var(--text-muted);">SAP Specialty</label>
                        <select id="add-user-specialty" style="width:100%;">
                            <option value="Cross-App">Cross-App (General)</option>
                            <option value="FICO">SAP FICO (Finance/Controlling)</option>
                            <option value="MM">SAP MM (Materials Management)</option>
                            <option value="SD">SAP SD (Sales & Distribution)</option>
                            <option value="SCM">SAP SCM (Supply Chain)</option>
                        </select>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <label style="font-size:12px; font-weight:600; color:var(--text-muted);">Email Address</label>
                        <input type="email" id="add-user-email" placeholder="e.g. robert.c@mygo.com" required style="width:100%;">
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="margin-top:8px; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i data-lucide="user-plus"></i> Add Registered User
                    </button>
                </form>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    setupAdminHandlers();
}

function setupAdminHandlers() {
    // Add user submit listener
    const form = document.getElementById('add-user-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader" class="spin"></i> Creating...`;
            lucide.createIcons();
            
            const payload = {
                username: document.getElementById('add-user-username').value.trim(),
                full_name: document.getElementById('add-user-fullname').value.trim(),
                role: document.getElementById('add-user-role').value,
                specialty_module: document.getElementById('add-user-specialty').value,
                email: document.getElementById('add-user-email').value.trim()
            };
            
            try {
                const res = await fetch(`${API_URL}/api/admin/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    toastNotify("User added successfully");
                    loadAdmin();
                    refreshBadges();
                } else {
                    const err = await res.json();
                    alert("Failed to add user: " + (err.detail || "Unknown error"));
                    btn.disabled = false;
                    btn.innerHTML = `<i data-lucide="user-plus"></i> Add Registered User`;
                    lucide.createIcons();
                }
            } catch (err) {
                alert("Failed to add user: " + err.message);
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="user-plus"></i> Add Registered User`;
                lucide.createIcons();
            }
        });
    }
    
    // Delete user button listeners
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = btn.getAttribute('data-user-id');
            if (confirm("Are you sure you want to remove this user? This will revoke their SME assignments.")) {
                try {
                    const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        toastNotify("User removed successfully");
                        loadAdmin();
                        refreshBadges();
                    } else {
                        const err = await res.json();
                        alert("Failed to remove user: " + err.detail);
                    }
                } catch (err) {
                    alert("Failed to remove user: " + err.message);
                }
            }
        });
    });
}

// -------------------------------------------------------------
// PAGE 8: NOTIFICATIONS
// -------------------------------------------------------------
async function loadNotifications() {
    pageContent.innerHTML = `<div style="font-size:16px; color:var(--text-muted); text-align:center; padding:100px;">Loading Alerts...</div>`;
    
    try {
        const res = await fetch(`${API_URL}/api/notifications`);
        const alerts = await res.json();
        
        renderNotificationsPage(alerts);
    } catch (err) {
        pageContent.innerHTML = `<div style="color:var(--error); padding:20px;">Error loading notifications: ${err.message}</div>`;
    }
}

function renderNotificationsPage(alerts) {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Workspace Notifications</h1>
                <div class="page-header-desc">Real-time alerts tracking RAG processes, governance status, and SME assignment actions.</div>
            </div>
            
            <div class="page-actions" style="display:flex; gap:12px;">
                <button class="btn btn-secondary" id="notif-mark-all-read" ${alerts.every(a => a.is_read) ? 'disabled' : ''} style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="check-square"></i> Mark All as Read
                </button>
            </div>
        </div>
        
        <div class="detail-pane" style="max-width: 800px; margin: 0 auto;">
            ${alerts.length === 0 ? `
                <div style="text-align:center; padding:60px; color:var(--text-muted);">
                    <i data-lucide="bell-off" style="width:48px; height:48px; margin-bottom:16px; color:var(--text-muted);"></i>
                    <p style="margin:0; font-size:15px;">Your workspace is quiet. No alerts found.</p>
                </div>
            ` : `
                <div style="display:flex; flex-direction:column; gap:16px;">
                    ${alerts.map(a => {
                        let icon = 'info';
                        let cardColor = 'var(--text-light)';
                        let typeClass = 'pending';
                        if (a.notif_type === 'Success') {
                            icon = 'check-circle-2';
                            cardColor = '#10b981';
                            typeClass = 'winrate';
                        } else if (a.notif_type === 'Warning') {
                            icon = 'alert-triangle';
                            cardColor = '#f59e0b';
                            typeClass = 'pending';
                        } else if (a.notif_type === 'Error') {
                            icon = 'alert-octagon';
                            cardColor = '#ef4444';
                            typeClass = 'deadlines';
                        } else {
                            icon = 'info';
                            cardColor = 'var(--primary)';
                            typeClass = 'active';
                        }
                        
                        return `
                            <div class="notif-card" data-notif-id="${a.id}" style="display:flex; justify-content:space-between; align-items:start; padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border); background:${a.is_read ? 'var(--bg-card)' : 'rgba(99, 102, 241, 0.04)'}; transition:all 0.2s ease; position:relative;">
                                ${!a.is_read ? `<div style="position:absolute; left:6px; top:50%; transform:translateY(-50%); width:6px; height:6px; border-radius:50%; background:var(--primary);"></div>` : ''}
                                <div style="display:flex; gap:16px; align-items:start;">
                                    <div style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; background:var(--bg-main); border:1px solid var(--border); color:${cardColor}; flex-shrink:0;">
                                        <i data-lucide="${icon}" style="width:18px; height:18px;"></i>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:4px;">
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <h4 style="margin:0; font-size:14px; font-weight:600; color:var(--text-main);">${a.title}</h4>
                                            <span class="badge ${typeClass}" style="font-size:10px; padding:2px 6px;">${a.notif_type}</span>
                                        </div>
                                        <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.5;">${a.message}</p>
                                        <span style="font-size:11px; color:var(--text-light); margin-top:4px;">${new Date(a.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                                
                                <div style="display:flex; gap:8px; flex-shrink:0; align-items:center;">
                                    ${!a.is_read ? `
                                        <button class="btn btn-secondary mark-read-btn" data-notif-id="${a.id}" title="Mark as Read" style="padding:4px; display:flex; align-items:center; justify-content:center; border-radius:4px;">
                                            <i data-lucide="check" style="width:14px; height:14px;"></i>
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-secondary delete-notif-btn" data-notif-id="${a.id}" title="Delete Alert" style="padding:4px; display:flex; align-items:center; justify-content:center; color:var(--error); border-radius:4px;">
                                        <i data-lucide="x" style="width:14px; height:14px;"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
    
    lucide.createIcons();
    setupNotificationsHandlers();
}

function setupNotificationsHandlers() {
    // Mark all as read button
    const markAllBtn = document.getElementById('notif-mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            try {
                const res = await fetch(`${API_URL}/api/notifications/read`, { method: 'POST' });
                if (res.ok) {
                    toastNotify("All alerts marked as read");
                    loadNotifications();
                    refreshBadges();
                }
            } catch (err) {
                console.error("Failed to mark all read:", err);
            }
        });
    }
    
    // Mark single notification read
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const notifId = btn.getAttribute('data-notif-id');
            try {
                const res = await fetch(`${API_URL}/api/notifications/${notifId}/read`, { method: 'POST' });
                if (res.ok) {
                    loadNotifications();
                    refreshBadges();
                }
            } catch (err) {
                console.error("Failed to mark notification read:", err);
            }
        });
    });
    
    // Delete single notification
    document.querySelectorAll('.delete-notif-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const notifId = btn.getAttribute('data-notif-id');
            try {
                const res = await fetch(`${API_URL}/api/notifications/${notifId}`, { method: 'DELETE' });
                if (res.ok) {
                    loadNotifications();
                    refreshBadges();
                }
            } catch (err) {
                console.error("Failed to delete notification:", err);
            }
        });
    });
}

function renderPlaceholderPage(page) {
    pageContent.innerHTML = `
        <div class="detail-pane" style="text-align:center; padding:80px;">
            <i data-lucide="info" style="width:48px; height:48px; color:var(--primary); margin-bottom:16px;"></i>
            <h2 style="font-size:20px; font-weight:700; margin-bottom:8px; text-transform:capitalize;">${page} Section</h2>
            <p style="color:var(--text-muted); max-width:500px; margin:0 auto 24px auto;">
                This module is part of the BidGenius AI roadmap. The database models and design structures are prepared. Connect to backend in next iteration.
            </p>
        </div>
    `;
    lucide.createIcons();
}

// -------------------------------------------------------------
// PAGE 9: HELP & SUPPORT
// -------------------------------------------------------------
function loadHelp() {
    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Help & Support</h1>
                <div class="page-header-desc">Complete user guide, system documentation, and operational FAQs.</div>
            </div>
        </div>
        
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); margin-bottom:24px;">
            <div class="stat-card" style="gap:16px;">
                <div class="stat-icon active"><i data-lucide="book-open"></i></div>
                <div class="stat-details">
                    <h3 style="margin-bottom:4px;">User Guide</h3>
                    <p style="margin:0; font-size:13px; color:var(--text-muted);">Step-by-step walkthrough of opportunity workflows.</p>
                </div>
            </div>
            <div class="stat-card" style="gap:16px;">
                <div class="stat-icon winrate"><i data-lucide="help-circle"></i></div>
                <div class="stat-details">
                    <h3 style="margin-bottom:4px;">FAQs</h3>
                    <p style="margin:0; font-size:13px; color:var(--text-muted);">Common technical and operational questions.</p>
                </div>
            </div>
        </div>
        
        <div class="detail-pane" style="max-width: 900px; margin: 0 auto; display:flex; flex-direction:column; gap:28px;">
            <!-- Document sections -->
            <section>
                <h3 style="margin-top:0; border-bottom:1px solid var(--border); padding-bottom:8px; font-size:16px; color:var(--primary); display:flex; align-items:center; gap:8px;">
                    <i data-lucide="arrow-right-circle" style="width:18px; height:18px;"></i> Opportunity Pipeline & Bids
                </h3>
                <p style="font-size:14px; line-height:1.6; color:var(--text-muted);">
                    The system syncs directly with the file system. When you add a new opportunity folder in the active bids directory, it is detected instantly. Inside each bid:
                </p>
                <ul style="font-size:14px; line-height:1.8; color:var(--text-muted); padding-left:20px;">
                    <li><strong>Inbound RFP Files:</strong> Contains all files associated with the bid. You can upload new documents or run an AI RAG scan on existing ones.</li>
                    <li><strong>Requirements Matrix:</strong> The heart of the opportunity. It populates automatically from RAG runs, tracing each requirement back to its exact source file.</li>
                    <li><strong>Gate Sign-offs:</strong> Multi-level approvals. Bids progress through Level 1 (Finance), Level 2 (SAP Delivery), and Level 3 (Bid Manager) gates.</li>
                </ul>
            </section>
            
            <section>
                <h3 style="border-bottom:1px solid var(--border); padding-bottom:8px; font-size:16px; color:var(--primary); display:flex; align-items:center; gap:8px;">
                    <i data-lucide="cpu" style="width:18px; height:18px;"></i> AI RAG Extraction Engine
                </h3>
                <p style="font-size:14px; line-height:1.6; color:var(--text-muted);">
                    When you click <strong>Run AI RAG Analysis</strong>, the portal reads the document text chunks, converts them to high-dimensional embeddings, and matches them against the <strong>20,350 master records</strong> in the pgvector database.
                </p>
                <p style="font-size:14px; line-height:1.6; color:var(--text-muted);">
                    To prevent duplicate runs, if a file has already been scanned, the system will prompt a confirmation dialog. You can force-scan to refresh database entries or cancel to keep them.
                </p>
            </section>
            
            <section>
                <h3 style="border-bottom:1px solid var(--border); padding-bottom:8px; font-size:16px; color:var(--primary); display:flex; align-items:center; gap:8px;">
                    <i data-lucide="help-circle" style="width:18px; height:18px;"></i> Frequently Asked Questions
                </h3>
                <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px;">
                    <div style="background:var(--bg-main); padding:16px; border-radius:6px; border:1px solid var(--border);">
                        <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:600; color:var(--text-main);">How do I assign an SME to a requirement?</h4>
                        <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.5;">
                            Navigate to the Requirements Matrix, click on any requirement row, select the target SME and SAP module in the dialog, and hit save. The requirement is immediately routed to their personal <strong>My Tasks</strong> screen.
                        </p>
                    </div>
                    <div style="background:var(--bg-main); padding:16px; border-radius:6px; border:1px solid var(--border);">
                        <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:600; color:var(--text-main);">Can I preview mock files in the Knowledge Repository?</h4>
                        <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.5;">
                            Yes! For database-only mock files (e.g. system seed records), clicking the eye icon will dynamically query the pgvector text chunk and render a preview. Clicking the download icon will package it into a plain text file.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    `;
    lucide.createIcons();
}

// -------------------------------------------------------------
// EDIT REQUIREMENT MODAL CONTROLLER
// -------------------------------------------------------------
let activeModalReq = null;

function setupModal() {
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    saveModalBtn.addEventListener('click', saveModalChanges);
    
    // Bind Generate AI Response in Modal
    const modalGenerateBtn = document.getElementById('modal-generate-ai-btn');
    if (modalGenerateBtn) {
        modalGenerateBtn.addEventListener('click', async () => {
            if (!activeModalReq) return;
            modalGenerateBtn.disabled = true;
            modalGenerateBtn.style.opacity = '0.5';
            
            const aiResponseDiv = document.getElementById('modal-ai-response');
            if (aiResponseDiv) {
                aiResponseDiv.innerHTML = `<span style="color:var(--primary); font-size:12px;">Generating...</span>`;
            }
            
            try {
                const selectedModel = localStorage.getItem("selected_model") || "gemini/gemini-2.5-flash-lite";
                const res = await fetch(`${API_URL}/api/requirements/${activeModalReq.id}/generate-answer?model_name=${encodeURIComponent(selectedModel)}`, {
                    method: 'POST'
                });
                if (res.ok) {
                    const data = await res.json();
                    activeModalReq = data; // Update local reference
                    if (aiResponseDiv) {
                        aiResponseDiv.innerHTML = `<span>${data.ai_generated_response}</span>`;
                    }
                    
                    // Also dynamically update modal fields
                    document.getElementById('modal-type').value = data.requirement_type || 'Question';
                    let moduleVal = data.sap_module || 'Cross-Application';
                    if (moduleVal === 'Cross-App') moduleVal = 'Cross-Application';
                    document.getElementById('modal-sap-module').value = moduleVal;
                    document.getElementById('modal-fitment').value = data.fitment_score || 'Need Further Info';
                    document.getElementById('modal-sme').value = data.assigned_sme || 'Unassigned';
                    
                    // Update referenced documents subsection
                    renderModalReferences(data);
                } else {
                    const err = await res.json();
                    if (aiResponseDiv) {
                        aiResponseDiv.innerHTML = `<span style="color:var(--error); font-size:12px;">Error: ${err.detail || "Failed to generate"}</span>`;
                    }
                }
            } catch (err) {
                console.error("Modal AI Generation Error:", err);
                if (aiResponseDiv) {
                    aiResponseDiv.innerHTML = `<span style="color:var(--error); font-size:12px;">Error: Network issue</span>`;
                }
            } finally {
                modalGenerateBtn.disabled = false;
                modalGenerateBtn.style.opacity = '1';
            }
        });
    }

    // Bind Rephrase custom answer draft in Modal
    const modalRephraseBtn = document.getElementById('modal-rephrase-ai-btn');
    if (modalRephraseBtn) {
        modalRephraseBtn.addEventListener('click', async () => {
            if (!activeModalReq) return;
            const draftInput = document.getElementById('modal-override-response');
            const draftText = draftInput?.value || '';
            if (!draftText.trim()) {
                alert("Please type a rough draft in the Custom Answer textarea before clicking Rephrase.");
                return;
            }
            
            modalRephraseBtn.disabled = true;
            modalRephraseBtn.style.opacity = '0.5';
            const originalPlaceholder = draftInput.placeholder;
            draftInput.placeholder = "AI is polishing your draft...";
            draftInput.disabled = true;
            
            try {
                const selectedModel = localStorage.getItem("selected_model") || "gemini/gemini-2.5-flash-lite";
                const res = await fetch(`${API_URL}/api/requirements/${activeModalReq.id}/rephrase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: draftText,
                        model_name: selectedModel
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (draftInput) {
                        draftInput.value = data.rephrased_text;
                    }
                } else {
                    const err = await res.json();
                    alert("Rephrasing failed: " + (err.detail || "Unknown error"));
                }
            } catch (err) {
                console.error("Rephrasing Error:", err);
                alert("Rephrasing failed: Network issue");
            } finally {
                modalRephraseBtn.disabled = false;
                modalRephraseBtn.style.opacity = '1';
                if (draftInput) {
                    draftInput.disabled = false;
                    draftInput.placeholder = originalPlaceholder;
                }
            }
        });
    }
    
    // Close modal on outside click
    reqModal.addEventListener('click', (e) => {
        if (e.target === reqModal) closeModal();
    });
}

function renderModalReferences(req) {
    const refContainer = document.getElementById('modal-references-container');
    const refList = document.getElementById('modal-references-list');
    
    if (refContainer && refList) {
        refList.innerHTML = '';
        const rawSources = req.ai_sources_listed;
        
        if (rawSources && rawSources !== 'System Knowledge' && rawSources !== 'Pending') {
            let sources = [];
            try {
                if (rawSources.trim().startsWith('[')) {
                    sources = JSON.parse(rawSources);
                } else {
                    sources = rawSources.split(',').map(s => ({ file_source: s.trim(), text_content: null }));
                }
            } catch (e) {
                sources = rawSources.split(',').map(s => ({ file_source: s.trim(), text_content: null }));
            }
            
            if (sources.length > 0) {
                refContainer.style.display = 'flex';
                sources.forEach(ref => {
                    const fileSource = ref.file_source || ref.file || 'Unknown Document';
                    const textSnippet = ref.text_content || 'Vector reference snippet not available for this legacy record.';
                    
                    const item = document.createElement('div');
                    item.style.border = '1px solid var(--border)';
                    item.style.borderRadius = 'var(--radius-sm)';
                    item.style.background = 'var(--bg-main)';
                    item.style.padding = '10px';
                    
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 12px; font-weight: 600; color: var(--primary); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%;" title="${fileSource}">${fileSource}</span>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-secondary modal-ref-preview-btn" data-file="${fileSource}" title="Preview Document" style="padding: 2px 6px; font-size: 11px; height: 22px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: var(--bg-surface); cursor: pointer;">
                                    <i data-lucide="eye" style="width: 10px; height: 10px;"></i>
                                    <span>Preview</span>
                                </button>
                                <button class="btn btn-secondary modal-ref-download-btn" data-file="${fileSource}" title="Download Document" style="padding: 2px 6px; font-size: 11px; height: 22px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border); background: var(--bg-surface); cursor: pointer;">
                                    <i data-lucide="download" style="width: 10px; height: 10px;"></i>
                                    <span>Download</span>
                                </button>
                            </div>
                        </div>
                        <div style="font-size: 11.5px; line-height: 1.45; color: var(--text-muted); background: rgba(0,0,0,0.02); padding: 8px; border-radius: 4px; border-left: 3px solid var(--primary); font-style: italic; max-height: 80px; overflow-y: auto;">
                            "${textSnippet}"
                        </div>
                    `;
                    
                    // Bind preview button
                    const previewBtn = item.querySelector('.modal-ref-preview-btn');
                    previewBtn.addEventListener('click', async () => {
                        try {
                            const res = await fetch(`${API_URL}/api/documents/preview?rel_path=${encodeURIComponent(fileSource)}` + (req.bid_id ? `&bid_id=${req.bid_id}` : ''));
                            if (res.ok) {
                                const data = await res.json();
                                if (data.type === 'pdf') {
                                    window.open(data.url, '_blank');
                                } else if (data.type === 'html') {
                                    const previewWin = window.open("", "_blank");
                                    previewWin.document.write(`
                                        <html>
                                            <head>
                                                <title>Preview - ${fileSource}</title>
                                                <style>
                                                    body { font-family: system-ui, sans-serif; padding: 24px; color: #333; line-height: 1.6; }
                                                    .preview-table { border-collapse: collapse; width: 100%; margin-top: 10px; }
                                                    .preview-table th, .preview-table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                                                    .preview-table th { background: #f4f4f4; }
                                                </style>
                                            </head>
                                            <body>
                                                <h2>Document Preview: ${fileSource}</h2>
                                                <div>${data.html || data.content}</div>
                                            </body>
                                        </html>
                                    `);
                                    previewWin.document.close();
                                }
                            } else {
                                alert("Preview failed: Document not found or unsupported.");
                            }
                        } catch (err) {
                            alert("Preview failed: " + err.message);
                        }
                    });
                    
                    // Bind download button
                    const downloadBtn = item.querySelector('.modal-ref-download-btn');
                    downloadBtn.addEventListener('click', () => {
                        window.open(`${API_URL}/api/documents/view?rel_path=${encodeURIComponent(fileSource)}&download=true` + (req.bid_id ? `&bid_id=${req.bid_id}` : ''), '_blank');
                    });
                    
                    refList.appendChild(item);
                });
                lucide.createIcons();
            } else {
                refContainer.style.display = 'none';
            }
        } else {
            refContainer.style.display = 'none';
        }
    }
}

function openRequirementModal(req) {
    activeModalReq = req;
    
    document.getElementById('modal-req-id').textContent = `Requirement Workspace — ${req.requirement_id_source || `REQ-${req.id}`}`;
    document.getElementById('modal-question-text').textContent = req.question_text;
    document.getElementById('modal-type').value = req.requirement_type || 'Question';
    let moduleVal = req.sap_module || 'Cross-Application';
    if (moduleVal === 'Cross-App') {
        moduleVal = 'Cross-Application';
    }
    document.getElementById('modal-sap-module').value = moduleVal;
    document.getElementById('modal-fitment').value = req.fitment_score || 'Need Further Info';
    document.getElementById('modal-sme').value = req.assigned_sme || 'Unassigned';
    document.getElementById('modal-sme-status').value = req.sme_status || 'Pending';
    document.getElementById('modal-ai-response').textContent = req.ai_generated_response || 'RAG response has not been generated yet for this item.';
    document.getElementById('modal-override-response').value = req.manual_override_response || '';
    document.getElementById('modal-flagged').checked = req.flagged_for_management || false;
    
    // Render referenced documents subsection
    renderModalReferences(req);
    
    reqModal.classList.add('active');
    lucide.createIcons();
}

function closeModal() {
    reqModal.classList.remove('active');
    activeModalReq = null;
}

async function saveModalChanges() {
    if (!activeModalReq) return;
    
    const requirement_type = document.getElementById('modal-type').value;
    const sap_module = document.getElementById('modal-sap-module').value;
    const assigned_sme = document.getElementById('modal-sme').value;
    const fitment_score = document.getElementById('modal-fitment').value;
    const manual_override_response = document.getElementById('modal-override-response').value;
    const sme_status = document.getElementById('modal-sme-status').value;
    const flagged_for_management = document.getElementById('modal-flagged').checked;
    
    const payload = {
        requirement_type,
        sap_module,
        assigned_sme: assigned_sme === 'Unassigned' ? null : assigned_sme,
        fitment_score,
        manual_override_response: manual_override_response.trim() || null,
        sme_status,
        flagged_for_management
    };
    
    try {
        const res = await fetch(`${API_URL}/api/requirements/${activeModalReq.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            closeModal();
            // Reload the active page to show updated requirements
            navigate(state.activePage);
            refreshBadges();
        } else {
            const err = await res.json();
            alert("Failed to save changes: " + err.detail);
        }
    } catch (err) {
        alert("Failed to save changes: " + err.message);
    }
}

function setupCreateBidModal() {
    closeBidModalBtn.addEventListener('click', closeCreateBidModal);
    cancelBidModalBtn.addEventListener('click', closeCreateBidModal);
    saveNewBidBtn.addEventListener('click', saveNewBid);
    
    // Close modal on outside click
    createBidModal.addEventListener('click', (e) => {
        if (e.target === createBidModal) closeCreateBidModal();
    });
}

function openCreateBidModal() {
    document.getElementById('new-bid-name').value = '';
    document.getElementById('new-bid-manager').value = 'Priya Sharma';
    document.getElementById('new-bid-complexity').value = 'Medium';
    
    // Set default date to today + 20 days
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 20);
    const dateString = defaultDate.toISOString().split('T')[0];
    document.getElementById('new-bid-due-date').value = dateString;
    
    createBidModal.classList.add('active');
    lucide.createIcons();
}

function closeCreateBidModal() {
    createBidModal.classList.remove('active');
}

async function saveNewBid() {
    const bid_name = document.getElementById('new-bid-name').value.trim();
    const bid_manager = document.getElementById('new-bid-manager').value.trim();
    const complexity = document.getElementById('new-bid-complexity').value;
    const bid_submission_date = document.getElementById('new-bid-due-date').value;
    
    if (!bid_name) {
        alert("Please enter a Bid Opportunity Name.");
        return;
    }
    if (!bid_submission_date) {
        alert("Please select a Submission Due Date.");
        return;
    }
    
    const payload = {
        bid_name,
        bid_manager,
        complexity,
        bid_submission_date
    };
    
    saveNewBidBtn.disabled = true;
    saveNewBidBtn.innerHTML = `<i data-lucide="loader" class="spin"></i> Creating...`;
    lucide.createIcons();
    
    try {
        const res = await fetch(`${API_URL}/api/bids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            closeCreateBidModal();
            loadBids();
            refreshBadges();
        } else {
            const err = await res.json();
            alert("Failed to create bid: " + err.detail);
        }
    } catch (err) {
        alert("Failed to create bid: " + err.message);
    } finally {
        saveNewBidBtn.disabled = false;
        saveNewBidBtn.innerHTML = `Create Workspace`;
        lucide.createIcons();
    }
}

// -------------------------------------------------------------
// FORMATTING HELPERS
// -------------------------------------------------------------
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// -------------------------------------------------------------
// DYNAMIC TABS: SETTINGS CONFIGURATION
// -------------------------------------------------------------

function loadSettings() {
    const selectedModel = localStorage.getItem("selected_model") || "gemini/gemini-2.5-flash-lite";
    
    // Map of keys to display names
    const modelNames = {
        "gemini/gemini-3.5-flash": "Gemini 3.5 Flash",
        "gemini/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
        "gemini/gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (Recommended)",
        "anthropic/claude-sonnet-5": "Claude Sonnet 5"
    };
    
    const activeModelName = modelNames[selectedModel] || selectedModel;

    pageContent.innerHTML = `
        <div class="page-header">
            <div>
                <h1>Configuration</h1>
                <div class="page-header-desc">Configure global AI models, API keys, and server settings.</div>
            </div>
        </div>
        
        <div class="detail-pane" style="max-width: 600px;">
            <h3 style="font-size: 16px; margin-bottom: 20px;">AI Model Configuration</h3>
            
            <div class="form-group" style="margin-bottom: 20px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Active AI Model</label>
                <p style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Select the model used for RFP analysis.</p>
                
                <!-- Custom Dropdown Component -->
                <div class="custom-select-wrapper" id="model-select-wrapper">
                    <div class="custom-select-trigger" id="model-select-trigger">
                        <span id="model-select-value">${activeModelName}</span>
                        <i data-lucide="chevron-down" class="custom-select-arrow"></i>
                    </div>
                    <div class="custom-select-options" id="model-select-options">
                        <div class="custom-select-option ${selectedModel === 'gemini/gemini-3.5-flash' ? 'active' : ''}" data-value="gemini/gemini-3.5-flash">Gemini 3.5 Flash</div>
                        <div class="custom-select-option ${selectedModel === 'gemini/gemini-3.1-flash-lite' ? 'active' : ''}" data-value="gemini/gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</div>
                        <div class="custom-select-option ${selectedModel === 'gemini/gemini-2.5-flash-lite' ? 'active' : ''}" data-value="gemini/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Recommended)</div>
                        <div class="custom-select-option ${selectedModel === 'anthropic/claude-sonnet-5' ? 'active' : ''}" data-value="anthropic/claude-sonnet-5">Claude Sonnet 5</div>
                    </div>
                </div>
                
                <!-- Hidden input to hold value -->
                <input type="hidden" id="setting-active-model" value="${selectedModel}">
            </div>
            
            <button class="btn btn-primary" id="save-settings-btn" style="width: 100%; justify-content: center; height: 42px; margin-top: 10px;">
                Save Configuration
            </button>
        </div>
        
        <div class="detail-pane" style="max-width: 600px; margin-top: 24px;">
            <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--text-main);">Connection Status</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span>RFP Tracker API (Port 8000)</span>
                    <span style="color: var(--success); font-weight: 600;">● Online</span>
                </div>
            </div>
        </div>
    `;
    
    // Create icons
    lucide.createIcons();
    
    // Dropdown Interactive Logic
    const wrapper = document.getElementById("model-select-wrapper");
    const trigger = document.getElementById("model-select-trigger");
    const valueSpan = document.getElementById("model-select-value");
    const hiddenInput = document.getElementById("setting-active-model");
    
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        wrapper.classList.toggle("open");
    });
    
    document.querySelectorAll(".custom-select-option").forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            const val = opt.getAttribute("data-value");
            const text = opt.textContent;
            
            hiddenInput.value = val;
            valueSpan.textContent = text;
            
            document.querySelectorAll(".custom-select-option").forEach(o => o.classList.remove("active"));
            opt.classList.add("active");
            
            wrapper.classList.remove("open");
        });
    });
    
    // Click outside to close
    document.addEventListener("click", () => {
        const activeWrapper = document.getElementById("model-select-wrapper");
        if (activeWrapper) {
            activeWrapper.classList.remove("open");
        }
    });

    // Bind Save button
    document.getElementById("save-settings-btn").addEventListener("click", () => {
        const newModel = hiddenInput.value;
        localStorage.setItem("selected_model", newModel);
        toastNotify("Settings saved successfully! Active model: " + newModel);
    });
}

function toastNotify(message) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.backgroundColor = "var(--text-main)";
    toast.style.color = "#ffffff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "var(--radius-sm)";
    toast.style.boxShadow = "var(--shadow-md)";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "500";
    toast.style.zIndex = "1000";
    toast.textContent = message;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.5s ease-out";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function setupPreviewModal() {
    const modal = document.getElementById('preview-modal');
    const closeBtn = document.getElementById('close-preview-btn');
    const closeFooterBtn = document.getElementById('close-preview-footer-btn');
    
    if (!modal) return;
    
    const closeModal = () => {
        modal.classList.remove('active');
        const body = document.getElementById('preview-modal-body');
        if (body) body.innerHTML = '';
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

async function openDocumentPreview(relPath, bidId = null) {
    const modal = document.getElementById('preview-modal');
    const title = document.getElementById('preview-modal-title');
    const body = document.getElementById('preview-modal-body');
    
    if (!modal || !body || !title) return;
    
    title.textContent = "Loading Document...";
    body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height: 300px; padding: 40px;">
            <i data-lucide="loader" class="spin" style="width: 48px; height: 48px; color: var(--primary); margin-bottom: 16px;"></i>
            <p style="color:var(--text-light); font-size:15px;">Reading document contents, please wait...</p>
        </div>
    `;
    modal.classList.add('active');
    lucide.createIcons();
    
    try {
        let url = `${API_URL}/api/documents/preview?rel_path=${encodeURIComponent(relPath)}`;
        if (bidId) {
            url += `&bid_id=${bidId}`;
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not parse file");
        
        const data = await res.json();
        title.textContent = data.filename || "Document Preview";
        
        if (data.type === 'pdf') {
            if (navigator.pdfViewerEnabled) {
                body.style.padding = "0";
                body.innerHTML = `
                    <iframe src="${API_URL}${data.url}" style="width:100%; height:100%; border:none; min-height:60vh;"></iframe>
                `;
            } else {
                body.style.padding = "32px";
                body.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px; text-align:center;">
                        <i data-lucide="alert-circle" style="width:48px; height:48px; color:var(--text-light); margin-bottom:16px;"></i>
                        <h3 style="margin-bottom:12px; font-size:16px; color: var(--text-main);">PDF Preview Not Supported</h3>
                        <p style="margin-bottom:20px; font-size: 14px; color: var(--text-light); max-width: 500px;">
                            Inline PDF viewing is disabled or not supported in your browser settings. Please use the button below to download and view this file.
                        </p>
                        <a href="${API_URL}${data.url}&download=true" target="_blank" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:8px;">
                            <i data-lucide="download"></i> Download PDF Document
                        </a>
                    </div>
                `;
                lucide.createIcons();
            }
        } else if (data.type === 'html') {
            body.style.padding = "32px";
            body.innerHTML = data.content || data.html || '';
        } else if (data.type === 'text') {
            body.style.padding = "32px";
            body.innerHTML = data.content || data.html || '';
        } else {
            body.style.padding = "32px";
            body.innerHTML = `
                <div style="text-align:center; padding: 40px;">
                    <i data-lucide="alert-circle" style="width:48px; height:48px; color:var(--text-muted); margin-bottom:16px;"></i>
                    <p style="margin-bottom:20px; font-size: 15px;">${data.message || 'Inline viewing not supported for this file type.'}</p>
                    <a href="${API_URL}${data.download_url}" target="_blank" class="btn btn-primary">
                        <i data-lucide="download"></i> Download File
                    </a>
                </div>
            `;
            lucide.createIcons();
        }
    } catch (err) {
        title.textContent = "Error Loading Preview";
        body.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--state-error);">
                <i data-lucide="alert-octagon" style="width:48px; height:48px; margin-bottom:16px;"></i>
                <p>Failed to parse the file: ${err.message}</p>
            </div>
        `;
        lucide.createIcons();
    }
}

// -------------------------------------------------------------
// USER ACCESS CONTROL & AUTHENTICATION SYSTEMS
// -------------------------------------------------------------
function setupAuth() {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    
    // Check if session exists in localStorage
    const savedUser = localStorage.getItem("current_user");
    if (savedUser) {
        state.currentUser = JSON.parse(savedUser);
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        applyRoleAccessControl();
        
        // Load default page based on role
        if (state.currentUser.role === 'SME') {
            state.activePage = 'tasks';
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
                if (item.getAttribute('data-page') === 'tasks') {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
            loadTasks();
        } else {
            loadDashboard();
        }
        refreshBadges();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        lucide.createIcons();
    }
    
    // Login form submission handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('login-username').value.trim();
            const passwordInput = document.getElementById('login-password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i data-lucide="loader" class="spin"></i> Signing in...`;
            lucide.createIcons();
            
            try {
                const res = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameInput, password: passwordInput })
                });
                
                if (res.ok) {
                    const user = await res.json();
                    state.currentUser = user;
                    localStorage.setItem("current_user", JSON.stringify(user));
                    
                    loginContainer.style.display = 'none';
                    appContainer.style.display = 'flex';
                    applyRoleAccessControl();
                    
                    // Reset navigate to default page
                    if (user.role === 'SME') {
                        state.activePage = 'tasks';
                        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
                            if (item.getAttribute('data-page') === 'tasks') {
                                item.classList.add('active');
                            } else {
                                item.classList.remove('active');
                            }
                        });
                        loadTasks();
                    } else {
                        state.activePage = 'dashboard';
                        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
                            if (item.getAttribute('data-page') === 'dashboard') {
                                item.classList.add('active');
                            } else {
                                item.classList.remove('active');
                            }
                        });
                        loadDashboard();
                    }
                    
                    refreshBadges();
                    toastNotify(`Welcome back, ${user.full_name}!`);
                } else {
                    const err = await res.json();
                    alert("Authentication failed: " + (err.detail || "Invalid credentials"));
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i data-lucide="log-in"></i> Sign In`;
                    lucide.createIcons();
                }
            } catch (err) {
                alert("Connection failed: " + err.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i data-lucide="log-in"></i> Sign In`;
                lucide.createIcons();
            }
        });
    }
    
    // Logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to sign out?")) {
                localStorage.removeItem("current_user");
                state.currentUser = null;
                loginContainer.style.display = 'flex';
                appContainer.style.display = 'none';
                
                // Reset form fields
                document.getElementById('login-username').value = '';
                document.getElementById('login-password').value = '';
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i data-lucide="log-in"></i> Sign In`;
                }
                lucide.createIcons();
            }
        });
    }
}

function applyRoleAccessControl() {
    const role = state.currentUser ? state.currentUser.role : null;
    
    // Show/Hide sidebar links based on role
    document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-footer .nav-item').forEach(item => {
        const page = item.getAttribute('data-page');
        if (role === 'SME') {
            if (['dashboard', 'bids', 'analytics', 'admin'].includes(page)) {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        } else {
            item.style.display = 'flex';
        }
    });
    
    // Show current logged-in user in the header profile
    const profileName = document.querySelector('.profile-name');
    const profileRole = document.querySelector('.profile-role');
    if (profileName && state.currentUser) {
        profileName.textContent = state.currentUser.full_name;
        profileRole.textContent = state.currentUser.role;
    }
}

function renderAccessDenied() {
    pageContent.innerHTML = `
        <div class="detail-pane" style="text-align:center; padding:80px; max-width: 600px; margin: 40px auto;">
            <i data-lucide="shield-alert" style="width:48px; height:48px; color:var(--error); margin-bottom:16px;"></i>
            <h2 style="font-size:20px; font-weight:700; margin-bottom:8px;">Access Denied</h2>
            <p style="color:var(--text-muted); line-height:1.6; margin-bottom:0;">
                Your account role (<strong>${state.currentUser.role}</strong>) does not have authorization to view this governance administrative module. Please contact Bid Director Priya Sharma if this is an error.
            </p>
        </div>
    `;
    lucide.createIcons();
}
