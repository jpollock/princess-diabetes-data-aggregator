var request = require('request');
var qs = require('querystring');
var AWS = require('aws-sdk'),
    endpoint = "https://secretsmanager.us-west-2.amazonaws.com",
    region = "us-west-2",
    secretName = "Dexcom",
    secret,
    binarySecretData;

function readENV(varName, defaultValue) {
    //for some reason Azure uses this prefix, maybe there is a good reason
    var value = process.env['CUSTOMCONNSTR_' + varName]
        || process.env['CUSTOMCONNSTR_' + varName.toLowerCase()]
        || process.env[varName]
        || process.env[varName.toLowerCase()];

    return value || defaultValue;
}

// Assemble query string for fetching data.
function fetch_query (opts) {
  // ?sessionID=e59c836f-5aeb-4b95-afa2-39cf2769fede&minutes=1440&maxCount=1"
  var q = {
    sessionID: opts.sessionID
  , minutes: opts.minutes || 1440
  , maxCount: opts.maxCount || 1
  };
  var url = Defaults.LatestGlucose + '?' + qs.stringify(q);
  return url;
}

// Defaults
var Defaults = {
  "applicationId":"d89443d2-327c-4a6f-89e5-496bbb0317db"
, "agent": "Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0"
, login: 'https://share1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName'
, accept: 'application/json'
, 'content-type': 'application/json'
, LatestGlucose: "https://share1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues"
// ?sessionID=e59c836f-5aeb-4b95-afa2-39cf2769fede&minutes=1440&maxCount=1"
, nightscout_upload: '/api/v1/entries.json'
, nightscout_battery: '/api/v1/devicestatus.json'
, MIN_PASSPHRASE_LENGTH: 12
};






// assemble the POST body for the login endpoint
function login_payload (opts) {
  var body = {
    "password": opts.password
  , "applicationId" : opts.applicationId || Defaults.applicationId
  , "accountName": opts.accountName
  };
  return body;
}

// Login to Dexcom's server.
function authorize (opts, then) {
  var url = Defaults.login;
  var body = login_payload(opts);
  var headers = { 'User-Agent': Defaults.agent
                , 'Content-Type': Defaults['content-type']
                , 'Accept': Defaults.accept };
  var req ={ uri: url, body: body, json: true, headers: headers, method: 'POST'
           , rejectUnauthorized: false };
  // Asynchronously calls the `then` function when the request's I/O
  // is done.
  return request(req, then);
}


module.exports = {
// Asynchronously fetch data from Dexcom's server.
// Will fetch `minutes` and `maxCount` records.
  fetch: function (then) {

    // Create a Secrets Manager client
    var client = new AWS.SecretsManager({
        endpoint: endpoint,
        region: region
    });

    client.getSecretValue({SecretId: secretName}, function(err, data) {
        console.log(err);
        if(err) {
            if(err.code === 'ResourceNotFoundException')
                console.log("The requested secret " + secretName + " was not found");
            else if(err.code === 'InvalidRequestException')
                console.log("The request was invalid due to: " + err.message);
            else if(err.code === 'InvalidParameterException')
                console.log("The request had invalid params: " + err.message);

            var result = {
                statusCode: 500,
                body: 'Failure',
                headers: {'content-type': 'text/text'}
            };

        }
        else {
            console.log(data);
            // Decrypted secret using the associated KMS CMK
            // Depending on whether the secret was a string or binary, one of these fields will be populated
            if(data.SecretString !== "") {
                secret = data.SecretString;
            } else {
                binarySecretData = data.SecretBinary;
            }

            var parseSecurity = JSON.parse(secret);
            var username = Object.keys(parseSecurity)[0];
            var password = parseSecurity[username];
            
            //var contents = fs.readFileSync(`public${path.sep}index.html`);
            var config = {
                accountName: username
                , password: password
            };
            var fetch_config = { maxCount: 100
                , minutes:  1440};

            var opts = {
                login: config
                , fetch: fetch_config
                , maxFailures:  3
                , firstFetchCount: 100
            };    
            var login_opts = opts.login;
            var fetch_opts = opts.fetch;

            authorize(login_opts, function (err, res, body) {
              fetch_opts.sessionID = body;

              var url = fetch_query(fetch_opts);
              var body = "";
              var headers = { 'User-Agent': Defaults.agent
                          , 'Content-Type': Defaults['content-type']
                          , 'Content-Length': 0
                          , 'Accept': Defaults.accept };

              var req ={ uri: url, body: body, json: true, headers: headers, method: 'POST'
                     , rejectUnauthorized: false };
              return request(req, then);
            });
        }
    });        
  }  
};