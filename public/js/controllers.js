/**
 * INSPINIA - Responsive Admin Theme
 *
 * Main controller.js file
 * Define controllers with data used in Inspinia theme
 *
 */

function LoginCtrl($scope, $state, principal) {
    $scope.credentials = {};

    $scope.signIn = function() {
        principal.authenticate($scope.credentials).then(function(identity) {
            // identifyCtrl($scope, $state, principal);
            if ($scope.returnToState) {
                $state.go($scope.returnToState.name, $scope.returnToStateParams);
            } else {
                if (identity.data.domain === 'intolaw' || identity.data.domain.startsWith('ag_')) {
                    $state.go('activity');
                    return;
                }
                $state.go('stats');
            }
        });
    };

    $scope.signUp = function() {
        principal.register($scope.credentials).then(function() {
            $scope.signIn();
        });
    };
};

function identityCtrl($scope, $state, principal) {
    $scope.identity = {};
    principal.identity().then(function(identity) {
        $scope.identity = identity;
    });
}

function uploadCtrl($scope, $http, $location, $state, FileUploader) {
    $scope.uploader = new FileUploader({
        url: '/upload'
    });
}

function statsCtrl($scope, $http, $location, $state, principal) {
    $scope.period = "month";
    $scope.graphVolume = null;
    $scope.volumes = null;
    $scope.timings = null;
    $scope.accuracyItems = [];
    $scope.stats = {};

    $scope.getAccuracy = function() {
        principal.identity().then(function(identity) {
            var _arr = ['amount', 'IBAN', 'message', 'name'];
            if (identity.domain === 'bpost' || identity.domain === 'suuha') {
                _arr = ['amount', 'IBAN', 'message', 'name', 'person', 'street', 'number', 'zip']
            }
            var groups = ['correct', 'present', 'incorrect', 'missing'];
            var columns = [];
            columns.length = groups.length;
            for (var i = 0; i < groups.length; i++) {
                columns[i] = [];
                columns[i].push(groups[i]);
                for (var j = 0; j < _arr.length; j++) {
                    columns[i].push(0);
                }
            }
            var groupedColumns = {};
            for (var i = 0; i < columns.length; i++) {
                groupedColumns[columns[i][0]] = columns[i];
            }
            var graph = c3.generate({
                bindto: '#accuracy-chart',
                axis: {
                    rotated: true,
                    x: {
                        type: 'category',
                        categories: _arr
                    }
                },
                data: {
                    columns: columns,
                    type: 'bar',
                    groups: [groups],
                    order: null,
                    colors: {
                        'correct': 'rgb(44, 160, 44)',
                        'present': 'rgb(31, 119, 180)',
                        'incorrect': 'rgb(214, 39, 40)',
                        'missing': 'rgb(255, 127, 14)'
                    },
                    onclick: function(data) {
                        $location.url('/activity/' + 'IBAN' + '/' + data.id);
                        $scope.$apply();
                    }
                }
            });
            for (var _i = 0; _i < _arr.length; _i++) {
                var param = _arr[_i];
                (function(paramIndex, param) {
                    $http.get('/accuracy/' + param)
                        .success(function(counts) {
                            var amounts = {
                                correct: 0,
                                incorrect: 0,
                                present: 0,
                                missing: 0
                            };
                            for (var count_index in counts) {
                                var count = counts[count_index]
                                if (count.feedback === true) {
                                    if (count.correct) {
                                        amounts['correct'] += count.count;
                                    } else {
                                        amounts['incorrect'] += count.count;
                                    }
                                } else if (count.feedback === false) {
                                    if (count.present) {
                                        amounts['present'] += count.count;
                                    } else {
                                        amounts['missing'] += count.count;
                                    }
                                }
                            }
                            for (var i = 0; i < groups.length; i++) {
                                groupedColumns[groups[i]][1 + paramIndex] = amounts[groups[i]];
                            }
                            graph.load({
                                columns: columns
                            });
                            console.log(param, amounts['correct'], amounts['present'], amounts['incorrect'], amounts['missing'])
                        });
                })(_i, param);
            }
        });
    }

    $scope.getVolumes = function() {
        console.log('getting volumes')
        $http.get('/volumes').success(function(counts) {
            console.log(counts)
            $scope.volumes = counts;
        });
    };

    $scope.getTimings = function() {
        $http.get('/timings').success(function(timings) {
            for (var timingIndex in timings) {
                timings[timingIndex] /= 1000;
            }
            $scope.timings = timings;
        });
    };

    $scope.getStats = function() {
        $http.get('/stats').success(function(avg) {
            $scope.stats['before'] = avg.data;
            $scope.stats['after'] = avg.feedback;
        });
    };

    $scope.generateGraphVolume = function() {
        var chart = document.getElementById('chart-volume');
        chart.style.height = (chart.clientWidth / 3) + 'px';

        if ($scope.volumes === null) {
            return;
        }

        var dates = new Set();
        $scope.volumes.forEach(function(c) {
            c['dates'].forEach(function(d) {
                dates.add(d['date']);
            });
        });

        var xValues = {};
        var counter = 0;
        Array.from(dates).sort().forEach(function(d) {
            xValues[d] = counter;
            counter++;
        });

        var columns = [];
        var xColumn = Object.keys(xValues);
        $scope.volumes.forEach(function(c) {
            for (var i = 1, column = new Array(xColumn.length); i < xColumn.length;) {
                column[i++] = 0;
            }
            column[0] = c['subdomain'];
            c['dates'].forEach(function(d) {
                column[xValues[d['date']] + 1] = d['count'];
            });
            columns.push(column);
        });
        $scope.graphVolume = c3.generate({
            bindto: '#chart-volume',
            data: {
                columns: columns
            },
            axis: {
                x: {
                    type: 'category',
                    categories: xColumn.map(function(d) {
                        return d.substr(8);
                    })
                }
            },
            padding: {
                right: 30
            }
        });
    }

    $scope.$watch("volumes", function() {
        if ($scope.volumes !== null) {
            $scope.generateGraphVolume();
        }
    });
}

function activityCtrl($scope, $http, $location, $state, principal) {
    identity = {}
    $scope.period = "month";
    $scope.activities = null;
    $scope.doneLoading = false;

    $scope.getActivity = function() {
        principal.identity().then(function(identity) {
            $http.get($location.path()).success(function(activity) {
                for (var row_index in activity) {
                    var row = activity[row_index];
                    // row.workstation = "iPad";
                    if (row.timings) {
                        row.receivetime = new Date(row.timings.receive);
                        row.starttime = new Date(row.timings.start);
                        row.donetime = new Date(row.timings.done);
                        row.feedbacktime = new Date(row.timings.feedback);
                        row.leadtime = Math.round((row.donetime - row.receivetime) / 1000);
                        row.processingtime = Math.round((row.donetime - row.starttime) / 1000)
                    }
                    if (row.data && row.data.tags) {
                        for (var tagIndex in row.data.tags) {
                            var tag = row.data.tags[tagIndex];
                            if (!tag || !tag['label'] || !tag['content']) {
                                continue;
                            }
                            if (tag['label'] === 'typedocument') {
                                row.type = tag['content'];
                            }
                            if (tag['label'] === 'typeovertreding') {
                                row.type = tag['content'];
                            }
                        }
                    }
                    if (row.data && row.data.stats) {
                        row.accuracybefore = Math.round(row.data.stats.found / row.data.stats.total * 10000) / 100;
                    }
                    if (row.feedback && row.feedback.stats) {
                        row.accuracyafter = Math.round(row.feedback.stats.found / row.feedback.stats.total * 10000) / 100;
                    }
                    row.reviewed = (row.feedback !== undefined ? '\u2713' : '\u2715');
                    for (var key in row.data) {
                        row[key] = row.data[key];
                        if (row.feedback) {
                            row[key] += '  -  ' + row.feedback[key];
                        }
                    }
                    if (identity.domain === 'amma') {
                        identity.baseUrl = 'https://localhost:5023/'
                    }
                    var urlReview = 'review';
                    if (identity.domain === 'bpost') {
                        urlReview = 'viewer';
                    }
                    row.url = '<a target="cf_review" href="' + identity.baseUrl + urlReview + '/' + row.id + '">' + row.id + '</a>';
                    delete row['data'];
                }
                $scope.activities = activity;
            });
        });
    }

    $scope.$watch("activities", function() {
        if ($scope.activities === null) {
            return;
        }
        principal.identity().then(function(identity) {
            if (identity.domain === 'intolaw') {
                $('#activity-table').footable({
                    "columns": [{
                        name: 'originalname',
                        title: 'File name'
                    }, {
                        name: 'type',
                        title: 'Type'
                    }, {
                        name: 'overtreding',
                        title: 'Overtreding'
                    }, {
                        name: 'accuracybefore',
                        title: 'Completeness',
                        type: 'number',
                        sorted: true,
                        direction: "DESC"
                    }, {
                        name: 'accuracyafter',
                        title: 'Accuracy',
                        type: 'number'
                    }, {
                        name: 'receivetime',
                        title: 'Received',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss',
                        breakpoints: 'all'
                    }, {
                        name: 'starttime',
                        title: 'Started',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss',
                        breakpoints: 'all'
                    }, {
                        name: 'donetime',
                        title: 'Completed',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss',
                        breakpoints: 'all'
                    }, {
                        name: 'feedbacktime',
                        title: 'Reviewed',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss',
                        breakpoints: 'all'
                    }, {
                        name: 'url',
                        title: 'URL',
                        breakpoints: 'all'
                    }, {
                        name: 'reviewed',
                        title: 'Reviewed'
                    }],
                    "rows": $scope.activities
                });
                return;
            } else if (identity.domain === 'pom') {
                $('#activity-table').footable({
                    "columns": [{
                        name: 'id',
                        title: 'File name'
                    }, {
                        name: 'receivetime',
                        title: 'Received',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss'
                    }, {
                        name: 'starttime',
                        title: 'Started',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss',
                        breakpoints: 'all'
                    }, {
                        name: 'donetime',
                        title: 'Completed',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss',
                        breakpoints: 'all'
                    }, {
                        name: 'feedbacktime',
                        title: 'Reviewed',
                        type: 'date',
                        formatString: 'DD-MM-YYYY HH:mm:ss',
                        breakpoints: 'all'
                    }, {
                        name: 'reviewed',
                        title: 'Reviewed'
                    }],
                    "rows": $scope.activities
                });
                return;
            }
            $('#activity-table').footable({
                "columns": [{
                    name: 'id',
                    title: 'File name'
                }, {
                    name: 'leadtime',
                    title: 'Lead',
                    type: 'number'
                }, {
                    name: 'processingtime',
                    title: 'Processing',
                    type: 'number'
                }, {
                    name: 'accuracybefore',
                    title: 'Acc. before',
                    type: 'number'
                }, {
                    name: 'accuracyafter',
                    title: 'Acc. after',
                    type: 'number'
                }, {
                    name: 'receivetime',
                    title: 'Received',
                    type: 'date',
                    formatString: 'DD-MM-YYYY HH:mm:ss',
                    breakpoints: 'all'
                }, {
                    name: 'starttime',
                    title: 'Started',
                    type: 'date',
                    formatString: 'DD-MM-YYYY HH:mm:ss',
                    breakpoints: 'all'
                }, {
                    name: 'donetime',
                    title: 'Completed',
                    type: 'date',
                    formatString: 'DD-MM-YYYY HH:mm:ss',
                    breakpoints: 'all'
                }, {
                    name: 'feedbacktime',
                    title: 'Reviewed',
                    type: 'date',
                    formatString: 'DD-MM-YYYY HH:mm:ss',
                    breakpoints: 'all'
                }, {
                    name: 'url',
                    title: 'URL',
                    breakpoints: 'all'
                }, {
                    name: 'reviewed',
                    title: 'Reviewed'
                }],
                "rows": $scope.activities
            });
        });
    });
}

/**
 * MainCtrl - controller
 * Contains several global data used in different view
 *
 */
function MainCtrl($http) {

    /**
     * countries - Used as duallistbox in form advanced view
     */

    this.countries = [{
        name: 'Amsterdam'
    }, {
        name: 'Washington'
    }, {
        name: 'Sydney'
    }, {
        name: 'Cairo'
    }, {
        name: 'Beijing'
    }];

    this.getLocation = function(val) {
        return $http.get('//maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: val,
                sensor: false
            }
        }).then(function(response) {
            return response.data.results.map(function(item) {
                return item.formatted_address;
            });
        });
    };

    /**
     * daterange - Used as initial model for data range picker in Advanced form view
     */
    this.daterange = {
        startDate: null,
        endDate: null
    };

    /**
     * slideInterval - Interval for bootstrap Carousel, in milliseconds:
     */
    this.slideInterval = 5000;

    /**
     * tags - Used as advanced forms view in input tag control
     */

    this.tags = [{
        text: 'Amsterdam'
    }, {
        text: 'Washington'
    }, {
        text: 'Sydney'
    }, {
        text: 'Cairo'
    }, {
        text: 'Beijing'
    }];

    /**
     * states - Data used in Advanced Form view for Chosen plugin
     */
    this.states = [
        'Alabama',
        'Alaska',
        'Arizona',
        'Arkansas',
        'California',
        'Colorado',
        'Connecticut',
        'Delaware',
        'Florida',
        'Georgia',
        'Hawaii',
        'Idaho',
        'Illinois',
        'Indiana',
        'Iowa',
        'Kansas',
        'Kentucky',
        'Louisiana',
        'Maine',
        'Maryland',
        'Massachusetts',
        'Michigan',
        'Minnesota',
        'Mississippi',
        'Missouri',
        'Montana',
        'Nebraska',
        'Nevada',
        'New Hampshire',
        'New Jersey',
        'New Mexico',
        'New York',
        'North Carolina',
        'North Dakota',
        'Ohio',
        'Oklahoma',
        'Oregon',
        'Pennsylvania',
        'Rhode Island',
        'South Carolina',
        'South Dakota',
        'Tennessee',
        'Texas',
        'Utah',
        'Vermont',
        'Virginia',
        'Washington',
        'West Virginia',
        'Wisconsin',
        'Wyoming'
    ];

    /**
     * check's - Few variables for checkbox input used in iCheck plugin. Only for demo purpose
     */
    this.checkOne = true;
    this.checkTwo = true;
    this.checkThree = true;
    this.checkFour = true;

    /**
     * knobs - Few variables for knob plugin used in Advanced Plugins view
     */
    this.knobOne = 75;
    this.knobTwo = 25;
    this.knobThree = 50;

    /**
     * Variables used for Ui Elements view
     */
    this.bigTotalItems = 175;
    this.bigCurrentPage = 1;
    this.maxSize = 5;
    this.singleModel = false;
    this.radioModel = 'Middle';
    this.checkModel = {
        left: false,
        middle: true,
        right: false
    };

    /**
     * groups - used for Collapse panels in Tabs and Panels view
     */
    this.groups = [{
        title: 'Dynamic Group Header - 1',
        content: 'Dynamic Group Body - 1'
    }, {
        title: 'Dynamic Group Header - 2',
        content: 'Dynamic Group Body - 2'
    }];

    /**
     * alerts - used for dynamic alerts in Notifications and Tooltips view
     */
    this.alerts = [{
        type: 'danger',
        msg: 'Oh snap! Change a few things up and try submitting again.'
    }, {
        type: 'success',
        msg: 'Well done! You successfully read this important alert message.'
    }, {
        type: 'info',
        msg: 'OK, You are done a great job man.'
    }];

    /**
     * addAlert, closeAlert  - used to manage alerts in Notifications and Tooltips view
     */
    this.addAlert = function() {
        this.alerts.push({
            msg: 'Another alert!'
        });
    };

    this.closeAlert = function(index) {
        this.alerts.splice(index, 1);
    };

    /**
     * randomStacked - used for progress bar (stacked type) in Badges adn Labels view
     */
    this.randomStacked = function() {
        this.stacked = [];
        var types = ['success', 'info', 'warning', 'danger'];

        for (var i = 0, n = Math.floor((Math.random() * 4) + 1); i < n; i++) {
            var index = Math.floor((Math.random() * 4));
            this.stacked.push({
                value: Math.floor((Math.random() * 30) + 1),
                type: types[index]
            });
        }
    };
    /**
     * initial run for random stacked value
     */
    this.randomStacked();

    /**
     * summernoteText - used for Summernote plugin
     */
    this.summernoteText = ['<h3>Hello Jonathan! </h3>',
        '<p>dummy text of the printing and typesetting industry. <strong>Lorem Ipsum has been the dustrys</strong> standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more',
        'recently with</p>'
    ].join('');

    /**
     * General variables for Peity Charts
     * used in many view so this is in Main controller
     */
    this.BarChart = {
        data: [5, 3, 9, 6, 5, 9, 7, 3, 5, 2, 4, 7, 3, 2, 7, 9, 6, 4, 5, 7, 3, 2, 1, 0, 9, 5, 6, 8, 3, 2, 1],
        options: {
            fill: ["#1ab394", "#d7d7d7"],
            width: 100
        }
    };

    this.BarChart2 = {
        data: [5, 3, 9, 6, 5, 9, 7, 3, 5, 2],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };

    this.BarChart3 = {
        data: [5, 3, 2, -1, -3, -2, 2, 3, 5, 2],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };

    this.LineChart = {
        data: [5, 9, 7, 3, 5, 2, 5, 3, 9, 6, 5, 9, 4, 7, 3, 2, 9, 8, 7, 4, 5, 1, 2, 9, 5, 4, 7],
        options: {
            fill: '#1ab394',
            stroke: '#169c81',
            width: 64
        }
    };

    this.LineChart2 = {
        data: [3, 2, 9, 8, 47, 4, 5, 1, 2, 9, 5, 4, 7],
        options: {
            fill: '#1ab394',
            stroke: '#169c81',
            width: 64
        }
    };

    this.LineChart3 = {
        data: [5, 3, 2, -1, -3, -2, 2, 3, 5, 2],
        options: {
            fill: '#1ab394',
            stroke: '#169c81',
            width: 64
        }
    };

    this.LineChart4 = {
        data: [5, 3, 9, 6, 5, 9, 7, 3, 5, 2],
        options: {
            fill: '#1ab394',
            stroke: '#169c81',
            width: 64
        }
    };

    this.PieChart = {
        data: [1, 5],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };

    this.PieChart2 = {
        data: [226, 360],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };
    this.PieChart3 = {
        data: [0.52, 1.561],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };
    this.PieChart4 = {
        data: [1, 4],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };
    this.PieChart5 = {
        data: [226, 134],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };
    this.PieChart6 = {
        data: [0.52, 1.041],
        options: {
            fill: ["#1ab394", "#d7d7d7"]
        }
    };
};

