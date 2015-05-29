angular.module('starter.services')

.factory('Transaction', function ($http, $q, $timeout) {

	return {
		'getAll': function (accountId) {
			var defer = $q.defer();
			getTransactions(accountId).then(
				function (response) {
					defer.resolve(response.responseJSON.resultSet);
					logResponse(response);
				}, function (response) {
					defer.reject(response);
					logResponse(response);
				});
			return defer.promise;
		}
	};

	function getTransactions(accountId) {
		var adapterName = 'SQLBank';
		var adapterProcedure = 'getAccountTransactions';
		var adapterPath = '/adapters/' + adapterName + '/' + adapterProcedure;
		var params = [];
		var paramAccountId = accountId || '12345';
		var resourceRequest = new WLResourceRequest(
			adapterPath,
			WLResourceRequest.GET);
		var method = 'getTransactions';
		var msg = "method: <" + method + "> called.";
		params.push(paramAccountId);

		resourceRequest.setQueryParameter("params", JSON.stringify(params));
		
		//call adpater procedure with parameters
		WL.Logger.debug(msg);
		return resourceRequest.send();
	}

	function logResponse(response) {
		console.log("response.status:");
		console.log(response.status);
		console.log("response.responseJSON:");
		console.log(response.responseJSON);
		console.table && console.table(response.responseJSON.resultSet);
	}


});