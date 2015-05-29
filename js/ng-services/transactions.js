angular.module('starter.services')

.factory('Transaction', function ($http, $q, $timeout, $rootScope) {
  
  return {
    'getAll': function(){
      var defer = $q.defer();
    
      $http.get('data/transactions.json').
      success(function(data, status, headers, config) {
        // this callback will be called asynchronously
        // when the response is available
        $timeout(function(){
           defer.resolve(data);
              $rootScope.welcome = 'Hello, John Smith';
              $rootScope.totalBalanceLabel = 'Total Balance:';
              $rootScope.totalBalance = 232291.45;
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