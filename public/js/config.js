/**
 * INSPINIA - Responsive Admin Theme
 *
 * Inspinia theme use AngularUI Router to manage routing and views
 * Each view are defined as state.
 * Initial there are written state for all view in theme.
 *
 */
function config($stateProvider, $urlRouterProvider, $ocLazyLoadProvider, IdleProvider, KeepaliveProvider) {

  // Configure Idle settings
  IdleProvider.idle(5); // in seconds
  IdleProvider.timeout(120); // in seconds

  $urlRouterProvider.otherwise("/activity");

  $ocLazyLoadProvider.config({
    // Set to true if you want to see what and when is dynamically loaded
    debug: false
  });

  $stateProvider
    .state('site', {
      'abstract': true,
      template: '<ui-view/>', // Note: abstract still needs a ui-view for its children to populate.
      resolve: {
        authorize: ['authorization',
          function(authorization) {
            return authorization.authorize();
          }
        ]
      }
    })
    .state('stats', {
      parent: 'site',
      url: "/stats",
      templateUrl: "views/stats.html",
      data: {
        roles: ['Admin'],
        pageTitle: 'Stats'
      },
      controller: 'statsCtrl',
      resolve: {
        loadPlugin: function($ocLazyLoad) {
          return $ocLazyLoad.load([{
            serie: true,
            files: ['css/plugins/c3/c3.min.css', 'js/plugins/d3/d3.min.js', 'js/plugins/c3/c3.min.js']
          }, {
            serie: true,
            name: 'gridshore.c3js.chart',
            files: ['js/plugins/c3/c3-angular.min.js']
          }, {
              serie: true,
              files: ['js/plugins/daterangepicker/daterangepicker.js', 'css/plugins/daterangepicker/daterangepicker-bs3.css']
          }, {
              name: 'daterangepicker',
              files: ['js/plugins/daterangepicker/angular-daterangepicker.js'],
              serie: true
          }]);
        }
      }
    })
    .state('activity', {
      parent: 'site',
      url: "/activity/:field/:accuracy",
      params: {
        field: {
          squash: true,
          value: null
        },
        accuracy: {
          squash: true,
          value: null
        },
      },
      templateUrl: "views/activity.html",
      data: {
        roles: ['User'],
        pageTitle: 'Activity'
      },
      controller: 'activityCtrl',
      resolve: {
        loadPlugin: function($ocLazyLoad) {
          return $ocLazyLoad.load([
              {
            files: ['js/plugins/footable/footable.min.js', 'css/plugins/footable/footable.bootstrap.min.css']
          }]);
        }
      }
    })
    .state('upload', {
      url: "/upload",
      templateUrl: "views/upload.html",
      data: {
        roles: ['User'],
        pageTitle: 'Upload'
      },
      controller: 'uploadCtrl',
      resolve: {
        loadPlugin: function($ocLazyLoad) {
          return $ocLazyLoad.load([{
            name: 'angularFileUpload',
            files: ['js/plugins/angular-file-upload/angular-file-upload.min.js']
          }]);
        }
      }
    })
    .state('view', {
      parent: 'site',
      url: "/view/:viewPath/:viewId",
      templateUrl: "views/views.html",
      data: {
        pageTitle: 'View'
      },
      controller: 'viewCtrl'
    })
    .state('automation', {
        parent: 'site',
        url: "/automation",
        templateUrl: "views/automation.html",
        data: {
            pageTitle: 'Automation'
        },
        controller: 'statsCtrl',
        resolve: {
            loadPlugin: function($ocLazyLoad) {
                return $ocLazyLoad.load([{
                    serie: true,
                    files: ['css/plugins/c3/c3.min.css', 'js/plugins/d3/d3.min.js', 'js/plugins/c3/c3.min.js']
                }, {
                    serie: true,
                    name: 'gridshore.c3js.chart',
                    files: ['js/plugins/c3/c3-angular.min.js']
                }, {
                    serie: true,
                    files: ['js/plugins/daterangepicker/daterangepicker.js', 'css/plugins/daterangepicker/daterangepicker-bs3.css']
                }, {
                    name: 'daterangepicker',
                    files: ['js/plugins/daterangepicker/angular-daterangepicker.js'],
                    serie: true
                }, {
                    files: ['css/plugins/ionRangeSlider/ion.rangeSlider.css', 'css/plugins/ionRangeSlider/ion.rangeSlider.skinHTML5.css', 'js/plugins/ionRangeSlider/ion.rangeSlider.min.js']
                }]);
            }
        }
    })
    .state('logins', {
      parent: 'site',
      url: "/logins",
      templateUrl: "views/login.html",
      data: {
        roles: [],
        pageTitle: 'Login',
        specialClass: 'gray-bg'
      },
      controller: 'LoginCtrl'
    })
    .state('register', {
      url: "/register",
      templateUrl: "views/register.html",
      data: {
        pageTitle: 'Register',
        specialClass: 'gray-bg'
      },
      controller: 'LoginCtrl'
    })
}