/**
 * dashboardFlotOne - simple controller for data
 * for Flot chart in Dashboard view
 */
function dashboardFlotOne() {

    var data1 = [
        [0, 24],
        [1, 8],
        [2, 5],
        [3, 10],
        [4, 4],
        [5, 16],
        [6, 5],
        [7, 11],
        [8, 6],
        [9, 11],
        [10, 30],
        [11, 10],
        [12, 13],
        [13, 4],
        [14, 3],
        [15, 3],
        [16, 6]
    ];
    var data2 = [
        [0, 1],
        [1, 0],
        [2, 2],
        [3, 0],
        [4, 1],
        [5, 3],
        [6, 1],
        [7, 5],
        [8, 2],
        [9, 3],
        [10, 2],
        [11, 1],
        [12, 0],
        [13, 2],
        [14, 8],
        [15, 0],
        [16, 0]
    ];

    var options = {
        series: {
            lines: {
                show: false,
                fill: true
            },
            splines: {
                show: true,
                tension: 0.4,
                lineWidth: 1,
                fill: 0.4
            },
            points: {
                radius: 0,
                show: true
            },
            shadowSize: 2,
            grow: {
                stepMode: "linear",
                stepDirection: "up",
                steps: 80
            }
        },
        grow: {
            stepMode: "linear",
            stepDirection: "up",
            steps: 80
        },
        grid: {
            hoverable: true,
            clickable: true,
            tickColor: "#d5d5d5",
            borderWidth: 1,
            color: '#d5d5d5'
        },
        colors: ["#1ab394", "#1C84C6"],
        xaxis: {},
        yaxis: {
            ticks: 4
        },
        tooltip: false
    };

    /**
     * Definition of variables
     * Flot chart
     */
    this.flotData = [data1, data2];
    this.flotOptions = options;
}

/**
 * dashboardFlotTwo - simple controller for data
 * for Flot chart in Dashboard view
 */
function dashboardFlotTwo() {

    var data1 = [
        [gd(2012, 1, 1), 7],
        [gd(2012, 1, 2), 6],
        [gd(2012, 1, 3), 4],
        [gd(2012, 1, 4), 8],
        [gd(2012, 1, 5), 9],
        [gd(2012, 1, 6), 7],
        [gd(2012, 1, 7), 5],
        [gd(2012, 1, 8), 4],
        [gd(2012, 1, 9), 7],
        [gd(2012, 1, 10), 8],
        [gd(2012, 1, 11), 9],
        [gd(2012, 1, 12), 6],
        [gd(2012, 1, 13), 4],
        [gd(2012, 1, 14), 5],
        [gd(2012, 1, 15), 11],
        [gd(2012, 1, 16), 8],
        [gd(2012, 1, 17), 8],
        [gd(2012, 1, 18), 11],
        [gd(2012, 1, 19), 11],
        [gd(2012, 1, 20), 6],
        [gd(2012, 1, 21), 6],
        [gd(2012, 1, 22), 8],
        [gd(2012, 1, 23), 11],
        [gd(2012, 1, 24), 13],
        [gd(2012, 1, 25), 7],
        [gd(2012, 1, 26), 9],
        [gd(2012, 1, 27), 9],
        [gd(2012, 1, 28), 8],
        [gd(2012, 1, 29), 5],
        [gd(2012, 1, 30), 8],
        [gd(2012, 1, 31), 25]
    ];

    var data2 = [
        [gd(2012, 1, 1), 800],
        [gd(2012, 1, 2), 500],
        [gd(2012, 1, 3), 600],
        [gd(2012, 1, 4), 700],
        [gd(2012, 1, 5), 500],
        [gd(2012, 1, 6), 456],
        [gd(2012, 1, 7), 800],
        [gd(2012, 1, 8), 589],
        [gd(2012, 1, 9), 467],
        [gd(2012, 1, 10), 876],
        [gd(2012, 1, 11), 689],
        [gd(2012, 1, 12), 700],
        [gd(2012, 1, 13), 500],
        [gd(2012, 1, 14), 600],
        [gd(2012, 1, 15), 700],
        [gd(2012, 1, 16), 786],
        [gd(2012, 1, 17), 345],
        [gd(2012, 1, 18), 888],
        [gd(2012, 1, 19), 888],
        [gd(2012, 1, 20), 888],
        [gd(2012, 1, 21), 987],
        [gd(2012, 1, 22), 444],
        [gd(2012, 1, 23), 999],
        [gd(2012, 1, 24), 567],
        [gd(2012, 1, 25), 786],
        [gd(2012, 1, 26), 666],
        [gd(2012, 1, 27), 888],
        [gd(2012, 1, 28), 900],
        [gd(2012, 1, 29), 178],
        [gd(2012, 1, 30), 555],
        [gd(2012, 1, 31), 993]
    ];


    var dataset = [{
        label: "Number of orders",
        grow: {
            stepMode: "linear"
        },
        data: data2,
        color: "#1ab394",
        bars: {
            show: true,
            align: "center",
            barWidth: 24 * 60 * 60 * 600,
            lineWidth: 0
        }

    }, {
        label: "Payments",
        grow: {
            stepMode: "linear"
        },
        data: data1,
        yaxis: 2,
        color: "#1C84C6",
        lines: {
            lineWidth: 1,
            show: true,
            fill: true,
            fillColor: {
                colors: [{
                    opacity: 0.2
                }, {
                    opacity: 0.2
                }]
            }
        }
    }];


    var options = {
        grid: {
            hoverable: true,
            clickable: true,
            tickColor: "#d5d5d5",
            borderWidth: 0,
            color: '#d5d5d5'
        },
        colors: ["#1ab394", "#464f88"],
        tooltip: true,
        xaxis: {
            mode: "time",
            tickSize: [3, "day"],
            tickLength: 0,
            axisLabel: "Date",
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: 'Arial',
            axisLabelPadding: 10,
            color: "#d5d5d5"
        },
        yaxes: [{
            position: "left",
            max: 1070,
            color: "#d5d5d5",
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: 'Arial',
            axisLabelPadding: 3
        }, {
            position: "right",
            color: "#d5d5d5",
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 12,
            axisLabelFontFamily: ' Arial',
            axisLabelPadding: 67
        }],
        legend: {
            noColumns: 1,
            labelBoxBorderColor: "#d5d5d5",
            position: "nw"
        }

    };

    function gd(year, month, day) {
        return new Date(year, month - 1, day).getTime();
    }

    /**
     * Definition of variables
     * Flot chart
     */
    this.flotData = dataset;
    this.flotOptions = options;
}

/**
 * dashboardFlotFive - simple controller for data
 * for Flot chart in Dashboard view
 */
function dashboardFive() {

    var data1 = [
        [0, 4],
        [1, 8],
        [2, 5],
        [3, 10],
        [4, 4],
        [5, 16],
        [6, 5],
        [7, 11],
        [8, 6],
        [9, 11],
        [10, 20],
        [11, 10],
        [12, 13],
        [13, 4],
        [14, 7],
        [15, 8],
        [16, 12]
    ];
    var data2 = [
        [0, 0],
        [1, 2],
        [2, 7],
        [3, 4],
        [4, 11],
        [5, 4],
        [6, 2],
        [7, 5],
        [8, 11],
        [9, 5],
        [10, 4],
        [11, 1],
        [12, 5],
        [13, 2],
        [14, 5],
        [15, 2],
        [16, 0]
    ];

    var options = {
        series: {
            lines: {
                show: false,
                fill: true
            },
            splines: {
                show: true,
                tension: 0.4,
                lineWidth: 1,
                fill: 0.4
            },
            points: {
                radius: 0,
                show: true
            },
            shadowSize: 2
        },
        grid: {
            hoverable: true,
            clickable: true,

            borderWidth: 2,
            color: 'transparent'
        },
        colors: ["#1ab394", "#1C84C6"],
        xaxis: {},
        yaxis: {},
        tooltip: false
    };

    /**
     * Definition of variables
     * Flot chart
     */
    this.flotData = [data1, data2];
    this.flotOptions = options;


    var sparkline1Data = [34, 43, 43, 35, 44, 32, 44, 52];
    var sparkline1Options = {
        type: 'line',
        width: '100%',
        height: '50',
        lineColor: '#1ab394',
        fillColor: "transparent"
    };

    var sparkline2Data = [32, 11, 25, 37, 41, 32, 34, 42];
    var sparkline2Options = {
        type: 'line',
        width: '100%',
        height: '50',
        lineColor: '#1ab394',
        fillColor: "transparent"
    };

    this.sparkline1 = sparkline1Data;
    this.sparkline1Options = sparkline1Options;
    this.sparkline2 = sparkline2Data;
    this.sparkline2Options = sparkline2Options;

}


/**
 * dashboardMap - data for Map plugin
 * used in Dashboard 2 view
 */

function dashboardMap() {
    var data = {
        "US": 298,
        "SA": 200,
        "DE": 220,
        "FR": 540,
        "CN": 120,
        "AU": 760,
        "BR": 550,
        "IN": 200,
        "GB": 120
    };

    this.data = data;
}

/**
 * flotChartCtrl - Controller for data for All flot chart
 * used in Flot chart view
 */

