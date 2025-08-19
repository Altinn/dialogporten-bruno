const axios = require('axios');

// Initialize the Altinn class only if it's not already defined.
// This prevents re-declaration during the script's lifecycle.
if (typeof Altinn === "undefined") {
    global.Altinn = class {
        // --- Constants for magic strings and configuration ---
        static TOKEN_GENERATOR_BASE_URL = "https://altinn-testtools-token-generator.azurewebsites.net/api";
        static LOCAL_MASKINPORTEN_GENERATOR_URL = "http://localhost:17823?cache=true";
        static TOKEN_CACHE_VAR_NAME = "tokenCache";
        static DEFAULT_TOKEN_TTL_SECONDS = 86400; // 24 hours

        constructor(req) {
            this.req = req;
        }

        /**
         * Main authentication method to be called from the pre-request script.
         * @param {object} settings - Optional settings to override token parameters.
         */
        async Authenticate(settings = {}) {
            await this._authenticateToken(settings);
        }

        /**
         * Handles the core logic of retrieving and setting the authentication token.
         * @param {object} settings - Settings for token generation.
         */
        async _authenticateToken(settings) {
            // --- Early exit conditions ---
            if (this._getVariable("DoNotSetAuthorizationHeader", null)) {
                console.log("Skipping token generation: 'DoNotSetAuthorizationHeader' is set.");
                return;
            }

            const manualToken = this._getVariable("MaskinportenAccessToken", null);
            if (manualToken) {
                console.log("Using manual 'MaskinportenAccessToken'.");
                this._setAuthorizationHeader(manualToken);
                return;
            }

            if (this._getVariable("UseMaskinportenTokenGenerator", null)) {
                console.log(`Using local MaskinportenTokenGenerator at ${Altinn.LOCAL_MASKINPORTEN_GENERATOR_URL}`);
                const token = await this._getTokenFromLocalGenerator();
                this._setAuthorizationHeader(token);
                return;
            }

            // --- Proceed with standard token generation ---
            this._ensureRequiredCredentials();

            const tokenParams = this._prepareTokenParameters(settings);
            const cacheKey = this._createCacheKey(tokenParams);

            const cachedToken = this._getCachedToken(cacheKey);
            if (cachedToken) {
                console.log(`Using cached token, valid until ${new Date(cachedToken.validUntil).toLocaleString()}`);
                this._setAuthorizationHeader(cachedToken.token);
                return;
            }

            console.log(`Fetching new ${tokenParams.tokenType} token with scopes '${tokenParams.scopes}'`);
            const newToken = await this._fetchNewToken(tokenParams);
            this._setCachedToken(cacheKey, newToken);
            this._setAuthorizationHeader(newToken);
        }

        /**
         * Prepares the parameters for the token request by merging defaults and settings.
         */
        _prepareTokenParameters(settings) {
            return {
                orgNo: settings.orgNo ?? null,
                tokenType: settings.tokenType ?? "enterprise",
                app: settings.app ?? "platform.undefined",
                scopes: settings.scopes ?? "altinn:serviceowner",
                org: settings.org ?? null,
                supplierOrgNo: settings.supplierOrgNo ?? null,
                partyId: settings.partyId ?? null,
                userId: settings.userId ?? null,
                userName: settings.userName ?? null,
                systemUserId: settings.systemUserId ?? null,
                systemUserOrg: settings.systemUserOrg ?? null,
                pid: settings.pid ?? null,
                env: this._getVariable("tokenEnvName", "at23"),
                ttl: Altinn.DEFAULT_TOKEN_TTL_SECONDS,
            };
        }

        /**
         * Fetches a new token from the remote generator service.
         * @param {object} params - The parameters for the token request.
         * @returns {Promise<string>} The new token.
         */
        async _fetchNewToken(params) {
            const tokenUrl = this._buildTokenUrl(params);
            const basicAuthString = Buffer.from(
                `${this._getVariable("TokenGeneratorUserName")}:${this._getVariable("TokenGeneratorPassword")}`
            ).toString('base64');

            try {
                const response = await axios.get(tokenUrl, {
                    headers: { 'Authorization': `Basic ${basicAuthString}` }
                });

                if (response.status !== 200) {
                    throw new Error(`Token generator responded with status ${response.status}: ${response.data}`);
                }
                return response.data;
            } catch (error) {
                console.error("Failed to fetch new token:", error.message);
                throw error;
            }
        }

        /**
         * Constructs the appropriate token generator URL based on the token type.
         * @param {object} params - The parameters for the token request.
         * @returns {string} The fully constructed URL.
         */
        _buildTokenUrl(params) {
            const tokenTypeConfig = {
                enterprise: { path: "/GetEnterpriseToken", params: ["orgNo", "org", "partyId", "supplierOrgNo"] },
                platform: { path: "/GetPlatformToken", params: ["app"] },
                person: { path: "/GetPersonalToken", params: ["pid", "partyId", "userId"] },
                enterpriseuser: { path: "/GetEnterpriseUserToken", params: ["orgNo", "partyId", "userId", "userName"] },
                systemuser: { path: "/GetSystemUserToken", params: ["systemUserId", "systemUserOrg"] },
            };

            const config = tokenTypeConfig[params.tokenType];
            if (!config) {
                throw new Error(`Unknown token type: ${params.tokenType}`);
            }

            const baseUrl = `${Altinn.TOKEN_GENERATOR_BASE_URL}${config.path}`;
            const queryParams = {
                env: params.env,
                ttl: params.ttl,
                scopes: params.scopes,
            };

            // Add token-specific parameters to the query object
            config.params.forEach(p => {
                if (params[p]) {
                    queryParams[p] = params[p];
                }
            });

            // Build the query string with URL encoding for compatibility
            const queryString = Object.entries(queryParams)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');

            return `${baseUrl}?${queryString}`;
        }

        /**
         * Fetches a token from the local Maskinporten token generator.
         * @returns {Promise<string>} The access token.
         */
        async _getTokenFromLocalGenerator() {
            try {
                const response = await axios.get(Altinn.LOCAL_MASKINPORTEN_GENERATOR_URL);
                if (response.status !== 200) {
                    throw new Error(`Local generator responded with status ${response.status}`);
                }
                if (!response.data?.access_token) {
                    throw new Error("No access_token in response from local generator.");
                }
                console.log("Successfully got token from local MaskinportenTokenGenerator.");
                return response.data.access_token;
            } catch (error) {
                console.error("Failed to connect to local Maskinporten token generator:", error.message);
                throw new Error("Unable to get token from local generator. Ensure https://github.com/altinn/MaskinportenTokenGenerator is running in server mode.");
            }
        }

        // --- Caching Helper Methods ---

        _getCache() {
            try {
                const cacheString = bru.getEnvVar(Altinn.TOKEN_CACHE_VAR_NAME);
                if (!cacheString) return {};         
                return JSON.parse(cacheString);
            } catch (error) {
                console.warn("Could not parse token cache. Starting with a fresh cache.", error);
                return {};
            }
        }

        _setCache(cache) {
            const cacheString = JSON.stringify(cache);
            bru.setEnvVar(Altinn.TOKEN_CACHE_VAR_NAME, cacheString);
        }

        _getCachedToken(key) {
            const cache = this._getCache();
            const cachedItem = cache[key];

            if (cachedItem && cachedItem.validUntil > Date.now()) {
                return cachedItem;
            }
            return null;
        }

        _setCachedToken(key, token) {
            const cache = this._getCache();
            const validUntil = Date.now() + (Altinn.DEFAULT_TOKEN_TTL_SECONDS - 60) * 1000; // 1 min buffer
            cache[key] = { token, validUntil };
            this._setCache(cache);
            console.log(`Token cached until ${new Date(validUntil).toLocaleString()}`);
        }

        _createCacheKey(params) {
            // Creates a consistent key from the most relevant token parameters.
            const keyParts = [
                params.env, params.orgNo, params.org, params.partyId,
                params.tokenType, params.scopes, params.app, params.userId,
                params.pid, params.systemUserId
            ];
            return keyParts.filter(p => p).join('_'); // Filter out null/undefined parts
        }

        // --- Utility Methods ---

        _setAuthorizationHeader(token) {
            const headerName = this._getVariable("AuthorizationHeaderName", "Authorization");
            // Clear the header first to prevent potential duplicates
            this.req.setHeader(headerName, null);
            this.req.setHeader(headerName, `Bearer ${token}`);
        }

        _getVariable(name, defaultValue = undefined) {
            // Defines a clear lookup order: collection, environment, process
            // The 'bru' object is globally available in the Bruno script environment.
            const lookupOrder = [
                (varName) => bru.getCollectionVar(varName),
                (varName) => bru.getEnvVar(varName),
                (varName) => bru.getProcessEnv(varName)
            ];

            for (const getter of lookupOrder) {
                const value = getter(name);
                if (value !== undefined && value !== null) {
                    return value;
                }
            }

            if (defaultValue === undefined) {
                console.warn(`Unset variable and no default provided: ${name}`);
            }
            return defaultValue;
        }

        _ensureRequiredCredentials() {
            const requiredVars = ['TokenGeneratorUserName', 'TokenGeneratorPassword'];
            for (const varName of requiredVars) {
                if (!this._getVariable(varName, null)) {
                    throw new Error(`Missing required variable '${varName}'. Please ensure it's set in your collection's .env file.`);
                }
            }
        }
    }
}

module.exports = Altinn;
