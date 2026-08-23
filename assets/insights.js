// Display insights in UI
class QLInsights {
    
    constructor() {
        this.datasetId = this.getDatasetIdFromURL();
        this.container = document.getElementById('ql-insights-panel');
        this.selectedColumns = [];
        this.initControls();
        this.bindEvents();
        this.handleResize();
        this.initDateFilters(); // Initialize date filter controls
    }
    
    handleResize() {
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
        }
    
    getDatasetIdFromURL() {
        const path = window.location.search;
        const match = path.match(/\?(\d+)/);
        return match ? match[1] : null;
    }
    
    initControls() {
        // Initialize multi-select for columns
        this.initColumnSelector();
    }
    
    bindEvents() {
        // Bind the load insights button
        const loadButton = document.getElementById('ql-load-insights-btn');
        if (loadButton) {
            loadButton.addEventListener('click', () => this.loadInsights());
        }
        
        // Date filter event handlers
        const dateColumnSelector = document.querySelector('.ql-filter-date-column-selector');
        if (dateColumnSelector) {
            dateColumnSelector.addEventListener('change', () => this.handleControlChange());
        }
        
        const dateFromInput = document.querySelector('.ql-filter-date-from-input');
        if (dateFromInput) {
            dateFromInput.addEventListener('change', (e) => this.handleDateFromChange(e));
        }
        
        const dateToInput = document.querySelector('.ql-filter-date-to-input');
        if (dateToInput) {
            dateToInput.addEventListener('change', (e) => this.handleDateToChange(e));
        }
        
        const dateFromCustom = document.querySelector('.ql-filter-date-from-custom');
        if (dateFromCustom) {
            dateFromCustom.addEventListener('change', () => this.handleControlChange());
        }
        
        const dateToCustom = document.querySelector('.ql-filter-date-to-custom');
        if (dateToCustom) {
            dateToCustom.addEventListener('change', () => this.handleControlChange());
        }
        
        // Multi-select modal buttons
        const columnTrigger = document.querySelector('.ql-insights-column-trigger');
        if (columnTrigger) {
            columnTrigger.addEventListener('click', (e) => this.openColumnModal(e));
        }
        
        const modalClose = document.querySelectorAll('.ql-insights-modal-close, .ql-insights-modal-backdrop');
        modalClose.forEach(el => {
            el.addEventListener('click', (e) => this.closeColumnModal(e));
        });
        
        const doneButton = document.querySelector('.ql-insights-columns-done');
        if (doneButton) {
            doneButton.addEventListener('click', (e) => this.applyColumnSelection(e));
        }
        
        // Column selector change handler
        const columnSelector = document.getElementById('ql-insights-column-selector');
        if (columnSelector) {
            columnSelector.addEventListener('change', (e) => this.handleColumnSelectionChange(e));
        }
    }
    
    initColumnSelector() {
        // Fetch available columns from the dataset
        this.loadAvailableColumns();
    }
    
    async loadAvailableColumns() {
        try {
            const response = await jQuery.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: {
                    action: 'ql_get_dataset_detail',
                    nonce: qlAuth.nonce,
                    dataset_id: this.datasetId
                }
            });
            
