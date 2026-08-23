/**
 * QuantumLayers Upload Page JavaScript
 *
 * Two upload flows on one page, switched via tabs:
 *  - CSV  (QLUpload)       – unchanged, single-step upload.
 *  - Excel (QLUploadExcel) – two-step: pick a file, inspect it (sheet list +
 *    autodetected header row + preview), let the user adjust the sheet /
 *    header row, then finalize the upload.
 */

(function($) {
    'use strict';

    // ========================================
    // TAB SWITCHING
    // ========================================

    const QLUploadTabs = {
        activeTab: 'csv',

        init: function() {
            if (!$('.ql-upload-tabs').length) return;
            this.bindEvents();
        },

        bindEvents: function() {
            $(document).on('click', '.ql-upload-tab', this.handleTabClick.bind(this));
        },

        handleTabClick: function(e) {
            const tab = $(e.currentTarget).data('tab');
            this.switchTo(tab);
        },

        switchTo: function(tab) {
            if (!tab) return;
            this.activeTab = tab;

            $('.ql-upload-tab').removeClass('active');
            $('.ql-upload-tab[data-tab="' + tab + '"]').addClass('active');

            $('.ql-upload-tab-panel').removeClass('active').hide();
            $('.ql-upload-tab-panel[data-tab-panel="' + tab + '"]').addClass('active').show();
        }
    };

    const QLUpload = {
        form: null,
        fileInput: null,
        dropZone: null,
        fileInfo: null,
        uploadBtn: null,
        progressDiv: null,
        progressFill: null,
        progressText: null,
        editMode: false,
        editDatasetId: null,

        init: function() {
            this.cacheElements();
            this.bindEvents();
            this.checkAuth();
            this.checkEditMode();
        },

        checkAuth: function() {
            const self = this;

            // Check if auth script is loaded
            if (typeof qlAuth === 'undefined') {
                console.error('qlAuth not loaded');
                window.location.href = '/ql-login';
                return;
            }

            // Check authentication status asynchronously
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
                    console.log('Auth check response:', response);
                    if (!response.success || !response.data.logged_in) {
                        console.log('User not logged in, redirecting...');
                        window.location.href = '/ql-login?redirect=' + encodeURIComponent(window.location.pathname);
                    } else {
                        console.log('User authenticated:', response.data.user);
                        // User is authenticated, form is ready to use
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Auth check failed:', error);
                    // Don't redirect on error, let user try to upload
                }
            });
        },

        cacheElements: function() {
            this.form = $('#ql-upload-form');
            this.fileInput = $('#csv_file');
            this.dropZone = $('#file-drop-zone');
            this.fileInfo = $('#file-info');
            this.uploadBtn = $('#upload-btn');
            this.progressDiv = $('#upload-progress');
            this.progressFill = $('#progress-fill');
            this.progressText = $('#progress-text');
        },

        bindEvents: function() {
            // Click to browse
            this.dropZone.on('click', this.handleDropZoneClick.bind(this));

            // File selected
            this.fileInput.on('change', this.handleFileSelect.bind(this));

            // Drag and drop events
            this.dropZone.on('dragover', this.handleDragOver.bind(this));
            this.dropZone.on('dragleave', this.handleDragLeave.bind(this));
            this.dropZone.on('drop', this.handleDrop.bind(this));

            // Form submission
            this.form.on('submit', this.handleSubmit.bind(this));
        },

        handleDropZoneClick: function(e) {
            if ($(e.target).closest('input[type="file"]').length === 0) {
                this.fileInput.click();
            }
        },

        handleFileSelect: function(e) {
            const file = e.target.files[0];
            this.validateAndDisplayFile(file);
        },

        handleDragOver: function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.dropZone.addClass('drag-over');
        },

        handleDragLeave: function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.dropZone.removeClass('drag-over');
        },

        handleDrop: function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.dropZone.removeClass('drag-over');

            const files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                this.fileInput[0].files = files;
                this.validateAndDisplayFile(files[0]);
            }
        },

        validateAndDisplayFile: function(file) {
            if (!file) return;

            // Validate file type
            if (!file.name.toLowerCase().endsWith('.csv')) {
                this.showError('Please upload a CSV file');
                this.fileInput.val('');
                return;
            }

            // Validate file size (50MB)
            const maxSize = 50 * 1024 * 1024;
            if (file.size > maxSize) {
                this.showError('File is too large. Maximum size is 50MB.');
                this.fileInput.val('');
                return;
            }

            // Show file info
            this.fileInfo.html(
                '<strong>Selected file:</strong> ' + this.escapeHtml(file.name) + '<br>' +
                '<strong>Size:</strong> ' + this.formatBytes(file.size) + '<br>' +
                '<strong>Type:</strong> CSV'
            ).addClass('show');
        },

        handleSubmit: function(e) {
            e.preventDefault();

            // In edit mode, file is optional
            if (!this.editMode) {
                // Validate form for new upload
                if (!this.fileInput[0].files.length) {
                    this.showError('Please select a file to upload');
                    return;
                }
            }

            const datasetName = $('#dataset_name').val().trim();
            if (!datasetName) {
                this.showError('Please enter a dataset name');
                return;
            }

            const formData = new FormData(this.form[0]);

            if (this.editMode) {
                // Update existing dataset
                formData.append('action', 'ql_update_upload_dataset');
                formData.append('dataset_id', this.editDatasetId);
            } else {
                // Create new dataset
                formData.append('action', 'ql_upload_dataset');
            }

            formData.append('nonce', qlAuth.nonce);

            // Disable form
            const buttonText = this.editMode ? 'Updating...' : 'Uploading...';
            this.uploadBtn.prop('disabled', true).text(buttonText);
            this.progressDiv.addClass('show');
            this.progressFill.css('width', '0%');
            this.progressText.text(this.editMode ? 'Updating dataset...' : 'Preparing upload...');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: formData,
                processData: false,
                contentType: false,
                xhr: this.createProgressXHR.bind(this),
                success: this.handleUploadSuccess.bind(this),
                error: this.handleUploadError.bind(this)
            });
        },

        uet_report_conversion: function () {
            window.uetq = window.uetq || [];
            window.uetq.push('event', 'dataset_upload', {});
        },

        createProgressXHR: function() {
            const xhr = new window.XMLHttpRequest();
            const self = this;

            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    self.progressFill.css('width', percent + '%');

                    if (percent < 100) {
                        const action = self.editMode ? 'Updating' : 'Uploading';
                        self.progressText.text(action + ': ' + percent + '%');
                    } else {
                        self.progressText.text('Processing data...');
                    }
                }
            }, false);

            return xhr;
        },

        handleUploadSuccess: function(response) {
            console.log('Upload response:', response);

            if (response.success) {
                this.progressFill.css('width', '100%');

                if (this.editMode) {
                    this.progressText.html('✅ Dataset updated successfully!');
                    this.showSuccess('Dataset updated successfully! Redirecting to dashboard...');

                    // Redirect after 2 seconds
                    setTimeout(function() {
                        window.location.href = '/ql-dashboard?updated=1';
                    }, 2000);
                } else {
                    this.progressText.html('✅ Upload successful! Processing data...');
                    this.showSuccess('Dataset uploaded successfully! Redirecting to dashboard...');

                    // Google Ads conversion — dataset upload
                    if (typeof gtag === 'function') {
                        gtag('event', 'conversion', {
                            'send_to': 'AW-17755227694/jTScCI-Sr44cEK6MrZJC'
                        });
                    }

                    // Microsoft Ads conversion — dataset upload
                    this.uet_report_conversion();

                    // Redirect after 2 seconds
                    setTimeout(function() {
                        window.location.href = '/ql-dashboard?uploaded=1&dataset_id=' + response.data.dataset_id;
                    }, 2000);
                }
            } else {
                const message = response.data && response.data.message ? response.data.message :
                               (this.editMode ? 'Update failed' : 'Upload failed');
                this.showError(message);
                this.resetForm();
            }
        },

        handleUploadError: function(xhr, status, error) {
            console.error('Upload error:', xhr.responseText);

            let errorMsg = this.editMode ? 'An error occurred during update' : 'An error occurred during upload';

            if (xhr.responseText) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.data && response.data.message) {
                        errorMsg = response.data.message;
                    }
                } catch(e) {
                    errorMsg = xhr.responseText.substring(0, 100);
                }
            }

            this.showError(errorMsg);
            this.resetForm();
        },

        resetForm: function() {
            const buttonText = this.editMode ? 'Update Dataset' : 'Upload & Analyze';
            this.uploadBtn.prop('disabled', false).text(buttonText);
            this.progressDiv.removeClass('show');
            this.progressFill.css('width', '0%');
        },

        // ========================================
        // EDIT MODE FUNCTIONALITY
        // ========================================

        checkEditMode: function() {
            const urlParams = new URLSearchParams(window.location.search);
            const datasetId = urlParams.keys().next().value || window.location.search.replace('?', '');

            if (datasetId && !isNaN(datasetId)) {
                this.editMode = true;
                this.editDatasetId = parseInt(datasetId);
                this.loadDatasetData();
            }
        },

        loadDatasetData: function() {
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
                        const file = response.data.file;

                        // Verify it's an upload type dataset
                        if (dataset.source_type !== 'upload') {
                            self.showError('This dataset is not an uploaded file. Please use the appropriate connection page.');
                            setTimeout(function() {
                                window.location.href = '/ql-dashboard';
                            }, 3000);
                            return;
                        }

                        // Excel-backed datasets are edited from the Excel tab instead.
                        if (file && file.file_format === 'xlsx') {
                            QLUploadTabs.switchTo('excel');
                            $('.ql-upload-tab').prop('disabled', true).css('pointer-events', 'none');
                            QLUploadExcel.enterEditMode(dataset, file);
                            return;
                        }

                        // Populate form fields
                        $('#dataset_name').val(dataset.name || '');

                        // Set visibility select
                        $('#ql-upload-form select[name="visibility"]').val(dataset.visibility || 'private');

                        // Update UI for edit mode
                        self.updateUIForEditMode(dataset);
                    } else {
                        self.showError('Failed to load dataset details');
                        setTimeout(function() {
                            window.location.href = '/ql-dashboard';
                        }, 3000);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Failed to load dataset:', error);
                    self.showError('Failed to load dataset details');
                    setTimeout(function() {
                        window.location.href = '/ql-dashboard';
                    }, 3000);
                }
            });
        },

        updateUIForEditMode: function(dataset) {
            // Change button text
            this.uploadBtn.text('Update Dataset');
            this.fileInput.removeAttr('required');

            // Update page title or heading if it exists
            const pageTitle = $('.ql-upload-box h2');
            if (pageTitle.length) {
                pageTitle.text('Update Dataset: ' + dataset.name);
            }

            // Make file input optional - update drop zone text
            const dropZoneText = this.dropZone.find('p');
            if (dropZoneText.length) {
                dropZoneText[1].innerHTML =
                    '<strong>Optional:</strong> Upload a new CSV file to replace the existing data<br>';
            }

            // Disable the Excel tab while editing a CSV dataset.
            $('.ql-upload-tab[data-tab="excel"]').prop('disabled', true).css('pointer-events', 'none');
        },

        // ========================================
        // UTILITY FUNCTIONS
        // ========================================

        showError: function(message) {
            const errorDiv = $('<div class="ql-upload-error show">' + this.escapeHtml(message) + '</div>');
            $('.ql-upload-box').prepend(errorDiv);

            setTimeout(function() {
                errorDiv.fadeOut(function() {
                    $(this).remove();
                });
            }, 5000);
        },

        showSuccess: function(message) {
            const successDiv = $('<div class="ql-upload-success show">' + this.escapeHtml(message) + '</div>');
            $('.ql-upload-box').prepend(successDiv);
        },

        formatBytes: function(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';

            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        },

        escapeHtml: function(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, function(m) { return map[m]; });
        }
    };

    // ========================================
    // EXCEL UPLOAD FLOW
    // ========================================

    const QLUploadExcel = {
        form: null,
        fileInput: null,
        dropZone: null,
        fileInfo: null,
        inspectPanel: null,
        sheetSelect: null,
        headerRowInput: null,
        previewTable: null,
        uploadBtn: null,
        progressDiv: null,
        progressFill: null,
        progressText: null,

        editMode: false,
        editDatasetId: null,

        token: null,
        selectedFile: null,
        inspecting: false,

        init: function() {
            if (!$('#ql-upload-excel-form').length) return;
            this.cacheElements();
            this.bindEvents();
        },

        cacheElements: function() {
            this.form = $('#ql-upload-excel-form');
            this.fileInput = $('#excel_file');
            this.dropZone = $('#excel-file-drop-zone');
            this.fileInfo = $('#excel-file-info');
            this.inspectPanel = $('#excel-inspect-panel');
            this.sheetSelect = $('#excel_sheet_name');
            this.headerRowInput = $('#excel_header_row');
            this.previewTable = $('#excel-preview-table');
            this.uploadBtn = $('#excel-upload-btn');
            this.progressDiv = $('#excel-upload-progress');
            this.progressFill = $('#excel-progress-fill');
            this.progressText = $('#excel-progress-text');
        },

        bindEvents: function() {
            this.dropZone.on('click', this.handleDropZoneClick.bind(this));
            this.fileInput.on('change', this.handleFileSelect.bind(this));

            this.dropZone.on('dragover', this.handleDragOver.bind(this));
            this.dropZone.on('dragleave', this.handleDragLeave.bind(this));
            this.dropZone.on('drop', this.handleDrop.bind(this));

            this.sheetSelect.on('change', this.handleSheetChange.bind(this));
            this.headerRowInput.on('change', this.handleHeaderRowChange.bind(this));

            this.form.on('submit', this.handleSubmit.bind(this));
        },

        handleDropZoneClick: function(e) {
            if ($(e.target).closest('input[type="file"]').length === 0) {
                this.fileInput.click();
            }
        },

        handleFileSelect: function(e) {
            const file = e.target.files[0];
            this.processSelectedFile(file);
        },

        handleDragOver: function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.dropZone.addClass('drag-over');
        },

        handleDragLeave: function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.dropZone.removeClass('drag-over');
        },

        handleDrop: function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.dropZone.removeClass('drag-over');

            const files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                this.fileInput[0].files = files;
                this.processSelectedFile(files[0]);
            }
        },

        processSelectedFile: function(file) {
            if (!file) return;

            const name = file.name.toLowerCase();
            if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm') && !name.endsWith('.xls')) {
                this.showError('Please upload an Excel file (.xlsx, .xlsm, or .xls)');
                this.fileInput.val('');
                return;
            }

            // Validate file size (1GB hard client-side ceiling; server enforces the plan limit)
            const maxSize = 1000 * 1024 * 1024;
            if (file.size > maxSize) {
                this.showError('File is too large.');
                this.fileInput.val('');
                return;
            }

            this.selectedFile = file;
            this.token = null;
            this.inspectPanel.removeClass('show');

            // A newly selected file needs to be (re-)inspected before it can be submitted,
            // unless we're editing and the user hasn't chosen a replacement file yet.
            if (!this.editMode) {
                this.uploadBtn.prop('disabled', true);
            }

            this.fileInfo.html(
                '<strong>Selected file:</strong> ' + QLUpload.escapeHtml(file.name) + '<br>' +
                '<strong>Size:</strong> ' + QLUpload.formatBytes(file.size) + '<br>' +
                '<strong>Type:</strong> Excel'
            ).addClass('show');

            this.inspectFile();
        },

        inspectFile: function() {
            if (!this.selectedFile || this.inspecting) return;
            const self = this;

            this.inspecting = true;
            this.showInspecting('Reading workbook…');

            const formData = new FormData();
            formData.append('action', 'ql_inspect_excel_file');
            formData.append('nonce', qlAuth.nonce);
            formData.append('excel_file', this.selectedFile);

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    self.inspecting = false;
                    if (response.success) {
                        self.token = response.data.token;
                        self.renderInspectResult(response.data);
                    } else {
                        self.showError((response.data && response.data.message) || 'Could not read this Excel file');
                        self.inspectPanel.removeClass('show');
                    }
                },
                error: function(xhr) {
                    self.inspecting = false;
                    self.showError(self.extractError(xhr, 'Could not read this Excel file'));
                    self.inspectPanel.removeClass('show');
                }
            });
        },

        handleSheetChange: function() {
            this.requestPreview(this.sheetSelect.val(), null);
        },

        handleHeaderRowChange: function() {
            let headerRow = parseInt(this.headerRowInput.val(), 10);
            if (!headerRow || headerRow < 1) headerRow = 1;
            this.headerRowInput.val(headerRow);
            this.requestPreview(this.sheetSelect.val(), headerRow);
        },

        requestPreview: function(sheetName, headerRowOverride) {
            if (!this.token) return;
            const self = this;

            this.showInspecting('Loading preview…');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: {
                    action: 'ql_excel_sheet_preview',
                    nonce: qlAuth.nonce,
                    token: this.token,
                    sheet_name: sheetName,
                    header_row: headerRowOverride || 0
                },
                success: function(response) {
                    if (response.success) {
                        self.renderInspectResult(response.data, sheetName);
                    } else {
                        self.showError((response.data && response.data.message) || 'Could not load that sheet');
                    }
                },
                error: function(xhr) {
                    self.showError(self.extractError(xhr, 'Could not load that sheet'));
                }
            });
        },

        renderInspectResult: function(data, preserveSheetSelection) {
            this.inspectPanel.addClass('show').removeClass('ql-excel-loading');

            // Sheet dropdown
            this.sheetSelect.empty();
            (data.sheets || []).forEach(function(name) {
                const opt = $('<option></option>').val(name).text(name);
                this.sheetSelect.append(opt);
            }, this);
            this.sheetSelect.val(preserveSheetSelection || data.sheet_name);

            // Header row
            this.headerRowInput.val(data.header_row);

            // Preview table
            this.renderPreviewTable(data.headers || [], data.preview_rows || []);

            const rowNote = $('#excel-row-count-note');
            if (rowNote.length) {
                rowNote.text(
                    (data.total_data_rows || 0).toLocaleString() +
                    ' data row(s) detected below the header row.'
                );
            }

            this.uploadBtn.prop('disabled', false);
        },

        renderPreviewTable: function(headers, rows) {
            const table = this.previewTable;
            table.empty();

            if (!headers.length) {
                table.append('<tr><td class="ql-excel-preview-empty">No data to preview</td></tr>');
                return;
            }

            const thead = $('<thead></thead>');
            const headRow = $('<tr></tr>');
            headers.forEach(function(h) {
                headRow.append($('<th></th>').text(h));
            });
            thead.append(headRow);
            table.append(thead);

            const tbody = $('<tbody></tbody>');
            rows.forEach(function(row) {
                const tr = $('<tr></tr>');
                row.forEach(function(cell) {
                    tr.append($('<td></td>').text(cell));
                });
                tbody.append(tr);
            });
            table.append(tbody);
        },

        showInspecting: function(message) {
            this.inspectPanel.addClass('show').addClass('ql-excel-loading');
            const status = $('#excel-inspect-status');
            if (status.length) status.text(message);
        },

        // ========================================
        // FINAL SUBMIT
        // ========================================

        handleSubmit: function(e) {
            e.preventDefault();

            if (!this.editMode && !this.token) {
                this.showError('Please select an Excel file first');
                return;
            }

            const datasetName = $('#excel_dataset_name').val().trim();
            if (!datasetName) {
                this.showError('Please enter a dataset name');
                return;
            }

            const self = this;
            const formData = new FormData(this.form[0]);

            if (this.token) {
                formData.append('token', this.token);
                formData.append('sheet_name', this.sheetSelect.val());
                formData.append('header_row', this.headerRowInput.val());
            }

            if (this.editMode) {
                formData.append('action', 'ql_update_upload_excel_dataset');
                formData.append('dataset_id', this.editDatasetId);
            } else {
                formData.append('action', 'ql_upload_excel_dataset');
            }

            formData.append('nonce', qlAuth.nonce);

            const buttonText = this.editMode ? 'Updating...' : 'Uploading...';
            this.uploadBtn.prop('disabled', true).text(buttonText);
            this.progressDiv.addClass('show');
            this.progressFill.css('width', '60%');
            this.progressText.text(this.editMode ? 'Updating dataset…' : 'Converting sheet & analyzing…');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: formData,
                processData: false,
                contentType: false,
                success: this.handleUploadSuccess.bind(this),
                error: this.handleUploadError.bind(this)
            });
        },

        handleUploadSuccess: function(response) {
            if (response.success) {
                this.progressFill.css('width', '100%');

                if (this.editMode) {
                    this.progressText.html('✅ Dataset updated successfully!');
                    this.showSuccess('Dataset updated successfully! Redirecting to dashboard...');
                    setTimeout(function() {
                        window.location.href = '/ql-dashboard?updated=1';
                    }, 2000);
                } else {
                    this.progressText.html('✅ Upload successful! Processing data...');
                    this.showSuccess('Dataset uploaded successfully! Redirecting to dashboard...');

                    if (typeof gtag === 'function') {
                        gtag('event', 'conversion', {
                            'send_to': 'AW-17755227694/jTScCI-Sr44cEK6MrZJC'
                        });
                    }
                    QLUpload.uet_report_conversion();

                    setTimeout(function() {
                        window.location.href = '/ql-dashboard?uploaded=1&dataset_id=' + response.data.dataset_id;
                    }, 2000);
                }
            } else {
                const message = response.data && response.data.message ? response.data.message :
                               (this.editMode ? 'Update failed' : 'Upload failed');
                this.showError(message);
                this.resetForm();
            }
        },

        handleUploadError: function(xhr) {
            this.showError(this.extractError(xhr, this.editMode ? 'An error occurred during update' : 'An error occurred during upload'));
            this.resetForm();
        },

        resetForm: function() {
            const buttonText = this.editMode ? 'Update Dataset' : 'Upload & Analyze';
            this.uploadBtn.prop('disabled', false).text(buttonText);
            this.progressDiv.removeClass('show');
            this.progressFill.css('width', '0%');
        },

        // ========================================
        // EDIT MODE
        // ========================================

        enterEditMode: function(dataset, file) {
            this.editMode = true;
            this.editDatasetId = dataset.id;

            $('#excel_dataset_name').val(dataset.name || '');
            $('#ql-upload-excel-form select[name="visibility"]').val(dataset.visibility || 'private');

            this.uploadBtn.text('Update Dataset').prop('disabled', false);
            this.fileInput.removeAttr('required');

            const pageTitle = $('#ql-upload-excel-form').closest('.ql-upload-box').find('h2, h3').first();
            if (pageTitle.length) {
                pageTitle.text('Update Dataset: ' + dataset.name);
            }

            if (file) {
                const note = $('<div class="ql-excel-current-file"></div>').html(
                    '<strong>Current sheet:</strong> ' + QLUpload.escapeHtml(file.sheet_name || '') +
                    ' &nbsp;•&nbsp; <strong>Header row:</strong> ' + (file.header_row || 1) + '<br>' +
                    '<small>Upload a new Excel file below to replace the existing data, or leave blank to only change the name/visibility.</small>'
                );
                this.dropZone.before(note);
            }
        },

        // ========================================
        // UTILITY
        // ========================================

        showError: function(message) {
            const errorDiv = $('<div class="ql-upload-error show">' + QLUpload.escapeHtml(message) + '</div>');
            $('.ql-upload-box').first().prepend(errorDiv);

            setTimeout(function() {
                errorDiv.fadeOut(function() { $(this).remove(); });
            }, 5000);
        },

        showSuccess: function(message) {
            const successDiv = $('<div class="ql-upload-success show">' + QLUpload.escapeHtml(message) + '</div>');
            $('.ql-upload-box').first().prepend(successDiv);
        },

        extractError: function(xhr, fallback) {
            if (xhr && xhr.responseText) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.data && response.data.message) {
                        return response.data.message;
                    }
                } catch (e) {
                    return xhr.responseText.substring(0, 100);
                }
            }
            return fallback;
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        QLUploadTabs.init();
        QLUpload.init();
        QLUploadExcel.init();
    });

    // Expose to global scope if needed
    window.QLUpload = QLUpload;
    window.QLUploadExcel = QLUploadExcel;
    window.QLUploadTabs = QLUploadTabs;

})(jQuery);
