var Document = require('../models/FieldThreshold');
var fs = require('fs');

module.exports = function(app) {
    app.post('/fieldsThresholds', function(req, res){
        var fieldThresholds =  req.body.fieldsThresholds;
        console.log(fieldThresholds);
        try {
            fs.writeFile('fieldThresholds.json', JSON.stringify(fieldThresholds), 'utf-8', function(err) {
                    if (err) {
                        console.log("error on writing fieldsThresholds file: " + err);
                    }
                });
        } catch (err) {
            console.log("error on writing fieldsThresholds file: " + err);
        }

        Document.update(
            {},
            {data: fieldThresholds},
            {
                upsert: true,
                overwrite: true,
            },
            function() {
                res.status(200).send('success');
            }
        );
    });

    app.get('/fieldsThresholds', function (req, res) {
        Document.find({}, function(err, counts) {
            if (! err) {
                console.log(err);
                console.log(counts);
                res.status(200).send(counts);
            }
        });
    });
};