            if (response.success && response.data.columns) {
                this.populateColumnSelector(response.data.columns);
            }
        } catch (error) {
            console.error('Error loading columns:', error);
        }
    }
    
    populateColumnSelector(columns) {
        const selector = document.getElementById('ql-insights-column-selector');
        if (!selector) return;
        
        selector.innerHTML = '';
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col.col_name;
            option.textContent = col.col_name;
            selector.appendChild(option);
        });
        
    }
    
    openColumnModal(e) {
        e.preventDefault();
        const modal = document.getElementById('ql-insights-columns-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    closeColumnModal(e) {
        const modal = e.currentTarget.closest('.ql-insights-modal') || 
                      document.getElementById('ql-insights-columns-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    handleColumnSelectionChange(e) {
        const selector = e.currentTarget;
        const selectedOptions = Array.from(selector.selectedOptions);
        this.selectedColumns = selectedOptions.map(opt => opt.value);
        this.updateColumnButtonLabel();
    }
    
    updateColumnButtonLabel() {
        const button = document.querySelector('.ql-insights-column-trigger');
        if (!button) return;
        
        const label = button.querySelector('.ql-multiselect-label');
        const count = button.querySelector('.ql-multiselect-count');
        
        if (!label) return;
        
        const selector = document.getElementById('ql-insights-column-selector');
        const selectedOptions = Array.from(selector.selectedOptions);
        const selectedTexts = selectedOptions.map(opt => opt.textContent);
        
        if (selectedTexts.length === 0) {
            label.textContent = 'Apply insights to: all Columns';
        } else if (selectedTexts.length === 1) {
            label.textContent = 'Apply insights to: ' + selectedTexts[0];
        } else {
            label.textContent = 'Apply insights to: ' + selectedTexts[0] + ', ...';
        }
        
        if (count) {
            count.textContent = selectedTexts.length || 'All';
        }
    }
    
    applyColumnSelection(e) {
        e.preventDefault();
        this.updateColumnButtonLabel();
        this.closeColumnModal(e);
    }
    
    /**
     * Initialize date filter controls
     */
    initDateFilters() {
        // Set default values
        const dateFromInput = document.querySelector('.ql-filter-date-from-input');
        const dateToInput = document.querySelector('.ql-filter-date-to-input');
        
        if (dateFromInput) {
            dateFromInput.value = '1 month';
        }
        if (dateToInput) {
            dateToInput.value = 'today';
        }
        
        // Initialize visibility
        this.updateDateFilterVisibility('from', '1 month');
        this.updateDateFilterVisibility('to', 'today');
    }
    
    /**
     * Handle "From" date dropdown change
     */
    handleDateFromChange(e) {
        const selectedValue = e.target.value;
        this.updateDateFilterVisibility('from', selectedValue);
        this.handleControlChange();
    }
    
    /**
     * Handle "To" date dropdown change
     */
    handleDateToChange(e) {
        const selectedValue = e.target.value;
        this.updateDateFilterVisibility('to', selectedValue);
        this.handleControlChange();
    }
    
    /**
     * Update visibility of custom date inputs
     */
    updateDateFilterVisibility(filterType, selectedValue) {
        if (filterType === 'from') {
            const customInput = document.querySelector('.ql-filter-date-from-custom');
            if (customInput) {
                if (selectedValue === 'custom') {
                    customInput.style.display = 'block';
                } else {
                    customInput.style.display = 'none';
                }
            }
        } else if (filterType === 'to') {
            const customInput = document.querySelector('.ql-filter-date-to-custom');
            if (customInput) {
                if (selectedValue === 'custom') {
                    customInput.style.display = 'block';
                } else {
                    customInput.style.display = 'none';
                }
            }
        }
    }
    
    /**
     * Get the current date filter values
     */
    getDateFilterValues() {
        const dateColumnSelector = document.querySelector('.ql-filter-date-column-selector');
        const dateColumn = dateColumnSelector ? dateColumnSelector.value : null;
        
        if (!dateColumn) {
            return {
                column: null,
                from: null,
                to: null
            };
        }
        
        // Get FROM value
        const fromInput = document.querySelector('.ql-filter-date-from-input');
        const fromValue = fromInput ? fromInput.value : null;
        let fromDate = null;
        
        if (fromValue === 'custom') {
            const customInput = document.querySelector('.ql-filter-date-from-custom');
            fromDate = customInput ? customInput.value : null;
        } else {
            fromDate = fromValue;
        }
        
        // Get TO value
        const toInput = document.querySelector('.ql-filter-date-to-input');
        const toValue = toInput ? toInput.value : null;
        let toDate = null;
        
        if (toValue === 'custom') {
            const customInput = document.querySelector('.ql-filter-date-to-custom');
            toDate = customInput ? customInput.value : null;
        } else {
            toDate = toValue;
        }
        
        return {
            column: dateColumn,
            from: fromDate,
            to: toDate
        };
    }
    
    /**
     * Handle control changes (placeholder for compatibility)
     */
    handleControlChange() {
        // This method can be used to trigger any updates when controls change
        // Currently, the actual filtering happens when loadInsights is called
    }
    
    async loadInsights() {
        this.showLoading();
        
        // Get filter values
        const filterColumn = document.querySelector('.ql-filter-column-selector')?.value || '';
        const filterValue = document.querySelector('.ql-filter-value')?.value || '';
        
        // Get date filter values
        const dateFilter = this.getDateFilterValues();
        
        // Get max insights
        const maxInsightsInput = document.querySelector('.ql-max-insights');
        const maxInsights = maxInsightsInput ? parseInt(maxInsightsInput.value) || 30 : 30;
        
        // Get custom user prompt
        const userPromptInput = document.querySelector('.ql-user-prompt');
        const userPrompt = userPromptInput ? userPromptInput.value.trim() : '';

        // Prepare request data
        const requestData = {
            action: 'ql_get_insights',
            nonce: qlAuth.nonce,
            dataset_id: this.datasetId,
            max_insights: maxInsights
        };
        
        // Add user prompt if provided
        if (userPrompt) {
            requestData.user_prompt = userPrompt;
        }
        
        // Add selected columns if any
        if (this.selectedColumns && this.selectedColumns.length > 0) {
            requestData.selected_columns = this.selectedColumns;
        }
        
        // Add filter if both column and value are provided
        if (filterColumn && filterValue) {
            requestData.filter_category_column = filterColumn;
            requestData.filter_category_value = filterValue;
        }
        
        // Add date filter if column is selected
        if (dateFilter.column) {
            requestData.filter_date_column = dateFilter.column;
            if (dateFilter.from) {
                requestData.filter_date_from = dateFilter.from;
            }
            if (dateFilter.to) {
                requestData.filter_date_to = dateFilter.to;
            }
        }
        
        try {
            const response = await jQuery.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + QLAuth.getSessionToken()
                }, 
                data: requestData
            });
            
            if (response.success) {
                this.renderInsights(response.data.insights);
            } else {
                this.showError('Failed to load insights: ' + (response.data?.message || 'Unknown error'));
            }
        } catch (error) {
            this.showError('Error loading insights: ' + error.message);
        }
    }

    renderInsights(insights) {
        // Clear container
        this.container.innerHTML = '';
        
        if (!insights || insights.length === 0) {
            this.container.innerHTML = '<div class="ql-no-insights">No insights found for the selected criteria.</div>';
            return;
        }
        
        // Separate holistic analysis from other insights
        const holisticInsight = insights.find(i => i.type === 'holistic_analysis');
        const standardInsights = insights.filter(i => i.type !== 'holistic_analysis');
        
        // Render holistic analysis first if it exists
        if (holisticInsight) {
            const holisticSection = this.createHolisticSection(holisticInsight);
            this.container.appendChild(holisticSection);
        }
        
        // Render standard insights
        if (standardInsights.length > 0) {
            const insightsHeader = document.createElement('h3');
            insightsHeader.textContent = 'Detailed Insights';
            insightsHeader.style.marginTop = holisticInsight ? '40px' : '0';
            insightsHeader.style.marginBottom = '20px';
            insightsHeader.style.fontSize = '22px';
            insightsHeader.style.color = '#1d2327';
            this.container.appendChild(insightsHeader);
            
            const insightsGrid = document.createElement('div');
            insightsGrid.className = 'ql-insights-grid';
            
            standardInsights.forEach((insight, index) => {
                const card = this.createInsightCard(insight, index);
                insightsGrid.appendChild(card);
            });
            
            this.container.appendChild(insightsGrid);
        }
    }
    
    createHolisticSection(insight) {
        const section = document.createElement('div');
        section.className = 'ql-holistic-insight';
        
        // Header
        const header = document.createElement('div');
        header.className = 'ql-holistic-insight-header';
        
        const icon = document.createElement('span');
        icon.className = 'ql-holistic-insight-icon';
        //icon.textContent = '🤖';
        icon.textContent = '';
        
        const titleSection = document.createElement('div');
        titleSection.className = 'ql-holistic-insight-title';
        
        const title = document.createElement('h2');
        title.textContent = insight.title || 'Holistic Dataset Analysis';
        
        const subtitle = document.createElement('p');
        subtitle.textContent = 'AI-Powered Comprehensive Analysis';
        
        titleSection.appendChild(title);
        titleSection.appendChild(subtitle);
        
        const importanceBadge = document.createElement('span');
        importanceBadge.className = 'ql-holistic-importance-badge';
        importanceBadge.textContent = 'Priority: High';
        
        //header.appendChild(icon);
        header.appendChild(titleSection);
        //header.appendChild(importanceBadge);
        
        // Body with AI analysis
        const body = document.createElement('div');
        body.className = 'ql-holistic-insight-body';
        
        if (insight.ai_analysis) {
            body.innerHTML = this.renderMarkdown(insight.ai_analysis);
            this.renderInsightCharts(body);
        } else {
            body.innerHTML = `<p>${insight.message || 'AI analysis not available.'}</p>`;
        }

        section.appendChild(header);
        section.appendChild(body);

        return section;
    }

    renderInsightCharts(container) {
        const embeds = container.querySelectorAll('.ql-insight-chart-embed');
        embeds.forEach(function(embed, idx) {
            let params;
            try {
                params = JSON.parse(embed.getAttribute('data-params'));
            } catch (e) {
                embed.innerHTML = '<div class="ql-insight-chart-error">Invalid chart config.</div>';
                return;
            }
            if (!embed.id) {
                embed.id = 'ql-insight-chart-embed-' + Date.now() + '-' + idx;
            }
            const postData = Object.assign({ action: 'ql_get_chart_data', nonce: qlAuth.nonce }, params);
            jQuery.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                data: postData,
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                success: function(response) {
                    if (response.success && response.data
                        && window.QLAnalytics
                        && typeof window.QLAnalytics.renderChart === 'function') {
                        // Delegate to analytics.js renderer, which rehydrates
                        // PHP-serialized function strings before creating the chart.
                        window.QLAnalytics.renderChart(embed.id, response.data);
                    } else {
                        embed.innerHTML = '<div class="ql-insight-chart-error">Chart unavailable.</div>';
                    }
                },
                error: function() {
                    embed.innerHTML = '<div class="ql-insight-chart-error">Could not load chart.</div>';
                }
            });
        });
    }

    // Decode the handful of HTML entities the model may introduce around a chart spec.
    decodeEntities(s) {
        return s.replace(/&quot;/g, '"').replace(/&#34;/g, '"')
                .replace(/&#0*39;/g, "'").replace(/&apos;/g, "'")
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
    }

    // True when the string parses to a JSON object carrying dataset_id + chart_type.
    looksLikeChartSpec(json) {
        try {
            const p = JSON.parse(json.trim());
            return !!(p && typeof p === 'object' && p.dataset_id && p.chart_type);
        } catch (e) {
            return false;
        }
    }

    // Restore a canonical ```ql-chart fence around every chart spec, regardless of how
    // the model emitted it (fenced, <pre>/<code>-wrapped, entity-escaped, or bare inline).
    // The holistic-analysis prompt moved to HTML output, so the fence is sometimes dropped;
    // without this the raw JSON would render as visible text instead of a chart.
    normalizeChartBlocks(text) {
        if (!text) return text;
        const self = this;

        // 1. Unwrap chart specs the model placed inside <pre>/<code> tags.
        text = text.replace(/<pre[^>]*>(?:\s*<code[^>]*>)?([\s\S]*?)(?:<\/code>\s*)?<\/pre>/gi, function (m, inner) {
            const decoded = self.decodeEntities(inner).replace(/```(?:ql-chart)?/g, '').trim();
            return self.looksLikeChartSpec(decoded) ? '\n```ql-chart\n' + decoded + '\n```\n' : m;
        });
        text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, function (m, inner) {
            const decoded = self.decodeEntities(inner).trim();
            return self.looksLikeChartSpec(decoded) ? '\n```ql-chart\n' + decoded + '\n```\n' : m;
        });

        // 2. Protect existing fences so step 3 doesn't re-wrap them.
        const protectedBlocks = [];
        text = text.replace(/```ql-chart\s*\n[\s\S]*?```/g, function (m) {
            const token = '@@QLPROTECT' + protectedBlocks.length + '@@';
            protectedBlocks.push(m);
            return token;
        });

        // 3. Wrap remaining bare chart-spec JSON (specs use [] arrays, no nested {}).
        text = text.replace(/\{[^{}]*"chart_type"[^{}]*\}/g, function (m) {
            const decoded = self.decodeEntities(m);
            return self.looksLikeChartSpec(decoded) ? '\n```ql-chart\n' + decoded.trim() + '\n```\n' : m;
        });

        // 4. Restore protected fences.
        protectedBlocks.forEach(function (block, i) {
            text = text.replace('@@QLPROTECT' + i + '@@', function () { return block; });
        });

        return text;
    }

    renderMarkdown(text) {
        if (!text) return '';
        text = this.normalizeChartBlocks(text);
        const chartBlocks = {};
        let chartIndex = 0;
        // Extract ql-chart blocks before setting innerHTML
        text = text.replace(/```ql-chart\r?\n([\s\S]*?)```/g, function (_, json) {
            const token = 'QLCHARTBLOCK' + chartIndex + 'END';
            try { chartBlocks[token] = JSON.parse(json.trim()); }
            catch (e) { chartBlocks[token] = null; }
            chartIndex++;
            return token;
        });
        // Claude returns HTML directly \u2014 replace chart tokens with embed divs
        let html = text;
        Object.keys(chartBlocks).forEach(function (token) {
            const params = chartBlocks[token];
            const div = params
                ? '<div class="ql-insight-chart-embed" data-params=\'' +
                  JSON.stringify(params).replace(/'/g, '&#39;') +
                  '\'><div class="ql-insight-chart-loading">Loading chart\u2026</div></div>'
                : '';
            html = html.split(token).join(div);
        });
        return html;
    }
    
    createInsightCard(insight, index) {
        const card = document.createElement('div');
        card.className = `ql-insight-card ${insight.severity || 'info'}`;
        card.setAttribute('data-importance', insight.importance);
        card.setAttribute('data-severity', insight.severity || 'info');
        
        // Header
        const header = document.createElement('div');
        header.className = 'ql-insight-header';
        
        const icon = document.createElement('span');
        icon.className = 'ql-insight-icon';
        icon.textContent = this.getInsightIcon(insight.type, insight.severity);
        
        const titleSection = document.createElement('div');
        titleSection.className = 'ql-insight-title-section';
        
        const title = document.createElement('h3');
        title.textContent = insight.title;
        
        const typeBadge = document.createElement('span');
        typeBadge.className = 'ql-insight-type-badge';
        typeBadge.textContent = this.formatInsightType(insight.type);
        
        titleSection.appendChild(title);
        titleSection.appendChild(typeBadge);
        
        const importanceBadge = document.createElement('span');
        importanceBadge.className = 'ql-insight-importance';
        importanceBadge.textContent = Math.round(insight.importance);
        
        header.appendChild(icon);
        header.appendChild(titleSection);
        header.appendChild(importanceBadge);
        
        // Body
        const body = document.createElement('div');
        body.className = 'ql-insight-body';
        
        const message = document.createElement('p');
        message.className = 'ql-insight-message';
        message.textContent = insight.message;
        body.appendChild(message);
        
        // Recommendation
        if (insight.recommendation) {
            const recommendation = document.createElement('div');
            recommendation.className = 'ql-insight-recommendation';
            
            const recLabel = document.createElement('div');
            recLabel.className = 'ql-insight-recommendation-label';
            recLabel.textContent = '💡 Recommendation';
            
            const recText = document.createElement('p');
            recText.className = 'ql-insight-recommendation-text';
            recText.textContent = insight.recommendation;
            
            recommendation.appendChild(recLabel);
            recommendation.appendChild(recText);
            body.appendChild(recommendation);
        }
        
        card.appendChild(header);
        card.appendChild(body);
        
        // Actions
        if (insight.chart_suggestion) {
            const actions = document.createElement('div');
            actions.className = 'ql-insight-actions';

            const chartBtn = document.createElement('button');
            chartBtn.className = 'ql-btn-chart';
            chartBtn.textContent = 'View Chart';
            chartBtn.addEventListener('click', () => this.openInsightChart(insight.chart_suggestion));

            actions.appendChild(chartBtn);
            card.appendChild(actions);
        }
        
        return card;
    }
    
    formatInsightType(type) {
        const typeMap = {
            'correlation': 'Correlation',
            'trend': 'Trend Analysis',
            'average_level': 'Average Level',
            'autocorrelation': 'Autocorrelation',
            'categorical_effect': 'Category Effect',
            'anova': 'ANOVA',
            'outliers': 'Outliers',
            'distribution': 'Distribution',
            'predictive_model': 'Predictive Model',
            'skewness': 'Skewness'
        };
        return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    openInsightChart(suggestion) {
        if (!suggestion) return;

        const params = new URLSearchParams();
        params.set('dataset_id', this.datasetId);
        params.set('chart_type', suggestion.type || suggestion.chart_type || 'bar');

        if (suggestion.x)               params.set('x_column',       suggestion.x);
        if (suggestion.y)               params.set('y_column',        suggestion.y);
        if (suggestion.x_column)        params.set('x_column',        suggestion.x_column);
        if (suggestion.y_column)        params.set('y_column',        suggestion.y_column);
        if (suggestion.column)          params.set('y_column',        suggestion.column);
        if (suggestion.column_name)     params.set('column_name',     suggestion.column_name);
        if (suggestion.category)        params.set('category_column', suggestion.category);
        if (suggestion.category_column) params.set('category_column', suggestion.category_column);
        if (suggestion.time_column)     params.set('time_column',     suggestion.time_column);
        if (suggestion.z_column)        params.set('z_column',        suggestion.z_column);
        if (suggestion.aggregation)     params.set('aggregation',     suggestion.aggregation);

        // value_columns is always an array param
        if (suggestion.value_columns && Array.isArray(suggestion.value_columns)) {
            suggestion.value_columns.forEach(c => params.append('value_columns[]', c));
        } else if (suggestion.value_column) {
            params.append('value_columns[]', suggestion.value_column);
            if (suggestion.secondary_column) params.append('value_columns[]', suggestion.secondary_column);
        } else if (suggestion.value) {
            params.append('value_columns[]', suggestion.value);
        }

        // x_columns for regression
        if (suggestion.x_columns && Array.isArray(suggestion.x_columns)) {
            suggestion.x_columns.forEach(c => params.append('x_columns[]', c));
        }

        // Carry active filters so the chart reflects the same filtered subset
        const filterColumn = document.querySelector('.ql-filter-column-selector')?.value || '';
        const filterValue  = document.querySelector('.ql-filter-value')?.value || '';
        if (filterColumn && filterValue) {
            params.set('filter_category_column', filterColumn);
            params.set('filter_category_value',  filterValue);
        }
        const dateFilter = this.getDateFilterValues();
        if (dateFilter.column) {
            params.set('filter_date_column', dateFilter.column);
            if (dateFilter.from) params.set('filter_date_from', dateFilter.from);
            if (dateFilter.to)   params.set('filter_date_to',   dateFilter.to);
        }

        window.open('/ql-chart?' + params.toString(), '_blank');
    }
    
    getInsightIcon(type, severity) {
        const icons = {
           // 'holistic_analysis': '🤖',
            'holistic_analysis': '',
            'correlation': '🔗',
            'categorical_effect': '📊',
            'anova': '🎯',
            'outliers': '⚠️',
            'trend': severity === 'positive' ? '📈' : '📉',
            'average_level': severity === 'positive' ? '📊' : '📉',
            'autocorrelation': '🔄',
            'predictive_model': '🎯',
            'distribution': '📉',
            'skewness': '📐'
        };
        return icons[type] || '💡';
    }
    
    getImportanceBadge(importance) {
        if (importance >= 80) {
            return '<span class="ql-badge ql-badge-critical">Critical</span>';
        } else if (importance >= 60) {
            return '<span class="ql-badge ql-badge-high">High</span>';
        } else if (importance >= 40) {
            return '<span class="ql-badge ql-badge-medium">Medium</span>';
        } else {
            return '<span class="ql-badge ql-badge-low">Low</span>';
        }
    }
    
    createChartButton(insight) {
        return '';
        //return `
        //    <button class="ql-btn ql-btn-chart" 
        //            data-chart='${JSON.stringify(insight.chart_suggestion)}'>
        //        📊 View Chart
        //    </button>
        //`;
    }
    
    showLoading() {
        this.container.innerHTML = '<div class="ql-loading">Analyzing data...</div>';
    }
    
    showError(message) {
        this.container.innerHTML = `<div class="ql-error">${message}</div>`;
    }
}

// Initialize (but don't auto-load insights)
const insightsPanel = new QLInsights();
