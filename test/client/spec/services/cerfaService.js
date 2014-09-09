'use strict';

/* global _ */

describe('Service: cerfaService', function () {

    beforeEach(function() {
        module('ddsApp');
    });

    var createService = function() {
        var service;
        inject(function(CerfaService) {
            service = CerfaService;
        });

        return service;
    };

    describe('function getCerfaFormsFromDroit()', function() {
        it('should return an empty array if no forms are available for the given droit', function() {
            // given
            module(function($provide) {
                $provide.constant('cerfaForms', [{ droitId: 'test', forms: [] }]);
            });
            var service = createService();

            // when
            var forms = service.getCerfaFormsFromDroit('test');

            // then
            expect(forms).toEqual([]);
        });

        it('should return forms that are not conditionnaly showed', function() {
            // given
            var form = {};
            module(function($provide) {
                $provide.constant('cerfaForms', [{ droitId: 'test', forms: [form] }]);
            });
            var service = createService();

            // when
            var forms = service.getCerfaFormsFromDroit('test');

            // then
            expect(forms).toEqual([form]);
        });

        it('should not return forms which show callbacks return false', function() {
            // given
            var form = {id: 'cmuc_choix_organisme_non_demandeur'};
            module(function($provide) {
                $provide.constant('cerfaForms', [{ droitId: 'cmu_c', forms: [form] }]);
            });
            var service = createService();

            // when
            var forms = service.getCerfaFormsFromDroit('cmu_c', {demandeur: {}, enfants: [], personnesACharge: []});

            // then
            expect(forms).toEqual([]);
        });

        it('should return forms which show callbacks return true', function() {
            // given
            var form = {id: 'cmuc_choix_organisme_non_demandeur'};
            module(function($provide) {
                $provide.constant('cerfaForms', [{ droitId: 'cmu_c', forms: [form] }]);
            });
            var service = createService();

            // when
            var forms = service.getCerfaFormsFromDroit('cmu_c', {demandeur: {}, conjoint: {}, enfants: [], personnesACharge: []});

            // then
            expect(forms).toEqual([form]);
        });
    });

    describe('pieces justificatives', function() {
        var service;

        beforeEach(function() {
            service = createService();
        });

        describe('function isPieceJustificativeRequiredForSituation()', function() {
            it('should ask livret famille for cmu-c only if situation has personnes à charge', function() {
                // given
                var situations = [
                    {enfants: [{}], personnesACharge: []},
                    {enfants: [], personnesACharge: [{}]},
                    {enfants: [], personnesACharge: []}
                ];

                // when
                var result = _.filter(situations, function(situation) {
                    return service.isPieceJustificativeRequiredForSituation('cmu_c', 'livret_famille', situation);
                });

                // then
                expect(result).toEqual(_.initial(situations));
            });

            it('should ask taxe foncière for cmu-c only if demandeur is propriétaire', function() {
                // given
                var situations = [
                    {logement: {type: 'proprietaire'}},
                    {logement: {type: 'colocataire'}},
                    {logement: {type: 'locataire'}}
                ];

                // when
                var result = _.filter(situations, function(situation) {
                    return service.isPieceJustificativeRequiredForSituation('cmu_c', 'taxe_fonciere', situation);
                });

                // then
                expect(result).toEqual([situations[0]]);
            });

            it('should ask taxe habitation for cmu-c only if demandeur is locataire or colocataire', function() {
                // given
                var situations = [
                    {logement: {type: 'colocataire'}},
                    {logement: {type: 'locataire'}},
                    {logement: {type: 'proprietaire'}}
                ];

                // when
                var result = _.filter(situations, function(situation) {
                    return service.isPieceJustificativeRequiredForSituation('cmu_c', 'taxe_habitation', situation);
                });

                // then
                expect(result).toEqual(_.initial(situations));
            });

            it('should ask declaration de grossesse for rsa if menage is enceinte', function() {
                // given
                var situations = [
                    {demandeur: {enceinte: true}},
                    {demandeur: {}}
                ];

                // when
                var result = _.filter(situations, function(situation) {
                    return service.isPieceJustificativeRequiredForSituation('rsa', 'declaration_grossesse', situation);
                });

                // then
                expect(result).toEqual([situations[0]]);
            });
        });

        describe('function pieceJustificativeIndividus()', function() {
            describe('cmuc', function() {
                it('sould ask carte vitale for everybody', function() {
                    // given
                    var individus = [{role: 'demandeur'}, {role: 'conjoint'}, {role: 'enfant'}, {role: 'personneACharge'}];

                    // when
                    var result = service.pieceJustificativeIndividus('cmu_c', 'vitale', individus);

                    // then
                    expect(result).toEqual(individus);
                });

                it('should ask piece d\'identité for french and EEE people', function() {
                    // given
                    var individus = [
                        {nationalite: 'fr', role: 'demandeur'},
                        {nationalite: 'ue', role: 'conjonint'},
                        {nationalite: 'autre', role: 'demandeur'}
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('cmu_c', 'identite', individus);

                    // then
                    expect(result).toEqual(_.initial(individus));
                });

                it('should ask titre de séjour for non-french people', function() {
                    // given
                    var individus = [{nationalite: 'ue'}, {nationalite: 'autre'}, {nationalite: 'fr'}];

                    // when
                    var result = service.pieceJustificativeIndividus('cmu_c', 'regularite', individus);

                    // then
                    expect(result).toEqual(_.initial(individus));
                });

                it('should ask avis d\'imposition ou non-imposition for individus aged > 16', function() {
                    // given
                    var individus = [{birthDate: '14/08/1989'}, {birthDate: '14/09/2014'}];

                    // when
                    var result = service.pieceJustificativeIndividus('cmu_c', 'imposition', individus);

                    // then
                    expect(result).toEqual([individus[0]]);
                });

                // TODO Tester uniquement sur revenus salariés déclarés pendant l'année glissante
                it('should ask bulletins de paie for individus aged > 16 having revenus salaries', function() {
                    // given
                    var individus = [
                        {birthDate: '14/08/1989', ressources: [{type: 'revenusSalarie'}]},
                        // not kept because aged < 16
                        {birthDate: '14/09/2014', ressources: [{type: 'revenusSalarie'}]},
                        // not kept because no revenus salarie
                        {birthDate: '14/08/1989'},
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('cmu_c', 'bulletins_paie', individus);

                    // then
                    expect(result).toEqual([individus[0]]);
                });

                it('should ask attestations indemnités chômage for people aged > 16', function() {
                    // given
                    var individus = [
                        {birthDate: '14/08/1989', ressources: [{type: 'allocationsChomage'}]},
                        {birthDate: '14/08/1989', ressources: [{type: 'indChomagePartiel'}]},
                        // not kept because aged > 16
                        {birthDate: '14/08/2014', ressources: [{type: 'allocationsChomage'}]}
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('cmu_c', 'attestation_indemnites_chomage', individus);

                    // then
                    expect(result).toEqual(_.initial(individus));
                });
            });

            describe('rsa', function() {
                it('should ask piece d\'identite for fr or ue parents or children born in France', function() {
                    // given
                    var individus = [
                        {nationalite: 'fr', role: 'demandeur'},
                        {nationalite: 'ue', role: 'conjoint'},
                        {paysNaissance: 'France', role: 'enfant'},
                        {paysNaissance: 'France', role: 'personneACharge'},
                        // not kept because nationalite autre
                        {nationalite: 'autre', role: 'conjoint'},
                        // not kept because not born in France
                        {paysNaissance: 'Congo', role: 'enfant'}
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'identite', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 2));
                });

                it('should ask acte de naissance for personnes à charge aged < 18 born in france but not french', function() {
                    // given
                    var individus = [
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'France', role: 'enfant'},
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'France', role: 'personneACharge'},
                        // not kept because not personne à charge
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'France', role: 'demandeur'},
                        // not kept because aged > 18
                        {birthDate: '14/08/1980', nationalite: 'ue', paysNaissance: 'France', role: 'demandeur'},
                        // not kept because nationalite fr
                        {birthDate: '14/08/2014', nationalite: 'fr', paysNaissance: 'France', role: 'enfant'},
                        // not kept because not born in france
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'Congo', role: 'personneACharge'},
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'acte_naissance', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 4));
                });

                it('should ask certificat OFII if aged < 18 and foreigner', function() {
                    // given
                    var individus = [
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'Malaisie', role: 'enfant'},
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'Congo', role: 'personneACharge'},
                        // not kept because not personne à charge
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'France', role: 'demandeur'},
                        // not kept because aged > 18
                        {birthDate: '14/08/1980', nationalite: 'ue', paysNaissance: 'France', role: 'demandeur'},
                        // not kept because nationalite fr
                        {birthDate: '14/08/2014', nationalite: 'fr', paysNaissance: 'France', role: 'enfant'},
                        // not kept because born in france
                        {birthDate: '14/08/2014', nationalite: 'ue', paysNaissance: 'France', role: 'personneACharge'},
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'ofii', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 4));
                });

                it('should ask titre de séjour for parents with nationalité not EEE, and for children aged > 18 and foreigner', function() {
                    // given
                    var individus = [
                        {nationalite: 'autre', paysNaissance: 'Malaisie', role: 'demandeur'},
                        {nationalite: 'autre', paysNaissance: 'Congo', role: 'conjoint'},
                        {birthDate: '14/08/1980', nationalite: 'autre', paysNaissance: 'Congo', role: 'enfant'},
                        // not kept because child < 18
                        {birthDate: '14/08/2014', nationalite: 'autre', paysNaissance: 'Congo', role: 'enfant'},
                        // not kept because nationalite eee
                        {nationalite: 'ue', role: 'demandeur'},
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'titre_sejour', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 2));
                });

                it('should ask avis paiement pension invalidité when required', function() {
                    // given
                    var individus = [
                        {role: 'demandeur', ressources: [{type: 'pensionsInvalidite'}]},
                        {role: 'demandeur', ressources: [{type: 'pensionsInvalidite'}]},
                        // not kept because not parent
                        {role: 'enfant', ressources: [{type: 'pensionsInvalidite'}]},
                        // not kept because no pension
                        {role: 'demandeur'}
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'avis_paiement_pension_invalidite', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 2));
                });

                it('should ask avis paiement retraite when required', function() {
                    // given
                    var individus = [
                        {role: 'demandeur', situationsPro: [{situation: 'retraite'}]},
                        {role: 'conjoint', situationsPro: [{situation: 'retraite'}]},
                        // not kept because not retraite
                        {role: 'conjoint'},
                        // not kept because not parent
                        {role: 'enfant', situationsPro: [{situation: 'retraite'}]}
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'avis_paiement_retraite', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 2));
                });

                it('should ask avis paiement indemnite accident travail when required', function() {
                    // given
                    var individus = [
                        {role: 'demandeur', ressources: [{type: 'indJourAccidentDuTravail'}]},
                        {role: 'demandeur', ressources: [{type: 'indJourAccidentDuTravail'}]},
                        // not kept because not parent
                        {role: 'enfant', ressources: [{type: 'indJourAccidentDuTravail'}]},
                        // not kept because no indemnite
                        {role: 'demandeur'}
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'avis_paiement_rente_accident_travail', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 2));
                });

                it('should ask declaration de revenus year-1 for travailleurs saisonniers', function() {
                    // given
                    var individus = [
                        {role: 'demandeur', situationsPro: [{situation: 'travailleur_saisonnier'}]},
                        {role: 'conjoint', situationsPro: [{situation: 'travailleur_saisonnier'}]},
                        // not kept because not travailleur saisonnier
                        {role: 'conjoint'},
                        // not kept because not parent
                        {role: 'enfant', situationsPro: [{situation: 'travailleur_saisonnier'}]}
                    ];

                    // when
                    var result = service.pieceJustificativeIndividus('rsa', 'declaration_revenus_saisonnier', individus);

                    // then
                    expect(result).toEqual(_.initial(individus, 2));
                });
            });
        });
    });
});
