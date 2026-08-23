(function($) {
    'use strict';

    const QLApiTokens = {
        init: function() {
            this.loadTokens();
            this.bindEvents();
        },

        bindEvents: function() {
            $(document).on('click', '#ql-create-token-btn', function() {
                QLApiTokens.showCreateModal();
            });
            $(document).on('click', '#ql-token-create-submit', function() {
                QLApiTokens.createToken();
            });
            $(document).on('click', '.ql-revoke-token-btn', function() {
                const id   = $(this).data('id');
                const name = $(this).data('name');
                QLApiTokens.confirmRevoke(id, name);
            });
            $(document).on('click', '#ql-token-modal-close, #ql-token-modal-overlay', function() {
                QLApiTokens.closeModal();
            });
            $(document).on('click', '#ql-reveal-modal-close, #ql-reveal-modal-overlay', function() {
                QLApiTokens.closeRevealModal();
            });
            $(document).on('click', '#ql-copy-token-btn', function() {
                QLApiTokens.copyToken();
            });
            $(document).on('click', '#ql-revoke-confirm-btn', function() {
                QLApiTokens.revokeToken();
            });
            $(document).on('click', '#ql-revoke-cancel-btn', function() {
                QLApiTokens.closeConfirmModal();
            });
            $(document).on('click', '#ql-confirm-modal-overlay', function() {
                QLApiTokens.closeConfirmModal();
            });
        },

        loadTokens: function() {
            $('#ql-tokens-loading').show();
            $('#ql-tokens-list').hide();

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_list_api_tokens', nonce: qlAuth.nonce },
                success: function(response) {
                    $('#ql-tokens-loading').hide();
                    if (response.success) {
                        QLApiTokens.renderTokens(response.data.tokens);
                    } else {
                        QLApiTokens.showError(response.data.message || 'Failed to load tokens.');
                    }
                },
                error: function() {
                    $('#ql-tokens-loading').hide();
                    QLApiTokens.showError('Network error. Please refresh.');
                }
            });
        },

        renderTokens: function(tokens) {
            const $list = $('#ql-tokens-list');
            const $body = $('#ql-tokens-tbody');
            $body.empty();

            if (!tokens || tokens.length === 0) {
                $body.append('<tr><td colspan="4" class="ql-no-tokens">No API tokens yet. Create one to get started.</td></tr>');
            } else {
                tokens.forEach(function(t) {
                    const lastUsed  = t.last_used_at ? QLApiTokens.formatDate(t.last_used_at) : 'Never';
                    const expiresAt = t.expires_at   ? QLApiTokens.formatDate(t.expires_at)   : 'Never';
                    $body.append(
                        '<tr>' +
                        '<td class="ql-token-name">' + QLApiTokens.escHtml(t.name) + '</td>' +
                        '<td>' + lastUsed + '</td>' +
                        '<td>' + expiresAt + '</td>' +
                        '<td><button class="ql-btn ql-btn-danger ql-revoke-token-btn" ' +
                            'data-id="' + t.id + '" data-name="' + QLApiTokens.escHtml(t.name) + '">Revoke</button></td>' +
                        '</tr>'
                    );
                });
            }
            $list.show();
        },

        showCreateModal: function() {
            $('#ql-token-name-input').val('');
            $('#ql-token-expires-select').val('0');
            $('#ql-create-error').hide().text('');
            $('#ql-token-modal-overlay').show();
            $('#ql-token-modal').show();
            setTimeout(function() { $('#ql-token-name-input').focus(); }, 50);
        },

        closeModal: function() {
            $('#ql-token-modal-overlay').hide();
            $('#ql-token-modal').hide();
        },

        createToken: function() {
            const name        = $('#ql-token-name-input').val().trim();
            const expiresDays = $('#ql-token-expires-select').val();

            if (!name) {
                $('#ql-create-error').text('Please enter a token name.').show();
                return;
            }

            $('#ql-token-create-submit').prop('disabled', true).text('Creating…');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: {
                    action:       'ql_create_api_token',
                    nonce:        qlAuth.nonce,
                    name:         name,
                    expires_days: expiresDays
                },
                success: function(response) {
                    $('#ql-token-create-submit').prop('disabled', false).text('Create token');
                    if (response.success) {
                        QLApiTokens.closeModal();
                        QLApiTokens.showRevealModal(response.data.token, response.data.name);
                        QLApiTokens.loadTokens();
                    } else {
                        $('#ql-create-error').text(response.data.message || 'Failed to create token.').show();
                    }
                },
                error: function() {
                    $('#ql-token-create-submit').prop('disabled', false).text('Create token');
                    $('#ql-create-error').text('Network error. Please try again.').show();
                }
            });
        },

        showRevealModal: function(token, name) {
            $('#ql-reveal-token-name').text(name);
            $('#ql-reveal-token-value').val(token);
            $('#ql-copy-feedback').hide().text('');
            $('#ql-reveal-modal-overlay').show();
            $('#ql-reveal-modal').show();
        },

        closeRevealModal: function() {
            $('#ql-reveal-modal-overlay').hide();
            $('#ql-reveal-modal').hide();
            $('#ql-reveal-token-value').val('');
        },

        copyToken: function() {
            const val = $('#ql-reveal-token-value').val();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(val).then(function() {
                    QLApiTokens.showCopyFeedback();
                });
            } else {
                $('#ql-reveal-token-value').select();
                document.execCommand('copy');
                QLApiTokens.showCopyFeedback();
            }
        },

        showCopyFeedback: function() {
            $('#ql-copy-feedback').text('Copied!').show();
            setTimeout(function() { $('#ql-copy-feedback').fadeOut(); }, 2000);
        },

        confirmRevoke: function(id, name) {
            $('#ql-confirm-token-name').text(name);
            $('#ql-revoke-confirm-btn').data('id', id);
            $('#ql-confirm-modal-overlay').show();
            $('#ql-confirm-modal').show();
        },

        closeConfirmModal: function() {
            $('#ql-confirm-modal-overlay').hide();
            $('#ql-confirm-modal').hide();
        },

        revokeToken: function() {
            const id = $('#ql-revoke-confirm-btn').data('id');
            $('#ql-revoke-confirm-btn').prop('disabled', true).text('Revoking…');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_revoke_api_token', nonce: qlAuth.nonce, token_id: id },
                success: function(response) {
                    QLApiTokens.closeConfirmModal();
                    $('#ql-revoke-confirm-btn').prop('disabled', false).text('Revoke');
                    if (response.success) {
                        QLApiTokens.loadTokens();
                    } else {
                        QLApiTokens.showError(response.data.message || 'Failed to revoke token.');
                    }
                },
                error: function() {
                    QLApiTokens.closeConfirmModal();
                    $('#ql-revoke-confirm-btn').prop('disabled', false).text('Revoke');
                    QLApiTokens.showError('Network error. Please try again.');
                }
            });
        },

        showError: function(msg) {
            $('#ql-tokens-error').text(msg).show();
            setTimeout(function() { $('#ql-tokens-error').fadeOut(); }, 5000);
        },

        formatDate: function(dateStr) {
            if (!dateStr) return '—';
            const d = new Date(dateStr.replace(' ', 'T') + 'Z');
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        },

        escHtml: function(str) {
            return $('<div>').text(str).html();
        }
    };

    $(document).ready(function() {
        if ($('#ql-api-tokens-page').length) {
            QLApiTokens.init();
        }
    });

})(jQuery);
