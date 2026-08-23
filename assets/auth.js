/**
 * QuantumLayers Frontend Authentication
 * Standalone authentication system
 */

(function($) {
    'use strict';

    const QLAuth = {

        // -----------------------------------------------------------------
        // Session token helpers
        // A session_token is returned by ql_user_signin and ql_third_party_signin.
        // It is stored in localStorage so third-party sites can persist auth
        // across page loads without relying on the QL WordPress session cookie.
        // -----------------------------------------------------------------

        storageKey: 'ql_session_token',

        getSessionToken: function() {
            try { return localStorage.getItem(this.storageKey); } catch(e) { return null; }
        },

        setSessionToken: function(token) {
            try { if (token) localStorage.setItem(this.storageKey, token); } catch(e) {}
        },

        clearSessionToken: function() {
            try { localStorage.removeItem(this.storageKey); } catch(e) {}
        },

        // -----------------------------------------------------------------
        // AJAX wrapper
        // Automatically injects Authorization: Bearer <token> when a session
        // token is stored, enabling cross-origin requests to bypass nonce auth.
        // Falls back to nonce-only for same-origin requests with no token.
        // -----------------------------------------------------------------

        _ajax: function(options) {
            const token = this.getSessionToken();
            if (token) {
                options.headers = options.headers || {};
                options.headers['Authorization'] = 'Bearer ' + token;
            }
            return $.ajax(options);
        },

        init: function() {
            this.captureReferralCode();
            this.bindEvents();
            this.loadGoogleSDK();
            this.checkAuth();
            this.initCountryDropdown();
        },

        captureReferralCode: function() {
            const ref = new URLSearchParams(window.location.search).get('ref');
            if (ref) {
                const code = ref.toUpperCase();
                try { sessionStorage.setItem('ql_referral_code', code); } catch(e) {}
                // 30-day cookie so the referral persists across tabs and browser restarts
                const expires = new Date(Date.now() + 30 * 864e5).toUTCString();
                document.cookie = 'ql_ref=' + encodeURIComponent(code)
                    + '; expires=' + expires + '; path=/; SameSite=Lax';
            }
        },

        getReferralCode: function() {
            const fromUrl = new URLSearchParams(window.location.search).get('ref');
            if (fromUrl) return fromUrl.toUpperCase();
            try {
                const fromStorage = sessionStorage.getItem('ql_referral_code');
                if (fromStorage) return fromStorage;
            } catch(e) {}
            // Fall back to cookie — persists across tabs and sessions
            const match = document.cookie.match(/(?:^|;\s*)ql_ref=([^;]+)/);
            return match ? decodeURIComponent(match[1]) : '';
        },

        bindEvents: function() {
            // Login form
            $(document).on('submit', '#ql-login-form', this.handleLogin.bind(this));
            
            // Register form
            $(document).on('submit', '#ql-register-form', this.handleRegister.bind(this));
            
            // Logout button
            $(document).on('click', '.ql-logout-btn', this.handleLogout.bind(this));
            
            // Google Sign In
            $(document).on('click', '.ql-google-signin', this.handleGoogleSignIn.bind(this));
            
            // Password visibility toggle
            $(document).on('click', '.ql-toggle-password', this.togglePassword);
            
            // Forgot password form
            $(document).on('submit', '#ql-forgot-password-form', this.handleForgotPassword.bind(this));
            
            // Reset password form
            $(document).on('submit', '#ql-reset-password-form', this.handleResetPassword.bind(this));

            // Terms agreement checkbox
            $(document).on('change', '.terms-agreed', this.handleTermsChange.bind(this));

        },

        checkAuth: function() {
            // Check if user is already logged in via session cookie or stored token.
           $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_check_auth',
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success && response.data.logged_in) {
                        QLAuth.updateUI(response.data.user);
                    }
                }
            });
        },

        gtag_report_conversion: function(url) {
            var callback = function () {
            if (typeof(url) != 'undefined') {
                window.location = url;
            }
            };
            gtag('event', 'conversion', {
                'send_to': 'AW-17755227694/tgD3CIqx3cUbEK6MrZJC',
                'event_callback': callback
            });
            return false;
        },

        uet_report_conversion: function () {
            window.uetq = window.uetq || [];
            window.uetq.push('event', 'signup', {});
        },

        handleLogin: function(e) {
            e.preventDefault();
            const form = $(e.target);
            const submitBtn = form.find('button[type="submit"]');
            
            // Disable submit button
            submitBtn.prop('disabled', true).text('Signing in...');
            
            // Clear previous errors
            $('.ql-error').remove();
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_user_signin',
                    nonce: qlAuth.nonce,
                    email: form.find('[name="email"]').val(),
                    password: form.find('[name="password"]').val(),
                    remember: form.find('[name="remember"]').is(':checked')
                },
                success: function(response) {
                    if (response.success) {
                        // Store token so third-party pages can authenticate
                        // subsequent requests without a session cookie.
                        if (response.session_token) {
                            QLAuth.setSessionToken(response.session_token);
                        }

                        QLAuth.showMessage('Login successful! Redirecting...', 'success');
                        
                        // Redirect after 1 second
                        setTimeout(function() {
                            const redirect = new URLSearchParams(window.location.search).get('redirect');
                            window.location.href = redirect || '/ql-dashboard';
                        }, 1000);
                    } else {
                        if (response.require_verification == true) {
                            window.location.href = '/ql-verify-email';
                        } else {
                            QLAuth.showMessage(response.message, 'error');
                            submitBtn.prop('disabled', false).text('Sign In');
                        }
                    }
                },
                error: function() {
                    QLAuth.showMessage('An error occurred. Please try again.', 'error');
                    submitBtn.prop('disabled', false).text('Sign In');
                }
            });
        },

        handleRegister: function(e) {
            e.preventDefault();
            const form = $(e.target);
            const submitBtn = form.find('button[type="submit"]');
            
            // Validate passwords match
            const password = form.find('[name="password"]').val();
            const passwordConfirm = form.find('[name="password_confirm"]').val();
            
            if (password !== passwordConfirm) {
                QLAuth.showMessage('Passwords do not match', 'error');
                return;
            }
            
            // Disable submit button
            submitBtn.prop('disabled', true).text('Creating account...');
            
            // Clear previous errors
            $('.ql-error').remove();
            
            console.log('Sending registration request...');
            console.log('AJAX URL:', qlAuth.ajaxurl);
            console.log('Nonce:', qlAuth.nonce);
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'ql_user_signup',
                    nonce: qlAuth.nonce,
                    email: form.find('[name="email"]').val(),
                    password: password,
                    first_name: form.find('[name="first_name"]').val(),
                    last_name: form.find('[name="last_name"]').val(),
                    company: form.find('[name="company"]').val(),
                    terms_agreed: form.find('.terms-agreed').is(':checked'),
                    marketing_consent: form.find('#marketing_consent').is(':checked'),
                    country: form.find('[name="country"]').val(),
                    referred_by_code: QLAuth.getReferralCode()
                },
                success: function(response) {
                    console.log('Success response:', response);
                    if (response.success) {
                        QLAuth.showMessage(response.message || response.data.message, 'success');
                        
                        // Redirect to login after 2 seconds
                        setTimeout(function() {
                            QLAuth.uet_report_conversion();
                            QLAuth.gtag_report_conversion('/ql-verify-email');
                            //window.location.href = '/ql-login?registered=1';
                        }, 2000);
                    } else {
                        QLAuth.showMessage(response.message || response.data.message || 'Registration failed', 'error');
                        submitBtn.prop('disabled', false).text('Create Account');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('AJAX Error:', xhr.responseText);
                    console.error('Status:', status);
                    console.error('Error:', error);
                    
                    let errorMsg = 'An error occurred. Please try again.';
                    if (xhr.responseText) {
                        try {
                            const resp = JSON.parse(xhr.responseText);
                            errorMsg = resp.message || resp.data || errorMsg;
                        } catch(e) {
                            errorMsg = xhr.responseText.substring(0, 100);
                        }
                    }
                    
                    QLAuth.showMessage(errorMsg, 'error');
                    submitBtn.prop('disabled', false).text('Create Account');
                }
            });
        },

        handleLogout: function(e) {
            e.preventDefault();
            
            if (!confirm('Are you sure you want to logout?')) {
                return;
            }
        },
            
        handleLogout: function(e) {
            e.preventDefault();
            
            if (!confirm('Are you sure you want to logout?')) {
                return;
            }
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_user_signout',
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        QLAuth.clearSessionToken();
                        const redirect = new URLSearchParams(window.location.search).get('redirect');
                        window.location.href = redirect || '/ql-login?logged_out=1';
                    }
                }
            });
        },
        
        handleForgotPassword: function(e) {
            e.preventDefault();
            const form = $(e.target);
            const submitBtn = form.find('button[type="submit"]');
            
            // Disable submit button
            submitBtn.prop('disabled', true).text('Sending...');
            
            // Clear previous errors
            $('.ql-error').remove();
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ql_forgot_password',
                    nonce: qlAuth.nonce,
                    email: form.find('[name="email"]').val()
                },
                success: function(response) {
                    if (response.success) {
                        QLAuth.showMessage(response.data.message, 'success');
                        form[0].reset();
                    } else {
                        QLAuth.showMessage(response.data.message || 'Failed to send reset link', 'error');
                    }
                    submitBtn.prop('disabled', false).text('Send Reset Link');
                },
                error: function() {
                    QLAuth.showMessage('An error occurred. Please try again.', 'error');
                    submitBtn.prop('disabled', false).text('Send Reset Link');
                }
            });
        },
        
        handleResetPassword: function(e) {
            e.preventDefault();
            const form = $(e.target);
            const submitBtn = form.find('button[type="submit"]');
            
            // Validate passwords match
            const password = form.find('[name="password"]').val();
            const passwordConfirm = form.find('[name="password_confirm"]').val();
            
            if (password !== passwordConfirm) {
                QLAuth.showMessage('Passwords do not match', 'error');
                return;
            }
            
            // Validate password length
            if (password.length < 8) {
                QLAuth.showMessage('Password must be at least 8 characters', 'error');
                return;
            }
            
            // Get reset key from URL
            const urlParams = new URLSearchParams(window.location.search);
            const key = urlParams.get('key');
            const email = urlParams.get('email');
            
            if (!key || !email) {
                QLAuth.showMessage('Invalid reset link', 'error');
                return;
            }
            
            // Disable submit button
            submitBtn.prop('disabled', true).text('Resetting...');
            
            // Clear previous errors
            $('.ql-error').remove();
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ql_reset_password',
                    nonce: qlAuth.nonce,
                    key: key,
                    email: email,
                    password: password
                },
                success: function(response) {
                    if (response.success) {
                        QLAuth.showMessage(response.data.message, 'success');
                        
                        // Redirect to login after 2 seconds
                        setTimeout(function() {
                            const redirect = new URLSearchParams(window.location.search).get('redirect');
                            window.location.href = redirect || '/ql-login?password_reset=1';
                        }, 2000);
                    } else {
                        QLAuth.showMessage(response.data.message || 'Failed to reset password', 'error');
                        submitBtn.prop('disabled', false).text('Reset Password');
                    }
                },
                error: function() {
                    QLAuth.showMessage('An error occurred. Please try again.', 'error');
                    submitBtn.prop('disabled', false).text('Reset Password');
                }
            });
        },

        loadGoogleSDK: function() {
            if (!qlAuth.google_client_id) return;
            
            // Load Google Sign-In script
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
            
            script.onload = function() {
                if (window.google) {
                    google.accounts.id.initialize({
                        client_id: qlAuth.google_client_id,
                        callback: QLAuth.handleGoogleResponse.bind(QLAuth)
                    });
                    
                    // Render Google button if element exists
                    const googleBtn = document.getElementById('google-signin-btn');
                    if (googleBtn) {
                        google.accounts.id.renderButton(
                            googleBtn,
                            {
                                theme: 'outline',
                                size: 'large',
                                width: '100%',
                                text: 'continue_with'
                            }
                        );
                    }
                }
            };
        },

        handleGoogleSignIn: function(e) {
            e.preventDefault();
            
            if (!window.google) {
                QLAuth.showMessage('Google Sign-In is not available', 'error');
                return;
            }
            
            // Trigger Google Sign-In
            google.accounts.id.prompt();
        },

        handleGoogleResponse: function(response) {
            
            // Store token in session storage
            sessionStorage.setItem('ql_google_token', response.access_token);
            
            $.ajax({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo',
                headers: {
                    'Authorization': 'Bearer ' + response.access_token
                },
                success: (userInfo) => {
                    sessionStorage.setItem('ql_google_email', userInfo.email);
                }
            });
            
            // Send credential to server
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_google_login',
                    nonce: qlAuth.nonce,
                    credential: response.credential,
                    terms_agreed: true,
                    referred_by_code: QLAuth.getReferralCode()
                },
                success: function(result) {
                    if (result.success) {
                        if (result.session_token) {
                            QLAuth.setSessionToken(result.session_token);
                        }

                        QLAuth.showMessage('Login successful! Redirecting...', 'success');
                        
                        setTimeout(function() {
                            if (result.new_user) {
                                QLAuth.uet_report_conversion();
                                QLAuth.gtag_report_conversion('/welcome');
                            } else {
                                const redirect = new URLSearchParams(window.location.search).get('redirect');
                                window.location.href = redirect || '/ql-dashboard';
                            }
                        }, 1000);
                    } else {
                        QLAuth.showMessage(result.message, 'error');
                    }
                },
                error: function() {
                    QLAuth.showMessage('Google Sign-In failed', 'error');
                }
            });
        },

        togglePassword: function(e) {
            e.preventDefault();
            const btn = $(this);
            const input = btn.siblings('input');
            
            if (input.attr('type') === 'password') {
                input.attr('type', 'text');
                btn.text('Hide');
            } else {
                input.attr('type', 'password');
                btn.text('Show');
            }
        },
        
        handleTermsChange: function(e) {
            const checkbox = $(e.target);
            const form = checkbox.closest('form');
            const submitBtn = form.find('button[type="submit"]');
            
            // Enable/disable submit button based on checkbox state
            if (checkbox.is(':checked')) {
                submitBtn.prop('disabled', false);
            } else {
                submitBtn.prop('disabled', true);
            }
        },
        
        initCountryDropdown: function() {
            // Populate country dropdown on registration page if it exists
            if ($('#ql-register-form [name="country"]').length > 0) {
                if (typeof QLHelpers !== 'undefined' && QLHelpers.populateCountryDropdown) {
                    QLHelpers.populateCountryDropdown('#ql-register-form [name="country"]');
                    
                    // Optional: Auto-detect user's country
                    // QLHelpers.autoDetectCountry(function(countryCode) {
                    //     $('#ql-register-form [name="country"]').val(countryCode);
                    // });
                } else {
                    console.warn('QLHelpers not loaded. Please include ql-countries.js before auth.js');
                }
            }
        },

        // -----------------------------------------------------------------
        // Third-party sign-in
        // Called by third-party sites that have obtained a signed JWT from
        // their own server. On success the session_token is stored and the
        // returned user object is passed to the callback.
        //
        // Usage:
        //   QLAuth.thirdPartySignin(jwt, function(user) { ... }, function(err) { ... });
        // -----------------------------------------------------------------

        thirdPartySignin: function(jwt, onSuccess, onError) {
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ql_third_party_signin',
                    jwt: jwt
                },
                success: function(response) {
                    if (response.success) {
                        QLAuth.setSessionToken(response.data.session_token);
                        if (typeof onSuccess === 'function') {
                            onSuccess(response.data.user);
                        }
                    } else {
                        if (typeof onError === 'function') {
                            onError(response.data && response.data.message || 'Authentication failed');
                        }
                    }
                },
                error: function() {
                    if (typeof onError === 'function') {
                        onError('Network error during authentication');
                    }
                }
            });
        },

        showMessage: function(message, type) {
            const alertClass = type === 'success' ? 'ql-alert-success' : 'ql-alert-error';
            const icon = type === 'success' ? '✓' : '✕';
            
            const alert = $(`
                <div class="ql-alert ${alertClass}">
                    <span class="ql-alert-icon">${icon}</span>
                    <span class="ql-alert-message">${message}</span>
                    <button class="ql-alert-close">&times;</button>
                </div>
            `);
            
            $('.ql-auth-container').prepend(alert);
            
            // Remove previous alerts
            $('.ql-alert').not(':first').remove();
            
            // Auto-hide after 5 seconds
            setTimeout(function() {
                alert.fadeOut(function() {
                    $(this).remove();
                });
            }, 5000);
            
            // Manual close
            alert.find('.ql-alert-close').on('click', function() {
                alert.fadeOut(function() {
                    $(this).remove();
                });
            });
        },

        updateUI: function(user) {
            // Update user info in header/nav if present
            $('.ql-user-name').text(user.first_name + ' ' + user.last_name);
            $('.ql-user-email').text(user.email);
            
            if (user.avatar) {
                $('.ql-user-avatar').attr('src', user.avatar);
            } else {
                const initials = user.first_name.charAt(0) + user.last_name.charAt(0);
                $('.ql-user-avatar-placeholder').text(initials);
            }
            
            // Show/hide auth elements
            $('.ql-auth-required').show();
            $('.ql-auth-hidden').hide();
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        QLAuth.init();
    });

    // Expose to global scope
    window.QLAuth = QLAuth;

})(jQuery);
