(function($, window, undefined) {
    $.fn.locationComplete = function( options ) {
        var $input = this;
        var value = $input.val();
        var searchInterval;
        var searchData = null;
        var keysdown = 0;

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
            resultsClass    : 'lc-results-container', // Class of container
            resultClass     : 'lc-result-item'
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
            $input.data('placeholder', $input.attr('placeholder'));
            $input.attr('placeholder', 'Loading locations...');

            loadData();
        }

        /*=================================
        =            LOAD DATA            =
        =================================*/
        
        function loadData() {
            // Check to see if localstorage is available and contains the postcode data.
            if(localStorageExists() && localStorage.getItem("postcodeData")) {
                parseData(localStorage.getItem("postcodeData"));
            } else {
                $.ajax({
                    url : settings.url,
                    success : parseData,
                    error : function() {
                        console.error( 'Error: Data load failed' )
                    }
                });
            }
            
        }


        /*==================================
        =            PARSE DATA            =
        ==================================*/

        function parseData(data) {
            // Save data
            if(localStorageExists()) {
                localStorage.setItem("postcodeData", data);
            }

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
            $input.attr('placeholder', $input.data('placeholder'));
            drawResults([]);
        }

        function startSearch(data) {
            searchInterval = setInterval(searchLocations, settings.interval);
        }

        function stopSearch() {
            $('.'+settings.resultsClass).hide();
            clearInterval(searchInterval);
        }


        /*==============================
        =            SEARCH            =
        ==============================*/
     
        function searchLocations() {

            // Only search if input has changed
            if($input.val() === value) return;
            var searchValue = $input.val().toLowerCase();

            // Only search if more than min letters is typed
            if(searchValue.length <= settings.searchAfter) {
                if($('.'+settings.resultClass).length > 0) {
                    drawResults([]);
                    value = $input.val();
                }
                return;
            };

            // If there are 3 commas in the search string then it is 
            // safe to assume that the field has been autofilled,
            // so there is no need to search

            if(searchValue.split(',').length > 2) {
                if($('.'+settings.resultClass).length > 0) {
                    drawResults([]);
                    value = $input.val();
                }
                return;
            }

            var searchValues = searchValue.split(' ');
            var results = [];

            // Search Data
            var i = searchData.length;

            // Loop through each location
            while(i --) {
                var match = false;
                var matchWeight = 0;
                var k = searchValues.length;
                // Loop through each search term
                while(k--) {
                    // Make sure that search term is not empty
                    if(searchValues[k].length > 1) {
                        // Check if any search term exists in location at all
                        if(searchData[i].value.indexOf(searchValues[k]) !== - 1) {
                            match = true;
                            // If it does then loop through the tokens to see how 
                            // many matches there are and generate a search weight
                            var tokens = [].concat(searchData[i].tokens);
                            var j = tokens.length;

                            while( j -- ) {
                                var strIndex = tokens[j].indexOf(searchValues[k]);
                                
                                if(strIndex !== -1) {
                                    // Count as match and increment
                                    matchWeight += 2;

                                    // If input string is directly matched in data string, add extra weight
                                    if(searchData[i].value.indexOf(searchValue) !== -1) {
                                        matchWeight ++;
                                    }

                                    // If indexs are the same between search and token, increment
                                    if(j === k) {
                                        matchWeight ++;
                                    }

                                    // Give extra weight if search string is near start of token
                                    matchWeight += (4 / (strIndex + 1));

                                    // Give extra weight based on how close string is to an exact match
                                    matchWeight += (searchValues[k].length / tokens[j].length) * 2;

                                    // Give one extra weight for exact matches
                                    if(searchValues[k] === tokens[j]) {
                                        matchWeight ++;
                                    }

                                    tokens[j] = "";

                                    // We don't want to match the search term to multiple tokens so stop here if there's a match.
                                    break;
                                }
                            }
                        }
                    } else {
                        if(searchValue.length > 1 && searchData[i].value.indexOf(searchValue) !== -1) {
                            matchWeight += 3
                        }
                    }
                }

                if(match) {
                    // Base weight on how close to exact string we get
                    var weight = matchWeight / (searchData[i].tokens.length / searchValues.length);
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

            drawResults(results);
        }


        /*====================================
        =            DRAW RESULTS            =
        ====================================*/

        function drawResults(results) {
            var $container = $('.'+settings.resultsClass);
            var containerExists = $container.length > 0;
            $container = containerExists ? $container : $('<'+settings.resultsElement+' style="max-height:'+settings.maxHeight+'px; overflow-y: auto;"/>').addClass(settings.resultsClass);
            if(results.length === 0) {
                if($input.val().length < settings.searchAfter) {
                    $container.empty();
                }
                $container.hide();
                return;
            }

            var html = '';
            for ( var i = 0; i < results.length; i ++ ) {
                var sections = results[i][0].split(',');
                var postcode = sections[0];
                var place = toTitleCase(sections[1]);
                var state = sections[2].toUpperCase();
                var focused = i === 0 ? 'lc-focused' : '';
                html += '<li class="'+settings.resultClass+' '+focused+'">';
                html += (place+', '+state+', '+postcode);
                html += '</li>';
            };

            $container.empty().html(html).scrollTop(0);

            if(!containerExists) {
                $input.after($container);
                bindEvents($container);
            } else {
                $container.show();
            }
        }



        /*===================================
        =            BIND EVENTS            =
        ===================================*/
        
        function bindEvents($elem) {
            $('.'+settings.resultsClass).on('mouseenter mouseleave', '.'+settings.resultClass, function(e) {
                $('.lc-focused').removeClass('lc-focused');
                $(this).toggleClass('lc-focused');
            });

            $('.'+settings.resultsClass).on('mousedown', '.'+settings.resultClass, function(e) {
                selectItem(e, $input[0]);
            });

            $input.on('keydown', function(e) {
                switch(e.keyCode) {
                    case 38 : // Up
                        focusPrev(e, this);
                    break;
                    case 40 : // Down
                        focusNext(e, this);
                    break;
                    case 13: // Enter
                    case 9 : // tab
                        selectItem(e, this);
                    break;
                    
                    default:
                        return;
                }
                
                var $new = $('.lc-focused');
                if($new.length === 0) return;
                var current = $new.offset().top;
                var desired = ($elem.height() / 2) - ($new.height() / 2) + $elem.offset().top - $elem.scrollTop();
                var delta = current - desired;

                if(delta > 0) {
                    $elem.scrollTop(delta);
                } else {
                    $elem.scrollTop(0);
                }
            });

         

        }


        function focusPrev(e, elem) {
            if(elem.value.length <= settings.searchAfter) {
                return;
            }

            e.preventDefault();

            var $focused = $('.lc-focused');
            $focused.removeClass('lc-focused');
            var $prev = $focused.prev();

            if($focused.length === 0 || $prev.length === 0) {
                $('.'+settings.resultClass).last().addClass('lc-focused');
            } else {
                $prev.addClass('lc-focused');
            }
        }

        function focusNext(e, elem) {
            if(elem.value.length <= settings.searchAfter) {
                return;
            }

            e.preventDefault();

            var $focused = $('.lc-focused');
            $focused.removeClass('lc-focused');
            var $next = $focused.next();

            if($focused.length === 0 || $next.length === 0) {
                $('.'+settings.resultClass).first().addClass('lc-focused');
            } else {
                $next.addClass('lc-focused');
            }
        }

        function selectItem(e, elem) {
            
            var $focused = $('.lc-focused');

            if((elem.value.split(',').length === 3 && elem.value === $focused.text()) || elem.value.length < settings.searchAfter) {
                return;
            }

            e.preventDefault();

            if($focused.length === 0) {
                $focused = $('.'+settings.resultClass).first();
            }
            $input.val($focused.text());
            searchLocations();

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

        // Test if localstorage is available
        function localStorageExists() {
            try {
                localStorage.setItem('test', 'testing');
                localStorage.removeItem('test');
                return true;
            } catch(e) {
                return false;
            }
        }
        
        // Convert string to title case
        function toTitleCase(str) {
            return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
        }
        
        init();

        return this;
    };
})(jQuery, window)