function flotChartCtrl() {

    /**
     * Bar Chart Options
     */
    var barOptions = {
        series: {
            bars: {
                show: true,
                barWidth: 0.6,
                fill: true,
                fillColor: {
                    colors: [{
                        opacity: 0.8
                    }, {
                        opacity: 0.8
                    }]
                }
            }
        },
        xaxis: {
            tickDecimals: 0
        },
        colors: ["#1ab394"],
        grid: {
            color: "#999999",
            hoverable: true,
            clickable: true,
            tickColor: "#D4D4D4",
            borderWidth: 0
        },
        legend: {
            show: false
        },
        tooltip: true,
        tooltipOpts: {
            content: "x: %x, y: %y"
        }
    };

    /**
     * Bar Chart data
     */
    var chartData = [{
        label: "bar",
        data: [
            [1, 34],
            [2, 25],
            [3, 19],
            [4, 34],
            [5, 32],
            [6, 44]
        ]
    }];

    /**
     * Pie Chart Data
     */
    var pieData = [{
        label: "Sales 1",
        data: 21,
        color: "#d3d3d3"
    }, {
        label: "Sales 2",
        data: 3,
        color: "#bababa"
    }, {
        label: "Sales 3",
        data: 15,
        color: "#79d2c0"
    }, {
        label: "Sales 4",
        data: 52,
        color: "#1ab394"
    }];

    /**
     * Pie Chart Options
     */
    var pieOptions = {
        series: {
            pie: {
                show: true
            }
        },
        grid: {
            hoverable: true
        },
        tooltip: true,
        tooltipOpts: {
            content: "%p.0%, %s", // show percentages, rounding to 2 decimal places
            shifts: {
                x: 20,
                y: 0
            },
            defaultTheme: false
        }
    };

    /**
     * Line Chart Options
     */
    var lineOptions = {
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                fill: true,
                fillColor: {
                    colors: [{
                        opacity: 0.0
                    }, {
                        opacity: 0.0
                    }]
                }
            }
        },
        xaxis: {
            tickDecimals: 0
        },
        colors: ["#1ab394"],
        grid: {
            color: "#999999",
            hoverable: true,
            clickable: true,
            tickColor: "#D4D4D4",
            borderWidth: 0
        },
        legend: {
            show: false
        },
        tooltip: true,
        tooltipOpts: {
            content: "x: %x, y: %y"
        }
    };

    /**
     * Line Chart Data
     */
    var lineAreaData = [{
        label: "line",
        data: [
            [1, 34],
            [2, 22],
            [3, 19],
            [4, 12],
            [5, 32],
            [6, 54],
            [7, 23],
            [8, 57],
            [9, 12],
            [10, 24],
            [11, 44],
            [12, 64],
            [13, 21]
        ]
    }];

    /**
     * Line Area Chart Options
     */
    var lineAreaOptions = {
        series: {
            lines: {
                show: true,
                lineWidth: 2,
                fill: true,
                fillColor: {
                    colors: [{
                        opacity: 0.7
                    }, {
                        opacity: 0.5
                    }]
                }
            }
        },
        xaxis: {
            tickDecimals: 0
        },
        colors: ["#1ab394"],
        grid: {
            color: "#999999",
            hoverable: true,
            clickable: true,
            tickColor: "#D4D4D4",
            borderWidth: 0
        },
        legend: {
            show: false
        },
        tooltip: true,
        tooltipOpts: {
            content: "x: %x, y: %y"
        }
    };

    /**
     * Data for Multi line chart
     */
    var oilprices = [
        [1167692400000, 61.05],
        [1167778800000, 58.32],
        [1167865200000, 57.35],
        [1167951600000, 56.31],
        [1168210800000, 55.55],
        [1168297200000, 55.64],
        [1168383600000, 54.02],
        [1168470000000, 51.88],
        [1168556400000, 52.99],
        [1168815600000, 52.99],
        [1168902000000, 51.21],
        [1168988400000, 52.24],
        [1169074800000, 50.48],
        [1169161200000, 51.99],
        [1169420400000, 51.13],
        [1169506800000, 55.04],
        [1169593200000, 55.37],
        [1169679600000, 54.23],
        [1169766000000, 55.42],
        [1170025200000, 54.01],
        [1170111600000, 56.97],
        [1170198000000, 58.14],
        [1170284400000, 58.14],
        [1170370800000, 59.02],
        [1170630000000, 58.74],
        [1170716400000, 58.88],
        [1170802800000, 57.71],
        [1170889200000, 59.71],
        [1170975600000, 59.89],
        [1171234800000, 57.81],
        [1171321200000, 59.06],
        [1171407600000, 58.00],
        [1171494000000, 57.99],
        [1171580400000, 59.39],
        [1171839600000, 59.39],
        [1171926000000, 58.07],
        [1172012400000, 60.07],
        [1172098800000, 61.14],
        [1172444400000, 61.39],
        [1172530800000, 61.46],
        [1172617200000, 61.79],
        [1172703600000, 62.00],
        [1172790000000, 60.07],
        [1173135600000, 60.69],
        [1173222000000, 61.82],
        [1173308400000, 60.05],
        [1173654000000, 58.91],
        [1173740400000, 57.93],
        [1173826800000, 58.16],
        [1173913200000, 57.55],
        [1173999600000, 57.11],
        [1174258800000, 56.59],
        [1174345200000, 59.61],
        [1174518000000, 61.69],
        [1174604400000, 62.28],
        [1174860000000, 62.91],
        [1174946400000, 62.93],
        [1175032800000, 64.03],
        [1175119200000, 66.03],
        [1175205600000, 65.87],
        [1175464800000, 64.64],
        [1175637600000, 64.38],
        [1175724000000, 64.28],
        [1175810400000, 64.28],
        [1176069600000, 61.51],
        [1176156000000, 61.89],
        [1176242400000, 62.01],
        [1176328800000, 63.85],
        [1176415200000, 63.63],
        [1176674400000, 63.61],
        [1176760800000, 63.10],
        [1176847200000, 63.13],
        [1176933600000, 61.83],
        [1177020000000, 63.38],
        [1177279200000, 64.58],
        [1177452000000, 65.84],
        [1177538400000, 65.06],
        [1177624800000, 66.46],
        [1177884000000, 64.40],
        [1178056800000, 63.68],
        [1178143200000, 63.19],
        [1178229600000, 61.93],
        [1178488800000, 61.47],
        [1178575200000, 61.55],
        [1178748000000, 61.81],
        [1178834400000, 62.37],
        [1179093600000, 62.46],
        [1179180000000, 63.17],
        [1179266400000, 62.55],
        [1179352800000, 64.94],
        [1179698400000, 66.27],
        [1179784800000, 65.50],
        [1179871200000, 65.77],
        [1179957600000, 64.18],
        [1180044000000, 65.20],
        [1180389600000, 63.15],
        [1180476000000, 63.49],
        [1180562400000, 65.08],
        [1180908000000, 66.30],
        [1180994400000, 65.96],
        [1181167200000, 66.93],
        [1181253600000, 65.98],
        [1181599200000, 65.35],
        [1181685600000, 66.26],
        [1181858400000, 68.00],
        [1182117600000, 69.09],
        [1182204000000, 69.10],
        [1182290400000, 68.19],
        [1182376800000, 68.19],
        [1182463200000, 69.14],
        [1182722400000, 68.19],
        [1182808800000, 67.77],
        [1182895200000, 68.97],
        [1182981600000, 69.57],
        [1183068000000, 70.68],
        [1183327200000, 71.09],
        [1183413600000, 70.92],
        [1183586400000, 71.81],
        [1183672800000, 72.81],
        [1183932000000, 72.19],
        [1184018400000, 72.56],
        [1184191200000, 72.50],
        [1184277600000, 74.15],
        [1184623200000, 75.05],
        [1184796000000, 75.92],
        [1184882400000, 75.57],
        [1185141600000, 74.89],
        [1185228000000, 73.56],
        [1185314400000, 75.57],
        [1185400800000, 74.95],
        [1185487200000, 76.83],
        [1185832800000, 78.21],
        [1185919200000, 76.53],
        [1186005600000, 76.86],
        [1186092000000, 76.00],
        [1186437600000, 71.59],
        [1186696800000, 71.47],
        [1186956000000, 71.62],
        [1187042400000, 71.00],
        [1187301600000, 71.98],
        [1187560800000, 71.12],
        [1187647200000, 69.47],
        [1187733600000, 69.26],
        [1187820000000, 69.83],
        [1187906400000, 71.09],
        [1188165600000, 71.73],
        [1188338400000, 73.36],
        [1188511200000, 74.04],
        [1188856800000, 76.30],
        [1189116000000, 77.49],
        [1189461600000, 78.23],
        [1189548000000, 79.91],
        [1189634400000, 80.09],
        [1189720800000, 79.10],
        [1189980000000, 80.57],
        [1190066400000, 81.93],
        [1190239200000, 83.32],
        [1190325600000, 81.62],
        [1190584800000, 80.95],
        [1190671200000, 79.53],
        [1190757600000, 80.30],
        [1190844000000, 82.88],
        [1190930400000, 81.66],
        [1191189600000, 80.24],
        [1191276000000, 80.05],
        [1191362400000, 79.94],
        [1191448800000, 81.44],
        [1191535200000, 81.22],
        [1191794400000, 79.02],
        [1191880800000, 80.26],
        [1191967200000, 80.30],
        [1192053600000, 83.08],
        [1192140000000, 83.69],
        [1192399200000, 86.13],
        [1192485600000, 87.61],
        [1192572000000, 87.40],
        [1192658400000, 89.47],
        [1192744800000, 88.60],
        [1193004000000, 87.56],
        [1193090400000, 87.56],
        [1193176800000, 87.10],
        [1193263200000, 91.86],
        [1193612400000, 93.53],
        [1193698800000, 94.53],
        [1193871600000, 95.93],
        [1194217200000, 93.98],
        [1194303600000, 96.37],
        [1194476400000, 95.46],
        [1194562800000, 96.32],
        [1195081200000, 93.43],
        [1195167600000, 95.10],
        [1195426800000, 94.64],
        [1195513200000, 95.10],
        [1196031600000, 97.70],
        [1196118000000, 94.42],
        [1196204400000, 90.62],
        [1196290800000, 91.01],
        [1196377200000, 88.71],
        [1196636400000, 88.32],
        [1196809200000, 90.23],
        [1196982000000, 88.28],
        [1197241200000, 87.86],
        [1197327600000, 90.02],
        [1197414000000, 92.25],
        [1197586800000, 90.63],
        [1197846000000, 90.63],
        [1197932400000, 90.49],
        [1198018800000, 91.24],
        [1198105200000, 91.06],
        [1198191600000, 90.49],
        [1198710000000, 96.62],
        [1198796400000, 96.00],
        [1199142000000, 99.62],
        [1199314800000, 99.18],
        [1199401200000, 95.09],
        [1199660400000, 96.33],
        [1199833200000, 95.67],
        [1200351600000, 91.90],
        [1200438000000, 90.84],
        [1200524400000, 90.13],
        [1200610800000, 90.57],
        [1200956400000, 89.21],
        [1201042800000, 86.99],
        [1201129200000, 89.85],
        [1201474800000, 90.99],
        [1201561200000, 91.64],
        [1201647600000, 92.33],
        [1201734000000, 91.75],
        [1202079600000, 90.02],
        [1202166000000, 88.41],
        [1202252400000, 87.14],
        [1202338800000, 88.11],
        [1202425200000, 91.77],
        [1202770800000, 92.78],
        [1202857200000, 93.27],
        [1202943600000, 95.46],
        [1203030000000, 95.46],
        [1203289200000, 101.74],
        [1203462000000, 98.81],
        [1203894000000, 100.88],
        [1204066800000, 99.64],
        [1204153200000, 102.59],
        [1204239600000, 101.84],
        [1204498800000, 99.52],
        [1204585200000, 99.52],
        [1204671600000, 104.52],
        [1204758000000, 105.47],
        [1204844400000, 105.15],
        [1205103600000, 108.75],
        [1205276400000, 109.92],
        [1205362800000, 110.33],
        [1205449200000, 110.21],
        [1205708400000, 105.68],
        [1205967600000, 101.84],
        [1206313200000, 100.86],
        [1206399600000, 101.22],
        [1206486000000, 105.90],
        [1206572400000, 107.58],
        [1206658800000, 105.62],
        [1206914400000, 101.58],
        [1207000800000, 100.98],
        [1207173600000, 103.83],
        [1207260000000, 106.23],
        [1207605600000, 108.50],
        [1207778400000, 110.11],
        [1207864800000, 110.14],
        [1208210400000, 113.79],
        [1208296800000, 114.93],
        [1208383200000, 114.86],
        [1208728800000, 117.48],
        [1208815200000, 118.30],
        [1208988000000, 116.06],
        [1209074400000, 118.52],
        [1209333600000, 118.75],
        [1209420000000, 113.46],
        [1209592800000, 112.52],
        [1210024800000, 121.84],
        [1210111200000, 123.53],
        [1210197600000, 123.69],
        [1210543200000, 124.23],
        [1210629600000, 125.80],
        [1210716000000, 126.29],
        [1211148000000, 127.05],
        [1211320800000, 129.07],
        [1211493600000, 132.19],
        [1211839200000, 128.85],
        [1212357600000, 127.76],
        [1212703200000, 138.54],
        [1212962400000, 136.80],
        [1213135200000, 136.38],
        [1213308000000, 134.86],
        [1213653600000, 134.01],
        [1213740000000, 136.68],
        [1213912800000, 135.65],
        [1214172000000, 134.62],
        [1214258400000, 134.62],
        [1214344800000, 134.62],
        [1214431200000, 139.64],
        [1214517600000, 140.21],
        [1214776800000, 140.00],
        [1214863200000, 140.97],
        [1214949600000, 143.57],
        [1215036000000, 145.29],
        [1215381600000, 141.37],
        [1215468000000, 136.04],
        [1215727200000, 146.40],
        [1215986400000, 145.18],
        [1216072800000, 138.74],
        [1216159200000, 134.60],
        [1216245600000, 129.29],
        [1216332000000, 130.65],
        [1216677600000, 127.95],
        [1216850400000, 127.95],
        [1217282400000, 122.19],
        [1217455200000, 124.08],
        [1217541600000, 125.10],
        [1217800800000, 121.41],
        [1217887200000, 119.17],
        [1217973600000, 118.58],
        [1218060000000, 120.02],
        [1218405600000, 114.45],
        [1218492000000, 113.01],
        [1218578400000, 116.00],
        [1218751200000, 113.77],
        [1219010400000, 112.87],
        [1219096800000, 114.53],
        [1219269600000, 114.98],
        [1219356000000, 114.98],
        [1219701600000, 116.27],
        [1219788000000, 118.15],
        [1219874400000, 115.59],
        [1219960800000, 115.46],
        [1220306400000, 109.71],
        [1220392800000, 109.35],
        [1220565600000, 106.23],
        [1220824800000, 106.34]
    ];
    var exchangerates = [
        [1167606000000, 0.7580],
        [1167692400000, 0.7580],
        [1167778800000, 0.75470],
        [1167865200000, 0.75490],
        [1167951600000, 0.76130],
        [1168038000000, 0.76550],
        [1168124400000, 0.76930],
        [1168210800000, 0.76940],
        [1168297200000, 0.76880],
        [1168383600000, 0.76780],
        [1168470000000, 0.77080],
        [1168556400000, 0.77270],
        [1168642800000, 0.77490],
        [1168729200000, 0.77410],
        [1168815600000, 0.77410],
        [1168902000000, 0.77320],
        [1168988400000, 0.77270],
        [1169074800000, 0.77370],
        [1169161200000, 0.77240],
        [1169247600000, 0.77120],
        [1169334000000, 0.7720],
        [1169420400000, 0.77210],
        [1169506800000, 0.77170],
        [1169593200000, 0.77040],
        [1169679600000, 0.7690],
        [1169766000000, 0.77110],
        [1169852400000, 0.7740],
        [1169938800000, 0.77450],
        [1170025200000, 0.77450],
        [1170111600000, 0.7740],
        [1170198000000, 0.77160],
        [1170284400000, 0.77130],
        [1170370800000, 0.76780],
        [1170457200000, 0.76880],
        [1170543600000, 0.77180],
        [1170630000000, 0.77180],
        [1170716400000, 0.77280],
        [1170802800000, 0.77290],
        [1170889200000, 0.76980],
        [1170975600000, 0.76850],
        [1171062000000, 0.76810],
        [1171148400000, 0.7690],
        [1171234800000, 0.7690],
        [1171321200000, 0.76980],
        [1171407600000, 0.76990],
        [1171494000000, 0.76510],
        [1171580400000, 0.76130],
        [1171666800000, 0.76160],
        [1171753200000, 0.76140],
        [1171839600000, 0.76140],
        [1171926000000, 0.76070],
        [1172012400000, 0.76020],
        [1172098800000, 0.76110],
        [1172185200000, 0.76220],
        [1172271600000, 0.76150],
        [1172358000000, 0.75980],
        [1172444400000, 0.75980],
        [1172530800000, 0.75920],
        [1172617200000, 0.75730],
        [1172703600000, 0.75660],
        [1172790000000, 0.75670],
        [1172876400000, 0.75910],
        [1172962800000, 0.75820],
        [1173049200000, 0.75850],
        [1173135600000, 0.76130],
        [1173222000000, 0.76310],
        [1173308400000, 0.76150],
        [1173394800000, 0.760],
        [1173481200000, 0.76130],
        [1173567600000, 0.76270],
        [1173654000000, 0.76270],
        [1173740400000, 0.76080],
        [1173826800000, 0.75830],
        [1173913200000, 0.75750],
        [1173999600000, 0.75620],
        [1174086000000, 0.7520],
        [1174172400000, 0.75120],
        [1174258800000, 0.75120],
        [1174345200000, 0.75170],
        [1174431600000, 0.7520],
        [1174518000000, 0.75110],
        [1174604400000, 0.7480],
        [1174690800000, 0.75090],
        [1174777200000, 0.75310],
        [1174860000000, 0.75310],
        [1174946400000, 0.75270],
        [1175032800000, 0.74980],
        [1175119200000, 0.74930],
        [1175205600000, 0.75040],
        [1175292000000, 0.750],
        [1175378400000, 0.74910],
        [1175464800000, 0.74910],
        [1175551200000, 0.74850],
        [1175637600000, 0.74840],
        [1175724000000, 0.74920],
        [1175810400000, 0.74710],
        [1175896800000, 0.74590],
        [1175983200000, 0.74770],
        [1176069600000, 0.74770],
        [1176156000000, 0.74830],
        [1176242400000, 0.74580],
        [1176328800000, 0.74480],
        [1176415200000, 0.7430],
        [1176501600000, 0.73990],
        [1176588000000, 0.73950],
        [1176674400000, 0.73950],
        [1176760800000, 0.73780],
        [1176847200000, 0.73820],
        [1176933600000, 0.73620],
        [1177020000000, 0.73550],
        [1177106400000, 0.73480],
        [1177192800000, 0.73610],
        [1177279200000, 0.73610],
        [1177365600000, 0.73650],
        [1177452000000, 0.73620],
        [1177538400000, 0.73310],
        [1177624800000, 0.73390],
        [1177711200000, 0.73440],
        [1177797600000, 0.73270],
        [1177884000000, 0.73270],
        [1177970400000, 0.73360],
        [1178056800000, 0.73330],
        [1178143200000, 0.73590],
        [1178229600000, 0.73590],
        [1178316000000, 0.73720],
        [1178402400000, 0.7360],
        [1178488800000, 0.7360],
        [1178575200000, 0.7350],
        [1178661600000, 0.73650],
        [1178748000000, 0.73840],
        [1178834400000, 0.73950],
        [1178920800000, 0.74130],
        [1179007200000, 0.73970],
        [1179093600000, 0.73960],
        [1179180000000, 0.73850],
        [1179266400000, 0.73780],
        [1179352800000, 0.73660],
        [1179439200000, 0.740],
        [1179525600000, 0.74110],
        [1179612000000, 0.74060],
        [1179698400000, 0.74050],
        [1179784800000, 0.74140],
        [1179871200000, 0.74310],
        [1179957600000, 0.74310],
        [1180044000000, 0.74380],
        [1180130400000, 0.74430],
        [1180216800000, 0.74430],
        [1180303200000, 0.74430],
        [1180389600000, 0.74340],
        [1180476000000, 0.74290],
        [1180562400000, 0.74420],
        [1180648800000, 0.7440],
        [1180735200000, 0.74390],
        [1180821600000, 0.74370],
        [1180908000000, 0.74370],
        [1180994400000, 0.74290],
        [1181080800000, 0.74030],
        [1181167200000, 0.73990],
        [1181253600000, 0.74180],
        [1181340000000, 0.74680],
        [1181426400000, 0.7480],
        [1181512800000, 0.7480],
        [1181599200000, 0.7490],
        [1181685600000, 0.74940],
        [1181772000000, 0.75220],
        [1181858400000, 0.75150],
        [1181944800000, 0.75020],
        [1182031200000, 0.74720],
        [1182117600000, 0.74720],
        [1182204000000, 0.74620],
        [1182290400000, 0.74550],
        [1182376800000, 0.74490],
        [1182463200000, 0.74670],
        [1182549600000, 0.74580],
        [1182636000000, 0.74270],
        [1182722400000, 0.74270],
        [1182808800000, 0.7430],
        [1182895200000, 0.74290],
        [1182981600000, 0.7440],
        [1183068000000, 0.7430],
        [1183154400000, 0.74220],
        [1183240800000, 0.73880],
        [1183327200000, 0.73880],
        [1183413600000, 0.73690],
        [1183500000000, 0.73450],
        [1183586400000, 0.73450],
        [1183672800000, 0.73450],
        [1183759200000, 0.73520],
        [1183845600000, 0.73410],
        [1183932000000, 0.73410],
        [1184018400000, 0.7340],
        [1184104800000, 0.73240],
        [1184191200000, 0.72720],
        [1184277600000, 0.72640],
        [1184364000000, 0.72550],
        [1184450400000, 0.72580],
        [1184536800000, 0.72580],
        [1184623200000, 0.72560],
        [1184709600000, 0.72570],
        [1184796000000, 0.72470],
        [1184882400000, 0.72430],
        [1184968800000, 0.72440],
        [1185055200000, 0.72350],
        [1185141600000, 0.72350],
        [1185228000000, 0.72350],
        [1185314400000, 0.72350],
        [1185400800000, 0.72620],
        [1185487200000, 0.72880],
        [1185573600000, 0.73010],
        [1185660000000, 0.73370],
        [1185746400000, 0.73370],
        [1185832800000, 0.73240],
        [1185919200000, 0.72970],
        [1186005600000, 0.73170],
        [1186092000000, 0.73150],
        [1186178400000, 0.72880],
        [1186264800000, 0.72630],
        [1186351200000, 0.72630],
        [1186437600000, 0.72420],
        [1186524000000, 0.72530],
        [1186610400000, 0.72640],
        [1186696800000, 0.7270],
        [1186783200000, 0.73120],
        [1186869600000, 0.73050],
        [1186956000000, 0.73050],
        [1187042400000, 0.73180],
        [1187128800000, 0.73580],
        [1187215200000, 0.74090],
        [1187301600000, 0.74540],
        [1187388000000, 0.74370],
        [1187474400000, 0.74240],
        [1187560800000, 0.74240],
        [1187647200000, 0.74150],
        [1187733600000, 0.74190],
        [1187820000000, 0.74140],
        [1187906400000, 0.73770],
        [1187992800000, 0.73550],
        [1188079200000, 0.73150],
        [1188165600000, 0.73150],
        [1188252000000, 0.7320],
        [1188338400000, 0.73320],
        [1188424800000, 0.73460],
        [1188511200000, 0.73280],
        [1188597600000, 0.73230],
        [1188684000000, 0.7340],
        [1188770400000, 0.7340],
        [1188856800000, 0.73360],
        [1188943200000, 0.73510],
        [1189029600000, 0.73460],
        [1189116000000, 0.73210],
        [1189202400000, 0.72940],
        [1189288800000, 0.72660],
        [1189375200000, 0.72660],
        [1189461600000, 0.72540],
        [1189548000000, 0.72420],
        [1189634400000, 0.72130],
        [1189720800000, 0.71970],
        [1189807200000, 0.72090],
        [1189893600000, 0.7210],
        [1189980000000, 0.7210],
        [1190066400000, 0.7210],
        [1190152800000, 0.72090],
        [1190239200000, 0.71590],
        [1190325600000, 0.71330],
        [1190412000000, 0.71050],
        [1190498400000, 0.70990],
        [1190584800000, 0.70990],
        [1190671200000, 0.70930],
        [1190757600000, 0.70930],
        [1190844000000, 0.70760],
        [1190930400000, 0.7070],
        [1191016800000, 0.70490],
        [1191103200000, 0.70120],
        [1191189600000, 0.70110],
        [1191276000000, 0.70190],
        [1191362400000, 0.70460],
        [1191448800000, 0.70630],
        [1191535200000, 0.70890],
        [1191621600000, 0.70770],
        [1191708000000, 0.70770],
        [1191794400000, 0.70770],
        [1191880800000, 0.70910],
        [1191967200000, 0.71180],
        [1192053600000, 0.70790],
        [1192140000000, 0.70530],
        [1192226400000, 0.7050],
        [1192312800000, 0.70550],
        [1192399200000, 0.70550],
        [1192485600000, 0.70450],
        [1192572000000, 0.70510],
        [1192658400000, 0.70510],
        [1192744800000, 0.70170],
        [1192831200000, 0.70],
        [1192917600000, 0.69950],
        [1193004000000, 0.69940],
        [1193090400000, 0.70140],
        [1193176800000, 0.70360],
        [1193263200000, 0.70210],
        [1193349600000, 0.70020],
        [1193436000000, 0.69670],
        [1193522400000, 0.6950],
        [1193612400000, 0.6950],
        [1193698800000, 0.69390],
        [1193785200000, 0.6940],
        [1193871600000, 0.69220],
        [1193958000000, 0.69190],
        [1194044400000, 0.69140],
        [1194130800000, 0.68940],
        [1194217200000, 0.68910],
        [1194303600000, 0.69040],
        [1194390000000, 0.6890],
        [1194476400000, 0.68340],
        [1194562800000, 0.68230],
        [1194649200000, 0.68070],
        [1194735600000, 0.68150],
        [1194822000000, 0.68150],
        [1194908400000, 0.68470],
        [1194994800000, 0.68590],
        [1195081200000, 0.68220],
        [1195167600000, 0.68270],
        [1195254000000, 0.68370],
        [1195340400000, 0.68230],
        [1195426800000, 0.68220],
        [1195513200000, 0.68220],
        [1195599600000, 0.67920],
        [1195686000000, 0.67460],
        [1195772400000, 0.67350],
        [1195858800000, 0.67310],
        [1195945200000, 0.67420],
        [1196031600000, 0.67440],
        [1196118000000, 0.67390],
        [1196204400000, 0.67310],
        [1196290800000, 0.67610],
        [1196377200000, 0.67610],
        [1196463600000, 0.67850],
        [1196550000000, 0.68180],
        [1196636400000, 0.68360],
        [1196722800000, 0.68230],
        [1196809200000, 0.68050],
        [1196895600000, 0.67930],
        [1196982000000, 0.68490],
        [1197068400000, 0.68330],
        [1197154800000, 0.68250],
        [1197241200000, 0.68250],
        [1197327600000, 0.68160],
        [1197414000000, 0.67990],
        [1197500400000, 0.68130],
        [1197586800000, 0.68090],
        [1197673200000, 0.68680],
        [1197759600000, 0.69330],
        [1197846000000, 0.69330],
        [1197932400000, 0.69450],
        [1198018800000, 0.69440],
        [1198105200000, 0.69460],
        [1198191600000, 0.69640],
        [1198278000000, 0.69650],
        [1198364400000, 0.69560],
        [1198450800000, 0.69560],
        [1198537200000, 0.6950],
        [1198623600000, 0.69480],
        [1198710000000, 0.69280],
        [1198796400000, 0.68870],
        [1198882800000, 0.68240],
        [1198969200000, 0.67940],
        [1199055600000, 0.67940],
        [1199142000000, 0.68030],
        [1199228400000, 0.68550],
        [1199314800000, 0.68240],
        [1199401200000, 0.67910],
        [1199487600000, 0.67830],
        [1199574000000, 0.67850],
        [1199660400000, 0.67850],
        [1199746800000, 0.67970],
        [1199833200000, 0.680],
        [1199919600000, 0.68030],
        [1200006000000, 0.68050],
        [1200092400000, 0.6760],
        [1200178800000, 0.6770],
        [1200265200000, 0.6770],
        [1200351600000, 0.67360],
        [1200438000000, 0.67260],
        [1200524400000, 0.67640],
        [1200610800000, 0.68210],
        [1200697200000, 0.68310],
        [1200783600000, 0.68420],
        [1200870000000, 0.68420],
        [1200956400000, 0.68870],
        [1201042800000, 0.69030],
        [1201129200000, 0.68480],
        [1201215600000, 0.68240],
        [1201302000000, 0.67880],
        [1201388400000, 0.68140],
        [1201474800000, 0.68140],
        [1201561200000, 0.67970],
        [1201647600000, 0.67690],
        [1201734000000, 0.67650],
        [1201820400000, 0.67330],
        [1201906800000, 0.67290],
        [1201993200000, 0.67580],
        [1202079600000, 0.67580],
        [1202166000000, 0.6750],
        [1202252400000, 0.6780],
        [1202338800000, 0.68330],
        [1202425200000, 0.68560],
        [1202511600000, 0.69030],
        [1202598000000, 0.68960],
        [1202684400000, 0.68960],
        [1202770800000, 0.68820],
        [1202857200000, 0.68790],
        [1202943600000, 0.68620],
        [1203030000000, 0.68520],
        [1203116400000, 0.68230],
        [1203202800000, 0.68130],
        [1203289200000, 0.68130],
        [1203375600000, 0.68220],
        [1203462000000, 0.68020],
        [1203548400000, 0.68020],
        [1203634800000, 0.67840],
        [1203721200000, 0.67480],
        [1203807600000, 0.67470],
        [1203894000000, 0.67470],
        [1203980400000, 0.67480],
        [1204066800000, 0.67330],
        [1204153200000, 0.6650],
        [1204239600000, 0.66110],
        [1204326000000, 0.65830],
        [1204412400000, 0.6590],
        [1204498800000, 0.6590],
        [1204585200000, 0.65810],
        [1204671600000, 0.65780],
        [1204758000000, 0.65740],
        [1204844400000, 0.65320],
        [1204930800000, 0.65020],
        [1205017200000, 0.65140],
        [1205103600000, 0.65140],
        [1205190000000, 0.65070],
        [1205276400000, 0.6510],
        [1205362800000, 0.64890],
        [1205449200000, 0.64240],
        [1205535600000, 0.64060],
        [1205622000000, 0.63820],
        [1205708400000, 0.63820],
        [1205794800000, 0.63410],
        [1205881200000, 0.63440],
        [1205967600000, 0.63780],
        [1206054000000, 0.64390],
        [1206140400000, 0.64780],
        [1206226800000, 0.64810],
        [1206313200000, 0.64810],
        [1206399600000, 0.64940],
        [1206486000000, 0.64380],
        [1206572400000, 0.63770],
        [1206658800000, 0.63290],
        [1206745200000, 0.63360],
        [1206831600000, 0.63330],
        [1206914400000, 0.63330],
        [1207000800000, 0.6330],
        [1207087200000, 0.63710],
        [1207173600000, 0.64030],
        [1207260000000, 0.63960],
        [1207346400000, 0.63640],
        [1207432800000, 0.63560],
        [1207519200000, 0.63560],
        [1207605600000, 0.63680],
        [1207692000000, 0.63570],
        [1207778400000, 0.63540],
        [1207864800000, 0.6320],
        [1207951200000, 0.63320],
        [1208037600000, 0.63280],
        [1208124000000, 0.63310],
        [1208210400000, 0.63420],
        [1208296800000, 0.63210],
        [1208383200000, 0.63020],
        [1208469600000, 0.62780],
        [1208556000000, 0.63080],
        [1208642400000, 0.63240],
        [1208728800000, 0.63240],
        [1208815200000, 0.63070],
        [1208901600000, 0.62770],
        [1208988000000, 0.62690],
        [1209074400000, 0.63350],
        [1209160800000, 0.63920],
        [1209247200000, 0.640],
        [1209333600000, 0.64010],
        [1209420000000, 0.63960],
        [1209506400000, 0.64070],
        [1209592800000, 0.64230],
        [1209679200000, 0.64290],
        [1209765600000, 0.64720],
        [1209852000000, 0.64850],
        [1209938400000, 0.64860],
        [1210024800000, 0.64670],
        [1210111200000, 0.64440],
        [1210197600000, 0.64670],
        [1210284000000, 0.65090],
        [1210370400000, 0.64780],
        [1210456800000, 0.64610],
        [1210543200000, 0.64610],
        [1210629600000, 0.64680],
        [1210716000000, 0.64490],
        [1210802400000, 0.6470],
        [1210888800000, 0.64610],
        [1210975200000, 0.64520],
        [1211061600000, 0.64220],
        [1211148000000, 0.64220],
        [1211234400000, 0.64250],
        [1211320800000, 0.64140],
        [1211407200000, 0.63660],
        [1211493600000, 0.63460],
        [1211580000000, 0.6350],
        [1211666400000, 0.63460],
        [1211752800000, 0.63460],
        [1211839200000, 0.63430],
        [1211925600000, 0.63460],
        [1212012000000, 0.63790],
        [1212098400000, 0.64160],
        [1212184800000, 0.64420],
        [1212271200000, 0.64310],
        [1212357600000, 0.64310],
        [1212444000000, 0.64350],
        [1212530400000, 0.6440],
        [1212616800000, 0.64730],
        [1212703200000, 0.64690],
        [1212789600000, 0.63860],
        [1212876000000, 0.63560],
        [1212962400000, 0.6340],
        [1213048800000, 0.63460],
        [1213135200000, 0.6430],
        [1213221600000, 0.64520],
        [1213308000000, 0.64670],
        [1213394400000, 0.65060],
        [1213480800000, 0.65040],
        [1213567200000, 0.65030],
        [1213653600000, 0.64810],
        [1213740000000, 0.64510],
        [1213826400000, 0.6450],
        [1213912800000, 0.64410],
        [1213999200000, 0.64140],
        [1214085600000, 0.64090],
        [1214172000000, 0.64090],
        [1214258400000, 0.64280],
        [1214344800000, 0.64310],
        [1214431200000, 0.64180],
        [1214517600000, 0.63710],
        [1214604000000, 0.63490],
        [1214690400000, 0.63330],
        [1214776800000, 0.63340],
        [1214863200000, 0.63380],
        [1214949600000, 0.63420],
        [1215036000000, 0.6320],
        [1215122400000, 0.63180],
        [1215208800000, 0.6370],
        [1215295200000, 0.63680],
        [1215381600000, 0.63680],
        [1215468000000, 0.63830],
        [1215554400000, 0.63710],
        [1215640800000, 0.63710],
        [1215727200000, 0.63550],
        [1215813600000, 0.6320],
        [1215900000000, 0.62770],
        [1215986400000, 0.62760],
        [1216072800000, 0.62910],
        [1216159200000, 0.62740],
        [1216245600000, 0.62930],
        [1216332000000, 0.63110],
        [1216418400000, 0.6310],
        [1216504800000, 0.63120],
        [1216591200000, 0.63120],
        [1216677600000, 0.63040],
        [1216764000000, 0.62940],
        [1216850400000, 0.63480],
        [1216936800000, 0.63780],
        [1217023200000, 0.63680],
        [1217109600000, 0.63680],
        [1217196000000, 0.63680],
        [1217282400000, 0.6360],
        [1217368800000, 0.6370],
        [1217455200000, 0.64180],
        [1217541600000, 0.64110],
        [1217628000000, 0.64350],
        [1217714400000, 0.64270],
        [1217800800000, 0.64270],
        [1217887200000, 0.64190],
        [1217973600000, 0.64460],
        [1218060000000, 0.64680],
        [1218146400000, 0.64870],
        [1218232800000, 0.65940],
        [1218319200000, 0.66660],
        [1218405600000, 0.66660],
        [1218492000000, 0.66780],
        [1218578400000, 0.67120],
        [1218664800000, 0.67050],
        [1218751200000, 0.67180],
        [1218837600000, 0.67840],
        [1218924000000, 0.68110],
        [1219010400000, 0.68110],
        [1219096800000, 0.67940],
        [1219183200000, 0.68040],
        [1219269600000, 0.67810],
        [1219356000000, 0.67560],
        [1219442400000, 0.67350],
        [1219528800000, 0.67630],
        [1219615200000, 0.67620],
        [1219701600000, 0.67770],
        [1219788000000, 0.68150],
        [1219874400000, 0.68020],
        [1219960800000, 0.6780],
        [1220047200000, 0.67960],
        [1220133600000, 0.68170],
        [1220220000000, 0.68170],
        [1220306400000, 0.68320],
        [1220392800000, 0.68770],
        [1220479200000, 0.69120],
        [1220565600000, 0.69140],
        [1220652000000, 0.70090],
        [1220738400000, 0.70120],
        [1220824800000, 0.7010],
        [1220911200000, 0.70050]
    ];

    function euroFormatter(v, axis) {
        return v.toFixed(axis.tickDecimals) + "€";
    }
    var position = 'right';

    /**
     * multiData - data for multi line chart
     */
    var multiData = [{
        data: oilprices,
        label: "Oil price ($)"
    }, {
        data: exchangerates,
        label: "USD/EUR exchange rate",
        yaxis: 2
    }];

    /**
     * multiOptions - options for multi chart
     */
    var multiOptions = {
        xaxes: [{
            mode: 'time'
        }],
        yaxes: [{
            min: 0
        }, {
            // align if we are to the right
            alignTicksWithAxis: position == "right" ? 1 : null,
            position: position,
            tickFormatter: euroFormatter
        }],
        legend: {
            position: 'sw'
        },
        colors: ["#1ab394"],
        grid: {
            color: "#999999",
            hoverable: true,
            clickable: true,
            tickColor: "#D4D4D4",
            borderWidth: 0

        },
        tooltip: true,
        tooltipOpts: {
            content: "%s for %x was %y",
            xDateFormat: "%y-%0m-%0d",
            onHover: function(flotItem, $tooltipEl) {}
        }

    };

    /**
     * Definition of variables
     * Flot chart
     */
    this.flotChartData = chartData;
    this.flotBarOptions = barOptions;
    this.flotLineOptions = lineOptions;
    this.flotPieData = pieData;
    this.flotPieOptions = pieOptions;
    this.flotLineAreaData = lineAreaData;
    this.flotLineAreaOptions = lineAreaOptions;
    this.flotMultiData = multiData;
    this.flotMultiOptions = multiOptions;
}

