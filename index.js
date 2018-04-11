'use strict';

var dexcom = require("dexcom-fetcher")
var db = require("database-inserter")




var DIRECTIONS = {
  NONE: 0
, DoubleUp: 1
, SingleUp: 2
, FortyFiveUp: 3
, Flat: 4
, FortyFiveDown: 5
, SingleDown: 6
, DoubleDown: 7
, 'NOT COMPUTABLE': 8
, 'RATE OUT OF RANGE': 9
};

var Trends = (function ( ) {
  var keys = Object.keys(DIRECTIONS);
  var trends = keys.sort(function (a, b) {
    return DIRECTIONS[a] - DIRECTIONS[b];
  });
  return trends;
})( );
function directionToTrend (direction) {
  var trend = 8;
  if (direction in DIRECTIONS) {
    trend = DIRECTIONS[direction];
  }
  return trend;
}
function trendToDirection (trend) {
  return Trends[trend] || Trends[0];
}

// Map Dexcom's property values to Nightscout's.
function dex_to_entry (d) {
/*
[ { DT: '/Date(1426292016000-0700)/',
    ST: '/Date(1426295616000)/',
    Trend: 4,
    Value: 101,
    WT: '/Date(1426292039000)/' } ]
*/
  var regex = /\((.*)\)/;
  var wall = parseInt(d.WT.match(regex)[1]);
  var date = new Date(wall);
  var entry = {
    tenant_id: 1,
    sgv: d.Value
  , date: wall
  , date_string: date.toISOString( )
  , trend: d.Trend
  , direction: trendToDirection(d.Trend)
  , device: 'share2'
  , type: 'sgv'
  };
  return entry;
}

exports.post = function(event, context, callback) {


    dexcom.fetch(function (err, res, glucose) {
        var entries = glucose.map(dex_to_entry);
        console.log('Entries', entries);
        db.insert_data(entries);
    });

    var result = {
        statusCode: 200,
        body: 'Success',
        headers: {'content-type': 'text/text'}
    };

               
    callback(null, result); 

};