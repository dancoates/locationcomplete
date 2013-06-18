(function($, window, undefined) {
    $.fn.locationComplete = function( options ) {
        var $input = this;
        var value = $input.val();
        var searchInterval;
        var searchData = null;

        // Define defaults
        var defaults = {
            limit           : 10,   // Limit results displayed
            interval        : 100,  // Interval to check for changes in the input
            postCodeIndex   : 0,    // Postcode column in csv
            stateIndex      : 2,    // State column in csv
            placeIndex      : 1,    // Place column in csv
            maxHeight       : 200,  // Maximun height of results element
            searchAfter     : 2,    // Only search after this amount of letters is typed
            resultsElement  : 'ul', // Container to hold results list
            resultElement   : 'li',  // Container to hold result
            resultsClass    : 'results-container', // Class of container
            resultClass     : 'result-item'
        };

        // Error will be thrown if these arent defined
        var required = ['url'];
        var settings = $.extend(defaults, options);

        function init() {
            var i = required.length;
            // Check to see if required settings are defined.
            while( i-- ) {
                if(!settings[required[i]]) {
                    console.error( 'Error: ' + required[i] + ' is not defined' );
                    return;
                }
            }
            loadData();
        }

        /*=================================
        =            LOAD DATA            =
        =================================*/
        
        function loadData() {
            $.ajax({
                url : settings.url,
                success : parseData,
                error : function() {
                    console.error( 'Error: Data load failed' )
                }
            })
        }


        /*==================================
        =            PARSE DATA            =
        ==================================*/

        function parseData(data) {
            var locations = data.split('\n');
            var i = locations.length;
            var parsed = [];
            if(i === 1) {
                console.error('Error: error parsing csv, check line endings - they should be unix');
                return;
            }

            while(i--) {
                var datum = {};
                datum.value = locations[i];

                var section = locations[i].split(',');
                datum.tokens = section[settings.placeIndex]
                                    .split(' ')
                                    .concat([
                                        section[settings.postCodeIndex],
                                        section[settings.stateIndex]
                                    ]);
                parsed.push(datum);
            };
            searchData = parsed;
            setupSearch();
        }


        /*==========================================
        =            SEARCH ON INTERVAL            =
        ==========================================*/

        function setupSearch(data) {
            $input.on('focus', startSearch);
            $input.on('blur', stopSearch);
        }

        function startSearch(data) {
            searchInterval = setInterval(search, settings.interval);
        }

        function stopSearch() {
            clearInterval(searchInterval);
        }


        /*==============================
        =            SEARCH            =
        ==============================*/
     
        function search() {
            // Only search if input has changed
            if($input.val() === value) return;
            var searchValue = $input.val().toLowerCase();

            // Only search if more than min letters is typed
            if(searchValue.length <= settings.searchAfter) return;

            var searchValues = searchValue.split(' ');
            var results = [];

            // Search Data
            var i = searchData.length;

            var start = new Date().getTime();
            // Loop through each location
            while(i --) {
                var match = false;
                var matches = 0;
                var k = searchValues.length;
                // Loop through each search term
                while(k--) {
                    // Make sure that search term is not empty
                    if(searchValues[k].length > 1) {
                        var j = searchData[i].tokens.length;
                        // Check if any search term exists in location at all
                        if(searchData[i].value.indexOf(searchValues[k]) !== - 1) {
                            match = true;
                            // If it does then loop through the tokens to see how 
                            // many matches there are and generate a search weight
                            while( j -- ) {
                                if(searchData[i].tokens[j].indexOf(searchValues[k]) !== -1) {
                                    matches ++;
                                    // Add extra weight for exact matches
                                    if(searchData[i].tokens[j] === searchValues[k]) {
                                        matches ++;
                                    }
                                }
                            }
                        }
                    }
                }

                if(match) {
                    // Base weight on how close to exact string we get
                    var weight = matches / searchData[i].tokens.length;
                    results.push([searchData[i].value, weight]);
                }
            }

            // Sort results based on weight
            results = results.sort(function(a,b){
                return a[1] < b[1] ? 1 : -1;
            });

            // Limit results
            results = results.slice(0, settings.limit);

            value = $input.val();
            console.log('processing took ' + (new Date().getTime() - start) + 'ms');
            drawResults(results);
        }


        /*====================================
        =            DRAW RESULTS            =
        ====================================*/

        function drawResults(results) {
            var start = new Date().getTime();
            var $container = $('.'+settings.resultsClass);
            var containerExists = $container.length > 0;
            $container = containerExists ? $container : $('<'+settings.resultsElement+'/>').addClass(settings.resultsClass);
            var html = '';
            for ( var i = 0; i < results.length; i ++ ) {
                var sections = results[i][0].split(',');
                var postcode = sections[0];
                var place = toTitleCase(sections[1]);
                var state = sections[2].toUpperCase();
                html += '<li class="'+settings.resultClass+'">';
                html += (place+', '+state+', '+postcode);
                html += '</li>';
            };

            $container.empty().html(html);

            if(!containerExists) {
                $input.after($container);
            }
            console.log('drawing took ' + (new Date().getTime() - start) + 'ms');        
        } 


        /*========================================
        =            HELPER FUNCTIONS            =
        ========================================*/
        // Allow console to work in IE8
        (function() {
            var method;
            var noop = function () {};
            var methods = [
                'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
                'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
                'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
                'timeStamp', 'trace', 'warn'
            ];
            var length = methods.length;
            var console = (window.console = window.console || {});

            while (length--) {
                method = methods[length];

                // Only stub undefined methods.
                if (!console[method]) {
                    console[method] = noop;
                }
            }
        }());
        
        function toTitleCase(str) {
            return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
        }
        
        init();

        return this;
    };
})(jQuery, window)