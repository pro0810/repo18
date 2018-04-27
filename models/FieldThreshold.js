var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var NewDocument = new Schema({
    data: Schema.Types.Mixed
});
module.exports = mongoose.model('field_threshold', NewDocument);