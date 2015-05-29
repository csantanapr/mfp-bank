### Running the demo
#### 1. Client-side deployment capabilities (making client side SDKs available for developer use)

- [ ] Open Terminal and run webapp

```bash
cd ~/Desktop/mfpbank
ionic serve
```

- [ ] Show Ionic UI WebApp that is just a website, fake check not camera API
- [ ] Start Eclipse from Desktop shortcut (MFP Studio)
- [ ] Select Workspace ~/Desktop/workspace/
- [ ] Create MobileFirst Project "MFProject"
- [ ] Create Hybrid App "MFPBank" select ios and android environments
- [ ] Terminal: Open folder with webapp assets

```bash
open www
```

- [ ] Copy over contents of www into MFPBank/common/ and replace all
- [ ] Run MFPBank -> Run As -> Run on MobileFirst Development Server
- [ ] Run Open MFPBank -> Run As -> Preview
- [ ] Show fake check
- [ ] Remove cordova.js if present
- [ ] Edit index.hmtl and move camera.js outside comment section

```javascript
<script src="js/mfp-services/camera.js"></script>
```

- [ ] Click MBS Go/Refresh
- [ ] Show Camera API with different pictures
- [ ] Show Client SDKs merged files Android jars for Cordova and MFP


#### 2. Enterprise Integration Connectors

- [ ] Select MFProject/adapters -> New -> MobileFirst Adapter
- [ ] Type "HTTP"  and Name "CloudantAdapter"
- [ ] Remove one procedure
- [ ] Rename other procedure to "getAllDocs"
- [ ] Edit Connectivity Policy protocol="https", port="443", domain=`host for cloudant account`
- [ ] Add Authentication
- [ ] Add Basic
- [ ] Edit username `username from cloudant account`
- [ ] Edit password `password from cloudant account`
- [ ] Edit Adapter JavaScript code

```javascript

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


```

- [ ] Edit index.html and move `offers_cloudant.js` outside comment area

```javascript
<script src="js/mfp-services/offers_cloudant.js"></script>
```

- [ ] Refresh MBS
- [ ] Show Offers from Cloudant DB

#### 3. Business Logic
- [ ] **Important** Import SQL Library Jar into `server/lib/` from `demofiles/mysql-connector-java-5.1.35-bin.jar`
- [ ] Select MFProject/adapters -> New -> MobileFirst Adapter
- [ ] Type *SQL*  and Name *SQLBank*
- [ ] Remove one procedure
- [ ] Rename other procedure to "getAccountTransactions"
- [ ] Edit Connection Data Source Definition
- [ ] Edit Url with MySQL DB host and DB name like "jdbc:mysql://localhost:3306/mobilefirst_training"
- [ ] Edit username like "root" 
- [ ] Edit password like "root"
- [ ] Edit Adapter JavaScript code


```javascript

var getAccountsTransactionsStatement = WL.Server.createSQLStatement(
	"SELECT fromAccount, toAccount, transactionDate, transactionAmount, transactionType " +
	"FROM accounttransactions " +
	"WHERE accounttransactions.fromAccount = ? OR accounttransactions.toAccount = ? " +
	"ORDER BY transactionDate DESC " +
	"LIMIT 20;"
);

//Invoke prepared SQL query and return invocation result
function getAccountTransactionsFromDB(accountId){
	return WL.Server.invokeSQLStatement({
		preparedStatement : getAccountsTransactionsStatement,
		parameters : [accountId, accountId]
	});
}

//Iterate over data and transform withdraws to negative amounts, and delete data not need it for mobile client
function getAccountTransactions(accountId){
	
	var useRealData = false;
	
	if (useRealData === true){
		var results = getAccountTransactionsFromDB(accountId);
		var i;
		//iterate over results to conver to negative amount any withdraws, this is how client app expects the data
		if(results.resultSet && results.resultSet.length>0)
		 {
		    for(i=0;i<results.resultSet.length;i++)
		        {
		    		if(results.resultSet[i].fromAccount === accountId){
					results.resultSet[i].transactionAmount=-Math.abs(results.resultSet[i].transactionAmount);
		    		}
		    		delete results.resultSet[i].fromAccount;
		    		delete results.resultSet[i].toAccount;
		        }
		 }
		return results;
		
	} else {
		
		return {
			resultSet:[{
				transactionAmount: -180,
				transactionDate: "2009-03-11T11:08:39.000Z",
				transactionType: "Funds Transfer"
			},{
				transactionAmount: -130,
				transactionDate: "2009-03-07T11:09:39.000Z",
				transactionType: "ATM Withdrawal"
			},{
				transactionAmount: -150,
				transactionDate: "2009-03-04T10:35:24.000Z",
				transactionType: "Funds Transfer"
			},{
				transactionAmount: -150,
				transactionDate: "2009-03-03T11:09:39.000Z",
				transactionType: "Check Withdrawal"
			},{
				transactionAmount: 9050,
				transactionDate: "2009-03-01T11:09:39.000Z",
				transactionType: "Deposit"
			}]
		};
	}
	
	
}
```