/**
 * rickshawChartCtrl - Controller for data for all Rickshaw chart
 * used in Rickshaw chart view
 */
function rickshawChartCtrl() {

    /**
     * Data for simple chart
     */
    var simpleChartSeries = [{
        color: '#1ab394',
        data: [{
            x: 0,
            y: 40
        }, {
            x: 1,
            y: 49
        }, {
            x: 2,
            y: 38
        }, {
            x: 3,
            y: 30
        }, {
            x: 4,
            y: 32
        }]
    }];
    /**
     * Options for simple chart
     */
    var simpleChartOptions = {
        renderer: 'area'
    };

    /**
     * Data for Multi Area chart
     */
    var multiAreaChartSeries = [{
        data: [{
            x: 0,
            y: 40
        }, {
            x: 1,
            y: 49
        }, {
            x: 2,
            y: 38
        }, {
            x: 3,
            y: 20
        }, {
            x: 4,
            y: 16
        }],
        color: '#1ab394',
        stroke: '#17997f'
    }, {
        data: [{
            x: 0,
            y: 22
        }, {
            x: 1,
            y: 25
        }, {
            x: 2,
            y: 38
        }, {
            x: 3,
            y: 44
        }, {
            x: 4,
            y: 46
        }],
        color: '#eeeeee',
        stroke: '#d7d7d7'
    }];

    /**
     * Options for Multi chart
     */
    var multiAreaChartOptions = {
        renderer: 'area',
        stroke: true
    };

    /**
     * Options for one line chart
     */
    var oneLineChartOptions = {
        renderer: 'line'
    };

    /**
     * Data for one line chart
     */
    var oneLineChartSeries = [{
        data: [{
            x: 0,
            y: 40
        }, {
            x: 1,
            y: 49
        }, {
            x: 2,
            y: 38
        }, {
            x: 3,
            y: 30
        }, {
            x: 4,
            y: 32
        }],
        color: '#1ab394'
    }];

    /**
     * Options for Multi line chart
     */
    var multiLineChartOptions = {
        renderer: 'line'
    };

    /**
     * Data for Multi line chart
     */
    var multiLineChartSeries = [{
        data: [{
            x: 0,
            y: 40
        }, {
            x: 1,
            y: 49
        }, {
            x: 2,
            y: 38
        }, {
            x: 3,
            y: 30
        }, {
            x: 4,
            y: 32
        }],
        color: '#1ab394'
    }, {
        data: [{
            x: 0,
            y: 20
        }, {
            x: 1,
            y: 24
        }, {
            x: 2,
            y: 19
        }, {
            x: 3,
            y: 15
        }, {
            x: 4,
            y: 16
        }],
        color: '#d7d7d7'
    }];

    /**
     * Options for Bars chart
     */
    var barsChartOptions = {
        renderer: 'bar'
    };

    /**
     * Data for Bars chart
     */
    var barsChartSeries = [{
        data: [{
            x: 0,
            y: 40
        }, {
            x: 1,
            y: 49
        }, {
            x: 2,
            y: 38
        }, {
            x: 3,
            y: 30
        }, {
            x: 4,
            y: 32
        }],
        color: '#1ab394'
    }];

    /**
     * Options for Stacked chart
     */
    var stackedChartOptions = {
        renderer: 'bar'
    };

    /**
     * Data for Stacked chart
     */
    var stackedChartSeries = [{
        data: [{
            x: 0,
            y: 40
        }, {
            x: 1,
            y: 49
        }, {
            x: 2,
            y: 38
        }, {
            x: 3,
            y: 30
        }, {
            x: 4,
            y: 32
        }],
        color: '#1ab394'
    }, {
        data: [{
            x: 0,
            y: 20
        }, {
            x: 1,
            y: 24
        }, {
            x: 2,
            y: 19
        }, {
            x: 3,
            y: 15
        }, {
            x: 4,
            y: 16
        }],
        color: '#d7d7d7'
    }];

    /**
     * Options for Scatterplot chart
     */
    var scatterplotChartOptions = {
        renderer: 'scatterplot',
        stroke: true,
        padding: {
            top: 0.05,
            left: 0.05,
            right: 0.05
        }
    }

    /**
     * Data for Scatterplot chart
     */
    var scatterplotChartSeries = [{
        data: [{
            x: 0,
            y: 15
        }, {
            x: 1,
            y: 18
        }, {
            x: 2,
            y: 10
        }, {
            x: 3,
            y: 12
        }, {
            x: 4,
            y: 15
        }, {
            x: 5,
            y: 24
        }, {
            x: 6,
            y: 28
        }, {
            x: 7,
            y: 31
        }, {
            x: 8,
            y: 22
        }, {
            x: 9,
            y: 18
        }, {
            x: 10,
            y: 16
        }],
        color: '#1ab394'
    }]

    /**
     * Definition all variables
     * Rickshaw chart
     */
    this.simpleSeries = simpleChartSeries;
    this.simpleOptions = simpleChartOptions;
    this.multiAreaOptions = multiAreaChartOptions;
    this.multiAreaSeries = multiAreaChartSeries;
    this.oneLineOptions = oneLineChartOptions;
    this.oneLineSeries = oneLineChartSeries;
    this.multiLineOptions = multiLineChartOptions;
    this.multiLineSeries = multiLineChartSeries;
    this.barsOptions = barsChartOptions;
    this.barsSeries = barsChartSeries;
    this.stackedOptions = stackedChartOptions;
    this.stackedSeries = stackedChartSeries;
    this.scatterplotOptions = scatterplotChartOptions;
    this.scatterplotSeries = scatterplotChartSeries;

}

