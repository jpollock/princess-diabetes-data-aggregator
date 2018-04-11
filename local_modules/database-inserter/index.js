'use strict';

var request = require('request');
var qs = require('querystring');
var mysql = require("mysql");
var dexcom = require("dexcom-fetcher")


var AWS = require('aws-sdk'),
    endpoint = "https://secretsmanager.us-west-2.amazonaws.com",
    region = "us-west-2",
    secretName = "Mariadb",
    secret,
    binarySecretData;


// Create a Secrets Manager client
var client = new AWS.SecretsManager({
    endpoint: endpoint,
    region: region
});


module.exports = {
    insert_data: function(entries) {
        client.getSecretValue({SecretId: "Mariadb"}, function(err, data) {
        if(err) {
            if(err.code === 'ResourceNotFoundException')
                console.log("The requested secret " +  "Mariadb" + " was not found");
            else if(err.code === 'InvalidRequestException')
                console.log("The request was invalid due to: " + err.message);
            else if(err.code === 'InvalidParameterException')
                console.log("The request had invalid params: " + err.message);
        }
        else {
            // Decrypted secret using the associated KMS CMK
            // Depending on whether the secret was a string or binary, one of these fields will be populated
            if(data.SecretString !== "") {
                secret = data.SecretString;
            } else {
                binarySecretData = data.SecretBinary;
            }
        }
        console.log(data.SecretString);
        var parseSecurity = JSON.parse(data.SecretString);
        console.log(parseSecurity.dbname);
    
        // Your code goes here. 
        var connection = mysql.createConnection({
          host     : parseSecurity.host,
          user     : parseSecurity.username,
          password : parseSecurity.password,
          database : parseSecurity.dbname
        }); 
        connection.connect(function(err) {
            if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }
        else{
            console.log("database has been connected");
        }
        });

        for (var entry of entries.entries()) {
            var key = entry[0],
            value = entry[1];
            var eventText = JSON.stringify(value, null, 2);
            console.log(key + " = " + value);
            var post  = {id: 1, title: 'Hello MySQL'};
            var query = connection.query('INSERT INTO cgm_readings_glucose SET ?', value, function (error, results, fields) {
              //if (error) throw error;
              // Neat!
            });
            console.log(query.sql); // INSERT INTO posts SET `id` = 1, `title` = 'Hello MySQL'    connection.end();

        }
        connection.end();

        
        });
    }

}