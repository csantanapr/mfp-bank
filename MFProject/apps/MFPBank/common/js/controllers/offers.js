/// <reference path="../../../typings/angularjs/angular.d.ts"/>

angular.module('starter.controllers')

.controller('OffersCtrl', function ($scope, Coupon, $ionicLoading) {
  $scope.label = '<div><img class="mfp-title" src="img/offers_white.png" />Offers</div>';
  $scope.$on('$ionicView.enter', function(){
	  if(isMFP()){WL.Analytics.log({AppView: 'Offers'}, "visit offers");}
  });

  loadTransactions();  
  
  function loadTransactions(){
    $ionicLoading.show({
      template: 'Loading...'
    });
    Coupon.getAll().then(function(data){
      $scope.items = data;
      $ionicLoading.hide();
      $scope.$broadcast('scroll.refreshComplete');
    });
  }
  
  $scope.doRefresh = function(){
    loadTransactions();
  };
  
  
});