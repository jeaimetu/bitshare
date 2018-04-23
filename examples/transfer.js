import {Apis} from "bitsharesjs-ws";
import {ChainStore, FetchChain, PrivateKey, TransactionHelper, Aes, TransactionBuilder} from "../lib";

//var privKey = "5KBuq5WmHvgePmB7w3onYsqLM8ESomM2Ae7SigYuuwg8MDHW7NN";
var privKey = process.env.privKey;
let pKey = PrivateKey.fromWif(privKey);

var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGODB_URI;

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  var dbo = db.db("heroku_9cf4z9w3");
  var query = { ispaid : "no" };
  dbo.collection("customers").find(query).toArray(function(err, result) {
    if (err) throw err;
    //console.log(result);
    var count = 0;
    result.forEach((product, index) => {
      console.log(product.bitshare);
      if(count < 1){
        btsTransfer(product.bitshare);
        count++;
        //update DB
        var myquery = { bitshare : product.bitshare };
        var newvalues = { $set: {ispaid: "ing" }};
        dbo.collection("customers").updateOne(myquery, newvalues, function(err, res) {
          if (err) throw err;
          console.log("1 document updated");
        });
                         
        
      }
    });
    
    db.close();
  });
});

//btsTransfer("jeaimetu-test");

//process.exit()

function btsTransfer(btsid){
//Apis.instance("wss://node.testnet.bitshares.eu", true)
console.log("transfer test", btsid);
Apis.instance("wss://bitshares.openledger.info/ws", true)
.init_promise.then((res) => {
    console.log("connected to:", res[0].network_name, "network");

    ChainStore.init().then(() => {

        let fromAccount = "jeaimetu-free";
        let memoSender = fromAccount;
        let memo = "Testing transfer from node.js";

        //let toAccount = "eos-cafe";
      let toAccount = btsid;

        let sendAmount = {
            amount: 100,
            asset: "BEANS"
        }

        Promise.all([
                FetchChain("getAccount", fromAccount),
                FetchChain("getAccount", toAccount),
                FetchChain("getAccount", memoSender),
                FetchChain("getAsset", sendAmount.asset),
                FetchChain("getAsset", sendAmount.asset)
            ]).then((res)=> {
                console.log("got data:", res);
                let [fromAccount, toAccount, memoSender, sendAsset, feeAsset] = res;

                // Memos are optional, but if you have one you need to encrypt it here
                let memoFromKey = memoSender.getIn(["options","memo_key"]);
                console.log("memo pub key:", memoFromKey);
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
                    console.log("serialized transaction:", tr.serialize());
                    tr.broadcast(() => {
                      console.log("tykim","after completion of call back");
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
