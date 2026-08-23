/**
 * QuantumLayers Countries helpers
 * File: assets/countries.js
 * 
 * This file contains shared helper functions used across multiple scripts
 * Load this before auth.js and user-profile.js
 */

(function(window) {
    'use strict';

    // Country list from ISO 3166-1 alpha-2 codes
    const COUNTRIES = [
        { code: 'AF', name: 'Afghanistan' },
        { code: 'AL', name: 'Albania' },
        { code: 'DZ', name: 'Algeria' },
        { code: 'AS', name: 'American Samoa' },
        { code: 'AD', name: 'Andorra' },
        { code: 'AO', name: 'Angola' },
        { code: 'AI', name: 'Anguilla' },
        { code: 'AQ', name: 'Antarctica' },
        { code: 'AG', name: 'Antigua and Barbuda' },
        { code: 'AR', name: 'Argentina' },
        { code: 'AM', name: 'Armenia' },
        { code: 'AW', name: 'Aruba' },
        { code: 'AU', name: 'Australia' },
        { code: 'AT', name: 'Austria' },
        { code: 'AZ', name: 'Azerbaijan' },
        { code: 'BS', name: 'Bahamas' },
        { code: 'BH', name: 'Bahrain' },
        { code: 'BD', name: 'Bangladesh' },
        { code: 'BB', name: 'Barbados' },
        { code: 'BY', name: 'Belarus' },
        { code: 'BE', name: 'Belgium' },
        { code: 'BZ', name: 'Belize' },
        { code: 'BJ', name: 'Benin' },
        { code: 'BM', name: 'Bermuda' },
        { code: 'BT', name: 'Bhutan' },
        { code: 'BO', name: 'Bolivia' },
        { code: 'BA', name: 'Bosnia and Herzegovina' },
        { code: 'BW', name: 'Botswana' },
        { code: 'BR', name: 'Brazil' },
        { code: 'BN', name: 'Brunei' },
        { code: 'BG', name: 'Bulgaria' },
        { code: 'BF', name: 'Burkina Faso' },
        { code: 'BI', name: 'Burundi' },
        { code: 'KH', name: 'Cambodia' },
        { code: 'CM', name: 'Cameroon' },
        { code: 'CA', name: 'Canada' },
        { code: 'CV', name: 'Cape Verde' },
        { code: 'KY', name: 'Cayman Islands' },
        { code: 'CF', name: 'Central African Republic' },
        { code: 'TD', name: 'Chad' },
        { code: 'CL', name: 'Chile' },
        { code: 'CN', name: 'China' },
        { code: 'CO', name: 'Colombia' },
        { code: 'KM', name: 'Comoros' },
        { code: 'CG', name: 'Congo' },
        { code: 'CD', name: 'Congo, Democratic Republic' },
        { code: 'CK', name: 'Cook Islands' },
        { code: 'CR', name: 'Costa Rica' },
        { code: 'CI', name: 'Côte d\'Ivoire' },
        { code: 'HR', name: 'Croatia' },
        { code: 'CU', name: 'Cuba' },
        { code: 'CY', name: 'Cyprus' },
        { code: 'CZ', name: 'Czech Republic' },
        { code: 'DK', name: 'Denmark' },
        { code: 'DJ', name: 'Djibouti' },
        { code: 'DM', name: 'Dominica' },
        { code: 'DO', name: 'Dominican Republic' },
        { code: 'EC', name: 'Ecuador' },
        { code: 'EG', name: 'Egypt' },
        { code: 'SV', name: 'El Salvador' },
        { code: 'GQ', name: 'Equatorial Guinea' },
        { code: 'ER', name: 'Eritrea' },
        { code: 'EE', name: 'Estonia' },
        { code: 'ET', name: 'Ethiopia' },
        { code: 'FJ', name: 'Fiji' },
        { code: 'FI', name: 'Finland' },
        { code: 'FR', name: 'France' },
        { code: 'GA', name: 'Gabon' },
        { code: 'GM', name: 'Gambia' },
        { code: 'GE', name: 'Georgia' },
        { code: 'DE', name: 'Germany' },
        { code: 'GH', name: 'Ghana' },
        { code: 'GR', name: 'Greece' },
        { code: 'GD', name: 'Grenada' },
        { code: 'GU', name: 'Guam' },
        { code: 'GT', name: 'Guatemala' },
        { code: 'GN', name: 'Guinea' },
        { code: 'GW', name: 'Guinea-Bissau' },
        { code: 'GY', name: 'Guyana' },
        { code: 'HT', name: 'Haiti' },
        { code: 'HN', name: 'Honduras' },
        { code: 'HK', name: 'Hong Kong' },
        { code: 'HU', name: 'Hungary' },
        { code: 'IS', name: 'Iceland' },
        { code: 'IN', name: 'India' },
        { code: 'ID', name: 'Indonesia' },
        { code: 'IR', name: 'Iran' },
        { code: 'IQ', name: 'Iraq' },
        { code: 'IE', name: 'Ireland' },
        { code: 'IL', name: 'Israel' },
        { code: 'IT', name: 'Italy' },
        { code: 'JM', name: 'Jamaica' },
        { code: 'JP', name: 'Japan' },
        { code: 'JO', name: 'Jordan' },
        { code: 'KZ', name: 'Kazakhstan' },
        { code: 'KE', name: 'Kenya' },
        { code: 'KI', name: 'Kiribati' },
        { code: 'KP', name: 'Korea, North' },
        { code: 'KR', name: 'Korea, South' },
        { code: 'KW', name: 'Kuwait' },
        { code: 'KG', name: 'Kyrgyzstan' },
        { code: 'LA', name: 'Laos' },
        { code: 'LV', name: 'Latvia' },
        { code: 'LB', name: 'Lebanon' },
        { code: 'LS', name: 'Lesotho' },
        { code: 'LR', name: 'Liberia' },
        { code: 'LY', name: 'Libya' },
        { code: 'LI', name: 'Liechtenstein' },
        { code: 'LT', name: 'Lithuania' },
        { code: 'LU', name: 'Luxembourg' },
        { code: 'MO', name: 'Macau' },
        { code: 'MK', name: 'Macedonia' },
        { code: 'MG', name: 'Madagascar' },
        { code: 'MW', name: 'Malawi' },
        { code: 'MY', name: 'Malaysia' },
        { code: 'MV', name: 'Maldives' },
        { code: 'ML', name: 'Mali' },
        { code: 'MT', name: 'Malta' },
        { code: 'MH', name: 'Marshall Islands' },
        { code: 'MR', name: 'Mauritania' },
        { code: 'MU', name: 'Mauritius' },
        { code: 'MX', name: 'Mexico' },
        { code: 'FM', name: 'Micronesia' },
        { code: 'MD', name: 'Moldova' },
        { code: 'MC', name: 'Monaco' },
        { code: 'MN', name: 'Mongolia' },
        { code: 'ME', name: 'Montenegro' },
        { code: 'MA', name: 'Morocco' },
        { code: 'MZ', name: 'Mozambique' },
        { code: 'MM', name: 'Myanmar' },
        { code: 'NA', name: 'Namibia' },
        { code: 'NR', name: 'Nauru' },
        { code: 'NP', name: 'Nepal' },
        { code: 'NL', name: 'Netherlands' },
        { code: 'NZ', name: 'New Zealand' },
        { code: 'NI', name: 'Nicaragua' },
        { code: 'NE', name: 'Niger' },
        { code: 'NG', name: 'Nigeria' },
        { code: 'NO', name: 'Norway' },
        { code: 'OM', name: 'Oman' },
        { code: 'PK', name: 'Pakistan' },
        { code: 'PW', name: 'Palau' },
        { code: 'PS', name: 'Palestine' },
        { code: 'PA', name: 'Panama' },
        { code: 'PG', name: 'Papua New Guinea' },
        { code: 'PY', name: 'Paraguay' },
        { code: 'PE', name: 'Peru' },
        { code: 'PH', name: 'Philippines' },
        { code: 'PL', name: 'Poland' },
        { code: 'PT', name: 'Portugal' },
        { code: 'PR', name: 'Puerto Rico' },
        { code: 'QA', name: 'Qatar' },
        { code: 'RO', name: 'Romania' },
        { code: 'RU', name: 'Russia' },
        { code: 'RW', name: 'Rwanda' },
        { code: 'WS', name: 'Samoa' },
        { code: 'SM', name: 'San Marino' },
        { code: 'ST', name: 'Sao Tome and Principe' },
        { code: 'SA', name: 'Saudi Arabia' },
        { code: 'SN', name: 'Senegal' },
        { code: 'RS', name: 'Serbia' },
        { code: 'SC', name: 'Seychelles' },
        { code: 'SL', name: 'Sierra Leone' },
        { code: 'SG', name: 'Singapore' },
        { code: 'SK', name: 'Slovakia' },
        { code: 'SI', name: 'Slovenia' },
        { code: 'SB', name: 'Solomon Islands' },
        { code: 'SO', name: 'Somalia' },
        { code: 'ZA', name: 'South Africa' },
        { code: 'SS', name: 'South Sudan' },
        { code: 'ES', name: 'Spain' },
        { code: 'LK', name: 'Sri Lanka' },
        { code: 'SD', name: 'Sudan' },
        { code: 'SR', name: 'Suriname' },
        { code: 'SZ', name: 'Swaziland' },
        { code: 'SE', name: 'Sweden' },
        { code: 'CH', name: 'Switzerland' },
        { code: 'SY', name: 'Syria' },
        { code: 'TW', name: 'Taiwan' },
        { code: 'TJ', name: 'Tajikistan' },
        { code: 'TZ', name: 'Tanzania' },
        { code: 'TH', name: 'Thailand' },
        { code: 'TL', name: 'Timor-Leste' },
        { code: 'TG', name: 'Togo' },
        { code: 'TO', name: 'Tonga' },
        { code: 'TT', name: 'Trinidad and Tobago' },
        { code: 'TN', name: 'Tunisia' },
        { code: 'TR', name: 'Turkey' },
        { code: 'TM', name: 'Turkmenistan' },
        { code: 'TV', name: 'Tuvalu' },
        { code: 'UG', name: 'Uganda' },
        { code: 'UA', name: 'Ukraine' },
        { code: 'AE', name: 'United Arab Emirates' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
        { code: 'UY', name: 'Uruguay' },
        { code: 'UZ', name: 'Uzbekistan' },
        { code: 'VU', name: 'Vanuatu' },
        { code: 'VA', name: 'Vatican City' },
        { code: 'VE', name: 'Venezuela' },
        { code: 'VN', name: 'Vietnam' },
        { code: 'YE', name: 'Yemen' },
        { code: 'ZM', name: 'Zambia' },
        { code: 'ZW', name: 'Zimbabwe' }
    ];

    /**
     * QuantumLayers Helper Functions
     */
    window.QLHelpers = {
        
        /**
         * Get the country list
         * @returns {Array} Array of country objects with code and name
         */
        getCountries: function() {
            return COUNTRIES;
        },
        
        /**
         * Populate a country dropdown with all countries
         * @param {string|jQuery} selector - jQuery selector or jQuery object for the select element
         * @param {string} selectedCountry - Country code to pre-select (optional)
         */
        populateCountryDropdown: function(selector, selectedCountry) {
            const $select = typeof selector === 'string' ? jQuery(selector) : selector;
            
            if ($select.length === 0) {
                console.warn('QLHelpers.populateCountryDropdown: Select element not found');
                return;
            }
            
            // Clear existing options
            $select.empty();
            
            // Add default option
            $select.append('<option value="">Select your country...</option>');
            
            // Add all countries
            COUNTRIES.forEach(function(country) {
                const option = jQuery('<option></option>')
                    .val(country.code)
                    .text(country.name);
                
                if (country.code === selectedCountry) {
                    option.prop('selected', true);
                }
                
                $select.append(option);
            });
        },
        
        /**
         * Get country name from country code
         * @param {string} countryCode - ISO 3166-1 alpha-2 country code
         * @returns {string} Country name or the code if not found
         */
        getCountryName: function(countryCode) {
            if (!countryCode) return '';
            
            const country = COUNTRIES.find(c => c.code === countryCode);
            return country ? country.name : countryCode;
        },
        
        /**
         * Get country code from country name
         * @param {string} countryName - Country name
         * @returns {string} Country code or empty string if not found
         */
        getCountryCode: function(countryName) {
            if (!countryName) return '';
            
            const country = COUNTRIES.find(c => 
                c.name.toLowerCase() === countryName.toLowerCase()
            );
            return country ? country.code : '';
        },
        
        /**
         * Check if a country code is valid
         * @param {string} countryCode - ISO 3166-1 alpha-2 country code
         * @returns {boolean} True if valid
         */
        isValidCountryCode: function(countryCode) {
            return COUNTRIES.some(c => c.code === countryCode);
        },
        
        /**
         * Auto-detect user's country using IP geolocation (optional)
         * Requires external service - ipapi.co
         * @param {function} callback - Function to call with country code
         */
        autoDetectCountry: function(callback) {
            jQuery.ajax({
                url: 'https://ipapi.co/json/',
                success: function(data) {
                    if (data && data.country_code) {
                        callback(data.country_code);
                    }
                },
                error: function() {
                    console.log('QLHelpers: Could not auto-detect country');
                }
            });
        }
    };

    // Log that helpers are loaded (optional)
    if (typeof console !== 'undefined' && console.log) {
        console.log('QLHelpers loaded with', COUNTRIES.length, 'countries');
    }

})(window);