/**
 * sparklineChartCtrl - Controller for data for all Sparkline chart
 * used in Sparkline chart view
 */
function sparklineChartCtrl() {

    /**
     * Inline chart
     */
    var inlineData = [34, 43, 43, 35, 44, 32, 44, 52, 25];
    var inlineOptions = {
        type: 'line',
        lineColor: '#17997f',
        fillColor: '#1ab394'
    };

    /**
     * Bar chart
     */
    var barSmallData = [5, 6, 7, 2, 0, -4, -2, 4];
    var barSmallOptions = {
        type: 'bar',
        barColor: '#1ab394',
        negBarColor: '#c6c6c6'
    };

    /**
     * Pie chart
     */
    var smallPieData = [1, 1, 2];
    var smallPieOptions = {
        type: 'pie',
        sliceColors: ['#1ab394', '#b3b3b3', '#e4f0fb']
    };

    /**
     * Long line chart
     */
    var longLineData = [34, 43, 43, 35, 44, 32, 15, 22, 46, 33, 86, 54, 73, 53, 12, 53, 23, 65, 23, 63, 53, 42, 34, 56, 76, 15, 54, 23, 44];
    var longLineOptions = {
        type: 'line',
        lineColor: '#17997f',
        fillColor: '#ffffff'
    };

    /**
     * Tristate chart
     */
    var tristateData = [1, 1, 0, 1, -1, -1, 1, -1, 0, 0, 1, 1];
    var tristateOptions = {
        type: 'tristate',
        posBarColor: '#1ab394',
        negBarColor: '#bfbfbf'
    };

    /**
     * Discrate chart
     */
    var discreteData = [4, 6, 7, 7, 4, 3, 2, 1, 4, 4, 5, 6, 3, 4, 5, 8, 7, 6, 9, 3, 2, 4, 1, 5, 6, 4, 3, 7, ];
    var discreteOptions = {
        type: 'discrete',
        lineColor: '#1ab394'
    };

    /**
     * Pie chart
     */
    var pieCustomData = [52, 12, 44];
    var pieCustomOptions = {
        type: 'pie',
        height: '150px',
        sliceColors: ['#1ab394', '#b3b3b3', '#e4f0fb']
    };

    /**
     * Bar chart
     */
    var barCustomData = [5, 6, 7, 2, 0, 4, 2, 4, 5, 7, 2, 4, 12, 14, 4, 2, 14, 12, 7];
    var barCustomOptions = {
        type: 'bar',
        barWidth: 8,
        height: '150px',
        barColor: '#1ab394',
        negBarColor: '#c6c6c6'
    };

    /**
     * Line chart
     */
    var lineCustomData = [34, 43, 43, 35, 44, 32, 15, 22, 46, 33, 86, 54, 73, 53, 12, 53, 23, 65, 23, 63, 53, 42, 34, 56, 76, 15, 54, 23, 44];
    var lineCustomOptions = {
        type: 'line',
        lineWidth: 1,
        height: '150px',
        lineColor: '#17997f',
        fillColor: '#ffffff'
    };


    /**
     * Definition of variables
     * Flot chart
     */
    this.inlineData = inlineData;
    this.inlineOptions = inlineOptions;
    this.barSmallData = barSmallData;
    this.barSmallOptions = barSmallOptions;
    this.pieSmallData = smallPieData;
    this.pieSmallOptions = smallPieOptions;
    this.discreteData = discreteData;
    this.discreteOptions = discreteOptions;
    this.longLineData = longLineData;
    this.longLineOptions = longLineOptions;
    this.tristateData = tristateData;
    this.tristateOptions = tristateOptions;
    this.pieCustomData = pieCustomData;
    this.pieCustomOptions = pieCustomOptions;
    this.barCustomData = barCustomData;
    this.barCustomOptions = barCustomOptions;
    this.lineCustomData = lineCustomData;
    this.lineCustomOptions = lineCustomOptions;
}


/**
 * widgetFlotChart - Data for Flot chart
 * used in Widget view
 */
function widgetFlotChart() {


    /**
     * Flot chart data and options
     */
    var d1 = [
        [1262304000000, 6],
        [1264982400000, 3057],
        [1267401600000, 20434],
        [1270080000000, 31982],
        [1272672000000, 26602],
        [1275350400000, 27826],
        [1277942400000, 24302],
        [1280620800000, 24237],
        [1283299200000, 21004],
        [1285891200000, 12144],
        [1288569600000, 10577],
        [1291161600000, 10295]
    ];
    var d2 = [
        [1262304000000, 5],
        [1264982400000, 200],
        [1267401600000, 1605],
        [1270080000000, 6129],
        [1272672000000, 11643],
        [1275350400000, 19055],
        [1277942400000, 30062],
        [1280620800000, 39197],
        [1283299200000, 37000],
        [1285891200000, 27000],
        [1288569600000, 21000],
        [1291161600000, 17000]
    ];

    var flotChartData1 = [{
        label: "Data 1",
        data: d1,
        color: '#17a084'
    }, {
        label: "Data 2",
        data: d2,
        color: '#127e68'
    }];

    var flotChartOptions1 = {
        xaxis: {
            tickDecimals: 0
        },
        series: {
            lines: {
                show: true,
                fill: true,
                fillColor: {
                    colors: [{
                        opacity: 1
                    }, {
                        opacity: 1
                    }]
                }
            },
            points: {
                width: 0.1,
                show: false
            }
        },
        grid: {
            show: false,
            borderWidth: 0
        },
        legend: {
            show: false
        }
    };

    var flotChartData2 = [{
        label: "Data 1",
        data: d1,
        color: '#19a0a1'
    }];

    var flotChartOptions2 = {
        xaxis: {
            tickDecimals: 0
        },
        series: {
            lines: {
                show: true,
                fill: true,
                fillColor: {
                    colors: [{
                        opacity: 1
                    }, {
                        opacity: 1
                    }]
                }
            },
            points: {
                width: 0.1,
                show: false
            }
        },
        grid: {
            show: false,
            borderWidth: 0
        },
        legend: {
            show: false
        }
    };

    var flotChartData3 = [{
        label: "Data 1",
        data: d1,
        color: '#fbbe7b'
    }, {
        label: "Data 2",
        data: d2,
        color: '#f8ac59'
    }];

    var flotChartOptions3 = {
        xaxis: {
            tickDecimals: 0
        },
        series: {
            lines: {
                show: true,
                fill: true,
                fillColor: {
                    colors: [{
                        opacity: 1
                    }, {
                        opacity: 1
                    }]
                }
            },
            points: {
                width: 0.1,
                show: false
            }
        },
        grid: {
            show: false,
            borderWidth: 0
        },
        legend: {
            show: false
        }
    };

    /**
     * Definition of variables
     * Flot chart
     */

    this.flotChartData1 = flotChartData1;
    this.flotChartOptions1 = flotChartOptions1;
    this.flotChartData2 = flotChartData2;
    this.flotChartOptions2 = flotChartOptions2;
    this.flotChartData3 = flotChartData3;
    this.flotChartOptions3 = flotChartOptions3;


}

/**
 * modalDemoCtrl - Controller used to run modal view
 * used in Basic form view
 */
function modalDemoCtrl($scope, $uibModal) {

    $scope.open = function() {

        var modalInstance = $uibModal.open({
            templateUrl: 'views/modal_example.html',
            controller: 'ModalInstanceCtrl'
        });
    };

    $scope.open1 = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modal_example1.html',
            controller: 'ModalInstanceCtrl'
        });
    };

    $scope.open2 = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modal_example2.html',
            controller: 'ModalInstanceCtrl',
            windowClass: "animated fadeIn"
        });
    };

    $scope.open3 = function(size) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modal_example3.html',
            size: size,
            controller: 'ModalInstanceCtrl'
        });
    };

    $scope.open4 = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modal_example2.html',
            controller: 'ModalInstanceCtrl',
            windowClass: "animated flipInY"
        });
    };
};

function ModalInstanceCtrl($scope, $uibModalInstance) {

    $scope.ok = function() {
        $uibModalInstance.close();
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };


    $scope.states = [
        'Alabama',
        'Alaska',
        'Arizona',
        'Arkansas',
        'California',
        'Colorado',
        'Connecticut',
        'Delaware',
        'Florida',
        'Georgia',
        'Hawaii',
        'Idaho',
        'Illinois',
        'Indiana',
        'Iowa',
        'Kansas',
        'Kentucky',
        'Louisiana',
        'Maine',
        'Maryland',
        'Massachusetts',
        'Michigan',
        'Minnesota',
        'Mississippi',
        'Missouri',
        'Montana',
        'Nebraska',
        'Nevada',
        'New Hampshire',
        'New Jersey',
        'New Mexico',
        'New York',
        'North Carolina',
        'North Dakota',
        'Ohio',
        'Oklahoma',
        'Oregon',
        'Pennsylvania',
        'Rhode Island',
        'South Carolina',
        'South Dakota',
        'Tennessee',
        'Texas',
        'Utah',
        'Vermont',
        'Virginia',
        'Washington',
        'West Virginia',
        'Wisconsin',
        'Wyoming'
    ];

};

/**
 * ionSlider - Controller for data for Ion Slider plugin
 * used in Advanced plugin view
 */
function ionSlider() {
    this.ionSliderOptions1 = {
        min: 0,
        max: 5000,
        type: 'double',
        prefix: "$",
        maxPostfix: "+",
        prettify: false,
        hasGrid: true
    };
    this.ionSliderOptions2 = {
        min: 0,
        max: 10,
        type: 'single',
        step: 0.1,
        postfix: " carats",
        prettify: false,
        hasGrid: true
    };
    this.ionSliderOptions3 = {
        min: -50,
        max: 50,
        from: 0,
        postfix: "°",
        prettify: false,
        hasGrid: true
    };
    this.ionSliderOptions4 = {
        values: [
            "January", "February", "March",
            "April", "May", "June",
            "July", "August", "September",
            "October", "November", "December"
        ],
        type: 'single',
        hasGrid: true
    };
    this.ionSliderOptions5 = {
        min: 10000,
        max: 100000,
        step: 100,
        postfix: " km",
        from: 55000,
        hideMinMax: true,
        hideFromTo: false
    };
}

