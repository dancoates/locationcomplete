Location Complete
================

jQuery Plugin designed to handle location autocomplete.

This is built to handle large datasets and as a result has some preprocessing requirements for the data format to prevent javascript from having to parse huge amounts of data.

- All data must be lowercase
- Data must be in csv format (to reduce file-size)
- All unnecessary columns must be removed
- Data must use unix line endings
- Data must consist of three columns (Location Name, State, Postcode)

## Usage

### Basic

    $('#locationcomplete').locationComplete({
        url : 'postcodes.csv'
    });


### With all options

    $('#locationcomplete').locationcomplete({
        url : 'postcodes.csv',
        limit           : 10,   // Limit results displayed
        interval        : 100,  // Interval to check for changes in the input
        postCodeIndex   : 0,    // Postcode column in csv
        stateIndex      : 2,    // State column in csv
        placeIndex      : 1,    // Place column in csv
        maxHeight       : 200,  // Maximun height of results element
        searchAfter     : 2,    // Only search after this amount of letters is typed
        resultsElement  : 'ul', // Container to hold results list
        resultElement   : 'li',  // Container to hold result
        resultsClass    : 'lc-results-container', // Class of container
        resultClass     : 'lc-result-item' // Class for result item
    })


## Styling

You can choose what elements and classes to use to wrap the results list.

A class of `.lc-focused` is applied to the element that is focused either by hover or arrow keys.

See below for some basic example styling

    .container {
        width: 300px;
        margin: 100px auto;
    }

    #locationcomplete {
        width: 100%;
        display: block;
        padding: 10px;
        border: 1px solid #ccc;
        outline: none;
        font-size: 1.2em;
    }

    #locationcomplete:focus {
        border: 1px solid #333;
    }

    .lc-results-container {
        width: 100%;
        font-family: Arial, Helvetica, sans-serif;
        padding: 0;
        margin: 0;
        background: #eee;
    }

    .lc-result-item {
        padding: 10px;
        font-size: 1.2em;
        list-style: none;
    }

    .lc-result-item.lc-focused {
        background: #333;
        color: white;
        cursor: pointer;
    }

