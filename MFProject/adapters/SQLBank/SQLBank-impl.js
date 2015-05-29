/*
 *  Licensed Materials - Property of IBM
 *  5725-I43 (C) Copyright IBM Corp. 2011, 2013. All Rights Reserved.
 *  US Government Users Restricted Rights - Use, duplication or
 *  disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

//Create SQL query
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