- [ ] Edit `index.html` and move `transactions_sql.js` outside comment area

```javascript
<script src="js/mfp-services/transactions_sql.js"></script>
```

- [ ] Refresh MBS
- [ ] Show Transactions from SQL DB

#### 4. Identity
- [ ] Open `server/conf/authenticationConfig.xml`
- [ ] Add the customSecurityTest inside the `securityTests` xml element

```xml

<customSecurityTest name="MFPBank-securityTest">
  			<test isInternalUserID="true" realm="SampleAppRealm"/>
  			<test isInternalDeviceID="true" realm="wl_deviceNoProvisioningRealm" />
</customSecurityTest>

```

- [ ] Edit *SQLBank* Adapter
- [ ] Edit getAccountTransactions procedure
- [ ] Edit Security Test to *MFPBank-securityTest*
- [ ] Edit `index.html` and move `authenticate.js` outside comment area

```javascript

<script src="js/mfp-services/authenticate.js"></script>

```

#### 5. Data Synchronization/Offline Data Sync
- [ ] **Important** Edit application-descriptor.xml
- [ ] Select Optional Features
- [ ] Add JSONStore
- [ ] **Important** Edit `index.htm` and move `json_store.js` outside comment area

```javascript
<script src="js/mfp-services/json_store.js"></script>
```

- [ ] Open QuickTime and show iPhone Screen, touch screen
- [ ] Select iphone right click and select Run As -> Xcode Project
- [ ] Xcode Clean
- [ ] Xcode Run -> Device iPhone
- [ ] Select MFProjectMFPBankAndroid project, right click and select Run As -> Android Application
- [ ] Show Offers from Cloudant DB and go back to home
- [ ] Put Device in Airplane mode
- [ ] Show Webpage broken with no network
- [ ] Return to MFPBank
- [ ] Show Offers from Offline JSON Store
- [ ] Stop Xcode Debugger and minimize Quick Time
- [ ] Remove MFPBank from iPhone

#### 6. Engagement services
- [ ] Select MFProject/adapters -> New -> MobileFirst Adapter
- [ ] Type "HTTP"  and Name "PushAdapter"
- [ ] Rename procedure getStories to *processTransfer*
- [ ] Add Security Test *MFPBank-securityTest*
- [ ] Rename procedure getStoriesFiltered to *processCheck*
- [ ] Add Security Test *MFPBank-securityTest*
- [ ] Edit Adapter JavaScript code

```javascript

function processTransfer(transfer) {

	WL.Logger.info('Processing transfer...');
	sendNotification('Transfer for $'+transfer+' successfuly processed');
	return {
        result : transfer
    };
}

function processCheck(check) {

	WL.Logger.info('Processing check deposit...');
	sendNotification('Check Successfuly Deposit');
	return {
        result : check
    };
}
function sendNotification(notificationText,payload) {
    var notificationOptions = {};
    notificationOptions.message = {};
    notificationOptions.message.alert = notificationText;
    notificationOptions.settings = {
    		apns:{
    			sound:'default'
    		}
    };
    WL.Server.sendMessage("MFPBank", notificationOptions);

    return {
        result : "Notification sent to all users."
    };
}

```

- [ ] Edit `index.html` and move `deposit_notification.js` and `transfer_notification.js` outside comment area

```javascript
<script src="js/mfp-services/deposit_notification.js"></script>
<script src="js/mfp-services/transfer_notification.js"></script>
```

