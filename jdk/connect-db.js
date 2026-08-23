/**
 * QuantumLayers Database Connection JavaScript
 * Updated to use Google Identity Services (GIS) OAuth2
 */

(function($) {
    'use strict';

    const QLConnect = {
        currentTab: 'sql',
        queryInputMode: 'sql',
        googleAccessToken: null,
        googleTokenClient: null,
        googleRefreshToken: null,
        editMode: false,
        editDatasetId: null,
        editConnectionId: null,
        gapiLoaded: false,
        selectedFileId: null,
        selectedFileName: null,
        allAPITemplates: null,
        currentOAuthProvider: null,
        currentOAuthScope: null,
        oauthPopup: null,

        init: function() {
            this.initQueryBuilderTabs();
            this.transformGoogleSheetUI();
            this.bindEvents();
            this.checkAuth();
            this.loadGoogleSDK();
            this.checkEditMode();
            this.loadQueryTemplates();
            this.loadAPITemplates();
            this.loadOAuthProviders();
            window.addEventListener('message', this.handleOAuthMessage.bind(this));
        },

        checkAuth: function() {
            if (typeof qlAuth === 'undefined') {
                window.location.href = '/ql-login';
                return;
            }
            const self = this;

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
                    if (!response.success || !response.data.logged_in) {
                        window.location.href = '/ql-login?redirect=' + encodeURIComponent(window.location.pathname);
                    }
                }
            });
        },

        uet_report_conversion: function () {
            window.uetq = window.uetq || [];
            window.uetq.push('event', 'dataset_connect', {});
        },

        bindEvents: function() {
            // Tab switching
            $('.ql-tab-btn').on('click', this.handleTabSwitch.bind(this));

            // Query builder mode switching
            $(document).on('click', '.ql-query-tab-btn', this.handleQueryModeSwitch.bind(this));

            // Test connection
            $('#test-sql-connection').on('click', this.testConnection.bind(this));
            $('#test-sftp-connection').on('click', this.testSFTPConnection.bind(this));

            // Form submissions
            $('#sql-connect-form').on('submit', this.handleSQLSubmit.bind(this));
            $('#api-connect-form').on('submit', this.handleAPISubmit.bind(this));
            $('#google-sheet-connect-form').on('submit', this.handleGoogleSheetSubmit.bind(this));
            $('#sftp-connect-form').on('submit', this.handleSFTPSubmit.bind(this));
            $('#kaggle-connect-form').on('submit', this.handleKaggleSubmit.bind(this));

            // Google Sheets specific buttons
            $('.ql-google-auth-btn').on('click', this.getToken.bind(this));
            $(document).on('click', '#ql-open-picker', this.openPicker.bind(this));
            
            // SFTP authentication method toggle
            $('input[name="sftp_auth_method"]').on('change', this.toggleSFTPAuthFields.bind(this));
            
            // Query template selectors
            $('.ql-service-selector').on('change', this.handleServiceChange.bind(this));
            $('.ql-template-selector').on('change', this.handleTemplateChange.bind(this));

            // API form: show/hide request body when method changes
            $(document).on('change', '#api-http-method', this.toggleAPIPostFields.bind(this));

            // API template selectors
            $(document).on('change', '#ql-api-service-selector', this.handleAPIServiceChange.bind(this));
            $(document).on('change', '#ql-api-template-selector', this.handleAPITemplateChange.bind(this));

            // API auth provider selector — triggers OAuth immediately on selection
            $(document).on('change', '#api-auth-provider', this.handleAuthProviderChange.bind(this));
        },

        initQueryBuilderTabs: function() {
            const $group = $('#sql_query').closest('.ql-form-group');
            if (!$group.length) return;

            const $textarea = $('#sql_query').detach();
            const $hint     = $group.find('small').detach();

            $group.empty().append(
                '<label>SQL Query *</label>' +
                '<div class="ql-query-mode-tabs">' +
                    '<button type="button" class="ql-query-tab-btn active" data-mode="sql">Write SQL</button>' +
                    '<button type="button" class="ql-query-tab-btn" data-mode="intent">Describe your data</button>' +
                '</div>' +
                '<div class="ql-query-panel active" data-panel="sql"></div>' +
                '<div class="ql-query-panel" data-panel="intent">' +
                    '<textarea name="intent" placeholder="e.g. Show me all customers who signed up last month, ordered by signup date"></textarea>' +
                    '<small>A SQL query will be generated automatically when you connect</small>' +
                '</div>'
            );

            $group.find('[data-panel="sql"]').append($textarea).append($hint);
        },

        setQueryMode: function(mode) {
            this.queryInputMode = mode;
            $('.ql-query-tab-btn').removeClass('active');
            $('.ql-query-tab-btn[data-mode="' + mode + '"]').addClass('active');
            $('.ql-query-panel').removeClass('active');
            $('.ql-query-panel[data-panel="' + mode + '"]').addClass('active');
            if (mode === 'sql') {
                $('[name="sql_query"]').attr('required', true);
                $('[name="intent"]').removeAttr('required');
            } else {
                $('[name="intent"]').attr('required', true);
                $('[name="sql_query"]').removeAttr('required');
            }
        },

        handleQueryModeSwitch: function(e) {
            this.setQueryMode($(e.currentTarget).data('mode'));
        },

        handleTabSwitch: function(e) {
            const tab = $(e.target).data('tab');
            
            $('.ql-tab-btn').removeClass('active');
            $(e.target).addClass('active');
            
            $('.ql-tab-content').removeClass('active');
            $('#' + tab + '-tab').addClass('active');
            
            this.currentTab = tab;
        },

        // ========================================
        // GOOGLE SHEETS AUTHENTICATION
        // ========================================

        loadGoogleSDK: function() {
            if (!qlAuth.google_client_id) {
                console.warn('Google Client ID not configured');
                return;
            }

            const self = this;

            // Load gapi (needed for the Picker)
            const gapiScript = document.createElement('script');
            gapiScript.src = 'https://apis.google.com/js/api.js';
            gapiScript.async = true;
            gapiScript.onload = function() { self.gapiLoaded = true; };
            document.head.appendChild(gapiScript);

            // Load Google Identity Services
            const gisScript = document.createElement('script');
            gisScript.src = 'https://accounts.google.com/gsi/client';
            gisScript.async = true;
            gisScript.defer = true;
            document.head.appendChild(gisScript);

            gisScript.onload = function() {
                if (window.google) {
                    // Initialize OAuth2 CODE client with the narrower drive.file scope
                    self.googleCodeClient = google.accounts.oauth2.initCodeClient({
                        client_id: qlAuth.google_client_id,
                        scope: 'https://www.googleapis.com/auth/drive.file',
                        ux_mode: 'popup',
                        callback: self.handleGoogleCodeResponse.bind(self)
                    });

                    // Render the Google Sign-In button
                    const googleBtn = document.getElementById('google-auth-btn');
                    if (googleBtn) {
                        google.accounts.id.renderButton(
                            googleBtn,
                            { theme: 'outline', size: 'large', width: '100%', text: 'continue_with' }
                        );
                    }

                    // Restore a valid stored token if one exists
                    self.checkStoredGoogleToken();
                } else {
                    console.error('Google Identity Services failed to load');
                }
            };

            gisScript.onerror = function() {
                console.error('Failed to load Google Identity Services');
                self.showStatus('Failed to load Google authentication. Please refresh the page.', 'error');
            };
        },

        transformGoogleSheetUI: function() {
            const $idInput = $('[name="spreadsheet_id"]');
            if (!$idInput.length) return;

            // Convert the existing input to a hidden field
            $idInput.attr('type', 'hidden');
            const $inputGroup = $idInput.closest('.ql-form-group');

            // Inject picker UI after the hidden field's group
            $inputGroup.after(
                '<div class="ql-form-group" id="ql-picker-group">' +
                    '<label>Google Spreadsheet</label>' +
                    '<div class="ql-picker-display">' +
                        '<span id="ql-selected-file-name" class="ql-picker-file-name">No file selected</span>' +
                        '<button type="button" id="ql-open-picker" class="ql-btn ql-btn-secondary" disabled>Pick Spreadsheet</button>' +
                    '</div>' +
                '</div>'
            );
            $inputGroup.hide();

            // Hide the now-redundant "Test Connection" row
            $('#test-google-sheet-connection').closest('.ql-form-group').hide();

            // Hide sheet name and range fields — Drive API export always exports the
            // first/active sheet; these fields have no effect with the Picker flow.
            $('[name="sheet_name"]').closest('.ql-form-group').hide();
            $('[name="range_notation"]').closest('.ql-form-group').hide();
        },
        
        getToken: function() {
            this.googleCodeClient.requestCode();
        },

        openPicker: function() {
            if (!this.googleAccessToken) {
                this.showStatus('Please authenticate with Google first.', 'error');
                return;
            }
            if (!qlAuth.google_api_key) {
                this.showStatus('Google API Key is not configured. Please contact support.', 'error');
                return;
            }

            const self = this;

            const launchPicker = function() {
                const view = new google.picker.DocsView()
                    .setMimeTypes('application/vnd.google-apps.spreadsheet');

                const picker = new google.picker.PickerBuilder()
                    .addView(view)
                    .setOAuthToken(self.googleAccessToken)
                    .setDeveloperKey(qlAuth.google_api_key)
                    .setAppId(qlAuth.google_app_id)
                    .setCallback(self.handlePickerCallback.bind(self))
                    .build();

                document.body.style.overflow = 'hidden';
                $('<div id="ql-picker-backdrop"></div>').appendTo('body');
                picker.setVisible(true);
            };

            if (window.google && window.google.picker) {
                launchPicker();
            } else if (this.gapiLoaded) {
                gapi.load('picker', launchPicker);
            } else {
                this.showStatus('Google API not ready yet. Please wait a moment and try again.', 'error');
            }
        },

        closePickerOverlay: function() {
            document.body.style.overflow = '';
            $('#ql-picker-backdrop').remove();
        },

        handlePickerCallback: function(data) {
            if (data.action === google.picker.Action.PICKED) {
                const file = data.docs[0];
                this.selectedFileId = file.id;
                this.selectedFileName = file.name;

                $('[name="spreadsheet_id"]').val(file.id);
                $('#ql-selected-file-name').text(file.name);
                this.showStatus('Spreadsheet selected: ' + file.name, 'success');
            }

            if (data.action === google.picker.Action.PICKED || data.action === google.picker.Action.CANCEL) {
                this.closePickerOverlay();
            }
        },
        
        checkStoredGoogleToken: function() {
            // Check session storage for token (stored from previous auth)
            const storedToken = sessionStorage.getItem('ql_google_token');
            const storedRefreshToken = sessionStorage.getItem('ql_google_refresh_token');
            const storedEmail = sessionStorage.getItem('ql_google_email');
            const storedExpiry = sessionStorage.getItem('ql_google_token_expiry');
            
            if (storedToken) {
                // Check if token is expired
                if (storedExpiry && Date.now() < parseInt(storedExpiry)) {
                    this.googleAccessToken = storedToken;
                    this.googleRefreshToken = storedRefreshToken;
                    this.updateGoogleAuthUI(true, storedEmail);
                } else if (storedRefreshToken) {
                    // Token expired but we have refresh token, try to refresh
                    this.refreshAccessToken(storedRefreshToken);
                } else {
                    // Token expired and no refresh token, clear storage
                    this.clearGoogleAuth();
                }
            }
        },
        
        handleGoogleCodeResponse: function(response) {
            const btn = $('#google-signin-btn').find('.ql-google-oauth-btn');
            
            if (response.error) {
                console.error('OAuth error:', response);
                this.showStatus('❌ Google authentication failed: ' + response.error, 'error');
                this.resetGoogleButton(btn);
                return;
            }
        
            // Show loading state
            this.showStatus('🔄 Exchanging authorization code...', 'info');
        
            // Send authorization code to your backend to exchange for tokens
            $.ajax({
                url: '/wp-admin/admin-ajax.php?action=ql_google_exchange_code', // Your backend endpoint
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    code: response.code
                }),
                success: (data) => {
                    this.handleTokenResponse(data, btn);
                },
                error: (xhr) => {
                    console.error('Token exchange failed:', xhr);
                    this.showStatus('❌ Failed to obtain access token', 'error');
                    this.resetGoogleButton(btn);
                }
            });
        },
        
        handleTokenResponse: function(response, btn) {
            const data = response.data;
            this.googleAccessToken = data.access_token;
            this.googleRefreshToken = data.refresh_token;
            
            // Store tokens in session storage
            sessionStorage.setItem('ql_google_token', this.googleAccessToken);
            if (data.refresh_token) {
                sessionStorage.setItem('ql_google_refresh_token', this.googleRefreshToken);
            }
            
            // Calculate and store expiry time
            if (data.expires_in) {
                const expiryTime = Date.now() + (data.expires_in * 1000);
                sessionStorage.setItem('ql_google_token_expiry', expiryTime);
            }
            
            // Get user info to display
            $.ajax({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo',
                headers: {
                    'Authorization': 'Bearer ' + this.googleAccessToken
                },
                success: (userInfo) => {
                    sessionStorage.setItem('ql_google_email', userInfo.email);
                    this.showStatus('✅ Successfully authenticated with Google!', 'success');
                    this.updateGoogleAuthUI(true, userInfo.email);
                    this.resetGoogleButton(btn, true);
                },
                error: () => {
                    this.showStatus('✅ Successfully authenticated with Google!', 'success');
                    this.updateGoogleAuthUI(true, null);
                    this.resetGoogleButton(btn, true);
                }
            });
        },
        
        refreshAccessToken: function(refreshToken) {
            $.ajax({
                url: '/wp-admin/admin-ajax.php?action=ql_google_refresh_token', // Your backend endpoint
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    refresh_token: refreshToken
                }),
                success: (data) => {
                    this.googleAccessToken = data.access_token;
                    sessionStorage.setItem('ql_google_token', this.googleAccessToken);
                    
                    if (data.expires_in) {
                        const expiryTime = Date.now() + (data.expires_in * 1000);
                        sessionStorage.setItem('ql_google_token_expiry', expiryTime);
                    }
                    
                    const storedEmail = sessionStorage.getItem('ql_google_email');
                    this.updateGoogleAuthUI(true, storedEmail);
                },
                error: (xhr) => {
                    console.error('Token refresh failed:', xhr);
                    this.clearGoogleAuth();
                }
            });
        },
        
        clearGoogleAuth: function() {
            sessionStorage.removeItem('ql_google_token');
            sessionStorage.removeItem('ql_google_refresh_token');
            sessionStorage.removeItem('ql_google_email');
            sessionStorage.removeItem('ql_google_token_expiry');
            this.googleAccessToken = null;
            this.googleRefreshToken = null;
            this.updateGoogleAuthUI(false, null);
        },

        resetGoogleButton: function(btn, authenticated = false) {
            if (authenticated) {
                btn.prop('disabled', false).html(
                    '<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g fill="#000" fill-rule="evenodd"><path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335"/><path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/><path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853"/><path d="M0 0h18v18H0z" fill="none"/></g></svg>' +
                    '<span>Re-authenticate</span>'
                );
            } else {
                btn.prop('disabled', false).html(
                    '<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g fill="#000" fill-rule="evenodd"><path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335"/><path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/><path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853"/><path d="M0 0h18v18H0z" fill="none"/></g></svg>' +
                    '<span>Continue with Google</span>'
                );
            }
        },

        updateGoogleAuthUI: function(isAuthenticated, email) {
            if (isAuthenticated) {
                const displayEmail = email || 'Google Account';
                $('#google-auth-status').html(
                    '<div class="ql-auth-success">' +
                    '✓ Authenticated as: <strong>' + displayEmail + '</strong>' +
                    '</div>'
                ).show();

                // Enable the form fields and the picker button
                $('#google-sheet-connect-form input, #google-sheet-connect-form button').prop('disabled', false);
                $('#ql-open-picker').prop('disabled', false);
            } else {
                $('#google-auth-status').hide();
                $('#google-sheet-connect-form input, #google-sheet-connect-form button').prop('disabled', true);
                $('#ql-open-picker').prop('disabled', true);
            }
        },

        handleGoogleSheetSubmit: function(e) {
            e.preventDefault();

            if (!this.googleAccessToken) {
                this.showStatus('Please authenticate with Google first', 'error');
                return;
            }

            const form = $(e.target);
            const submitBtn = form.find('button[type="submit"]');
            const spreadsheetId = form.find('[name="spreadsheet_id"]').val();
            const datasetName = form.find('[name="dataset_name"]').val();
            const sheetName = form.find('[name="sheet_name"]').val() || 'Sheet1';
            const rangeNotation = form.find('[name="range_notation"]').val();
            const visibility = form.find('[name="visibility"]').val() || 'private';

            // Validate required fields
            if (!datasetName) {
                this.showStatus('Please enter a dataset name', 'error');
                return;
            }

            if (!spreadsheetId) {
                this.showStatus('Please pick a spreadsheet using the "Pick Spreadsheet" button', 'error');
                return;
            }

            submitBtn.prop('disabled', true).text(this.editMode ? 'Updating...' : 'Connecting...');

            // Build AJAX data object
            const ajaxData = {
                action: this.editMode ? 'ql_update_google_sheet_connection' : 'ql_connect_google_sheet',
                nonce: qlAuth.nonce,
                connection_name: datasetName,
                dataset_name: datasetName,
                spreadsheet_id: spreadsheetId,
                sheet_name: sheetName,
                range_notation: rangeNotation,
                access_token: this.googleAccessToken,
                refresh_token: this.googleRefreshToken,
                visibility: visibility
            };

            // Add connection_id if in edit mode
            if (this.editMode) {
                ajaxData.connection_id = this.editConnectionId;
            }

            // Use the existing ql_connect_google_sheet AJAX handler from quantumlayers.php
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: ajaxData,
                success: (response) => {
                    if (response.success) {
                        this.showStatus('✅ Google Sheet ' + (this.editMode ? 'updated' : 'connected') + ' successfully! Redirecting...', 'success');

                        // Clear stored token
                        sessionStorage.removeItem('ql_google_token');
                        sessionStorage.removeItem('ql_google_email');

                        // Google Ads conversion — dataset connection
                        if (!this.editMode && typeof gtag === 'function') {
                            gtag('event', 'conversion', {
                                'send_to': 'AW-17755227694/IG_JCLnswuUcEK6MrZJC'
                            });
                        }
                        // Microsoft Ads conversion — dataset connection
                        if (!this.editMode) {
                            this.uet_report_conversion();
                        }

                        setTimeout(function() {
                            window.location.href = '/ql-dashboard';
                        }, 2000);
                    } else {
                        this.showStatus('❌ ' + (response.data.message || 'Connection failed'), 'error');
                        submitBtn.prop('disabled', false).text(this.editMode ? 'Update Google Sheet Connection' : 'Connect Google Sheet');
                    }
                },
                error: (xhr) => {
                    console.error('Connection error:', xhr.responseText);
                    let errorMsg = 'Failed to ' + (this.editMode ? 'update' : 'connect') + ' Google Sheet';
                    
                    try {
                        const resp = JSON.parse(xhr.responseText);
                        if (resp.data && resp.data.message) {
                            errorMsg = resp.data.message;
                        }
                    } catch(e) {
                        // Use default error message
                    }
                    
                    this.showStatus('❌ ' + errorMsg, 'error');
                    submitBtn.prop('disabled', false).text(this.editMode ? 'Update Google Sheet Connection' : 'Connect Google Sheet');
                }
            });
        },

        // ========================================
        // SQL DATABASE CONNECTION
        // ========================================

        testConnection: function(e) {
            e.preventDefault();
            
            const form = $('#sql-connect-form');
            const btn = $(e.target);
            const statusDiv = $('#connection-status');

            // Validate required fields
            if (!form.find('[name="host"]').val() || !form.find('[name="database"]').val()) {
                this.showStatus('Please fill in host and database name', 'error');
                return;
            }

            btn.prop('disabled', true).text('Testing...');
            statusDiv.removeClass('show success error');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_test_sql_connection',
                    nonce: qlAuth.nonce,
                    host: form.find('[name="host"]').val(),
                    port: form.find('[name="port"]').val() || 3306,
                    database: form.find('[name="database"]').val(),
                    username: form.find('[name="username"]').val(),
                    password: form.find('[name="password"]').val(),
                    db_type: form.find('[name="db_type"]').val()
                },
                success: function(response) {
                    if (response.success) {
                        QLConnect.showStatus('✅ Connection successful! ' + response.data.message, 'success');
                    } else {
                        QLConnect.showStatus('❌ ' + (response.data.message || 'Connection failed'), 'error');
                    }
                    btn.prop('disabled', false).text('Test Connection');
                },
                error: function(xhr) {
                    QLConnect.showStatus('❌ Connection test failed', 'error');
                    btn.prop('disabled', false).text('Test Connection');
                }
            });
        },

        /**
         * Call the ql_generate_sql_query AJAX endpoint to turn a natural-language
         * intent into an SQL query, extracting the schema from the live database.
         *
         * @param {Object}   params           - DB connection params
         * @param {string}   params.intent    - natural-language description
         * @param {string}   params.db_type
         * @param {string}   params.host
         * @param {number}   params.port
         * @param {string}   params.database
         * @param {string}   params.username
         * @param {string}   params.password
         * @param {Function} callback         - callback(errorMsg|null, data|null)
         */
        generateSqlFromIntent: function(params, callback) {
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action:   'ql_generate_sql_query',
                    nonce:    qlAuth.nonce,
                    intent:   params.intent,
                    db_type:  params.db_type,
                    host:     params.host,
                    port:     params.port,
                    database: params.database,
                    username: params.username,
                    password: params.password
                },
                success: function(response) {
                    if (response.success) {
                        callback(null, response.data);
                    } else {
                        callback(response.data.message || 'Failed to generate SQL query');
                    }
                },
                error: function(xhr) {
                    console.error('SQL generation error:', xhr.responseText);
                    callback('Failed to generate SQL query');
                }
            });
        },

        handleSQLSubmit: function(e) {
            e.preventDefault();
            const form = $(e.target);
            const submitBtn = form.find('button[type="submit"]');

            if (!form.find('[name="dataset_name"]').val()) {
                this.showStatus('Please enter a dataset name', 'error');
                return;
            }

            const sqlQuery = form.find('[name="sql_query"]').val();
            const intent   = form.find('[name="intent"]').val();

            if (!sqlQuery && !intent) {
                this.showStatus('Please enter a SQL query or describe what data you need', 'error');
                return;
            }

            const self = this;

            const doSubmit = function(sql) {
                submitBtn.prop('disabled', true).text(self.editMode ? 'Updating...' : 'Connecting...');

                const ajaxData = {
                    action: self.editMode ? 'ql_update_sql_connection' : 'ql_connect_sql_database',
                    nonce: qlAuth.nonce,
                    dataset_name: form.find('[name="dataset_name"]').val(),
                    visibility: form.find('[name="visibility"]').val() || 'private',
                    host: form.find('[name="host"]').val(),
                    port: form.find('[name="port"]').val() || 3306,
                    database: form.find('[name="database"]').val(),
                    username: form.find('[name="username"]').val(),
                    password: form.find('[name="password"]').val(),
                    sql_query: sql,
                    db_type: form.find('[name="db_type"]').val()
                };

                if (self.editMode) {
                    ajaxData.connection_id = self.editConnectionId;
                }

                $.ajax({
                    url: qlAuth.ajaxurl,
                    type: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                    },
                    data: ajaxData,
                    success: function(response) {
                        if (response.success) {
                            QLConnect.showStatus('✅ ' + (QLConnect.editMode ? 'Connection updated' : 'Database connected') + ' successfully! Redirecting...', 'success');
                            // Google Ads conversion — dataset connection
                            if (!QLConnect.editMode && typeof gtag === 'function') {
                                gtag('event', 'conversion', {
                                    'send_to': 'AW-17755227694/IG_JCLnswuUcEK6MrZJC'
                                });
                            }
                            // Microsoft Ads conversion — dataset connection
                            if (!QLConnect.editMode) {
                                QLConnect.uet_report_conversion();
                            }
                            setTimeout(() => window.location.href = '/ql-dashboard', 2000);
                        } else {
                            QLConnect.showStatus('❌ ' + (response.data.message || 'Connection failed'), 'error');
                            submitBtn.prop('disabled', false).text(QLConnect.editMode ? 'Update SQL Connection' : 'Connect Database');
                        }
                    },
                    error: function(xhr) {
                        console.error('Connection error:', xhr.responseText);
                        QLConnect.showStatus('❌ Failed to ' + (QLConnect.editMode ? 'update' : 'connect') + ' database', 'error');
                        submitBtn.prop('disabled', false).text(QLConnect.editMode ? 'Update SQL Connection' : 'Connect Database');
                    }
                });
            };

            if (!sqlQuery && intent) {
                submitBtn.prop('disabled', true).text('Generating SQL...');
                this.generateSqlFromIntent({
                    intent:   intent,
                    db_type:  form.find('[name="db_type"]').val(),
                    host:     form.find('[name="host"]').val(),
                    port:     form.find('[name="port"]').val() || 3306,
                    database: form.find('[name="database"]').val(),
                    username: form.find('[name="username"]').val(),
                    password: form.find('[name="password"]').val()
                }, function(err, data) {
                    if (err) {
                        QLConnect.showStatus('❌ ' + err, 'error');
                        submitBtn.prop('disabled', false).text(self.editMode ? 'Update SQL Connection' : 'Connect Database');
                        return;
                    }
                    form.find('[name="sql_query"]').val(data.sql);
                    doSubmit(data.sql);
                });
            } else {
                doSubmit(sqlQuery);
            }
        },

        // ========================================
        // REST API CONNECTION
        // ========================================

        handleAPISubmit: function(e) {
            e.preventDefault();
            const form = $(e.target);
            const submitBtn = form.find('button[type="submit"]');

            submitBtn.prop('disabled', true).text(this.editMode ? 'Updating...' : 'Connecting...');

            const ajaxData = {
                action: this.editMode ? 'ql_update_api_connection' : 'ql_connect_api',
                nonce: qlAuth.nonce,
                dataset_name: form.find('[name="dataset_name"]').val(),
                visibility: form.find('[name="visibility"]').val() || 'private',
                api_url: form.find('[name="api_url"]').val(),
                api_key: form.find('[name="api_key"]').val(),
                http_method: form.find('[name="http_method"]').val() || 'GET',
                request_body: form.find('[name="request_body"]').val() || '',
                response_path: form.find('[name="response_path"]').val() || '',
                refresh_token: form.find('[name="refresh_token"]').val() || '',
                oauth_provider_name: form.find('[name="oauth_provider_name"]').val() || '',
                oauth_scope: form.find('[name="oauth_scope"]').val() || ''
            };

            if (this.editMode) {
                ajaxData.connection_id = this.editConnectionId;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: ajaxData,
                success: function(response) {
                    if (response.success) {
                        QLConnect.showStatus('✅ ' + (QLConnect.editMode ? 'Connection updated' : 'API connected') + ' successfully! Redirecting...', 'success');
                        // Google Ads conversion — dataset connection
                        if (!QLConnect.editMode && typeof gtag === 'function') {
                            gtag('event', 'conversion', {
                                'send_to': 'AW-17755227694/IG_JCLnswuUcEK6MrZJC'
                            });
                        }
                        // Microsoft Ads conversion — dataset connection
                        if (!QLConnect.editMode) {
                            QLConnect.uet_report_conversion();
                        }
                        setTimeout(() => window.location.href = '/ql-dashboard', 2000);
                    } else {
                        QLConnect.showStatus('❌ ' + (response.data.message || 'Connection failed'), 'error');
                        submitBtn.prop('disabled', false).text(QLConnect.editMode ? 'Update API Connection' : 'Connect API');
                    }
                },
                error: function(xhr) {
                    QLConnect.showStatus('❌ Failed to ' + (QLConnect.editMode ? 'update' : 'connect') + ' API', 'error');
                    submitBtn.prop('disabled', false).text(QLConnect.editMode ? 'Update API Connection' : 'Connect API');
                }
            });
        },

        // ========================================
        // SFTP CONNECTION
        // ========================================

        toggleSFTPAuthFields: function(e) {
            const authMethod = $('input[name="sftp_auth_method"]:checked').val();
            
            if (authMethod === 'password') {
                $('#sftp-password-field').show();
                $('#sftp-key-field').hide();
                $('#sftp_password').prop('required', true);
                $('#sftp_private_key').prop('required', false);
            } else {
                $('#sftp-password-field').hide();
                $('#sftp-key-field').show();
                $('#sftp_password').prop('required', false);
                $('#sftp_private_key').prop('required', true);
            }
        },

        testSFTPConnection: function(e) {
            e.preventDefault();
            
            const btn = $(e.target);
            const originalText = btn.html();
            btn.prop('disabled', true).text('Testing...');
            
            const authMethod = $('input[name="sftp_auth_method"]:checked').val();
            const formData = {
                action: 'ql_test_sftp_connection',
                nonce: qlAuth.nonce,
                host: $('#sftp_host').val(),
                port: $('#sftp_port').val() || 22,
                username: $('#sftp_username').val(),
                password: authMethod === 'password' ? $('#sftp_password').val() : '',
                private_key: authMethod === 'key' ? $('#sftp_private_key').val() : '',
                remote_path: $('#sftp_remote_path').val(),
                filename: $('#sftp_filename').val()
            };
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: formData,
                success: (response) => {
                    btn.prop('disabled', false).html(originalText);
                    
                    if (response.success) {
                        let message = '✓ ' + response.data.message;
                        
                        // Show file details
                        if (response.data.matched_file) {
                            // Wildcard pattern - show matched file
                            message += '<br>File: ' + response.data.matched_file + 
                                      ' (' + response.data.file_size + ' bytes)';
                            if (response.data.total_matches > 1) {
                                message += '<br>(' + (response.data.total_matches - 1) + ' other file(s) also match)';
                            }
                        } else {
                            // Exact filename
                            message += '<br>Size: ' + response.data.file_size + ' bytes, ' +
                                      'Last modified: ' + response.data.file_modified;
                        }
                        
                        this.showStatus(message, 'success');
                    } else {
                        this.showStatus('✗ Connection failed: ' + response.data.message, 'error');
                    }
                },
                error: (xhr) => {
                    btn.prop('disabled', false).html(originalText);
                    this.showStatus('✗ Connection test failed: ' + (xhr.responseJSON?.data?.message || 'Unknown error'), 'error');
                }
            });
        },
        
        handleSFTPSubmit: function(e) {
            e.preventDefault();
            const form = $('#sftp-connect-form');
            const submitBtn = form.find('button[type="submit"]');
            const originalText = submitBtn.html();
            
            submitBtn.prop('disabled', true).text(this.editMode ? 'Updating...' : 'Connecting...');

            const authMethod = $('input[name="sftp_auth_method"]:checked').val();
            const formData = {
                action: this.editMode ? 'ql_update_sftp_connection' : 'ql_create_sftp_connection',
                nonce: qlAuth.nonce,
                dataset_name: $('#sftp_dataset_name').val(),
                visibility: form.find('[name="visibility"]').val() || 'private',
                host: $('#sftp_host').val(),
                port: $('#sftp_port').val() || 22,
                username: $('#sftp_username').val(),
                password: authMethod === 'password' ? $('#sftp_password').val() : '',
                private_key: authMethod === 'key' ? $('#sftp_private_key').val() : '',
                remote_path: $('#sftp_remote_path').val(),
                filename: $('#sftp_filename').val()
            };

            if (this.editMode) {
                formData.connection_id = this.editConnectionId;
            } else {
                formData.connection_name = $('#sftp_connection_name').val();
            }
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: formData,
                success: (response) => {
                    submitBtn.prop('disabled', false).html(originalText);
                    if (response.success) {
                        this.showStatus('✓ SFTP connection ' + (this.editMode ? 'updated' : 'created') + ' successfully!', 'success');
                        // Google Ads conversion — dataset connection
                        if (!this.editMode && typeof gtag === 'function') {
                            gtag('event', 'conversion', {
                                'send_to': 'AW-17755227694/IG_JCLnswuUcEK6MrZJC'
                            });
                        }
                        // Microsoft Ads conversion — dataset connection
                        if (!this.editMode) {
                            this.uet_report_conversion();
                        }
                        setTimeout(() => window.location.href = '/ql-dashboard', 2000);
                    } else {
                        this.showStatus('✗ Failed: ' + response.data.message, 'error');
                    }
                },
                error: (xhr) => {
                    submitBtn.prop('disabled', false).html(originalText);
                    const errorMsg = xhr.responseJSON?.data?.message || xhr.statusText || 'Unknown error';
                    this.showStatus('✗ Connection failed: ' + errorMsg, 'error');
                }
            });
        },

        // ========================================

        // ========================================
        // EDIT MODE FUNCTIONALITY
        // ========================================

        checkEditMode: function() {
            const urlParams = new URLSearchParams(window.location.search);
            const datasetId = urlParams.keys().next().value || window.location.search.replace('?', '');
            
            if (datasetId && !isNaN(datasetId)) {
                this.editMode = true;
                this.editDatasetId = parseInt(datasetId);
                this.loadConnectionData();
            }
        },

        loadConnectionData: function() {
            const self = this;
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_dataset_detail',
                    nonce: qlAuth.nonce,
                    dataset_id: this.editDatasetId
                },
                success: function(response) {
                    if (response.success && response.data.dataset) {
                        const dataset = response.data.dataset;
                        const sourceType = dataset.source_type === 'db' ? 'sql' :
                            (dataset.source_type === 'google_sheet' ? 'google-sheet' : dataset.source_type);

                        $('.ql-tab-btn[data-tab="' + sourceType + '"]').click();
                        $('#' + sourceType + '-connect-form button[type="submit"]').text('Update ' + sourceType.toUpperCase().replace('_', ' ') + ' Connection');
                        // Set visibility select
                        $('#' + sourceType + '-connect-form [name="visibility"]').val(dataset.visibility || 'private');

                        if (sourceType === 'sql' || sourceType === 'db') {
                            self.loadSQLConnection(self.editDatasetId);
                        } else if (sourceType === 'api') {
                            self.loadAPIConnection(self.editDatasetId);
                        } else if (sourceType === 'google-sheet') {
                            self.loadGoogleSheetConnection(self.editDatasetId);
                        } else if (sourceType === 'sftp') {
                            self.loadSFTPConnection(self.editDatasetId);
                        } else if (sourceType === 'kaggle') {
                            self.loadKaggleConnection(self.editDatasetId);
                        }
                    }
                }
            });
        },

        loadSQLConnection: function(datasetId) {
            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: { action: 'ql_get_sql_connection', nonce: qlAuth.nonce, dataset_id: datasetId },
                success: function(r) {
                    if (r.success && r.data.connection) {
                        const c = r.data.connection;
                        self.editConnectionId = c.id;
                        // Use scoped selectors to target fields within the sql tab only
                        $('#sql-tab [name="dataset_name"]').val(c.dataset_name || '');
                        $('#sql-tab [name="db_type"]').val(c.db_type);
                        $('#sql-tab [name="host"]').val(c.host);
                        $('#sql-tab [name="port"]').val(c.port);
                        $('#sql-tab [name="database"]').val(c.database_name);
                        $('#sql-tab [name="username"]').val(c.username);
                        $('#sql-tab [name="sql_query"]').val(c.sql_query);
                        $('#sql-tab [name="password"]').attr('autocomplete', 'new-password');
                    }
                }
            });
        },

        loadAPIConnection: function(datasetId) {
            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: { action: 'ql_get_api_connection', nonce: qlAuth.nonce, dataset_id: datasetId },
                success: function(r) {
                    if (r.success && r.data.connection) {
                        const c = r.data.connection;
                        self.editConnectionId = c.id;
                        $('#api-tab [name="dataset_name"]').val(c.dataset_name || '');
                        $('#api-tab [name="api_url"]').val(c.api_url);
                        if (c.http_method) {
                            $('#api-http-method').val(c.http_method).trigger('change');
                        }
                        if (c.request_body) {
                            $('#api-tab [name="request_body"]').val(c.request_body);
                        }
                        if (c.response_path) {
                            $('#api-response-path').val(c.response_path);
                        }
                        // Do not pre-populate api_key or refresh_token for security; leave blank
                        $('#api-tab [name="api_key"]').attr('autocomplete', 'new-password');
                        $('#api-tab [name="refresh_token"]').attr('autocomplete', 'new-password');

                        const $authSelect = $('#api-auth-provider');
                        if (c.oauth_provider_name) {
                            self.currentOAuthProvider = c.oauth_provider_name;
                            self.currentOAuthScope    = c.oauth_scope || '';
                            $('#api-tab [name="oauth_provider_name"]').val(c.oauth_provider_name);
                            $('#api-tab [name="oauth_scope"]').val(c.oauth_scope || '');
                            // Do not .trigger('change') — tokens are already stored server-side,
                            // we must not re-open the OAuth popup on edit load.
                            if ($authSelect.find('option[value="' + c.oauth_provider_name + '"]').length) {
                                $authSelect.val(c.oauth_provider_name);
                            } else {
                                // Providers may still be loading; loadOAuthProviders() applies this.
                                $authSelect.data('edit-provider', c.oauth_provider_name);
                            }
                            $('#api-oauth-scope-group').show();
                            $('#api-oauth-status-group').show();
                            self.updateAPIOAuthUI(true);
                        } else {
                            $authSelect.val('bearer');
                        }
                    }
                }
            });
        },

        loadGoogleSheetConnection: function(datasetId) {
            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: { action: 'ql_get_google_sheet_connection', nonce: qlAuth.nonce, dataset_id: datasetId },
                success: function(r) {
                    if (r.success && r.data.connection) {
                        const c = r.data.connection;
                        self.editConnectionId = c.id;
                        self.selectedFileId = c.spreadsheet_id;
                        $('#google-sheet-tab [name="dataset_name"]').val(c.dataset_name || '');
                        $('#google-sheet-tab [name="spreadsheet_id"]').val(c.spreadsheet_id);
                        $('#google-sheet-tab [name="sheet_name"]').val(c.sheet_name);
                        $('#google-sheet-tab [name="range_notation"]').val(c.range_notation);
                        // Show the current spreadsheet ID in the picker display
                        $('#ql-selected-file-name').text(c.spreadsheet_id);
                    }
                }
            });
        },

        loadSFTPConnection: function(datasetId) {
            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: { action: 'ql_get_sftp_connection', nonce: qlAuth.nonce, dataset_id: datasetId },
                success: function(r) {
                    if (r.success && r.data.connection) {
                        const c = r.data.connection;
                        self.editConnectionId = c.id;
                        $('#sftp_dataset_name').val(c.dataset_name || '');
                        $('#sftp_host').val(c.host);
                        $('#sftp_port').val(c.port);
                        $('#sftp_username').val(c.username);
                        $('#sftp_remote_path').val(c.remote_path);
                        $('#sftp_filename').val(c.filename || '');
                        $('#sftp_password').attr('autocomplete', 'new-password');
                        $('#sftp_private_key').attr('autocomplete', 'new-password');
                    }
                }
            });
        },

        // ========================================
        // QUERY TEMPLATES FUNCTIONALITY
        // ========================================

        loadQueryTemplates: function() {
            const self = this;
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_query_templates',
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.populateServiceSelector(response.data.services);
                        self.allTemplates = response.data.templates;
                    }
                },
                error: function(xhr) {
                    console.error('Failed to load query templates:', xhr);
                }
            });
        },

        populateServiceSelector: function(services) {
            const selector = $('.ql-service-selector');
            
            if (selector.length === 0) {
                return; // Selector doesn't exist on this page
            }
            
            // Clear existing options
            selector.empty();
            
            // Add default option
            selector.append('<option value="">Select a Service...</option>');
            
            // Add service options
            services.forEach(function(service) {
                selector.append(`<option value="${service}">${service}</option>`);
            });
            
            // Add "Other" option
            selector.append('<option value="Other">Other (Custom Query)</option>');
        },

        handleServiceChange: function(e) {
            const service = $(e.target).val();
            const templateSelector = $('.ql-template-selector');
            
            if (service === 'Other') {
                // Clear template selector and SQL query box
                templateSelector.empty().append('<option value="">Other (Custom Query)</option>').prop('disabled', true);
                $('[name="sql_query"]').val('').prop('readonly', false).focus();
            } else if (service === '') {
                // No service selected
                templateSelector.empty().append('<option value=""></option>').prop('disabled', true);
                $('[name="sql_query"]').val('').prop('readonly', false);
            } else {
                // Load templates for selected service
                this.populateTemplateSelector(service);
                templateSelector.prop('disabled', false);
            }
        },

        populateTemplateSelector: function(service) {
            const self = this;
            const templateSelector = $('.ql-template-selector');
            
            // Filter templates by service
            const serviceTemplates = this.allTemplates.filter(t => t.service_name === service);
            
            // Clear existing options
            templateSelector.empty();
            
            // Add default option
            templateSelector.append('<option value="">Select a Query Template...</option>');
            
            // Add template options
            serviceTemplates.forEach(function(template) {
                const optionText = template.template_name + (template.description ? ' - ' + template.description : '');
                templateSelector.append(`<option value="${template.id}" data-query="${self.escapeHtml(template.sql_query)}">${optionText}</option>`);
            });
        },

        handleTemplateChange: function(e) {
            const selectedOption = $(e.target).find('option:selected');
            const query = selectedOption.data('query');

            if (query) {
                this.setQueryMode('sql');
                $('[name="sql_query"]').val(query).prop('readonly', true);
            } else {
                $('[name="sql_query"]').val('').prop('readonly', false);
            }
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
        },

        // ========================================
        // API FORM
        // ========================================

        toggleAPIPostFields: function() {
            const method = $('#api-http-method').val();
            if (method === 'POST') {
                $('#api-body-group').show();
            } else {
                $('#api-body-group').hide();
            }
        },

        loadAPITemplates: function() {
            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_get_api_templates', nonce: qlAuth.nonce },
                success: function(response) {
                    if (response.success) {
                        self.allAPITemplates = response.data.templates;
                        self.populateAPIServiceSelector(response.data.services);
                    }
                },
                error: function(xhr) {
                    console.error('Failed to load API templates:', xhr);
                }
            });
        },

        populateAPIServiceSelector: function(services) {
            const $selector = $('#ql-api-service-selector');
            if (!$selector.length) return;

            $selector.empty();
            $selector.append('<option value="">Select a Service...</option>');
            services.forEach(function(service) {
                $selector.append('<option value="' + service + '">' + service + '</option>');
            });
            $selector.append('<option value="Custom">Custom / No template</option>');
        },

        handleAPIServiceChange: function(e) {
            const service = $(e.target).val();
            const $templateSelector = $('#ql-api-template-selector');

            if (service === 'Custom') {
                $templateSelector
                    .empty()
                    .append('<option value="">Custom / No template</option>')
                    .prop('disabled', true);
                $('#api-tab [name="api_url"]').val('');
                $('#api-http-method').val('GET').trigger('change');
                $('#api-response-path').val('');
                $('#api-tab [name="request_body"]').val('');
                this.currentOAuthScope = null;
                $('#api-oauth-scope-group').hide();
                $('#api-oauth-status-group').hide();
                $('#api-auth-provider').val('bearer');
            } else if (service === '') {
                $templateSelector
                    .empty()
                    .append('<option value="">Select a Template...</option>')
                    .prop('disabled', true);
            } else {
                $templateSelector.prop('disabled', false);
                this.populateAPITemplateSelector(service);
            }
        },

        populateAPITemplateSelector: function(service) {
            const $templateSelector = $('#ql-api-template-selector');
            const serviceTemplates = (this.allAPITemplates || []).filter(function(t) {
                return t.service_name === service;
            });

            $templateSelector.empty();
            $templateSelector.append('<option value="">Select a Template...</option>');

            serviceTemplates.forEach(function(tpl) {
                const label = tpl.template_name + (tpl.description ? ' — ' + tpl.description : '');
                $templateSelector.append(
                    $('<option>')
                        .val(tpl.id)
                        .text(label)
                        .attr('data-api-url',        tpl.api_url)
                        .attr('data-http-method',    tpl.http_method)
                        .attr('data-request-body',   tpl.request_body  || '')
                        .attr('data-response-path',  tpl.response_path || '')
                        .attr('data-auth-type',      tpl.auth_type     || 'none')
                        .attr('data-oauth-provider', tpl.oauth_provider_name || '')
                        .attr('data-oauth-scope',    tpl.oauth_scope   || '')
                );
            });
        },

        handleAPITemplateChange: function(e) {
            const $selected      = $(e.target).find('option:selected');
            const apiUrl         = $selected.attr('data-api-url');
            const httpMethod     = $selected.attr('data-http-method');
            const requestBody    = $selected.attr('data-request-body');
            const responsePath   = $selected.attr('data-response-path');
            const authType       = $selected.attr('data-auth-type') || 'none';
            const oauthProvider  = $selected.attr('data-oauth-provider') || '';
            const oauthScope     = $selected.attr('data-oauth-scope') || '';

            if (!apiUrl) return; // placeholder option

            $('#api-tab [name="api_url"]').val(apiUrl);
            $('#api-http-method').val(httpMethod || 'GET').trigger('change');
            $('#api-response-path').val(responsePath || '');
            $('#api-tab [name="request_body"]').val(requestBody || '');

            // Pre-select auth provider and pre-fill scope from template
            if (authType === 'oauth2') {
                this.currentOAuthScope    = oauthScope;
                this.currentOAuthProvider = oauthProvider || null;
                $('#api-tab [name="oauth_scope"]').val(oauthScope);
                $('#api-oauth-scope-group').show();
                // Set the provider dropdown; if providers haven't loaded yet, stash for later
                const $authSelect = $('#api-auth-provider');
                if (oauthProvider) {
                    if ($authSelect.find('option[value="' + oauthProvider + '"]').length) {
                        $authSelect.val(oauthProvider).trigger('change');
                    } else {
                        $authSelect.data('pending-provider', oauthProvider);
                    }
                }
                this.updateAPIOAuthUI(false);
                $('#api-oauth-status-group').show();
            } else {
                this.currentOAuthScope    = null;
                this.currentOAuthProvider = null;
                $('#api-oauth-scope-group').hide();
                $('#api-oauth-status-group').hide();
                $('#api-auth-provider').val('bearer');
            }
        },

        // ========================================
        // GENERIC API OAUTH (any provider)
        // ========================================

        loadOAuthProviders: function() {
            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_get_oauth_providers', nonce: qlAuth.nonce },
                success: function(response) {
                    if (!response.success) return;
                    const $select = $('#api-auth-provider');
                    if (!$select.length) return;
                    $select.empty().append('<option value="bearer">Bearer Token (manual)</option>');
                    response.data.providers.forEach(function(name) {
                        $select.append($('<option>').val(name).text(name));
                    });
                    // Apply any provider that was selected by a template before this loaded
                    const pending = $select.data('pending-provider');
                    if (pending) {
                        $select.val(pending).removeData('pending-provider').trigger('change');
                    }
                    // Apply a provider stashed by the edit-load path (no change trigger —
                    // tokens already exist server-side, must not re-open the OAuth popup).
                    const editProvider = $select.data('edit-provider');
                    if (editProvider) {
                        $select.val(editProvider).removeData('edit-provider');
                    }
                }
            });
        },

        handleAuthProviderChange: function(e) {
            const provider = $(e.target).val();

            if (provider === 'bearer' || !provider) {
                // Manual token — clear OAuth status, hide scope field
                this.currentOAuthProvider = null;
                $('#api-tab [name="api_key"]').val('');
                $('#api-tab [name="refresh_token"]').val('');
                $('#api-oauth-scope-group').hide();
                this.updateAPIOAuthUI(false);
                return;
            }

            // OAuth provider selected — show scope field and trigger popup
            this.currentOAuthProvider = provider;
            this.currentOAuthScope    = $('#api-tab [name="oauth_scope"]').val() || '';
            $('#api-oauth-scope-group').show();

            if (!this.currentOAuthScope) {
                this.showStatus('Enter the OAuth scope for this provider (e.g. the template pre-fills this).', 'error');
                return;
            }

            this.triggerOAuthPopup(provider, this.currentOAuthScope);
        },

        triggerOAuthPopup: function(provider, scope) {
            const self = this;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_get_oauth_provider_config', nonce: qlAuth.nonce, provider_name: provider },
                success: function(response) {
                    if (!response.success) {
                        self.showStatus('OAuth provider not configured: ' + provider, 'error');
                        return;
                    }
                    const cfg = response.data;

                    const params = new URLSearchParams({
                        client_id:     cfg.client_id,
                        scope:         scope,
                        redirect_uri:  window.location.origin + '/ql-oauth-callback',
                        response_type: 'code',
                        state:         btoa(provider),
                    });

                    if (cfg.extra_auth_params && typeof cfg.extra_auth_params === 'object') {
                        Object.keys(cfg.extra_auth_params).forEach(function(k) {
                            params.set(k, cfg.extra_auth_params[k]);
                        });
                    }

                    if (self.oauthPopup && !self.oauthPopup.closed) {
                        self.oauthPopup.close();
                    }
                    self.oauthPopup = window.open(
                        cfg.auth_endpoint + '?' + params.toString(),
                        'ql_oauth_popup',
                        'width=600,height=700,left=200,top=100'
                    );
                },
                error: function() {
                    self.showStatus('Failed to load OAuth provider configuration.', 'error');
                }
            });
        },

        handleOAuthMessage: function(event) {
            if (event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.ql_oauth !== true) return;

            if (this.oauthPopup && !this.oauthPopup.closed) {
                this.oauthPopup.close();
                this.oauthPopup = null;
            }

            if (data.error) {
                this.showStatus('OAuth error: ' + data.error, 'error');
                this.updateAPIOAuthUI(false);
                return;
            }

            $('#api-tab [name="api_key"]').val(data.access_token || '');
            $('#api-tab [name="refresh_token"]').val(data.refresh_token || '');
            $('#api-tab [name="oauth_provider_name"]').val(data.provider || this.currentOAuthProvider || '');
            this.showStatus('Successfully authorized!', 'success');
            this.updateAPIOAuthUI(true);
        },

        updateAPIOAuthUI: function(isAuthenticated) {
            const $status = $('#api-oauth-auth-status');
            if (isAuthenticated) {
                $status.html('<div class="ql-auth-success">&#10003; Authorized — tokens ready.</div>').show();
            } else {
                $status.hide().empty();
            }
        },

        // ========================================
        // KAGGLE INTEGRATION
        // ========================================

        handleKaggleSubmit: function(e) {
            e.preventDefault();
            const form = $('#kaggle-connect-form');
            const submitBtn = form.find('button[type="submit"]');
            const originalText = submitBtn.html();

            submitBtn.prop('disabled', true).text(this.editMode ? 'Updating...' : 'Connecting...');

            const formData = {
                action:          this.editMode ? 'ql_update_kaggle_dataset' : 'ql_connect_kaggle',
                nonce:           qlAuth.nonce,
                dataset_name:    $('#kaggle_dataset_name').val(),
                kaggle_username: $('#kaggle_username').val(),
                kaggle_api_key:  $('#kaggle_api_key').val(),
                kaggle_owner:    $('#kaggle_owner').val(),
                kaggle_dataset:  $('#kaggle_dataset_slug').val(),
                visibility:      form.find('[name="visibility"]').val() || 'private',
            };

            if (this.editMode) {
                formData.dataset_id = this.editDatasetId;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: formData,
                success: (response) => {
                    submitBtn.prop('disabled', false).html(originalText);
                    if (response.success) {
                        this.showStatus('&#10003; Kaggle dataset ' + (this.editMode ? 'synced' : 'connected') + ' successfully!', 'success');
                        setTimeout(() => window.location.href = '/ql-dashboard', 2000);
                    } else {
                        this.showStatus('&#10007; Failed: ' + response.data.message, 'error');
                    }
                },
                error: (xhr) => {
                    submitBtn.prop('disabled', false).html(originalText);
                    const errorMsg = xhr.responseJSON?.data?.message || xhr.statusText || 'Unknown error';
                    this.showStatus('&#10007; Connection failed: ' + errorMsg, 'error');
                }
            });
        },

        loadKaggleConnection: function(datasetId) {
            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_get_connection_details', nonce: qlAuth.nonce, dataset_id: datasetId },
                success: function(r) {
                    if (r.success && r.data.connection && r.data.connection.type === 'kaggle') {
                        const c = r.data.connection;
                        self.editConnectionId = c.id;
                        $('#kaggle_dataset_name').val(c.name || '');
                        $('#kaggle_owner').val(c.owner);
                        $('#kaggle_dataset_slug').val(c.dataset);
                        // Credentials are stored encrypted and never echoed back
                        $('#kaggle_username').removeAttr('required').attr('autocomplete', 'off');
                        $('#kaggle_api_key').removeAttr('required').attr('autocomplete', 'new-password');
                    }
                }
            });
        },

        // ========================================
        // UTILITY FUNCTIONS
        // ========================================

        showStatus: function(message, type) {
            const statusDiv = $('#connection-status');
            statusDiv.removeClass('success error').addClass(type + ' show');
            statusDiv.html(message);

            if (type === 'error') {
                setTimeout(function() {
                    statusDiv.removeClass('show');
                }, 5000);
            }
        },

    };

    // Initialize on document ready
    $(document).ready(function() {
        QLConnect.init();
    });

    // Expose to global scope
    window.QLConnect = QLConnect;

})(jQuery);
