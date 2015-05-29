/* global isMFP */
/// <reference path="../../../typings/angularjs/angular.d.ts"/>

angular.module('starter.controllers')

.controller('HomeCtrl', function ($scope, $ionicModal, $timeout, $rootScope) {
	$scope.label = '<div><img class="mfp-title" src="img/check_white.png" />MobileFirst Banking</div>';
	$rootScope.welcome = 'Welcome to MobileFirst Banking';
	$rootScope.totalBalanceLabel = '';
	//$scope.totalBalance = 232291.45;
  	$rootScope.totalBalance = null;
	//App Analytics
    $scope.$on('$ionicView.enter', function(){
	  if(isMFP()){
		  WL.Analytics.send();
		  WL.Logger.send();
	  }
    });
});