- [ ] **Important** Add `apns-certificate-sandbox.p12` files to `MFPBank/`
- [ ] **Important** Edit `application-descriptor.xml`
- [ ] Select iphone environment
- [ ] Add Push Sender
- [ ] Edit p12 password
- [ ] Select android environment
- [ ] Add Push Sender
- [ ] Edit Key and enter GCM API Key
- [ ] Edit Sender ID and enter GCM Project Number
- [ ] Add Android Library Project for Google Play Servers from Android `<android sdk>/extras/google/google_play_services/libproject`
- [ ] Add Android libproject as a Android reference in `MFProjectMFPBankAndroid->Properties->Android)
- [ ] Edit `MFProjectMFPBankAndroid/AndroidManifest.xml` add in `<application>`

````xml
<meta-data 
    android:name="com.google.android.gms.version" 
    android:value="@integer/google_play_services_version" />
````

- [ ] Open QuickTime and display iPhone screen
- [ ] Disable Airplane mode and show webpage working
- [ ] Run iphone -> Run As -> Xcode Project
- [ ] **Important** Double check that old MFPBank is not installed
- [ ] **Important** Edit Xcode Project settings real BundleID *com.ibm.test1*
- [ ] **Important** Edit Team for Provisioning Profile setting
- [ ] Xcode Clean
- [ ] Xcode Run -> Device iPhone
- [ ] Do Transfer for $100
- [ ] Enter credentials *carlos* *password*
- [ ] Show Push Notification working
- [ ] Stop Xcode Debugger and minimize Quick Time


#### 7. Data/Analytics
- [ ] MFProject -> Open MobileFirst Console
- [ ] Open Analytics Console
- [ ] Show Tabs Dashboard, Devices, Network, Servers
- [ ] Open `js/controllers` show Analytics API for accounts, offers
- [ ] Return to Analytics Console
- [ ] Go to Dashboard->Custom Charts
- [ ] Add new Chart
- [ ] Enter Char Title *AppView Analytics for MFPBank*
- [ ] Select *Custom Activies*
- [ ] Select *Pie Chart* Type
- [ ] Select Property *AppView*
- [ ] Save the new Chart
- [ ] MFPBak -> Run Preview
- [ ] Use iPone only -> Use Offers multiple times
- [ ] Return to Analytics Console and show Pie Chart change

#### 8. App Management
- [ ] Open MobileFirst Console
- [ ] Show the adapters and delete Cloudant Adapter
- [ ] Edit CloudantAdapter.js and save

```javascript
WL.Logger.info("message from cloudant adapter");
```

- [ ] Open MobileFirst Console and show the adapter
- [ ] Edit `common/tempaltes/home.html`
- [ ] Open QuickTime and show iPhone
- [ ] Show current version of App
- [ ] Remove offers from top section
- [ ] Uncomment from bottom section
- [ ] Run -> deploy on Development Server
- [ ] Run Old version of App on iPhone and see direct update progress
- [ ] Open MobileFirst Console and go to Applications
- [ ] Disable access for MFPBank iphone
- [ ] Set url to http://ibm.com and message to "This version of MFPBank is block please upgrade"
- [ ] Show QuickTime and kill MFPBank
- [ ] Run MFPBank again and see Disable message and tab upgrade button

#### 9. Deployment

- [ ] Open MobileFirst Console on Remote MFP Server on VM/Docker running on Bluemix [http://x.x.x.x:10080/worklightconsole](http://x.x.x.x:10080/worklightconsole)
- [ ] Show 0 adapters, apps, devices
- [ ] Deploy Adapters to refresh build .apapters
- [ ] Change MFP Server MFPBank -> Run As - > Build Settings and Deploy Target
- [ ] Select Checkbox Build app to work with a different server
- [ ] Edit Remote Server: [http://x.x.x.x:10080](http://x.x.x.x:10080)
- [ ] Edit Context path: */MFProject*
- [ ] Run As -> Build All Environments
- [ ] Upload Adapter and Apps using MobileFirst Console
- [ ] Run As -> Xcode Project
- [ ] Run App on iPhone
- [ ] Run As -> Android Application
- [ ] Open MobileFirst Console and show the new registered apps
- [ ] Show how to disable Builds for Remote Serve, uncheck in Run As - > Build Settings and Deploy Target


#### 10. Quality Life-Cycle Management
- [ ] Open MobileFirst Console
- [ ] Open Client Log Profiles
- [ ] Add a new Profile for MFPBank
- [ ] Run App on iPhone or MBS and use it to generate Logs
- [ ] Open Analytics Console and go to Search Tab
- [ ] Show analytics Client Logs
- [ ] Show info Server Logs (download within 1 Day)
- [ ] Edit Eclipse preferences -> MobileFirst -> Templates and Components 
- [ ] Download Worklight JavaScript SDK (demofiles/mfpcomponents/MQA-1.9.19-saas.wlc)into $HOME/IBM/templates/
- [ ] If using MFP CLI then extract MQA.js from MQA-1.9.19-saas.wlc into common/js/MQA.js
- [ ] Select MFProject -> Add Application Component
- [ ] Edit `index.html` and move `deposit_notification.js` and `transfer_notification.js` outside comment area

```javascript
<script src="js/MQA.js" type="text/javascript"></script>
<script src="js/mfp-services/quality_assurance.js"></script>
```
- [ ] Edit `js/mfp-services/quality_assurance.js`
- [ ] Enter MQA API Key for ios and android
- [ ] Run As - Deploy to Development Server
- [ ] Runs As -> Xcode Project
- [ ] Shake iPhone to report Bug
- [ ] Use Menu to submit feedback
- [ ] Show MQA Console
