
(function($, window, undefined) {
    var index = 1;
    $.fn.locationComplete = function( options, callback ) {
        var $input = this;
        var value = $input.val();
        var searchInterval;
        var searchData = null;
        var keysdown = 0;
        var clickedOnResults = false;
        var id = "lcmplt" + index;
        index ++;

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
            resultClass     : 'lc-result-item',
            loadingMessage  : 'Loading locations...',
            appendTo : false
        };

        // Error will be thrown if these arent defined
        var required = ['url'];
        var settings = $.extend(defaults, options);
        var $parent = settings.appendTo ? $input.closest(settings.appendTo) : $input.parent();


        function init() {
            var i = required.length;
            // Check to see if required settings are defined.
            while( i-- ) {
                if(!settings[required[i]]) {
                    console.error( 'Error: ' + required[i] + ' is not defined' );
                    return;
                }
            }
            // Basic loading message
            $input.data('placeholder', $input.attr('placeholder'));
            $input.attr('placeholder', settings.loadingMessage);
            $input.attr('autocomplete', 'off');

            loadData();
        }

        /*=================================
        =            LOAD DATA            =
        =================================*/
        
        function loadData() {
            // Check to see if localstorage is available and contains the correct postcode data.
            if(localStorageExists() && localStorage.getItem("postcodeDataURL") === settings.url) {
                parseData(localStorage.getItem("postcodeData"));
            } else {
                // Otherwise ajax in the postcode data.
                $.ajax({
                    url : settings.url,
                    success : parseData,
                    error : function() {
                        console.error( 'Error: Data load failed' );
                    }
                });
            }
            
        }


        /*==================================
        =            PARSE DATA            =
        ==================================*/

        function parseData(data) {
            // Save data & URL
            if(localStorageExists()) {
                localStorage.setItem("postcodeData", data);
                localStorage.setItem("postcodeDataURL", settings.url);
            }

            var locations = data.split('\n');
            var i = locations.length;
            var parsed = [];
            // If data doesn't use unix line endings then splitting at \n won't work.
            if(i === 1) {
                console.error('Error: error parsing csv, check line endings - they should be unix');
                return;
            }


            while(i--) {
                var datum = {};
                // Save full value for exact string matching
                datum.value = locations[i];
                // Split CSV into columns
                var columns = locations[i].split(',');
                // Create an array of search tokens from the columns
                datum.tokens = columns[settings.placeIndex]
                                    .split(' ')
                                    .concat([
                                        columns[settings.postCodeIndex],
                                        columns[settings.stateIndex]
                                    ]);
                parsed.push(datum);
            }
            // Save to global variable and start search
            searchData = parsed;
            setupSearch();
        }


        /*==========================================
        =            SEARCH ON INTERVAL            =
        ==========================================*/

        function setupSearch(data) {
            // Bind events so that we search when input is focused
            $input.on('focus', startSearch);
            $input.on('blur', stopSearch);

            // Return placeholder to original value, now thtat everything is loaded
            $input.attr('placeholder', $input.data('placeholder') || "");

            // If user has already clicked in input before the data was ready, we should search now.
            if($input.is(":focus")) {
                startSearch();
            }

            if(callback) {
                callback($input);
            }

            // Start drawing results to bind key events.
            drawResults([]);
        }

        function startSearch() {
            searchLocations(true);
            // Because of some keyup problems on mobile devices we are searching on an interval instead.
            searchInterval = setInterval(searchLocations, settings.interval);
        }

        function stopSearch() {
            // Don't hide if we've clicked on results.
            if(!clickedOnResults) {
                // Hide dropdown and clear interval when we blur out.
                $('#' + id).hide();
                clearInterval(searchInterval);
            }
        }


        /*==============================
        =            SEARCH            =
        ==============================*/
     
        function searchLocations(initialFocus) {
            // Only search if input has changed
            if($input.val() === value && !initialFocus) return;

            var searchValue = $input.val().toLowerCase();

            // Only search if more than min letters is typed
            if(searchValue.length <= settings.searchAfter) {
                // Hide dropdown if less than min letters typed
                if($('.'+settings.resultClass).length > 0) {
                    drawResults([]);
                    value = $input.val();
                }
                return;
            }

            // If there are 3 commas in the search string then it is 
            // safe to assume that the field has been autofilled,
            // so there is no need to search

            if(searchValue.split(',').length > 2) {
                // Hide dropdown
                if($('.'+settings.resultClass).length > 0) {
                    drawResults([]);
                    value = $input.val();
                }
                return;
            }

            // Separate out search term into an array of tokens.
            var searchValues = searchValue.split(' ');
            var results = [];

            // SEARCH
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

                                    // If indexs are the same between search and token, add 1 weight
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
                        // Low complexity search for search terms of only one letter.
                        if(searchValue.length > 1 && searchData[i].value.indexOf(searchValue) !== -1) {
                            matchWeight += 3;
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
            var $container = $('#'+id);
            var containerExists = $container.length > 0;
            // Check if container exists and if so make $container equal to it, if not, create new container.
            $container = containerExists ? $container : $('<'+settings.resultsElement+' style="max-height:'+settings.maxHeight+'px; overflow-y: auto;"/>').addClass(settings.resultsClass).attr('id', id);

            // Empty container if there are no results
            if(results.length === 0) {
                $container.empty();

                return;
            }

            // Loop through results and generate html output.
            var html = '';
            for ( var i = 0; i < results.length; i ++ ) {
                var sections = results[i][0].split(',');
                var postcode = sections[0];
                var place = toTitleCase(sections[1]);
                var state = sections[2].toUpperCase();
                var focused = i === 0 ? 'lc-focused' : '';
                html += '<'+ settings.resultElement +' class="'+settings.resultClass+' '+focused+'">';
                html += (place+', '+state+', '+postcode);
                html += '</'+settings.resultElement+'>';
            }

            // Empty container and scroll to top.
            $container.empty().html(html).scrollTop(0);

            // If container doesn't exist, add it to the page.
            if(!containerExists) {
                if(settings.appendTo) {
                    $parent.append($container);
                } else {
                    $input.after($container);
                }
                bindEvents($container);
            } else {
                $container.show();
            }
        }



        /*===================================
        =            BIND EVENTS            =
        ===================================*/
        
        function bindEvents($elem) {

            var $container = $elem;

            // Add focused class on hover
            $container.on('mouseenter mouseleave', '.'+settings.resultClass, function(e) {
                $parent.find('.lc-focused').removeClass('lc-focused');
                $(this).toggleClass('lc-focused');
            });

            // Select item on click
            $container.on('click', '.'+settings.resultClass, function(e) {
                $parent.find('.lc-focused').removeClass('lc-focused');
                $(this).toggleClass('lc-focused');
                selectItem(e, $input[0]);
            });

            // This is a fix for an IE8 bug where clicking on the scroll bar of the results
            // dropdown causes the blur to trigger and the dropdown to close.
            $container.on('mousedown touchstart', function(e) {
                clickedOnResults = true;
            });
            
            // If focus moves from results container to anywhere else then close container
            // and return focus to input.
            $('html').on('click', function(e) {
                var $target = $(e.target);
                var $nearestparent = $target.closest(settings.appendTo);
                if($nearestparent.length === 0) {
                    clickedOnResults = false;
                    drawResults([]);
                }
            });


            // Bind Key Events
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
                
                var $new = $parent.find('.lc-focused');
                if($new.length === 0) return;

                // Make sure that selected item stays in middle of scrolling box.
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
            // Focus previous element
            if(elem.value.length <= settings.searchAfter) {
                return;
            }

            e.preventDefault();

            var $focused = $parent.find('.lc-focused');
            $focused.removeClass('lc-focused');
            var $prev = $focused.prev();

            if($focused.length === 0 || $prev.length === 0) {
                $('.'+settings.resultClass).last().addClass('lc-focused');
            } else {
                $prev.addClass('lc-focused');
            }
        }

        function focusNext(e, elem) {
            // Focus next element
            if(elem.value.length <= settings.searchAfter) {
                return;
            }

            e.preventDefault();

            var $focused = $parent.find('.lc-focused');
            $focused.removeClass('lc-focused');
            var $next = $focused.next();

            if($focused.length === 0 || $next.length === 0) {
                $('.'+settings.resultClass).first().addClass('lc-focused');
            } else {
                $next.addClass('lc-focused');
            }
        }

        function selectItem(e, elem) {
            // Select element
            var $focused = $parent.find('.lc-focused');

            if(!$focused || $focused.length === 0) {
                $input.trigger("locationcomplete:failedsearch", [$input.val()]);
                return;
            }

            if((elem.value.split(',').length === 3 && elem.value === $focused.text()) || elem.value.length < settings.searchAfter) {
                return;
            }

            e.preventDefault();

            if($focused.length === 0) {
                $focused = $('.'+settings.resultClass).first();
            }
            $input.val($focused.text());

            // Don't trigger on tab press
            if(e && e.keyCode !== 9) {
                // Trigger selected event
                $input.trigger("locationcomplete:select", [$focused.text()]);
            }

            searchLocations();

        }
        

        /*================================================================
        =            Method to validate location against data            =
        ================================================================*/
        
        this.validate = function(string) {
            // Don't validate if search data isn't loaded - leave that to the backend
            if(!searchData) {
                return true;
            }
            var value = string || $input.val();
            var terms = value.toLowerCase().split(',');
            // There should be three terms in a valid location
            if(terms.length !== 3) {
                return false;
            }

            var place = $.trim(terms[0]);
            var state = $.trim(terms[1]);
            var postcode = $.trim(terms[2]);

            var ordered = [];
            ordered[settings.placeIndex] = place;
            ordered[settings.stateIndex] = state;
            ordered[settings.postCodeIndex] = postcode;

            var search = ordered.join(',');
            var i = searchData.length;
            var match = false;
            while(i--) {
                if(searchData[i].value === search){
                    match = true;
                }
            }
            return match;

        };
        
        
        

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
})(jQuery, window);