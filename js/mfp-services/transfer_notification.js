angular.module('starter.services')

.factory('Transfer', function ($q, $timeout, $ionicLoading, $ionicPopup) {

  return {
    'submitTransfer': function (amount) {
    	var defer = $q.defer();
		transferAmount(amount).then(
			function (response) {
				defer.resolve(response.responseJSON);
			}, function (response) {
				defer.reject(response);
			});
		//t();
		return defer.promise;
    }
  };
  
  function transferAmount(amount) {
	  var defer = $q.defer();
		var adapterName = 'PushAdapter';
		var adapterProcedure = 'processTransfer';
		var adapterPath = '/adapters/' + adapterName + '/' + adapterProcedure;
		var params = [];
		var paramCheck = amount || '';
		var resourceRequest = new WLResourceRequest(
			adapterPath,
			WLResourceRequest.GET);
		var method = 'processTransfer';
		var msg = "method: <" + method + "> called.";
		params.push(paramCheck);

		resourceRequest.setQueryParameter("params", JSON.stringify(params));
		
		//call adpater procedure with parameters
		WL.Logger.debug(msg);
		resourceRequest.send().then(function(response){
				defer.resolve(response);
		});
		return defer.promise;
		
		
	}
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  function t(){
	  $timeout(function(){
	        a("Your check is successfuly processed.");
	      }, 4000, false);
  }
  function a(msg) {
	    WL.SimpleDialog.show("Notification", msg, [ {
    	    text : 'Close',
    	    handler : function() {console.log(msg);}
    	  }]); 
   }

});




