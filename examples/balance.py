from bitshares.account import Account
account = Account("jeaimetu-free")
print(account.balances)
print(account.openorders)
for h in account.history():
    print(h)
