/**
 * QuantumLayers Analytics & Visualization
 * File: assets/analytics.js
 */

(function($) {
    'use strict';

    const QLAnalytics = {
        charts: {},
        savedCharts: {},
        recommendedCharts: {},
        currentDatasetId: null,
        multiSelectValues: {
            xColumns: [],
            yColumns: []
        },
        // Store current chart params for saving
        currentChartParams: {},

        init: function() {
            // Standalone chart page - only run chart page logic
            if (window.location.pathname.indexOf('ql-chart') !== -1) {
                this.initChartPage();
                return;
            }

            this.bindEvents();
            this.loadDatasetDetails();
            this.loadInitialCharts();
            this.initMultiSelectModals();
            this.loadSavedCharts();
            this.handleResize();
            this.initDateFilters(); // NEW: Initialize date filter controls
        },

        bindEvents: function() {
            // Chart type selectors
            $('.ql-chart-selector').on('change', this.handleChartChange.bind(this));
            $('.ql-chart-type-selector').on('change', this.handleChartChange.bind(this));
            
            // Column selectors for specific charts
            $('.ql-x-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-reg-x-columns-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-y-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-multi-y-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-date-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-string-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-z-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-color-selector').on('change', this.handleControlChange.bind(this));
            
            $('.ql-filter-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-filter-value').on('change', this.handleControlChange.bind(this));
            
            // NEW: Date filter event handlers
            $('.ql-filter-date-column-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-filter-date-from-input').on('change', this.handleDateFromChange.bind(this));
            $('.ql-filter-date-to-input').on('change', this.handleDateToChange.bind(this));
            $('.ql-filter-date-from-custom').on('change', this.handleControlChange.bind(this));
            $('.ql-filter-date-to-custom').on('change', this.handleControlChange.bind(this));

            $('.ql-aggregation-selector').on('change', this.handleControlChange.bind(this));
            $('.ql-cumul-selector').on('change', this.handleControlChange.bind(this));
            
            // Analysis buttons
            $('#ql-correlation-btn').on('click', this.showCorrelationMatrix.bind(this));
            $('#ql-pca-btn').on('click', this.showPCAAnalysis.bind(this));
            $('#ql-anova-btn').on('click', this.showAnovaAnalysis.bind(this));
            $('#ql-stats-btn').on('click', this.showStatisticalSummary.bind(this));

            // Multi-select modal buttons
            $('.ql-multiselect-trigger').on('click', this.openMultiSelectModal.bind(this));
            $('.ql-multiselect-modal-close').on('click', this.closeMultiSelectModal.bind(this));
            $('.ql-multiselect-modal-backdrop').on('click', this.closeMultiSelectModal.bind(this));
            $('.ql-multiselect-done').on('click', this.applyMultiSelectChanges.bind(this));

            // NEW: Save/delete chart button handlers (delegated for dynamic elements)
            $(document).on('click', '.ql-save-chart-btn', this.handleSaveChart.bind(this));
            $(document).on('click', '.ql-copy-link-btn', this.handleCopyChartLink.bind(this));
            $(document).on('click', '.ql-delete-saved-chart-btn', this.handleDeleteSavedChart.bind(this));
            $(document).on('click', '.ql-saved-chart-wrapper', this.handleSavedChartClick.bind(this));
            $(document).on('click', '.ql-recommended-chart-wrapper', this.handleRecommendedChartClick.bind(this));
         },
         
        handleResize: function() {
            let resizeTimer;
            const self = this;
            
            $(window).on('resize orientationchange', function() {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(function() {
                    // Resize all Chart.js charts
                    Object.keys(self.charts).forEach(function(chartKey) {
                        if (self.charts[chartKey] && typeof self.charts[chartKey].resize === 'function') {
                            self.charts[chartKey].resize();
                        }
                    });
                }, 250);
            });
        },

        /**
         * Initialize date filter controls
         */
        initDateFilters: function() {
            // Set default values
            $('.ql-filter-date-from-input').val('');
            $('.ql-filter-date-to-input').val('');
            
            // Initialize visibility
            this.updateDateFilterVisibility('from', '');
            this.updateDateFilterVisibility('to', '');
        },
        
        /**
         * Handle "From" date dropdown change
         */
        handleDateFromChange: function(e) {
            const selectedValue = $(e.target).val();
            this.updateDateFilterVisibility('from', selectedValue);
            this.handleControlChange(e);
        },
        
        /**
         * Handle "To" date dropdown change
         */
        handleDateToChange: function(e) {
            const selectedValue = $(e.target).val();
            this.updateDateFilterVisibility('to', selectedValue);
            this.handleControlChange(e);
        },
        
        /**
         * Update visibility of custom date inputs
         */
        updateDateFilterVisibility: function(filterType, selectedValue) {
            if (filterType === 'from') {
                if (selectedValue === 'custom') {
                    // Show custom date input
                    $('.ql-filter-date-from-custom').show();
                } else {
                    // Hide custom date input
                    $('.ql-filter-date-from-custom').hide();
                }
            } else if (filterType === 'to') {
                if (selectedValue === 'custom') {
                    // Show custom date input
                    $('.ql-filter-date-to-custom').show();
                } else {
                    // Hide custom date input
                    $('.ql-filter-date-to-custom').hide();
                }
            }
        },
        
        /**
         * Get the current date filter values
         */
        getDateFilterValues: function() {
            const dateColumn = $('.ql-filter-date-column-selector').val();
            
            if (!dateColumn) {
                return {
                    column: null,
                    from: null,
                    to: null
                };
            }
            
            // Get FROM value
            const fromValue = $('.ql-filter-date-from-input').val();
            let fromDate = null;
            
            if (fromValue === 'custom') {
                // Use custom date input
                fromDate = $('.ql-filter-date-from-custom').val();
            } else {
                // Use selected relative date
                fromDate = fromValue;
            }
            
            // Get TO value
            const toValue = $('.ql-filter-date-to-input').val();
            let toDate = null;
            
            if (toValue === 'custom') {
                // Use custom date input
                toDate = $('.ql-filter-date-to-custom').val();
            } else {
                // Use 'today' or other value
                toDate = toValue;
            }
            
            return {
                column: dateColumn,
                from: fromDate,
                to: toDate
            };
        },

        loadDatasetDetails: function() {
            const self = this;
            const datasetId = this.getDatasetIdFromURL();
            if (!datasetId) return;
            this.currentDatasetId = datasetId;
           $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_dataset_detail',
                    nonce: qlAuth.nonce,
                    dataset_id: this.currentDatasetId
                },
                success: function(response) {
                    if (response.success && response.data && response.data.columns) {
                        self.populateColumnSelectors(response.data.columns, response.data.row_count);
                    } else {
                        console.error('Failed to load dataset details:', response);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error loading dataset details:', error);
                }
            });            
            
        },
        
        populateColumnSelectors: function(columns, rowCount) {
            // Calculate total row count
            let totalRows = rowCount || 0;
            
            // Fallback: estimate from max distinct_count if row_count not provided
            if (!totalRows && columns.length > 0) {
                totalRows = Math.max(...columns.map(col => col.distinct_count || 0));
                // Add buffer since max distinct is a lower bound
                totalRows = Math.max(totalRows, 100);
            }
            
            // Calculate 1% threshold for categorical classification — must match the
            // backend's threshold (charts.php getPieChartData/getBarChartData/getBoxPlotData,
            // analytics.php performAnovaAnalysis) so the dropdown never offers a numeric
            // column as a category that the backend will then reject.
            const minDistinctForContinuous = Math.max(Math.ceil(totalRows * 0.01), 2);
            
            // Classify columns based on type AND distinctness
            const numericColumns = columns.filter(col => 
                col.inferred_type === 'integer' || col.inferred_type === 'float'
                    // Only include if distinctness >= 10% (continuous variables)
                    // Commented out to include low distinctness columns for certain charts (ex. timeseries)
                    //return col.distinct_count >= minDistinctForContinuous; 
                //}
                //return false;
            );
            
            const categoricalColumns = columns.filter(col => {
                // String columns are always categorical
                if (col.inferred_type === 'string') {
                    return true;
                }
                // Numeric columns with low distinctness are categorical
                if (col.inferred_type === 'integer' || col.inferred_type === 'float') {
                    return col.distinct_count < minDistinctForContinuous;
                }
                return false;
            });
            
            const dateColumns = columns.filter(col => 
                col.inferred_type === 'date' || col.inferred_type === 'datetime'
            );
            
            // Populate X column selector (continuous numeric only)
            $('.ql-x-column-selector').each(function() {
                const select = $(this);
                
                numericColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate regression X columns selector (all types)
            $('.ql-reg-x-columns-selector').each(function() {
                const select = $(this);
                
                columns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate Y column selector (continuous numeric only)
            $('.ql-y-column-selector').each(function() {
                const select = $(this);
                
                numericColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate multi Y column selector (continuous numeric only)
            $('.ql-multi-y-column-selector').each(function() {
                const select = $(this);
                
                numericColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate date column selector
            $('.ql-date-column-selector').each(function() {
                const select = $(this);
                
                dateColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            

            // Populate string column selector (categorical - now includes low-distinctness numeric)
            $('.ql-string-column-selector').each(function() {
                const select = $(this);
                
                categoricalColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate Y string column selector (for heatmap Y axis - categorical)
            $('.ql-y-string-column-selector').each(function() {
                const select = $(this);
                
                categoricalColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate filter column selector (categorical)
            $('.ql-filter-column-selector').each(function() {
                const select = $(this);
                
                categoricalColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // NEW: Populate date filter column selector (date columns)
            $('.ql-filter-date-column-selector').each(function() {
                const select = $(this);
                
                dateColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate color column selector (for bubble charts - categorical)
            $('.ql-color-selector').each(function() {
                const select = $(this);
                
                categoricalColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
            
            // Populate Z column selector (for heatmaps - continuous numeric only)
            $('.ql-z-column-selector').each(function() {
                const select = $(this);
                
                numericColumns.forEach(col => {
                    select.append(`<option value="${col.col_name}">${col.col_name}</option>`);
                });
            });
        },

        initMultiSelectModals: function() {
            // Initialize multi-select change handlers
            $('#ql-reg-x-columns-selector').on('change', this.handleMultiSelectChange.bind(this, 'xColumns'));
            $('#ql-multi-y-column-selector').on('change', this.handleMultiSelectChange.bind(this, 'yColumns'));
            
            // Initialize button labels with first selected items
            this.updateMultiSelectButtonLabel('xColumns');
            this.updateMultiSelectButtonLabel('yColumns');
        },

        openMultiSelectModal: function(e) {
            e.preventDefault();
            const targetModalId = $(e.currentTarget).data('modal');
            $('#' + targetModalId).addClass('show');
        },

        closeMultiSelectModal: function(e) {
            const modal = $(e.currentTarget).closest('.ql-multiselect-modal');
            modal.removeClass('show');
        },

        handleMultiSelectChange: function(type, e) {
            const selectedOptions = $(e.currentTarget).find('option:selected');
            this.multiSelectValues[type] = selectedOptions.map(function() {
                return $(this).val();
            }).get();
            
            this.updateMultiSelectButtonLabel(type);
        },

        updateMultiSelectButtonLabel: function(type) {
            const values = this.multiSelectValues[type];
            let buttonId, selectorId;
            
            if (type === 'xColumns') {
                buttonId = '#ql-x-columns-trigger';
                selectorId = '#ql-reg-x-columns-selector';
            } else if (type === 'yColumns') {
                buttonId = '#ql-y-columns-trigger';
                selectorId = '#ql-multi-y-column-selector';
            }
            
            const button = $(buttonId);
            const selector = $(selectorId);
            
            if (!button.length || !selector.length) return;
            
            // Get selected options text
            const selectedOptions = selector.find('option:selected');
            const selectedTexts = selectedOptions.map(function() {
                return $(this).text();
            }).get();
            
            // Update button label
            if (selectedTexts.length === 0) {
            } else if (selectedTexts.length === 1) {
                button.find('.ql-multiselect-label').text(selectedTexts[0]);
            } else {
                button.find('.ql-multiselect-label').text(selectedTexts[0] + ', ...');
            }
            
            // Update count badge
            button.find('.ql-multiselect-count').text(selectedTexts.length);
        },

        applyMultiSelectChanges: function(e) {
            e.preventDefault();
            const modal = $(e.currentTarget).closest('.ql-multiselect-modal');
            const modalId = modal.attr('id');
            
            // Any other update required here...
            
            // Close modal
            modal.removeClass('show');
        },

        loadInitialCharts: function() {
            const datasetId = this.getDatasetIdFromURL();
            if (!datasetId) return;
            this.currentDatasetId = datasetId;
            this.loadChart('column-types', 'column_types');
            this.loadChart('missing-data', 'missing_data');
            // Renders into #recommended-charts if that container exists on the
            // current page (safe no-op otherwise). Works on both ql-analytics
            // and ql-insights as long as the page template includes the div.
            this.createRecommendedCharts();
        },

        getDatasetIdFromURL: function() {
            const path = window.location.search;
            const match = path.match(/\?(\d+)/);
            return match ? match[1] : null;
        },

        loadChart: function(containerId, chartType, xcolumnName = null, ycolumnName = null, zcolumnName = null, colorName = null) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            var postdata;
            var ycolumns = [];
            var xcolumns = [];
            // Check if ycolumnName is from a multi-select element
            if (Array.isArray(ycolumnName)) {
                ycolumns = ycolumnName;
            } else if (ycolumnName) {
                ycolumns = [ycolumnName];
            }
            if (Array.isArray(xcolumnName)) {
                xcolumns = xcolumnName;
            } else if (xcolumnName) {
                xcolumns = [xcolumnName];
            }
            var filtercolumn = $('.ql-filter-column-selector').val();
            var filtervalue = $('.ql-filter-value').val();

            // NEW: Get date filter values
            const dateFilters = this.getDateFilterValues();

            var aggregation = 'mean';
            var aggSelector = $('.ql-aggregation-selector');
            if (aggSelector.length) {
                aggregation = aggSelector.val() || 'mean';
            }

            // Show loading
            container.innerHTML = '<div class="ql-loading">Loading chart...</div>';

            // Build postdata based on chart type
            switch (chartType) {
                case 'histogram':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        column_name: xcolumnName,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                case 'time_series':
                case 'stacked_area':
                    // Get aggregation method from selector if available
                    var cumulative = $('.ql-cumul-selector').is(':checked') ? 1 : 0;
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        time_column: xcolumnName,
                        value_columns: ycolumns,
                        aggregation: aggregation,
                        interval: 'day',
                        cumulative: cumulative,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                case 'scatter':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        x_column: xcolumnName,
                        y_column: ycolumnName,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                case 'pie':
                case 'doughnut':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        category_column: xcolumnName,
                        value_column: ycolumnName,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                case 'regression':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        x_columns: xcolumns,
                        y_column: ycolumnName,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                case 'bar':
                case 'horizontal_bar':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        category_column: xcolumnName,
                        value_columns: ycolumns,
                        aggregation: aggregation,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;

                case 'violin':
                case 'box_plot':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        x_column: xcolumnName,  // categorical
                        y_column: ycolumnName,  // numerical
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                case 'bubble':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        x_column: xcolumnName,
                        y_column: ycolumnName,
                        size_column: zcolumnName,
                        color_column: colorName,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                case 'matrix':
                case 'heatmap':
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType,
                        x_column: xcolumnName,  
                        y_column: ycolumnName, 
                        z_column: zcolumnName,      
                        aggregation: aggregation,
                        filter_category_column: filtercolumn,
                        filter_category_value: filtervalue,
                        filter_date_column: dateFilters.column,
                        filter_date_from: dateFilters.from,
                        filter_date_to: dateFilters.to
                    };
                    break;
                    
                default:
                    postdata = {
                        action: 'ql_get_chart_data',
                        nonce: qlAuth.nonce,
                        dataset_id: this.currentDatasetId,
                        chart_type: chartType
                    };
            }
            
            if (containerId === 'custom-chart') {
                this.currentChartParams[containerId] = {
                    chartType: chartType,
                    postdata: postdata
                };
            }
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: postdata,
                success: (response) => {
                    if (response.success) {
                        this.renderChart(containerId, response.data);
                        
                        if (containerId === 'custom-chart') {
                            this.addSaveButton(containerId);
                        }
                    } else {
                        const msg = (response.data && response.data.error) ? response.data.error : 'Error loading chart';
                        container.innerHTML = '<div class="ql-error">' + msg + '</div>';
                    }
                },
                error: () => {
                    container.innerHTML = '<div class="ql-error">Failed to load chart</div>';
                }
            });


        },

        renderChart: function(containerId, chartData) {
            const container = document.getElementById(containerId);
            
            // Clear container
            container.innerHTML = '';
            
            // Create canvas
            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            // Destroy existing chart if it exists
            if (this.charts[containerId]) {
                this.charts[containerId].destroy();
            }

            // Preprocess matrix/heatmap chart data to convert string functions to actual functions
            if (chartData.type === 'matrix' && chartData.data && chartData.data.datasets) {
                chartData.data.datasets.forEach(dataset => {
                    // Convert backgroundColor string function to actual function
                    if (typeof dataset.backgroundColor === 'string' && dataset.backgroundColor.startsWith('function')) {
                        try {
                            dataset.backgroundColor = eval('(' + dataset.backgroundColor + ')');
                        } catch (e) {
                            console.error('Error parsing backgroundColor function:', e);
                        }
                    }
                    // Convert width string (arrow function or regular function) to actual function
                    if (typeof dataset.width === 'string') {
                        try {
                            // Check if it's an arrow function or regular function
                            if (dataset.width.includes('=>') || dataset.width.startsWith('function')) {
                                dataset.width = eval('(' + dataset.width + ')');
                            }
                        } catch (e) {
                            console.error('Error parsing width function:', e);
                        }
                    }
                            
                    // Convert height string (arrow function or regular function) to actual function
                    if (typeof dataset.height === 'string') {
                        try {
                            // Check if it's an arrow function or regular function
                            if (dataset.height.includes('=>') || dataset.height.startsWith('function')) {
                                dataset.height = eval('(' + dataset.height + ')');
                        }
                        } catch (e) {
                            console.error('Error parsing height function:', e);
                        }
                    }
                });
            }

            
            // Convert tooltip callback string functions to actual functions
            if (chartData.options && chartData.options.plugins && chartData.options.plugins.tooltip) {
                const tooltip = chartData.options.plugins.tooltip;
                if (tooltip.callbacks) {
                    Object.keys(tooltip.callbacks).forEach(key => {
                        if (typeof tooltip.callbacks[key] === 'string' && tooltip.callbacks[key].startsWith('function')) {
                            try {
                                tooltip.callbacks[key] = eval('(' + tooltip.callbacks[key] + ')');
                            } catch (e) {
                                console.error('Error parsing tooltip callback function:', e);
                            }
                        }
                    });
                }
            }

            // Create new chart
            const ctx = canvas.getContext('2d');
            this.charts[containerId] = new Chart(ctx, {
                type: chartData.type,
                data: chartData.data,
                options: chartData.options || {}
            });
        },
        
        updateChart: function(selector, chartType, containerId) {
            
            // Find selectors - check both in chart controls and in modals
            let xcolumnSelector, regxcolumnSelector, ycolumnSelector, multiycolumnSelector, dateSelector, stringSelector, zcolumnSelector, colorSelector;
            
            // Selector might be in a modal, search globally
            xcolumnSelector = $('.ql-x-column-selector');
            regxcolumnSelector = $('.ql-reg-x-columns-selector');
            ycolumnSelector = $('.ql-y-column-selector');
            zcolumnSelector = $('.ql-z-column-selector');
            colorSelector = $('.ql-color-selector');
            multiycolumnSelector = $('.ql-multi-y-column-selector');
            dateSelector = $('.ql-date-column-selector');
            stringSelector = $('.ql-string-column-selector');

            switch (chartType) {
                case 'histogram': {
                    const columnName = xcolumnSelector.val();
                    if (columnName) {
                        this.loadChart(containerId, chartType, columnName);
                    }
                    break;
                }
                
                case 'stacked_area':
                case 'time_series': {
                    const xcolumnName = dateSelector.val();
                    const ycolumnName = multiycolumnSelector.val();
                    if (xcolumnName && ycolumnName) {
                        this.loadChart(containerId, chartType, xcolumnName, ycolumnName);
                    }
                    break;
                }
                
                case 'scatter': {
                    const xcolumnName = xcolumnSelector.val();
                    const ycolumnName = ycolumnSelector.val();
                    if (xcolumnName && ycolumnName) {
                        this.loadChart(containerId, chartType, xcolumnName, ycolumnName);
                    }
                    break;
                }
                
                case 'doughnut':
                case 'pie': {
                    const xcolumnName = stringSelector.val();
                    const ycolumnName = ycolumnSelector.val();
                    if (xcolumnName && ycolumnName) {
                        this.loadChart(containerId, chartType, xcolumnName, ycolumnName);
                    }
                    break;
                }
                
                case 'regression': {
                    const xcolumnName = regxcolumnSelector.val();
                    const ycolumnName = ycolumnSelector.val();
                    if (xcolumnName && ycolumnName) {
                        this.loadChart(containerId, chartType, xcolumnName, ycolumnName);
                    }
                    break;
                }
                
                case 'horizontal_bar':
                case 'bar': {
                    // Show aggregation selector if it exists
                    const aggSelector = selector.closest('.ql-chart-controls').find('.ql-aggregation-selector');
                    if (aggSelector.length) {
                        aggSelector.show();
                    }
                    
                    const categoryColumn = stringSelector.val();
                    const valueColumn = multiycolumnSelector.val();
                    if (categoryColumn && valueColumn) {
                        this.loadChart(containerId, chartType, categoryColumn, valueColumn);
                    }
                    break;
                }
                
                case 'violin': 
                case 'box_plot': {
                    // Box plot (categorical X, numerical Y)
                    const xcolumnName = stringSelector.val();  // categorical
                    const ycolumnName = ycolumnSelector.val(); // numerical
                    if (xcolumnName && ycolumnName) {
                        this.loadChart(containerId, chartType, xcolumnName, ycolumnName);
                    }
                    break;
                }
                
                case 'bubble': {
                    // Need x, y, size columns
                    const xcolumnName = xcolumnSelector.val();
                    const ycolumnName = ycolumnSelector.val();
                    const zcolumnName = zcolumnSelector.val();
                    const colorName = colorSelector.val();
                    if (xcolumnName && ycolumnName) {
                        this.loadChart(containerId, chartType, xcolumnName, ycolumnName, zcolumnName, colorName);
                    }
                    break;
                }
                
                case 'matrix':
                case 'heatmap': {
                    // Need x (categorical), y (categorical)
                    const xcolumnName = xcolumnSelector.val();
                    const ycolumnName = ycolumnSelector.val();
                    const zcolumnName = zcolumnSelector.val();
                    if (xcolumnName && ycolumnName) {
                        this.loadChart(containerId, chartType, xcolumnName, ycolumnName, zcolumnName);
                    }
                    break;
                }
                
                default:
                    this.loadChart(containerId, chartType);
            }

        },
        
        updateVisibility: function(selector, chartType, containerId) {
                        
            const xcolumnSelector = selector.closest('.ql-chart-controls').find('.ql-x-column-selector');
            const regxcolumnSelector = selector.closest('.ql-chart-controls').find('.ql-x-columns-trigger');
            const ycolumnSelector = selector.closest('.ql-chart-controls').find('.ql-y-column-selector');
            const multiycolumnSelector = selector.closest('.ql-chart-controls').find('.ql-y-columns-trigger');
            const dateSelector = selector.closest('.ql-chart-controls').find('.ql-date-column-selector');
            const stringSelector = selector.closest('.ql-chart-controls').find('.ql-string-column-selector');
            const zcolumnSelector = selector.closest('.ql-chart-controls').find('.ql-z-column-selector');
            const colorSelector = selector.closest('.ql-chart-controls').find('.ql-color-selector');
            const aggSelector = $('.ql-aggregation-selector');
            const cumulSelector = $('.ql-cumul-control');

            switch (chartType) {
                case 'histogram':
                    xcolumnSelector.show();
                    regxcolumnSelector.hide();
                    ycolumnSelector.hide();
                    multiycolumnSelector.hide();
                    dateSelector.hide();
                    stringSelector.hide();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.hide();
                    cumulSelector.hide();
                    break;
                    
                case 'time_series':
                case 'stacked_area':
                    dateSelector.show();
                    stringSelector.hide();
                    xcolumnSelector.hide();
                    regxcolumnSelector.hide();
                    ycolumnSelector.hide();
                    multiycolumnSelector.show();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.show();
                    cumulSelector.show();
                    break;
                    
                case 'scatter':
                    dateSelector.hide();
                    stringSelector.hide();
                    xcolumnSelector.show();
                    regxcolumnSelector.hide();
                    ycolumnSelector.show();
                    multiycolumnSelector.hide();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.hide();
                    cumulSelector.hide();
                    break;
                    
                case 'doughnut':
                case 'pie':
                    dateSelector.hide();
                    stringSelector.show();
                    xcolumnSelector.hide();
                    regxcolumnSelector.hide();
                    ycolumnSelector.show();
                    multiycolumnSelector.hide();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.hide();
                    cumulSelector.hide();
                    break;
                    
                case 'regression':
                    dateSelector.hide();
                    stringSelector.hide();
                    xcolumnSelector.hide();
                    regxcolumnSelector.show();
                    ycolumnSelector.show();
                    multiycolumnSelector.hide();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.hide();
                    cumulSelector.hide();
                    break;
                    
                case 'horizontal_bar':
                case 'bar':
                    dateSelector.hide();
                    xcolumnSelector.hide();
                    regxcolumnSelector.hide();
                    stringSelector.show();
                    ycolumnSelector.hide();
                    multiycolumnSelector.show();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.show();
                    cumulSelector.hide();
                    break;
                    
                case 'violin':
                case 'box_plot':
                    // Box plot: categorical x, numerical y
                    dateSelector.hide();
                    stringSelector.show();  // x = categorical
                    xcolumnSelector.hide();
                    regxcolumnSelector.hide();
                    ycolumnSelector.show();  // y = numerical
                    multiycolumnSelector.hide();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.hide();
                    cumulSelector.hide();
                    break;
                    
                case 'bubble':
                    // Numerical x, y, and size
                    dateSelector.hide();
                    stringSelector.hide();
                    xcolumnSelector.show();  // x = numerical
                    regxcolumnSelector.hide();
                    ycolumnSelector.show();  // y = numerical
                    multiycolumnSelector.hide();
                    // Note: size and color selectors would need to be shown if they exist
                    zcolumnSelector.show();
                    colorSelector.show();
                    aggSelector.hide();
                    cumulSelector.hide();
                    break;
                    
                case 'matrix':
                case 'heatmap':
                    // Categorical x, categorical y, numerical z
                    dateSelector.hide();
                    stringSelector.hide(); 
                    xcolumnSelector.show();
                    regxcolumnSelector.hide();
                    ycolumnSelector.show();
                    multiycolumnSelector.hide();
                    zcolumnSelector.show();
                    colorSelector.hide();
                    aggSelector.show();
                    cumulSelector.hide();
                    break;
                    
                default:
                    ycolumnSelector.hide();
                    multiycolumnSelector.hide();
                    xcolumnSelector.hide();
                    regxcolumnSelector.hide();
                    dateSelector.hide();
                    stringSelector.hide();
                    zcolumnSelector.hide();
                    colorSelector.hide();
                    aggSelector.hide();
                    cumulSelector.hide();
            }

        },

        handleChartChange: function(e) {
            const selector = $(e.target);
            const chartType = selector.val();
            const containerId = selector.data('container');
            
            this.updateVisibility(selector, chartType, containerId);
            this.updateChart(selector, chartType, containerId);
        },
        
        handleControlChange: function(e) {
            const selector = $(e.target);
            const chartTypeSelector = $('.ql-chart-controls').find('.ql-chart-type-selector');
            const chartType = chartTypeSelector.val();
            const containerId = chartTypeSelector.data('container');
            
            this.updateChart(chartTypeSelector, chartType, containerId);
        },

        showCorrelationMatrix: function() {
            const modal = $('#ql-correlation-modal');
            const content = modal.find('.ql-modal-content');
            
            content.html('<div class="ql-loading">Calculating correlations...</div>');
            modal.addClass('show');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_correlation_matrix',
                    nonce: qlAuth.nonce,
                    dataset_id: this.currentDatasetId
                },
                success: (response) => {
                    if (response.success) {
                        this.renderCorrelationMatrix(response.data);
                    } else {
                        content.html('<div class="ql-error">Error loading correlation matrix</div>');
                    }
                },
                error: () => {
                    content.html('<div class="ql-error">Failed to load correlation matrix</div>');
                }
            });
        },
        
        createRecommendedCharts: function() {
            const container = document.getElementById('recommended-charts');
            if (!container) return; // safe no-op on pages without the panel

            const datasetId = this.currentDatasetId || this.getDatasetIdFromURL();
            if (!datasetId) return;

            container.innerHTML = '<div class="ql-loading">Loading recommended charts\u2026</div>';

            const self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: {
                    action: 'ql_get_recommended_charts',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId,
                    max_charts: 20
                },
                success: function(response) {
                    if (!response.success) {
                        const msg = (response.data && response.data.message) || 'Unknown error';
                        container.innerHTML = '<div class="ql-error">Error loading recommended charts: ' + msg + '</div>';
                        return;
                    }

                    const recommendations = response.data;
                    container.innerHTML = '';

                    const charts = recommendations.charts || [];
                    if (charts.length === 0) {
                        const noChartsMsg = document.createElement('div');
                        noChartsMsg.className = 'ql-analytics-section';
                        noChartsMsg.innerHTML = '<p style="color: #666; text-align: center;">No high-insight charts found. Try adjusting the insight score threshold.</p>';
                        container.appendChild(noChartsMsg);
                        return;
                    }

                    // Single grid wrapper — shares layout rules with
                    // .ql-saved-charts-grid so the recommended and saved
                    // palettes match (see analytics-*.css).
                    const grid = document.createElement('div');
                    grid.className = 'ql-recommended-charts-grid';
                    container.appendChild(grid);

                    charts.forEach(function(chart, index) {
                        // Stash the chart so handleRecommendedChartClick can look it up by index.
                        self.recommendedCharts[index] = chart;

                        const chartContainer = document.createElement('div');
                        chartContainer.className = 'ql-recommended-chart-wrapper';
                        chartContainer.style.cursor = 'pointer';
                        chartContainer.dataset.recIndex = index;

                        const header = document.createElement('h3');
                        header.className = 'ql-saved-chart-title';
                        header.textContent = chart.reason;

                        const scoreBadge = document.createElement('div');
                        scoreBadge.className = 'ql-insight-badge positive';
                        scoreBadge.style.marginBottom = '15px';
                        scoreBadge.textContent = 'Insight Score: ' + Math.round(chart.insight_score);

                        // Canvas wrapper with a unique ID — renderChart() will
                        // create the canvas inside it and rehydrate any
                        // PHP-serialized function strings (e.g. matrix heatmaps).
                        const canvasWrapper = document.createElement('div');
                        canvasWrapper.className = 'ql-chart-container';
                        canvasWrapper.id = 'ql-recommended-chart-' + index;

                        chartContainer.appendChild(header);
                        chartContainer.appendChild(scoreBadge);
                        chartContainer.appendChild(canvasWrapper);
                        grid.appendChild(chartContainer);

                        self.renderChart(canvasWrapper.id, chart.chart_data);
                    });

                    console.log('Analysis summary:', recommendations.analysis_summary);
                },
                error: function(xhr, status, error) {
                    container.innerHTML = '<div class="ql-error">Error loading recommended charts: ' + error + '</div>';
                }
            });
        },

        renderCorrelationMatrix: function(data) {
            if (data.error) {
                $('#ql-correlation-modal .ql-modal-content').html(
                    '<div class="ql-error">' + data.error + '</div>'
                );
                return;
            }
            
            const columns = data.columns;
            const matrix = data.matrix;

            let html = '<div class="ql-correlation-results">';
            html += '<div id="correlation-heatmap"></div>';
            html += '<p>Pearson Correlation Coefficients between numeric columns:</p>';
            html += '<div class="ql-correlation-table-wrapper">';
            html += '<table class="ql-correlation-table"><thead><tr><th></th>';

            // Header row
            columns.forEach(col => {
                html += '<th>' + this.escapeHtml(col) + '</th>';
            });
            html += '</tr></thead><tbody>';

            // Data rows
            columns.forEach((rowCol, i) => {
                html += '<tr><th>' + this.escapeHtml(rowCol) + '</th>';
                columns.forEach((colCol, j) => {
                    const value = matrix[i][j];
                    const color = this.getCorrelationColor(value);
                    html += '<td style="background-color: ' + color + '">' + value.toFixed(3) + '</td>';
                });
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            html += '<div id="correlation-strength"></div>';
            html += '</div>';

            $('#ql-correlation-modal .ql-modal-content').html(html);

            // Optional: Render a heatmap visualization
            this.renderCorrelationHeatmap(columns, matrix);
        },

        getCorrelationColor: function(value) {
            // Color scale: strong negative (red) to neutral (white) to strong positive (blue)
            const abs = Math.abs(value);
            if (value > 0) {
                const intensity = Math.floor(abs * 200);
                return 'rgba(33, 150, 243, ' + (abs * 0.8) + ')';
            } else {
                const intensity = Math.floor(abs * 200);
                return 'rgba(244, 67, 54, ' + (abs * 0.8) + ')';
            }
        },

        renderCorrelationHeatmap: function(columns, matrix) {
            // Create a simple heatmap visualization
            const container = document.getElementById('correlation-heatmap');
            const container2 = document.getElementById('correlation-strength');
            const canvas = document.createElement('canvas');
            const canvas2 = document.createElement('canvas');
            container.appendChild(canvas);
            container2.appendChild(canvas2);

            // Prepare data for Chart.js heatmap (using bubble chart)
            const data = [];
            columns.forEach((rowCol, i) => {
                columns.forEach((colCol, j) => {
                    data.push({
                        x: j,
                        y: columns.length-i,
                        r: Math.abs(matrix[i][j]) * 10,
                        value: matrix[i][j]
                    });
                });
            });

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'bubble',
                data: {
                    datasets: [{
                        label: 'Correlation',
                        data: data,
                        backgroundColor: data.map(d => this.getCorrelationColor(d.value))
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Correlation Heatmap'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const d = context.raw;
                                    return columns[d.y] + ' vs ' + columns[d.x] + ': ' + d.value.toFixed(3);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    return columns[value] || '';
                                }
                            },
                            min: -0.5,
                            max: columns.length - 0.5
                        },
                        y: {
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    return columns[value] || '';
                                }
                            },
                            min: -0.5,
                            max: columns.length - 0.5
                        }
                    }
                }
            });
            
            const strongCorrelations = [];
            for (let i = 0; i < columns.length; i++) {
                for (let j = i + 1; j < columns.length; j++) {
                    const value = Math.abs(matrix[i][j]);
                    if (value > 0.5 && value < 0.99) {
                        strongCorrelations.push({
                            pair: columns[i] + ' ↔ ' + columns[j],
                            value: matrix[i][j]
                        });
                    }
                }
            }

            strongCorrelations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
            strongCorrelations.splice(10); // Top 10

            if (strongCorrelations.length > 0) {
                const ctx = canvas2.getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: strongCorrelations.map(c => c.pair),
                        datasets: [{
                            label: 'Correlation Coefficient',
                            data: strongCorrelations.map(c => c.value),
                            backgroundColor: strongCorrelations.map(c => 
                                c.value > 0 ? '#4CAF50' : '#F44336'
                            )
                        }]
                    },
                    options: {
                        responsive: true,
                        indexAxis: 'y',
                        plugins: {
                            title: {
                                display: true,
                                text: 'Top 10 Correlations'
                            }
                        },
                        scales: {
                            x: {
                                min: -1,
                                max: 1
                            }
                        }
                    }
                });
            }
        },

        showPCAAnalysis: function() {
            const modal = $('#ql-pca-modal');
            const content = modal.find('.ql-modal-content');
            
            content.html('<div class="ql-loading">Performing PCA analysis...</div>');
            modal.addClass('show');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_pca_analysis',
                    nonce: qlAuth.nonce,
                    dataset_id: this.currentDatasetId,
                    n_components: 3
                },
                success: (response) => {
                    if (response.success) {
                        this.renderPCAResults(response.data);
                    } else {
                        content.html('<div class="ql-error">Error performing PCA</div>');
                    }
                },
                error: () => {
                    content.html('<div class="ql-error">Failed to perform PCA</div>');
                }
            });
        },

        renderPCAResults: function(data) {
            
            if (data.error) {
                $('#ql-pca-modal .ql-modal-content').html(
                    '<div class="ql-error">' + data.error + '</div>'
                );
                return;
            }
            
            let html = '<div class="ql-pca-results">';
            html += '<h3>Principal Component Analysis</h3>';
            html += '<p><strong>Number of orthogonal components identified:</strong> ' + data.n_components + '</p>';

            // Explained variance table
            html += '<h3>Explained Variance</h3>';
            html += '<table class="ql-stats-table">';
            html += '<thead><tr><th>Component</th><th>Variance</th><th>Variance Ratio</th><th>Cumulative</th></tr></thead>';
            html += '<tbody>';

            let cumulative = 0;
            data.explained_variance_ratio.forEach((ratio, i) => {
                cumulative += ratio;
                html += '<tr>';
                html += '<td>PC' + (i + 1) + '</td>';
                html += '<td>' + data.explained_variance[i].toFixed(4) + '</td>';
                html += '<td>' + (ratio * 100).toFixed(2) + '%</td>';
                html += '<td>' + (cumulative * 100).toFixed(2) + '%</td>';
                html += '</tr>';
            })
            html += '</tbody></table>';

           // Scree plot
            html += '<div id="pca-scree-plot"></div>';

            // Scatter plot (if 2+ components)
            if (data.n_components >= 2) {
                html += '<div id="pca-scatter-plot"></div>';
            }

            // Components table
            html += '<h3>Component Loadings</h3>';
            html += '<table class="ql-stats-table">';
            html += '<thead><tr><th>Feature</th>';
            data.components.forEach((_, i) => {
                html += '<th>PC' + (i + 1) + '</th>';
            });
            html += '</tr></thead><tbody>';

            data.feature_names.forEach((feature, i) => {
                html += '<tr><td><strong>' + this.escapeHtml(feature) + '</strong></td>';
                data.components.forEach(component => {
                    html += '<td>' + component[i].toFixed(4) + '</td>';
                });
                html += '</tr>';
            })
            html += '</table>';


            html += '</div>';

            $('#ql-pca-modal .ql-modal-content').html(html);

            // Render scree plot
            this.renderScreePlot(data.explained_variance_ratio);

            // Render scatter plot
            if (data.n_components >= 2 && data.transformed_data) {
                this.renderPCAScatter(data.transformed_data);
            }
        },

        renderScreePlot: function(varianceRatio) {
            const container = document.getElementById('pca-scree-plot');
            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: varianceRatio.map((_, i) => 'PC' + (i + 1)),
                    datasets: [{
                        label: 'Explained Variance Ratio',
                        data: varianceRatio.map(v => v * 100),
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Scree Plot'
                        }
                    },
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: 'Variance Explained (%)'
                            },
                            beginAtZero: true
                        }
                    }
                }
            });
        },

        renderPCAScatter: function(transformedData) {
            const container = document.getElementById('pca-scatter-plot');
            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            // Sample data if too many points
            const sampleSize = Math.min(transformedData.length, 500);
            const sampledData = transformedData.slice(0, sampleSize);

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Data Points',
                        data: sampledData.map(point => ({
                            x: point[0],
                            y: point[1]
                        })),
                        backgroundColor: 'rgba(33, 150, 243, 0.5)',
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'PCA: First Two Components'
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'PC1'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'PC2'
                            }
                        }
                    }
                }
            });
        },

        showAnovaAnalysis: function() {
            const modal = $('#ql-anova-modal');
            const content = modal.find('.ql-modal-content');
            
            content.html('<div class="ql-loading">Performing ANOVA analysis...</div>');
            modal.addClass('show');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_anova_analysis',
                    nonce: qlAuth.nonce,
                    dataset_id: this.currentDatasetId
                },
                success: (response) => {
                    if (response.success) {
                        this.renderAnovaResults(response.data);
                    } else {
                        content.html('<div class="ql-error">Error performing ANOVA analysis</div>');
                    }
                },
                error: () => {
                    content.html('<div class="ql-error">Failed to perform ANOVA analysis</div>');
                }
            });
        },

        renderAnovaResults: function(data) {
            const catColumns = data.categorical_columns;
            const numColumns = data.numerical_columns;
            const matrix = data.anova_matrix;
            
            if (data.error) {
                $('#ql-anova-modal .ql-modal-content').html(
                    '<div class="ql-error">' + data.error + '</div>'
                );
                return;
            }

            let html = '<div class="ql-anova-results">';
            html += '<h3>ANOVA Analysis Results</h3>';
            html += '<p>One-way ANOVA tests for all categorical columns against all numerical columns.</p>';
            html += '<p><strong>Sample Size:</strong> ' + data.sample_size + '</p>';
            
            // Legend
            html += '<div class="ql-anova-legend">';
            html += '<h4>Significance Levels:</h4>';
            html += '<span class="ql-sig-badge ql-sig-highly">***</span> p < 0.001 (Highly significant) ';
            html += '<span class="ql-sig-badge ql-sig-very">**</span> p < 0.01 (Very significant) ';
            html += '<span class="ql-sig-badge ql-sig-significant">*</span> p < 0.05 (Significant) ';
            html += '<span class="ql-sig-badge ql-sig-marginal">.</span> p < 0.1 (Marginally significant) ';
            html += '<span class="ql-sig-badge ql-sig-ns">ns</span> p ≥ 0.1 (Not significant)';
            html += '</div>';

            // ANOVA Matrix Table
            html += '<div class="ql-anova-table-wrapper">';
            html += '<table class="ql-anova-table"><thead><tr><th>Categorical / Numerical</th>';

            // Header row with numerical columns
            numColumns.forEach(col => {
                html += '<th>' + this.escapeHtml(col) + '</th>';
            });
            html += '</tr></thead><tbody>';

            // Data rows - one for each categorical column
            catColumns.forEach(catCol => {
                html += '<tr><th>' + this.escapeHtml(catCol) + '</th>';
                
                numColumns.forEach(numCol => {
                    const result = matrix[catCol][numCol];
                    
                    if (result.f_statistic !== null) {
                        const confidencePercent = (result.confidence_level * 100).toFixed(1);
                        const cellColor = this.getAnovaColor(result.confidence_level);
                        const sigBadge = this.getSignificanceBadge(result.significance);
                        
                        html += '<td style="background-color: ' + cellColor + '" class="ql-anova-cell">';
                        html += '<div class="ql-anova-cell-content">';
                        html += '<strong>' + confidencePercent + '%</strong> ' + sigBadge;
                        html += '<div class="ql-anova-details">';
                        html += 'F=' + result.f_statistic.toFixed(2) + ', ';
                        html += 'p=' + result.p_value.toFixed(4);
                        html += '</div>';
                        html += '</td>';
                    } else {
                        html += '<td class="ql-anova-cell-error">';
                        html += '<span class="ql-anova-error">' + result.significance + '</span>';
                        html += '</td>';
                    }
                });
                
                html += '</tr>';
            });

            html += '</tbody></table></div>';

            // Detailed Results Section
            html += '<h3>Detailed Results</h3>';
            html += '<div class="ql-anova-details-container">';
            
            catColumns.forEach(catCol => {
                html += '<div class="ql-anova-category-section">';
                html += '<h4>' + this.escapeHtml(catCol) + '</h4>';
                html += '<table class="ql-stats-table">';
                html += '<thead><tr>';
                html += '<th>Numerical Column</th>';
                html += '<th>F-Statistic</th>';
                html += '<th>p-value</th>';
                html += '<th>Confidence</th>';
                html += '<th>Significance</th>';
                html += '<th>Groups</th>';
                html += '<th>DF Between</th>';
                html += '<th>DF Within</th>';
                html += '</tr></thead><tbody>';
                
                numColumns.forEach(numCol => {
                    const result = matrix[catCol][numCol];
                    html += '<tr>';
                    html += '<td><strong>' + this.escapeHtml(numCol) + '</strong></td>';
                    
                    if (result.f_statistic !== null) {
                        html += '<td>' + result.f_statistic.toFixed(4) + '</td>';
                        html += '<td>' + result.p_value.toFixed(6) + '</td>';
                        html += '<td>' + (result.confidence_level * 100).toFixed(2) + '%</td>';
                        html += '<td>' + this.getSignificanceBadge(result.significance) + '</td>';
                        html += '<td>' + result.groups + '</td>';
                        html += '<td>' + result.df_between + '</td>';
                        html += '<td>' + result.df_within + '</td>';
                    } else {
                        html += '<td colspan="7" class="ql-anova-error">' + result.significance + '</td>';
                    }
                    
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                html += '</div>';
            });
            
            html += '</div>';

            // Visualization
            html += '<h3>Confidence Level Heatmap</h3>';
            html += '<div id="anova-heatmap"></div>';

            html += '</div>';

            $('#ql-anova-modal .ql-modal-content').html(html);

            // Render heatmap
            this.renderAnovaHeatmap(catColumns, numColumns, matrix);
        },

        getAnovaColor: function(confidenceLevel) {
            // Color gradient from white (low confidence) to green (high confidence)
            if (confidenceLevel >= 0.99) {
                return 'rgba(46, 125, 50, 0.8)'; // Dark green
            } else if (confidenceLevel >= 0.95) {
                return 'rgba(76, 175, 80, 0.7)'; // Green
            } else if (confidenceLevel >= 0.90) {
                return 'rgba(129, 199, 132, 0.6)'; // Light green
            } else if (confidenceLevel >= 0.80) {
                return 'rgba(255, 235, 59, 0.5)'; // Yellow
            } else {
                return 'rgba(239, 154, 154, 0.4)'; // Light red
            }
        },

        getSignificanceBadge: function(significance) {
            const badges = {
                '***': '<span class="ql-sig-badge ql-sig-highly">***</span>',
                '**': '<span class="ql-sig-badge ql-sig-very">**</span>',
                '*': '<span class="ql-sig-badge ql-sig-significant">*</span>',
                '.': '<span class="ql-sig-badge ql-sig-marginal">.</span>',
                'ns': '<span class="ql-sig-badge ql-sig-ns">ns</span>'
            };
            
            return badges[significance] || '<span class="ql-sig-badge ql-sig-error">' + significance + '</span>';
        },

        renderAnovaHeatmap: function(catColumns, numColumns, matrix) {
            const container = document.getElementById('anova-heatmap');
            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            // Prepare data for heatmap (using bubble chart)
            const data = [];
            catColumns.forEach((catCol, i) => {
                numColumns.forEach((numCol, j) => {
                    const result = matrix[catCol][numCol];
                    if (result.confidence_level !== null && result.confidence_level !== undefined) {
                        data.push({
                            x: j,
                            y: i,
                            r: 8,
                            confidence: result.confidence_level,
                            catCol: catCol,
                            numCol: numCol,
                            pValue: result.p_value,
                            fStat: result.f_statistic
                        });
                    }
                });
            });

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'bubble',
                data: {
                    datasets: [{
                        label: 'Confidence Level',
                        data: data,
                        backgroundColor: data.map(d => this.getAnovaColor(d.confidence))
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'ANOVA Confidence Levels Heatmap',
                            font: {
                                size: 16
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const d = context.raw;
                                    return [
                                        d.catCol + ' vs ' + d.numCol,
                                        'Confidence: ' + (d.confidence * 100).toFixed(1) + '%',
                                        'F-statistic: ' + d.fStat.toFixed(2),
                                        'p-value: ' + d.pValue.toFixed(4)
                                    ];
                                }
                            }
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    return numColumns[value] || '';
                                }
                            },
                            min: -0.5,
                            max: numColumns.length - 0.5,
                            title: {
                                display: true,
                                text: 'Numerical Columns'
                            }
                        },
                        y: {
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    return catColumns[value] || '';
                                }
                            },
                            min: -0.5,
                            max: catColumns.length - 0.5,
                            title: {
                                display: true,
                                text: 'Categorical Columns'
                            }
                        }
                    }
                }
            });
        },

        showStatisticalSummary: function() {
            const modal = $('#ql-stats-modal');
            const content = modal.find('.ql-modal-content');
            
            content.html('<div class="ql-loading">Calculating statistics...</div>');
            modal.addClass('show');

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_statistical_summary',
                    nonce: qlAuth.nonce,
                    dataset_id: this.currentDatasetId
                },
                success: (response) => {
                    if (response.success) {
                        this.renderStatisticalSummary(response.data);
                    } else {
                        content.html('<div class="ql-error">Error loading statistics</div>');
                    }
                },
                error: () => {
                    content.html('<div class="ql-error">Failed to load statistics</div>');
                }
            });
        },

        renderStatisticalSummary: function(data) {
            
            if (data.error) {
                $('#ql-stats-modal .ql-modal-content').html(
                    '<div class="ql-error">' + data.error + '</div>'
                );
                return;
            }
            const stats = data;
            
            let html = '<div class="ql-stats-summary">';
            html += '<h3>Statistical Summary</h3>';
            html += '<p><strong>Total Columns:</strong> ' + data.length + '</p>';
            
            html += '<table class="ql-stats-table">';
            html += '<thead><tr>';
            html += '<th>Column</th><th>Type</th><th>Count</th><th>Missing</th>';
            html += '<th>Unique / Mean</th><th>Top / Std</th><th>Min</th><th>Q1</th><th>Median</th><th>Q3</th><th>Max</th>';
            html += '</tr></thead><tbody>';

            stats.forEach(stat => {
                html += '<tr>';
                html += '<td><strong>' + this.escapeHtml(stat.column) + '</strong></td>';
                html += '<td>' + stat.type + '</td>';
                html += '<td>' + stat.count + '</td>';
                html += '<td>' + stat.missing + '</td>';
                
                // Unique/Mean column
                if (stat.mean !== undefined) {
                    html += '<td>' + stat.mean.toFixed(2) + '</td>';
                } else if (stat.unique !== undefined) {
                    html += '<td>' + stat.unique + '</td>';
                } else {
                    html += '<td>N/A</td>';
                }
                
                // Top/Std column
                if (stat.std !== undefined) {
                    html += '<td>' + stat.std.toFixed(2) + '</td>';
                } else if (stat.top !== undefined) {
                    html += '<td>' + this.escapeHtml(stat.top.substring(0, 20)) + '</td>';
                } else {
                    html += '<td>N/A</td>';
                }
                
                html += '<td>' + (stat.min !== undefined ? stat.min : 'N/A') + '</td>';
                html += '<td>' + (stat.q1 !== undefined ? stat.q1 : 'N/A') + '</td>';
                html += '<td>' + (stat.median !== undefined ? stat.median : 'N/A') + '</td>';
                html += '<td>' + (stat.q3 !== undefined ? stat.q3 : 'N/A') + '</td>';
                html += '<td>' + (stat.max !== undefined ? stat.max : 'N/A') + '</td>';
                
                html += '</tr>';
            });

            html += '</tbody></table></div>';

            $('#ql-stats-modal .ql-modal-content').html(html);
        },
        
        /**
         * NEW: Add save button to chart container
         */
        addSaveButton: function(containerId) {
            const container = $('#' + containerId);

            // Remove existing buttons if any
            container.find('.ql-save-chart-btn').remove();
            container.find('.ql-copy-link-btn').remove();

            // Add save button (floppy disk icon) in upper right corner
            const saveBtn = $('<button>', {
                'class': 'ql-save-chart-btn',
                'title': 'Save this chart',
                'data-container': containerId,
                'html': '💾'
            });

            // Add copy-link button to the left of the save button
            const linkBtn = $('<button>', {
                'class': 'ql-copy-link-btn',
                'title': 'Copy link to this chart',
                'data-container': containerId,
                'html': '🔗'
            });

            container.append(saveBtn);
            container.append(linkBtn);
        },

        /**
         * NEW: Handle save chart button click
         */
        handleSaveChart: function(e) {
            e.preventDefault();
            const containerId = $(e.currentTarget).data('container');
            const chartParams = this.currentChartParams[containerId];
            
            if (!chartParams) {
                alert('No chart to save');
                return;
            }
            
            // Prompt for chart name (optional)
            const chartName = prompt('Enter a name for this chart (optional):');
            
            const saveData = {
                action: 'ql_save_chart',
                nonce: qlAuth.nonce,
                dataset_id: this.currentDatasetId,
                chart_type: chartParams.chartType,
                chart_params: chartParams.postdata,
                chart_name: chartName || null
            };
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: saveData,
                success: (response) => {
                    if (response.success) {
                        this.loadSavedCharts(); // Reload saved charts
                    } else {
                        alert('Error: ' + (response.data.message || 'Failed to save chart'));
                    }
                },
                error: () => {
                    alert('Failed to save chart');
                }
            });
        },

        handleCopyChartLink: function(e) {
            e.preventDefault();
            var btn = $(e.currentTarget);
            var containerId = btn.data('container');
            var chartParams = this.currentChartParams[containerId];

            if (!chartParams) return;

            var postdata = chartParams.postdata;
            var skip = { action: true, nonce: true };
            var arrayKeys = { value_columns: true, x_columns: true };
            var urlParams = new URLSearchParams();

            Object.keys(postdata).forEach(function(key) {
                if (skip[key]) return;
                var val = postdata[key];
                if (val === null || val === undefined || val === '') return;
                if (arrayKeys[key]) {
                    var arr = Array.isArray(val) ? val : [val];
                    arr.forEach(function(v) { urlParams.append(key + '[]', v); });
                } else {
                    urlParams.set(key, val);
                }
            });

            var shareUrl = window.location.origin + '/ql-chart/?' + urlParams.toString();
            var originalHtml = btn.html();

            function showFeedback() {
                btn.html('✓');
                setTimeout(function() { btn.html(originalHtml); }, 1500);
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(shareUrl).then(showFeedback);
            } else {
                var ta = document.createElement('textarea');
                ta.value = shareUrl;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showFeedback();
            }
        },

        /**
         * NEW: Load and display saved charts
         */
        loadSavedCharts: function() {
            if (!this.currentDatasetId) return;
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_saved_charts',
                    nonce: qlAuth.nonce,
                    dataset_id: this.currentDatasetId
                },
                success: (response) => {
                    if (response.success) {
                        this.renderSavedCharts(response.data.charts);
                    }
                },
                error: () => {
                    console.error('Failed to load saved charts');
                }
            });
        },

        /**
         * NEW: Render saved charts in 2-column grid
         */
        renderSavedCharts: function(charts) {
            // Find or create saved charts container
            let savedChartsContainer = $('#ql-saved-charts-section');
            
            //if (savedChartsContainer.length === 0) {
                // Create saved charts section below the main chart row
            //    savedChartsContainer = $('<div>', {
            //        'id': 'ql-saved-charts-section',
            //        'class': 'ql-analytics-section'
            //    });
                
            //    const heading = $('<h2>').text('Saved Charts');
            //    savedChartsContainer.append(heading);
                
            //    const gridContainer = $('<div>', {
            //        'id': 'ql-saved-charts-grid',
            //        'class': 'ql-saved-charts-grid'
            //    });
            //    savedChartsContainer.append(gridContainer);
                
                // Insert after the main chart section
            //    $('.ql-chart-row').parent().after(savedChartsContainer);
            //}
            
            const gridContainer = $('#ql-saved-charts-grid');
            gridContainer.empty();
            
            if (!charts || charts.length === 0) {
                gridContainer.html('<p style="color: #666;">No saved charts yet.</p>');
                return;
            }
            
            // Render each saved chart
            charts.forEach((chart, index) => {
                const chartWrapper = $('<div>', {
                    'class': 'ql-saved-chart-wrapper',
                    'data-chart-id': chart.id,
                    'style': 'cursor: pointer;'
                });
                
                // Store chart data for later use
                this.savedCharts[chart.id] = chart;
                
                // Chart title
                const chartTitle = $('<div>', {
                    'class': 'ql-saved-chart-title',
                    'text': chart.chart_name || ('Saved Chart ' + (index + 1))
                });
                
                // Delete button
                const deleteBtn = $('<button>', {
                    'class': 'ql-delete-saved-chart-btn',
                    'data-chart-id': chart.id,
                    'title': 'Delete this chart',
                    'html': '×'
                });
                
                // Chart container
                const chartContainer = $('<div>', {
                    'id': 'saved-chart-' + chart.id,
                    'class': 'ql-chart-container'
                });
                
                chartWrapper.append(chartTitle);
                chartWrapper.append(deleteBtn);
                chartWrapper.append(chartContainer);
                gridContainer.append(chartWrapper);
                
                // Load the chart
                this.loadSavedChart(chart);
            });
        },

        /**
         * NEW: Load a single saved chart
         */
        loadSavedChart: function(chart) {
            const containerId = 'saved-chart-' + chart.id;
            const container = document.getElementById(containerId);
            
            if (!container) return;
            
            container.innerHTML = '<div class="ql-loading">Loading chart...</div>';
            
            let chartParams;
            try {
                // Check if chart_params is already an object or needs parsing
                if (typeof chart.chart_params === 'string') {
                    chartParams = JSON.parse(chart.chart_params);
                } else {
                    chartParams = chart.chart_params;
                }
            } catch (e) {
                console.error('Error parsing chart params:', e);
                console.error('Chart params value:', chart.chart_params);
                container.innerHTML = '<div class="ql-error">Error: Invalid chart data</div>';
                return;
            }

            chartParams.nonce = qlAuth.nonce;
            chartParams.action = 'ql_get_chart_data';
            chartParams.dataset_id = chart.dataset_id;
            chartParams.chart_type = chart.chart_type;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                },
                data: chartParams,
                success: (response) => {
                    if (response.success) {
                        this.renderChart(containerId, response.data, chart.chart_type);
                    } else {
                        container.innerHTML = '<div class="ql-error">Error loading chart</div>';
                    }
                },
                error: () => {
                    container.innerHTML = '<div class="ql-error">Failed to load chart</div>';
                }
            });
        },

        /**
         * Handle recommended chart click - reshape as a saved-chart-like
         * object and reuse loadSavedChartToCustom so all UI updates
         * (chart type selector, column selectors, save button, function
         * rehydration) come for free.
         */
        handleRecommendedChartClick: function(e) {
            const index = $(e.currentTarget).data('rec-index');
            const chart = this.recommendedCharts[index];
            if (!chart) {
                console.error('Recommended chart data not found for index:', index);
                return;
            }

            // loadSavedChartToCustom accepts either a string or object for
            // chart_params, so we can pass the params object straight through.
            const fakeSaved = {
                chart_type:   chart.chart_type,
                chart_params: chart.params,
                dataset_id:   this.currentDatasetId
            };
            this.loadSavedChartToCustom(fakeSaved);

            // Scroll to the custom-chart slot so the user sees the result.
            const target = document.getElementById('custom-chart');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },

        /**
         * NEW: Handle saved chart click - load into custom-chart div
         */
        handleSavedChartClick: function(e) {
            // Prevent action if clicking delete button
            if ($(e.target).hasClass('ql-delete-saved-chart-btn')) {
                return;
            }
            
            const chartId = $(e.currentTarget).data('chart-id');
            const chart = this.savedCharts[chartId];
            
            if (!chart) {
                console.error('Chart data not found for ID:', chartId);
                return;
            }
            
            // Load the chart into custom-chart div
            this.loadSavedChartToCustom(chart);
        },

        /**
         * NEW: Load a saved chart into the custom-chart div
         */
        loadSavedChartToCustom: function(chart) {
            const containerId = 'custom-chart';
            const container = document.getElementById(containerId);
            
            if (!container) {
                console.error('custom-chart container not found');
                return;
            }
            
            container.innerHTML = '<div class="ql-loading">Loading chart...</div>';
            
            let chartParams;
            try {
                // Check if chart_params is already an object or needs parsing
                if (typeof chart.chart_params === 'string') {
                    chartParams = JSON.parse(chart.chart_params);
                } else {
                    chartParams = chart.chart_params;
                }
            } catch (e) {
                console.error('Error parsing chart params:', e);
                container.innerHTML = '<div class="ql-error">Error: Invalid chart data</div>';
                return;
            }

            chartParams.nonce = qlAuth.nonce;
            chartParams.action = 'ql_get_chart_data';
            chartParams.dataset_id = chart.dataset_id;
            chartParams.chart_type = chart.chart_type;

            // Store current chart params for the save button
            this.currentChartParams[containerId] = {
                chartType: chart.chart_type,
                postdata: chartParams
            };
            
            // Update the chart type selector to match the loaded chart
            const chartTypeSelector = $('.ql-chart-type-selector[data-container="custom-chart"]');
            if (chartTypeSelector.length) {
                chartTypeSelector.val(chart.chart_type);
                // Trigger visibility update for the controls
                this.updateVisibility(chartTypeSelector, chart.chart_type, containerId);
            }
            
            // Update column selectors based on chart params
            this.updateColumnSelectorsFromParams(chartParams, chart.chart_type);
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: chartParams,
                success: (response) => {
                    if (response.success) {
                        this.renderChart(containerId, response.data, chart.chart_type);
                        this.addSaveButton(containerId);
                    } else {
                        container.innerHTML = '<div class="ql-error">Error loading chart</div>';
                    }
                },
                error: () => {
                    container.innerHTML = '<div class="ql-error">Failed to load chart</div>';
                }
            });
        },

        /**
         * NEW: Update column selectors based on loaded chart params
         */
        updateColumnSelectorsFromParams: function(params, chartType) {
            const chartControls = $('.ql-chart-controls');
            
            // Update based on chart type
            switch(chartType) {
                case 'histogram':
                    if (params.column_name) {
                        chartControls.find('.ql-x-column-selector').val(params.column_name);
                    }
                    break;
                    
                case 'time_series':
                case 'stacked_area':
                    if (params.time_column) {
                        chartControls.find('.ql-date-column-selector').val(params.time_column);
                    }
                    if (params.value_columns && params.value_columns.length) {
                        const multiYSelector = chartControls.find('#ql-multi-y-column-selector');
                        multiYSelector.val(params.value_columns);
                        this.updateMultiSelectButtonLabel('yColumns');
                    }
                    if (params.aggregation) {
                        $('.ql-aggregation-selector').val(params.aggregation);
                    }
                    if (params.cumulative) {
                        $('.ql-cumul-selector').prop('checked', params.cumulative == 1);
                    }
                    break;
                    
                case 'scatter':
                    if (params.x_column) {
                        chartControls.find('.ql-x-column-selector').val(params.x_column);
                    }
                    if (params.y_column) {
                        chartControls.find('.ql-y-column-selector').val(params.y_column);
                    }
                    break;
                    
                case 'pie':
                case 'doughnut':
                    if (params.category_column) {
                        chartControls.find('.ql-string-column-selector').val(params.category_column);
                    }
                    if (params.value_column) {
                        chartControls.find('.ql-y-column-selector').val(params.value_column);
                    }
                    break;
                    
                case 'bar':
                case 'horizontal_bar':
                    if (params.category_column) {
                        chartControls.find('.ql-string-column-selector').val(params.category_column);
                    }
                    if (params.value_columns && params.value_columns.length) {
                        const multiYSelector = chartControls.find('#ql-multi-y-column-selector');
                        multiYSelector.val(params.value_columns);
                        this.updateMultiSelectButtonLabel('yColumns');
                    }
                    if (params.aggregation) {
                        chartControls.find('.ql-aggregation-selector').val(params.aggregation);
                    }
                    break;
                    
                case 'regression':
                    if (params.x_columns && params.x_columns.length) {
                        const regXSelector = chartControls.find('#ql-reg-x-columns-selector');
                        regXSelector.val(params.x_columns);
                        this.updateMultiSelectButtonLabel('xColumns');
                    }
                    if (params.y_column) {
                        chartControls.find('.ql-y-column-selector').val(params.y_column);
                    }
                    break;
                    
                case 'box_plot':
                case 'violin':
                    if (params.x_column) {
                        chartControls.find('.ql-string-column-selector').val(params.x_column);
                    }
                    if (params.y_column) {
                        chartControls.find('.ql-y-column-selector').val(params.y_column);
                    }
                    break;
                    
                case 'bubble':
                    if (params.x_column) {
                        chartControls.find('.ql-x-column-selector').val(params.x_column);
                    }
                    if (params.y_column) {
                        chartControls.find('.ql-y-column-selector').val(params.y_column);
                    }
                    if (params.size_column) {
                        chartControls.find('.ql-z-column-selector').val(params.size_column);
                    }
                    if (params.color_column) {
                        chartControls.find('.ql-color-selector').val(params.color_column);
                    }
                    break;
                    
                case 'matrix':
                case 'heatmap':
                    if (params.x_column) {
                        chartControls.find('.ql-x-column-selector').val(params.x_column);
                    }
                    if (params.y_column) {
                        chartControls.find('.ql-y-column-selector').val(params.y_column);
                    }
                    if (params.z_column) {
                        chartControls.find('.ql-z-column-selector').val(params.z_column);
                    }
                    if (params.aggregation) {
                        chartControls.find('.ql-aggregation-selector').val(params.aggregation);
                    }
                    break;
            }
            
            // Update filter selectors if present
            if (params.filter_category_column) {
                chartControls.find('.ql-filter-column-selector').val(params.filter_category_column);
            }
            if (params.filter_category_value) {
                chartControls.find('.ql-filter-value').val(params.filter_category_value);
            }
        },

        /**
         * NEW: Handle delete saved chart button click
         */
        handleDeleteSavedChart: function(e) {
            e.preventDefault();
            const chartId = $(e.currentTarget).data('chart-id');
            
            if (!confirm('Are you sure you want to delete this saved chart?')) {
                return;
            }
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_delete_saved_chart',
                    nonce: qlAuth.nonce,
                    chart_id: chartId
                },
                success: (response) => {
                    if (response.success) {
                        this.loadSavedCharts(); // Reload saved charts
                    } else {
                        alert('Error: ' + (response.data.message || 'Failed to delete chart'));
                    }
                },
                error: () => {
                    alert('Failed to delete chart');
                }
            });
        },


        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        initChartPage: function() {
            var params = new URLSearchParams(window.location.search);
            var containerId = 'ql-chart-container';

            // Create container if not present in page HTML
            if (!document.getElementById(containerId)) {
                $('body').append('<div id="' + containerId + '"></div>');
            }

            var container = document.getElementById(containerId);

            // Require minimum params
            var datasetId = params.get('dataset_id');
            var chartType = params.get('chart_type');
            if (!datasetId || !chartType) {
                container.innerHTML = '<div class="ql-error">Missing required parameters: dataset_id and chart_type</div>';
                return;
            }

            // Build POST data with required fields
            var postdata = {
                action: 'ql_get_chart_data',
                nonce: qlAuth.nonce,
                dataset_id: datasetId,
                chart_type: chartType
            };

            // Whitelisted scalar parameters
            var scalarKeys = [
                'column_name',
                'x_column', 'y_column', 'z_column',
                'time_column', 'color_column', 'size_column',
                'category_column', 'value_column',
                'aggregation', 'interval', 'cumulative', 'limit',
                'filter_category_column', 'filter_category_value',
                'filter_date_column', 'filter_date_from', 'filter_date_to'
            ];

            // Whitelisted array parameters
            var arrayKeys = ['value_columns', 'x_columns'];

            scalarKeys.forEach(function(key) {
                var val = params.get(key);
                if (val !== null) {
                    postdata[key] = val;
                }
            });

            arrayKeys.forEach(function(key) {
                var values = params.getAll(key + '[]');
                if (values.length === 0) {
                    var single = params.get(key);
                    if (single !== null) {
                        values = [single];
                    }
                }
                if (values.length > 0) {
                    postdata[key] = values;
                }
            });

            container.innerHTML = '<div class="ql-loading">Loading chart...</div>';

            var self = this;
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: (function() { var t = QLAuth.getSessionToken(); return t ? { 'Authorization': 'Bearer ' + t } : {}; })(),
                data: postdata,
                success: function(response) {
                    if (response.success) {
                        self.renderChart(containerId, response.data);
                    } else {
                        var msg = (response.data && response.data.message)
                            ? response.data.message
                            : 'Error loading chart';
                        container.innerHTML = '<div class="ql-error">' + self.escapeHtml(msg) + '</div>';
                    }
                },
                error: function() {
                    container.innerHTML = '<div class="ql-error">Failed to load chart</div>';
                }
            });
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        QLAnalytics.init();
    });

    // Modal close handlers
    $('.ql-modal-close, .ql-modal-backdrop').on('click', function() {
        $(this).closest('.ql-modal').removeClass('show');
    });

    // Expose to global scope
    window.QLAnalytics = QLAnalytics;

})(jQuery);
