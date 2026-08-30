/**
 * ql-client.js — shared QuantumLayers (QL) backend client for free-tools/.
 *
 * One dependency-light module every tool in this collection imports with a
 * plain <script> tag (no build step, no bundler). It is the ONLY place
 * transport and auth live: tools call QL.chart(), QL.login(), etc. and never
 * hand-roll a fetch() to admin-ajax.php themselves.
 *
 * Background reading: ../free-tools/QL-INTEGRATION.md (what each endpoint
 * needs and why this client is shaped the way it is) and
 * ../free-tools/DEPLOYMENT.md (what's confirmed vs. still unverified on
 * the QL side).
 *
 * Design notes, short version:
 *  - Talks to admin-ajax.php directly via fetch() — it does NOT load
 *    jdk/auth.js. See QL-INTEGRATION.md's "Why ql-client.js does not load
 *    jdk/auth.js" section for why (auth.js couples to QL's own page
 *    templates and DOM IDs, and its init() may redirect a visitor off the
 *    page in a way we don't control).
 *  - No anonymous mode: per direction from QL's operator, this repo's
 *    tools always require a signed-in session before showing any QL
 *    output — see CONVENTIONS.md's "sign-in-first pattern". Every method
 *    below except login/register/thirdPartySignin/checkAuth throws a
 *    QLError with code AUTH_REQUIRED when no session token is present,
 *    rather than making a request QL will reject anyway.
 *  - CORS is not a blocker, per the same direction: sign-in works
 *    cross-origin without it, and every other authenticated call only
 *    needs a valid Authorization: Bearer <token> header. See
 *    QL-INTEGRATION.md's "Design implications" section.
 *  - Session token is stored under its own localStorage key, scoped to
 *    whatever origin the tool is served from (a GitHub Pages origin, not
 *    quantumlayers.com) — Option A ("QL session token") never applies
 *    here since localStorage is per-origin.
 *  - NEVER put an Option C (API token) value anywhere in this file or in
 *    any tool that imports it. This client only ever holds short-lived
 *    session tokens obtained via sign-in/registration/thirdPartySignin.
 */

