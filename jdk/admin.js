/**
 * QuantumLayers Admin JavaScript
 */

(function($) {
    'use strict';

    const QL = {
        init: function() {
            this.bindEvents();
            this.checkProcessingDatasets();
        },

        bindEvents: function() {
            // File upload validation
            $('#csv_file').on('change', this.validateFile);
            
            // Copy to clipboard for API keys
            $('.ql-copy-key').on('click', this.copyApiKey);
            
            // Confirm delete actions
            $('.ql-delete-dataset').on('click', this.confirmDelete);
            
            // Real-time dataset name slug preview
            $('#dataset_name').on('input', this.updateSlugPreview);
        },

        validateFile: function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ['text/csv', 'application/csv', 'text/plain'];

            // Check file size
            if (file.size > maxSize) {
                alert('File is too large. Maximum size is 10MB.');
                e.target.value = '';
                return;
            }

            // Check file type
            if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
                alert('Please upload a valid CSV file.');
                e.target.value = '';
                return;
            }

            // Show file info
            const fileInfo = `
                <div class="notice notice-info ql-file-info" style="margin-top: 10px;">
                    <p><strong>File selected:</strong> ${file.name} (${QL.formatBytes(file.size)})</p>
                </div>
            `;
            $('.ql-file-info').remove();
            $(e.target).closest('td').append(fileInfo);
        },

        formatBytes: function(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        },

        copyApiKey: function(e) {
            e.preventDefault();
            const key = $(this).data('key');
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(key).then(function() {
                    const btn = $(e.target);
                    const originalText = btn.text();
                    btn.text('✓ Copied!').css('color', '#28a745');
                    
                    setTimeout(function() {
                        btn.text(originalText).css('color', '');
                    }, 2000);
                }).catch(function(err) {
                    alert('Failed to copy API key');
                });
            } else {
                // Fallback for older browsers
                const tempInput = $('<input>');
                $('body').append(tempInput);
                tempInput.val(key).select();
                document.execCommand('copy');
                tempInput.remove();
                alert('API key copied to clipboard!');
            }
        },

        confirmDelete: function(e) {
            if (!confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
                e.preventDefault();
                return false;
            }
        },

        updateSlugPreview: function() {
            const name = $(this).val();
            const slug = name.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            
            $('.ql-slug-preview').remove();
            if (slug) {
                $(this).closest('td').append(`
                    <div class="ql-slug-preview" style="margin-top: 5px; color: #666; font-size: 12px;">
                        Slug: <code>${slug}</code>
                    </div>
                `);
            }
        },

        checkProcessingDatasets: function() {
            const processingRows = $('.ql-status-processing').closest('tr');
            
            if (processingRows.length === 0) return;

            processingRows.each(function() {
                const row = $(this);
                const actionLinks = row.find('a[href*="id="]');
                
                if (actionLinks.length > 0) {
                    const href = actionLinks.first().attr('href');
                    const match = href.match(/id=(\d+)/);
                    
                    if (match && match[1]) {
                        const datasetId = match[1];
                        QL.pollDatasetStatus(datasetId, row);
                    }
                }
            });
        },

        pollDatasetStatus: function(datasetId, row) {
            const checkStatus = function() {
                $.ajax({
                    url: qlAdmin.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'ql_check_status',
                        nonce: qlAdmin.nonce,
                        dataset_id: datasetId
                    },
                    success: function(response) {
                        if (response.success && response.data) {
                            const status = response.data.status;
                            const rowCount = response.data.row_count;
                            
                            if (status === 'ready' || status === 'error') {
                                // Update the status cell
                                const statusCell = row.find('td').eq(3); // 4th column
                                const statusClass = status === 'ready' ? 'ql-status-ready' : 'ql-status-error';
                                const statusBg = status === 'ready' ? '#d4edda' : '#f8d7da';
                                
                                statusCell.html(`
                                    <span class="${statusClass}" style="padding: 3px 8px; border-radius: 3px; font-size: 11px; background: ${statusBg};">
                                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                                    </span>
                                `);
                                
                                // Update row count
                                row.find('td').eq(2).text(rowCount.toLocaleString());
                                
                                // Show notification
                                if (status === 'ready') {
                                    QL.showNotification('Dataset processing complete!', 'success');
                                } else {
                                    QL.showNotification('Dataset processing failed', 'error');
                                }
                            } else {
                                // Still processing, check again in 3 seconds
                                setTimeout(checkStatus, 3000);
                            }
                        }
                    },
                    error: function() {
                        console.error('Failed to check dataset status');
                    }
                });
            };
            
            // Initial check after 2 seconds
            setTimeout(checkStatus, 2000);
        },

        showNotification: function(message, type) {
            const noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
            const notice = $(`
                <div class="notice ${noticeClass} is-dismissible" style="margin: 15px 0;">
                    <p>${message}</p>
                    <button type="button" class="notice-dismiss">
                        <span class="screen-reader-text">Dismiss</span>
                    </button>
                </div>
            `);
            
            if ($('.wrap h1').length > 0) {
                $('.wrap h1').first().after(notice);
            } else {
                $('.wrap').prepend(notice);
            }
            
            // Auto-dismiss after 5 seconds
            setTimeout(function() {
                notice.fadeOut(function() {
                    $(this).remove();
                });
            }, 5000);
            
            // Handle manual dismiss
            notice.find('.notice-dismiss').on('click', function() {
                notice.fadeOut(function() {
                    $(this).remove();
                });
            });
        },

        // Chart rendering for dataset insights (optional enhancement)
        renderInsightCharts: function() {
            $('.ql-insight-chart').each(function() {
                const chartData = $(this).data('chart');
                if (chartData) {
                    // Future: Implement Chart.js rendering
                    console.log('Chart data:', chartData);
                }
            });
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        QL.init();
    });

    // Expose to global scope for external use
    window.QuantumLayers = QL;

})(jQuery);

