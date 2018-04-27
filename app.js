var express = require('express');
var session = require('express-session');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(session);

// Use native Node promises
// mongoose.Promise = global.Promise;

// connect to MongoDB
mongoose.Promise = require('bluebird');
function connectToMongo() {
  var credentials;
  try {
    credentials = require(path.join('./credentials.json'))
  } catch (err) {
    console.error('Please create a credentials.json file in your home directory with connection details for MongoDB')
    credentials = {
      'protocol': 'mongodb',
      'username': '',
      'password': '',
      'database': 'cf',
      'url': 'localhost',
      'port': '27017',
    }
  }
  mongoose.connection.on('connected', function() {
    console.log('Connection to Mongo established.')
  });
  mongoose.connection.on('disconnected', function() {
    console.log('Connection to Mongo closed.')
  });
  mongoose.connect(credentials.protocol + '://' + credentials.url + ':' + credentials.port + '/' + credentials.database + '?authSource=admin');
}

connectToMongo();
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'beep boop beep, beep boop boop',
  cookie: {
    secure: false
  },
  resave: false,
  saveUninitialized: true,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(passport.initialize());
app.use(passport.session());

// passport config
var Account = require('./models/Account.js');
passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

function isAuthenticated() {
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    res.status(401).end();
  }
}

app.use(function(req, res, next) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
  res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
  res.setHeader("Expires", "0"); // Proxies.
  next()
});

require('./routes/accounts.js')(app);
app.use(isAuthenticated());

// routes
require('./routes/stats.js')(app);
require('./routes/newstats.js')(app);
require('./routes/thresholds.js')(app);
require('./routes/activity.js')(app);
require('./routes/upload.js')(app);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
