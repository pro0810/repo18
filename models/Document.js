var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var Document = new Schema({
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

Document.statics.redactForUser = function(user, cb) {
  if (user === undefined || user.domain === undefined) {
    return [];
  }
  return this.aggregate([{
    $redact: {
      $cond: {
        if: {
          $and: [{
            $eq: ["$domain", user.domain]
          }, {
            $gt: ["$subdomain", null]
          }]
        },
        then: "$$KEEP",
        else: "$$PRUNE"
      }
    }
  }, {
    $project: {
      _id: false
    }
  }], cb);
};

module.exports = mongoose.model('document', Document);