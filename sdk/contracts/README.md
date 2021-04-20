# OpenTVL SDK Contracts

Smart Contracts that are required for OpenTVL SDK.
Those contracts should be deployed to all supported chains.

## Development

### Prerequisite

```
yarn install
```

### Interactive Debugging

```
yarn deploy

yarn console
```

### Test

```
yarn test
```

## Production

```
TRUFFLE_PRIVATE_KEY="<wallet-key>" TRUFFLE_RPC="<rpc-endpoint>" yarn deploy --network production
```

Note that truffle commands like `truffle migrate`/`truffle deploy`/etc would also require the environment variables.
