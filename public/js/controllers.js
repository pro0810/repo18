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

}

function volumeCtrl($scope, $http, $location, principal) {
    $scope.$watchGroup(['sDate', 'eDate'], function() {
        $scope.getVolumes();
        // $scope.getStats();
    });
    $scope.getVolumes = function() {
        console.log('getting volumes');
        // $http.get('/volumes').success(function(counts) {
        //     console.log(counts)
        //     $scope.volumes = counts;
        // });
        if (! $scope.sDate) {
            return;
        }
        $http.get('/newvolumes', {params: {"sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function(volumes) {
            console.log(volumes);
            var dates = new Set();
            volumes.forEach(function(c) {
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
            var docIds = {};
            var columns = [];
            var xColumn = Object.keys(xValues);
            volumes.forEach(function(c) {
                for (var i = 1, column = new Array(xColumn.length); i < xColumn.length;) {
                    column[i++] = 0;
                }
                column[0] = c['subdomain'];
                docIds[c['subdomain']] = [];
                c['dates'].forEach(function(d) {
                    column[xValues[d['date']] + 1] = d['count'];
                    docIds[c['subdomain']][xValues[d['date']]] = d['ids'];
                });
                columns.push(column);
            });

            var graph = c3.generate({
                bindto: '#chart-volume',
                data: {
                    columns: columns,
                    onclick: function(data) {
                        principal['activityFilter'] = docIds[data['id']][data['index']];
                        $location.path('activity');
                        $scope.$apply();
                    }
                },
                axis: {
                    x: {
                        type: 'category',
                        categories: xColumn.map(function(d) {
                            return d;
                        })
                    }
                },
                padding: {
                    right: 30
                }
            });
        });
    };
    $scope.getStats = function() {
        // $http.get('/stats').success(function(avg) {
        //     $scope.stats['before'] = avg.data;
        //     $scope.stats['after'] = avg.feedback;
        // });
        if (! $scope.sDate) {
            return;
        }
        $http.get('/newstats', {params: {"pageType": $scope.selectedPageType, "sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function(avg) {
            $scope.stats = {};
            $scope.stats['before'] = avg.data;
            $scope.stats['after'] = avg.feedback;
        });
    };
}

function avgAccuracyCtrl($scope, $http, $location, principal) {
    $scope.$watchGroup(['selectedFieldType', 'sDate', 'eDate'], function() {
        $scope.getAvgAccuracy();
    });
    $scope.getAvgAccuracy = function() {
        console.log('getting average accuracy');
        if (! $scope.sDate || ! $scope.selectedFieldType) {
            return;
        }
        $http.get('/avg-accuracy', {params: {"sDate": $scope.sDate, "eDate": $scope.eDate, "fieldType": $scope.selectedFieldType}}).success(function(res) {
            console.log(res);
            var x_arr = [];
            var column = ['average accuracy'];
            res.forEach(function(d) {
                x_arr.push(d['date']);
                var totalCnt = d['data'].length;
                var correctCnt = 0;
                for (var i in d['data']) {
                    if (d['data'][i]['correct'] === 'OK') {
                        correctCnt ++;
                    }
                }
                column.push((correctCnt / totalCnt * 100).toFixed(2))
            });
            var columns = [column];
            var graph = c3.generate({
                bindto: '#chart-avg-accuracy',
                data: {
                    columns: columns
                },
                axis: {
                    x: {
                        type: 'category',
                        categories: x_arr
                    }
                },
                padding: {
                    right: 30
                },
                tooltip: {
                    format: {
                        value: function (value, ratio, id, index) {
                            return value + '%';
                        }
                    }
                }
            });
        });
    };
}

function accuracyCtrl($scope, $location, $state, $http, principal) {
    $scope.$watchGroup(['selectedPageType', 'sDate', 'eDate'], function() {
        getDataForAccuracyFromNewDocument();
    });

    function getDataForAccuracyFromNewDocument() {
        if (! $scope.sDate || ! $scope.selectedPageType) {
            return;
        }
        $http.get('/newaccuracy', {params: {"pageType": $scope.selectedPageType, "sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function (counts) {
            console.log(counts);
            // debugger;
            var _arr = [];
            var groups = ['OK', 'A', 'B'];
            var columns = [];
            var p_columns = [];
            for (var countIndex in counts) {
                if (! _arr.includes(counts[countIndex]['_id']['label'])) {
                    _arr.push(counts[countIndex]['_id']['label']);
                }
            }
            for (var i = 0; i < groups.length; i++) {
                columns[i] = [];
                p_columns[i] = [];
                columns[i].push(groups[i]);
                p_columns[i].push(groups[i]);
                for (var j = 0; j < _arr.length; j++) {
                    var emptyValue = true;
                    for (var countIndex in counts){
                        if (counts[countIndex]['_id']['label'] === _arr[j] && counts[countIndex]['_id']['correct'] === groups[i]) {
                            columns[i].push(counts[countIndex]['counts']);
                            emptyValue = false;
                            break;
                        }
                    }
                    if (emptyValue) {
                        columns[i].push(0);
                    }
                }
            }
            for (var i = 1; i <= _arr.length; i++) {
                if (columns[0][i] + columns[1][i] + columns[2][i] == 0) {
                    p_columns[0].push(0);
                    p_columns[1].push(0);
                    p_columns[2].push(0);
                } else {
                    p_columns[0].push((columns[0][i] / (columns[0][i] + columns[1][i] + columns[2][i]) * 100).toFixed(2));
                    p_columns[1].push((columns[1][i] / (columns[0][i] + columns[1][i] + columns[2][i]) * 100).toFixed(2));
                    p_columns[2].push((columns[2][i] / (columns[0][i] + columns[1][i] + columns[2][i]) * 100).toFixed(2));
                }

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
                    columns: p_columns,
                    type: 'bar',
                    groups: [groups],
                    order: null,
                    colors: {
                        'OK': 'rgb(44, 160, 44)',
                        'A': 'rgb(31, 119, 180)',
                        'B': 'rgb(214, 39, 40)',
                    },
                    onclick: function(data) {
                        console.log(data);
                        $location.url('/activity/' + _arr[data.index] + '/' + data.id);
                        $scope.$apply();
                    }
                },
                tooltip: {
                    format: {
                        // title: function (d) { return 'Data ' + d; },
                        value: function (value, ratio, id, index) {
                            // var format = id === 'data1' ? d3.format(',') : d3.format('$');
                            return value + '%, ' + columns[groups.indexOf(id)][index + 1];
                        }
//            value: d3.format(',') // apply this format to both y and y2
                    }
                }
            });
        });
    }

    $scope.getAccuracy = function() {
        principal.identity().then(function(identity) {
            var _arr = ['amount', 'IBAN', 'message', 'name'];
            identity.domain = 'ag_health_split';
            if (identity.domain === 'bpost' || identity.domain === 'suuha') {
                getDataForAccuracyFromDocument();
            } else if (identity.domain === 'ag_health_split') {
                getDataForAccuracyFromNewDocument();
            }
        });
    };
}

function awarenessCtrl($scope, $state, $http, $location, principal, $timeout) {
    var changedTolerance = false;
    var changedThreshold = false;
    function updateThresholdLine() {
        if ($scope.graph) {
            $scope.graph.ygrids.remove();
            $timeout(function () {
                $scope.graph.ygrids.add({value: $scope.threshold});
            }, 400);
        }
    }

    $scope.$watch('threshold', function() {
        var tolerance_cnt = 0;
        if (!($scope.graph && $scope.column_B)) {
            return;
        }
        if (changedThreshold) {
            changedThreshold = false;
            return;
        }
        for (var i in $scope.column_B) {
            if ($scope.column_B[i] > $scope.threshold){
                tolerance_cnt = $scope.column_B.length - parseInt(i);
                break;
            }
        }
        var tolerance;
        if ($scope.column_B.length > 0) {
            tolerance = parseFloat((tolerance_cnt / $scope.column_B.length * 100).toFixed(2));
        } else {
            tolerance = 0;
        }
        if ($scope.tolerance != tolerance) {
            $scope.tolerance = tolerance;
            changedTolerance = true;
        }
        console.log('threshold');
        console.log($scope.threshold);
        console.log($scope.tolerance);
        updateThresholdLine();
    });

    $scope.$watch('tolerance', function() {
        var tolerance_cnt = 0;
        if (!($scope.graph && $scope.column_B)) {
            return;
        }
        if (changedTolerance) {
            changedTolerance = false;
            return;
        }
        for (var i in $scope.column_B) {
            if ($scope.column_B[i] >= $scope.threshold){
                tolerance_cnt = $scope.column_B.length - parseInt(i);
                break;
            }
        }
        if (tolerance_cnt != parseInt($scope.column_B.length * $scope.tolerance / 100)) {
            tolerance_cnt = parseInt($scope.column_B.length * $scope.tolerance / 100);
            if (tolerance_cnt < $scope.column_B.length * $scope.tolerance / 100) {
                tolerance_cnt += 1;
            }
            var threshold;
            if ($scope.column_B.length == tolerance_cnt) {
                threshold = 0;
            } else if (tolerance_cnt == 0) {
                threshold = 100;
            } else {
                threshold = parseFloat((($scope.column_B[$scope.column_B.length - tolerance_cnt] + $scope.column_B[$scope.column_B.length - tolerance_cnt - 1]) / 2).toFixed(2));
            }
            if ($scope.threshold != threshold) {
                changedThreshold = true;
                $scope.threshold = threshold;
                updateThresholdLine();
            }
        }
        console.log('tolerance');
        console.log($scope.threshold);
        console.log($scope.tolerance);
    });

    $scope.$watchGroup(['selectedFieldType', 'selectedPageType', 'sDate', 'eDate'], function() {
        $scope.getAwareness();
    });

    $scope.getAwareness = function() {
        // principal.levels().then(function(levels) {
        if (! $scope.sDate || ! $scope.selectedFieldType) {
            return;
        }
        var column_OK = ['OK'],
            column_B = ['B'],
            column_OK_x = ['OK_x'],
            column_B_x = ['B_x'];
        $http.get('/newawareness', {params: {"fieldType": $scope.selectedFieldType, "pageType": $scope.selectedPageType, "sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function(data) {
            var pageType_arr = [],
                cnt = 0;

            for (var i in data) {
                if (data[i]['annotations']['correct'] === 'B') {
                    if (data[i]['annotations']['confidence'] == null) {
                        data[i]['annotations']['confidence'] = 0;
                    }
                    column_B_x.push(parseInt(i) + 1);
                    column_B.push(data[i]['annotations']['confidence']);
                    pageType_arr[cnt] = data[i]['id'];
                    cnt ++;
                } else if (data[i]['annotations']['correct'] == 'OK') {
                    column_OK_x.push(parseInt(i) + 1);
                    column_OK.push(data[i]['annotations']['confidence']);
                    pageType_arr[cnt] = data[i]['id'];
                    cnt ++;
                }
            }
            var columns = [column_OK_x, column_B_x, column_OK, column_B];

            $scope.column_B = column_B.slice(1).sort(function(a, b){return a > b});
            $scope.graph = c3.generate({
                bindto: '#awareness-chart',
                axis: {
                    y: {
                        min: 0,
                        max: 105,
                        padding: 0
                    }
                },
                data: {
                    xs: {OK: 'OK_x', B: 'B_x'},
                    columns: columns,
                    type: 'scatter',
                    onclick: function(data) {
                        $location.path("view/review/" + pageType_arr[data['index']]);
                        $scope.$apply();
                    }
                },
                grid: {
                    y: {
                        lines: [{value: 100}]
                    }
                },
                point: {
                    r: 4
                }
            });
            // if ($scope.threshold != undefined) {
            //     changedTolerance = true;
            //     changedThreshold = true;
            // }
            $scope.threshold = 100;
            $scope.tolerance = 0;
            // updateThresholdLine();
        });
        // });
    };

}

function statisticsCtrl($scope, $state, $location, principal, $http) {
    $scope.$watchGroup(['selectedPageType', 'sDate', 'eDate'], function() {
        $scope.getStatistics();
    });
    $scope.getStatistics = function() {
        if (! $scope.sDate || ! $scope.selectedPageType) {
            return;
        }
        principal.identity().then(function(identity) {
            var columns = [];
            var p_columns = [];
            var column = ['% accuracy of document'];
            var p_column = ['% accuracy of document'];
            var documentIds = {};
            var total_num = 0;
            $http.get('/newstatistics', {params: {"pageType": $scope.selectedPageType, "sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function(documentIds) {
                var _arr = [];
                var pageType_arr = [];
                for (var i=20; i>=-1; i--) {
                    pageType_arr[20 - i] = []
                    if (i == 20) {
                        _arr.push("100%");
                    } else if (i == -1) {
                        _arr.push("0%");
                    } else  {
                        _arr.push(String(i * 5 + 5) + "-" + String(i * 5));
                    }
                    var num = 0;
                    for (var j in documentIds) {
                        var correct_cnt = 0;
                        var incorrect_cnt = 0;
                        for (var k in documentIds[j]['annotations']) {
                            if (documentIds[j]['annotations'][k]['correct'] == 'OK') {
                                correct_cnt ++;
                            } else {
                                incorrect_cnt ++;
                            }
                        }
                        var percent = correct_cnt / (correct_cnt + incorrect_cnt) * 100;
                        if (i == 20) {
                            if (percent == 100) {
                                num ++;
                                pageType_arr[20 - i].push(documentIds[j]['id']);
                            }
                        } else if (i == -1) {
                            if (percent == 0) {
                                num ++;
                                pageType_arr[20 - i].push(documentIds[j]['id']);
                            }
                        } else {
                            if (percent >= i * 5 && percent < (i + 1) * 5) {
                                num ++;
                                pageType_arr[20 - i].push(documentIds[j]['id']);
                            }
                        }
                    }
                    column.push(num);
                    total_num += num;
                }
                if (total_num) {
                    for (var i = 0; i < column.length; i++) {
                        if (i === 0)
                            continue;
                        p_column.push((column[i] / total_num * 100).toFixed(2));
                    }
                }
                columns.push(column);
                p_columns.push(p_column);
                var graph = c3.generate({
                    bindto: '#statistics-chart',
                    axis: {
                        // rotated: true,
                        x: {
                            type: 'category',
                            categories: _arr
                        }
                    },
                    data: {
                        columns: columns,
                        type: 'bar',
                        onclick: function(data) {
                            principal['activityFilter'] = pageType_arr[data['index']];
                            $location.path('activity');
                            $scope.$apply();
                        }
                    },
                    tooltip: {
                        format: {
                            value: function (value, ratio, id, index) {
                                return value + ', ' + p_columns[0][index + 1] + '%';
                            }

                        }
                    }
                });
            });
        });
    };
}

function timingsCtrl($scope, $http) {
    $scope.$watchGroup(['sDate', 'eDate'], function() {
        $scope.getTimings();
    });

    $scope.getTimings = function() {
        // $http.get('/timings').success(function(timings) {
        //     for (var timingIndex in timings) {
        //         timings[timingIndex] /= 1000;
        //     }
        //     $scope.timings = timings;
        // });
        if (! $scope.sDate) {
            return;
        }
        $http.get('/newtimings', {params: {"sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function(timings) {
            for (var timingIndex in timings) {
                timings[timingIndex] /= 1000;
            }
            $scope.timings = timings;
        });
    };
}

function statsCtrl($scope, $http, $location, $state, principal, $uibModal, $timeout) {
    var default_autoThreshold = 70;
    $scope.opts = {
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    };
    if (principal.daterange) {
        $scope.daterange = principal.daterange;
        var first_loaded = true;
    }

    $scope.$watch('daterange', function() {
        $scope.sDate = $scope.daterange.data.startDate.format().substring(0, 10) + "T00:00:00Z";
        $scope.eDate = $scope.daterange.data.endDate.format().substring(0, 10) + "T23:59:59.999Z";
        $scope.selectedPageType = null;
        $scope.selectedFieldType = null;
        $scope.selectedRowType = null;
        if (first_loaded) {
            first_loaded = false;
            $scope.getFilterDatas();
        } else {
            principal.selectedPageType = null;
            principal.selectedFieldType = null;
            principal.selectedRowType = null;
            $scope.getFilterDatas(true);
        }
    }, true);

    $scope.getFilterDatas = function(enforce, pageType) {
        if (! $scope.sDate) {
            return;
        }
        principal.levels(enforce, pageType).then(function(levels){
            $scope.pageTypes = levels['pagetype'];
            $scope.fieldTypes = levels['fieldtype'];
            for (var i in $scope.fieldTypes) {
                if (principal.autoThreshold[$scope.fieldTypes[i]] === undefined) {
                    if (levels['fieldThreshold'] && levels['fieldThreshold'][$scope.fieldTypes[i]]) {
                        principal.autoThreshold[$scope.fieldTypes[i]] = levels['fieldThreshold'][$scope.fieldTypes[i]];
                    } else {
                        principal.autoThreshold[$scope.fieldTypes[i]] = default_autoThreshold;
                    }

                }
            }
            // principal.autoThreshold = levels['fieldThreshold'];
            $scope.fieldThreshold = principal.autoThreshold;
            $scope.rowTypes = levels['rowtype'];
            $scope.selectedPageType = principal.selectedPageType? principal.selectedPageType:$scope.pageTypes[0];
            principal.selectedPageType = $scope.selectedPageType;
            $scope.selectedFieldType = principal.selectedFieldType? principal.selectedFieldType:$scope.fieldTypes[0];
            principal.selectedFieldType = $scope.selectedFieldType;
            $scope.selectedRowType = $scope.selectedRowType? $scope.selectedRowType:$scope.rowTypes[0];
            principal.selectedRowType = $scope.selectedRowType;
        });
    };
    $scope.dropdownMenuPageTypeSelected = function(pageType) {
        if (pageType != $scope.selectedPageType) {
            $scope.selectedPageType = pageType;
            principal.selectedPageType = pageType;
            // principal.selectedPageType = null;
            principal.selectedFieldType = null;
            principal.selectedRowType = null;
            $scope.getFilterDatas(true, pageType);
        }
    };
    $scope.dropdownMenuFieldTypeSelected = function(fieldType) {
        if (fieldType != $scope.selectedFieldType) {
            $scope.selectedFieldType = fieldType;
            principal.selectedFieldType = fieldType;
        }
    };
    $scope.dropdownMenuRowTypeSelected = function(rowType) {
        if (pageType != $scope.selectedRowType) {
            $scope.selectedRowType = rowType;
            principal.selectedRowType = rowType;
        }
    };

    $scope.publishThresholds = function() {
        // debugger;
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modal.html',
            controller: 'ModalInstanceCtrl',
            windowClass: "animated fadeIn"
        });
        $http.post('/fieldsThresholds', {fieldsThresholds: principal.autoThreshold}).success(function (res) {
            // debugger;
            $timeout(function() {
                modalInstance.close();
            }, 1000);
            console.log('updated fieldThresholdDb');
        });
    };
}

function autoDocCtrl($scope, $state, $location, principal, $http) {
    $scope.$watchGroup(['selectedPageType', 'sDate', 'eDate'], function() {
        if ($scope.selectedPageType && $scope.sDate && $scope.eDate) {
            $scope.getStatistics();
        }
    });
    $scope.$watch('fieldThreshold', function() {
        if ($scope.fieldThreshold) {
            console.log($scope.fieldThreshold);
            $scope.getStatistics();
        }
    }, true);

    $scope.getStatistics = function() {
        if (! $scope.sDate || ! $scope.selectedPageType) {
            return;
        }
        principal.identity().then(function(identity) {
            var columns = [];
            var column = ['% accuracy of automation document'];
            var documentIds = {};
            $http.get('/newstatistics', {params: {"pageType": $scope.selectedPageType, "sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function(documentIds) {
                var _arr = [];
                var pageType_arr = [];
                for (var i=20; i>=-1; i--) {
                    pageType_arr[20 - i] = []
                    if (i == 20) {
                        _arr.push("100%");
                    } else if (i == -1) {
                        _arr.push("0%");
                    } else {
                        _arr.push(String(i * 5 + 5) + "-" + String(i * 5));
                    }
                    var num = 0;
                    for (var j in documentIds) {
                        var correct_cnt = 0;
                        var incorrect_cnt = 0;
                        for (var k in documentIds[j]['annotations']) {
                            if (documentIds[j]['annotations'][k]['confidence'] >= principal.autoThreshold[documentIds[j]['annotations'][k]['label']]) {
                                correct_cnt ++;
                            } else {
                                incorrect_cnt ++;
                            }
                        }
                        var percent = correct_cnt / (correct_cnt + incorrect_cnt) * 100;
                        if (i == 20) {
                            if (percent == 100) {
                                num ++;
                                pageType_arr[20 - i].push(documentIds[j]['id']);
                            }
                        } else if (i == -1) {
                            if (percent == 0) {
                                num ++;
                                pageType_arr[20 - i].push(documentIds[j]['id']);
                            }
                        } else {
                            if (percent >= i * 5 && percent < (i + 1) * 5) {
                                num ++;
                                pageType_arr[20 - i].push(documentIds[j]['id']);
                            }
                        }
                    }
                    column.push(num);
                }
                columns.push(column);
                var graph = c3.generate({
                    bindto: '#autoDoc-chart',
                    axis: {
                        // rotated: true,
                        x: {
                            type: 'category',
                            categories: _arr
                        }
                    },
                    data: {
                        columns: columns,
                        type: 'bar',
                        onclick: function(data) {
                            principal['activityFilter'] = pageType_arr[data['index']];
                            $location.path('activity');
                            $scope.$apply();
                        }
                    }
                });
            });
        });
    };
}

function autoFieldCtrl($scope, $location, $state, $http, principal) {
    $scope.$watchGroup(['selectedPageType', 'sDate', 'eDate'], function() {
        getDataForAccuracyFromNewDocument();
    });

    function saveSliderValue(data) {
        if (data['input'][0]['dataset']['label'] == 'total_threshold') {
            $scope.ionSliderOptions1['from'] = data['fromNumber'];
            for (var i in _arr) {
                principal.autoThreshold[_arr[i]] = data['fromNumber'];
            }

            for (var i in counts) {
                createSingleChart(i);
            }
            updateSliderValue(data['fromNumber']);
        } else {
            principal.autoThreshold[data['input'][0]['dataset']['label']] = data['fromNumber'];
            for (var i in counts) {
                if (counts[i]['_id']['label'] == data['input'][0]['dataset']['label']) {
                    createSingleChart(i);
                    break;
                }
            }
            // updateSliderValue(data['fromNumber'], data['input'][0]['dataset']['label']);
        }

        $scope.$apply();
    }

    function updateSliderValue(value) {
        $("div.ng-isolate-scope").each(function(){
            if(this.getAttribute('data-label') != 'total_threshold') {
                this.updateData({
                    from: principal.autoThreshold[this.getAttribute('data-label')]
                });
            }
        });
    }

    $scope.sliderHeightStyle = function($last) {
        return {
            'height': $last ? '70px' : '50px' ,
            'max-height': $last ? '70px' : '50px'
        };
    };

    function loadSliderValue(data) {
        console.log(data['input'][0]['dataset']['label']);
        debugger;
    }

    $scope.ionSliderOptions1 = {
        min: 0,
        max: 100,
        step: 0.1,
        postfix: "%",
        force_edges: true,
        hideMinMax: true,
        onFinish: saveSliderValue,
    };

    var _arr;
    var groups = ['Correct & Above', 'Incorrect & Above', 'Correct & Below', 'Incorrect & Below'];
    var columns;
    var counts;

    function createSingleChart(countIndex) {
        var p_columns = [];
        var cntCA = 0,
            cntIA = 0,
            cntCB = 0,
            cntIB = 0;
        for (var i in counts[countIndex]['accuracy']) {
            if (counts[countIndex]['accuracy'][i]['correct'] == 'OK' && counts[countIndex]['accuracy'][i]['confidence'] >= principal.autoThreshold[counts[countIndex]['_id']['label']]) {
                cntCA ++;
            } else if (counts[countIndex]['accuracy'][i]['correct'] != 'OK' && counts[countIndex]['accuracy'][i]['confidence'] >=  principal.autoThreshold[counts[countIndex]['_id']['label']]) {
                cntIA ++;
            } else if (counts[countIndex]['accuracy'][i]['correct'] == 'OK' && counts[countIndex]['accuracy'][i]['confidence'] <  principal.autoThreshold[counts[countIndex]['_id']['label']]) {
                cntCB ++;
            } else if (counts[countIndex]['accuracy'][i]['correct'] != 'OK' && counts[countIndex]['accuracy'][i]['confidence'] <  principal.autoThreshold[counts[countIndex]['_id']['label']]) {
                cntIB ++;
            }
        }
        columns[0][counts[countIndex]['_id']['label']] = cntCA;
        columns[1][counts[countIndex]['_id']['label']] = cntIA;
        columns[2][counts[countIndex]['_id']['label']] = cntCB;
        columns[3][counts[countIndex]['_id']['label']] = cntIB;
        var cntTotal = cntCA + cntIA + cntCB + cntIB;
        cntTotal = cntTotal === 0?1:cntTotal;
        for (var i = 0; i < groups.length; i++) {
            p_columns[i] = [];
            p_columns[i].push(groups[i]);
        }
        p_columns[0].push(((cntCA / cntTotal) * 100).toFixed(2));
        p_columns[1].push(((cntIA / cntTotal) * 100).toFixed(2));
        p_columns[2].push(((cntCB / cntTotal) * 100).toFixed(2));
        p_columns[3].push(((cntIB / cntTotal) * 100).toFixed(2));
        // break;
        var legendOption = countIndex == (counts.length - 1) ? true : false;
        var graph = c3.generate({
            bindto: '#autoField-chart' + countIndex,
            axis: {
                rotated: true,
                x: {
                    type: 'category',
                    categories: [_arr[countIndex]],
                    show: false
                }
            },
            size: {
                height: countIndex == (counts.length - 1) ? 70 : 50
            },
            data: {
                columns: p_columns,
                type: 'bar',
                groups: [groups],
                order: null,
                colors: {
                    'Correct & Above': 'rgb(44, 160, 44)',
                    'InCorrect & Above': 'rgb(31, 119, 180)',
                    'Correct & Below': 'rgb(214, 39, 40)',
                    'Incorrect & Below': 'rgb(255, 127, 14)'
                },
                onclick: function(data) {
                    $location.url('/activity/' + 'IBAN' + '/' + data.id);
                    $scope.$apply();
                }
            },
            tooltip: {
                contents: function (d, defaultTitleFormat, defaultValueFormat, color) {
                    var $$ = this, config = $$.config;
                    defaultValueFormat = function (t, a, r) {
                        return t + '%, ' + columns[groups.indexOf(r)][config.axis_x_categories[0]];
                    };
                    return c3.chart.internal.fn.getTooltipContent.apply(this, arguments);
                }
            },
            legend: {
                show: legendOption
            }
        });
    }

    function getDataForAccuracyFromNewDocument() {
        $http.get('/autoField', {params: {"pageType": $scope.selectedPageType, "sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function (res) {
            counts = res;
            _arr = [];
            columns = [];

            for (var i = 0; i < groups.length; i++) {
                columns[i] = {};
            }
            for (var countIndex in counts) {
                _arr.push(counts[countIndex]['_id']['label']);
            }
            for (var countIndex in counts) {
                createSingleChart(countIndex);
            }
            updateSliderValue();
        });
    }

    $scope.getAccuracy = function() {
        principal.identity().then(function(identity) {
            getDataForAccuracyFromNewDocument();
        });
    };
}

function activityCtrl($scope, $http, $location, $state, principal) {
    identity = {};
    $scope.period = "month";
    $scope.activities = null;
    $scope.doneLoading = false;
    $scope.getActivity = function() {
        if (principal['activityFilter'] && principal['activityFilter'].length) {
            $http.post('/newactivity', {docIds: principal['activityFilter']}).success(function(activity){
                makeActivityTable(activity);
            });
            principal['activityFilter'] = [];
        } else {
            $http.get('/newactivity', {params: {"field": $scope.toStateParams['field'], "accuracy": $scope.toStateParams['accuracy'], "sDate": $scope.sDate, "eDate": $scope.eDate}}).success(function(activity){
                makeActivityTable(activity)
            });
        }
    };

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
                    name: 'link',
                    title: '',
                    sortable: false,
                    filterable: false,

                }, {
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

    function updateDocIds(d) {
        var _docIds = [];
        for (var i in d) {
            _docIds.push(d[i]['id']);
        }
        principal.docIds = _docIds;
    }


    function makeActivityTable(activity) {
        updateDocIds(activity);
        for (var row_index in activity) {
            var row = activity[row_index];
            // row.workstation = "iPad";
            if (row.timings) {
                row.receivetime = new Date(row.timings.receive);
                row.starttime = new Date(row.timings.start);
                row.donetime = new Date(row.timings.done);
                row.feedbacktime = new Date(row.timings.feedback);
                row.leadtime = Math.round((row.donetime - row.receivetime) / 1000);
                row.processingtime = Math.round((row.donetime - row.starttime) / 1000);
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
                identity.baseUrl = 'https://localhost:5023/';
            }
            var urlReview = 'review';
            if (identity.domain === 'bpost') {
                urlReview = 'viewer';
            }
            row.url = '<a href="' + identity.baseUrl + urlReview + '/' + row.id + '">' + row.id + '</a>';
            // row.link = '<a target="cf_review" href="' + identity.baseUrl + urlReview + '/' + row.id + '">' + '<i class="fa fa-link"></i>' + '</a>';
            row.link = '<a href="' + '#/view/' + urlReview + '/' + row.id + '">' + '<i class="fa fa-link"></i>' + '</a>';
            delete row['data'];
        }
        $scope.activities = activity;
    }

    function errorActivityTable(err) {
        console.log(err);
    }
}

function viewCtrl($scope, $sce, $state, $location, principal) {
    var prefixUrl = "http://localhost:5023/";
    if ($state.params.viewPath) {
        $scope.currentViewUrl = $sce.trustAsResourceUrl(prefixUrl + $state.params.viewPath + "/" + $state.params.viewId);
        principal.currentViewUrl = $state.params.viewPath + "/" + $state.params.viewId;
    } else {
        $scope.currentViewUrl = $sce.trustAsResourceUrl(prefixUrl + principal.currentViewUrl);
        $location.path("view/" + principal.currentViewUrl);
    }
    if (principal.currentViewUrl) {
        var viewPath = principal.currentViewUrl.substr(0, principal.currentViewUrl.indexOf('/')),
            viewId = principal.currentViewUrl.substr(principal.currentViewUrl.indexOf('/') + 1);
        $scope.nextViewUrl = '#';
        $scope.prevViewUrl = '#';
        $scope.nextViewDisabled = true;
        $scope.prevViewDisabled = true;
        if (principal['docIds'] && principal['docIds'].indexOf(viewId) != -1) {
            if (principal['docIds'][principal['docIds'].indexOf(viewId) + 1]) {
                $scope.nextViewUrl = "view/" + viewPath + "/" + principal['docIds'][principal['docIds'].indexOf(viewId) + 1];
                $scope.nextViewDisabled = false;
            }
            if (principal['docIds'][principal['docIds'].indexOf(viewId) - 1]) {
                $scope.prevViewUrl = "view/" +  viewPath + "/" + principal['docIds'][principal['docIds'].indexOf(viewId) - 1];
                $scope.prevViewDisabled = false;
            }
        }
    }

    $scope.prevDoc = function() {
        $location.path($scope.prevViewUrl);
    }

    $scope.nextDoc = function() {
        $location.path($scope.nextViewUrl);
    }

    console.log($scope.currentViewUrl);
}

function uploadCtrl($scope, $http, $location, $state, FileUploader) {
    $scope.uploader = new FileUploader({
        url: '/upload'
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


function ModalInstanceCtrl($scope, $uibModalInstance) {
    $scope.ok = function() {
        $uibModalInstance.close();
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };
};

angular
    .module('inspinia')
    .controller('LoginCtrl', LoginCtrl)
    .controller('identityCtrl', identityCtrl)
    .controller('statsCtrl', statsCtrl)
    .controller('volumeCtrl', volumeCtrl)
    .controller('avgAccuracyCtrl', avgAccuracyCtrl)
    .controller('accuracyCtrl', accuracyCtrl)
    .controller('statisticsCtrl', statisticsCtrl)
    .controller('awarenessCtrl', awarenessCtrl)
    .controller('timingsCtrl', timingsCtrl)
    .controller('activityCtrl', activityCtrl)
    .controller('uploadCtrl', uploadCtrl)
    .controller('viewCtrl', viewCtrl)
    .controller('autoDocCtrl', autoDocCtrl)
    .controller('autoFieldCtrl', autoFieldCtrl)
    .controller('ModalInstanceCtrl', ModalInstanceCtrl)
    .controller('MainCtrl', MainCtrl);


