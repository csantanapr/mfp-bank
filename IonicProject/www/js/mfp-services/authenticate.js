angular.module('starter.services')

.run(function($rootScope, $ionicModal, $ionicLoading, $rootScope) {

			//MobileFirst Authentication setup
			var realmName;
			var LoginChallenge;

			realmName = 'SampleAppRealm';
			LoginChallenge = WL.Client.createChallengeHandler(realmName);
			LoginChallenge.isCustomResponse = function(response) {
				if (!response || response.responseText === null) {
					console.log('exe LoginChallenge.isCustomResponse  false');
					return false;
				}
				var indicatorIdx = response.responseText
						.search('j_security_check');

				if (indicatorIdx >= 0) {
					return true;
				}
				return false;
			};
			LoginChallenge.submitLoginFormCallback = function(response) {
				var isLoginFormResponse = LoginChallenge
						.isCustomResponse(response);
				if (isLoginFormResponse) {
					LoginChallenge.handleChallenge(response);
				} else {
					LoginChallenge.submitSuccess();
				}
			};
			LoginChallenge.handleChallenge = function(response) {
				$rootScope.login();
			};
			$rootScope.doLogin = function() {
				var reqURL = '/j_security_check';
				var options = {};
				options.parameters = {
					j_username : $rootScope.loginData.username,
					j_password : $rootScope.loginData.password
				};
				options.headers = {};
				console.log('Submitting LoginData', $rootScope.loginData.username);
				LoginChallenge.submitLoginForm(reqURL, options,
						LoginChallenge.submitLoginFormCallback);
				$rootScope.closeLogin();
				//not implemented yet to get name, and balance from sql db
				$rootScope.welcome = 'Hello, Carlos Santana';
        		$rootScope.totalBalanceLabel = 'Total Balance:';
        		$rootScope.totalBalance = 44500.99;
				//send logs to analytics server
				WL.Logger.send();
			};
			$rootScope.doLogout = function() {
				WL.Client.logout(realmName);
			}

			$rootScope.loginData = {};
			// Create the login modal that we will use later
			$ionicModal.fromTemplateUrl('templates/login.html', {
				scope : $rootScope
			}).then(function(modal) {
				$rootScope.modal = modal;
			});

			// Triggered in the login modal to close it
			$rootScope.closeLogin = function() {
				$rootScope.modal.hide();
			};

			// Open the login modal
			$rootScope.login = function() {
				$ionicLoading.hide();
				$rootScope.modal.show();
			};

});