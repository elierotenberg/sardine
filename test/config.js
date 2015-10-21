var assert = require('assert');
var config = require('../lib/config.jsx');
var errors = require('../lib/errors.jsx');

describe('Config', function() {
  describe('#checkKeys()', function() {
    it('should return an error when a requested key is missing', function() {
      try {
        config.checkKeys({'foo': true, 'bar': true, 'baz': true}, ['buz', 'boz']);
      } catch(e) {
        console.log(e.message)
      }


      assert.throws(function() {
        config.checkKeys({'foo': true, 'bar': true, 'baz': true}, ['buz', 'boz']);
      }, errors.UndefinedConfiguration);
    });
  });
});
