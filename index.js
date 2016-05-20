
var rdf = require('rdf-ext')
var inherits = require('inherits')
var AbstractSerializer = require('rdf-serializer-abstract')

var xml = require('xml')

var uniq = require('uniq')

function XMLSerializer() {
    AbstractSerializer.call(this, rdf)
}

inherits(XMLSerializer, AbstractSerializer)

function serializeXML(graph, done) {

    function serialize(resolve) {

        var prefixes = Object.create(null)

        Object.keys(rdf.prefixes).forEach(function(prefix) {
            prefixes[prefix] = rdf.prefixes[prefix]
        })

        var subjectNodes = Object.create(null)

        graph.forEach(serializeTriple)

        function serializeTriple(triple) {

            if(triple.subject.interfaceName !== 'NamedNode')
                throw new Error('triple subject must be a NamedNode')

            var subject = triple.subject.nominalValue

            var subjectNode = subjectNodes[subject]

            if(subjectNode === undefined)
                subjectNode = subjectNodes[subject] = []

            if(triple.predicate.interfaceName !== 'NamedNode')
                throw new Error('predicate must be a NamedNode')

            var predicate = triple.predicate.nominalValue

            subjectNode.push({
                [prefixify(predicate, true)]: serializeObject(triple.object)
            })
        }

        function serializeObject(object) {

            switch(object.interfaceName) {

                case 'NamedNode':
                    return {
                        _attr: {
                            'rdf:resource': object.nominalValue
                        }
                    }

                case 'Literal':

                    if(object.datatype.interfaceName !== 'NamedNode')
                        throw new Error('datatype must be a NamedNode')

                    var attr = {}

                    if(object.language)
                        attr['xml:lang'] = object.language

                    if(object.datatype.nominalValue !== 'http://www.w3.org/2001/XMLSchema#string')
                        attr['rdfs:Datatype'] = prefixify(object.datatype.nominalValue, false)

                    return [
                        { _attr: attr },
                        object.nominalValue
                    ]
                    
                default:
                    throw new Error('unknown node type: ' + object.interfaceName)

            }

        }

        function prefixify(iri, createNew) {

            for(var prefix in prefixes) {

                var prefixIRI = prefixes[prefix]

                if(iri.indexOf(prefixIRI) === 0) {
                    return prefix + ':' + iri.slice(prefixIRI.length)
                }
            }

            if(!createNew)
                return iri

            var fragmentStart = iri.lastIndexOf('#')

            if(fragmentStart === -1)
                fragmentStart = iri.lastIndexOf('/')

            if(fragmentStart === -1)
                return iri

            var iriPrefix = iri.substr(0, fragmentStart + 1)

            for(var i = 0 ;; ++ i) {

                var prefixName = 'ns' + i

                if(prefixes[prefixName] === undefined) {

                    prefixes[prefixName] = iriPrefix
                    return prefixName + ':' + iri.slice(iriPrefix.length)
                }
            }
        }

        var attr = {}

        for(var prefix in prefixes)
            attr['xmlns:' + prefix] = prefixes[prefix]

        var xmlDoc = xml({
            'rdf:RDF': [ { _attr: attr } ].concat(
                Object.keys(subjectNodes)
                    .map(function(subject) {
                        return {
                            'rdf:Description': [
                                {
                                    _attr: {
                                        'rdf:about': subject
                                    }
                                }
                            ].concat(subjectNodes[subject])
                        }
                    })
            )
        }, {
            declaration: true,
            indent: '  '
        })

        if(done)
            done(null, xmlDoc)

        resolve(xmlDoc)
    }

    return new Promise(serialize)
}

XMLSerializer.prototype.serialize = serializeXML

var instance = new XMLSerializer()

for (var property in instance) {
  XMLSerializer[property] = instance[property]
}

module.exports = XMLSerializer



