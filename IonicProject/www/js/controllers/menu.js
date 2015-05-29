/// <reference path="../../../typings/angularjs/angular.d.ts"/>

angular.module('starter.controllers')

.controller('MenuCtrl', function ($scope) {
  $scope.label = 'Menu';
  
  
  $scope.clearStore = function() {
	  WL.JSONStore.destroy().then(function () {
		  console.log('store cleared success');
		}).fail(function (error) {
			console.log('store cleared failed');
		});
  };
  $scope.sendFeedBack = function(){
	  if(typeof sendFeedBack === 'function'){
      sendFeedBack();
    }
  };
  $scope.sendBug = function(){
    if(typeof sendBug === 'function'){
      sendBug();
    }
  };
});