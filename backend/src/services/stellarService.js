import StellarSdk from "@stellar/stellar-sdk";

const server = new StellarSdk.Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

const EPRW = "EPRW";

// 🔐 Criar wallet
export function createWallet() {
  const pair = StellarSdk.Keypair.random();

  return {
    publicKey: pair.publicKey(),
    privateKey: pair.secret()
  };
}

// 💸 Fund account
export async function fundAccount(publicKey) {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${publicKey}`
  );

  return response.json();
}

// 💰 Saldo
export async function getBalance(publicKey) {
  const account = await server.loadAccount(publicKey);

  return {
    balances: account.balances
  };
}

// 🔗 Trustline
export async function createTrustline(
  privateKey,
  issuerPublicKey
) {
  const keypair = StellarSdk.Keypair.fromSecret(privateKey);

  const account = await server.loadAccount(keypair.publicKey());

  const asset = new StellarSdk.Asset(EPRW, issuerPublicKey);

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(keypair);

  return server.submitTransaction(transaction);
}

// 🪙 Emitir token
export async function issueToken(
  issuerPrivateKey,
  destinationPublic,
  amount
) {
  const issuer = StellarSdk.Keypair.fromSecret(issuerPrivateKey);

  const issuerAccount = await server.loadAccount(
    issuer.publicKey()
  );

  const asset = new StellarSdk.Asset(
    EPRW,
    issuer.publicKey()
  );

  const transaction = new StellarSdk.TransactionBuilder(
    issuerAccount,
    {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    }
  )
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublic,
        asset,
        amount
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(issuer);

  return server.submitTransaction(transaction);
}

// 📊 SELL OFFER
export async function createSellOffer(
  privateKey,
  amount,
  price,
  issuerPublicKey
) {
  const pair = StellarSdk.Keypair.fromSecret(privateKey);

  const account = await server.loadAccount(pair.publicKey());

  const selling = new StellarSdk.Asset(
    EPRW,
    issuerPublicKey
  );

  const buying = StellarSdk.Asset.native();

  const transaction = new StellarSdk.TransactionBuilder(
    account,
    {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    }
  )
    .addOperation(
      StellarSdk.Operation.manageSellOffer({
        selling,
        buying,
        amount,
        price,
        offerId: 0
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(pair);

  return server.submitTransaction(transaction);
}

// 📊 BUY OFFER
export async function createBuyOffer(
  privateKey,
  amount,
  price,
  issuerPublicKey
) {
  const pair = StellarSdk.Keypair.fromSecret(privateKey);

  const account = await server.loadAccount(pair.publicKey());

  const buying = new StellarSdk.Asset(
    EPRW,
    issuerPublicKey
  );

  const selling = StellarSdk.Asset.native();

  const transaction = new StellarSdk.TransactionBuilder(
    account,
    {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    }
  )
    .addOperation(
      StellarSdk.Operation.manageBuyOffer({
        selling,
        buying,
        buyAmount: amount,
        price,
        offerId: 0
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(pair);

  return server.submitTransaction(transaction);
}

// 💸 Compra direta
export async function buyEPRW({
  buyerSecret,
  issuerPublicKey,
  amountToReceive,
  maxXlmSpend
}) {
  const buyer = StellarSdk.Keypair.fromSecret(buyerSecret);

  const account = await server.loadAccount(
    buyer.publicKey()
  );

  const sendAsset = StellarSdk.Asset.native();

  const destAsset = new StellarSdk.Asset(
    EPRW,
    issuerPublicKey
  );

  const transaction = new StellarSdk.TransactionBuilder(
    account,
    {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    }
  )
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax: maxXlmSpend,
        destination: buyer.publicKey(),
        destAsset,
        destAmount: amountToReceive
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(buyer);

  return server.submitTransaction(transaction);
}

// 📈 Orderbook
export async function getOrderbook(issuerPublicKey) {
  const selling = new StellarSdk.Asset(
    EPRW,
    issuerPublicKey
  );

  const buying = StellarSdk.Asset.native();

  const orderbook = await server
    .orderbook(selling, buying)
    .call();

  const bids = orderbook.bids || [];
  const asks = orderbook.asks || [];

  const bestBid = bids[0]?.price || null;
  const bestAsk = asks[0]?.price || null;

  const midPrice =
    bestBid && bestAsk
      ? (
          (parseFloat(bestBid) +
            parseFloat(bestAsk)) /
          2
        ).toFixed(6)
      : null;

  const spread =
    bestBid && bestAsk
      ? (
          parseFloat(bestAsk) -
          parseFloat(bestBid)
        ).toFixed(6)
      : null;

  const volume = asks.reduce(
    (acc, ask) => acc + Number(ask.amount),
    0
  );

  return {
    bestBid,
    bestAsk,
    midPrice,
    spread,
    volume,
    bids,
    asks
  };
}