const axios = require('axios');

let isInitialized = typeof Altinn !== "undefined";
if (!isInitialized) {
    Altinn = class {

        constructor(req) {
            this.req = req;
        }
        
        async Authenticate(settings = {}) {
            const orgNo = typeof settings["orgNo"] !== "undefined" ? settings["orgNo"] : this._getVariable("RequestorOrgNo");

            console.log(settings);

            await this._authenticateToken(orgNo, settings);
        };

        async _authenticateToken(orgNo, settings) {
            // Add check for required environment variables at the start
            const requiredVars = ['TokenGeneratorUserName', 'TokenGeneratorPassword'];
            for (const varName of requiredVars) {
                if (!this._getVariable(varName, null)) {
                    throw new Error(`Missing required variable '${varName}'. Please ensure you have created your own .env file in the collection directory based on the .env.example file.`);
                }
            }

            if (this._getVariable("DoNotSetAuthorizationHeader", null)) {
                console.log("Using setting 'DoNotSetAuthorizationHeader', not using generator.");
                return;
            }

            if (this._getVariable("MaskinportenAccessToken", null) !== null && this._getVariable("MaskinportenAccessToken", null) != "") {
                console.log("Using setting 'MaskinportenAccessToken', not using generator.")
                this._setAuthorizationHeader(this._getVariable("MaskinportenAccessToken"));
                return;
            }

            if (this._getVariable("UseMaskinportenTokenGenerator", null)) {
                console.log("Using UseMaskinportenTokenGenerator running on http://localhost:17823/");
                this._getTokenFromMaskinportenTokenGenerator((token) => {
                    this._setAuthorizationHeader(token);
                });
                return;
            }

            const tokenType = typeof settings["tokenType"] == "undefined" ? "enterprise" : settings["tokenType"];
            const platformApp = typeof settings["app"] == "undefined" ? "platform.undefined" : settings["app"];            
            const scopes = typeof settings["scopes"] == "undefined" ? "altinn:serviceowner" : settings["scopes"]          
            const org = typeof settings["org"] == "undefined" ? null : settings["org"];
            const supplierOrgNo = typeof settings["supplierOrgNo"] == "undefined" ? null : settings["supplierOrgNo"];
            const partyId = typeof settings["partyId"] == "undefined" ? null : settings["partyId"];
            const userId = typeof settings["userId"] == "undefined" ? null : settings["userId"];
            const userName = typeof settings["userName"] == "undefined" ? null : settings["userName"];
            const systemUserId = typeof settings["systemUserId"] == "undefined" ? null : settings["systemUserId"];
            const systemUserOrg = typeof settings["systemUserOrg"] == "undefined" ? null : settings["systemUserOrg"];
            const pid = typeof settings["pid"] == "undefined" ? null : settings["pid"];
            const environmentName = this._getVariable("tokenEnvName", "at23");          
            const cacheKey = environmentName + "_" + orgNo + "_" + org + "_" + partyId + "_" + tokenType +"_" + scopes + "_" + platformApp + "_" + userId + "_" + pid + "_" + systemUserId; 
            const cacheKeyTtl = cacheKey + "_ttl";
            const tokenTtlSeconds = 86400;
            const tokenCacheName = "tokenCache";  


            let cacheString = this._getVariable(tokenCacheName) ? this._getVariable(tokenCacheName) : Buffer.from("{}").toString('base64');
            let cache = JSON.parse(Buffer.from(cacheString, 'base64').toString());
            if (typeof cache !== "object") cache = {};

            let cachedToken = typeof cache[cacheKey] === "undefined" ? null : cache[cacheKey];
            let cachedTokenUntil = typeof cache[cacheKeyTtl] === "undefined" ? Date.now() : cache[cacheKeyTtl];

            if (cachedToken === null || cachedTokenUntil <= Date.now()) {

                let tokenUrl = "";
                if (tokenType == "enterprise") {
                    tokenUrl = "https://altinn-testtools-token-generator.azurewebsites.net/api/GetEnterpriseToken?";
                    tokenUrl += "&env=" + environmentName;
                    tokenUrl += "&scopes=" + encodeURIComponent(scopes);
                    tokenUrl += "&orgNo=" + orgNo;
                    tokenUrl += "&ttl=" + tokenTtlSeconds;
                    if (org != null) tokenUrl += "&org=" + org;
                    if (partyId != null) tokenUrl += "&partyId=" + partyId;  
                    if (supplierOrgNo != null) tokenUrl += "&supplierOrgNo=" + supplierOrgNo;                  
                    console.info("Getting enterprise authentication token for orgNo '" + orgNo + "' on scopes '" + scopes + "'");
                }
                else if (tokenType == "platform") {
                    tokenUrl = "https://altinn-testtools-token-generator.azurewebsites.net/api/GetPlatformToken";
                    tokenUrl += "?env=" + environmentName;
                    tokenUrl += "&app=" + platformApp;
                    tokenUrl += "&ttl=" + tokenTtlSeconds;

                    console.info("Getting platform authentication token for app '" + platformApp + "'");
                }
                else if (tokenType == "person") {
                    tokenUrl = "https://altinn-testtools-token-generator.azurewebsites.net/api/GetPersonalToken";
                    tokenUrl += "?env=" + environmentName;
                    tokenUrl += "&ttl=" + tokenTtlSeconds;
                    tokenUrl += "&scopes=" + encodeURIComponent(scopes);
                    tokenUrl += "&pid=" + pid;
                    if (partyId != null) tokenUrl += "&partyId=" + partyId;
                    if (userId != null) tokenUrl += "&userId=" + userId;

                    console.info("Getting person authentication token for pid '" + pid + "'");
                }
                else if (tokenType == "enterpriseuser") {
                    tokenUrl = "https://altinn-testtools-token-generator.azurewebsites.net/api/GetEnterpriseUserToken";
                    tokenUrl += "?env=" + environmentName;
                    tokenUrl += "&ttl=" + tokenTtlSeconds;
                    tokenUrl += "&scopes=" + encodeURIComponent(scopes);
                    tokenUrl += "&orgNo=" + orgNo;
                    if (partyId != null) tokenUrl += "&partyId=" + partyId;
                    if (userId != null) tokenUrl += "&userId=" + userId;
                    if (userName != null) tokenUrl += "&userName=" + userName;
                } 
                else if (tokenType == "systemuser") {
                    tokenUrl = "https://altinn-testtools-token-generator.azurewebsites.net/api/GetSystemUserToken";
                    tokenUrl += "?env=" + environmentName;
                    tokenUrl += "&ttl=" + tokenTtlSeconds;
                    tokenUrl += "&scopes=" + encodeURIComponent(scopes);
                    tokenUrl += "&systemUserId=" + systemUserId;
                    if (systemUserOrg != null) tokenUrl += "&systemUserOrg=" + systemUserOrg;               
                }
                else {
                    console.error("Unknown token type: " + tokenType);
                    return;
                }

                const basicAuthString = Buffer.from(this._getVariable("TokenGeneratorUserName") 
                + ":" + this._getVariable("TokenGeneratorPassword")).toString('base64');
               
                return new Promise((resolve, reject) => {
                    axios.get(tokenUrl, {
                        headers: {
                            'Authorization': 'Basic ' + basicAuthString
                        }
                    })
                    .then(response => {
                        if (response.status !== 200) {
                            console.error(response.data);
                            reject(response.data);
                        } else {
                            cache[cacheKey] = response.data;
                            cache[cacheKeyTtl] = Date.now() + (tokenTtlSeconds - 1) * 1000;
                            console.log("Caching token until " + (new Date(cache[cacheKeyTtl])));
                            bru.setGlobalEnvVar(tokenCacheName, Buffer.from(JSON.stringify(cache)).toString('base64'));
                            this._setAuthorizationHeader(response.data);
                            resolve();
                        }
                    })
                    .catch(reject);
                });
            }
            else {
                console.log("Cached token valid until " + (new Date(cache[cacheKeyTtl])));
                this._setAuthorizationHeader(cache[cacheKey]);
                return Promise.resolve();
            }
        };

        _getTokenFromMaskinportenTokenGenerator(callback) {
            const localMaskinportenTokenGeneratorUrl = "http://localhost:17823?cache=true";
            console.log("Getting token from UseMaskinportenTokenGenerator running locally at:", localMaskinportenTokenGeneratorUrl);
            return new Promise((resolve, reject) => {
                axios.get(localMaskinportenTokenGeneratorUrl)
                .then(response => {
                    if (!response || !response.data) {
                        const error = "No response data received from Maskinporten token generator";
                        console.error(error);
                        reject(error);
                        return;
                    }

                    if (response.status !== 200) {
                        console.error("Error response from token generator:", response.data);
                        reject(response.data);
                        return;
                    }

                    if (!response.data.access_token) {
                        const error = "No access token found in response";
                        console.error(error, response.data);
                        reject(error);
                        return;
                    }

                    console.log("Successfully got token from UseMaskinportenTokenGenerator running locally.");
                    callback(response.data.access_token);
                    resolve();
                })
                .catch(error => {
                    console.error("Failed to connect to Maskinporten token generator:", error.message);
                    reject("Unable to get token from UseMaskinportenTokenGenerator running locally. You must use https://github.com/altinn/MaskinportenTokenGenerator running in server mode");
                });
            });
        }

        _setAuthorizationHeader(value) {
            var headerName = this._getVariable("AuthorizationHeaderName", "Authorization");
            this.req.setHeader(headerName, null);
            this.req.setHeader(headerName, "Bearer " + value);
        }

        _getVariable(name, defaultValue) {
            // First try process variables (from .env file)
            const processValue = bru.getProcessEnv(name);
            if (processValue !== undefined) return processValue;

            // Then try environment variables (from Bruno environments)
            const envValue = bru.getEnvVar(name);
            if (envValue !== undefined) return envValue;

            // Then try global variables (from Bruno globals)
            const globalValue = bru.getGlobalEnvVar(name);
            if (globalValue !== undefined) return globalValue;
            
            if (typeof defaultValue == "undefined") {
                console.warn("Unset environment/global variable: " + name);
            }
            
            return defaultValue;
        }
    }
}

module.exports = Altinn; 