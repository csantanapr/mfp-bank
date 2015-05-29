angular.module('starter.services')

.factory('Coupon', function ($http, $q, $timeout) {
  
  return {
    'getAll': function(){
      var defer = $q.defer();
    
      $http.get('data/coupons.json').
      success(function(data, status, headers, config) {
        // this callback will be called asynchronously
        // when the response is available
        $timeout(function(){
           defer.resolve(data);
        },300);
       
      }).
      error(function(data, status, headers, config) {
        // called asynchronously if an error occurs
        // or server returns response with an error status.
        defer.reject(data);
      });
    
      return defer.promise;
    }
  };
  
  
});