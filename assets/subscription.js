/**
 * QuantumLayers Pro Subscription - Frontend JavaScript
 * File: wp-content/plugins/quantumlayers/assets/subscription.js
 */

(function($) {
    'use strict';

    const QLSubscription = {
        subscriptionStatus: null,
        referralStats: null,

        init: function() {
            if (typeof qlAuth === 'undefined') {
                console.error('qlAuth not loaded');
                window.location.href = '/ql-login?redirect=/ql-subscribe';
                return;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_check_auth', nonce: qlAuth.nonce },
                success: (response) => {
                    if (response.success && response.data.logged_in) {
                        if (typeof Paddle !== 'undefined' && qlSubscription.paddleClientToken) {
                            Paddle.Initialize({ token: qlSubscription.paddleClientToken });
                        }
                        this.loadSubscriptionStatus();
                        this.bindEvents();
                    } else {
                        window.location.href = '/ql-login?redirect=/ql-subscribe';
                    }
                },
                error: function() {
                    window.location.href = '/ql-login?redirect=/ql-subscribe';
                }
            });
        },

        bindEvents: function() {
            $(document).on('click', '#ql-upgrade-to-pro', this.handleUpgrade.bind(this));
            $(document).on('click', '#ql-cancel-subscription', this.cancelSubscription.bind(this));
            $(document).on('click', '#ql-copy-referral-code', this.copyReferralCode.bind(this));
            $(document).on('submit', '#ql-apply-referral-form', this.applyReferralCode.bind(this));
        },

        loadSubscriptionStatus: function() {
            $.post(qlAuth.ajaxurl, {
                action: 'ql_get_subscription_status',
                nonce: qlAuth.nonce
            }, (response) => {
                if (response.success) {
                    this.subscriptionStatus = response.data;
                    this.renderSubscriptionSection();
                    this.renderReferralSection();
                    this.renderLimitsSection();
                } else {
                    window.location.href = '/ql-login?redirect=/ql-subscribe';
                    return;
                }
            });
        },

        renderSubscriptionSection: function() {
            const data = this.subscriptionStatus;
            const $container = $('#ql-subscription-section');

            if (!$container.length) return;

            let html = '<h3>Pro Subscription</h3>';

            if (data.has_pro) {
                if (data.referral_stats && data.referral_stats.is_free) {
                    // Free through referrals
                    html += `
                        <div class="notice notice-success">
                            <p><strong>🎉 You have earned a FREE Pro subscription through referrals!</strong></p>
                            <p>You have ${data.referral_stats.active_referrals} active Pro referrals.</p>
                        </div>
                        <table class="ql-info-table">
                            <tr>
                                <td>Status:</td>
                                <td><span class="badge badge-success">Active</span></td>
                            </tr>
                            <tr>
                                <td>Monthly Cost:</td>
                                <td class="text-success"><strong>FREE</strong> — earned through referrals</td>
                            </tr>
                            <tr>
                                <td>Monthly Token Budget:</td>
                                <td><strong>2,500,000</strong> <span class="text-muted">weighted tokens (~$7.50/mo AI spend)</span></td>
                            </tr>
                        </table>
                    `;
                } else if (data.subscription) {
                    // Paid subscription
                    html += `
                        <div class="notice notice-success"><strong>✓ Pro Subscription Active</strong></div>
                        <table class="ql-info-table">
                            <tr>
                                <td>Status:</td>
                                <td><span class="badge badge-success">${data.subscription.status}</span></td>
                            </tr>
                            <tr>
                                <td>Current Period Ends:</td>
                                <td>${this.formatDate(data.subscription.current_period_end)}</td>
                            </tr>
                    `;

                    if (data.referral_stats && data.referral_stats.monthly_discount > 0) {
                        html += `
                            <tr>
                                <td>Monthly Discount:</td>
                                <td class="text-success">-${data.referral_stats.monthly_discount}% (${data.referral_stats.active_referrals} Pro referral${data.referral_stats.active_referrals !== 1 ? 's' : ''})</td>
                            </tr>
                        `;
                    } else {
                        html += `
                            <tr>
                                <td>Monthly Cost:</td>
                                <td><strong>$25.00/month</strong></td>
                            </tr>
                        `;
                    }

                    html += `
                            <tr>
                                <td>Monthly Token Budget:</td>
                                <td><strong>2,500,000</strong> <span class="text-muted">weighted tokens (~$7.50/mo AI spend)</span></td>
                            </tr>
                        </table>
                        <div style="margin-top: 20px;">
                            <button type="button" id="ql-cancel-subscription" class="ql-btn ql-btn-secondary">Cancel Subscription</button>
                        </div>
                    `;
                } else {
                    html += `<div class="notice notice-success"><strong>✓ Pro Subscription Active</strong></div>
                        <table class="ql-info-table">
                           <tr>
                                <td>Monthly Cost:</td>
                                <td><strong>Complimentary</strong></td>
                            </tr>
                            <tr>
                                <td>Monthly Token Budget:</td>
                                <td><strong>2,500,000</strong> <span class="text-muted">weighted tokens (~$7.50/mo AI spend)</span></td>
                            </tr>
                        </table>`;
                }
            } else {
                // Not subscribed — show pricing comparison grid
                const discount = (data.referral_stats && data.referral_stats.monthly_discount > 0)
                    ? data.referral_stats.monthly_discount : 0;

                let proPriceHtml;
                if (discount > 0) {
                    proPriceHtml = `
                        <div class="plan-price">$25<span class="price-period">/mo</span></div>
                        <div style="margin-top:6px;font-size:12px;" class="text-success">-${discount}% referral discount applied!</div>
                    `;
                } else {
                    proPriceHtml = `<div class="plan-price">$25<span class="price-period">/mo</span></div>`;
                }

                const features = [
                    { label: 'Max file size',          free: '10 MB',          pro: '1 GB' },
                    { label: 'Max datasets',            free: '1',              pro: 'Unlimited' },
                    { label: 'Max dataset rows',        free: '20,000',         pro: '2,000,000' },
                    { label: 'Insights per dataset',    free: '5',              pro: '50' },
                    { label: 'Monthly AI token budget', free: '50,000 tokens',  pro: '2,500,000 tokens' },
                    { label: 'Report Scheduler',        free: null,             pro: 'Included' },
                    { label: 'Statistical Monitors',    free: null,             pro: 'Included' },
                    { label: 'Priority support',        free: null,             pro: 'Included' },
                ];

                const freeRows = features.map(f => `
                    <li>
                        <i class="feat-icon ${f.free ? 'feat-yes' : 'feat-no'}">${f.free ? '✓' : '✗'}</i>
                        <span class="feat-label">${f.label}</span>
                        <span class="feat-value">${f.free || '—'}</span>
                    </li>`).join('');

                const proRows = features.map(f => `
                    <li>
                        <i class="feat-icon feat-yes">✓</i>
                        <span class="feat-label">${f.label}</span>
                        <span class="feat-value">${f.pro}</span>
                    </li>`).join('');

                html += `
                    <p style="margin-bottom:8px;color:inherit;">Unlock the full power of QuantumLayers — process larger datasets, generate deeper insights, and automate your reporting.</p>
                    <div class="ql-pricing-grid">
                        <div class="ql-pricing-col">
                            <div class="ql-pricing-col-header">
                                <div class="plan-name">Free</div>
                                <div class="plan-price">$0<span class="price-period">/mo</span></div>
                            </div>
                            <ul class="ql-pricing-feature-list">${freeRows}</ul>
                        </div>
                        <div class="ql-pricing-col ql-pricing-pro">
                            <div class="ql-pricing-col-header">
                                <div class="plan-name">Pro <span class="ql-pro-badge">Recommended</span></div>
                                ${proPriceHtml}
                            </div>
                            <ul class="ql-pricing-feature-list">${proRows}</ul>
                            <div class="ql-upgrade-cta">
                                <button type="button" id="ql-upgrade-to-pro" class="ql-btn ql-btn-primary">
                                    Upgrade to Pro
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            $container.html(html);
        },

        renderReferralSection: function() {
            const stats = this.subscriptionStatus.referral_stats;
            const $container = $('#ql-referral-section');
            
            if (!$container.length || !stats) return;

            let html = '<h3>Referral Program</h3>';

            if (stats.is_cash_affiliate) {
                html += `
                <div class="notice notice-info">
                    <p><strong>You're enrolled as a cash-payout affiliate.</strong></p>
                    <p style="margin-bottom:0;font-size:13px;">Your commissions are paid via bank transfer — subscription discounts don't apply to your account.</p>
                </div>`;
            } else {
                html += `
                <div class="notice notice-info">
                    <p><strong>Earn 25% off your Pro subscription for each friend who subscribes to Pro!</strong></p>
                    <p>Get 4 active <strong>Pro referrals</strong> and unlock a completely <strong>FREE Pro subscription</strong>!</p>
                    <p>Or refer someone who creates and pays for an <strong>organization</strong> — that instantly unlocks your <strong>FREE Pro subscription</strong>.</p>
                    <p style="margin-bottom:0;font-size:13px;">Note: only friends who subscribe to a <span class="ql-referral-pro-note">Pro</span> plan count as active referrals — free account sign-ups do not qualify.</p>
                </div>`;
            }

            html += `
                <div class="ql-form-group">
                    <label>Your Referral Code:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="text" id="ql-referral-code-display"
                               value="${stats.referral_code}"
                               readonly
                               class="ql-form-control"
                               style="max-width: 200px; font-family: monospace; font-weight: bold;">
                        <button type="button" id="ql-copy-referral-code" class="ql-btn ql-btn-secondary">
                            Copy Code
                        </button>
                    </div>
                    <small class="ql-form-text text-muted">
                        Share this code with friends — you earn 25% off your Pro subscription for each friend who subscribes to Pro.
                    </small>
                </div>

                <table class="ql-info-table">
                    <tr>
                        <td>Active Pro Referrals:</td>
                        <td><strong>${stats.active_referrals}</strong>${stats.is_cash_affiliate ? '' : ' / 4 for free Pro'} <span class="ql-referral-pro-note">Pro subscribers only</span></td>
                    </tr>
                    <tr>
                        <td>Total Referrals:</td>
                        <td>${stats.total_referrals}</td>
                    </tr>
            `;

            if (!stats.is_cash_affiliate) {
                html += `
                    <tr>
                        <td>Monthly Discount:</td>
                        <td class="text-success"><strong>${stats.monthly_discount}% discount</strong></td>
                    </tr>
                `;
            }

            if (!stats.is_cash_affiliate && !stats.is_free && stats.referrals_until_free > 0) {
                html += `
                    <tr>
                        <td>Until Free Pro:</td>
                        <td class="text-warning"><strong>${stats.referrals_until_free} more active referral${stats.referrals_until_free !== 1 ? 's' : ''}</strong></td>
                    </tr>
                `;
            } else if (stats.is_free) {
                html += `
                    <tr>
                        <td colspan="2" class="text-success">
                            <strong>You've earned a FREE Pro subscription!</strong>
                        </td>
                    </tr>
                `;
            }

            html += '</table>';

            // Show referral code input if user hasn't applied one yet
            const user = this.subscriptionStatus;
            // We'll need to add a check if user has already used a code
            // For now, show the form
            html += `
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <h4>Have a Referral Code?</h4>
                    <form id="ql-apply-referral-form">
                        <div class="ql-form-group">
                            <label>Enter Referral Code:</label>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" 
                                       id="ql-apply-referral-code" 
                                       name="referral_code"
                                       class="ql-form-control" 
                                       placeholder="Enter code"
                                       style="max-width: 200px; text-transform: uppercase;">
                                <button type="submit" class="ql-btn ql-btn-primary">
                                    Apply
                                </button>
                            </div>
                            <small class="ql-form-text text-muted">
                                Enter a referral code from a friend. Note: only Pro subscribers count as active referrals for the code's owner — applying a code does not discount your own subscription.
                            </small>
                        </div>
                    </form>
                </div>
            `;

            $container.html(html);
        },

        renderLimitsSection: function() {
            const limits = this.subscriptionStatus.limits;
            const $container = $('#ql-limits-section');

            if (!$container.length || !limits) return;

            const isPro = this.subscriptionStatus.has_pro;

            const tokenBudget = limits.token_budget || 0;
            const tokenUsed   = limits.token_budget_used || 0;
            const tokenPct    = tokenBudget > 0 ? Math.min(100, Math.round((tokenUsed / tokenBudget) * 100)) : 0;
            const usageClass  = tokenPct >= 95 ? 'usage-danger' : tokenPct >= 80 ? 'usage-warning' : 'usage-ok';

            let html = '<h3>Your Account Limits</h3>';
            html += '<table class="ql-info-table">';
            html += `
                <tr>
                    <td>Account Type:</td>
                    <td><span class="badge ${isPro ? 'badge-success' : 'badge-warning'}">${isPro ? 'Pro' : 'Free'}</span></td>
                </tr>
                <tr>
                    <td>Max File Size:</td>
                    <td><strong>${limits.max_file_size_formatted}</strong></td>
                </tr>
                <tr>
                    <td>Max Datasets:</td>
                    <td><strong>${limits.max_datasets === 0 ? 'Unlimited' : limits.max_datasets}</strong></td>
                </tr>
                <tr>
                    <td>Max Dataset Rows:</td>
                    <td><strong>${this.formatNumber(limits.max_rows)}</strong></td>
                </tr>
                <tr>
                    <td>Max Insights per Dataset:</td>
                    <td><strong>${limits.max_insights}</strong></td>
                </tr>
                <tr>
                    <td>Report Scheduler:</td>
                    <td>${limits.can_use_scheduler ? '<span class="text-success">✓ Enabled</span>' : '<span class="text-muted">✗ Pro Only</span>'}</td>
                </tr>
                <tr>
                    <td>Statistical Monitors:</td>
                    <td>${limits.can_use_monitors ? '<span class="text-success">✓ Enabled</span>' : '<span class="text-muted">✗ Pro Only</span>'}</td>
                </tr>
                <tr>
                    <td>Monthly Token Budget:</td>
                    <td><strong>${this.formatNumber(tokenBudget)}</strong> <span class="text-muted">weighted tokens</span></td>
                </tr>
                <tr>
                    <td>Token Usage (This Month):</td>
                    <td>
                        <strong>${this.formatNumber(tokenUsed)}</strong>
                        <span class="text-muted"> / ${this.formatNumber(tokenBudget)} (${tokenPct}%)</span>
                        <div class="ql-token-progress-bar">
                            <div class="ql-token-progress-fill ${usageClass}" style="width:${tokenPct}%"></div>
                        </div>
                    </td>
                </tr>
            `;
            html += '</table>';

            $container.html(html);
        },

        gtag_report_conversion: function(url) {
            var callback = function() {
                if (typeof(url) != 'undefined') {
                    window.location = url;
                }
            };
            gtag('event', 'conversion', {
                'send_to': 'AW-17755227694/ZsTJCLCSmLIcEK6MrZJC',
                'event_callback': callback
            });
            return false;
        },

        uet_report_conversion: function () {
            window.uetq = window.uetq || [];
            window.uetq.push('event', 'subscribe', {});
        },

        handleUpgrade: function(e) {
            e.preventDefault();
            
            const $btn = $(e.currentTarget);
            $btn.prop('disabled', true).text('Processing...');

            $.post(qlAuth.ajaxurl, {
                action: 'ql_create_checkout_session',
                nonce: qlAuth.nonce
            }, (response) => {
                if (response.success) {
                    if (response.data.is_free) {
                        alert(response.data.message);
                        window.location.reload();
                    } else if (response.data.transaction_id && typeof Paddle !== 'undefined') {
                        $btn.prop('disabled', false).text('Upgrade to Pro');
                        Paddle.Checkout.open({
                            transactionId: response.data.transaction_id,
                            eventCallback: function(data) {
                                if (data.name === 'checkout.completed') {
                                    QLSubscription.uet_report_conversion();
                                    QLSubscription.gtag_report_conversion();
                                    window.location.reload();
                                }
                            }
                        });
                    } else {
                        // Fallback to hosted checkout
                        window.location.href = response.data.url;
                    }
                } else {
                    alert(response.data.message || 'Failed to create checkout session');
                    $btn.prop('disabled', false).text('Upgrade to Pro');
                }
            }).fail(() => {
                alert('An error occurred. Please try again.');
                $btn.prop('disabled', false).text('Upgrade to Pro');
            });
        },

        cancelSubscription: function(e) {
            e.preventDefault();

            if (!confirm('Are you sure you want to cancel your Pro subscription? You will continue to have access until the end of your current billing period.')) {
                return;
            }

            const $btn = $(e.currentTarget);
            $btn.prop('disabled', true).text('Cancelling...');

            $.post(qlAuth.ajaxurl, {
                action: 'ql_cancel_subscription',
                nonce: qlAuth.nonce
            }, (response) => {
                if (response.success) {
                    alert(response.data.message);
                    window.location.reload();
                } else {
                    alert(response.data.message || 'Failed to cancel subscription');
                    $btn.prop('disabled', false).text('Cancel Subscription');
                }
            }).fail(() => {
                alert('An error occurred. Please try again.');
                $btn.prop('disabled', false).text('Cancel Subscription');
            });
        },

        copyReferralCode: function(e) {
            e.preventDefault();
            
            const $input = $('#ql-referral-code-display');
            const $btn = $(e.currentTarget);
            
            $input[0].select();
            document.execCommand('copy');
            
            const originalText = $btn.text();
            $btn.text('Copied!');
            
            setTimeout(() => {
                $btn.text(originalText);
            }, 2000);
        },

        applyReferralCode: function(e) {
            e.preventDefault();

            const referralCode = $('#ql-apply-referral-code').val().trim().toUpperCase();
            
            if (!referralCode) {
                alert('Please enter a referral code');
                return;
            }

            const $form = $(e.currentTarget);
            const $btn = $form.find('button[type="submit"]');
            
            $btn.prop('disabled', true).text('Applying...');

            $.post(qlAuth.ajaxurl, {
                action: 'ql_apply_referral_code',
                nonce: qlAuth.nonce,
                referral_code: referralCode
            }, (response) => {
                if (response.success) {
                    alert(response.data.message);
                    window.location.reload();
                } else {
                    alert(response.data.message || 'Failed to apply referral code');
                    $btn.prop('disabled', false).text('Apply');
                }
            }).fail(() => {
                alert('An error occurred. Please try again.');
                $btn.prop('disabled', false).text('Apply');
            });
        },

        formatDate: function(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        },

        formatNumber: function(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        if ($('#ql-subscription-section').length || $('#ql-referral-section').length) {
            QLSubscription.init();
        }
    });

    // Expose to global scope
    window.QLSubscription = QLSubscription;

})(jQuery);