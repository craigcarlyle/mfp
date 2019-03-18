'use strict';

var request = require('request');
var cheerio = require('cheerio');
var helpers = require('./helper-utils');

var fetchDateRange = function(username, startDate, endDate, fields, callback){
  //get MyFitnessPal URL (eg. 'https://www.myfitnesspal.com/reports/printable_diary/npmmfp?from=2014-09-13&to=2014-09-17')
  var url = helpers.mfpUrl(username, startDate, endDate);

  var options = {
    url: url,
    headers: {
    }
  };

  request(options, function(error, response, body) {
    if (error) throw error;

    var $ = cheerio.load(JSON.parse(body)); //load DOM from HTML file

    var dates = [];
    var $tables = [];

    //for each date encountered, add the date formatted as YYYY-MM-DD and data table
    //to their respective arrays
    $('.main-title-2').each(function(index, element){
      var $element = $(element);
      dates.push( helpers.formatDate(new Date($element.text())) );
      $tables.push($element.next('#food'));
    });

    //create a results object
    var results = {
      username: username,
      data: []
    };

    //subroutine that returns the data for a single date
    var processDate = function(date, $table) {
      //set results object to store data
      var results = {
        nutrition: {},
        workouts: [],
      };

      //define variable for determining columns of fields on MFP page
      var cols = {
        nutrition: {},
        workouts: [],
      };

      //find and set column numbers of nutrient fields
      $table.find('thead').find('tr').find('td').each(function(index, element){
        var $element = $(element);
        var fieldName = $element.text().toLowerCase();
        if (fieldName === "sugars") { fieldName = "sugar"; } // fixes MFP nutrient field name inconsistency
        if (fieldName === "cholest") { fieldName = "cholesterol"; } // fixes MFP nutrient field name inconsistency
        if (index !== 0) { cols.nutrition[fieldName] = index; } //ignore first field, which just says "Foods"
      });

      $table.next("#excercise").find('thead').find('tr').find('td').each(function(index, element){
        var $element = $(element);
        var fieldName = $element.text().toLowerCase();
        if (index !== 0) { cols.workouts[fieldName] = index; } //ignore first field, which just says "Foods"
      });

      //find row in MFP with nutrient totals
      var $nutritionDataRow = $table.find('tfoot').find('tr');
      var $workoutsDataRow = $table.next("#excercise").find('tfoot').find('tr');

      $table.next("#excercise").find("tbody").find('tr:not(.title)').each(function(index, element){
        var $element = $(element);

        if ($element.find("td:first-of-type").text() !== "MFP iOS calorie adjustment") {
          var exerciseData = {
            name: $element.find("td:first-of-type").text(),
            calories: helpers.convertToNum($element.find("td:nth-of-type(2)").text()),
            minutes: helpers.convertToNum($element.find("td:nth-of-type(3)").text())
          }
          results.workouts.push(exerciseData);
        }
      });

      //store data for each field in results
      for (var field in cols.nutrition) {
        var col = cols.nutrition[field] + 1; //because nth-child selector is 1-indexed, not 0-indexed
        var mfpData = $nutritionDataRow.find('td:nth-child(' + col + ')').first().text();
        results.nutrition[field] = helpers.convertToNum(mfpData);
      }

      if (fields !== 'all' && Array.isArray(fields)) {
        //create targetFields object to hash user-specified nutrient fields
        var targetFields = {};
        fields.forEach(function(field){
          targetFields[field] = true;
        });

        for (var nutrient in results) {
          if (targetFields[nutrient] === undefined) {
            delete results[nutrient];
          }
        }
      }

      //add date to results object
      results.date = date;

      return results;
    };

    //iterate through all dates and push data into a final results object
    for (var i = 0; i < dates.length; i++) {
      results.data.push( processDate(dates[i], $tables[i]) );
    }

    callback( results );
  });
};

module.exports = fetchDateRange;
