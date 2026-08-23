/**
 * QuantumLayers Dataset Detail Page JavaScript
 */




(function($) {
    'use strict';

    const QLDatasetDetail = {
        datasetId: null,
        currentFilter: 'all',

        init: function() {
            // Get dataset ID from URL
            this.datasetId = this.getDatasetIdFromUrl();
            
            if (!this.datasetId) {
            //    window.location.href = '/ql-dashboard';
            //    return;
            }

            this.loadDataset();
            this.bindEvents();
        },

        getDatasetIdFromUrl: function() {
            const path = window.location.search;
            const match = path.match(/\?(\d+)/);
            return match ? match[1] : null;
        },

        bindEvents: function() {
            // Filter buttons
            $(document).on('click', '.ql-filter-btn', this.handleFilter.bind(this));
            
            // Delete button
            $(document).on('click', '.ql-delete-dataset', this.handleDelete.bind(this));
        },

        loadDataset: function() {
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
                    dataset_id: this.datasetId
                },
                success: function(response) {
                    console.log('Dataset detail:', response);
                    
                    if (response.success) {
                        self.renderDataset(response.data);
                    } else {
                        self.showError(response.data.message || 'Failed to load dataset');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error loading dataset:', error);
                    self.showError('Failed to load dataset');
                }
            });
        },
        
        renderDataset: function(data) {
            // Update header
            $('#dataset-name').text(data.dataset.name);
            $('#dataset-status').removeClass().addClass('ql-status-badge ql-status-' + data.dataset.status)
                .text(data.dataset.status.charAt(0).toUpperCase() + data.dataset.status.slice(1));
            $('#dataset-rows').text(parseInt(data.dataset.row_count).toLocaleString());
            $('#dataset-source').text(data.dataset.source_type.charAt(0).toUpperCase() + data.dataset.source_type.slice(1));
            $('#dataset-date').text(new Date(data.dataset.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }));

            // Update stats
            $('#stat-rows').text(parseInt(data.dataset.row_count).toLocaleString());
            $('#stat-columns').text(data.columns.length);

            // Render columns
            this.renderColumns(data.columns);
        },

        renderColumns: function(columns) {
            const container = $('#columns-list');

            if (!columns || columns.length === 0) {
                container.html(
                    '<div class="ql-empty-state">' +
                        '<div class="ql-empty-icon">📋</div>' +
                        '<p>No column information available</p>' +
                    '</div>'
                );
                return;
            }

            let html = '<div class="ql-columns-grid">';
            
            columns.forEach(function(col) {
                html += '<div class="ql-column-card">';
                html += '  <div class="ql-column-header">';
                html += '    <div class="ql-column-name">' + this.escapeHtml(col.col_name) + '</div>';
                html += '    <span class="ql-type-badge">' + this.escapeHtml(col.inferred_type) + '</span>';
                html += '  </div>';
                html += '  <div class="ql-column-stats">';
                html += '    <div><strong>Distinct:</strong> ' + parseInt(col.distinct_count).toLocaleString() + '</div>';
                html += '    <div><strong>Null Count:</strong> ' + parseInt(col.null_count).toLocaleString() + '</div>';
                
                if (col.min_val) {
                    html += '    <div><strong>Min:</strong> ' + this.escapeHtml(col.min_val) + '</div>';
                }
                if (col.max_val) {
                    html += '    <div><strong>Max:</strong> ' + this.escapeHtml(col.max_val) + '</div>';
                }
                if (col.mean_val !== null) {
                    html += '    <div><strong>Mean:</strong> ' + parseFloat(col.mean_val).toFixed(2) + '</div>';
                }
                if (col.stddev_val !== null) {
                    html += '    <div><strong>Std Dev:</strong> ' + parseFloat(col.stddev_val).toFixed(2) + '</div>';
                }
                
                html += '  </div>';
                
                if (col.sample_values) {
                    try {
                        const samples = JSON.parse(col.sample_values);
                        if (samples && samples.length > 0) {
                            html += '  <div class="ql-sample-values">';
                            html += '    <strong>Sample Values:</strong>';
                            html += '    <div class="ql-sample-list">' + samples.slice(0, 5).map(v => this.escapeHtml(String(v))).join(', ');
                            if (samples.length > 5) html += '...';
                            html += '    </div>';
                            html += '  </div>';
                        }
                    } catch(e) {
                        console.error('Error parsing sample values:', e);
                    }
                }
                
                html += '</div>';
            }.bind(this));
            
            html += '</div>';
            container.html(html);
        },

        handleFilter: function(e) {
            const filter = $(e.target).data('filter');
            this.currentFilter = filter;

            $('.ql-filter-btn').removeClass('active');
            $(e.target).addClass('active');

            // Reload insights with filter
            this.loadDataset();
        },

        handleDelete: function(e) {
            e.preventDefault();
            
            if (!confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
                return;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_delete_dataset',
                    nonce: qlAuth.nonce,
                    dataset_id: this.datasetId
                },
                success: function(response) {
                    if (response.success) {
                        window.location.href = '/ql-dashboard?deleted=1';
                    } else {
                        alert(response.data.message || 'Failed to delete dataset');
                    }
                },
                error: function() {
                    alert('Failed to delete dataset');
                }
            });
        },

        parseMarkdown: function(text) {
            if (!text) return '';
            
            // Simple markdown parsing
            return text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        },

        getSeverityIcon: function(severity) {
            const icons = {
                'warning': '⚠️',
                'highlight': '⭐',
                'info': 'ℹ️'
            };
            return icons[severity] || 'ℹ️';
        },

        timeAgo: function(dateString) {
            const date = new Date(dateString);
            const seconds = Math.floor((new Date() - date) / 1000);
            
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
            if (seconds < 2592000) return Math.floor(seconds / 86400) + ' days ago';
            return date.toLocaleDateString();
        },

        showError: function(message) {
            $('.ql-dataset-wrapper').html(
                '<div class="ql-empty-state">' +
                    '<div class="ql-empty-icon">⚠️</div>' +
                    '<p>' + this.escapeHtml(message) + '</p>' +
                    '<a href="/ql-dashboard" class="ql-btn ql-btn-primary">Back to Dashboard</a>' +
                '</div>'
            );
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
        QLDatasetDetail.init();
    });

    // Expose to global scope
    window.QLDatasetDetail = QLDatasetDetail;

})(jQuery);









