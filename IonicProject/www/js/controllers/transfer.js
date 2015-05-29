/// <reference path="../../../typings/angularjs/angular.d.ts"/>

angular.module('starter.controllers')

.controller('TransferCtrl', function ($scope, $ionicPopup, $ionicHistory, $state, $ionicViewSwitcher, Transfer) {

  $scope.label = '<div><img class="mfp-title" src="img/transfer_white.png" />Transfer</div>';
  //$scope.amount = 10;
  var _amount = 10;
  $scope.transfer = {
    amount: function(newAmount) {
      if (angular.isDefined(newAmount)) {
        _amount = newAmount;
      }
      return _amount;
    }
  };
  
  $scope.$on('$ionicView.enter', function(){
	  if(isMFP()){WL.Analytics.log({AppView: 'Transfer'}, "visit transfer");}
  });
  
  $scope.showConfirm = function() {
   var confirmPopup = $ionicPopup.confirm({
     title: 'Transfer',
     template: 'Are you sure you want to transfer $'+$scope.transfer.amount()+ ' funds?'
   });
   confirmPopup.then(function(res) {
     if(res) {
       console.log('You are sure to transfer $'+$scope.transfer.amount());
       $ionicHistory.nextViewOptions({
        //disableAnimate: true,
        disableBack: true,
        historyRoot: true
      });
      $ionicViewSwitcher.nextDirection('back');
      $state.go('app.home');
      Transfer.submitTransfer($scope.transfer.amount());
     } else {
       console.log('You are not sure');
     }
   });
 };
  
});