/**
 * wizardCtrl - Controller for wizard functions
 * used in Wizard view
 */
function wizardCtrl($scope, $rootScope) {
    // All data will be store in this object
    $scope.formData = {};

    // After process wizard
    $scope.processForm = function() {
        alert('Wizard completed');
    };

}


/**
 * CalendarCtrl - Controller for Calendar
 * Store data events for calendar
 */
function CalendarCtrl($scope) {

    var date = new Date();
    var d = date.getDate();
    var m = date.getMonth();
    var y = date.getFullYear();

    // Events
    $scope.events = [{
        title: 'All Day Event',
        start: new Date(y, m, 1)
    }, {
        title: 'Long Event',
        start: new Date(y, m, d - 5),
        end: new Date(y, m, d - 2)
    }, {
        id: 999,
        title: 'Repeating Event',
        start: new Date(y, m, d - 3, 16, 0),
        allDay: false
    }, {
        id: 999,
        title: 'Repeating Event',
        start: new Date(y, m, d + 4, 16, 0),
        allDay: false
    }, {
        title: 'Birthday Party',
        start: new Date(y, m, d + 1, 19, 0),
        end: new Date(y, m, d + 1, 22, 30),
        allDay: false
    }, {
        title: 'Click for Google',
        start: new Date(y, m, 28),
        end: new Date(y, m, 29),
        url: 'http://google.com/'
    }];


    /* message on eventClick */
    $scope.alertOnEventClick = function(event, allDay, jsEvent, view) {
        $scope.alertMessage = (event.title + ': Clicked ');
    };
    /* message on Drop */
    $scope.alertOnDrop = function(event, dayDelta, minuteDelta, allDay, revertFunc, jsEvent, ui, view) {
        $scope.alertMessage = (event.title + ': Droped to make dayDelta ' + dayDelta);
    };
    /* message on Resize */
    $scope.alertOnResize = function(event, dayDelta, minuteDelta, revertFunc, jsEvent, ui, view) {
        $scope.alertMessage = (event.title + ': Resized to make dayDelta ' + minuteDelta);
    };

    /* config object */
    $scope.uiConfig = {
        calendar: {
            height: 450,
            editable: true,
            header: {
                left: 'prev,next',
                center: 'title',
                right: 'month,agendaWeek,agendaDay'
            },
            eventClick: $scope.alertOnEventClick,
            eventDrop: $scope.alertOnDrop,
            eventResize: $scope.alertOnResize
        }
    };

    /* Event sources array */
    $scope.eventSources = [$scope.events];
}

/**
 * chartJsCtrl - Controller for data for ChartJs plugin
 * used in Chart.js view
 */
