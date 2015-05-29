/// <reference path="../../../typings/angularjs/angular.d.ts"/>

angular.module('starter.controllers')

.controller('AccountsCtrl', function ($scope, Transaction, $ionicLoading, $rootScope) {
  var fakeDate = new Date();
  $scope.label = '<div><img class="mfp-title" src="img/safe_white.png" />Accounts</div>';
  $scope.accountName = 'Checking';
  
  
  
  //App Analytics
  $scope.$on('$ionicView.enter', function(){
	  if(isMFP()){WL.Analytics.log({AppView: 'Accounts'}, "visit accounts view");}
  });

  loadTransactions();  
  
  function loadTransactions(){
    $ionicLoading.show({
      template: 'Loading...'
    });
    Transaction.getAll().then(function(data){
      $scope.items = data;
      $ionicLoading.hide();
      $scope.$broadcast('scroll.refreshComplete');
    });
  }
  
  $scope.doRefresh = function(){
    loadTransactions();
  };

});