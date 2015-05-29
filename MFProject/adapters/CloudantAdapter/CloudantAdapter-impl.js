/*
 *
    COPYRIGHT LICENSE: This information contains sample code provided in source code form. You may copy, modify, and distribute
    these sample programs in any form without payment to IBM® for the purposes of developing, using, marketing or distributing
    application programs conforming to the application programming interface for the operating platform for which the sample code is written.
    Notwithstanding anything to the contrary, IBM PROVIDES THE SAMPLE SOURCE CODE ON AN "AS IS" BASIS AND IBM DISCLAIMS ALL WARRANTIES,
    EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, ANY IMPLIED WARRANTIES OR CONDITIONS OF MERCHANTABILITY, SATISFACTORY QUALITY,
    FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND ANY WARRANTY OR CONDITION OF NON-INFRINGEMENT. IBM SHALL NOT BE LIABLE FOR ANY DIRECT,
    INDIRECT, INCIDENTAL, SPECIAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OR OPERATION OF THE SAMPLE SOURCE CODE.
    IBM HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS OR MODIFICATIONS TO THE SAMPLE SOURCE CODE.

 */

//Database Methods

function getAllDocs(name, limit, include_docs) {
	
		var useRealData = false;
		
		if (useRealData === true){
			var method = "getAllDocs";
	    	var msg = "method: <" + method + "> called.";
	    	WL.Logger.info(msg);

	    	var path = name + '/_all_docs?include_docs=' + include_docs;
	    	if ((limit !== null) && (!isNaN(limit))) {
	    		path = path + "&limit=" + limit;
	    	}

	    	WL.Logger.info("Path: " + path);
	    	var input = {
	    		    method : 'get',
	    		    returnedContentType : 'json',
	    		    path : path,
	    		};
	    	
	    	return WL.Server.invokeHttp(input);
	    	
		} else {
			return {
				rows: [{
					doc:{
						_id: "064e98bcffed38fc4283025047e2659e",
					    _rev: "1-e5de0c639a92863de469f587ac367a5b",
						description: "10% off on any regular price item at MFP Foods stores. Valid on Sunday, May 03, 2015 to Saturday May 09, 2015. Valid in US Only. Excludes Manhattan stores.",
						imageUrl: "img/barcode.png",
						title: "10% off on MFP Foods"
					}
				},
				{
					doc:{
						_id: "4c1282dbc73060ef37f4a1ffcff658a9",
						_rev: "2-8dd05799b6d9e347b5eff4a5812c99cd",
						description: "Buy any 5 gallon paint and get $5.00 cash rebate. Present coupon at MFP Home Improvement stores.Valid on Sunday, May 03, 2015 to Saturday May 09, 2015. Valid in US Only. Excludes Manhattan stores.",
						imageUrl: "img/barcode.png",
						title: "$5 back on paint at MFP Home Improvement"
					}
				},
				{
					doc:{
						_id: "910a9f4b43b53223f307b152d681a733",
						_rev: "1-1a691ff687760514280500b87dee71e9",
						description: "Get as low as 2.2% interest rate on your car loan. Model year 2016-2014.Valid during the month of May 2015.",
						imageUrl: "img/car.png",
						title: "2.2% APR new car loans"
					}
				}
				]
			};
		}
}