function chartJsCtrl() {

    /**
     * Data for Polar chart
     */
    this.polarData = [{
        value: 300,
        color: "#a3e1d4",
        highlight: "#1ab394",
        label: "App"
    }, {
        value: 140,
        color: "#dedede",
        highlight: "#1ab394",
        label: "Software"
    }, {
        value: 200,
        color: "#A4CEE8",
        highlight: "#1ab394",
        label: "Laptop"
    }];

    /**
     * Options for Polar chart
     */
    this.polarOptions = {
        scaleShowLabelBackdrop: true,
        scaleBackdropColor: "rgba(255,255,255,0.75)",
        scaleBeginAtZero: true,
        scaleBackdropPaddingY: 1,
        scaleBackdropPaddingX: 1,
        scaleShowLine: true,
        segmentShowStroke: true,
        segmentStrokeColor: "#fff",
        segmentStrokeWidth: 2,
        animationSteps: 100,
        animationEasing: "easeOutBounce",
        animateRotate: true,
        animateScale: false
    };

    /**
     * Data for Doughnut chart
     */
    this.doughnutData = [{
        value: 300,
        color: "#a3e1d4",
        highlight: "#1ab394",
        label: "App"
    }, {
        value: 50,
        color: "#dedede",
        highlight: "#1ab394",
        label: "Software"
    }, {
        value: 100,
        color: "#A4CEE8",
        highlight: "#1ab394",
        label: "Laptop"
    }];

    /**
     * Options for Doughnut chart
     */
    this.doughnutOptions = {
        segmentShowStroke: true,
        segmentStrokeColor: "#fff",
        segmentStrokeWidth: 2,
        percentageInnerCutout: 45, // This is 0 for Pie charts
        animationSteps: 100,
        animationEasing: "easeOutBounce",
        animateRotate: true,
        animateScale: false
    };

    /**
     * Data for Line chart
     */
    this.lineData = {
        labels: ["January", "February", "March", "April", "May", "June", "July"],
        datasets: [{
            label: "Example dataset",
            fillColor: "rgba(220,220,220,0.5)",
            strokeColor: "rgba(220,220,220,1)",
            pointColor: "rgba(220,220,220,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(220,220,220,1)",
            data: [65, 59, 80, 81, 56, 55, 40]
        }, {
            label: "Example dataset",
            fillColor: "rgba(26,179,148,0.5)",
            strokeColor: "rgba(26,179,148,0.7)",
            pointColor: "rgba(26,179,148,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(26,179,148,1)",
            data: [28, 48, 40, 19, 86, 27, 90]
        }]
    };

    this.lineDataDashboard4 = {
        labels: ["January", "February", "March", "April", "May", "June", "July"],
        datasets: [{
            label: "Example dataset",
            fillColor: "rgba(220,220,220,0.5)",
            strokeColor: "rgba(220,220,220,1)",
            pointColor: "rgba(220,220,220,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(220,220,220,1)",
            data: [65, 59, 40, 51, 36, 25, 40]
        }, {
            label: "Example dataset",
            fillColor: "rgba(26,179,148,0.5)",
            strokeColor: "rgba(26,179,148,0.7)",
            pointColor: "rgba(26,179,148,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(26,179,148,1)",
            data: [48, 48, 60, 39, 56, 37, 30]
        }]
    };

    /**
     * Options for Line chart
     */
    this.lineOptions = {
        scaleShowGridLines: true,
        scaleGridLineColor: "rgba(0,0,0,.05)",
        scaleGridLineWidth: 1,
        bezierCurve: true,
        bezierCurveTension: 0.4,
        pointDot: true,
        pointDotRadius: 4,
        pointDotStrokeWidth: 1,
        pointHitDetectionRadius: 20,
        datasetStroke: true,
        datasetStrokeWidth: 2,
        datasetFill: true
    };

    /**
     * Options for Bar chart
     */
    this.barOptions = {
        scaleBeginAtZero: true,
        scaleShowGridLines: true,
        scaleGridLineColor: "rgba(0,0,0,.05)",
        scaleGridLineWidth: 1,
        barShowStroke: true,
        barStrokeWidth: 2,
        barValueSpacing: 5,
        barDatasetSpacing: 1
    };

    /**
     * Data for Bar chart
     */
    this.barData = {
        labels: ["January", "February", "March", "April", "May", "June", "July"],
        datasets: [{
            label: "My First dataset",
            fillColor: "rgba(220,220,220,0.5)",
            strokeColor: "rgba(220,220,220,0.8)",
            highlightFill: "rgba(220,220,220,0.75)",
            highlightStroke: "rgba(220,220,220,1)",
            data: [65, 59, 80, 81, 56, 55, 40]
        }, {
            label: "My Second dataset",
            fillColor: "rgba(26,179,148,0.5)",
            strokeColor: "rgba(26,179,148,0.8)",
            highlightFill: "rgba(26,179,148,0.75)",
            highlightStroke: "rgba(26,179,148,1)",
            data: [28, 48, 40, 19, 86, 27, 90]
        }]
    };

    /**
     * Data for Radar chart
     */
    this.radarData = {
        labels: ["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
        datasets: [{
            label: "My First dataset",
            fillColor: "rgba(220,220,220,0.2)",
            strokeColor: "rgba(220,220,220,1)",
            pointColor: "rgba(220,220,220,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(220,220,220,1)",
            data: [65, 59, 90, 81, 56, 55, 40]
        }, {
            label: "My Second dataset",
            fillColor: "rgba(26,179,148,0.2)",
            strokeColor: "rgba(26,179,148,1)",
            pointColor: "rgba(26,179,148,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(151,187,205,1)",
            data: [28, 48, 40, 19, 96, 27, 100]
        }]
    };

    /**
     * Options for Radar chart
     */
    this.radarOptions = {
        scaleShowLine: true,
        angleShowLineOut: true,
        scaleShowLabels: false,
        scaleBeginAtZero: true,
        angleLineColor: "rgba(0,0,0,.1)",
        angleLineWidth: 1,
        pointLabelFontFamily: "'Arial'",
        pointLabelFontStyle: "normal",
        pointLabelFontSize: 10,
        pointLabelFontColor: "#666",
        pointDot: true,
        pointDotRadius: 3,
        pointDotStrokeWidth: 1,
        pointHitDetectionRadius: 20,
        datasetStroke: true,
        datasetStrokeWidth: 2,
        datasetFill: true
    };


};

/**
 * GoogleMaps - Controller for data google maps
 */
function GoogleMaps($scope) {
    $scope.mapOptions = {
        zoom: 11,
        center: new google.maps.LatLng(40.6700, -73.9400),
        // Style for Google Maps
        styles: [{
            "featureType": "water",
            "stylers": [{
                "saturation": 43
            }, {
                "lightness": -11
            }, {
                "hue": "#0088ff"
            }]
        }, {
            "featureType": "road",
            "elementType": "geometry.fill",
            "stylers": [{
                "hue": "#ff0000"
            }, {
                "saturation": -100
            }, {
                "lightness": 99
            }]
        }, {
            "featureType": "road",
            "elementType": "geometry.stroke",
            "stylers": [{
                "color": "#808080"
            }, {
                "lightness": 54
            }]
        }, {
            "featureType": "landscape.man_made",
            "elementType": "geometry.fill",
            "stylers": [{
                "color": "#ece2d9"
            }]
        }, {
            "featureType": "poi.park",
            "elementType": "geometry.fill",
            "stylers": [{
                "color": "#ccdca1"
            }]
        }, {
            "featureType": "road",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#767676"
            }]
        }, {
            "featureType": "road",
            "elementType": "labels.text.stroke",
            "stylers": [{
                "color": "#ffffff"
            }]
        }, {
            "featureType": "poi",
            "stylers": [{
                "visibility": "off"
            }]
        }, {
            "featureType": "landscape.natural",
            "elementType": "geometry.fill",
            "stylers": [{
                "visibility": "on"
            }, {
                "color": "#b8cb93"
            }]
        }, {
            "featureType": "poi.park",
            "stylers": [{
                "visibility": "on"
            }]
        }, {
            "featureType": "poi.sports_complex",
            "stylers": [{
                "visibility": "on"
            }]
        }, {
            "featureType": "poi.medical",
            "stylers": [{
                "visibility": "on"
            }]
        }, {
            "featureType": "poi.business",
            "stylers": [{
                "visibility": "simplified"
            }]
        }],
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    $scope.mapOptions2 = {
        zoom: 11,
        center: new google.maps.LatLng(40.6700, -73.9400),
        // Style for Google Maps
        styles: [{
            "featureType": "all",
            "elementType": "all",
            "stylers": [{
                "invert_lightness": true
            }, {
                "saturation": 10
            }, {
                "lightness": 30
            }, {
                "gamma": 0.5
            }, {
                "hue": "#435158"
            }]
        }],
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    $scope.mapOptions3 = {
        center: new google.maps.LatLng(36.964645, -122.01523),
        zoom: 18,
        // Style for Google Maps
        MapTypeId: google.maps.MapTypeId.SATELLITE,
        styles: [{
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [{
                "visibility": "off"
            }]
        }, {
            "featureType": "poi",
            "elementType": "geometry",
            "stylers": [{
                "visibility": "off"
            }]
        }, {
            "featureType": "landscape",
            "elementType": "geometry",
            "stylers": [{
                "color": "#fffffa"
            }]
        }, {
            "featureType": "water",
            "stylers": [{
                "lightness": 50
            }]
        }, {
            "featureType": "road",
            "elementType": "labels",
            "stylers": [{
                "visibility": "off"
            }]
        }, {
            "featureType": "transit",
            "stylers": [{
                "visibility": "off"
            }]
        }, {
            "featureType": "administrative",
            "elementType": "geometry",
            "stylers": [{
                "lightness": 40
            }]
        }],
        mapTypeId: google.maps.MapTypeId.SATELLITE
    };
    $scope.mapOptions4 = {
        zoom: 11,
        center: new google.maps.LatLng(40.6700, -73.9400),
        // Style for Google Maps
        styles: [{
            "stylers": [{
                "hue": "#18a689"
            }, {
                "visibility": "on"
            }, {
                "invert_lightness": true
            }, {
                "saturation": 40
            }, {
                "lightness": 10
            }]
        }],
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
}

/**
 * nestableCtrl - Controller for nestable list
 */
function nestableCtrl($scope) {
    $scope.remove = function(scope) {
        scope.remove();
    };
    $scope.toggle = function(scope) {
        scope.toggle();
    };
    $scope.moveLastToTheBeginning = function() {
        var a = $scope.data.pop();
        $scope.data.splice(0, 0, a);
    };
    $scope.newSubItem = function(scope) {
        var nodeData = scope.$modelValue;
        nodeData.nodes.push({
            id: nodeData.id * 10 + nodeData.nodes.length,
            title: nodeData.title + '.' + (nodeData.nodes.length + 1),
            nodes: []
        });
    };
    $scope.collapseAll = function() {
        $scope.$broadcast('collapseAll');
    };
    $scope.expandAll = function() {
        $scope.$broadcast('expandAll');
    };
    $scope.data = [{
        "id": 1,
        "title": "node1",
        "nodes": [{
            "id": 11,
            "title": "node1.1",
            "nodes": [{
                "id": 111,
                "title": "node1.1.1",
                "nodes": []
            }]
        }, {
            "id": 12,
            "title": "node1.2",
            "nodes": []
        }]
    }, {
        "id": 2,
        "title": "node2",
        "nodes": [{
            "id": 21,
            "title": "node2.1",
            "nodes": []
        }, {
            "id": 22,
            "title": "node2.2",
            "nodes": []
        }]
    }, {
        "id": 3,
        "title": "node3",
        "nodes": [{
            "id": 31,
            "title": "node3.1",
            "nodes": []
        }]
    }];
}

/**
 * codeEditorCtrl - Controller for code editor - Code Mirror
 */
function codeEditorCtrl($scope) {
    $scope.editorOptions = {
        lineNumbers: true,
        matchBrackets: true,
        styleActiveLine: true,
        theme: "ambiance"
    };

    $scope.editorOptions2 = {
        lineNumbers: true,
        matchBrackets: true,
        styleActiveLine: true
    };

}

/**
 * ngGridCtrl - Controller for code ngGrid
 */
function ngGridCtrl($scope) {
    $scope.ngData = [{
        Name: "Moroni",
        Age: 50,
        Position: 'PR Menager',
        Status: 'active',
        Date: '12.12.2014'
    }, {
        Name: "Teancum",
        Age: 43,
        Position: 'CEO/CFO',
        Status: 'deactive',
        Date: '10.10.2014'
    }, {
        Name: "Jacob",
        Age: 27,
        Position: 'UI Designer',
        Status: 'active',
        Date: '09.11.2013'
    }, {
        Name: "Nephi",
        Age: 29,
        Position: 'Java programmer',
        Status: 'deactive',
        Date: '22.10.2014'
    }, {
        Name: "Joseph",
        Age: 22,
        Position: 'Marketing manager',
        Status: 'active',
        Date: '24.08.2013'
    }, {
        Name: "Monica",
        Age: 43,
        Position: 'President',
        Status: 'active',
        Date: '11.12.2014'
    }, {
        Name: "Arnold",
        Age: 12,
        Position: 'CEO',
        Status: 'active',
        Date: '07.10.2013'
    }, {
        Name: "Mark",
        Age: 54,
        Position: 'Analyst',
        Status: 'deactive',
        Date: '03.03.2014'
    }, {
        Name: "Amelia",
        Age: 33,
        Position: 'Sales manager',
        Status: 'deactive',
        Date: '26.09.2013'
    }, {
        Name: "Jesica",
        Age: 41,
        Position: 'Ruby programmer',
        Status: 'active',
        Date: '22.12.2013'
    }, {
        Name: "John",
        Age: 48,
        Position: 'Marketing manager',
        Status: 'deactive',
        Date: '09.10.2014'
    }, {
        Name: "Berg",
        Age: 19,
        Position: 'UI/UX Designer',
        Status: 'active',
        Date: '12.11.2013'
    }];

    $scope.ngOptions = {
        data: 'ngData'
    };
    $scope.ngOptions2 = {
        data: 'ngData',
        showGroupPanel: true,
        jqueryUIDraggable: true
    };
}


/**
 * notifyCtrl - Controller angular notify
 */
function notifyCtrl($scope, notify) {
    $scope.msg = 'Hello! This is a sample message!';
    $scope.demo = function() {
        notify({
            message: $scope.msg,
            classes: $scope.classes,
            templateUrl: $scope.template
        });
    };
    $scope.closeAll = function() {
        notify.closeAll();
    };

    $scope.inspiniaTemplate = 'views/common/notify.html';
    $scope.inspiniaDemo1 = function() {
        notify({
            message: 'Info - This is a Inspinia info notification',
            classes: 'alert-info',
            templateUrl: $scope.inspiniaTemplate
        });
    }
    $scope.inspiniaDemo2 = function() {
        notify({
            message: 'Success - This is a Inspinia success notification',
            classes: 'alert-success',
            templateUrl: $scope.inspiniaTemplate
        });
    }
    $scope.inspiniaDemo3 = function() {
        notify({
            message: 'Warning - This is a Inspinia warning notification',
            classes: 'alert-warning',
            templateUrl: $scope.inspiniaTemplate
        });
    }
    $scope.inspiniaDemo4 = function() {
        notify({
            message: 'Danger - This is a Inspinia danger notification',
            classes: 'alert-danger',
            templateUrl: $scope.inspiniaTemplate
        });
    }
}

/**
 * translateCtrl - Controller for translate
 */
function translateCtrl($translate, $scope) {
    $scope.changeLanguage = function(langKey) {
        $translate.use(langKey);
        $scope.language = langKey;
    };
}

/**
 * imageCrop - Controller for image crop functionality
 */
function imageCrop($scope) {

    $scope.dupa = "dasdasdas";

    $scope.myImage = '';
    $scope.myCroppedImage = '';

    var handleFileSelect = function(evt) {
        var file = evt.currentTarget.files[0];
        var reader = new FileReader();
        reader.onload = function(evt) {
            $scope.$apply(function($scope) {
                $scope.myImage = evt.target.result;
            });
        };
        reader.readAsDataURL(file);
    };
    angular.element(document.querySelector('#fileInput')).on('change', handleFileSelect);
}


/**
 * diff - Controller for diff function
 */
function diff($scope) {
    $scope.oldText = 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only centuries, but also the leap into electronic typesetting.';
    $scope.newText = 'Lorem Ipsum is simply typesetting dummy text of the printing and has been the industry\'s typesetting. Lorem Ipsum has been the industry\'s standard dummy text ever the 1500s, when an printer took a galley of type and simply it to make a type. It has survived not only five centuries, but survived not also the leap into electronic typesetting.';

    $scope.oldText1 = 'Lorem Ipsum is simply printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text eve';
    $scope.newText1 = 'Ting dummy text of the printing and has been the industry\'s typesetting. Lorem Ipsum has been the industry\'s';
}

/**
 * idleTimer - Controller for Idle Timer
 */
function idleTimer($scope, Idle, notify) {

    // Custm alter
    $scope.customAlert = false;

    // Start watching idle
    Idle.watch();

    // Config notify behavior
    notify.config({
        duration: '5000'
    });

    // function you want to fire when the user goes idle
    $scope.$on('IdleStart', function() {
        notify({
            message: 'Idle time - You can call any function after idle timeout.',
            classes: 'alert-warning',
            templateUrl: 'views/common/notify.html'
        });
        $scope.customAlert = true;

    });

    // function you want to fire when the user becomes active again
    $scope.$on('IdleEnd', function() {
        notify({
            message: 'You are back, Great that you decided to move a mouse.',
            classes: 'alert-success',
            templateUrl: 'views/common/notify.html'
        });
        $scope.customAlert = false;
    });

}


/**
 * liveFavicon - Controller for live favicon
 */
function liveFavicon($scope) {

    $scope.example1 = function() {
        Tinycon.setBubble(1);
        Tinycon.setOptions({
            background: '#f03d25'
        });
    }

    $scope.example2 = function() {
        Tinycon.setBubble(1000);
        Tinycon.setOptions({
            background: '#f03d25'
        });
    }

    $scope.example3 = function() {
        Tinycon.setBubble('In');
        Tinycon.setOptions({
            background: '#f03d25'
        });
    }

    $scope.example4 = function() {
        Tinycon.setOptions({
            background: '#e0913b'
        });
        Tinycon.setBubble(8);
    }

}

/**
 * formValidation - Controller for validation example
 */
function formValidation($scope) {

    $scope.signupForm = function() {
        if ($scope.signup_form.$valid) {
            // Submit as normal
        } else {
            $scope.signup_form.submitted = true;
        }
    }

    $scope.signupForm2 = function() {
        if ($scope.signup_form.$valid) {
            // Submit as normal
        }
    }

};

/**
 * agileBoard - Controller for agile Board view
 */
function agileBoard($scope) {


    $scope.todoList = [{
        content: 'Simply dummy text of the printing and typesetting industry.',
        date: '12.10.2015',
        statusClass: 'warning',
        tagName: 'Mark'
    }, {
        content: 'Many desktop publishing packages and web page editors now use Lorem Ipsum as their default.',
        date: '05.04.2015',
        statusClass: 'success',
        tagName: 'Tag'
    }, {
        content: 'Sometimes by accident, sometimes on purpose (injected humour and the like).',
        date: '16.11.2015',
        statusClass: 'info',
        tagName: 'Mark'
    }, {
        content: 'All the Lorem Ipsum generators',
        date: '06.10.2015',
        statusClass: 'danger',
        tagName: 'Tag'
    }, {
        content: 'Which looks reasonable. The generated Lorem Ipsum is therefore always free from repetition, injected humour, or non-characteristic words etc.',
        date: '09.12.2015',
        statusClass: 'warning',
        tagName: 'Mark'
    }, {
        content: 'Packages and web page editors now use Lorem Ipsum as',
        date: '08.04.2015',
        statusClass: 'warning',
        tagName: 'Mark'
    }, {
        content: 'Many desktop publishing packages and web page editors now use Lorem Ipsum as their default.',
        date: '05.04.2015',
        statusClass: 'success',
        tagName: 'Tag'
    }, {
        content: 'Sometimes by accident, sometimes on purpose (injected humour and the like).',
        date: '16.11.2015',
        statusClass: 'info',
        tagName: 'Tag'
    }];
    $scope.inProgressList = [{
        content: 'Quisque venenatis ante in porta suscipit.',
        date: '12.10.2015',
        statusClass: 'success',
        tagName: 'Mark'
    }, {
        content: ' Phasellus sit amet tortor sed enim mollis accumsan in consequat orci.',
        date: '05.04.2015',
        statusClass: 'success',
        tagName: 'Tag'
    }, {
        content: 'Nunc sed arcu at ligula faucibus tempus ac id felis. Vestibulum et nulla quis turpis sagittis fringilla.',
        date: '16.11.2015',
        statusClass: 'warning',
        tagName: 'Mark'
    }, {
        content: 'Ut porttitor augue non sapien mollis accumsan. Nulla non elit eget lacus elementum viverra.',
        date: '09.12.2015',
        statusClass: 'warning',
        tagName: 'Tag'
    }, {
        content: 'Packages and web page editors now use Lorem Ipsum as',
        date: '08.04.2015',
        statusClass: 'info',
        tagName: 'Tag'
    }, {
        content: 'Quisque lacinia tellus et odio ornare maximus.',
        date: '05.04.2015',
        statusClass: 'success',
        tagName: 'Mark'
    }, {
        content: 'Enim mollis accumsan in consequat orci.',
        date: '11.04.2015',
        statusClass: 'danger',
        tagName: 'Tag'
    }];
    $scope.completedList = [{
        content: 'Sometimes by accident, sometimes on purpose (injected humour and the like).',
        date: '16.11.2015',
        statusClass: 'info',
        tagName: 'Mark'
    }, {
        content: 'Ut porttitor augue non sapien mollis accumsan. Nulla non elit eget lacus elementum viverra.',
        date: '09.12.2015',
        statusClass: 'warning',
        tagName: 'Tag'
    }, {
        content: 'Which looks reasonable. The generated Lorem Ipsum is therefore always free from repetition, injected humour, or non-characteristic words etc.',
        date: '09.12.2015',
        statusClass: 'warning',
        tagName: 'Tag'
    }, {
        content: 'Packages and web page editors now use Lorem Ipsum as',
        date: '08.04.2015',
        statusClass: 'warning',
        tagName: 'Tag'
    }, {
        content: 'Many desktop publishing packages and web page editors now use Lorem Ipsum as their default.',
        date: '05.04.2015',
        statusClass: 'success',
        tagName: 'Mark'
    }, {
        content: 'Sometimes by accident, sometimes on purpose (injected humour and the like).',
        date: '16.11.2015',
        statusClass: 'info',
        tagName: 'Tag'
    }, {
        content: 'Simply dummy text of the printing and typesetting industry.',
        date: '12.10.2015',
        statusClass: 'warning',
        tagName: 'Mark'
    }, {
        content: 'Many desktop publishing packages and web page editors now use Lorem Ipsum as their default.',
        date: '05.04.2015',
        statusClass: 'success',
        tagName: 'Mark'
    }];

    $scope.sortableOptions = {
        connectWith: ".connectList"
    };

}

/**
 * draggablePanels - Controller for draggable panels example
 */
function draggablePanels($scope) {

    $scope.sortableOptions = {
        connectWith: ".connectPanels",
        handler: ".ibox-title"
    };

}

/**
 * chartistCtrl - Controller for Chartist library
 */
function chartistCtrl() {

    this.lineData = {
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        series: [
            [12, 9, 7, 8, 5],
            [2, 1, 3.5, 7, 3],
            [1, 3, 4, 5, 6]
        ]
    }

    this.lineOptions = {
        fullWidth: true,
        chartPadding: {
            right: 40
        }
    }

    var times = function(n) {
        return Array.apply(null, new Array(n));
    };

    var prepareData = times(26).map(Math.random).reduce(function(data, rnd, index) {
        data.labels.push(index + 1);
        data.series.forEach(function(series) {
            series.push(Math.random() * 100)
        });

        return data;
    }, {
        labels: [],
        series: times(4).map(function() {
            return new Array()
        })
    });

    this.scatterData = prepareData;

    this.scatterOptions = {
        showLine: false,
        axisX: {
            labelInterpolationFnc: function(value, index) {
                return index % 13 === 0 ? 'W' + value : null;
            }
        }
    }

    this.stackedData = {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [
            [800000, 1200000, 1400000, 1300000],
            [200000, 400000, 500000, 300000],
            [100000, 200000, 400000, 600000]
        ]
    }
    this.stackedOptions = {
        stackBars: true,
        axisY: {
            labelInterpolationFnc: function(value) {
                return (value / 1000) + 'k';
            }
        }
    }

    this.horizontalData = {
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        series: [
            [5, 4, 3, 7, 5, 10, 3],
            [3, 2, 9, 5, 4, 6, 4]
        ]
    }

    this.horizontalOptions = {
        seriesBarDistance: 10,
        reverseData: true,
        horizontalBars: true,
        axisY: {
            offset: 70
        }
    }

    var prepareData = {
        series: [5, 3, 4]
    }

    this.pieData = prepareData

    var sum = function(a, b) {
        return a + b
    };

    this.pieOptions = {
        labelInterpolationFnc: function(value) {
            return Math.round(value / prepareData.series.reduce(sum) * 100) + '%';
        }
    }

    this.gaugeData = {
        series: [20, 10, 30, 40]
    }

    this.gaugeOptions = {
        donut: true,
        donutWidth: 60,
        startAngle: 270,
        total: 200,
        showLabel: false
    }

}

/**
 * metricsCtrl - Controller for data for all Sparkline chart
 * used in Metrics view
 */
function metricsCtrl() {


    this.demo1Data = [34, 43, 43, 35, 44, 32, 44, 52];
    this.demo1Options = {
        type: 'line',
        width: '100%',
        height: '60',
        lineColor: '#1ab394',
        fillColor: "#ffffff"
    };

    this.demo2Data = [24, 43, 43, 55, 44, 62, 44, 72];
    this.demo2Options = {
        type: 'line',
        width: '100%',
        height: '60',
        lineColor: '#1ab394',
        fillColor: "#ffffff"
    };

    this.demo3Data = [74, 43, 23, 55, 54, 32, 24, 12];
    this.demo3Options = {
        type: 'line',
        width: '100%',
        height: '60',
        lineColor: '#ed5565',
        fillColor: "#ffffff"
    };

    this.demo4Data = [24, 43, 33, 55, 64, 72, 44, 22];
    this.demo4Options = {
        type: 'line',
        width: '100%',
        height: '60',
        lineColor: '#ed5565',
        fillColor: "#ffffff"
    };

    this.demo5Data = [1, 4];
    this.demo5Options = {
        type: 'pie',
        height: '140',
        sliceColors: ['#1ab394', '#F5F5F5']
    };

    this.demo6Data = [5, 3];
    this.demo6Options = {
        type: 'pie',
        height: '140',
        sliceColors: ['#1ab394', '#F5F5F5']
    };

    this.demo7Data = [2, 2];
    this.demo7Options = {
        type: 'pie',
        height: '140',
        sliceColors: ['#ed5565', '#F5F5F5']
    };

    this.demo8Data = [2, 3];
    this.demo8Options = {
        type: 'pie',
        height: '140',
        sliceColors: ['#ed5565', '#F5F5F5']
    };

}



/**
 * sweetAlertCtrl - Function for Sweet alerts
 */
function sweetAlertCtrl($scope, SweetAlert) {


    $scope.demo1 = function() {
        SweetAlert.swal({
            title: "Welcome in Alerts",
            text: "Lorem Ipsum is simply dummy text of the printing and typesetting industry."
        });
    }

    $scope.demo2 = function() {
        SweetAlert.swal({
            title: "Good job!",
            text: "You clicked the button!",
            type: "success"
        });
    }

    $scope.demo3 = function() {
        SweetAlert.swal({
                title: "Are you sure?",
                text: "Your will not be able to recover this imaginary file!",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: "Yes, delete it!",
                closeOnConfirm: false,
                closeOnCancel: false
            },
            function() {
                SweetAlert.swal("Ok!");
            });
    }

    $scope.demo4 = function() {
        SweetAlert.swal({
                title: "Are you sure?",
                text: "Your will not be able to recover this imaginary file!",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: "Yes, delete it!",
                cancelButtonText: "No, cancel plx!",
                closeOnConfirm: false,
                closeOnCancel: false
            },
            function(isConfirm) {
                if (isConfirm) {
                    SweetAlert.swal("Deleted!", "Your imaginary file has been deleted.", "success");
                } else {
                    SweetAlert.swal("Cancelled", "Your imaginary file is safe :)", "error");
                }
            });
    }

}

function selectCtrl($scope) {

    $scope.person = {};
    $scope.people = [{
        name: 'Adam',
        email: 'adam@email.com',
        age: 12,
        country: 'United States'
    }, {
        name: 'Amalie',
        email: 'amalie@email.com',
        age: 12,
        country: 'Argentina'
    }, {
        name: 'Estefanía',
        email: 'estefania@email.com',
        age: 21,
        country: 'Argentina'
    }, {
        name: 'Adrian',
        email: 'adrian@email.com',
        age: 21,
        country: 'Ecuador'
    }, {
        name: 'Wladimir',
        email: 'wladimir@email.com',
        age: 30,
        country: 'Ecuador'
    }, {
        name: 'Samantha',
        email: 'samantha@email.com',
        age: 30,
        country: 'United States'
    }, {
        name: 'Nicole',
        email: 'nicole@email.com',
        age: 43,
        country: 'Colombia'
    }, {
        name: 'Natasha',
        email: 'natasha@email.com',
        age: 54,
        country: 'Ecuador'
    }, {
        name: 'Michael',
        email: 'michael@email.com',
        age: 15,
        country: 'Colombia'
    }, {
        name: 'Nicolás',
        email: 'nicolas@email.com',
        age: 43,
        country: 'Colombia'
    }];

    $scope.option = {};
    $scope.options = [{
        number: '1',
        text: 'Option 1'
    }, {
        number: '2',
        text: 'Option 2'
    }, {
        number: '3',
        text: 'Option 3'
    }, {
        number: '4',
        text: 'Option 4'
    }, {
        number: '5',
        text: 'Option 5'
    }, {
        number: '6',
        text: 'Option 6'
    }];

    $scope.availableColors = ['Red', 'Green', 'Blue', 'Yellow', 'Magenta', 'Maroon', 'Umbra', 'Turquoise'];

    $scope.multipleDemo = {};
    $scope.multipleDemo.colors = ['Blue', 'Red'];

}



function toastrCtrl($scope, toaster) {

    $scope.demo1 = function() {
        toaster.success({
            body: "Hi, welcome to Inspinia. This is example of Toastr notification box."
        });
    };

    $scope.demo2 = function() {
        toaster.warning({
            title: "Title example",
            body: "This is example of Toastr notification box."
        });
    };

    $scope.demo3 = function() {
        toaster.pop({
            type: 'info',
            title: 'Title example',
            body: 'This is example of Toastr notification box.',
            showCloseButton: true

        });
    };

    $scope.demo4 = function() {
        toaster.pop({
            type: 'error',
            title: 'Title example',
            body: 'This is example of Toastr notification box.',
            showCloseButton: true,
            timeout: 600
        });
    };

}

function loadingCtrl($scope, $timeout) {


    $scope.runLoading = function() {
        // start loading
        $scope.loading = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading = false;
        }, 2000)
    };


    // Demo purpose actions
    $scope.runLoading1 = function() {
        // start loading
        $scope.loading1 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading1 = false;
        }, 2000)
    };
    $scope.runLoading2 = function() {
        // start loading
        $scope.loading2 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading2 = false;
        }, 2000)
    };
    $scope.runLoading3 = function() {
        // start loading
        $scope.loading3 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading3 = false;
        }, 2000)
    };
    $scope.runLoading4 = function() {
        // start loading
        $scope.loading4 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading4 = false;
        }, 2000)
    };
    $scope.runLoading5 = function() {
        // start loading
        $scope.loading5 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading5 = false;
        }, 2000)
    };
    $scope.runLoading6 = function() {
        // start loading
        $scope.loading6 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading6 = false;
        }, 2000)
    };
    $scope.runLoading7 = function() {
        // start loading
        $scope.loading7 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading7 = false;
        }, 2000)
    };
    $scope.runLoading8 = function() {
        // start loading
        $scope.loading8 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading8 = false;
        }, 2000)
    };
    $scope.runLoading9 = function() {
        // start loading
        $scope.loading9 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading9 = false;
        }, 2000)
    };
    $scope.runLoading10 = function() {
        // start loading
        $scope.loading10 = true;

        $timeout(function() {
            // Simulate some service
            $scope.loading10 = false;
        }, 2000)
    };
    $scope.runLoading11 = function() {
        // start loading
        $timeout(function() {
            $scope.loading11 = 0.1;
        }, 500);
        $timeout(function() {
            $scope.loading11 += 0.2;
        }, 1000);
        $timeout(function() {
            $scope.loading11 += 0.3;
        }, 1500);
        $timeout(function() {
            $scope.loading11 = false;
        }, 2000);

    };
    $scope.runLoading12 = function() {
        // start loading
        $timeout(function() {
            $scope.loading12 = 0.1;
        }, 500);
        $timeout(function() {
            $scope.loading12 += 0.2;
        }, 1000);
        $timeout(function() {
            $scope.loading12 += 0.3;
        }, 1500);
        $timeout(function() {
            $scope.loading12 = false;
        }, 2000);

    };

    $scope.runLoadingDemo = function() {
        // start loading
        $scope.loadingDemo = true;

        $timeout(function() {
            // Simulate some service
            $scope.loadingDemo = false;
        }, 2000)
    };


}


