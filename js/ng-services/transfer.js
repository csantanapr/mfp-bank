angular.module('starter.services')

.factory('Transfer', function ($q, $timeout, $ionicLoading, $ionicPopup) {
  
  function showToast(msg){
    $ionicLoading.show({
      template: msg,
      duration: 2000,
      noBackdrop: true
    });
  }
  return {
    'submitTransfer': function () {
      var defer = $q.defer();
      
      $timeout(function(){
    	  showToast("Transfer is successfuly processed.");
        defer.resolve();
      }, 2000, false);
      
      return defer.promise;
    }
  };

});