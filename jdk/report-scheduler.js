/**
 * QuantumLayers Report Scheduler - Frontend JavaScript
 * Uses existing QuantumLayers endpoints
 */

(function($) {
    'use strict';

    const QLReportScheduler = {
        editMode: false,
        editReportId: null,
        currentDatasets: [],
        
        init: function() {
            this.checkAuth();
            this.checkEditMode();
            this.bindEvents();
        },
        
        checkAuth: function() {
            // Check if auth script is loaded
            if (typeof qlAuth === 'undefined') {
                console.error('qlAuth not loaded');
                window.location.href = '/ql-login';
                return;
            }

            // Check authentication status
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
                },
                error: function() {
                    console.error('Auth check failed');
                }
            });
        },
        
        checkEditMode: function() {
            const urlParams = new URLSearchParams(window.location.search);
            const reportId = urlParams.keys().next().value || window.location.search.replace('?', '');
            
            if (reportId && !isNaN(reportId)) {
                this.editMode = true;
                this.editReportId = parseInt(reportId);
                this.loadReportData();
            } else {
                // New report - add one dataset section by default
                this.addDatasetSection();
                this.loadAvailableDatasets();
                this.initCreateModeDayFields();
            }
        },
        
        loadReportData: function() {
            const self = this;
            
            // Show loading
            $('.ql-section').html('<div class="ql-loading"><div class="ql-spinner"></div><div class="ql-loading-text">Loading report...</div></div>');
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_report_details',
                    report_id: self.editReportId,
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.rebuildFormWithData(response.data);
                    } else {
                        self.showError('Failed to load report: ' + (response.data.message || 'Unknown error'));
                        setTimeout(function() {
                            window.location.href = '/ql-dashboard';
                        }, 2000);
                    }
                },
                error: function() {
                    self.showError('Failed to load report data');
                    setTimeout(function() {
                        window.location.href = '/ql-dashboard';
                    }, 2000);
                }
            });
        },
        
        rebuildFormWithData: function(data) {
            const self = this;
            
            // Rebuild the entire form HTML
            const formHtml = `
                <div class="ql-section-header"><h2>Scheduled Report</h2></div>
                <form id="report-form">
                    <div class="ql-form-section">
                        <h3>Report Settings</h3>
                        
                        <div class="ql-form-group">
                            <label for="report-name">Report Name *</label>
                            <input type="text" id="report-name" class="ql-form-control" 
                                   placeholder="e.g., Weekly Sales Summary" 
                                   value="${this.escapeHtml(data.report.report_name)}" required>
                        </div>
                        
                        <div class="ql-form-row">
                            <div class="ql-form-group">
                                <label for="frequency">Frequency *</label>
                                <select id="frequency" class="ql-form-control">
                                    <option value="daily" ${data.report.frequency === 'daily' ? 'selected' : ''}>Daily</option>
                                    <option value="weekly" ${data.report.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                                    <option value="monthly" ${data.report.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                                </select>
                            </div>

                            ${this.buildDayOfWeekHtml(data.report.schedule_day_of_week, data.report.frequency)}
                            ${this.buildDayOfMonthHtml(data.report.schedule_day_of_month, data.report.frequency)}

                            <div class="ql-form-group">
                                <label for="schedule-time">Time *</label>
                                <input type="time" id="schedule-time" class="ql-form-control"
                                       value="${this.escapeHtml(data.report.schedule_time)}" required>
                            </div>

                            <div class="ql-form-group">
                                <label for="timezone">Timezone</label>
                                <input type="text" id="timezone" class="ql-form-control"
                                       value="${this.escapeHtml(data.report.timezone)}"
                                       placeholder="e.g., America/Montreal">
                            </div>
                        </div>
                        
                        <div class="ql-form-group">
                            <label for="recipients">Recipients * (comma-separated emails)</label>
                            <textarea id="recipients" class="ql-form-control" rows="2" 
                                      placeholder="email1@example.com, email2@example.com" required>${this.escapeHtml(data.report.recipients)}</textarea>
                        </div>
                        
                        <div class="ql-form-group">
                            <label for="format">Format</label>
                            <select id="format" class="ql-form-control">
                                <option value="pdf" ${data.report.format === 'pdf' ? 'selected' : ''}>PDF Only</option>
                                <option value="html" ${data.report.format === 'html' ? 'selected' : ''}>HTML Email Only</option>
                                <option value="both" ${data.report.format === 'both' ? 'selected' : ''}>Both PDF & HTML</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="ql-form-section">
                        <div class="ql-section-header">
                            <h3>Datasets</h3>
                            <button type="button" id="add-dataset-btn" class="ql-btn ql-btn-sm ql-btn-primary">
                                + Add Dataset
                            </button>
                        </div>
                        <div id="datasets-container"></div>
                    </div>
                    
                    <div class="ql-form-actions">
                        <button type="submit" id="save-report-btn" class="ql-btn ql-btn-primary">
                            Update Report
                        </button>
                        <a href="/ql-dashboard" class="ql-btn ql-btn-secondary">Cancel</a>
                    </div>
                </form>
            `;
            
            $('.ql-section').html(formHtml);
            
            // Add dataset sections
            data.datasets.forEach(function(dataset) {
                self.addDatasetSection(dataset);
            });
            
            // Re-bind events
            this.bindEvents();
        },
        
        bindEvents: function() {
            const self = this;
            
            // Remove old bindings
            $('#add-dataset-btn').off('click');
            $(document).off('click', '.remove-dataset-btn');
            $(document).off('click', '.ql-dataset-header');
            $(document).off('change', '.dataset-select');
            $(document).off('click', '.ql-collapsible-header');
            $(document).off('change', '.include-insights');
            $(document).off('change', '.include-suggested-charts');
            $(document).off('change', '#frequency');
            $('#report-form').off('submit');
            
            // Add dataset section
            $('#add-dataset-btn').on('click', function() {
                self.addDatasetSection();
            });
            
            // Remove dataset section
            $(document).on('click', '.remove-dataset-btn', function(e) {
                e.stopPropagation();
                self.removeDatasetSection(e);
            });

            // Toggle dataset section collapse
            $(document).on('click', '.ql-dataset-header', function() {
                $(this).next('.ql-dataset-body').slideToggle();
                $(this).toggleClass('collapsed');
            });
            
            // Dataset selection change
            $(document).on('change', '.dataset-select', function(e) {
                self.onDatasetSelected(e);
            });
            
            // Collapsible sections
            $(document).on('click', '.ql-collapsible-header', function() {
                $(this).next('.ql-collapsible-content').slideToggle();
                $(this).toggleClass('collapsed');
            });
            
            // Toggle insights config visibility
            $(document).on('change', '.include-insights', function() {
                $(this).closest('.ql-collapsible-content').find('.insights-config').toggle($(this).is(':checked'));
            });
            
            // Toggle suggested charts config visibility
            $(document).on('change', '.include-suggested-charts', function() {
                $(this).closest('.ql-collapsible-content').find('.suggested-charts-config').toggle($(this).is(':checked'));
            });

            // Show/hide day-of-week and day-of-month fields based on frequency
            $(document).on('change', '#frequency', function() {
                self.updateDayFieldVisibility($(this).val());
            });
            
            // Date filter event handlers
            $(document).on('change', '.filter-date-from-input', function() {
                const $group = $(this).closest('.ql-form-row');
                const selectedValue = $(this).val();
                if (selectedValue === 'custom') {
                    $group.find('.filter-date-from-custom').closest('.ql-form-group').show();
                } else {
                    $group.find('.filter-date-from-custom').closest('.ql-form-group').hide();
                }
            });
            
            $(document).on('change', '.filter-date-to-input', function() {
                const $group = $(this).closest('.ql-form-row');
                const selectedValue = $(this).val();
                if (selectedValue === 'custom') {
                    $group.find('.filter-date-to-custom').closest('.ql-form-group').show();
                } else {
                    $group.find('.filter-date-to-custom').closest('.ql-form-group').hide();
                }
            });
            
            // Form submission
            $('#report-form').on('submit', function(e) {
                e.preventDefault();
                self.saveReport();
            });
        },
        
        addDatasetSection: function(datasetConfig = null) {
            const index = $('#datasets-container .ql-dataset-section').length;
            
            const section = $(`
                <div class="ql-dataset-section" data-index="${index}">
                    <div class="ql-dataset-header collapsed">
                        <h4>Dataset ${index + 1}</h4>
                        ${index > 0 ? '<button type="button" class="ql-btn ql-btn-sm ql-btn-danger remove-dataset-btn">Remove</button>' : ''}
                    </div>

                    <div class="ql-dataset-body" style="display:none">
                    <div class="ql-form-group">
                        <label>Select Dataset *</label>
                        <select class="ql-form-control dataset-select" data-index="${index}" required>
                            <option value="">-- Select a dataset --</option>
                        </select>
                    </div>

                    <div class="ql-form-group">
                        <label>Section Title (optional)</label>
                        <input type="text" class="ql-form-control section-title"
                               placeholder="e.g., Sales Performance"
                               value="${datasetConfig ? this.escapeHtml(datasetConfig.section_title || '') : ''}">
                    </div>

                    <div class="ql-collapsible-section">
                        <h5 class="ql-collapsible-header">AI Insights Configuration</h5>
                        <div class="ql-collapsible-content">
                            <div class="ql-form-group">
                                <label>
                                    <input type="checkbox" class="include-insights"
                                           ${!datasetConfig || datasetConfig.include_insights ? 'checked' : ''}>
                                    Generate AI Insights
                                </label>
                            </div>

                            <div class="insights-config">
                                <div class="ql-form-group">
                                    <label>Limit to Specific Columns (optional)</label>
                                    <select multiple class="ql-form-control insight-columns" data-index="${index}">
                                    </select>
                                    <small>Leave empty to analyze all columns. Hold Ctrl/Cmd to select multiple.</small>
                                </div>

                                <div class="ql-form-row">
                                    <div class="ql-form-group">
                                        <label>Filter Column (optional)</label>
                                        <select class="ql-form-control filter-column" data-index="${index}">
                                            <option value="">No filter</option>
                                        </select>
                                    </div>

                                    <div class="ql-form-group">
                                        <label>Filter Value</label>
                                        <input type="text" class="ql-form-control filter-value"
                                               placeholder="e.g., North America"
                                               value="${datasetConfig ? this.escapeHtml(datasetConfig.insight_filter_value || '') : ''}">
                                    </div>
                                </div>

                                <div class="ql-form-row ql-date-filter-row">
                                    <div class="ql-form-group">
                                        <label>Date Filter Column (optional)</label>
                                        <select class="ql-form-control filter-date-column" data-index="${index}">
                                            <option value="">No date filter</option>
                                        </select>
                                    </div>

                                    <div class="ql-form-group">
                                        <label>From</label>
                                        <select class="ql-form-control filter-date-from-input" data-index="${index}">
                                            <option value="">From...</option>
                                            <option value="1 day">1 day ago</option>
                                            <option value="7 days">7 days ago</option>
                                            <option value="14 days">14 days ago</option>
                                            <option value="1 month" selected>1 month ago</option>
                                            <option value="2 months">2 months ago</option>
                                            <option value="3 months">3 months ago</option>
                                            <option value="6 months">6 months ago</option>
                                            <option value="1 year">1 year ago</option>
                                            <option value="2 years">2 years ago</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>

                                    <div class="ql-form-group" style="display: none;">
                                        <label>Custom From Date</label>
                                        <input type="date" class="ql-form-control filter-date-from-custom" data-index="${index}">
                                    </div>

                                    <div class="ql-form-group">
                                        <label>To</label>
                                        <select class="ql-form-control filter-date-to-input" data-index="${index}">
                                            <option value="">To...</option>
                                            <option value="today" selected>Today</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>

                                    <div class="ql-form-group" style="display: none;">
                                        <label>Custom To Date</label>
                                        <input type="date" class="ql-form-control filter-date-to-custom" data-index="${index}">
                                    </div>
                                </div>

                                <div class="ql-form-group">
                                    <label>Maximum Insights</label>
                                    <input type="number" class="ql-form-control max-insights" min="1" max="50"
                                           value="${datasetConfig ? datasetConfig.insight_max_count : 10}">
                                </div>

                                <div class="ql-form-group">
                                    <label>Custom Analysis Prompt (optional)</label>
                                    <textarea class="ql-form-control custom-prompt" rows="2"
                                              placeholder="e.g., Focus on year-over-year growth trends">${datasetConfig ? this.escapeHtml(datasetConfig.insight_custom_prompt || '') : ''}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="ql-collapsible-section">
                        <h5 class="ql-collapsible-header">Suggested Charts Configuration</h5>
                        <div class="ql-collapsible-content">
                            <div class="ql-form-group">
                                <label>
                                    <input type="checkbox" class="include-suggested-charts"
                                           ${!datasetConfig || datasetConfig.include_suggested_charts ? 'checked' : ''}>
                                    Include AI-Suggested Charts
                                </label>
                            </div>

                            <div class="suggested-charts-config">
                                <div class="ql-form-group">
                                    <label>Number of Charts</label>
                                    <input type="number" class="ql-form-control suggested-chart-count" min="1" max="10"
                                           value="${datasetConfig ? datasetConfig.suggested_chart_count : 5}">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="ql-collapsible-section">
                        <h5 class="ql-collapsible-header">Saved Charts</h5>
                        <div class="ql-collapsible-content">
                            <div class="ql-form-group">
                                <label>Select Saved Charts (optional)</label>
                                <select multiple class="ql-form-control saved-charts" data-index="${index}">
                                </select>
                                <small>Hold Ctrl/Cmd to select multiple charts</small>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            `);
            
            $('#datasets-container').append(section);
            
            // Load available datasets for this section
            this.loadAvailableDatasets(index, datasetConfig ? datasetConfig.dataset_id : null);
            
            // Pre-select saved chart IDs if in edit mode
            if (datasetConfig && datasetConfig.saved_chart_ids) {
                section.data('preselected-charts', datasetConfig.saved_chart_ids);
            }
            
            // Pre-select insight columns if in edit mode
            if (datasetConfig && datasetConfig.insight_columns) {
                section.data('preselected-columns', datasetConfig.insight_columns);
            }
            
            // Pre-select filter column if in edit mode
            if (datasetConfig && datasetConfig.insight_filter_column) {
                section.data('preselected-filter-column', datasetConfig.insight_filter_column);
            }
            
            // Pre-select date filter values if in edit mode
            if (datasetConfig && datasetConfig.insight_filter_date_column) {
                section.data('preselected-date-filter-column', datasetConfig.insight_filter_date_column);
                section.data('preselected-date-filter-from', datasetConfig.insight_filter_date_from);
                section.data('preselected-date-filter-to', datasetConfig.insight_filter_date_to);
            }
            
            // Initialize visibility
            section.find('.include-insights').trigger('change');
            section.find('.include-suggested-charts').trigger('change');
        },
        
        removeDatasetSection: function(e) {
            $(e.target).closest('.ql-dataset-section').remove();
            // Renumber remaining sections
            $('#datasets-container .ql-dataset-section').each((index, section) => {
                $(section).attr('data-index', index);
                $(section).find('h4').text(`Dataset ${index + 1}`);
            });
        },
        
        loadAvailableDatasets: function(index = null, selectedId = null) {
            const self = this;
            
            // Use existing ql_get_dashboard_data endpoint
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
                    if (response.success && response.data.datasets) {
                        self.currentDatasets = response.data.datasets;
                        
                        // If index specified, populate that selector
                        if (index !== null) {
                            self.populateDatasetSelector(index, selectedId);
                        } else {
                            // Populate all selectors
                            $('.dataset-select').each(function() {
                                const idx = $(this).data('index');
                                self.populateDatasetSelector(idx, null);
                            });
                        }
                    }
                }
            });
        },
        
        populateDatasetSelector: function(index, selectedId) {
            const select = $(`.dataset-select[data-index="${index}"]`);
            select.empty().append('<option value="">-- Select a dataset --</option>');
            
            this.currentDatasets.forEach(dataset => {
                const option = $('<option>')
                    .val(dataset.id)
                    .text(`${dataset.name} (${dataset.row_count} rows)`);
                
                if (selectedId && dataset.id == selectedId) {
                    option.attr('selected', 'selected');
                }
                
                select.append(option);
            });
            
            // If a dataset was selected, load its columns
            if (selectedId) {
                this.loadDatasetColumns(index, selectedId);
            }
        },
        
        onDatasetSelected: function(e) {
            const index = $(e.target).data('index');
            const datasetId = $(e.target).val();
            
            if (datasetId) {
                this.loadDatasetColumns(index, datasetId);
            }
        },
        
        loadDatasetColumns: function(index, datasetId) {
            const self = this;
            const section = $(`.ql-dataset-section[data-index="${index}"]`);
            
            // Use existing ql_get_dataset_detail endpoint which includes columns
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_dataset_detail',
                    dataset_id: datasetId,
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success && response.data.columns) {
                        const columns = response.data.columns;
                        
                        // Populate insight columns selector
                        const insightSelect = $(`.insight-columns[data-index="${index}"]`);
                        insightSelect.empty();
                        columns.forEach(col => {
                            insightSelect.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                        });
                        
                        // Pre-select columns if in edit mode
                        const preselectedColumns = section.data('preselected-columns');
                        if (preselectedColumns) {
                            insightSelect.val(preselectedColumns);
                        }
                        
                        // Populate filter column selector
                        const filterSelect = $(`.filter-column[data-index="${index}"]`);
                        filterSelect.empty().append('<option value="">No filter</option>');
                        columns.forEach(col => {
                            filterSelect.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                        });
                        
                        // Pre-select filter column if in edit mode
                        const preselectedFilterColumn = section.data('preselected-filter-column');
                        if (preselectedFilterColumn) {
                            filterSelect.val(preselectedFilterColumn);
                        }
                        
                        // Populate date filter column selector (only date/datetime columns)
                        const dateFilterSelect = $(`.filter-date-column[data-index="${index}"]`);
                        dateFilterSelect.empty().append('<option value="">No date filter</option>');
                        columns.forEach(col => {
                            // Include date and datetime columns based on inferred_type
                            if (col.inferred_type === 'date' || col.inferred_type === 'datetime') {
                                dateFilterSelect.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                            }
                        });
                        
                        // Pre-select date filter values if in edit mode
                        const preselectedDateColumn = section.data('preselected-date-filter-column');
                        const preselectedDateFrom = section.data('preselected-date-filter-from');
                        const preselectedDateTo = section.data('preselected-date-filter-to');
                        
                        if (preselectedDateColumn) {
                            dateFilterSelect.val(preselectedDateColumn);
                        }
                        
                        if (preselectedDateFrom) {
                            const dateFromInput = $(`.filter-date-from-input[data-index="${index}"]`);
                            // Check if it's a custom date or predefined option
                            if (dateFromInput.find(`option[value="${preselectedDateFrom}"]`).length > 0) {
                                dateFromInput.val(preselectedDateFrom);
                            } else {
                                // It's a custom date
                                dateFromInput.val('custom');
                                $(`.filter-date-from-custom[data-index="${index}"]`).val(preselectedDateFrom).closest('.ql-form-group').show();
                            }
                        }
                        
                        if (preselectedDateTo) {
                            const dateToInput = $(`.filter-date-to-input[data-index="${index}"]`);
                            // Check if it's a custom date or predefined option
                            if (dateToInput.find(`option[value="${preselectedDateTo}"]`).length > 0) {
                                dateToInput.val(preselectedDateTo);
                            } else {
                                // It's a custom date
                                dateToInput.val('custom');
                                $(`.filter-date-to-custom[data-index="${index}"]`).val(preselectedDateTo).closest('.ql-form-group').show();
                            }
                        }
                        
                        // Load saved charts for this dataset
                        self.loadSavedCharts(index, datasetId);
                    }
                }
            });
        },
        
        loadSavedCharts: function(index, datasetId) {
            const section = $(`.ql-dataset-section[data-index="${index}"]`);
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_saved_charts',
                    dataset_id: datasetId,
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success && response.data.charts) {
                        const select = $(`.saved-charts[data-index="${index}"]`);
                        select.empty();
                        
                        response.data.charts.forEach(chart => {
                            select.append(`<option value="${chart.id}">${chart.chart_name || chart.chart_type}</option>`);
                        });
                        
                        // Pre-select charts if in edit mode
                        const preselectedCharts = section.data('preselected-charts');
                        if (preselectedCharts) {
                            select.val(preselectedCharts);
                        }
                    }
                }
            });
        },
        
        saveReport: function() {
            const self = this;
            
            // Gather form data
            const frequency = $('#frequency').val();
            const formData = {
                action: self.editMode ? 'ql_update_scheduled_report' : 'ql_create_scheduled_report',
                nonce: qlAuth.nonce,
                report_name: $('#report-name').val(),
                frequency: frequency,
                schedule_time: $('#schedule-time').val(),
                schedule_day_of_week: frequency === 'weekly' ? $('#schedule-day-of-week').val() : '',
                schedule_day_of_month: frequency === 'monthly' ? $('#schedule-day-of-month').val() : '',
                timezone: $('#timezone').val(),
                recipients: $('#recipients').val(),
                format: $('#format').val(),
                datasets: []
            };
            
            if (self.editMode) {
                formData.report_id = self.editReportId;
            }
            
            // Gather dataset configurations
            let hasError = false;
            $('#datasets-container .ql-dataset-section').each(function() {
                const $section = $(this);
                const datasetId = $section.find('.dataset-select').val();
                
                if (!datasetId) {
                    self.showError('Please select a dataset for all sections');
                    hasError = true;
                    return false; // Break the loop
                }
                
                const datasetConfig = {
                    dataset_id: datasetId,
                    section_title: $section.find('.section-title').val(),
                    include_insights: $section.find('.include-insights').is(':checked') ? 1 : 0,
                    insight_columns: $section.find('.insight-columns').val() || [],
                    insight_filter_column: $section.find('.filter-column').val(),
                    insight_filter_value: $section.find('.filter-value').val(),
                    insight_max_count: parseInt($section.find('.max-insights').val()),
                    insight_custom_prompt: $section.find('.custom-prompt').val(),
                    include_suggested_charts: $section.find('.include-suggested-charts').is(':checked') ? 1 : 0,
                    suggested_chart_count: parseInt($section.find('.suggested-chart-count').val()),
                    saved_chart_ids: $section.find('.saved-charts').val() || []
                };
                
                // Add date filter values
                const dateColumn = $section.find('.filter-date-column').val();
                if (dateColumn) {
                    datasetConfig.insight_filter_date_column = dateColumn;
                    
                    // Get FROM value
                    const fromInput = $section.find('.filter-date-from-input').val();
                    if (fromInput === 'custom') {
                        datasetConfig.insight_filter_date_from = $section.find('.filter-date-from-custom').val();
                    } else if (fromInput) {
                        datasetConfig.insight_filter_date_from = fromInput;
                    }
                    
                    // Get TO value
                    const toInput = $section.find('.filter-date-to-input').val();
                    if (toInput === 'custom') {
                        datasetConfig.insight_filter_date_to = $section.find('.filter-date-to-custom').val();
                    } else if (toInput) {
                        datasetConfig.insight_filter_date_to = toInput;
                    }
                }
                
                formData.datasets.push(datasetConfig);
            });
            
            if (hasError) {
                return;
            }
            
            if (formData.datasets.length === 0) {
                self.showError('Please add at least one dataset to the report');
                return;
            }
            
            // Convert datasets array to JSON string
            formData.datasets = JSON.stringify(formData.datasets);
            
            // Disable button and show loading
            const $btn = $('#save-report-btn');
            const originalText = $btn.text();
            $btn.prop('disabled', true).text(self.editMode ? 'Updating...' : 'Creating...');
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: formData,
                success: function(response) {
                    if (response.success) {
                        self.showSuccess(self.editMode ? 'Report updated successfully! Redirecting...' : 'Report created successfully! Redirecting...');
                        setTimeout(function() {
                            window.location.href = '/ql-dashboard?report_saved=1';
                        }, 2000);
                    } else {
                        self.showError(response.data.message || 'Failed to save report');
                        $btn.prop('disabled', false).text(originalText);
                    }
                },
                error: function() {
                    self.showError('Failed to save report. Please try again.');
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        },
        
        showSuccess: function(message) {
            const $msg = $('<div class="ql-success-message"></div>').text(message);
            $('.ql-reports-wrapper').prepend($msg);
            setTimeout(function() {
                $msg.fadeOut(function() {
                    $(this).remove();
                });
            }, 5000);
        },
        
        showError: function(message) {
            const $msg = $('<div class="ql-error-message"></div>').text(message);
            $('.ql-reports-wrapper').prepend($msg);
            setTimeout(function() {
                $msg.fadeOut(function() {
                    $(this).remove();
                });
            }, 5000);
        },
        
        /**
         * Show/hide the day-of-week and day-of-month selects based on the chosen frequency.
         */
        updateDayFieldVisibility: function(frequency) {
            $('#day-of-week-group').toggle(frequency === 'weekly');
            $('#day-of-month-group').toggle(frequency === 'monthly');
        },

        /**
         * Inject day-of-week and day-of-month selects into the static create-mode form
         * (the form already exists in the page HTML; these fields are not present by default).
         */
        initCreateModeDayFields: function() {
            // Only run if the static form is present and the fields haven't been injected yet
            if (!$('#report-form').length || $('#day-of-week-group').length) {
                return;
            }

            const frequency = $('#frequency').val();
            const $frequencyGroup = $('#frequency').closest('.ql-form-group');
            $frequencyGroup.after(
                this.buildDayOfWeekHtml(null, frequency) +
                this.buildDayOfMonthHtml(null, frequency)
            );
        },

        /**
         * Build the HTML for the Day-of-Week select group.
         * @param {number|null} selected  0–6; null/undefined defaults to 1 (Monday)
         * @param {string}      frequency 'daily' | 'weekly' | 'monthly'
         * @returns {string}
         */
        buildDayOfWeekHtml: function(selected, frequency) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const sel = (selected !== null && selected !== undefined) ? Number(selected) : 1;
            const display = frequency === 'weekly' ? 'block' : 'none';
            const options = days.map((name, i) =>
                `<option value="${i}"${i === sel ? ' selected' : ''}>${name}</option>`
            ).join('');
            return `
                <div class="ql-form-group" id="day-of-week-group" style="display: ${display};">
                    <label for="schedule-day-of-week">Day of Week</label>
                    <select id="schedule-day-of-week" class="ql-form-control">
                        ${options}
                    </select>
                </div>`;
        },

        /**
         * Build the HTML for the Day-of-Month select group.
         * @param {number|null} selected  1–31; null/undefined defaults to 1
         * @param {string}      frequency 'daily' | 'weekly' | 'monthly'
         * @returns {string}
         */
        buildDayOfMonthHtml: function(selected, frequency) {
            const sel = (selected !== null && selected !== undefined) ? Number(selected) : 1;
            const display = frequency === 'monthly' ? 'block' : 'none';
            const options = Array.from({length: 31}, (_, i) => {
                const d = i + 1;
                return `<option value="${d}"${d === sel ? ' selected' : ''}>${d}</option>`;
            }).join('');
            return `
                <div class="ql-form-group" id="day-of-month-group" style="display: ${display};">
                    <label for="schedule-day-of-month">Day of Month</label>
                    <select id="schedule-day-of-month" class="ql-form-control">
                        ${options}
                    </select>
                </div>`;
        },

        escapeHtml: function(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        if ($('.ql-reports-page').length) {
            QLReportScheduler.init();
        }
    });

})(jQuery);
