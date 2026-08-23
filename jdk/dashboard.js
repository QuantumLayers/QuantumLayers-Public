/**
 * QuantumLayers Dashboard JavaScript
 */

(function($) {
    'use strict';

    const QLDashboard = {
        syncingDatasetId: null,

        init: function() {
            this.loadDashboard();
            this.bindEvents();
            this.checkSuccess();
            this.initGoogleAuth();
        },

        initGoogleAuth: function() {
            // Only initialize if QLConnect is available and has Google auth set up
            if (!window.QLConnect) {
                // Load connect-db.js functionality if not available
                // This ensures Google auth works from the dashboard
                if (typeof qlAuth !== 'undefined' && qlAuth.google_client_id) {
                    this.loadGoogleSDK();
                }
            }
        },

        loadGoogleSDK: function() {
            if (!qlAuth.google_client_id) {
                return;
            }
            
            // Check if already loaded
            if (window.google && window.google.accounts) {
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
            
            const self = this;
            script.onload = function() {
                if (window.google) {
                    console.log('Google Identity Services loaded in dashboard');
                }
            };
        },

        loadDashboard: function() {
            const self = this;
            
            if (typeof qlAuth === 'undefined') {
                console.error('qlAuth not loaded');
                window.location.href = '/ql-login';
                return;
            }

            // Show loading state
            this.showLoading();

            // Check authentication and load data
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_dashboard_data',
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    console.log('Dashboard data:', response);
                    
                    if (response.success) {
                        self.updateDashboard(response.data);
                    } else {
                        console.error('Failed to load dashboard data');
                        window.location.href = '/ql-login';
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Dashboard data error:', error);
                 //   window.location.href = '/ql-login';
                }
            });
        },

        bindEvents: function() {
            // Logout button
            $(document).on('click', '.ql-logout-btn', this.handleLogout.bind(this));
            
            // Close success banner
            $(document).on('click', '.ql-success-banner .ql-close', function() {
                $(this).closest('.ql-success-banner').fadeOut();
            });

            // Dataset row click (navigate to details)
            //$(document).on('click', '.ql-dataset-row', function(e) {
                // Don't navigate if clicking on any action button or link in the right section
            //    if ($(e.target).closest('.ql-dataset-right').length > 0) {
            //        return; // Let the button/link handle it
            //    }
            //    const datasetId = $(this).data('id');
            //    window.location.href = '/ql-dataset?' + datasetId;
            //});

            // Delete button - stop propagation to prevent row click
            $(document).on('click', '.ql-btn-delete', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.handleDelete(e);
            }.bind(this));

            // Sync button - stop propagation to prevent row click
            $(document).on('click', '.ql-btn-sync', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.handleSync(e);
            }.bind(this));
            
            // Visibility select - stop propagation to prevent row click
            $(document).on('change', '.ql-privacy-toggle', function(e) {
                e.stopPropagation();
                this.handlePrivacyToggle(e);
            }.bind(this));

            // Modal events
            $(document).on('click', '.ql-modal-close, .ql-modal-btn-cancel', this.closeModal.bind(this));
            $(document).on('click', '.ql-modal-overlay', function(e) {
                if (e.target === this) {
                    this.closeModal();
                }
            }.bind(this));

            // File selection
            $(document).on('change', '#sync-file-input', this.handleFileSelect.bind(this));

            // Upload button in modal
            $(document).on('click', '.ql-modal-btn-upload', this.handleSyncUpload.bind(this));
            
            // Scheduled reports
            $(document).on('click', '.ql-run-report-btn', this.handleRunReportNow.bind(this));
            $(document).on('click', '.ql-delete-report-btn', this.handleDeleteReport.bind(this));

            // Monitors
            $(document).on('click', '.ql-run-monitor-btn', this.handleRunMonitorNow.bind(this));
            $(document).on('click', '.ql-delete-monitor-btn', this.handleDeleteMonitor.bind(this));
        },

        checkSuccess: function() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('uploaded') === '1') {
                const datasetId = urlParams.get('dataset_id');
                this.showSuccessBanner('Dataset uploaded successfully!', datasetId);
                
                // Remove query params from URL
                window.history.replaceState({}, document.title, '/ql-dashboard');
            }
            if (urlParams.get('deleted') === '1') {
                this.showSuccessBanner('Dataset deleted successfully!');
                window.history.replaceState({}, document.title, '/ql-dashboard');
            }
            if (urlParams.get('synced') === '1') {
                this.showSuccessBanner('Dataset synchronized successfully!');
                window.history.replaceState({}, document.title, '/ql-dashboard');
            }
            if (urlParams.get('report_saved') === '1') {
                this.showSuccessBanner('Report saved successfully!');
                window.history.replaceState({}, document.title, '/ql-dashboard');
            }
            if (urlParams.get('monitor_saved') === '1') {
                this.showSuccessBanner('Monitor saved successfully!');
                window.history.replaceState({}, document.title, '/ql-dashboard');
            }
        },

        showLoading: function() {
            $('#datasets-list').html(
                '<div class="ql-loading">' +
                        '<div class="ql-spinner"></div>' +
                        '<div class="ql-loading-text">Loading your datasets...</div>' +
                '</div>'
            );
        },

        updateDashboard: function(data) {
            console.log('Updating dashboard with data:', data);
            
            // Update user info
            try {
                if (data.user) {
                    console.log('Calling updateUserInfo...');
                    this.updateUserInfo(data.user);
                    console.log('updateUserInfo completed');
                } else {
                    console.error('No user data received');
                }
            } catch(e) {
                console.error('Error in updateUserInfo:', e);
            }
            
            // Update stats
            try {
                console.log('Calling updateStats...');
                this.updateStats(data);
                console.log('updateStats completed');
            } catch(e) {
                console.error('Error in updateStats:', e);
            }
            
            // Update datasets list
            try {
                console.log('Calling updateDatasets...');
                if (data.datasets !== undefined) {
                    this.updateDatasets(data.datasets);
                    console.log('updateDatasets completed');
                } else {
                    console.error('No datasets data received');
                }
            } catch(e) {
                console.error('Error in updateDatasets:', e);
            }
            
            // Load scheduled reports
            try {
                console.log('Loading scheduled reports...');
                this.loadScheduledReports();
                console.log('Scheduled reports loaded');
            } catch(e) {
                console.error('Error loading scheduled reports:', e);
            }

            // Load monitors
            try {
                console.log('Loading monitors...');
                this.loadMonitors();
                console.log('Monitors loaded');
            } catch(e) {
                console.error('Error loading monitors:', e);
            }

        },

        updateUserInfo: function(user) {
            // Update name
            $('.ql-user-name').text(user.first_name + ' ' + user.last_name);
            
            // Update email and provider badge
            let emailHtml = user.email;
            $('.ql-user-email').html(emailHtml);
            
            // Update avatar
            if (user.avatar && user.avatar !== null && user.avatar !== '') {
                $('.ql-user-avatar-placeholder').replaceWith(
                    '<img src="' + this.escapeHtml(user.avatar) + '" class="ql-user-avatar" alt="Avatar">'
                );
            } else {
                const initials = (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase();
                $('.ql-user-avatar-placeholder').text(initials);
            }
        },

        updateStats: function(data) {
            console.log('Updating stats:', {
                datasets: data.datasets_count,
            });
            
            $('#datasets-count').text(data.datasets_count || 0);
        },

        handlePrivacyToggle: function(e) {
            const select = $(e.target);
            const datasetId = select.data('id');
            const visibility = select.val();
            const prevVisibility = select.data('prev-visibility');

            select.prop('disabled', true);

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_set_dataset_visibility',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId,
                    visibility: visibility
                },
                success: function(response) {
                    if (response.success) {
                        select.data('prev-visibility', visibility);
                    } else {
                        select.val(prevVisibility);
                        alert('Failed to update dataset visibility: ' + (response.data?.message || 'Unknown error'));
                    }
                    select.prop('disabled', false);
                },
                error: function(xhr, status, error) {
                    console.error('Visibility toggle error:', error);
                    select.val(prevVisibility);
                    select.prop('disabled', false);
                    alert('Error updating dataset visibility. Please try again.');
                }
            });
        },
        
        updateDatasets: function(datasets) {
            console.log('Updating datasets, count:', datasets ? datasets.length : 0);
            
            const container = $('#datasets-list');
            
            if (!datasets || datasets.length === 0) {
                console.log('No datasets, showing empty state');
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
                        dataset_id: 19
                    },
                    success: function(response) {
                        if (response.success && response.data.dataset) {
                            const ds = response.data.dataset;
                            
                            const statusClass = 'ql-status-' + ds.status;
                            const statusText = ds.status.charAt(0).toUpperCase() + ds.status.slice(1);
                            const rowCount = parseInt(ds.row_count) || 0;
                            const createdDate = new Date(ds.created_at);
                            const formattedDate = createdDate.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                            });

                            let html = '<div class="ql-empty-state">' +
                                    '<div class="ql-empty-state-icon">📊</div>' +
                                    '<p>You haven\'t uploaded any dataset yet. You can use the sample dataset below to understand the capabilities of QuantumLayers. Please use the <a href="https://www.quantumlayers.com/ql-upload">update</a> or <a href="https://www.quantumlayers.com/ql-connect">connect</a> function above to load your first dataset. You can find more details on how to load your first dataset in our <a href="https://quantumlayers.com/help#uploading">user guide</a>.</p>' +
                                '</div>';
                            html += '<div class="ql-dataset-row" data-id="' + ds.id + '" data-source-type="' + self.escapeHtml(ds.source_type) + '">';
                            
                            // Left side - Dataset name and info
                            html += '  <div class="ql-dataset-left">';
                            html += '    <div class="ql-dataset-name-row">';
                            html += '      <div class="ql-dataset-name">' + self.escapeHtml(ds.name) + '</div>';
                            html += '      <span class="' + statusClass + '">' + statusText + '</span>';
                            html += '    </div>';
                            html += '    <div class="ql-dataset-info">';
                            html += '      <span>📈 ' + rowCount.toLocaleString() + ' rows</span>';
                            html += '      <span>📅 ' + formattedDate + '</span>';
                            html += '      <span>📁 ' + self.escapeHtml(ds.source_type) + '</span>';
                            html += '    </div>';
                            html += '  </div>';
                            
                            // Right side - Action buttons
                            html += '  <div class="ql-dataset-right">';
                            html += '    <a href="/ql-dataset?' + ds.id + '" class="ql-dataset-action-btn">Details</a>';
                            html += '    <a href="/ql-analytics?' + ds.id + '" class="ql-dataset-action-btn">Analytics</a>';
                            html += '    <a href="/ql-insights?' + ds.id + '" class="ql-dataset-action-btn">Insights</a>';
                            html += '  </div>';
                            
                            html += '</div></div>';

                            container.html(html);
                        } else {
                            container.html(
                                '<div class="ql-empty-state">' +
                                    '<div class="ql-empty-state-icon">📊</div>' +
                                    '<p>You haven\'t uploaded any dataset yet. Please use the update or connect function to load your first dataset.</p>' +
                                '</div>'
                            );
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error('Error loading sample dataset:', error);
                        // Show empty state without sample dataset on error
                        container.html(
                            '<div class="ql-empty-state">' +
                                '<div class="ql-empty-state-icon">📊</div>' +
                                '<p>You haven\'t uploaded any dataset yet. Please use the update or connect function to load your first dataset.</p>' +
                            '</div>'
                        );
                    }
                });

                return;
            }
            
            console.log('Rendering', datasets.length, 'datasets');
            let html = '<div class="ql-datasets-list">';
            
            datasets.forEach(function(ds) {
                console.log('Dataset:', ds);
                const statusClass = 'ql-status-' + ds.status;
                const statusText = ds.status.charAt(0).toUpperCase() + ds.status.slice(1);
                const rowCount = parseInt(ds.row_count) || 0;
                const createdDate = new Date(ds.created_at);
                const formattedDate = createdDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });

                html += '<div class="ql-dataset-row" data-id="' + ds.id + '" data-source-type="' + this.escapeHtml(ds.source_type) + '">';
                
                // Left side - Dataset name and info
                html += '  <div class="ql-dataset-left">';
                html += '    <div class="ql-dataset-name-row">';
                html += '      <div class="ql-dataset-name">' + this.escapeHtml(ds.name) + '</div>';
                html += '      <span class="' + statusClass + '">' + statusText + '</span>';
                html += '    </div>';
                html += '    <div class="ql-dataset-info">';
                html += '      <span>📈 ' + rowCount.toLocaleString() + ' rows</span>';
                html += '      <span>📅 ' + formattedDate + '</span>';
                html += '      <span>📁 ' + this.escapeHtml(ds.source_type) + '</span>';
                html += '    </div>';
                html += '  </div>';
                var vis = ds.visibility || 'private';
                html += '      <select class="ql-privacy-toggle" data-id="' + ds.id + '" data-prev-visibility="' + vis + '">';
                html += '        <option value="private"' + (vis==='private' ? ' selected' : '') + '>🔒 Private</option>';
                html += '        <option value="public"'  + (vis==='public'  ? ' selected' : '') + '>🌐 Public</option>';
                html += '        <option value="org"'     + (vis==='org'     ? ' selected' : '') + '>🏢 Org</option>';
                html += '        <option value="group"'   + (vis==='group'   ? ' selected' : '') + '>👥 Group</option>';
                html += '      </select>'; 
                
                // Right side - Action buttons
                html += '  <div class="ql-dataset-right">';
                html += '    <a href="/ql-dataset?' + ds.id + '" class="ql-dataset-action-btn">Details</a>';
                html += '    <a href="/ql-analytics?' + ds.id + '" class="ql-dataset-action-btn">Analytics</a>';
                html += '    <a href="/ql-insights?' + ds.id + '" class="ql-dataset-action-btn">Insights</a>';
                
                // Add Edit button based on dataset type
                const editUrl = '/ql-' + (ds.source_type == 'upload'?'upload':(ds.source_type == 'merged'?'merge':'connect')) + '?';
                html += '    <a title="Edit" href="' + editUrl + ds.id + '" class="ql-dataset-action-btn ql-btn-edit"> ✏️ </a>';
                html += '    <button title="Sync" class="ql-dataset-action-btn ql-btn-sync" data-id="' + ds.id + '" data-source-type="' + this.escapeHtml(ds.source_type) + '"> 🔄 </button>';
                html += '    <button title="Delete" class="ql-dataset-action-btn ql-btn-delete" data-id="' + ds.id + '"> 🗑 </button>';
                html += '  </div>';
                
                html += '</div>';
            }.bind(this));
            
            html += '</div>';
            
            // Add sync modal
            html += this.getSyncModalHtml();
            
            console.log('Setting HTML, length:', html.length);
            container.html(html);
        },

        getSyncModalHtml: function() {
            return '<div class="ql-modal-overlay" id="sync-modal">' +
                   '  <div class="ql-modal">' +
                   '    <div class="ql-modal-header">' +
                   '      <h3>Synchronize Dataset</h3>' +
                   '      <button class="ql-modal-close">&times;</button>' +
                   '    </div>' +
                   '    <div class="ql-modal-body">' +
                   '      <p>Upload a new CSV file to replace the current dataset data.</p>' +
                   '      <div class="ql-file-input-wrapper">' +
                   '        <input type="file" id="sync-file-input" accept=".csv" />' +
                   '        <label for="sync-file-input" class="ql-file-input-label">' +
                   '          📁 Click to select a CSV file' +
                   '        </label>' +
                   '        <div class="ql-file-selected" style="display:none;"></div>' +
                   '      </div>' +
                   '    </div>' +
                   '    <div class="ql-modal-footer">' +
                   '      <button class="ql-modal-btn ql-modal-btn-cancel">Cancel</button>' +
                   '      <button class="ql-modal-btn ql-modal-btn-upload" disabled>Upload & Sync</button>' +
                   '    </div>' +
                   '  </div>' +
                   '</div>';
        },

        handleDelete: function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const datasetId = $(e.currentTarget).data('id');
            
            if (!confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
                return;
            }

            // Disable button and show loading
            const btn = $(e.currentTarget);
            btn.prop('disabled', true).text('Deleting...');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_delete_dataset',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId
                },
                success: function(response) {
                    if (response.success) {
                        // Reload page with success message
                        window.location.href = '/ql-dashboard?deleted=1';
                    } else {
                        alert(response.data.message || 'Failed to delete dataset');
                        btn.prop('disabled', false).text('🗑');
                    }
                },
                error: function() {
                    alert('Failed to delete dataset');
                    btn.prop('disabled', false).text('🗑');
                }
            });
        },

        handleSync: function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const datasetId = $(e.currentTarget).data('id');
            const sourceType = $(e.currentTarget).data('source-type');
            
            this.syncingDatasetId = datasetId;

            // If it's an upload type, show file upload modal
            if (sourceType === 'upload') {
                this.showSyncModal();
            } else if (sourceType === 'google_sheet') {
                // For Google Sheets, we need to obtain fresh tokens first
                this.resyncGoogleSheet(datasetId, $(e.currentTarget));
            } else if (sourceType === 'sftp') {
                // For SFTP, call direct sync
                this.resyncSFTP(datasetId, $(e.currentTarget));
            } else if (sourceType === 'merged') {
                // For merged datasets, refresh row count and column stats from sources
                this.resyncMergedDataset(datasetId, $(e.currentTarget));
            } else {
                // For other types (db, api), call resync directly
                this.resyncConnection(datasetId, $(e.currentTarget));
            }
        },

        showSyncModal: function() {
            $('#sync-modal').addClass('active');
            // Reset form
            $('#sync-file-input').val('');
            $('.ql-file-selected').hide();
            $('.ql-modal-btn-upload').prop('disabled', true);
        },

        closeModal: function() {
            $('#sync-modal').removeClass('active');
            this.syncingDatasetId = null;
        },

        handleFileSelect: function(e) {
            const file = e.target.files[0];
            if (file) {
                $('.ql-file-selected').text('Selected: ' + file.name).show();
                $('.ql-modal-btn-upload').prop('disabled', false);
            } else {
                $('.ql-file-selected').hide();
                $('.ql-modal-btn-upload').prop('disabled', true);
            }
        },

        handleSyncUpload: function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('sync-file-input');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Please select a file');
                return;
            }

            // Disable upload button
            const btn = $(e.currentTarget);
            btn.prop('disabled', true).text('Uploading...');

            const formData = new FormData();
            formData.append('action', 'ql_resync_upload_dataset');
            formData.append('nonce', qlAuth.nonce);
            formData.append('dataset_id', this.syncingDatasetId);
            formData.append('csv_file', file);

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    if (response.success) {
                        // Close modal and reload with success message
                        this.closeModal();
                        window.location.href = '/ql-dashboard?synced=1';
                    } else {
                        alert(response.data.message || 'Failed to sync dataset');
                        btn.prop('disabled', false).text('🔄');
                    }
                }.bind(this),
                error: function() {
                    alert('Failed to sync dataset');
                    btn.prop('disabled', false).text('🔄');
                }
            });
        },
        
        /**
         * Load and display scheduled reports
         */
        loadScheduledReports: function() {
            const self = this;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_get_scheduled_reports',
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.updateScheduledReports(response.data.reports);
                    } else {
                        console.error('Failed to load scheduled reports:', response.data && response.data.message);
                    }
                },
                error: function() {
                    console.error('Failed to load scheduled reports');
                }
            });
        },
        
        /**
         * Update scheduled reports section
         */
        updateScheduledReports: function(reports) {
            const container = $('#scheduled-reports-list');
            
            if (!reports || reports.length === 0) {
                container.html(
                    '<div class="ql-empty-state">' +
                    '<p>No scheduled reports found.</p>' +
                    '</div>'
                );
                return;
            }
            
            let html = '';
            const self = this;
            
            reports.forEach(report => {
                const statusClass = report.is_active == 1 ? 'ql-status-ready' : 'ql-status-processing';
                const statusText = report.is_active == 1 ? '🟢 Active' : '⏸️ Paused';
                
                const nextRun = report.next_run ? new Date(report.next_run).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }) : 'Not scheduled';
                
                const lastRun = report.last_successful_run ? new Date(report.last_successful_run).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }) : 'Never';
                
                const frequencyText = report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1);
                
                html += '<div class="ql-dataset-row" data-report-id="' + report.id + '">';
                
                // Left side - Report info
                html += '  <div class="ql-dataset-left">';
                html += '    <div class="ql-dataset-name-row">';
                html += '      <div class="ql-dataset-name">' + self.escapeHtml(report.report_name) + '</div>';
                html += '      <span class="' + statusClass + '">' + statusText + '</span>';
                html += '    </div>';
                html += '    <div class="ql-dataset-info">';
                html += '      <span>📊 ' + report.dataset_count + ' dataset' + (report.dataset_count != 1 ? 's' : '') + '</span>';
                html += '      <span>🔄 ' + frequencyText + '</span>';
                html += '      <span>⏰ Next: ' + nextRun + '</span>';
                html += '      <span>✅ Last: ' + lastRun + '</span>';
                html += '    </div>';
                html += '  </div>';
                
                // Right side - Action buttons
                html += '  <div class="ql-dataset-right">';
                html += '    <a href="/ql-report?' + report.id + '" class="ql-dataset-action-btn">✏️ Edit</a>';
                html += '    <button class="ql-dataset-action-btn ql-run-report-btn" data-report-id="' + report.id + '">▶️ Run</button>';
                html += '    <button class="ql-dataset-action-btn ql-delete-report-btn" data-report-id="' + report.id + '">🗑️ Delete</button>';
                html += '  </div>';
                
                html += '</div>';
            });
            
            container.html(html);
        },
        
        /**
         * Handle run report now
         */
        handleRunReportNow: function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const reportId = $(e.target).data('report-id');
            const btn = $(e.target);
            const originalText = btn.text();
            
            if (!confirm('Run this report now and send to all recipients?')) {
                return;
            }
            
            btn.prop('disabled', true).text('Running...');
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_run_report_now',
                    report_id: reportId,
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        alert('Report generated and sent successfully!');
                        btn.prop('disabled', false).text(originalText);
                    } else {
                        alert('Error: ' + (response.data.message || 'Failed to run report'));
                        btn.prop('disabled', false).text(originalText);
                    }
                },
                error: function() {
                    alert('Failed to run report. Please try again.');
                    btn.prop('disabled', false).text(originalText);
                }
            });
        },
        
        /**
         * Handle delete report
         */
        handleDeleteReport: function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const reportId = $(e.target).data('report-id');
            const self = this;
            
            if (!confirm('Are you sure you want to delete this scheduled report? This cannot be undone.')) {
                return;
            }
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_delete_scheduled_report',
                    report_id: reportId,
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.showSuccessBanner('Report deleted successfully!');
                        self.loadScheduledReports(); // Reload list
                    } else {
                        alert('Error: ' + (response.data.message || 'Failed to delete report'));
                    }
                },
                error: function() {
                    alert('Failed to delete report. Please try again.');
                }
            });
        },

        /**
         * Load and display monitors
         */
        loadMonitors: function() {
            const self = this;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_get_monitors',
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.updateMonitors(response.data.monitors);
                    } else {
                        console.error('Failed to load monitors:', response.data && response.data.message);
                    }
                },
                error: function() {
                    console.error('Failed to load monitors');
                }
            });
        },

        /**
         * Update monitors section
         */
        updateMonitors: function(monitors) {
            const container = $('#monitors-list');

            if (!container.length) {
                return;
            }

            if (!monitors || monitors.length === 0) {
                container.html(
                    '<div class="ql-empty-state">' +
                    '<p>No monitors found.</p>' +
                    '</div>'
                );
                return;
            }

            let html = '';
            const self = this;

            monitors.forEach(monitor => {
                const statusClass = monitor.is_active == 1 ? 'ql-status-ready' : 'ql-status-processing';
                const statusText = monitor.is_active == 1 ? '🟢 Active' : '⏸️ Paused';

                const nextRun = monitor.next_run ? new Date(monitor.next_run).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }) : 'Not scheduled';

                const lastRun = monitor.last_successful_run ? new Date(monitor.last_successful_run).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                }) : 'Never';

                const frequencyText = monitor.frequency.charAt(0).toUpperCase() + monitor.frequency.slice(1);

                let changeBadge = '<span>— Never run</span>';
                if (monitor.last_successful_run) {
                    changeBadge = (monitor.last_run_had_changes == 1)
                        ? '<span>🔔 Changes detected</span>'
                        : '<span>✓ No changes</span>';
                }

                html += '<div class="ql-dataset-row" data-monitor-id="' + monitor.id + '">';

                // Left side - Monitor info
                html += '  <div class="ql-dataset-left">';
                html += '    <div class="ql-dataset-name-row">';
                html += '      <div class="ql-dataset-name">' + self.escapeHtml(monitor.monitor_name) + '</div>';
                html += '      <span class="' + statusClass + '">' + statusText + '</span>';
                html += '    </div>';
                html += '    <div class="ql-dataset-info">';
                html += '      <span>📊 ' + monitor.dataset_count + ' dataset' + (monitor.dataset_count != 1 ? 's' : '') + '</span>';
                html += '      <span>🔄 ' + frequencyText + '</span>';
                html += '      <span>⏰ Next: ' + nextRun + '</span>';
                html += '      <span>✅ Last: ' + lastRun + '</span>';
                html += '      ' + changeBadge;
                html += '    </div>';
                html += '  </div>';

                // Right side - Action buttons
                html += '  <div class="ql-dataset-right">';
                html += '    <a href="/ql-monitor?' + monitor.id + '" class="ql-dataset-action-btn">✏️ Edit</a>';
                html += '    <button class="ql-dataset-action-btn ql-run-monitor-btn" data-monitor-id="' + monitor.id + '">▶️ Run</button>';
                html += '    <button class="ql-dataset-action-btn ql-delete-monitor-btn" data-monitor-id="' + monitor.id + '">🗑️ Delete</button>';
                html += '  </div>';

                html += '</div>';
            });

            container.html(html);
        },

        /**
         * Handle run monitor now
         */
        handleRunMonitorNow: function(e) {
            e.preventDefault();
            e.stopPropagation();

            const monitorId = $(e.target).data('monitor-id');
            const btn = $(e.target);
            const originalText = btn.text();
            const self = this;

            if (!confirm('Run this monitor now and check for changes?')) {
                return;
            }

            btn.prop('disabled', true).text('Checking...');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_run_monitor_now',
                    monitor_id: monitorId,
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        const appeared = response.data.appeared_count || 0;
                        const disappeared = response.data.disappeared_count || 0;
                        if (appeared || disappeared) {
                            alert('Monitor checked: ' + appeared + ' appeared, ' + disappeared + ' disappeared. Alert email sent.');
                        } else {
                            alert('Monitor checked: no changes detected.');
                        }
                        btn.prop('disabled', false).text(originalText);
                        self.loadMonitors();
                    } else {
                        alert('Error: ' + (response.data.message || 'Failed to run monitor'));
                        btn.prop('disabled', false).text(originalText);
                    }
                },
                error: function() {
                    alert('Failed to run monitor. Please try again.');
                    btn.prop('disabled', false).text(originalText);
                }
            });
        },

        /**
         * Handle delete monitor
         */
        handleDeleteMonitor: function(e) {
            e.preventDefault();
            e.stopPropagation();

            const monitorId = $(e.target).data('monitor-id');
            const self = this;

            if (!confirm('Are you sure you want to delete this monitor? This cannot be undone.')) {
                return;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_delete_monitor',
                    monitor_id: monitorId,
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.showSuccessBanner('Monitor deleted successfully!');
                        self.loadMonitors(); // Reload list
                    } else {
                        alert('Error: ' + (response.data.message || 'Failed to delete monitor'));
                    }
                },
                error: function() {
                    alert('Failed to delete monitor. Please try again.');
                }
            });
        },


        resyncConnection: function(datasetId, btn, accessToken, refreshToken) {
            if (!confirm('Synchronize this dataset with the latest data from its source?')) {
                return;
            }

            // Disable button and show loading
            btn.prop('disabled', true).text('Syncing...');

            const ajaxData = {
                action: 'ql_resync_connection',
                nonce: qlAuth.nonce,
                dataset_id: datasetId
            };

            // Add tokens if provided (for Google Sheets)
            if (accessToken) {
                ajaxData.access_token = accessToken;
            }
            if (refreshToken) {
                ajaxData.refresh_token = refreshToken;
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
                        // Reload page with success message
                        window.location.href = '/ql-dashboard?synced=1';
                    } else {
                        alert(response.data.message || 'Failed to sync dataset');
                        btn.prop('disabled', false).text('🔄');
                    }
                },
                error: function() {
                    alert('Failed to sync dataset');
                    btn.prop('disabled', false).text('🔄');
                }
            });
        },

        resyncMergedDataset: function(datasetId, btn) {
            if (!confirm('Refresh this merged dataset\'s row count and column data from its source datasets?')) {
                return;
            }

            // Disable button and show loading
            btn.prop('disabled', true).text('Syncing...');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_sync_merged_dataset',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId
                },
                success: function(response) {
                    if (response.success) {
                        // Reload page with success message
                        window.location.href = '/ql-dashboard?synced=1';
                    } else {
                        alert(response.data.message || 'Failed to sync merged dataset');
                        btn.prop('disabled', false).text('🔄');
                    }
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.data?.message || 'Failed to sync merged dataset';
                    alert(errorMsg);
                    btn.prop('disabled', false).text('🔄');
                }
            });
        },

        resyncSFTP: function(datasetId, btn) {
            if (!confirm('Synchronize this SFTP dataset with the latest file from the server?')) {
                return;
            }

            // Disable button and show loading
            btn.prop('disabled', true).text('Syncing...');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_sync_sftp_dataset',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId
                },
                success: function(response) {
                    if (response.success) {
                        // Reload page with success message
                        window.location.href = '/ql-dashboard?synced=1';
                    } else {
                        alert(response.data.message || 'Failed to sync SFTP dataset');
                        btn.prop('disabled', false).text('🔄');
                    }
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.data?.message || 'Failed to sync SFTP dataset';
                    alert(errorMsg);
                    btn.prop('disabled', false).text('🔄');
                }
            });
        },

        resyncGoogleSheet: function(datasetId, btn) {
            const self = this;
            
            // Check if we have stored tokens in session
            const storedToken = sessionStorage.getItem('ql_google_token');
            const storedRefreshToken = sessionStorage.getItem('ql_google_refresh_token');
            const storedExpiry = sessionStorage.getItem('ql_google_token_expiry');
            
            // If we have valid tokens, use them directly
            if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
                this.resyncConnection(datasetId, btn, storedToken, storedRefreshToken);
                return;
            }
            
            // If we have a refresh token but access token is expired, refresh it
            if (storedRefreshToken) {
                this.refreshGoogleTokenForSync(storedRefreshToken, datasetId, btn);
                return;
            }
            
            // Otherwise, we need to get new tokens via OAuth
            // Prompt user to re-authenticate
            if (confirm('Google authentication required to sync this dataset. Authenticate now?')) {
                this.triggerGoogleReauth(datasetId, btn);
            }
        },

        refreshGoogleTokenForSync: function(refreshToken, datasetId, btn) {
            const self = this;
            
            // Disable button and show loading
            btn.prop('disabled', true).text('Refreshing...');
            
            $.ajax({
                url: '/wp-admin/admin-ajax.php?action=ql_google_refresh_token',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    refresh_token: refreshToken
                }),
                success: function(data) {
                    const accessToken = data.access_token;
                    
                    // Update session storage
                    sessionStorage.setItem('ql_google_token', accessToken);
                    
                    if (data.expires_in) {
                        const expiryTime = Date.now() + (data.expires_in * 1000);
                        sessionStorage.setItem('ql_google_token_expiry', expiryTime);
                    }
                    
                    // Now sync with the fresh tokens
                    self.resyncConnection(datasetId, btn, accessToken, refreshToken);
                },
                error: function(xhr) {
                    console.error('Token refresh failed:', xhr);
                    
                    // Clear stored tokens
                    sessionStorage.removeItem('ql_google_token');
                    sessionStorage.removeItem('ql_google_refresh_token');
                    sessionStorage.removeItem('ql_google_email');
                    sessionStorage.removeItem('ql_google_token_expiry');
                    
                    // Re-enable button
                    btn.prop('disabled', false).text('🔄');
                    
                    // Trigger re-authentication flow
                    if (confirm('Google authentication expired. Re-authenticate now to sync this dataset?')) {
                        self.triggerGoogleReauth(datasetId, btn);
                    }
                }
            });
        },

        triggerGoogleReauth: function(datasetId, btn) {
            const self = this;
            
            // Check if Google SDK is available
            if (!window.google || !window.google.accounts) {
                alert('Google authentication not available. Please visit the Google Sheets connection page to authenticate, then try syncing again.');
                return;
            }
            
            // Check if we need to initialize the code client
            if (!this.googleCodeClient) {
                if (!qlAuth.google_client_id) {
                    alert('Google Client ID not configured. Please contact support.');
                    return;
                }
                
                // Initialize OAuth2 CODE client
                this.googleCodeClient = google.accounts.oauth2.initCodeClient({
                    client_id: qlAuth.google_client_id,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    ux_mode: 'popup',
                    callback: function(response) {
                        self.handleGoogleReauthResponse(response, datasetId, btn);
                    }
                });
            }
            
            // Show loading state
            btn.prop('disabled', true).text('Authenticating...');
            
            // Request authorization code
            this.googleCodeClient.requestCode();
        },

        handleGoogleReauthResponse: function(response, datasetId, btn) {
            const self = this;
            
            if (response.error) {
                console.error('OAuth error:', response);
                alert('Google authentication failed: ' + response.error);
                btn.prop('disabled', false).text('🔄');
                return;
            }
            
            // Exchange authorization code for tokens
            $.ajax({
                url: '/wp-admin/admin-ajax.php?action=ql_google_exchange_code',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    code: response.code
                }),
                success: function(data) {
                    const accessToken = data.data.access_token;
                    const refreshToken = data.data.refresh_token;
                    
                    // Store tokens in session storage
                    sessionStorage.setItem('ql_google_token', accessToken);
                    if (refreshToken) {
                        sessionStorage.setItem('ql_google_refresh_token', refreshToken);
                    }
                    
                    if (data.data.expires_in) {
                        const expiryTime = Date.now() + (data.data.expires_in * 1000);
                        sessionStorage.setItem('ql_google_token_expiry', expiryTime);
                    }
                    
                    // Get user email
                    $.ajax({
                        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
                        headers: {
                            'Authorization': 'Bearer ' + accessToken
                        },
                        success: function(userInfo) {
                            sessionStorage.setItem('ql_google_email', userInfo.email);
                        }
                    });
                    
                    // Now proceed with sync using the new tokens
                    self.resyncConnection(datasetId, btn, accessToken, refreshToken);
                },
                error: function(xhr) {
                    console.error('Token exchange failed:', xhr);
                    alert('Failed to obtain access token. Please try again.');
                    btn.prop('disabled', false).text('🔄');
                }
            });
        },

        showSuccessBanner: function(message, datasetId) {
            let banner = '<div class="ql-success-banner">';
            banner += '  <div>';
            banner += '    <strong>✅ Success!</strong> ' + this.escapeHtml(message);
            if (datasetId) {
                banner += ' <a href="/ql-dataset?' + datasetId + '">View dataset</a>';
            }
            banner += '  </div>';
            banner += '  <span class="ql-close">&times;</span>';
            banner += '</div>';
            
            $('.ql-dashboard-wrapper').prepend(banner);
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
                    action: 'ql_user_signout'
                },
                success: function(response) {
                    if (response.success) {
                        window.location.href = '/ql-login?logged_out=1';
                    }
                },
                error: function() {
                    // Redirect anyway
                    window.location.href = '/ql-login?logged_out=1';
                }
            });
        },

        escapeHtml: function(text) {
            if (!text) return '';
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        QLDashboard.init();
    });

    // Expose to global scope
    window.QLDashboard = QLDashboard;

})(jQuery);
