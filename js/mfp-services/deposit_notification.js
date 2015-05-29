angular.module('starter.services')

.factory('Deposit', function ($q, $timeout, $ionicLoading, $ionicPopup) {

  return {
    'submitCheck': function (check) {
    	var defer = $q.defer();
		depositCheck(check).then(
			function (response) {
				defer.resolve(response.responseJSON);
			}, function (response) {
				defer.reject(response);
			});
		//t();
		return defer.promise;
    }
  };
  
  function depositCheck(check) {
	  var defer = $q.defer();
		var adapterName = 'PushAdapter';
		var adapterProcedure = 'processCheck';
		var adapterPath = '/adapters/' + adapterName + '/' + adapterProcedure;
		var params = [];
		var paramCheck = check || '';
		var resourceRequest = new WLResourceRequest(
			adapterPath,
			WLResourceRequest.GET);
		var method = 'processCheck';
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




