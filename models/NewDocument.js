var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var NewDocument = new Schema({
    id: String,
    domain: String,
    subdomain: String,
    path: String,
    timings: {
        receive: Date,
        start: Date,
        done: Date,
        feedback: Date
    },
    data: Schema.Types.Mixed,
    feedback: Schema.Types.Mixed
});



module.exports = mongoose.model('documents_new', NewDocument);