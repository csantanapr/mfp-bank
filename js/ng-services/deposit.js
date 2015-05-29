angular.module('starter.services')

.factory('Deposit', function ($q, $timeout, $ionicLoading, $ionicPopup) {
  
  function showToast(msg){
    $ionicLoading.show({
      template: msg,
      duration: 2000,
      noBackdrop: true
    });
  }
  return {
    'submitCheck': function () {
      var defer = $q.defer();
      
      $timeout(function(){
    	  showToast("Your check is successfuly processed.");
        defer.resolve();
      }, 2000, false);
      
      return defer.promise;
    }
  };

});