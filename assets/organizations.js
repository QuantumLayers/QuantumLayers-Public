/**
 * QuantumLayers Organization Management - JavaScript
 * File: wp-content/plugins/quantumlayers/assets/organizations.js
 */

(function($) {
    'use strict';

    const QLOrganizations = {
        currentOrganization: null,
        currentMembers: [],
        currentUserId: null,

        init: function() {
            if (typeof qlAuth === 'undefined') {
                console.error('qlAuth not loaded');
                window.location.href = '/ql-login?redirect=/ql-organizations';
                return;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_check_auth', nonce: qlAuth.nonce },
                success: (response) => {
                    if (response.success && response.data.logged_in) {
                        if (typeof Paddle !== 'undefined' && typeof qlOrganizations !== 'undefined' && qlOrganizations.paddleClientToken) {
                            Paddle.Initialize({ token: qlOrganizations.paddleClientToken });
                        }
                        this.currentUserId = response.data.user.id;
                        this.loadMyOrganizations();
                        this.bindEvents();
                    } else {
                        window.location.href = '/ql-login?redirect=/ql-organizations';
                    }
                },
                error: function() {
                    window.location.href = '/ql-login?redirect=/ql-organizations';
                }
            });
        },

        bindEvents: function() {
            // Navigation
            $(document).on('click', '.ql-show-create-org', this.showCreateForm.bind(this));
            $(document).on('click', '.ql-cancel-create', this.hideCreateForm.bind(this));
            $(document).on('click', '.ql-view-org', this.viewOrganization.bind(this));
            $(document).on('click', '.ql-back-to-list', this.backToList.bind(this));

            // Organization management
            $(document).on('submit', '#ql-create-org-form', this.createOrganization.bind(this));
            $(document).on('submit', '#ql-update-org-form', this.updateOrganization.bind(this));
            $(document).on('click', '.ql-delete-org', this.deleteOrganization.bind(this));
            $(document).on('click', '.ql-delete-org-list', this.deleteOrganizationFromList.bind(this));

            // Member management
            $(document).on('submit', '#ql-add-member-form', this.addMember.bind(this));
            $(document).on('click', '.ql-remove-member', this.removeMember.bind(this));
            $(document).on('change', '.ql-member-role-select', this.updateMemberRole.bind(this));

            // Tabs
            $(document).on('click', '.ql-tab', this.switchTab.bind(this));

            // Billing
            $(document).on('click', '.ql-subscribe', this.subscribe.bind(this));
        },

        showCreateForm: function(e) {
            e.preventDefault();
            $('#ql-org-list-view').hide();
            $('#ql-org-create-view').show();
        },

        hideCreateForm: function(e) {
            e.preventDefault();
            $('#ql-org-create-view').hide();
            $('#ql-org-list-view').show();
            $('#ql-create-org-form')[0].reset();
        },

        backToList: function(e) {
            e.preventDefault();
            $('#ql-org-detail-view').hide();
            $('#ql-org-list-view').show();
            this.currentOrganization = null;
            this.loadMyOrganizations();
        },

        loadMyOrganizations: function() {
            $.post(qlAuth.ajaxurl, {
                action: 'ql_get_my_organizations',
                nonce: qlAuth.nonce
            }, (response) => {
                if (response.success) {
                    this.renderOrganizationList(response.data.organizations);
                } else {
                    this.showError(response.data && response.data.message ? response.data.message : 'Failed to load organizations');
                }
            }).fail(() => {
                this.showError('Failed to load organizations');
            });
        },

        renderOrganizationList: function(organizations) {
            const $container = $('#ql-organizations-list');
            $container.empty();

            if (!organizations || organizations.length === 0) {
                $container.html('<div class="ql-empty-state"><p>No organizations yet. Create your first one!</p></div>');
                return;
            }

            organizations.forEach(org => {
                const card = `
                    <div class="ql-org-card" data-org-id="${org.id}">
                        <div class="ql-org-card-header">
                            <h3>${this.escapeHtml(org.name)}</h3>
                            <span class="ql-org-badge ql-${org.license_type}">${org.license_type}</span>
                        </div>
                        <div class="ql-org-card-body">
                            <div class="ql-org-stat">
                                <span class="ql-stat-label">Members:</span>
                                <span class="ql-stat-value">${org.member_count}</span>
                            </div>
                            <div class="ql-org-stat">
                                <span class="ql-stat-label">Your Role:</span>
                                <span class="ql-stat-value ql-role-${org.role}">${this.getRoleLabel(org.role)}</span>
                            </div>
                            <div class="ql-org-stat">
                                <span class="ql-stat-label">Status:</span>
                                <span class="ql-stat-value ql-status-${org.status}">${org.status}</span>
                            </div>
                        </div>
                        <div class="ql-org-card-footer">
                            ${org.status === 'pending_payment' ? `
                                <button class="ql-btn ql-btn-warning ql-subscribe" data-org-id="${org.id}">
                                    Complete Payment
                                </button>
                            ` : `
                                <button class="ql-btn ql-btn-primary ql-view-org" data-org-id="${org.id}">
                                    View Organization
                                </button>
                            `}
                            ${org.manager_id == this.currentUserId ? `
                                <button class="ql-btn ql-btn-danger ql-delete-org-list" data-org-id="${org.id}">
                                    Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
                $container.append(card);
            });
        },

        viewOrganization: function(e) {
            e.preventDefault();
            const orgId = $(e.currentTarget).data('org-id');
            
            $.post(qlAuth.ajaxurl, {
                action: 'ql_get_organization',
                nonce: qlAuth.nonce,
                organization_id: orgId
            }, (response) => {
                if (response.success) {
                    this.currentOrganization = response.data.organization;
                    this.renderOrganizationDetail();
                    this.loadMembers(orgId);
                    this.loadBillingHistory(orgId);
                    this.loadPaymentStatus(orgId);
                    $('#ql-org-list-view').hide();
                    $('#ql-org-detail-view').show();
                } else {
                    this.showError(response.data.message);
                }
            });
        },

        renderOrganizationDetail: function() {
            const org = this.currentOrganization;
            
            // Update header
            $('#ql-org-detail-name').text(org.name);
            $('#ql-org-detail-license').text(org.license_type).attr('class', `ql-org-badge ql-${org.license_type}`);
            
            // Update settings form
            $('#update_org_id').val(org.id);
            $('#update_org_name').val(org.name);
            $('#update_org_license').val(org.license_type);
            $('#update_org_max_users').val(org.max_users || '');
            $('#update_org_billing_email').val(org.billing_email || '');
            $('#update_org_billing_address').val(org.billing_address || '');
            $('#update_org_billing_country').val(org.billing_country || '');
            $('#update_org_billing_tax_id').val(org.billing_tax_id || '');
            
            // Update overview stats
            const pricing = this.getPlanPricing(org.license_type, org.member_count);
            $('#ql-overview-stats').html(`
                <div class="ql-stat-box">
                    <div class="ql-stat-label">Total Members</div>
                    <div class="ql-stat-number">${org.member_count}</div>
                </div>
                <div class="ql-stat-box">
                    <div class="ql-stat-label">Plan</div>
                    <div class="ql-stat-number">${org.license_type}</div>
                </div>
                <div class="ql-stat-box">
                    <div class="ql-stat-label">Status</div>
                    <div class="ql-stat-number ql-status-${org.status}">${org.status}</div>
                </div>
                <div class="ql-stat-box">
                    <div class="ql-stat-label">Created</div>
                    <div class="ql-stat-number">${this.formatDate(org.created_at)}</div>
                </div>
                `);
//                <div class="ql-stat-box ql-stat-box-wide">
//                    <div class="ql-stat-label">Current Billing Rate</div>
//                    <div class="ql-stat-number" style="font-size:14px;">${pricing.breakdown}</div>
//                </div>
//            `);
            
            // Show/hide delete button for primary manager
            if (org.manager_id == this.currentUserId) {
                $('.ql-delete-org').show().data('org-id', org.id);
            } else {
                $('.ql-delete-org').hide();
            }

            // Show payment pending banner when subscription not yet active.
            $('#ql-payment-pending-banner').remove();
            if (org.status === 'pending_payment') {
                const banner = `
                    <div id="ql-payment-pending-banner" class="ql-alert ql-alert-warning">
                        <strong>Payment required.</strong> This organization is not active yet.
                        <button class="ql-btn ql-btn-primary ql-subscribe" style="margin-left:12px;">
                            Complete Payment
                        </button>
                    </div>
                `;
                $('#ql-org-detail-view').prepend(banner);
            }
        },

        loadMembers: function(orgId) {
            $.post(qlAuth.ajaxurl, {
                action: 'ql_get_organization_members',
                nonce: qlAuth.nonce,
                organization_id: orgId,
                include_inactive: 'false'
            }, (response) => {
                if (response.success) {
                    this.currentMembers = response.data.members;
                    this.renderMembers();
                }
            });
        },

        renderMembers: function() {
            const $container = $('#ql-members-list');
            $container.empty();

            if (this.currentMembers.length === 0) {
                $container.html('<div class="ql-empty-state"><p>No members yet</p></div>');
                return;
            }

            const isManager = this.currentOrganization.manager_id == this.currentUserId;

            this.currentMembers.forEach(member => {
                const isPrimaryOwner = member.user_id == this.currentOrganization.manager_id;
                const canEdit = isManager && !isPrimaryOwner;

                const row = `
                    <tr>
                        <td>
                            <div class="ql-member-name">${this.escapeHtml(member.first_name)} ${this.escapeHtml(member.last_name)}</div>
                            <div class="ql-member-email">${this.escapeHtml(member.email)}</div>
                        </td>
                        <td>
                            ${canEdit ? `
                                <select class="ql-member-role-select" data-user-id="${member.user_id}">
                                    <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
                                    <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    <option value="manager" ${member.role === 'manager' ? 'selected' : ''}>Manager</option>
                                </select>
                            ` : `
                                <span class="ql-role-badge ql-role-${member.role}">${this.getRoleLabel(member.role)}</span>
                                ${isPrimaryOwner ? '<span class="ql-primary-badge">Primary Owner</span>' : ''}
                            `}
                        </td>
                        <td>${this.formatDate(member.joined_at)}</td>
                        <td>
                            ${canEdit ? `
                                <button class="ql-btn ql-btn-small ql-btn-danger ql-remove-member" data-user-id="${member.user_id}">
                                    Remove
                                </button>
                            ` : '-'}
                        </td>
                    </tr>
                `;
                $container.append(row);
            });
        },

        loadBillingHistory: function(orgId) {
            $.post(qlAuth.ajaxurl, {
                action: 'ql_get_organization_billing',
                nonce: qlAuth.nonce,
                organization_id: orgId,
                limit: 12
            }, (response) => {
                if (response.success) {
                    this.renderBillingHistory(response.data.billing_history);
                }
            });
        },

        renderBillingHistory: function(history) {
            const $container = $('#ql-billing-history');
            $container.empty();

            if (history.length === 0) {
                $container.html('<div class="ql-empty-state"><p>No invoices yet</p></div>');
                return;
            }

            history.forEach(invoice => {
                const row = `
                    <tr>
                        <td>${this.escapeHtml(invoice.stripe_invoice_id || '#' + invoice.id)}</td>
                        <td>${this.formatDate(invoice.billing_period_start)} - ${this.formatDate(invoice.billing_period_end)}</td>
                        <td>${invoice.user_count}</td>
                        <td>$${parseFloat(invoice.total_amount).toFixed(2)}</td>
                        <td><span class="ql-invoice-status ql-status-${invoice.status}">${invoice.status}</span></td>
                        <td>${invoice.paid_at ? this.formatDate(invoice.paid_at) : '-'}</td>
                    </tr>
                `;
                $container.append(row);
            });
        },

        createOrganization: function(e) {
            e.preventDefault();
            
            const formData = {
                action: 'ql_create_organization',
                nonce: qlAuth.nonce,
                name: $('#create_org_name').val(),
                license_type: $('#create_org_license').val(),
                max_users: $('#create_org_max_users').val() || null,
                billing_email: $('#create_org_billing_email').val()
            };

            $.post(qlAuth.ajaxurl, formData, (response) => {
                if (response.success) {
                    if (response.data.checkout_transaction_id && typeof Paddle !== 'undefined') {
                        Paddle.Checkout.open({
                            transactionId: response.data.checkout_transaction_id,
                            eventCallback: function(data) {
                                if (data.name === 'checkout.completed') {
                                    window.location.reload();
                                }
                            }
                        });
                    } else if (response.data.checkout_url) {
                        window.location.href = response.data.checkout_url;
                    } else {
                        this.showError('Organization created but payment setup failed. Please complete payment from the organization list.');
                        this.hideCreateForm(e);
                        this.loadMyOrganizations();
                    }
                } else {
                    this.showError(response.data.message);
                }
            });
        },

        updateOrganization: function(e) {
            e.preventDefault();
            
            const formData = {
                action: 'ql_update_organization',
                nonce: qlAuth.nonce,
                organization_id: $('#update_org_id').val(),
                name: $('#update_org_name').val(),
                license_type: $('#update_org_license').val(),
                max_users: $('#update_org_max_users').val() || null,
                billing_email: $('#update_org_billing_email').val(),
                billing_address: $('#update_org_billing_address').val(),
                billing_country: $('#update_org_billing_country').val(),
                billing_tax_id: $('#update_org_billing_tax_id').val()
            };

            $.post(qlAuth.ajaxurl, formData, (response) => {
                if (response.success) {
                    this.showSuccess('Organization updated successfully');
                    this.currentOrganization = response.data.organization;
                    this.renderOrganizationDetail();
                } else {
                    this.showError(response.data.message);
                }
            });
        },

        deleteOrganization: function(e) {
            e.preventDefault();
            
            if (!confirm('Are you sure you want to delete this organization? All members will be removed.')) {
                return;
            }

            const orgId = $(e.currentTarget).data('org-id');

            $.post(qlAuth.ajaxurl, {
                action: 'ql_delete_organization',
                nonce: qlAuth.nonce,
                organization_id: orgId
            }, (response) => {
                if (response.success) {
                    this.showSuccess('Organization deleted successfully');
                    this.backToList(e);
                } else {
                    this.showError(response.data.message);
                }
            });
        },

        deleteOrganizationFromList: function(e) {
            e.preventDefault();

            if (!confirm('Are you sure you want to delete this organization? All members will be removed.')) {
                return;
            }

            const orgId = $(e.currentTarget).data('org-id');

            $.post(qlAuth.ajaxurl, {
                action: 'ql_delete_organization',
                nonce: qlAuth.nonce,
                organization_id: orgId
            }, (response) => {
                if (response.success) {
                    this.showSuccess('Organization deleted successfully');
                    this.loadMyOrganizations();
                } else {
                    this.showError(response.data.message);
                }
            });
        },

        addMember: function(e) {
            e.preventDefault();
            
            const formData = {
                action: 'ql_add_organization_member',
                nonce: qlAuth.nonce,
                organization_id: this.currentOrganization.id,
                user_email: $('#add_member_email').val(),
                role: $('#add_member_role').val()
            };

            $.post(qlAuth.ajaxurl, formData, (response) => {
                if (response.success) {
                    this.showSuccess('Member added successfully');
                    $('#add_member_email').val('');
                    this.loadMembers(this.currentOrganization.id);
                } else {
                    this.showError(response.data.message);
                }
            });
        },

        removeMember: function(e) {
            e.preventDefault();
            
            if (!confirm('Are you sure you want to remove this member?')) {
                return;
            }

            const userId = $(e.currentTarget).data('user-id');

            $.post(qlAuth.ajaxurl, {
                action: 'ql_remove_organization_member',
                nonce: qlAuth.nonce,
                organization_id: this.currentOrganization.id,
                user_id: userId
            }, (response) => {
                if (response.success) {
                    this.showSuccess('Member removed successfully');
                    this.loadMembers(this.currentOrganization.id);
                } else {
                    this.showError(response.data.message);
                }
            });
        },

        updateMemberRole: function(e) {
            const $select = $(e.currentTarget);
            const userId = $select.data('user-id');
            const newRole = $select.val();

            $.post(qlAuth.ajaxurl, {
                action: 'ql_update_member_role',
                nonce: qlAuth.nonce,
                organization_id: this.currentOrganization.id,
                user_id: userId,
                role: newRole
            }, (response) => {
                if (response.success) {
                    this.showSuccess('Role updated successfully');
                } else {
                    this.showError(response.data.message);
                    this.loadMembers(this.currentOrganization.id);
                }
            });
        },

        subscribe: function(e) {
            e.preventDefault();
            const orgId = $(e.currentTarget).data('org-id') || (this.currentOrganization && this.currentOrganization.id);

            $.post(qlAuth.ajaxurl, {
                action: 'ql_org_subscribe',
                nonce: qlAuth.nonce,
                organization_id: orgId
            }, (response) => {
                if (response.success) {
                    if (response.data.transaction_id && typeof Paddle !== 'undefined') {
                        Paddle.Checkout.open({
                            transactionId: response.data.transaction_id,
                            eventCallback: function(data) {
                                if (data.name === 'checkout.completed') {
                                    window.location.reload();
                                }
                            }
                        });
                    } else if (response.data.url) {
                        window.location.href = response.data.url;
                    }
                } else {
                    this.showError(response.data.message || 'Failed to start subscription');
                }
            });
        },

        loadPaymentStatus: function(orgId) {
            $.post(qlAuth.ajaxurl, {
                action: 'ql_org_payment_status',
                nonce: qlAuth.nonce,
                organization_id: orgId
            }, (response) => {
                if (response.success) {
                    this.renderPaymentStatus(response.data);
                }
            });
        },

        renderPaymentStatus: function(data) {
            const $container = $('#ql-payment-status');
            if (!$container.length) return;

            const paddleStatus = data.paddle_status || 'none';
            const periodEnd = data.current_period_end ? this.formatDate(data.current_period_end) : '-';

            const org = this.currentOrganization;
            const pricing = org ? this.getPlanPricing(org.license_type, org.member_count) : null;

            let billingRateBox = '';
            if (pricing) {
                billingRateBox = `
                <div class="ql-stat-box ql-stat-box-wide">
                    <div class="ql-stat-label">Current Billing Rate</div>
                    <div class="ql-stat-number" style="font-size:14px;">${pricing.breakdown}</div>
                </div>`;
            }

            $container.html(`
                <div class="ql-stat-box">
                    <div class="ql-stat-label">Subscription Status</div>
                    <div class="ql-stat-number ql-status-${paddleStatus}">${paddleStatus}</div>
                </div>
                <div class="ql-stat-box">
                    <div class="ql-stat-label">Current Period Ends</div>
                    <div class="ql-stat-number">${periodEnd}</div>
                </div>
                ${billingRateBox}
            `);
        },

        switchTab: function(e) {
            e.preventDefault();
            const $tab = $(e.currentTarget);
            const tabName = $tab.data('tab');

            $('.ql-tab').removeClass('active');
            $tab.addClass('active');

            $('.ql-tab-content').removeClass('active');
            $(`#ql-tab-${tabName}`).addClass('active');
        },

        // Utility functions
        showSuccess: function(message) {
            this.showNotification(message, 'success');
        },

        showError: function(message) {
            this.showNotification(message, 'error');
        },

        showNotification: function(message, type) {
            const $notification = $('<div>')
                .addClass('ql-notification')
                .addClass(`ql-notification-${type}`)
                .text(message);

            if ($('#ql-org-detail-view').is(':visible')) {
                $('#ql-org-detail-view').prepend($notification);
            } else {
                $notification.insertAfter('#ql-organizations-list');
            }

            setTimeout(() => {
                $notification.addClass('show');
            }, 10);

            setTimeout(() => {
                $notification.removeClass('show');
                setTimeout(() => $notification.remove(), 300);
            }, 3000);
        },

        getPlanPricing: function(licenseType, memberCount) {
            const plans = {
                startup:    { base: 300,  included: 10, overage: 20 },
                enterprise: { base: 1500, included: 50, overage: 15 }
            };
            const plan        = plans[licenseType] || plans.startup;
            const overSeats   = Math.max(0, memberCount - plan.included);
            const monthly     = plan.base + overSeats * plan.overage;

            let breakdown;
            if (overSeats > 0) {
                breakdown = `$${plan.base}/mo base + ${overSeats} overage seat${overSeats !== 1 ? 's' : ''} × $${plan.overage} = <strong>$${monthly}/mo est.</strong>`;
            } else {
                const remaining = plan.included - memberCount;
                breakdown = `<strong>$${plan.base}/mo</strong> flat &mdash; ${memberCount} of ${plan.included} included seats used (${remaining} remaining)`;
            }

            return { base: plan.base, included: plan.included, overage: plan.overage, overSeats, monthly, breakdown };
        },

        getRoleLabel: function(role) {
            const labels = {
                'member': 'Member',
                'admin': 'Admin',
                'manager': 'Manager'
            };
            return labels[role] || role;
        },

        formatDate: function(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        },

        escapeHtml: function(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
    };

    // Initialize when document is ready
    $(document).ready(function() {
        if ($('#ql-organizations-container').length) {
            QLOrganizations.init();
        }
    });

    // Expose to global scope if needed
    window.QLOrganizations = QLOrganizations;

})(jQuery);