angular.module('inspinia')
  // principal is a service that tracks the user's identity.
  // calling identity() returns a promise while it does what you need it to do
  // to look up the signed-in user's identity info. for example, it could make an
  // HTTP request to a rest endpoint which returns the user's name, roles, etc.
  // after validating an auth token in a cookie. it will only do this identity lookup
  // once, when the application first runs. you can force re-request it by calling identity(true)
  .factory('principal', ['$q', '$http', '$timeout',
    function($q, $http, $timeout) {
      var _identity = undefined,
        _authenticated = false,
        _levels = undefined,
        daterange = {data: {startDate: moment().subtract(60, "days"), endDate: moment()}};

      return {
        daterange: daterange,
        autoThreshold: {},
        docIds: [],
        isIdentityResolved: function() {
          return angular.isDefined(_identity);
        },
        isAuthenticated: function() {
          return _authenticated;
        },
        isInRole: function(role) {
          if (!_authenticated || !_identity.roles) {
            return false;
          }

          return _identity.roles.indexOf(role) != -1;
        },
        isInAnyRole: function(roles) {
          if (!_authenticated || !_identity.roles) {
            return false;
          }

          for (var i = 0; i < roles.length; i++) {
            if (this.isInRole(roles[i])) {
              return true;
            }
          }

          return false;
        },
        authenticate: function(credentials) {
          var deferred = $q.defer();
          $http.post("login", credentials).then(function (data) {
            _identity = data.identity;
            _authenticated = data.identity != null;
            deferred.resolve(data);
          });
          return deferred.promise;
        },
        register: function(credentials) {
          var deferred = $q.defer();
          $http.post("register", credentials).then(function (data) {
            _identity = data.identity;
            _authenticated = data.identity != null;
            deferred.resolve(data);
          });
          return deferred.promise;
        },
        identity: function(force) {
          var deferred = $q.defer();
          if (force === true) {
            _identity = undefined;
          }
          // check and see if we have retrieved the identity data from the server. if we have, reuse it by immediately resolving
          if (angular.isDefined(_identity)) {
            deferred.resolve(_identity);
            return deferred.promise;
          }
          // otherwise, retrieve the identity data from the server, update the identity object, and then resolve.
          $http.get('login', {
              ignoreErrors: true
            })
            .success(function(data) {
              if (data.anonymous) {
                _identity = null;
                _authenticated = false;
                deferred.resolve(_identity);
              } else {
                _identity = data;
                _authenticated = true;
                deferred.resolve(_identity);
              }
            })
            .error(function() {
              _identity = null;
              _authenticated = false;
              deferred.resolve(_identity);
            });

          return deferred.promise;
        },
        levels: function(force, selectedPageType) {
            var deferred = $q.defer();
            if (force === true) {
                _levels = undefined;
            }
            if (angular.isDefined(_levels)) {
                deferred.resolve(_levels);
                return deferred.promise;
            }
            var sDate =  daterange.data.startDate.format().substring(0, 10) + "T00:00:00Z",
                eDate  = daterange.data.endDate.format().substring(0, 10) + "T23:59:59.999Z",
                fieldPromise = $http.get('/getfields', {params: {"pageType": selectedPageType, "sDate": sDate, "eDate": eDate}}),
                pageTypesPromise = $http.get('/getpagetypes', {params: {"sDate": sDate, "eDate": eDate}}),
                docIdsPromise = $http.get('/getdocids'),
                fieldThresholdPromise = $http.get('/fieldsThresholds');
            $q.all([fieldPromise, pageTypesPromise, docIdsPromise, fieldThresholdPromise])
                .then(
                  function(results){
                    // console.log(results);
                    _levels = {};
                    _levels['fieldtype'] = ['average'];
                    _levels['pagetype'] = ['All'];
                    _levels['rowtype'] = ['All'];
                    _levels['docid'] = [];
                    for (var i in results[0]['data']) {
                      _levels['fieldtype'].push(results[0]['data'][i]['label']);
                    }
                    // _levels['fieldtype'].push('average');
                    if (results[1]['data'][0]) {
                        for (var i in results[1]['data'][0]['data']) {
                            _levels['pagetype'].push(results[1]['data'][0]['data'][i]);
                        }
                        // _levels['pagetype'] = _levels['pagetype'].concat(results[1]['data'][0]['data']);
                    }
                    if (results[2]['data'][0]) {
                       _levels['docid'] = results[2]['data'][0]['data'];
                    }
                    if (results[3]['data'][0]) {
                        _levels['fieldThreshold'] = results[3]['data'][0]['data'];
                    }

                    deferred.resolve(_levels);
                  },
                  function(errors) {
                    _levels = undefined;
                    console.log(errors);
                    deferred.reject(_levels);
                  });
            return deferred.promise;
        },
      };
    }
  ])
  // authorization service's purpose is to wrap up authorize functionality
  // it basically just checks to see if the principal is authenticated and checks the root state 
  // to see if there is a state that needs to be authorized. if so, it does a role check.
  // this is used by the state resolver to make sure when you refresh, hard navigate, or drop onto a
  // route, the app resolves your identity before it does an authorize check. after that,
  // authorize is called from $stateChangeStart to make sure the principal is allowed to change to
  // the desired state
  .factory('authorization', ['$rootScope', '$state', 'principal',
    function($rootScope, $state, principal) {
      return {
        authorize: function() {
          return principal.identity()
            .then(function() {
              var isAuthenticated = principal.isAuthenticated();
              if ($rootScope.toState.data.roles && $rootScope.toState.data.roles.length > 0 && !principal.isInAnyRole($rootScope.toState.data.roles)) {
                if (isAuthenticated) {
                  $state.go('accessdenied'); // user is signed in but not authorized for desired state
                } else {
                  // user is not authenticated. stow the state they wanted before you
                  // send them to the signin state, so you can return them when you're done
                  $rootScope.returnToState = $rootScope.toState;
                  $rootScope.returnToStateParams = $rootScope.toStateParams;

                  // now, send them to the signin state so they can log in
                  $state.go('logins');
                }
              }
            });
        }
      };
    }
  ])
  .run(['$rootScope', '$state', '$stateParams', 'authorization', 'principal',
    function($rootScope, $state, $stateParams, authorization, principal) {
      $rootScope.$on('$stateChangeStart', function(event, toState, toStateParams) {
        $rootScope.toState = toState;
        $rootScope.toStateParams = toStateParams;
        if (principal.isIdentityResolved()) {
          authorization.authorize();
        }
      });
    }
  ])
  .config(config);