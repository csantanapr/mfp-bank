/// <reference path="../../../typings/angularjs/angular.d.ts"/>

angular.module('starter.controllers')

.controller('DepositCtrl', function ($scope, $q, $ionicPopup, $ionicHistory, $state, $ionicViewSwitcher, Camera, Deposit) {
  $scope.label = '<div><img class="mfp-title" src="img/check_white.png" />Deposit</div>';
  
  $scope.$on('$ionicView.enter', function(){
    $scope.frontPhoto = 'img/camera_button.png';
    $scope.backPhoto = 'img/camera_button.png';
    if(isMFP()){WL.Analytics.log({AppView: 'Check Deposit'}, "visit check deposit");}
  });

  
  $scope.getFrontPhoto = function(){
      Camera.getPicture().then(function(imageURI) {
        $scope.frontPhoto = imageURI;
      });
  };
  
  $scope.getBackPhoto = function(){
      Camera.getPicture().then(function(imageURI) {
        $scope.backPhoto = imageURI;
      });
  };
  
  $scope.showAlert = function() {
   var alertPopup = $ionicPopup.alert({
     title: 'Uploading',
     template: 'Your check photos will be uploaded to the server'
   });
   alertPopup.then(function(res) {
     console.log('Thank you sending check photos now');
     $ionicHistory.nextViewOptions({
        //disableAnimate: true,
        disableBack: true,
        historyRoot: true
      });
      $ionicViewSwitcher.nextDirection('back');
      $state.go('app.home');
     Deposit.submitCheck();
   });
 };
  
});