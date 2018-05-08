import {Apis} from "bitsharesjs-ws";
import {ChainStore, FetchChain, PrivateKey, TransactionHelper, Aes, TransactionBuilder} from "../lib";

//var privKey = "5KBuq5WmHvgePmB7w3onYsqLM8ESomM2Ae7SigYuuwg8MDHW7NN";
var privKey = process.env.privKey;
var http = require('http'); 
let pKey = PrivateKey.fromWif(privKey);

var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGODB_URI;

var count = 0;
var count_limit = process.env.limit;

/*
var PythonShell = require('python-shell');
 

function balanceCheck(){
	console.log("run phython shell");
	PythonShell.run('examples/balance.py', function (err, result) {
  		if (err) throw err;
		console.log(result);
		console.log(result[0], result[1]);
	
		var btsTemp = result[0].split(".");
		console.log(btsTemp);
		btsTemp[0] = btsTemp[0].replace(/,/g, "");
		var btsBalance = parseInt(btsTemp[0], 10);
	
		var beansTemp = result[1].split(".");
		console.log(beansTemp);
		beansTemp[0] = beansTemp[0].replace(/,/g, "");
		console.log(beansTemp[0]);
		var beansBalance = parseInt(beansTemp[0], 10);
		console.log("trasformed", btsBalance, beansBalance);
	
  		console.log('async finished');
		
		//balance check and call airdrop or pending
		if(beansBalance < 20000 || btsBalance < 1){
			console.log("balance is not enough");
		}else{
			doAirDrop();
		}
			
				    
	});
	console.log("complete python shell");
}
*/

console.log("bitshare started");

if(process.env.update == true){
	//update ing DB
	console.log("update ing database");
	var dbo = db.db("heroku_9cf4z9w3");
  	var query = { ispaid : "ing" };
  	dbo.collection("customers").update(query, {$set : {"ispaid" : "no"}},{multi:true}, function(err, result) {
		db.close();
	});
	
}


function doAirDrop() {
	if(process.env.on.toString() != "true"){
		console.log("working flag is false go to sleep");
		return;
	}
		
	if(count >= count_limit){
		console.log("Automatic transmission limit exceeded");
		return;
	}else{
		count++;
	}
		
	MongoClient.connect(url, function(err, db) {
  		if (err) throw err;
  		var dbo = db.db("heroku_9cf4z9w3");
  		var query = { ispaid : "no" };
  		dbo.collection("customers").findOne(query, function(err, result) {
    			if (err){ 
	    			throw err;
	    			db.close();
	    		}else{
      				console.log(result);
				if(result == null){
					console.log("there is nothing to process");
					return;
				}
      				console.log(result.bitshare, result.ncafe);

        			//update DB
        			var myquery = { bitshare : result.bitshare };
        			var newvalues = { $set: {ispaid: "ing" }};
        			dbo.collection("customers").updateOne(myquery, newvalues, function(err, res) {
          				if (err) throw err;
          				console.log("1 document updated with marking ing", result.bitshare);

					db.close();
					if(parseInt(result.eos, 10) >= process.env.eos){					
						btsTransfer(result.bitshare, result.eos);
					}else{
						console.log("BEANS transfer canceled due to EOS limit", result.bitshare,result.eos,process.env.eos);
					}
					
        			});    //end dbo.collection          
	    		}
    		});//end dbo.collection("customers").findone

	}); //end MongoClient.connect
} //end of airdrop
//btsTransfer("jeaimetu-test");

//process.exit()

