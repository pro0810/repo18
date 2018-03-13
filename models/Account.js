var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    passportLocalMongoose = require('passport-local-mongoose');

var Account = new Schema({
    username: String,
    password: String,
    domain: String,
    upload: {
        url: String,
        user: String,
        password: String
    }
});

Account.plugin(passportLocalMongoose);

module.exports = mongoose.model('Account', Account);
