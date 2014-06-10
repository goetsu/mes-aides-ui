var express = require('express');
var mongoose = require('mongoose');
var _ = require('lodash');
var openfisca = require('./lib/simulation/openfisca');
var moment = require('moment');
var Individu = require('./lib/situation').Individu;
var expand = require('./lib/situation').expand;
var flatten = require('./lib/situation').flatten;
var SituationModel = require('./lib/models/situation');

moment.lang('fr');

mongoose.connect(process.env.MONGODB_URL || process.env.MONGOHQ_URL);

var app = express();

app.locals.moment = moment;

app.use(express.favicon('public/img/favicon.ico'));
app.use(express.static('public'));
app.use('/js', express.static('dist'));
app.use(express.static('app'));
app.use(express.logger('dev'));
app.use(express.json());

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.get('/api/situations/:situationId', function(req, res, next) {
    SituationModel.findById(req.params.situationId, function(err, situation) {
        if (err) return next(err);
        if (!situation) return res.send(404);
        res.send(situation);
    });
});

app.put('/api/situations/:situationId', function(req, res, next) {
    SituationModel.findByIdAndUpdate(req.params.situationId, _.extend({ _updated: Date.now() }, _.omit(req.body, '_id')), { upsert: true }, function(err, situation) {
        if (err) return next(err);
        if (!situation) return res.send(400);
        res.send(situation);
    });
});

app.get('/api/situations/:situationId/simulation', function(req, res, next) {
    SituationModel.findById(req.params.situationId).lean().exec(function(err, situation) {
        if (err) return next(err);
        if (!situation) return res.send(404);
        openfisca.simulate(expand(situation), function(err, result) {
            if (err) next(err);
            res.send(result);
        });
    });
});

app.get('/api/situations/:situationId/openfisca-response', function(req, res, next) {
    SituationModel.findById(req.params.situationId).lean().exec(function(err, situation) {
        if (err) return next(err);
        if (!situation) return res.send(404);
        openfisca.calculate(expand(situation), function(err, result) {
            if (err) next(err);
            res.send(result);
        });
    });
});

app.get('/api/situations/:situationId/openfisca-request', function(req, res, next) {
    SituationModel.findById(req.params.situationId).lean().exec(function(err, situation) {
        if (err) return next(err);
        if (!situation) return res.send(404);
        res.send(openfisca.buildRequest(expand(situation)));
    });
});

function renderIndex(req, res) {
    res.render('index');
}

app.get('/s/:situationCode', renderIndex);
app.get('/s/:situationCode/*', renderIndex);

app.get('/', function(req, res, next) {
    var demandeur = new Individu();
    demandeur.ajouteLogement();
    SituationModel.create(flatten(demandeur), function(err, situation) {
        if (err) return next(err);
        res.redirect('/s/' + situation.id);
    });
});

app.listen(process.env.PORT || 5000);
