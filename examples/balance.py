from bitshares.account import Account
#print('python shell test');
account = Account("jeaimetu-free")
print(account.balance("BTS"))
print(account.balance("BEANS"))
