/**
 * QuantumLayers Affiliate / Partner Program — Frontend JavaScript
 * File: wp-content/plugins/quantumlayers/assets/affiliate.js
 */

(function($) {
    'use strict';

    const QLAffiliate = {
        affiliateData: null,

        init: function() {
            if (typeof qlAuth === 'undefined') {
                console.error('qlAuth not loaded');
                window.location.href = '/ql-login?redirect=/ql-affiliate';
                return;
            }
            this.showLoading();
            this.checkAffiliateStatus();
        },

        bindEvents: function() {
            // Application form
            $(document).on('click', '#ql-apply-partner-btn', this.handleApply.bind(this));

            // Dashboard: copy referral code / link
            $(document).on('click', '.ql-copy-btn', this.handleCopy.bind(this));

            // Dashboard: Stripe connect
            $(document).on('click', '#ql-connect-stripe-btn', this.handleStripeConnect.bind(this));
            $(document).on('click', '#ql-reconnect-stripe-btn', this.handleStripeConnect.bind(this));
            $(document).on('click', '#ql-manage-stripe-btn', this.handleStripeManage.bind(this));

            // Pending page: refresh onboarding link
            $(document).on('click', '#ql-refresh-onboarding-btn', this.handleStripeConnect.bind(this));

            // Dashboard: payout threshold
            $(document).on('click', '#ql-save-threshold-btn', this.handleSetThreshold.bind(this));
        },

        // ─── Status Check ────────────────────────────────────────────────────────

        checkAffiliateStatus: function() {
            const headers = {};
            const token = (typeof QLAuth !== 'undefined') ? QLAuth.getSessionToken() : null;
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: headers,
                data: {
                    action: 'ql_get_affiliate_stats',
                    nonce: qlAuth.nonce
                },
                success: (response) => {
                    this.hideLoading();
                    if (response.success) {
                        this.affiliateData = response.data;
                        if (response.data.status === 'pending') {
                            this.renderPendingPage();
                        } else {
                            this.renderDashboard(response.data);
                        }
                        this.bindEvents();
                    } else {
                        // Logged in but not an affiliate — show marketing + form
                        this.renderPublicPage(true);
                        this.bindEvents();
                    }
                },
                error: (xhr) => {
                    this.hideLoading();
                    if (xhr.status === 401) {
                        window.location.href = '/ql-login?redirect=/ql-affiliate';
                    } else {
                        // Check auth separately to determine view
                        this.checkAuthThenRender();
                    }
                }
            });
        },

        checkAuthThenRender: function() {
            const headers = {};
            const token = (typeof QLAuth !== 'undefined') ? QLAuth.getSessionToken() : null;
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: headers,
                data: {
                    action: 'ql_check_auth',
                    nonce: qlAuth.nonce
                },
                success: (response) => {
                    this.renderPublicPage(response.success === true);
                    this.bindEvents();
                },
                error: () => {
                    this.renderPublicPage(false);
                    this.bindEvents();
                }
            });
        },

        // ─── Rendering ───────────────────────────────────────────────────────────

        renderPublicPage: function(isLoggedIn) {
            const $marketing = $('#ql-affiliate-marketing');
            const $apply     = $('#ql-affiliate-apply-section');

            $marketing.html(this.buildMarketingHTML()).show();

            if (isLoggedIn) {
                $apply.html(this.buildApplicationFormHTML()).show();
            } else {
                $apply.html(`
                    <div class="ql-affiliate-section">
                        <h3>Ready to Partner With Us?</h3>
                        <p class="ql-affiliate-section-intro">
                            Create a free QuantumLayers account or sign in to apply for the Partner Program.
                        </p>
                        <div class="ql-affiliate-cta-row">
                            <a href="/ql-login?redirect=/ql-affiliate" class="ql-btn ql-btn-primary">Sign In to Apply</a>
                            <a href="/ql-login?mode=register&redirect=/ql-affiliate" class="ql-btn ql-btn-secondary">Create Account</a>
                        </div>
                    </div>
                `).show();
            }
        },

        buildMarketingHTML: function() {
            return `
                <div class="ql-affiliate-hero">
                    <div class="ql-affiliate-hero-content">
                        <div class="ql-affiliate-hero-badge">Partner Program</div>
                        <h1 class="ql-affiliate-hero-title">Grow Together with QuantumLayers</h1>
                        <p class="ql-affiliate-hero-sub">
                            Join our partner network and earn recurring commissions on every subscription
                            your referrals pay — as direct cash payouts or as a discount on your own plan.
                        </p>
                        <a href="#ql-affiliate-apply-section" class="ql-btn ql-btn-primary ql-btn-lg">Apply as a Partner</a>
                    </div>
                </div>

                <div class="ql-affiliate-section">
                    <h2 class="ql-section-heading">Why Become a QuantumLayers Partner?</h2>
 
                        <div class="ql-benefit-card">
                            <p>
                                Earn <strong>25% commission</strong> on every individual Pro subscriber you refer,
                                plus commissions on organization deals — <strong>10% on Startup</strong> and
                                <strong>5% on Enterprise</strong>. Commissions are paid as cash transfers
                                to your Stripe account once your accumulated balance reaches your chosen threshold.
                            </p>
                            <ul class="ql-benefit-list">
                                <li>25% of each referred Pro subscriber's payment</li>
                                <li>10% on Startup org deals, 5% on Enterprise</li>
                                <li>Cash transfers to your Stripe account</li>
                                <li>Commissions accumulate until your payout threshold is met</li>
                                <li>Lifetime commissions — not just the first payment</li>
                            </ul>
                        </div>

                </div>

                <div class="ql-affiliate-section ql-affiliate-how-it-works">
                    <h2 class="ql-section-heading">How It Works</h2>
                    <div class="ql-steps-grid">
                        <div class="ql-step">
                            <div class="ql-step-number">1</div>
                            <h4>Apply</h4>
                            <p>Submit your partner application below. Approval is instant — we just need to connect your Stripe account for payouts.</p>
                        </div>
                        <div class="ql-step-divider">&rsaquo;</div>
                        <div class="ql-step">
                            <div class="ql-step-number">2</div>
                            <h4>Share Your Link</h4>
                            <p>Get your unique referral link from the partner dashboard and share it with your audience, clients, or network.</p>
                        </div>
                        <div class="ql-step-divider">&rsaquo;</div>
                        <div class="ql-step">
                            <div class="ql-step-number">3</div>
                            <h4>Earn</h4>
                            <p>Earn 25% each time a referral subscribes to Pro, or 10% / 5% on Startup / Enterprise organization deals — every month, for as long as they stay subscribed.</p>
                        </div>
                    </div>
                </div>
            `;
        },

        buildApplicationFormHTML: function() {
            return `
                <div class="ql-affiliate-section" id="ql-affiliate-apply-anchor">
                    <h3>Apply as a QuantumLayers Partner</h3>
                    <p class="ql-affiliate-section-intro">
                        Your application is processed instantly. You'll be redirected to Stripe Express
                        to connect your payout account — this takes under two minutes and enables
                        direct monthly commission transfers.
                    </p>
                    <div class="notice notice-info" style="margin-bottom: 20px;">
                        <strong>Note:</strong> After connecting Stripe your affiliate account will be active
                        and your unique referral link will appear in the partner dashboard.
                    </div>
                    <div id="ql-apply-notices"></div>
                    <div class="ql-affiliate-cta-row">
                        <button type="button" id="ql-apply-partner-btn" class="ql-btn ql-btn-primary ql-btn-lg">
                            Apply &amp; Connect Stripe
                        </button>
                    </div>
                </div>
            `;
        },

        renderPendingPage: function() {
            $('#ql-affiliate-dashboard').html(`
                <div class="ql-affiliate-section">
                    <div class="notice notice-info" style="margin-bottom:24px;">
                        <strong>Application Pending</strong> — Your Stripe Express account setup is incomplete.
                        Please complete onboarding to activate your affiliate account.
                    </div>
                    <p>
                        If you were redirected away from the Stripe onboarding flow before completing it,
                        click below to get a fresh link and finish setup.
                    </p>
                    <div id="ql-dashboard-notices"></div>
                    <button type="button" id="ql-refresh-onboarding-btn" class="ql-btn ql-btn-primary">
                        Resume Stripe Onboarding
                    </button>
                </div>
            `).show();
        },

        renderDashboard: function(data) {
            const $dash = $('#ql-affiliate-dashboard');

            const referralSection = this.buildReferralCodeSection(data);
            const stripeSection   = this.buildStripeSection(data);
            const statsSection    = this.buildStatsSection(data);
            const prefSection     = this.buildPayoutSection(data);
            const historySection  = this.buildHistorySection(data);

            $dash.html(`
                <div id="ql-dashboard-notices"></div>
                ${statsSection}
                ${historySection}
                ${referralSection}
                ${stripeSection}
                ${prefSection}
            `).show();
        },

        buildReferralCodeSection: function(data) {
            const code = data.referral_code || '';
            if (!code) return '';

            const safeCode = this.escapeHtml(code);
            const link     = window.location.origin + '/ql-login?mode=register&ref=' + encodeURIComponent(code);
            const safeLink = this.escapeHtml(link);

            return `
                <div class="ql-affiliate-section ql-affiliate-referral">
                    <h3>Your Referral Code</h3>
                    <p class="ql-affiliate-section-intro">
                        Share your code or link. You earn 25% commission on every Pro referral, plus 10% / 5% on Startup / Enterprise organization deals.
                    </p>
                    <div class="ql-referral-field">
                        <label class="ql-referral-label">Referral Code</label>
                        <div class="ql-referral-copy-row">
                            <input type="text" id="ql-affiliate-referral-code" class="ql-referral-input" value="${safeCode}" readonly>
                            <button type="button" class="ql-btn ql-btn-secondary ql-copy-btn" data-copy-target="#ql-affiliate-referral-code">Copy Code</button>
                        </div>
                    </div>
                    <div class="ql-referral-field">
                        <label class="ql-referral-label">Referral Link</label>
                        <div class="ql-referral-copy-row">
                            <input type="text" id="ql-affiliate-referral-link" class="ql-referral-input" value="${safeLink}" readonly>
                            <button type="button" class="ql-btn ql-btn-secondary ql-copy-btn" data-copy-target="#ql-affiliate-referral-link">Copy Link</button>
                        </div>
                    </div>
                </div>
            `;
        },

        buildStripeSection: function(data) {
            const connected = (data.stripe_connect_status === 'active');
            const pending   = (data.stripe_connect_status === 'pending');

            let stripeContent;
            if (connected) {
                stripeContent = `
                    <div class="ql-stripe-status ql-stripe-connected">
                        <span class="badge badge-success">Stripe Connected</span>
                        <span class="ql-stripe-status-text">Your Stripe Express account is active. Cash commissions will be transferred once your payout threshold is reached.</span>
                    </div>
                    <div class="ql-stripe-actions">
                        <button type="button" id="ql-manage-stripe-btn" class="ql-btn ql-btn-primary">
                            Manage Account
                        </button>
                        <button type="button" id="ql-reconnect-stripe-btn" class="ql-btn ql-btn-secondary">
                            Reconnect / Update
                        </button>
                    </div>
                `;
            } else if (pending) {
                stripeContent = `
                    <div class="ql-stripe-status ql-stripe-pending">
                        <span class="badge badge-warning">Stripe Pending</span>
                        <span class="ql-stripe-status-text">Stripe account connection is in progress. Complete onboarding to receive cash payouts.</span>
                    </div>
                    <button type="button" id="ql-connect-stripe-btn" class="ql-btn ql-btn-primary" style="margin-top:12px;">
                        Complete Stripe Onboarding
                    </button>
                `;
            } else {
                stripeContent = `
                    <div class="ql-stripe-status ql-stripe-disconnected">
                        <span class="badge badge-warning">Stripe Not Connected</span>
                        <span class="ql-stripe-status-text">Connect a Stripe Express account to receive cash commission payouts.</span>
                    </div>
                    <button type="button" id="ql-connect-stripe-btn" class="ql-btn ql-btn-primary" style="margin-top:12px;">
                        Connect Stripe Account
                    </button>
                `;
            }

            return `
                <div class="ql-affiliate-section">
                    <h3>Stripe Payout Account</h3>
                    ${stripeContent}
                </div>
            `;
        },

        buildStatsSection: function(data) {
            const totalPaid    = this.formatCents(data.total_paid_cents || 0);
            const pendingCents = data.total_pending_cents || 0;
            const threshold  = data.payout_threshold_cents || 10000;
            const activeRefs = data.active_referrals || 0;

            const pct     = Math.min(100, Math.round((pendingCents / threshold) * 100));
            const balance = this.formatCents(pendingCents);
            const thresh  = this.formatCents(threshold);

            return `
                <div class="ql-affiliate-section">
                    <h3>Your Stats</h3>
                    <div class="ql-stats-grid">
                        <div class="ql-stat-card">
                            <div class="ql-stat-value">${totalPaid}</div>
                            <div class="ql-stat-label">Total Paid Out</div>
                        </div>
                        <div class="ql-stat-card ql-stat-card--progress">
                            <div class="ql-stat-value">${balance}</div>
                            <div class="ql-stat-label">Accumulated Balance</div>
                            <div class="ql-threshold-progress" title="${pct}% of ${thresh} threshold">
                                <div class="ql-threshold-progress-bar" style="width:${pct}%"></div>
                            </div>
                            <div class="ql-threshold-progress-label">${pct}% of ${thresh} threshold</div>
                        </div>
                        <div class="ql-stat-card">
                            <div class="ql-stat-value">${activeRefs}</div>
                            <div class="ql-stat-label">Active Referrals</div>
                        </div>
                    </div>
                </div>
            `;
        },

        buildPayoutSection: function(data) {
            const currentThreshUsd = Math.round((data.payout_threshold_cents || 10000) / 100);
            return `
                <div class="ql-affiliate-section">
                    <h3>Payout Settings</h3>
                    <p class="ql-affiliate-section-intro">All commissions are paid as cash to your connected Stripe account.</p>
                    <div class="ql-threshold-control" id="ql-threshold-control">
                        <label class="ql-threshold-label" for="ql-threshold-input">Minimum Payout Threshold</label>
                        <p class="ql-threshold-desc">Commissions accumulate until this amount is reached, then all pending commissions are paid out together. Minimum: $100.</p>
                        <div class="ql-threshold-row">
                            <span class="ql-threshold-currency">$</span>
                            <input type="number" id="ql-threshold-input" class="ql-threshold-input"
                                   min="100" step="1" value="${currentThreshUsd}">
                            <button type="button" id="ql-save-threshold-btn" class="ql-btn ql-btn-primary">
                                Save Threshold
                            </button>
                        </div>
                        <div id="ql-threshold-notices"></div>
                    </div>
                </div>
            `;
        },

        buildHistorySection: function(data) {
            const commissions = data.recent_commissions || [];

            let rowsHTML;
            if (commissions.length === 0) {
                rowsHTML = `
                    <tr>
                        <td colspan="6" class="ql-commission-empty">
                            No commissions yet. Share your referral link to start earning.
                        </td>
                    </tr>
                `;
            } else {
                rowsHTML = commissions.map(c => {
                    const referredName = c.referred_first_name
                        ? `${c.referred_first_name} (${c.referred_email})`
                        : c.referred_email;
                    const statusClass = {
                        paid:    'badge-success',
                        pending: 'badge-warning',
                        failed:  'badge-error',
                        skipped: 'badge-muted'
                    }[c.status] || 'badge-muted';

                    return `
                        <tr>
                            <td>${this.formatDate(c.created_at)}</td>
                            <td>${this.escapeHtml(referredName)}</td>
                            <td>${this.formatCents(c.invoice_amount_cents)}</td>
                            <td class="ql-commission-amount">${this.formatCents(c.commission_cents)}</td>
                            <td><span class="ql-commission-type">${c.commission_type}</span></td>
                            <td><span class="badge ${statusClass}">${c.status}</span></td>
                        </tr>
                    `;
                }).join('');
            }

            return `
                <div class="ql-affiliate-section">
                    <h3>Commission History</h3>
                    <div class="ql-commission-table-wrap">
                        <table class="ql-commission-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Referred User</th>
                                    <th>Invoice</th>
                                    <th>Commission</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHTML}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        },

        // ─── Actions ─────────────────────────────────────────────────────────────

        handleCopy: function(e) {
            e.preventDefault();
            const $btn   = $(e.currentTarget);
            const $input = $($btn.data('copyTarget'));
            if (!$input.length) return;

            $input[0].focus();
            $input[0].select();
            $input[0].setSelectionRange(0, 99999);

            let copied = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText($input.val()).catch(() => {});
                copied = true;
            } else {
                try { copied = document.execCommand('copy'); } catch (err) { copied = false; }
            }

            if (copied) {
                const original = $btn.text();
                $btn.text('Copied!');
                setTimeout(() => { $btn.text(original); }, 2000);
            }
        },

        handleApply: function(e) {
            e.preventDefault();
            const $btn = $('#ql-apply-partner-btn');
            $btn.prop('disabled', true).text('Applying...');
            this.clearNotices('#ql-apply-notices');

            const headers = {};
            const token = (typeof QLAuth !== 'undefined') ? QLAuth.getSessionToken() : null;
            if (token) headers['Authorization'] = 'Bearer ' + token;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: headers,
                data: {
                    action: 'ql_apply_for_affiliate',
                    nonce: qlAuth.nonce
                },
                success: (response) => {
                    if (response.success && response.data && response.data.onboarding_url) {
                        window.location.href = response.data.onboarding_url;
                    } else {
                        const msg = (response.data && response.data.message)
                            ? response.data.message
                            : 'Something went wrong. Please try again.';
                        this.showNotice('#ql-apply-notices', 'error', msg);
                        $btn.prop('disabled', false).text('Apply & Connect Stripe');
                    }
                },
                error: () => {
                    this.showNotice('#ql-apply-notices', 'error', 'Request failed. Please check your connection and try again.');
                    $btn.prop('disabled', false).text('Apply & Connect Stripe');
                }
            });
        },

        handleSetThreshold: function(e) {
            e.preventDefault();
            const $btn = $('#ql-save-threshold-btn');
            const threshUsd = parseInt($('#ql-threshold-input').val(), 10);
            this.clearNotices('#ql-threshold-notices');

            if (isNaN(threshUsd) || threshUsd < 100) {
                this.showNotice('#ql-threshold-notices', 'error', 'Minimum threshold is $100.');
                return;
            }

            $btn.prop('disabled', true).text('Saving...');

            const headers = {};
            const token = (typeof QLAuth !== 'undefined') ? QLAuth.getSessionToken() : null;
            if (token) headers['Authorization'] = 'Bearer ' + token;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: headers,
                data: {
                    action: 'ql_set_payout_threshold',
                    nonce: qlAuth.nonce,
                    threshold_usd: threshUsd
                },
                success: (response) => {
                    if (response.success) {
                        if (this.affiliateData) {
                            this.affiliateData.payout_threshold_cents = response.data.payout_threshold_cents;
                        }
                        this.showNotice('#ql-threshold-notices', 'success', 'Threshold updated to $' + threshUsd + '.');
                    } else {
                        const msg = (response.data && response.data.message)
                            ? response.data.message : 'Could not update threshold.';
                        this.showNotice('#ql-threshold-notices', 'error', msg);
                    }
                    $btn.prop('disabled', false).text('Save Threshold');
                },
                error: () => {
                    this.showNotice('#ql-threshold-notices', 'error', 'Request failed. Please try again.');
                    $btn.prop('disabled', false).text('Save Threshold');
                }
            });
        },

        handleStripeManage: function(e) {
            e.preventDefault();
            const $btn = $('#ql-manage-stripe-btn');
            $btn.prop('disabled', true).text('Opening...');

            const headers = {};
            const token = (typeof QLAuth !== 'undefined') ? QLAuth.getSessionToken() : null;
            if (token) headers['Authorization'] = 'Bearer ' + token;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: headers,
                data: { action: 'ql_get_stripe_login_link', nonce: qlAuth.nonce },
                success: (response) => {
                    if (response.success && response.data.login_url) {
                        window.open(response.data.login_url, '_blank');
                    } else {
                        const msg = (response.data && response.data.message)
                            ? response.data.message : 'Could not open Stripe dashboard.';
                        this.showNotice('#ql-dashboard-notices', 'error', msg);
                    }
                    $btn.prop('disabled', false).text('Manage Account');
                },
                error: () => {
                    this.showNotice('#ql-dashboard-notices', 'error', 'Request failed. Please try again.');
                    $btn.prop('disabled', false).text('Manage Account');
                }
            });
        },

        handleStripeConnect: function(e) {
            e.preventDefault();
            const $btn = $(e.currentTarget);
            $btn.prop('disabled', true).text('Redirecting...');
            this.clearNotices('#ql-dashboard-notices');

            const headers = {};
            const token = (typeof QLAuth !== 'undefined') ? QLAuth.getSessionToken() : null;
            if (token) headers['Authorization'] = 'Bearer ' + token;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: headers,
                data: {
                    action: 'ql_connect_stripe_affiliate',
                    nonce: qlAuth.nonce
                },
                success: (response) => {
                    if (response.success && response.data && response.data.onboarding_url) {
                        window.location.href = response.data.onboarding_url;
                    } else {
                        const msg = (response.data && response.data.message)
                            ? response.data.message : 'Could not generate Stripe link.';
                        this.showNotice('#ql-dashboard-notices', 'error', msg);
                        $btn.prop('disabled', false).text('Connect Stripe Account');
                    }
                },
                error: () => {
                    this.showNotice('#ql-dashboard-notices', 'error', 'Request failed. Please try again.');
                    $btn.prop('disabled', false).text('Connect Stripe Account');
                }
            });
        },

        // ─── Helpers ─────────────────────────────────────────────────────────────

        showLoading: function() {
            $('#ql-affiliate-loading').show();
        },

        hideLoading: function() {
            $('#ql-affiliate-loading').hide();
        },

        showNotice: function(selector, type, message) {
            const $el = $(selector);
            if (!$el.length) return;
            $el.html(`<div class="notice notice-${type}">${this.escapeHtml(message)}</div>`);
        },

        clearNotices: function(selector) {
            $(selector).empty();
        },

        formatCents: function(cents) {
            if (!cents || isNaN(cents)) return '$0.00';
            return '$' + (cents / 100).toFixed(2);
        },

        formatDate: function(dateStr) {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        },

        escapeHtml: function(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    };

    $(document).ready(function() {
        // Render the base skeleton into the page content container
        const $content = $('.entry-content, .page-content, #ql-affiliate-root, #post-content, .post-content');
        const $target  = $content.length ? $content.first() : $('body');

        if (!$('#ql-affiliate-loading').length) {
            $target.prepend(`
                <div class="ql-affiliate-container">
                    <div id="ql-affiliate-notices"></div>
                    <div id="ql-affiliate-loading" class="ql-affiliate-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading...</p>
                    </div>
                    <div id="ql-affiliate-marketing" style="display:none;"></div>
                    <div id="ql-affiliate-apply-section" style="display:none;"></div>
                    <div id="ql-affiliate-dashboard" style="display:none;"></div>
                </div>
            `);
        }

        QLAffiliate.init();
    });

})(jQuery);
