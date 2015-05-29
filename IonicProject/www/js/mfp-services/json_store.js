angular.module('starter.services')

.factory('Store', function ($http, $q, $timeout) {
	  
	var collectionName = 'offers';
	 
	var collections = {
		 offers : {
		    searchFields: {id: 'string'}
		  }
		};
    
	WL.JSONStore.init(collections).then(function (collections) {
		  console.log('offers store init sucess');
		}).fail(function (error) {
		  console.error('offers store init failed',error);
		});
	 
	return {
	    'saveData': function(data){
	      data.forEach(function(offer){
	    	  findOffer(offer);
	      });
	      return data;
	    },
	    'getData': function(){
	    	var defer = $q.defer();
		      
		      WL.JSONStore.get(collectionName).findAll().then(function (results) {
		    	  // handle success - results (array of documents found)
		    	  defer.resolve(results.map(function(result){
		    		  return {
		    			  description: result.json.description,
		  				  imageUrl: result.json.imageUrl,
		  				  title: result.json.title,
		  				  _id: result.json.id
		    		  };
		    	  }));
		    	}).fail(function (error) {
		    	  defer.reject(error);
		      });
		   return defer.promise;
	    }
	};
	
	function findOffer(offer){
		var query = {id: offer._id};
		var options = {
		  exact: true, 
		  limit: 1 
		};
		WL.JSONStore.get(collectionName).find(query, options).then(function (results) {
		  // handle success - results (array of documents found)
			if(results.length == 0){
				//add new offer to store
				saveOffer(offer);
			}
		}).fail(function (error) {
			console.error(error);
		});
	}
	function saveOffer(offer){
		var options = {};	 
		var data = {
				description: offer.description,
				imageUrl: offer.imageUrl,
				title: offer.title,
				id:offer._id,
		};
		WL.JSONStore.get(collectionName).add(data, options).then(function () {
		 // handle success
			console.log('succesfully added offer',data);
		}).fail(function (error) {
		    console.error(error);
		});
	}
	
	
});

	
	
	
	