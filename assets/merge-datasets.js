/**
 * QuantumLayers Merged Datasets UI - JavaScript
 * File: assets/merge-datasets.js
 * 
 * Handles the UI for creating and managing merged datasets via AJAX
 */

jQuery(document).ready(function($) {
    
    const QLMergeDatasets = {
        
        // State
        selectedDatasets: [],
        availableDatasets: [],
        datasetColumns: {},
        editMode: false,
        editDatasetId: null,
        
        /**
         * Initialize the merge datasets UI
         */
        init: function() {
            this.bindEvents();
            this.loadAvailableDatasets();
            // checkEditMode is called after datasets load in loadAvailableDatasets callback
        },
        
        /**
         * Bind event handlers
         */

        checkEditMode: function() {
            const urlParams = new URLSearchParams(window.location.search);
            const datasetId = urlParams.keys().next().value || window.location.search.replace('?', '');
            
            if (datasetId && !isNaN(datasetId)) {
                this.editMode = true;
                this.editDatasetId = parseInt(datasetId);
                this.loadMergedDataset();
            }
        },

        loadMergedDataset: function() {
            const self = this;
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_merged_dataset',
                    nonce: qlAuth.nonce,
                    dataset_id: this.editDatasetId
                },
                success: function(response) {
                    if (response.success) {
                        const md = response.data.merged_dataset;
                        const joins = response.data.joins || [];
                        
                        // Set the merge name
                        $('#merge-name').val(md.name);
                        $('#create-merge-btn').text('Update Merged Dataset');
                        
                        // Build a unique list of dataset IDs from joins
                        const datasetIds = new Set();
                        joins.forEach(join => {
                            datasetIds.add(join.left_dataset_id);
                            datasetIds.add(join.right_dataset_id);
                        });
                        
                        // Select all datasets involved in the merge
                        const datasetIdsArray = Array.from(datasetIds);
                        let selectedCount = 0;
                        
                        datasetIdsArray.forEach((datasetId, index) => {
                            const $checkbox = $('.dataset-checkbox[value="' + datasetId + '"]');
                            if ($checkbox.length) {
                                // Temporarily store that we're in edit mode to prevent auto-calculation
                                $checkbox.data('skip-auto-select', true);
                                $checkbox.prop('checked', true).trigger('change');
                                selectedCount++;
                                
                                // After change event, restore join parameters
                                if (selectedCount === datasetIdsArray.length) {
                                    // All datasets selected, now set join parameters
                                    setTimeout(() => {
                                        self.applyJoinParameters(joins);
                                    }, 100);
                                }
                            }
                        });
                    }
                },
                error: function(xhr) {
                    console.error('Failed to load merged dataset:', xhr);
                    self.showError('Failed to load merged dataset: ' + (xhr.responseJSON?.data?.message || 'Unknown error'));
                }
            });
        },
        
        /**
         * Apply join parameters after datasets are selected
         */
        applyJoinParameters: function(joins) {
            const self = this;
            
            // Wait for all columns to be loaded
            const checkInterval = setInterval(() => {
                let allColumnsLoaded = true;
                
                // Check if all selected datasets have their columns loaded
                self.selectedDatasets.forEach(datasetId => {
                    if (!self.datasetColumns[datasetId]) {
                        allColumnsLoaded = false;
                    }
                });
                
                if (allColumnsLoaded) {
                    clearInterval(checkInterval);
                    
                    // Now apply the join parameters
                    joins.forEach((join, index) => {
                        // Find the dataset item for the right dataset (the one that has join config UI)
                        const $item = $('.dataset-item[data-dataset-id="' + join.right_dataset_id + '"]');
                        
                        if ($item.length) {
                            // Set join column
                            const $columnSelect = $item.find('.join-column-select');
                            if ($columnSelect.length && $columnSelect.find('option').length > 1) {
                                $columnSelect.val(join.join_column);
                            }
                            
                            // Set join type
                            const $typeSelect = $item.find('.join-type-select');
                            if ($typeSelect.length) {
                                $typeSelect.val(join.join_type);
                            }
                        }
                    });
                    
                    console.log('Join parameters applied successfully');
                }
            }, 100); // Check every 100ms
            
            // Safety timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
            }, 5000);
        },

        bindEvents: function() {
            // Dataset selection
            $(document).on('change', '.dataset-checkbox', this.handleDatasetSelection.bind(this));
            
            // Join column selection
            $(document).on('change', '.join-column-select', this.handleJoinColumnChange.bind(this));
            
            // Create merge button
            $('#create-merge-btn').on('click', this.createMergedDataset.bind(this));
            
            // View merge config button
            $(document).on('click', '.view-merge-config-btn', this.viewMergeConfig.bind(this));
            
            // Delete merge button
            $(document).on('click', '.delete-merge-btn', this.deleteMergedDataset.bind(this));
            
            // Refresh datasets
            $('#refresh-datasets-btn').on('click', this.loadAvailableDatasets.bind(this));
        },
        
        /**
         * Load available datasets for merging
         */
        loadAvailableDatasets: function() {
            const self = this;
            
            $('#loading-datasets').show();
            $('#datasets-list').hide();
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_available_datasets',
                    nonce: qlAuth.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.availableDatasets = response.data.datasets;
                        self.renderDatasetList();
                        // Check edit mode after datasets are rendered
                        self.checkEditMode();
                    } else {
                        self.showError('Failed to load datasets: ' + response.data.message);
                    }
                },
                error: function() {
                    self.showError('Error loading datasets');
                },
                complete: function() {
                    $('#loading-datasets').hide();
                    $('#datasets-list').show();
                }
            });
        },
        
        /**
         * Render the list of available datasets
         */
        renderDatasetList: function() {
            const $list = $('#datasets-list');
            $list.empty();
            
            if (this.availableDatasets.length === 0) {
                $list.html('<p class="no-datasets">No datasets available for merging. Please upload or connect datasets first.</p>');
                return;
            }
            
            this.availableDatasets.forEach(dataset => {
                const $item = $(`
                    <div class="dataset-item" data-dataset-id="${dataset.id}">
                        <label class="dataset-label">
                            <input type="checkbox" 
                                   class="dataset-checkbox" 
                                   value="${dataset.id}"
                                   data-name="${dataset.name}">
                            <span class="dataset-name">${dataset.name}</span>
                            <span class="dataset-meta">
                                (${dataset.column_count} columns, ${this.formatNumber(dataset.row_count)} rows)
                            </span>
                        </label>
                        
                        <div class="join-config" style="display: none;">
                            <div class="join-config-inner">
                                <label class="join-label">
                                    Join Column:
                                    <select class="join-column-select" data-dataset-id="${dataset.id}">
                                        <option value="">-- Select Column --</option>
                                    </select>
                                </label>
                                
                                <label class="join-label join-type-label">
                                    Join Type:
                                    <select class="join-type-select" data-dataset-id="${dataset.id}">
                                        <option value="inner">Inner Join (matching rows only)</option>
                                        <option value="left">Left Join (all from left + matches)</option>
                                        <option value="right">Right Join (all from right + matches)</option>
                                        <option value="outer">Outer Join (all rows from both)</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                `);
                
                $list.append($item);
            });
        },
        
        /**
         * Handle dataset selection checkbox
         */
        handleDatasetSelection: function(e) {
            const $checkbox = $(e.target);
            const datasetId = parseInt($checkbox.val());
            const $item = $checkbox.closest('.dataset-item');
            const $config = $item.find('.join-config');
            
            if ($checkbox.is(':checked')) {
                // Add to selected datasets
                this.selectedDatasets.push(datasetId);
                
                // Load columns for this dataset
                this.loadDatasetColumns(datasetId);
                
                // Show join configuration only if this is not the first (base) dataset
                // Commented out as handled by updateJoinOrder()
                //if (this.selectedDatasets.length > 1) {
                    //$config.slideDown();
                //}
            } else {
                // Remove from selected datasets
                this.selectedDatasets = this.selectedDatasets.filter(id => id !== datasetId);
                
                // Hide join configuration
                $config.slideUp();
                
                // Update column selectors for remaining datasets
                if (this.selectedDatasets.length > 0) {
                    this.updateColumnSelectorsForAllDatasets();
                }
                $item.find('.dataset-label').find('.badge').remove();
            }
            
            this.updateJoinOrder();
            this.updateCreateButton();
        },
        
        /**
         * Load columns for a specific dataset
         */
        loadDatasetColumns: function(datasetId) {
            const self = this;
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_dataset_columns_for_merge',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId
                },
                success: function(response) {
                    if (response.success) {
                        self.datasetColumns[datasetId] = response.data.columns;
                        self.populateColumnSelect(datasetId, response.data.columns);
                        
                        // Update all column selectors if this is not the first dataset
                        if (self.selectedDatasets.length > 1) {
                            self.updateColumnSelectorsForAllDatasets();
                        }
                    }
                },
                error: function() {
                    console.error('Failed to load columns for dataset ' + datasetId);
                }
            });
        },
        
        /**
         * Populate the column select dropdown
         */
        populateColumnSelect: function(datasetId, columns) {
            const $select = $(`.join-column-select[data-dataset-id="${datasetId}"]`);
            
            // Clear existing options except the first
            $select.find('option:not(:first)').remove();
            
            // Add column options
            columns.forEach(col => {
                $select.append(`
                    <option value="${col.col_name}">
                        ${col.col_name} (${col.inferred_type})
                    </option>
                `);
            });
        },
        
        /**
         * Update column selectors for all datasets to show only common columns with base dataset
         */
        updateColumnSelectorsForAllDatasets: function() {
            if (this.selectedDatasets.length === 0) return;
            
            const baseDatasetId = this.selectedDatasets[0];
            //const $checkedBoxes = $('.dataset-checkbox:checked');
            //const baseDatasetId = parseInt($checkedBoxes[0].val());
            const baseColumns = this.datasetColumns[baseDatasetId];
            
            if (!baseColumns) return;
            
            // Get base column names
            const baseColumnNames = new Set(baseColumns.map(col => col.col_name));
            
            // Update selectors for all non-base datasets
            for (let i = 1; i < this.selectedDatasets.length; i++) {
                const datasetId = this.selectedDatasets[i];
                const datasetColumns = this.datasetColumns[datasetId];
                
                if (datasetColumns) {
                    // Filter to only columns that exist in both datasets
                    const commonColumns = datasetColumns.filter(col => baseColumnNames.has(col.col_name));
                    this.populateColumnSelect(datasetId, commonColumns);
                }
            }
        },
        
        /**
         * Handle join column change
         */
        handleJoinColumnChange: function(e) {
            this.updateCreateButton();
        },
        
        /**
         * Update join order display and show/hide join type selects
         */
        updateJoinOrder: function() {
            const $checkedBoxes = $('.dataset-checkbox:checked');
            const $basedataset = this.selectedDatasets[0];
            
            $checkedBoxes.each(function(index) {
                const $item = $(this).closest('.dataset-item');
                const $joinTypeLabel = $item.find('.join-type-label');
                const $datasetLabel = $item.find('.dataset-label');
                const $config = $item.find('.join-config');
                const $datasetid = parseInt($(this).val());
                
                //if (index === 0) {
                if ($basedataset === $datasetid) {
                    // First dataset - hide join type
                    $config.slideUp();
                    //$joinTypeLabel.hide();
                    // Remove existing badge before appending to prevent duplicates
                    $datasetLabel.find('.badge').remove();
                    $datasetLabel.append(' <span class="badge badge-primary">Base Dataset</span>');
                } else {
                    // Subsequent datasets - show join type
                    //$joinTypeLabel.show();
                    $config.slideDown();
                    $datasetLabel.find('.badge').remove();
                }
            });
        },
        
        /**
         * Update create button state
         */
        updateCreateButton: function() {
            const $btn = $('#create-merge-btn');
            const canCreate = this.canCreateMerge();
            
            $btn.prop('disabled', !canCreate);
            
            if (canCreate) {
                $btn.removeClass('disabled');
            } else {
                $btn.addClass('disabled');
            }
        },
        
        /**
         * Check if merge can be created
         */
        canCreateMerge: function() {
            if (this.selectedDatasets.length < 2) {
                return false;
            }
            
            // Check that all selected datasets have a join column selected
            //for (let datasetId of this.selectedDatasets) {
            //    const $select = $(`.join-column-select[data-dataset-id="${datasetId}"]`);
            //    if (!$select.val()) {
            //        return false;
            //    }
            //}
            
            return true;
        },
        
        /**
         * Create merged dataset
         */
        createMergedDataset: function(e) {
            e.preventDefault();
            
            const self = this;
            const name = $('#merge-name').val().trim();
            
            if (!name) {
                this.showError('Please enter a name for the merged dataset');
                return;
            }
            
            if (!this.canCreateMerge()) {
                this.showError('Please select at least 2 datasets with join columns');
                return;
            }
            
            // Build datasets configuration (SAME FOR BOTH CREATE AND UPDATE)
            const datasets = [];
            
            this.selectedDatasets.forEach((datasetId, index) => {
                const $item = $(`.dataset-checkbox[value="${datasetId}"]`).closest('.dataset-item');
                const joinColumn = $item.find('.join-column-select').val();
                const joinType = index === 0 ? 'inner' : $item.find('.join-type-select').val();
                
                datasets.push({
                    dataset_id: datasetId,
                    join_column: joinColumn,
                    join_type: joinType
                });
            });
            
            // Show loading
            const $btn = $('#create-merge-btn');
            const originalText = $btn.text();
            $btn.prop('disabled', true).text(this.editMode ? 'Updating...' : 'Creating...');
            
            // Prepare AJAX data (SAME PARAMETERS FOR BOTH)
            const ajaxData = {
                action: this.editMode ? 'ql_update_merged_dataset' : 'ql_create_merged_dataset',
                nonce: qlAuth.nonce,
                name: name,
                datasets: datasets
            };
            
            // Only difference: update needs dataset_id
            if (this.editMode) {
                ajaxData.dataset_id = this.editDatasetId;
            }
            
            // Make AJAX request
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: ajaxData,
                success: function(response) {
                    if (response.success) {
                        self.showSuccess((self.editMode ? 'Updated' : 'Created') + ' merged dataset successfully!');
                        
                        if (self.editMode) {
                            // Redirect to dashboard after update
                            setTimeout(function() {
                                window.location.href = '/ql-dashboard';
                            }, 1500);
                        } else {
                            // Reset form and redirect after create
                            $('#merge-name').val('');
                            $('.dataset-checkbox').prop('checked', false);
                            $('.join-config').hide();
                            self.selectedDatasets = [];
                            
                            setTimeout(function() {
                                window.location.href = '/ql-dashboard';
                            }, 1500);
                        }
                    } else {
                        self.showError('Failed to ' + (self.editMode ? 'update' : 'create') + ' merged dataset: ' + response.data.message);
                    }
                },
                error: function(xhr) {
                    console.error('Error:', xhr);
                    self.showError('Error ' + (self.editMode ? 'updating' : 'creating') + ' merged dataset. Please try again.');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        },
        
        /**
         * View merge configuration
         */
        viewMergeConfig: function(e) {
            e.preventDefault();
            
            const datasetId = $(e.target).data('dataset-id');
            const self = this;
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_merge_config',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId
                },
                success: function(response) {
                    if (response.success) {
                        self.showMergeConfigModal(response.data);
                    } else {
                        self.showError('Failed to load configuration: ' + response.data.message);
                    }
                },
                error: function() {
                    self.showError('Error loading configuration');
                }
            });
        },
        
        /**
         * Show merge configuration modal
         */
        showMergeConfigModal: function(data) {
            const joins = data.joins;
            let html = '<div class="merge-config-modal">';
            html += '<h3>Merge Configuration</h3>';
            html += '<div class="merge-flow">';
            
            joins.forEach((join, index) => {
                html += `
                    <div class="merge-step">
                        <div class="merge-dataset left">
                            <strong>${join.left_dataset_name}</strong>
                            <span class="dataset-id">[ID: ${join.left_dataset_id}]</span>
                        </div>
                        <div class="merge-operator">
                            <span class="join-type">${join.join_type.toUpperCase()} JOIN</span>
                            <span class="join-column">ON ${join.join_column}</span>
                        </div>
                        <div class="merge-dataset right">
                            <strong>${join.right_dataset_name}</strong>
                            <span class="dataset-id">[ID: ${join.right_dataset_id}]</span>
                        </div>
                    </div>
                `;
                
                if (index < joins.length - 1) {
                    html += '<div class="merge-arrow">↓</div>';
                }
            });
            
            html += '</div>';
            html += '<button class="button close-modal">Close</button>';
            html += '</div>';
            
            // Show modal
            const $modal = $(html);
            $('body').append($modal);
            
            $modal.find('.close-modal').on('click', function() {
                $modal.remove();
            });
        },
        
        /**
         * Delete merged dataset
         */
        deleteMergedDataset: function(e) {
            e.preventDefault();
            
            if (!confirm('Are you sure you want to delete this merged dataset? This action cannot be undone.')) {
                return;
            }
            
            const datasetId = $(e.target).data('dataset-id');
            const self = this;
            
            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_delete_merged_dataset',
                    nonce: qlAuth.nonce,
                    dataset_id: datasetId
                },
                success: function(response) {
                    if (response.success) {
                        self.showSuccess('Merged dataset deleted successfully');
                        
                        // Remove from UI
                        $(e.target).closest('tr').fadeOut(function() {
                            $(this).remove();
                        });
                    } else {
                        self.showError('Failed to delete: ' + response.data.message);
                    }
                },
                error: function() {
                    self.showError('Error deleting merged dataset');
                }
            });
        },
        
        /**
         * Show error message
         */
        showError: function(message) {
            alert('Error: ' + message);
            //this.showNotification(message, 'error');
        },
        
        /**
         * Show success message
         */
        showSuccess: function(message) {
            alert('Success: ' + message);
            //this.showNotification(message, 'success');
        },
        
        /**
         * Show notification
         */
        showNotification: function(message, type) {
            const $notification = $(`
                <div class="ql-notification ${type}">
                    <span class="message">${message}</span>
                    <button class="close">&times;</button>
                </div>
            `);
            
            $('.merge-datasets-container').prepend(notification);
            
            $notification.fadeIn();
            
            $notification.find('.close').on('click', function() {
                $notification.fadeOut(function() {
                    $notification.remove();
                });
            });
            
            // Auto-dismiss after 5 seconds
            setTimeout(function() {
                $notification.fadeOut(function() {
                    $notification.remove();
                });
            }, 5000);
        },
        
        /**
         * Format number with commas
         */
        formatNumber: function(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
    };
    
    // Initialize if on merge page
    if ($('#merge-datasets-container').length) {
        QLMergeDatasets.init();
    }

    // Make available globally
    window.QLMergeDatasets = QLMergeDatasets;
});
