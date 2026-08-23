/**
 * QuantumLayers Agent Interface
 * File: assets/agent.js
 *
 * Opens as a standalone popup window (no browser chrome).
 * Multi-turn chat with the QL_Agent AJAX endpoint.
 */

(function ($) {
    'use strict';

    /* ========================================================
       HTML passthrough — Claude responds in HTML directly.
       Extracts ql-chart blocks and replaces with chart embeds.
       ======================================================== */
    // Decode the handful of HTML entities the model may introduce around a chart spec.
    function decodeEntities(s) {
        return s.replace(/&quot;/g, '"').replace(/&#34;/g, '"')
                .replace(/&#0*39;/g, "'").replace(/&apos;/g, "'")
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
    }

    // True when the string parses to a JSON object carrying dataset_id + chart_type.
    function looksLikeChartSpec(json) {
        try {
            var p = JSON.parse(json.trim());
            return !!(p && typeof p === 'object' && p.dataset_id && p.chart_type);
        } catch (e) {
            return false;
        }
    }

    // Restore a canonical ```ql-chart fence around every chart spec, regardless of how
    // the model emitted it (fenced, <pre>/<code>-wrapped, entity-escaped, or bare inline).
    // Claude responds in HTML, so the fence is sometimes dropped; without this the raw
    // JSON would render as visible text instead of a chart.
    function normalizeChartBlocks(text) {
        if (!text) return text;

        // 1. Unwrap chart specs Claude placed inside <pre>/<code> tags.
        text = text.replace(/<pre[^>]*>(?:\s*<code[^>]*>)?([\s\S]*?)(?:<\/code>\s*)?<\/pre>/gi, function (m, inner) {
            var decoded = decodeEntities(inner).replace(/```(?:ql-chart)?/g, '').trim();
            return looksLikeChartSpec(decoded) ? '\n```ql-chart\n' + decoded + '\n```\n' : m;
        });
        text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, function (m, inner) {
            var decoded = decodeEntities(inner).trim();
            return looksLikeChartSpec(decoded) ? '\n```ql-chart\n' + decoded + '\n```\n' : m;
        });

        // 2. Protect existing fences so step 3 doesn't re-wrap them.
        var protectedBlocks = [];
        text = text.replace(/```ql-chart\s*\n[\s\S]*?```/g, function (m) {
            var token = '@@QLPROTECT' + protectedBlocks.length + '@@';
            protectedBlocks.push(m);
            return token;
        });

        // 3. Wrap remaining bare chart-spec JSON (specs use [] arrays, no nested {}).
        text = text.replace(/\{[^{}]*"chart_type"[^{}]*\}/g, function (m) {
            var decoded = decodeEntities(m);
            return looksLikeChartSpec(decoded) ? '\n```ql-chart\n' + decoded.trim() + '\n```\n' : m;
        });

        // 4. Restore protected fences.
        protectedBlocks.forEach(function (block, i) {
            text = text.replace('@@QLPROTECT' + i + '@@', function () { return block; });
        });

        return text;
    }

    function renderMarkdown(text) {
        if (!text) return '';
        text = normalizeChartBlocks(text);
        var chartBlocks = {};
        var chartIdx = 0;
        // Extract ql-chart blocks before setting innerHTML
        text = text.replace(/```ql-chart\r?\n([\s\S]*?)```/g, function (_, json) {
            var token = 'QLCHARTBLOCK' + (chartIdx++) + 'END';
            try { chartBlocks[token] = JSON.parse(json.trim()); }
            catch (e) { chartBlocks[token] = null; }
            return token;
        });
        function makeChartEmbed(token) {
            var params = chartBlocks[token];
            if (!params) return '<p class="ql-agent-chart-error">Invalid chart specification.</p>';
            var encoded = JSON.stringify(params).replace(/'/g, '&#39;');
            return '<div class="ql-agent-chart-embed" data-params=\'' + encoded + '\'>' +
                       '<div class="ql-agent-chart-loading">Loading chart…</div>' +
                   '</div>';
        }
        // Claude returns HTML directly — replace chart tokens with embed divs
        var html = text;
        html = html.replace(/<p>(QLCHARTBLOCK\d+END)<\/p>/g, function (_, token) {
            return makeChartEmbed(token);
        });
        html = html.replace(/QLCHARTBLOCK\d+END/g, function (token) {
            return makeChartEmbed(token);
        });
        return html;
    }

    /* ========================================================
       Timestamp helper
       ======================================================== */
    function timeNow() {
        var d = new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* ========================================================
       QL Agent UI
       ======================================================== */
    var QLAgent = {

        history: [],         // Claude conversation history
        isLoading: false,

        init: function () {
            this.checkAuth();
            this.bindEvents();
        },

        /* --------------------------------------------------
           Auth check (same pattern as other QL JS files)
           -------------------------------------------------- */
        checkAuth: function () {
            if (typeof qlAuth === 'undefined') {
                console.error('qlAuth not loaded');
                return;
            }

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: { action: 'ql_check_auth', nonce: qlAuth.nonce },
                success: function (response) {
                    if (!response.success || !response.data.logged_in) {
                        window.location.href = '/ql-login?redirect=' + encodeURIComponent(window.location.pathname);
                    }
                },
                error: function () {
                    console.warn('Auth check failed – continuing anyway.');
                }
            });
        },

        /* --------------------------------------------------
           Event binding
           -------------------------------------------------- */
        bindEvents: function () {
            var self = this;

            // Send on button click
            $(document).on('click', '#ql-agent-send', function () {
                self.send();
            });

            // Ctrl+Enter / Cmd+Enter to send
            $(document).on('keydown', '#ql-agent-input', function (e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    self.send();
                }
                // Auto-grow textarea
                self.autoGrow(this);
            });

            $(document).on('input', '#ql-agent-input', function () {
                self.autoGrow(this);
            });

            // New conversation button
            $(document).on('click', '.ql-agent-new-btn', function () {
                self.resetConversation();
            });

            // Suggestion chips
            $(document).on('click', '.ql-agent-suggestion', function () {
                var text = $(this).text().trim();
                $('#ql-agent-input').val(text);
                self.send();
            });
        },

        /* --------------------------------------------------
           Auto-grow textarea
           -------------------------------------------------- */
        autoGrow: function (el) {
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        },

        /* --------------------------------------------------
           Send message
           -------------------------------------------------- */
        send: function () {
            if (this.isLoading) return;

            var input   = $('#ql-agent-input');
            var message = input.val().trim();
            if (!message) return;

            // Append user bubble
            this.appendMessage('user', message);
            input.val('').css('height', '');
            this.setLoading(true);

            var self = this;

            $.ajax({
                url: qlAuth.ajaxurl,
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                data: {
                    action:  'ql_run_agent',
                    nonce:   qlAuth.nonce,
                    message: message,
                    history: JSON.stringify(self.history)
                },
                timeout: 180000, // 3 min – agent loops can take time
                success: function (response) {
                    self.setLoading(false);

                    if (response.success && response.data) {
                        var data = response.data;

                        // Update conversation history for next turn
                        if (data.messages && Array.isArray(data.messages)) {
                            self.history = data.messages;
                        }

                        var text = data.final_text || '(No response)';
                        self.appendMessage('assistant', text);
                    } else {
                        var errMsg = (response.data && response.data.message)
                            ? response.data.message
                            : 'An error occurred. Please try again.';
                        self.appendError(errMsg);
                    }
                },
                error: function (xhr, status) {
                    self.setLoading(false);
                    if (status === 'timeout') {
                        self.appendError('Request timed out. The agent may still be running – please wait and try again.');
                    } else {
                        self.appendError('Connection error. Please check your network and try again.');
                    }
                }
            });
        },

        /* --------------------------------------------------
           Append a message bubble to the conversation
           -------------------------------------------------- */
        appendMessage: function (role, text) {
            var $messages = $('#ql-agent-messages');

            // Remove welcome screen on first message
            $messages.find('.ql-agent-welcome').remove();

            var avatarLabel = (role === 'user') ? 'You' : '◆';
            var content = (role === 'assistant') ? renderMarkdown(text) : this.escapeHtml(text).replace(/\n/g, '<br>');

            var $msg = $(
                '<div class="ql-agent-message ql-agent-message--' + role + '">' +
                    '<div class="ql-agent-message-avatar">' + avatarLabel + '</div>' +
                    '<div class="ql-agent-message-body">' +
                        '<div class="ql-agent-message-content">' + content + '</div>' +
                        '<span class="ql-agent-message-time">' + timeNow() + '</span>' +
                    '</div>' +
                '</div>'
            );

            $messages.append($msg);

            if (role === 'assistant') {
                this.renderAgentCharts($msg);
            }

            this.scrollToBottom();
        },

        /* --------------------------------------------------
           Show / hide thinking indicator
           -------------------------------------------------- */
        setLoading: function (loading) {
            this.isLoading = loading;
            $('#ql-agent-send').prop('disabled', loading);

            if (loading) {
                var $thinking = $(
                    '<div class="ql-agent-thinking" id="ql-agent-thinking">' +
                        '<div class="ql-agent-thinking-avatar">◆</div>' +
                        '<div class="ql-agent-thinking-bubble">' +
                            '<div class="ql-agent-dot"></div>' +
                            '<div class="ql-agent-dot"></div>' +
                            '<div class="ql-agent-dot"></div>' +
                        '</div>' +
                    '</div>'
                );
                $('#ql-agent-messages').append($thinking);
                this.scrollToBottom();
            } else {
                $('#ql-agent-thinking').remove();
            }
        },

        /* --------------------------------------------------
           Append an error message
           -------------------------------------------------- */
        appendError: function (msg) {
            var $messages = $('#ql-agent-messages');
            $messages.append(
                '<div class="ql-agent-message ql-agent-message--assistant">' +
                    '<div class="ql-agent-message-avatar">◆</div>' +
                    '<div class="ql-agent-message-body">' +
                        '<div class="ql-agent-error">' + this.escapeHtml(msg) + '</div>' +
                    '</div>' +
                '</div>'
            );
            this.scrollToBottom();
        },

        /* --------------------------------------------------
           Reset conversation
           -------------------------------------------------- */
        resetConversation: function () {
            this.history    = [];
            this.isLoading  = false;
            $('#ql-agent-send').prop('disabled', false);
            $('#ql-agent-thinking').remove();
            $('#ql-agent-messages').html(this.buildWelcomeHTML());
        },

        /* --------------------------------------------------
           Welcome screen HTML
           -------------------------------------------------- */
        buildWelcomeHTML: function () {
            return (
                '<div class="ql-agent-welcome">' +
                    '<div class="ql-agent-welcome-icon">◆</div>' +
                    '<h2>QuantumLayers Agent</h2>' +
                    '<p>Ask me to analyze datasets, create visualizations, generate insights, or schedule reports — in plain language.</p>' +
                    '<div class="ql-agent-suggestions">' +
                        '<button class="ql-agent-suggestion">List my available datasets</button>' +
                        '<button class="ql-agent-suggestion">Generate insights for my most recent dataset</button>' +
                        '<button class="ql-agent-suggestion">Save the 3 best charts for dataset #1</button>' +
                        '<button class="ql-agent-suggestion">Create a weekly PDF report emailed to me</button>' +
                    '</div>' +
                '</div>'
            );
        },

        /* --------------------------------------------------
           Render inline chart embeds produced by ql-chart blocks
           -------------------------------------------------- */
        renderAgentCharts: function ($container) {
            if (typeof Chart === 'undefined') return;

            $container.find('.ql-agent-chart-embed').each(function () {
                var $embed = $(this);
                var params;
                try {
                    params = JSON.parse($embed.attr('data-params'));
                } catch (e) {
                    $embed.html('<p class="ql-agent-chart-error">Invalid chart data.</p>');
                    return;
                }

                // Flatten params for the ql_get_chart_data AJAX endpoint.
                // value_columns / x_columns may be arrays stored in params.
                // Guard against the AI nesting chart params under a "params" key
                // (e.g. {"chart_type":"histogram","params":{"column_name":"price"}})
                // instead of flattening them as the endpoint requires.
                var postData = { action: 'ql_get_chart_data', nonce: qlAuth.nonce };
                $.each(params, function (key, val) {
                    if (key === 'params' && val !== null && typeof val === 'object' && !Array.isArray(val)) {
                        $.each(val, function (k, v) { postData[k] = v; });
                    } else {
                        postData[key] = val;
                    }
                });

                $.ajax({
                    url: qlAuth.ajaxurl,
                    type: 'POST',
                    headers: { 'Authorization': 'Bearer ' + QLAuth.getSessionToken() },
                    data: postData,
                    success: function (response) {
                        if (response.success && response.data) {
                            var canvas = document.createElement('canvas');
                            $embed.empty().append(canvas);
                            try {
                                new Chart(canvas, response.data);
                            } catch (e) {
                                $embed.html('<p class="ql-agent-chart-error">Chart render error.</p>');
                            }
                        } else {
                            $embed.html('<p class="ql-agent-chart-error">Could not load chart.</p>');
                        }
                    },
                    error: function () {
                        $embed.html('<p class="ql-agent-chart-error">Chart load failed.</p>');
                    }
                });
            });
        },

        /* --------------------------------------------------
           Scroll messages to bottom
           -------------------------------------------------- */
        scrollToBottom: function () {
            var el = document.getElementById('ql-agent-messages');
            if (el) el.scrollTop = el.scrollHeight;
        },

        /* --------------------------------------------------
           Escape HTML for user input display
           -------------------------------------------------- */
        escapeHtml: function (text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }
    };

    /* ========================================================
       Boot
       ======================================================== */
    $(document).ready(function () {
        QLAgent.init();
    });

}(jQuery));