(function (global) {
  'use strict';

  var AJAX_URL = 'https://quantumlayers.com/wp-admin/admin-ajax.php';
  var TOKEN_KEY = 'ql_free_tools_session_token';
  var USER_KEY = 'ql_free_tools_user';

  // ---------------------------------------------------------------------
  // Normalized error surface
  // ---------------------------------------------------------------------

  /**
   * Every failure QL.* can produce — network, auth, or a QL-reported
   * API error — comes out as one of these, so tools can write a single
   * catch block instead of guessing at fetch()/JSON/WordPress-envelope
   * shapes.
   *
   * `code` is one of:
   *   'AUTH_REQUIRED'  — this call needs a session and none is stored.
   *   'NETWORK'        — fetch() itself rejected. CORS is not expected to
   *                       be the cause (see QL-INTEGRATION.md) — look for
   *                       an actual connectivity problem (offline, DNS,
   *                       QL's server down) first.
   *   'INVALID_RESPONSE' — the response wasn't the JSON envelope we expect.
   *   'API_ERROR'      — QL responded with { success: false, ... }.
   */
  function QLError(message, opts) {
    opts = opts || {};
    var err = new Error(message);
    err.name = 'QLError';
    err.code = opts.code || 'API_ERROR';
    err.cause = opts.cause || null;
    return err;
  }

  // ---------------------------------------------------------------------
  // Session storage
  // ---------------------------------------------------------------------

  function safeStorage(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      // localStorage can throw in strict privacy modes / sandboxed frames.
      return fallback;
    }
  }

  function getSessionToken() {
    return safeStorage(function () {
      return global.localStorage.getItem(TOKEN_KEY);
    }, null);
  }

  function setSession(token, user) {
    safeStorage(function () {
      if (token) global.localStorage.setItem(TOKEN_KEY, token);
      if (user) global.localStorage.setItem(USER_KEY, JSON.stringify(user));
    });
    emit('authchange', { signedIn: !!token, user: user || getCurrentUser() });
  }

  function clearSession() {
    safeStorage(function () {
      global.localStorage.removeItem(TOKEN_KEY);
      global.localStorage.removeItem(USER_KEY);
    });
    emit('authchange', { signedIn: false, user: null });
  }

  function getCurrentUser() {
    return safeStorage(function () {
      var raw = global.localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    }, null);
  }

  function isSignedIn() {
    return !!getSessionToken();
  }

  // Minimal pub/sub so a tool's dataset picker / login button can react to
  // sign-in and sign-out without polling localStorage itself.
  var listeners = { authchange: [] };
  function on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return function off() {
      listeners[event] = listeners[event].filter(function (h) { return h !== handler; });
    };
  }
  function emit(event, payload) {
    (listeners[event] || []).forEach(function (h) {
      try { h(payload); } catch (e) { /* one bad listener shouldn't break the rest */ }
    });
  }
  // Cross-tab: if the user signs in/out in another tab, pick it up here too.
  if (global.addEventListener) {
    global.addEventListener('storage', function (e) {
      if (e.key === TOKEN_KEY) {
        emit('authchange', { signedIn: !!e.newValue, user: getCurrentUser() });
      }
    });
  }

  // ---------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------

  /**
   * Low-level call to admin-ajax.php. Not exported — every public method
   * below goes through this so error handling stays in one place.
   *
   * @param {string} action    QL's `action` POST field, e.g. 'ql_get_chart_data'.
   * @param {object} params    POST params. Arrays are sent as name[]=v1&name[]=v2
   *                           (the shape jQuery.serialize() produces, which is
   *                           what the API docs' examples show).
   * @param {object} opts
   * @param {'required'|'optional'|'none'} [opts.auth='optional']
   *        'required' — throw AUTH_REQUIRED locally if no session token is
   *        stored, instead of sending a request QL will reject anyway.
   *        'optional' — attach the token if one is stored, but don't
   *        require it (this is ql_get_chart_data's ql_try_auth case).
   *        'none' — never attach a token (sign-in/register calls, which
   *        issue the token rather than consuming one).
   */
  function call(action, params, opts) {
    opts = opts || {};
    var authMode = opts.auth || 'optional';
    var token = getSessionToken();

    if (authMode === 'required' && !token) {
      return Promise.reject(QLError(
        'Sign in to QuantumLayers to run this — this call requires an ' +
        'authenticated session even on public datasets. See QL-INTEGRATION.md.',
        { code: 'AUTH_REQUIRED' }
      ));
    }

    var headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (authMode !== 'none' && token) {
      headers.Authorization = 'Bearer ' + token;
    }

    var body = new URLSearchParams();
    body.set('action', action);
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach(function (item) { body.append(key + '[]', item); });
      } else {
        body.set(key, value);
      }
    });

    return global
      .fetch(AJAX_URL, { method: 'POST', headers: headers, body: body })
      .catch(function (networkErr) {
        throw QLError(
          'Could not reach QuantumLayers. This is a connectivity problem ' +
          '(offline, DNS, or QL\'s server unavailable) rather than CORS — ' +
          'CORS is not a blocker for this API. Try again shortly.',
          { code: 'NETWORK', cause: networkErr }
        );
      })
      .then(function (res) {
        return res
          .json()
          .catch(function (parseErr) {
            throw QLError(
              'QuantumLayers returned a response that was not valid JSON ' +
              '(HTTP ' + res.status + ').',
              { code: 'INVALID_RESPONSE', cause: parseErr }
            );
          })
          .then(function (json) {
            if (!json || typeof json.success === 'undefined') {
              throw QLError('Unexpected response shape from QuantumLayers.', {
                code: 'INVALID_RESPONSE',
              });
            }
            if (!json.success) {
              var msg =
                (json.data && (json.data.message || json.data.error)) ||
                'QuantumLayers rejected the request.';
              throw QLError(msg, { code: 'API_ERROR', cause: json });
            }
            return json.data;
          });
      });
  }

  // ---------------------------------------------------------------------
  // Auth: sign-in / registration / third-party JWT
  // ---------------------------------------------------------------------

  /**
   * Native QL email/password sign-in (ql_user_signin). This is the default
   * "sign in" path for a static tool with no backend of its own — see
   * QL-INTEGRATION.md's "What a static tool actually uses" section.
   */
  function login(email, password, remember) {
    return call(
      'ql_user_signin',
      { email: email, password: password, remember: !!remember },
      { auth: 'none' }
    ).then(function (data) {
      setSession(data.session_token, data.user);
      return data.user;
    });
  }

  /**
   * Native QL registration (ql_user_signup). `fields` mirrors the form
   * QL's own registration page submits; only email/password/terms_agreed
   * are truly required, the rest are optional metadata QL accepts.
   */
  function register(fields) {
    fields = fields || {};
    return call(
      'ql_user_signup',
      {
        email: fields.email,
        password: fields.password,
        first_name: fields.firstName,
        last_name: fields.lastName,
        company: fields.company,
        terms_agreed: !!fields.termsAgreed,
        marketing_consent: !!fields.marketingConsent,
        country: fields.country,
        referred_by_code: fields.referredByCode,
      },
      { auth: 'none' }
    ).then(function (data) {
      setSession(data.session_token, data.user);
      return data.user;
    });
  }

  /**
   * Option B — exchange a pre-signed third-party JWT for a QL session
   * (ql_third_party_signin / QLAuth.thirdPartySignin()). The JWT must
   * already be signed by a backend that holds the shared secret QL issued
   * when registering your provider — this function cannot mint one itself,
   * and nothing that runs in a browser should ever hold that secret. See
   * QL-INTEGRATION.md's "Option B" section and examples/third-party-jwt-signin/
   * for the (server-side) minting code.
   */
  function thirdPartySignin(jwt) {
    return call('ql_third_party_signin', { jwt: jwt }, { auth: 'none' }).then(
      function (data) {
        setSession(data.session_token, data.user);
        return data.user;
      }
    );
  }

  function logout() {
    // Best-effort server-side signout; the local session is cleared either
    // way so the tool's UI never gets stuck "signed in" on a network error.
    return call('ql_user_signout', {}, { auth: 'optional' })
      .catch(function () {})
      .then(function () {
        clearSession();
      });
  }

  /** Re-validates the stored token against the server. Never redirects —
   * unlike QLAuth's own checkAuth(), which the docs describe as possibly
   * bouncing an anonymous visitor to /ql-login (see QL-INTEGRATION.md). If
   * the token is invalid/expired, the local session is cleared and this
   * resolves to null rather than rejecting, since "not signed in" is a
   * normal state for a free-tool visitor, not an error. */
  function checkAuth() {
    if (!getSessionToken()) return Promise.resolve(null);
    return call('ql_check_auth', {}, { auth: 'optional' })
      .then(function (data) {
        if (data && data.logged_in && data.user) {
          setSession(getSessionToken(), data.user);
          return data.user;
        }
        clearSession();
        return null;
      })
      .catch(function () {
        clearSession();
        return null;
      });
  }

  // ---------------------------------------------------------------------
  // Datasets
  // ---------------------------------------------------------------------

  /** The signed-in user's own datasets (ql_get_dashboard_data). Requires a
   * session — this is the entry point for "run this on your own data". */
  function myDatasets() {
    return call('ql_get_dashboard_data', {}, { auth: 'required' });
  }

  /** Column schema + pre-computed per-column stats. Requires a session even
   * for public datasets (ql_verify_auth) — see QL-INTEGRATION.md. */
  function datasetDetail(datasetId) {
    return call(
      'ql_get_dataset_detail',
      { dataset_id: datasetId },
      { auth: 'required' }
    );
  }

  // ---------------------------------------------------------------------
  // Charts — the one endpoint anonymous visitors can actually call
  // ---------------------------------------------------------------------

  /**
   * ql_get_chart_data — the only endpoint using ql_try_auth. Works for an
   * anonymous visitor IF `datasetId` is a public dataset; works for a
   * signed-in user on any dataset they can read. Returns a Chart.js config
   * object ready for `new Chart(ctx, config)` — this client does not touch
   * Chart.js itself, see QL-INTEGRATION.md's "Rendering" section for the
   * CDN scripts each tool loads to render it.
   *
   * @param {number} datasetId
   * @param {string} chartType  e.g. 'bar', 'pie', 'scatter', 'histogram',
   *                             'box_plot', 'heatmap', 'time_series', ...
   *                             see QL-INTEGRATION.md's chart type table.
   * @param {object} params     type-specific params (x_column, y_column,
   *                             category_column, aggregation, filters, ...).
   */
  function chart(datasetId, chartType, params) {
    var payload = Object.assign(
      { dataset_id: datasetId, chart_type: chartType },
      params || {}
    );
    return call('ql_get_chart_data', payload, { auth: 'optional' });
  }

  /** Auth-required variant of the same call, worded for call sites where a
   * session is already known to be present (identical to chart(), kept as
   * a separate name for readability at call sites that only make sense
   * post-sign-in). */
  function myChart(datasetId, chartType, params) {
    var payload = Object.assign(
      { dataset_id: datasetId, chart_type: chartType },
      params || {}
    );
    return call('ql_get_chart_data', payload, { auth: 'required' });
  }

  /** Rule-based + AI-scored chart recommendations (ql_get_recommended_charts).
   * Requires a session. `opts`: { maxCharts, selectedColumns, ...filters }. */
  function recommendedCharts(datasetId, opts) {
    opts = opts || {};
    return call(
      'ql_get_recommended_charts',
      {
        dataset_id: datasetId,
        max_charts: opts.maxCharts,
        selected_columns: opts.selectedColumns,
        filter_category_column: opts.filterCategoryColumn,
        filter_category_value: opts.filterCategoryValue,
        filter_date_column: opts.filterDateColumn,
        filter_date_from: opts.filterDateFrom,
        filter_date_to: opts.filterDateTo,
      },
      { auth: 'required' }
    );
  }

  // ---------------------------------------------------------------------
  // Statistics — all require a signed-in session (see QL-INTEGRATION.md)
  // ---------------------------------------------------------------------

  function stats(datasetId) {
    return call(
      'ql_get_statistical_summary',
      { dataset_id: datasetId },
      { auth: 'required' }
    );
  }

  function correlationMatrix(datasetId) {
    return call(
      'ql_get_correlation_matrix',
      { dataset_id: datasetId },
      { auth: 'required' }
    );
  }

  function distributionAnalysis(datasetId, columnName) {
    return call(
      'ql_get_distribution_analysis',
      { dataset_id: datasetId, column_name: columnName },
      { auth: 'required' }
    );
  }

  function pcaAnalysis(datasetId, nComponents) {
    return call(
      'ql_get_pca_analysis',
      { dataset_id: datasetId, n_components: nComponents },
      { auth: 'required' }
    );
  }

  function anovaAnalysis(datasetId) {
    return call(
      'ql_get_anova_analysis',
      { dataset_id: datasetId },
      { auth: 'required' }
    );
  }

  // ---------------------------------------------------------------------
  // AI insights — requires a signed-in session (see QL-INTEGRATION.md)
  // ---------------------------------------------------------------------

  /** `opts`: { selectedColumns, maxInsights, userPrompt, includeAi, ...filters } */
  function insights(datasetId, opts) {
    opts = opts || {};
    return call(
      'ql_get_insights',
      {
        dataset_id: datasetId,
        selected_columns: opts.selectedColumns,
        max_insights: opts.maxInsights,
        user_prompt: opts.userPrompt,
        include_ai: opts.includeAi,
        filter_category_column: opts.filterCategoryColumn,
        filter_category_value: opts.filterCategoryValue,
        filter_date_column: opts.filterDateColumn,
        filter_date_from: opts.filterDateFrom,
        filter_date_to: opts.filterDateTo,
      },
      { auth: 'required' }
    );
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  var QL = {
    // auth
    login: login,
    register: register,
    thirdPartySignin: thirdPartySignin,
    logout: logout,
    checkAuth: checkAuth,
    isSignedIn: isSignedIn,
    getCurrentUser: getCurrentUser,
    getSessionToken: getSessionToken,
    on: on,

    // datasets
    myDatasets: myDatasets,
    datasetDetail: datasetDetail,

    // charts
    chart: chart,
    myChart: myChart,
    recommendedCharts: recommendedCharts,

    // stats
    stats: stats,
    correlationMatrix: correlationMatrix,
    distributionAnalysis: distributionAnalysis,
    pcaAnalysis: pcaAnalysis,
    anovaAnalysis: anovaAnalysis,

    // insights
    insights: insights,

    // errors — exported so tools can do `err.code === QL.ErrorCodes.AUTH_REQUIRED`
    ErrorCodes: {
      AUTH_REQUIRED: 'AUTH_REQUIRED',
      NETWORK: 'NETWORK',
      INVALID_RESPONSE: 'INVALID_RESPONSE',
      API_ERROR: 'API_ERROR',
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QL;
  } else {
    global.QL = QL;
  }
})(typeof window !== 'undefined' ? window : this);
