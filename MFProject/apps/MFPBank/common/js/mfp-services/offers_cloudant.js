angular.module('starter.services')

.factory('Coupon', function ($http, $q, Store) {
	  var tries = 0;
	  return {
	    'getAll': function(){
	      var defer = $q.defer();
	      var offersDBName = 'offersdb';
	      getAllDocs(offersDBName, null, 
	  			function(data){	
	  				defer.resolve(data);
	  			}, 
	  			function(response){
	  				defer.reject(response);
	  				logResponse(response);
	  			}
	  		);
	    
	      return defer.promise;
	    }
	  };
	  
	  function getAllDocs(db, limit, success, failure) {
			var method = "getAllDocs";
			var msg = "method: <" + method + "> called.";
			WL.Logger.debug(msg);
			var include_docs = 'true';
		    var invocationData = {
		            adapter : 'CloudantAdapter',
		            procedure : method,
		            parameters : [db, limit, include_docs]
		    };

		    var options = {
		            onSuccess : function(response){
	            		data = getDataFromResponse(response);
	            		success(data);
	            		Store.saveData(data);
		            },
		            onFailure : failure,
		            onConnectionFailure: function(){
		            	Store.getData().then(function(data){
		            		success(data);
		            	});
		            },
		    };

		    WL.Client.invokeProcedure(invocationData, options);
	  };
	  function getDataFromResponse(response){
		  var data = [];
			var rows;
			logResponse(response);
			console.log('sucess getAllOffers');
			//console.log(result);
			if(response !== null && response.responseJSON !== null && response.responseJSON.rows !== null){
				rows = response.responseJSON.rows;
				rows.forEach(function(row){
					data.push(row.doc);
				});
			}
			return data;
	  }
		
	  function logResponse(response) {
			console.log("response.status:");
			console.log(response.status);
			console.log("response.responseJSON:");
			console.log(response.responseJSON);
			console.table && console.table(response.responseJSON.resultSet);
	  }
	  
});

	
	
	
	