function btsTransfer(btsid, eos){
//Apis.instance("wss://node.testnet.bitshares.eu", true)
console.log("transfer test", btsid);
Apis.instance("wss://bitshares.openledger.info/ws", true)
.init_promise.then((res) => {
    console.log("connected to:", res[0].network_name, "network");

    ChainStore.init().then(() => {

        let fromAccount = "jeaimetu-free";
        let memoSender = fromAccount;
        let memo = "BEANS Airdrop From EOSCAFE";

        //let toAccount = "eos-cafe";
      let toAccount = btsid;
	    var eosBalance = parseInt(eos, 10);
	    var sendBeansAmount = 0;
	    
	    if(eosBalance > 100)
		    sendBeansAmount = 100000000;
	    else if(eosBalance <= 100 && eosBalance >= 1)
		    sendBeansAmount = 50000000;
	    else
		    sendBeansAmount = 25000000;

        let sendAmount = {
            amount: sendBeansAmount,
            asset: "BEANS"
        }

        Promise.all([
                FetchChain("getAccount", fromAccount),
                FetchChain("getAccount", toAccount),
                FetchChain("getAccount", memoSender),
                FetchChain("getAsset", sendAmount.asset),
                FetchChain("getAsset", sendAmount.asset)
            ]).then((res)=> {
                //console.log("got data:", res);
                let [fromAccount, toAccount, memoSender, sendAsset, feeAsset] = res;

                // Memos are optional, but if you have one you need to encrypt it here
                let memoFromKey = memoSender.getIn(["options","memo_key"]);
                //console.log("memo pub key:", memoFromKey);
                let memoToKey = toAccount.getIn(["options","memo_key"]);
                let nonce = TransactionHelper.unique_nonce_uint64();

                let memo_object = {
                    from: memoFromKey,
                    to: memoToKey,
                    nonce,
                    message: Aes.encrypt_with_checksum(
                        pKey,
                        memoToKey,
                        nonce,
                        memo
                    )
                }

                let tr = new TransactionBuilder()

                tr.add_type_operation( "transfer", {
                    fee: {
                        amount: 0,
                        asset_id: feeAsset.get("id")
                    },
                    from: fromAccount.get("id"),
                    to: toAccount.get("id"),
                    amount: { amount: sendAmount.amount, asset_id: sendAsset.get("id") },
                    memo: memo_object
                } )

                tr.set_required_fees().then(() => {
                    tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
                    //console.log("serialized transaction:", tr.serialize());
                    tr.broadcast(() => {
                      console.log("tykim","after completion of call back","bitshare", btsid);
                      
                      MongoClient.connect(url, function(err, db) {
                        if (err) throw err;
                        var dbo = db.db("heroku_9cf4z9w3");
                            //update DB
                        var myquery = { bitshare : btsid };
                        var newvalues = { $set: {ispaid: "yes" }}; 
                        dbo.collection("customers").updateOne(myquery, newvalues, function(err, res) {
                              if (err) throw err;
                              console.log("successfully transfer for", btsid,"and db changed to yes");
                        });
                      db.close();
                    });
                  
                      /*
                          if (err){
                            consoloe.log("broadcast error");
                            throw err;
                            
                                  }
                       console.log("broadcast callback"); 
                          console.log(result);*/
                    });
                })
            });
    });
});
}//end of function
	


//setInterval(balanceCheck, 15000);
setInterval(doAirDrop, 60000);



function getRank(cb){
	MongoClient.connect(url, (err, db) => {
		sumCars(db, (result) => {
			db.close();
			console.log("getRank",result);
			cb(result);
			return result;
		});
	});
	
	var sumCars = (db, callback) => {
		var agr = [{$match: { refer: {$exists:true, $ne: null}}},
			   {"$addFields": { "isUnique" : { "$cmp" : [ "$refer", "$bitshare" ]}}},
			   {$match : { isUnique : {$ne : 0}}},
			   {$group: {_id: "$refer", all: { $sum: 1 } }}, 			   
			   {$sort: {all: -1}}
			   ]; 
		var dbo = db.db("heroku_9cf4z9w3");
		var cursor = dbo.collection('customers').aggregate(agr).toArray( (err, res) => {
			console.log(res);
			callback(res);
		});
	};
}

// Create a function to handle every HTTP request
function handler(req, res){
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);

					//make html body
	var r1 = "<html><body><h1>";
	var r2 = "</h1></body></html>";
	var r3 = "telegram test";
	//r3 += data;
	var answer = r1+r3+r2;
	res.end(answer);
	//make html body
			
    //res.end("<html><body><h1>Hello</h1></body></html>");

};


http.createServer(handler).listen(process.env.PORT, function(err){
  if(err){
    console.log('Error starting http server');
  } else {
    console.log("Server running at http://127.0.0.1:8000/ or http://localhost:8000/");
  };
});


// server.js
// load the things we need
/***
var express = require('express');
var app = express();

// set the view engine to ejs
app.set('view engine', 'ejs');
app.set('views',"examples/views");

// use res.render to load up an ejs view file

// index page 
app.get('/', function(req, res) {
	getRank(function(drinks){
		console.log("in appget",drinks);
		var tagline = "TBD";
    		res.render('pages/index', {
        	drinks: drinks,
        	tagline: tagline
    		});
		
	});
	//console.log(drinks);
	/***
    var drinks = [
        { name: 'Bloody Mary', drunkness: 3 },
        { name: 'Martini', drunkness: 5 },
        { name: 'Scotch', drunkness: 10 }
    ];
    ***/

/* 
});
*/
/*

// about page 
app.get('/about', function(req, res) {
    res.render('pages/about');
});

app.listen(process.env.PORT);
*/




