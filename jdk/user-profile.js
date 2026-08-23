/**
 * User Profile Management with Ajax-based Form Population
 * File: assets/user-profile.js
 * 
 * This JavaScript handles profile loading, updating, and account deletion
 * All data is loaded via Ajax, no PHP required in the page
 * 
 * REQUIRES: ql-helpers.js to be loaded first
 */

jQuery(document).ready(function($) {
    
    // Load user profile data on page load
    loadUserProfile();
    
    /**
     * Load User Profile via Ajax
     * Populates all form fields and displays user information
     */
    function loadUserProfile() {
        // Show loading state
        $('#profile-loading').show();
        $('#profile-content').hide();
        
        $.ajax({
            url: qlAuth.ajaxurl,
            type: 'POST',
            headers: {
                'Authorization': 'Bearer ' + QLAuth.getSessionToken()
            }, 
            data: {
                action: 'ql_get_profile',
                nonce: qlAuth.nonce
            },
            success: function(response) {
                if (response.success && response.user) {
                    populateProfileForm(response.user);
                    displayUserInfo(response.user);
                    $('#profile-loading').hide();
                    $('#profile-content').fadeIn();
                } else {
                    // User not logged in or error occurred
                    showMessage('error', response.message || 'Please log in to view your profile');
                    // Redirect to login after 2 seconds
                    setTimeout(function() {
                        window.location.href = '/ql-login';
                    }, 2000);
                }
            },
            error: function(xhr, status, error) {
                $('#profile-loading').hide();
                showMessage('error', 'Failed to load profile data. Please refresh the page.');
                console.error('Profile load error:', error);
            }
        });
    }
    
    /**
     * Populate form fields with user data
     */
    function populateProfileForm(user) {
        $('#first_name').val(user.first_name || '');
        $('#last_name').val(user.last_name || '');
        $('#company').val(user.company || '');
        $('#email').val(user.email || '');
        
        // Store original email for comparison
        $('#email').data('original-email', user.email);
        
        // Populate country dropdown
        populateCountryDropdown(user.country || '');

        // Set UI mode toggle (default to 'light' if not set)
        const uiMode = user.ui_mode || 'light';
        if (uiMode === 'dark') {
            $('#ui_mode_dark').prop('checked', true);
        } else {
            $('#ui_mode_light').prop('checked', true);
        }
        
        // Set marketing consent checkbox
        $('#marketing_consent').prop('checked', user.marketing_consent || false);
        
        // Display marketing consent date if available
        if (user.marketing_consent && user.marketing_consent_at) {
            const consentDate = new Date(user.marketing_consent_at);
            $('#marketing-consent-date')
                .text('Opted in on ' + formatDate(user.marketing_consent_at))
                .show();
        } else {
            $('#marketing-consent-date').hide();
        }

        // Set the "Email notifications" checkbox. This one is inverted from
        // the column/API polarity on purpose, and only here: checked means
        // "send me these", opting in is the default, and there's no signup
        // checkbox for it any more — a user who never visits this page keeps
        // receiving mail until they either come here or hit Unsubscribe in an
        // email. reengagement_opt_out itself is unset (0/false) for such a
        // user, so !user.reengagement_opt_out is true, matching that default.
        $('#email_notifications').prop('checked', !user.reengagement_opt_out);

        if (user.reengagement_opt_out && user.reengagement_opt_out_at) {
            $('#email-notifications-date')
                .text('Turned off on ' + formatDate(user.reengagement_opt_out_at))
                .show();
        } else {
            $('#email-notifications-date').hide();
        }
        
        // Show/hide password fields based on auth provider
        if (user.auth_provider === 'email') {
            $('#password-section').show();
            $('#auth-provider-notice').hide();
        } else {
            $('#password-section').hide();
            $('#auth-provider-notice')
                .text('You signed in with ' + capitalizeFirst(user.auth_provider) + '. Password changes are not available for this account type.')
                .show();
        }
    }
    
    /**
     * Populate country dropdown with all countries
     */
    function populateCountryDropdown(selectedCountry) {
        if (typeof QLHelpers !== 'undefined' && QLHelpers.populateCountryDropdown) {
            QLHelpers.populateCountryDropdown('#country', selectedCountry);
        } else {
            console.error('QLHelpers not loaded. Please include ql-helpers.js before user-profile.js');
        }
    }
    
    /**
     * Display user information in the info section
     */
    function displayUserInfo(user) {
        $('#display-first-name').text(user.first_name || '');
        $('#display-last-name').text(user.last_name || '');
        $('#display-email').text(user.email || '');
        $('#display-company').text(user.company || 'N/A');
        $('#display-role').text(capitalizeFirst(user.role) || 'User');
        $('#display-auth-provider').text(capitalizeFirst(user.auth_provider) || 'Email');
        
        // Display country
        if (user.country) {
            const countryName = typeof QLHelpers !== 'undefined' 
                ? QLHelpers.getCountryName(user.country) 
                : user.country;
            $('#display-country').text(countryName);
        } else {
            $('#display-country').text('Not specified');
        }
        
        // Display UI mode preference
        const uiMode = user.ui_mode || 'light';
        const uiModeDisplay = uiMode.charAt(0).toUpperCase() + uiMode.slice(1);
        const uiModeIcon = uiMode === 'dark' ? '🌙' : '☀️';
        $('#display-ui-mode').html(`${uiModeIcon} ${uiModeDisplay} Mode`);
        
        // Display marketing consent status
        if (user.marketing_consent) {
            const consentHtml = '<span class="badge badge-success">✓ Subscribed</span>';
            if (user.marketing_consent_at) {
                $('#display-marketing-consent').html(
                    consentHtml + 
                    ' <small class="text-muted">(since ' + 
                    formatDate(user.marketing_consent_at) + ')</small>'
                );
            } else {
                $('#display-marketing-consent').html(consentHtml);
            }
        } else {
            $('#display-marketing-consent').html('<span class="badge badge-secondary">Not subscribed</span>');
        }

        // Display Email notifications status
        if (user.reengagement_opt_out) {
            const optOutHtml = '<span class="badge badge-secondary">Turned off</span>';
            if (user.reengagement_opt_out_at) {
                $('#display-email-notifications').html(
                    optOutHtml +
                    ' <small class="text-muted">(since ' +
                    formatDate(user.reengagement_opt_out_at) + ')</small>'
                );
            } else {
                $('#display-email-notifications').html(optOutHtml);
            }
        } else {
            $('#display-email-notifications').html('<span class="badge badge-success">✓ On</span>');
        }
        
        // Email verification badge
        if (user.email_verified == 1) {
            $('#display-email-verified').html('<span class="badge badge-success">✓ Verified</span>');
        } else {
            $('#display-email-verified').html('<span class="badge badge-warning">⚠ Not Verified</span>');
        }
        
        // Format and display dates
        if (user.created_at) {
            $('#display-member-since').text(formatDate(user.created_at));
        }
        
        if (user.last_login) {
            $('#display-last-login').text(formatDate(user.last_login));
        }
        
        // Display avatar if available
        if (user.avatar_url) {
            $('#user-avatar').attr('src', user.avatar_url).show();
        }
    }
    
    /**
     * Update User Profile
     */
    function updateUserProfile() {
        // Get form data
        const formData = {
            action: 'ql_update_profile',
            nonce: qlAuth.nonce,
            first_name: $('#first_name').val(),
            last_name: $('#last_name').val(),
            company: $('#company').val(),
            email: $('#email').val(),
            marketing_consent: $('#marketing_consent').is(':checked'),
            // #email_notifications is the inverse of the API field: checked
            // means "send me these". Invert once, here, rather than carry an
            // inverted value through the rest of the stack.
            reengagement_opt_out: !$('#email_notifications').is(':checked'),
            country: $('#country').val(),
            ui_mode: $('input[name="ui_mode"]:checked').val()
        };
        
        // Add password if provided
        const newPassword = $('#new_password').val();
        if (newPassword) {
            formData.password = newPassword;
        }
        
        // Show loading state
        $('#update-profile-btn').prop('disabled', true).text('Updating...');
        
        $.ajax({
            url: qlAuth.ajaxurl,
            type: 'POST',
            headers: {
                'Authorization': 'Bearer ' + QLAuth.getSessionToken()
            }, 
            data: formData,
            success: function(response) {
                if (response.success) {
                    // Show success message
                    showMessage('success', response.message);
                    
                    // If email was changed, show verification notice
                    if (response.email_changed) {
                        showMessage('info', 'Please check your new email address for a verification link.');
                        
                        // Update the email verification badge
                        $('#display-email-verified').html('<span class="badge badge-warning">⚠ Not Verified</span>');
                    }
                    
                    // Update displayed user info if user data returned
                    if (response.user) {
                        displayUserInfo(response.user);
                        populateProfileForm(response.user);
                    }
                    
                    // Clear password fields
                    $('#new_password').val('');
                    $('#confirm_password').val('');
                    setTimeout(function() {
                            const redirect = new URLSearchParams(window.location.search).get('redirect');
                            window.location.href = '/ql-dashboard';
                        }, 2000);
                        
                } else {
                    showMessage('error', response.message);
                }
            },
            error: function(xhr, status, error) {
                showMessage('error', 'An error occurred while updating your profile. Please try again.');
                console.error('Profile update error:', error);
            },
            complete: function() {
                $('#update-profile-btn').prop('disabled', false).text('Update Profile');
            }
        });
    }
    
    /**
     * Delete User Account
     */
    function deleteUserAccount() {
        // First confirmation
        if (!confirm('Are you sure you want to delete your account?\n\nThis will permanently delete:\n• Your user account\n• All your datasets\n• All your connections\n• All your files\n\nThis action CANNOT be undone!')) {
            return;
        }
        
        // Second confirmation with password
        const password = prompt('Please enter your password to confirm account deletion:');
        if (!password) {
            return;
        }
        
        const formData = {
            action: 'ql_delete_account',
            nonce: qlAuth.nonce,
            password: password
        };
        
        // Show loading state
        $('#delete-account-btn').prop('disabled', true).text('Deleting...');
        
        $.ajax({
            url: qlAuth.ajaxurl,
            type: 'POST',
            headers: {
                'Authorization': 'Bearer ' + QLAuth.getSessionToken()
            }, 
            data: formData,
            success: function(response) {
                if (response.success) {
                    showMessage('success', response.message);
                    
                    // Show countdown before redirect
                    let seconds = 3;
                    const countdownInterval = setInterval(function() {
                        showMessage('success', 'Account deleted. Redirecting in ' + seconds + '...');
                        seconds--;
                        if (seconds < 0) {
                            clearInterval(countdownInterval);
                            window.location.href = '/';
                        }
                    }, 1000);
                } else {
                    showMessage('error', response.message);
                    $('#delete-account-btn').prop('disabled', false).text('Delete Account');
                }
            },
            error: function(xhr, status, error) {
                showMessage('error', 'An error occurred while deleting your account. Please try again.');
                console.error('Account deletion error:', error);
                $('#delete-account-btn').prop('disabled', false).text('Delete Account');
            }
        });
    }
    
    /**
     * Show message to user
     */
    function showMessage(type, message) {
        const messageClass = type === 'success' ? 'notice-success' : 
                           type === 'error' ? 'notice-error' : 'notice-info';
        
        const messageHtml = `
            <div class="notice ${messageClass} is-dismissible">
                <p>${message}</p>
                <button type="button" class="notice-dismiss" onclick="jQuery(this).parent().fadeOut()">
                    <span class="screen-reader-text">Dismiss</span>
                </button>
            </div>
        `;
        
        $('#message-container').html(messageHtml);
        
        // Auto-dismiss success messages after 5 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(function() {
                $('#message-container .notice').fadeOut();
            }, 5000);
        }
    }
    
    /**
     * Capitalize first letter
     */
    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    /**
     * Format date for display
     */
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return date.toLocaleDateString('en-US', options);
    }
    
    /**
     * Email validation helper
     */
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * Form validation
     */
    function validateProfileForm() {
        // Validate email if changed
        const email = $('#email').val();
        const originalEmail = $('#email').data('original-email');
        
        if (email && email !== originalEmail) {
            if (!isValidEmail(email)) {
                showMessage('error', 'Please enter a valid email address');
                return false;
            }
        }
        
        // Validate password if provided
        const password = $('#new_password').val();
        const confirmPassword = $('#confirm_password').val();
        
        if (password) {
            if (password.length < 8) {
                showMessage('error', 'Password must be at least 8 characters long');
                return false;
            }
            
            if (password !== confirmPassword) {
                showMessage('error', 'Passwords do not match');
                return false;
            }
        }
        
        return true;
    }
    
    // Event handlers
    $('#profile-form').on('submit', function(e) {
        e.preventDefault();
        
        if (validateProfileForm()) {
            updateUserProfile();
        }
    });
    
    $('#update-profile-btn').on('click', function(e) {
        e.preventDefault();
        
        if (validateProfileForm()) {
            updateUserProfile();
        }
    });
    
    $('#delete-account-btn').on('click', function(e) {
        e.preventDefault();
        deleteUserAccount();
    });
    
    // Real-time password matching indicator
    $('#new_password, #confirm_password').on('keyup', function() {
        const password = $('#new_password').val();
        const confirmPassword = $('#confirm_password').val();
        
        if (password && confirmPassword) {
            if (password === confirmPassword) {
                $('#password-match-indicator')
                    .removeClass('text-danger')
                    .addClass('text-success')
                    .html('✓ Passwords match')
                    .show();
            } else {
                $('#password-match-indicator')
                    .removeClass('text-success')
                    .addClass('text-danger')
                    .html('✗ Passwords do not match')
                    .show();
            }
        } else {
            $('#password-match-indicator').hide();
        }
    });
    
    // Show password strength indicator
    $('#new_password').on('keyup', function() {
        const password = $(this).val();
        let strength = 0;
        let strengthText = '';
        let strengthClass = '';
        
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        
        if (password.length === 0) {
            $('#password-strength-indicator').hide();
            return;
        }
        
        if (strength < 2) {
            strengthText = 'Weak';
            strengthClass = 'text-danger';
        } else if (strength < 4) {
            strengthText = 'Medium';
            strengthClass = 'text-warning';
        } else {
            strengthText = 'Strong';
            strengthClass = 'text-success';
        }
        
        $('#password-strength-indicator')
            .removeClass('text-danger text-warning text-success')
            .addClass(strengthClass)
            .html('Password strength: ' + strengthText)
            .show();
    });
    
    // Email change warning
    $('#email').on('change', function() {
        const originalEmail = $(this).data('original-email');
        const newEmail = $(this).val();
        
        if (originalEmail && newEmail !== originalEmail) {
            $('#email-change-warning')
                .html('<small class="text-warning">⚠ Changing your email will require verification. You\'ll receive a verification link at your new email address.</small>')
                .show();
        } else {
            $('#email-change-warning').hide();
        }
    });
    
    /**
     * UI Mode Toggle with Instant Preview
     * Allows users to instantly preview the dark/light theme before saving
     */
    $('input[name="ui_mode"]').on('change', function() {
        const selectedMode = $(this).val();
        const currentMode = getCurrentUIMode();
        
        if (selectedMode !== currentMode) {
            // Show notification about the change
            showMessage('info', `Theme switched to ${selectedMode} mode. Click "Update Profile" to save this preference.`);
            
            // Apply theme instantly for preview
            applyThemePreview(selectedMode);
        }
    });
    
    /**
     * Get current UI mode from CSS files loaded
     */
    function getCurrentUIMode() {
        // Check which CSS is currently loaded by looking at stylesheets
        const stylesheets = document.styleSheets;
        for (let i = 0; i < stylesheets.length; i++) {
            const href = stylesheets[i].href;
            if (href && href.includes('auth-dark.css')) {
                return 'dark';
            } else if (href && href.includes('user-profile-dark.css')) {
                return 'dark';
            }
        }
        return 'light';
    }
    
    /**
     * Apply theme preview instantly without saving
     */
    function applyThemePreview(mode) {
        // Find and replace CSS files
        $('link[rel="stylesheet"]').each(function() {
            const href = $(this).attr('href');
            
            if (href && (href.includes('auth-light.css') || href.includes('auth-dark.css'))) {
                const newHref = href.replace(/auth-(light|dark)\.css/, `auth-${mode}.css`);
                $(this).attr('href', newHref);
            }
            
            if (href && (href.includes('user-profile-light.css') || href.includes('user-profile-dark.css'))) {
                const newHref = href.replace(/user-profile-(light|dark)\.css/, `user-profile-${mode}.css`);
                $(this).attr('href', newHref);
            }
            
            if (href && (href.includes('common-light.css') || href.includes('common-dark.css'))) {
                const newHref = href.replace(/common-(light|dark)\.css/, `common-${mode}.css`);
                $(this).attr('href', newHref);
            }
            
            if (href && (href.includes('dashboard-light.css') || href.includes('dashboard-dark.css'))) {
                const newHref = href.replace(/dashboard-(light|dark)\.css/, `dashboard-${mode}.css`);
                $(this).attr('href', newHref);
            }
        });
    }
    
});
