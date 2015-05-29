angular.module('starter.services')

.factory('Camera', function ($q) {

  return {
    'getPicture': function (options) {
      var defer = $q.defer();
      var result = 'img/check-front.png';
      defer.resolve(result);
      return defer.promise;
    }
  };

});