function datatablesCtrl($scope, DTOptionsBuilder) {

    $scope.dtOptions = DTOptionsBuilder.newOptions()
        .withDOM('<"html5buttons"B>lTfgitp')
        .withButtons([{
                extend: 'copy'
            }, {
                extend: 'csv'
            }, {
                extend: 'excel',
                title: 'ExampleFile'
            }, {
                extend: 'pdf',
                title: 'ExampleFile'
            },

            {
                extend: 'print',
                customize: function(win) {
                    $(win.document.body).addClass('white-bg');
                    $(win.document.body).css('font-size', '10px');

                    $(win.document.body).find('table')
                        .addClass('compact')
                        .css('font-size', 'inherit');
                }
            }
        ]);

    /**
     * persons - Data used in Tables view for Data Tables plugin
     */
    $scope.persons = [{
        id: '1',
        firstName: 'Monica',
        lastName: 'Smith'
    }, {
        id: '2',
        firstName: 'Sandra',
        lastName: 'Jackson'
    }, {
        id: '3',
        firstName: 'John',
        lastName: 'Underwood'
    }, {
        id: '4',
        firstName: 'Chris',
        lastName: 'Johnatan'
    }, {
        id: '5',
        firstName: 'Kim',
        lastName: 'Rosowski'
    }];

}

function truncateCtrl($scope) {

    $scope.truncateOptions = {
        watch: 'window'
    };

    $scope.truncateOptions2 = {
        watch: 'window',
        ellipsis: ' ///...'
    };

    $scope.truncateOptions3 = {
        watch: 'window',
        wrap: 'letter'
    }

}

function touchspinCtrl($scope) {

    $scope.inputteresxcs = 55;
    $scope.spinOption1 = {
        min: 0,
        max: 100,
        step: 0.1,
        decimals: 2,
        boostat: 5,
        maxboostedstep: 10,
    };

    $scope.spinOption2 = {
        verticalbuttons: true
    }

    $scope.spinOption3 = {
        postfix: '%'
    }

    $scope.spinOption4 = {
        postfix: "a button",
        postfix_extraclass: "btn btn-default"
    }

}

function tourCtrl($scope) {

    $scope.preparebody = function(tour) {
        $('body').addClass('tour-open')
    };

    $scope.clearbody = function(tour) {
        $('body').removeClass('tour-close')
    }

}

function jstreeCtrl($scope) {

    $scope.treeConfig = {
        'plugins': ['types', 'dnd'],
        'types': {
            'default': {
                'icon': 'fa fa-folder'
            },
            'html': {
                'icon': 'fa fa-file-code-o'
            },
            'svg': {
                'icon': 'fa fa-file-picture-o'
            },
            'css': {
                'icon': 'fa fa-file-code-o'
            },
            'img': {
                'icon': 'fa fa-file-image-o'
            },
            'js': {
                'icon': 'fa fa-file-text-o'
            }

        }
    };

    $scope.treeData = [{
        "id": "ajson1",
        "parent": "#",
        "text": "Admin theme",
        "state": {
            "opened": true
        },
        "__uiNodeId": 1
    }, {
        "id": "ajson2",
        "parent": "ajson1",
        "text": "css",
        "state": {
            "opened": true
        },
        "__uiNodeId": 2
    }, {
        "id": "ajson3",
        "parent": "ajson2",
        "text": "animate.css",
        "state": {
            "opened": true
        },
        "type": "css",
        "__uiNodeId": 3
    }, {
        "id": "ajson4",
        "parent": "ajson2",
        "text": "bootstrap.css",
        "state": {
            "opened": true
        },
        "type": "css",
        "__uiNodeId": 4
    }, {
        "id": "ajson5",
        "parent": "ajson2",
        "text": "style.css",
        "state": {
            "opened": true
        },
        "type": "css",
        "__uiNodeId": 5
    }, {
        "id": "ajson6",
        "parent": "ajson1",
        "text": "fonts",
        "state": {
            "opened": false
        },
        "__uiNodeId": 6
    }, {
        "id": "ajson9",
        "parent": "ajson6",
        "text": "glyphicons-halflings-regular.eot",
        "state": {
            "opened": true
        },
        "type": "img",
        "__uiNodeId": 9
    }, {
        "id": "ajson10",
        "parent": "ajson6",
        "text": "glyphicons-halflings-regular.svg",
        "state": {
            "opened": true
        },
        "type": "svg",
        "__uiNodeId": 10
    }, {
        "id": "ajson11",
        "parent": "ajson6",
        "text": "glyphicons-halflings-regular.ttf",
        "state": {
            "opened": true
        },
        "type": "img",
        "__uiNodeId": 11
    }, {
        "id": "ajson12",
        "parent": "ajson6",
        "text": "glyphicons-halflings-regular.woff",
        "state": {
            "opened": true
        },
        "type": "img",
        "__uiNodeId": 12
    }, {
        "id": "ajson7",
        "parent": "ajson1",
        "text": "img",
        "state": {
            "opened": true
        },
        "__uiNodeId": 7
    }, {
        "id": "ajson13",
        "parent": "ajson7",
        "text": "profile_small.jpg",
        "state": {
            "opened": true
        },
        "type": "img",
        "__uiNodeId": 13
    }, {
        "id": "ajson14",
        "parent": "ajson7",
        "text": "angular_logo.png",
        "state": {
            "opened": true
        },
        "type": "img",
        "__uiNodeId": 14
    }, {
        "id": "ajson15",
        "parent": "ajson7",
        "text": "html_logo.png",
        "state": {
            "opened": true
        },
        "li_attr": {
            "class": "text-navy"
        },
        "type": "img",
        "__uiNodeId": 15
    }, {
        "id": "ajson16",
        "parent": "ajson7",
        "text": "mvc_logo.png",
        "state": {
            "opened": true
        },
        "li_attr": {
            "class": "text-navy"
        },
        "type": "img",
        "__uiNodeId": 16
    }, {
        "id": "ajson8",
        "parent": "ajson1",
        "text": "js",
        "state": {
            "opened": true
        },
        "__uiNodeId": 8
    }, {
        "id": "ajson17",
        "parent": "ajson8",
        "text": "inspinia.js",
        "state": {
            "opened": true
        },
        "type": "js",
        "__uiNodeId": 17
    }, {
        "id": "ajson18",
        "parent": "ajson8",
        "text": "bootstrap.js",
        "state": {
            "opened": true
        },
        "type": "js",
        "__uiNodeId": 18
    }, {
        "id": "ajson19",
        "parent": "ajson8",
        "text": "jquery-2.1.1.js",
        "state": {
            "opened": true
        },
        "type": "js",
        "__uiNodeId": 19
    }, {
        "id": "ajson20",
        "parent": "ajson8",
        "text": "jquery-ui.custom.min.js",
        "state": {
            "opened": true
        },
        "type": "js",
        "__uiNodeId": 20
    }, {
        "id": "ajson21",
        "parent": "ajson1",
        "text": "affix.html",
        "type": "html",
        "__uiNodeId": 21
    }, {
        "id": "ajson22",
        "parent": "ajson1",
        "text": "dashboard.html",
        "type": "html",
        "__uiNodeId": 22
    }, {
        "id": "ajson23",
        "parent": "ajson1",
        "text": "buttons.html",
        "type": "html",
        "__uiNodeId": 23
    }, {
        "id": "ajson24",
        "parent": "ajson1",
        "text": "calendar.html",
        "type": "html",
        "__uiNodeId": 24
    }, {
        "id": "ajson25",
        "parent": "ajson1",
        "text": "contacts.html",
        "type": "html",
        "__uiNodeId": 25
    }, {
        "id": "ajson26",
        "parent": "ajson1",
        "text": "css_animation.html",
        "type": "html",
        "__uiNodeId": 26
    }, {
        "id": "ajson27",
        "parent": "ajson1",
        "text": "flot_chart.html",
        "type": "html",
        "__uiNodeId": 27
    }, {
        "id": "ajson28",
        "parent": "ajson1",
        "text": "google_maps.html",
        "type": "html",
        "__uiNodeId": 28
    }, {
        "id": "ajson29",
        "parent": "ajson1",
        "text": "icons.html",
        "type": "html",
        "__uiNodeId": 29
    }, {
        "id": "ajson30",
        "parent": "ajson1",
        "text": "invoice.html",
        "type": "html",
        "__uiNodeId": 30
    }, {
        "id": "ajson31",
        "parent": "ajson1",
        "text": "login.html",
        "type": "html",
        "__uiNodeId": 31
    }]

}

function datamapsCtrl($scope) {

    $scope.mapObject1 = {
        scope: 'world',
        responsive: true,
        fills: {
            defaultFill: "#DBDAD6"
        },
        geographyConfig: {
            highlightFillColor: '#1C977A',
            highlightBorderWidth: 0,
        },
    }

    $scope.mapObject2 = {
        scope: 'world',
        responsive: true,
        fills: {
            defaultFill: "#DBDAD6",
            active: "#2BA587"
        },
        geographyConfig: {
            highlightFillColor: '#1C977A',
            highlightBorderWidth: 0,
        },
        data: {
            USA: {
                fillKey: "active"
            },
            RUS: {
                fillKey: "active"
            },
            DEU: {
                fillKey: "active"
            },
            BRA: {
                fillKey: "active"
            }
        }
    }

    $scope.mapObject3 = {
        responsive: true,
        scope: 'usa',
        fills: {
            defaultFill: "#DBDAD6",
            active: "#2BA587"
        },
        geographyConfig: {
            highlightFillColor: '#1C977A',
            highlightBorderWidth: 0
        },
        data: {
            NE: {
                fillKey: "active"
            },
            CA: {
                fillKey: "active"
            },
            NY: {
                fillKey: "active"
            },
        }
    }

    $scope.mapObject4 = {
        scope: 'world',
        responsive: true,
        fills: {
            defaultFill: "#F2F2F0",
            active: "#DBDAD6",
            usa: "#269479"
        },
        geographyConfig: {
            highlightFillColor: '#1C977A',
            highlightBorderWidth: 0
        },
        data: {
            USA: {
                fillKey: "usa"
            },
            RUS: {
                fillKey: "active"
            },
            DEU: {
                fillKey: "active"
            },
            POL: {
                fillKey: "active"
            },
            JAP: {
                fillKey: "active"
            },
            AUS: {
                fillKey: "active"
            },
            BRA: {
                fillKey: "active"
            }
        }
    };

    $scope.mapPlugins = {
        arc: {}
    };

    $scope.mapPluginData = {
        arc: [{
            origin: 'USA',
            destination: 'RUS'
        }, {
            origin: 'USA',
            destination: 'DEU'
        }, {
            origin: 'USA',
            destination: 'POL'
        }, {
            origin: 'USA',
            destination: 'JAP'
        }, {
            origin: 'USA',
            destination: 'AUS'
        }, {
            origin: 'USA',
            destination: 'BRA'
        }]
    }



}

function pdfCtrl($scope) {
    $scope.pdfUrl = './pdf/example.pdf';
    $scope.httpHeaders = {
        Authorization: 'Bearer some-aleatory-token'
    };
}

function passwordMeterCtrl($scope) {

    var options1 = {};
    options1.ui = {
        container: "#pwd-container1",
        showVerdictsInsideProgressBar: true,
        viewports: {
            progress: ".pwstrength_viewport_progress"
        }
    };
    options1.common = {
        debug: false,
    };
    $scope.option1 = options1;

    var options2 = {};
    options2.ui = {
        container: "#pwd-container2",
        showStatus: true,
        showProgressBar: false,
        viewports: {
            verdict: ".pwstrength_viewport_verdict"
        }
    };
    $scope.option2 = options2;

    var options3 = {};
    options3.ui = {
        container: "#pwd-container3",
        showVerdictsInsideProgressBar: true,
        viewports: {
            progress: ".pwstrength_viewport_progress2"
        }
    };
    options3.common = {
        debug: true,
        usernameField: "#username"
    };
    $scope.option3 = options3;

    var options4 = {};
    options4.ui = {
        container: "#pwd-container4",
        viewports: {
            progress: ".pwstrength_viewport_progress4",
            verdict: ".pwstrength_viewport_verdict4"
        }
    };
    options4.common = {
        zxcvbn: true,
        zxcvbnTerms: ['samurai', 'shogun', 'bushido', 'daisho', 'seppuku'],
        userInputs: ['#year', '#familyname']
    };
    $scope.option4 = options4;
}

/**
 *
 * Pass all functions into module
 */
angular
    .module('inspinia')
    .controller('LoginCtrl', LoginCtrl)
    .controller('identityCtrl', identityCtrl)
    .controller('uploadCtrl', uploadCtrl)
    .controller('statsCtrl', statsCtrl)
    .controller('activityCtrl', activityCtrl)
    .controller('MainCtrl', MainCtrl);
