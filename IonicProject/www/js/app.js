/* global WL */
/* global StatusBar */
/// <reference path="../../typings/cordova/cordova.d.ts"/>
/// <reference path="../../typings/angularjs/angular.d.ts"/>
// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'starter.controllers', 'starter.services'])

  .run(function ($ionicPlatform) {
  $ionicPlatform.ready(function () {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
  });
})

  .config(function ($stateProvider, $urlRouterProvider) {
  $stateProvider

    .state('app', {
    url: '/app',
    abstract: true,
    templateUrl: 'templates/menu.html',
    controller: 'MenuCtrl'
  })
  
    .state('app.home', {
    url: '/home',
    views: {
      'menuContent': {
        templateUrl: 'templates/home.html',
        controller: 'HomeCtrl'
      }
    }
  })
  
    .state('app.accounts', {
    url: '/accounts',
    views: {
      'menuContent': {
        templateUrl: 'templates/accounts.html',
        controller: 'AccountsCtrl'
      }
    }
  })
  
    .state('app.transfer', {
    url: '/transfer',
    views: {
      'menuContent': {
        templateUrl: 'templates/transfer.html',
        controller: 'TransferCtrl'
      }
    }
  })

    .state('app.deposit', {
    url: '/deposit',
    views: {
      'menuContent': {
        templateUrl: 'templates/deposit.html',
        controller: 'DepositCtrl'
      }
    }
  })

    .state('app.offers', {
    url: '/offers',
    views: {
      'menuContent': {
        templateUrl: 'templates/offers.html',
        controller: 'OffersCtrl'
      }
    }
  });
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/home');
});

//Define starter.controllers, later define controllers in separate js files
angular.module('starter.controllers', []);

//Define starter.services, later define services in separate js files
angular.module('starter.services', []);
